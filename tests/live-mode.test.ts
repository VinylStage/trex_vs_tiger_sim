import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { ko } from '../src/i18n/ko';
import { DT } from '../src/sim/engine';
import { CARD_IDS } from '../src/sim/free/cards';
import { sanitizeFreeConfig } from '../src/sim/free/config';
import { buildFreeDesign } from '../src/sim/free/design';
import {
  FreeOutcome,
  simulateFreeBattle,
  type FreeRunSummary,
  type FreeTrace,
} from '../src/sim/free/engine';
import { designRow } from '../src/sim/sampling';
import { decodeAnyResult, encodeFreeResult } from '../src/share/free-result-codec';
import { cardKeys, choicesOf } from '../src/ui/cards-ui';
import { barAt, barText } from '../src/ui/chance-bar';
import { setLang } from '../src/ui/i18n';
import type { LiveBar, LiveChancePoint } from '../src/ui/live-chance';
import {
  AUTO_TARGET_S,
  BANNER_KEYS,
  CAPTION_SPAN_S,
  SLOW_SPEED,
  autoSpeed,
  banners,
  captionAt,
  captions,
  cardTick,
  pauseTime,
  slowMoments,
  speedAt,
  winnerOf,
} from '../src/ui/live-model';
import { liveSnapshot } from '../src/ui/live';
import { deriveFreeEvents, type FreeEvents } from '../src/ui/replay/free-events';
import { SPEEDS } from '../src/ui/replay/timeline';
import { bannedIn } from './banned-words';

/*
 * Live battle mode (#183) and its bar (#222): the pause point, auto speed and slow-downs, the
 * banners, captions, the bar's reading (held between checkpoints, never ahead; the strength
 * fallback never shown as a percentage), the card choices, and the share snapshot of a live
 * battle with its log. The DOM glue in src/ui/live.ts is exercised in a browser (PR notes).
 */

const pt = (t: number, chance: number): LiveChancePoint => ({
  t,
  tick: Math.round(t / DT),
  chance,
  a: 0,
  b: 0,
  draw: 0,
  n: 32,
});
const chanceBar = (...pts: [number, number][]): LiveBar => ({
  kind: 'chance',
  points: pts.map(([t, c]) => pt(t, c)),
});
const strengthBar = (...pts: [number, number][]): LiveBar => ({
  kind: 'strength',
  points: pts.map(([t, ratio]) => ({ t, ratio })),
});

describe('pause point (§4.4)', () => {
  it('picks the checkpoint closest to 50 % within 25–60 % of the battle', () => {
    const bar = chanceBar([0, 0.5], [10, 0.7], [30, 0.62], [40, 0.45], [50, 0.52], [70, 0.5]);
    // Duration 100: window [25, 60]; 50 is closest (0.02), 0 and 70 are outside.
    expect(pauseTime(bar, 100)).toBe(50);
  });

  it('takes the earliest on a tie and reads a strength bar the same way', () => {
    expect(pauseTime(chanceBar([30, 0.6], [40, 0.4]), 100)).toBe(30);
    expect(pauseTime(strengthBar([30, 0.9], [55, 0.51]), 100)).toBe(55);
  });

  it('falls back to 40 % of the battle without a checkpoint in the window', () => {
    expect(pauseTime(chanceBar([0, 0.5], [80, 0.5]), 100)).toBe(40);
    expect(pauseTime(null, 50)).toBe(20);
  });

  it('applies a card at ceil(T / DT) + 1, after every frame up to the playhead', () => {
    expect(cardTick(0)).toBe(1);
    expect(cardTick(5)).toBe(51);
    expect(cardTick(30 * DT)).toBe(31);
    expect(cardTick(5.05)).toBe(52);
  });
});

describe('auto speed (§4.4)', () => {
  it('fits the rest of the battle into about 45–60 s, clamped to 0.5×–16×', () => {
    for (const remaining of [10, 30, 60, 120, 240, 600, 3600]) {
      const s = autoSpeed(remaining);
      expect(SPEEDS as readonly number[]).toContain(s);
      expect(s).toBeGreaterThanOrEqual(0.5);
      expect(s).toBeLessThanOrEqual(16);
    }
    expect(autoSpeed(AUTO_TARGET_S)).toBe(1);
    expect(autoSpeed(105)).toBe(2);
    expect(autoSpeed(5)).toBe(0.5);
    expect(autoSpeed(10_000)).toBe(16);
    // Real time stays within a factor √2 of the target wherever the clamp allows.
    for (const remaining of [40, 75, 150, 300, 500]) {
      const real = remaining / autoSpeed(remaining);
      expect(real / AUTO_TARGET_S).toBeGreaterThan(0.7);
      expect(real / AUTO_TARGET_S).toBeLessThan(1.42);
    }
  });

  it('slows to 0.5× just after first contact and the decisive moment', () => {
    const events = { firstContact: 4, lastIncapacitation: 30 } as FreeEvents;
    const bar = chanceBar([0, 0.6], [20, 0.4], [40, 0.3]);
    // Last 50 % crossing between 0.6 at 0 and 0.4 at 20: t = 10.
    expect(slowMoments(events, bar)).toEqual([4, 10]);
    // The strength bar is not a chance: the decisive moment falls back to the last incapacitation.
    expect(slowMoments(events, strengthBar([0, 0.6], [20, 0.4]))).toEqual([4, 30]);
    expect(speedAt(4.5, 4, [4, 10])).toBe(SLOW_SPEED);
    expect(speedAt(5, 4, [4, 10])).toBe(4);
    expect(speedAt(10.2, 0.25, [10])).toBe(0.25);
  });
});

describe('banners (§4.4)', () => {
  const sum = (outcome: FreeRunSummary['outcome'], aHpFrac = 0.8, bHpFrac = 0) => ({
    outcome,
    aHpFrac,
    bHpFrac,
  });

  it('UPSET: the winner had under 30 % before the battle', () => {
    expect(banners(sum(FreeOutcome.A), null, 0.25, false)).toEqual(['upset']);
    expect(banners(sum(FreeOutcome.A), null, 0.3, false)).toEqual([]);
    expect(banners(sum(FreeOutcome.B), null, 0.75, false)).toEqual(['upset']);
    expect(banners(sum(FreeOutcome.Draw, 0.5, 0.5), null, 0.1, false)).toEqual([]);
  });

  it('COMEBACK: the winner fell under 20 % at a checkpoint, on a chance bar only', () => {
    const bar = chanceBar([0, 0.5], [10, 0.15], [20, 0.6]);
    expect(banners(sum(FreeOutcome.A), bar, 0.5, false)).toEqual(['comeback']);
    expect(banners(sum(FreeOutcome.B), bar, 0.5, false)).toEqual([]);
    expect(banners(sum(FreeOutcome.A), strengthBar([10, 0.05]), null, false)).toEqual([]);
  });

  it('CARD SWING and PHOTO FINISH, in a fixed order', () => {
    expect(banners(sum(FreeOutcome.A, 0.12, 0.05), null, 0.1, true)).toEqual([
      'upset',
      'cardSwing',
      'photoFinish',
    ]);
    expect(banners(sum(FreeOutcome.A, 0.3, 0.05), null, null, false)).toEqual([]);
  });

  it('names the winner from the outcome', () => {
    expect(winnerOf({ outcome: FreeOutcome.A })).toBe(0);
    expect(winnerOf({ outcome: FreeOutcome.B })).toBe(1);
    expect(winnerOf({ outcome: FreeOutcome.Draw })).toBeNull();
  });
});

describe('captions (§4.4, §10.8)', () => {
  const config = sanitizeFreeConfig({
    runs: 2,
    seed: 3,
    sides: [
      { species: 'wolf', count: 8 },
      { species: 'brownBear', count: 1 },
    ],
  });
  const trace = simulateFreeBattle(config, designRow(buildFreeDesign(config), 0), 0, true)
    .trace as FreeTrace;
  const events = deriveFreeEvents(trace);

  it('come from the derived events, in time order, and stay for a few seconds', () => {
    const list = captions(events, chanceBar([0, 0.7], [events.duration, 0.3]));
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]?.key).toBe('live.cap.contact');
    expect(list[0]?.t).toBe(events.firstContact);
    for (let i = 1; i < list.length; i++) {
      expect((list[i]?.t ?? 0) >= (list[i - 1]?.t ?? 0)).toBe(true);
    }
    expect(list.some((c) => c.key === 'live.cap.decisive')).toBe(true);
    const first = list[0];
    if (!first) return;
    expect(captionAt(list, first.t - 0.01)).toBeNull();
    expect(captionAt(list, first.t)).not.toBeNull();
    expect(captionAt([first], first.t + CAPTION_SPAN_S)).toBeNull();
  });

  it('use only allowed words in both languages', () => {
    const keys = [
      ...Object.values(BANNER_KEYS),
      'live.cap.contact',
      'live.cap.encircle',
      'live.cap.morale',
      'live.cap.decisive',
    ] as const;
    for (const k of keys) {
      expect(bannedIn(ko[k])).toBeNull();
      expect(bannedIn(en[k])).toBeNull();
    }
    for (const [k, v] of Object.entries(ko))
      if (k.startsWith('live.')) expect(bannedIn(v), k).toBeNull();
    for (const [k, v] of Object.entries(en))
      if (k.startsWith('live.')) expect(bannedIn(v), k).toBeNull();
  });
});

describe('live bar (#222)', () => {
  it('holds the last checkpoint at or before the playhead, never a later one', () => {
    const bar = chanceBar([0, 0.5], [10, 0.7], [20, 0.2]);
    expect(barAt(bar, -1)).toBeNull();
    expect(barAt(bar, 0)?.a).toBe(0.5);
    expect(barAt(bar, 9.99)?.a).toBe(0.5);
    expect(barAt(bar, 10)?.a).toBe(0.7);
    expect(barAt(bar, 19.99)?.a).toBe(0.7);
    expect(barAt(bar, 500)?.a).toBe(0.2);
    expect(barAt(null, 5)).toBeNull();
    // Before the first point of a bar that starts later: nothing, not the later value.
    expect(barAt(chanceBar([5, 0.9]), 4)).toBeNull();
  });

  it('labels a chance as 실시간 예상 승률 with percentages', async () => {
    await setLang('ko');
    const r = barAt(chanceBar([0, 0.62]), 1);
    if (!r) throw new Error('no reading');
    const text = barText(r, ['늑대 8', '불곰 1']);
    expect(text.label).toBe('실시간 예상 승률');
    expect(text.a).toBe('62%');
    expect(text.b).toBe('38%');
    expect(text.spoken).toBe('실시간 예상 승률: 늑대 8 62%, 불곰 1 38%');
    await setLang('en');
    expect(barText(r, ['Wolves 8', 'Brown bear 1']).label).toBe('Live win chance');
    await setLang('ko');
  });

  it('never shows the strength fallback as a percentage or a chance', async () => {
    for (const lang of ['ko', 'en'] as const) {
      await setLang(lang);
      for (const ratio of [0, 0.123, 0.5, 0.62, 1]) {
        const r = barAt(strengthBar([0, ratio]), 0);
        if (!r) throw new Error('no reading');
        expect(r.kind).toBe('strength');
        const text = barText(r, ['A', 'B']);
        expect(text.label).toBe(lang === 'ko' ? '전력 비율' : 'Strength ratio');
        for (const s of [text.a, text.b, text.spoken]) {
          expect(s).not.toContain('%');
          expect(s).not.toMatch(/승률|chance|probab/i);
        }
      }
    }
    await setLang('ko');
    const r = barAt(strengthBar([0, 0.62]), 0);
    expect(r && barText(r, ['A', 'B'])).toMatchObject({ a: '6.2', b: '3.8' });
  });
});

describe('card choices', () => {
  it('offers a card on both sides once and a one-side card on each side', () => {
    const mv = 2;
    expect(choicesOf(mv, CARD_IDS.indexOf('downpour'))).toEqual([
      { card: CARD_IDS.indexOf('downpour'), side: 2 },
    ]);
    expect(choicesOf(mv, CARD_IDS.indexOf('focus')).map((c) => c.side)).toEqual([0, 1]);
    expect(choicesOf(mv, 999)).toEqual([]);
    for (let code = 0; code < CARD_IDS.length; code++) {
      const keys = cardKeys(code);
      if (!keys) throw new Error('no keys');
      expect(ko[keys.name].length).toBeGreaterThan(0);
      expect(en[keys.effect].length).toBeGreaterThan(0);
    }
    expect(cardKeys(-1)).toBeNull();
  });
});

describe('sharing a live battle (#180)', () => {
  it('writes a one-run snapshot that a v3 link replays exactly', () => {
    const config = sanitizeFreeConfig({
      runs: 3,
      seed: 9,
      sides: [
        { species: 'lion', count: 3 },
        { species: 'tiger', count: 1 },
      ],
    });
    const log = [{ tick: 40, card: CARD_IDS.indexOf('power-surge'), side: 1 as const }];
    const row = designRow(buildFreeDesign(config), 2);
    const { summary } = simulateFreeBattle(config, row, 2, false, { interventions: log });
    const snap = liveSnapshot(config, summary);
    expect(snap.n).toBe(1);
    const dec = decodeAnyResult(encodeFreeResult(config, snap, { live: { run: 2, iv: log } }));
    if (!dec.ok || dec.kind !== 'free' || !dec.live) throw new Error('decode failed');
    const again = simulateFreeBattle(dec.config, row, dec.live.run, false, {
      interventions: dec.live.iv,
    }).summary;
    expect(liveSnapshot(dec.config, again)).toEqual(dec.summary);
  });
});

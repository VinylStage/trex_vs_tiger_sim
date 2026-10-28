import { describe, expect, it, vi } from 'vitest';
import type { FreeConfig } from '../src/sim/free/config';

/*
 * Simple runs keep the config's model version (#154 review). This build runs only model 1, so
 * the sanitizer is stood in for one that also runs model 2, as a later build will.
 */
vi.mock('../src/sim/free/config', async (importActual) => {
  const actual = await importActual<typeof import('../src/sim/free/config')>();
  return {
    ...actual,
    sanitizeFreeConfig: (raw: unknown): FreeConfig => {
      const c = actual.sanitizeFreeConfig(raw);
      const mv = (raw as { mv?: unknown }).mv;
      return mv === 2 ? { ...c, mv: 2 } : c;
    },
  };
});

const { defaultSimpleConfig, hasHiddenEdits, simpleCanShow, simpleRunConfig } =
  await import('../src/ui/simple-model');

describe('Simple runs and the model version', () => {
  it('keep the mv of the config they run', () => {
    const v2: FreeConfig = { ...defaultSimpleConfig(), mv: 2 };
    expect(simpleRunConfig(v2, 5).mv).toBe(2);
    expect(simpleRunConfig(defaultSimpleConfig(), 5).mv).toBe(1);
  });

  it('so a config of another model version can still be shown in Simple', () => {
    const v2: FreeConfig = { ...simpleRunConfig(defaultSimpleConfig(), 5), mv: 2 };
    expect(hasHiddenEdits(v2)).toBe(false);
    expect(simpleCanShow(v2)).toBe(true);
  });
});

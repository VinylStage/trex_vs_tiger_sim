# UX research and audit: T-Rex vs Tiger simulator

- Track: **ux** (simulator page, results, replay; plus UX requirements for the help pages, tutorial, version display and ad-ready layout that the owner requested)
- Date: 2026-10-19
- Audited code: `origin/main` at `de8f4d2` (v0.1.0). The checkout moved to `6c84e0e` ("self-host Pretendard", #32) during the audit. That commit only changes the font, so the findings still apply; I re-ran the layout-shift tests on `6c84e0e`.
- Author: research subagent. Nothing in the repo was modified.

---

## 0. Executive summary

The simulator is technically solid. axe-core (WCAG 2.2 AA plus best-practice rules) found only one violated rule, colour contrast. Keyboard tab order is logical, there is no horizontal scroll at 320 px, the progress bar shows percent done and an ETA, and the "stale results" banner is a good pattern. The main UX risks are elsewhere:

1. **Lay users will misread the numbers.** The headline reads "T-Rex 승리 확률 100.0% (95% CI 96.3%–100.0%)". It shows false precision, uses statistical jargon, and puts the "toy model, not a prediction" caveat only in the footer. Research on CI misreading and frequency framing (sources below) argues for counts like "500번 중 498번", plain-language precision and a caveat next to the number.
2. **Six concrete WCAG 2.2 AA failures or high-risk items**, all measured:
   - Primary-button contrast is 4.42:1 in light mode and 3.64:1 in dark mode.
   - Input borders are 1.43:1 against the surface.
   - Keyboard focus drops to `<body>` when Run is pressed.
   - The sticky run bar hides focused inputs on mobile (24 of 80 tab stops).
   - Replay tiger states differ by colour only, and some state colours are below 3:1 against the arena.
   - Canvas charts have no data-table alternative, and their tooltips never appear on touch.
3. **Layout stability needs work before ads arrive.** When content below the results panel is visible, rendering results gives **CLS 0.10** (reproduced twice). Any ad slot below the results would make this worse. Long tasks of 100–300 ms happen when results render, which is an INP risk on phones.
4. **Help and tutorial.** Use pull help: an empty-state quick start, glossary toggletips, an opt-in interactive tour, and separate guide, model and parameter pages with consistent navigation. Avoid a forced deck-of-cards tour.
5. **Replay.** Stay with abstract glyphs (owner constraint: no realistic characters), and make them more readable:
   - Encode state by shape as well as colour.
   - Show HP as a ring.
   - Add event pulses and latch tethers.
   - Add a timeline with event ticks.
   - Respect reduced-motion (the replay currently autoplays even with `prefers-reduced-motion: reduce`).

Top priorities (detail in section 4):

- **P0-1** Fix the contrast tokens: button, links, input borders.
- **P0-2** Manage focus on Run, Cancel and completion. Add `scroll-padding` for the sticky run bar.
- **P0-3** Reframe the headline with frequencies, honest precision and an inline caveat.
- **P0-4** Reserve layout space (results skeleton and ad slots) to keep CLS ≤ 0.05.
- **P0-5** Add data tables and touch-friendly tooltips for charts.

---

## 1. Method

| Step                              | What                                                                                                                                                                                | Evidence / artefact                                                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code read                         | `src/ui/{app,form,charts,replay,pool,cost,share,dom,format,i18n}.ts`, `styles.css`, `index.html`, `public/_headers`, docs                                                           | —                                                                                                                                                               |
| Screenshots                       | Production screenshots 01–08 in `<local-workspace>/e2e-prod/`                                                                                                                       | Visual review                                                                                                                                                   |
| Live audit                        | Copy of the repo in `<local-workspace>/ux-copy` → `vite build` → `vite preview :4317` → Playwright 1.56.1 (Chromium)                                                                | Scripts in `<local-workspace>/uxscripts/` (`audit.mjs`, `kbd.mjs`, `misc.mjs`, `cls2.mjs`, `cls3.mjs`); raw output `<local-workspace>/uxscripts/audit-out.json` |
| Automated a11y                    | axe-core 4.11.0, tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`. Initial, results, and dark results states                                                      | `audit-out.json`                                                                                                                                                |
| Target size                       | Bounding boxes of all interactive elements at 1366 px, 390 px and 320 px                                                                                                            | `audit-out.json`                                                                                                                                                |
| Layout stability / responsiveness | `PerformanceObserver` for `layout-shift`, `longtask`, `largest-contentful-paint`                                                                                                    | `cls2.mjs`, `cls3.mjs`                                                                                                                                          |
| Colour                            | WCAG contrast plus CIEDE2000 distance after Machado-2009 CVD simulation (protan, deutan, tritan; severity 1.0)                                                                      | `uxscripts/palette.py`, `palette2.py`                                                                                                                           |
| Research                          | Primary sources: W3C WCAG 2.2 Understanding docs, NN/g, GOV.UK, web.dev, Google AdSense and Publisher Policy help, peer-reviewed papers checked via Crossref and PubMed E-utilities | Section 6                                                                                                                                                       |

Lab caveats:

- Timings come from a fast container CPU. On phones, long tasks will be several times longer (unverified multiplier).
- Lab CLS is not field CLS (p75).
- The CVD simulation is approximate.
- The "ΔE00 < ~10 is hard to tell apart for small marks" threshold is a heuristic I use here, not a standard.

---

## 2. Research findings (best practice 2024–2026)

### 2.1 WCAG 2.2 AA items relevant here

| SC (level)                               | Requirement (paraphrased from W3C)                                                                                                                                                  | Relevance to this site                                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.4.11 Focus Not Obscured (Minimum) (AA) | A focused component must not be _entirely_ hidden by author content. Sticky footers and headers are the typical failure (F110). C43 `scroll-padding` is a passing technique.        | The sticky `.run-bar` inside the config panel                                                                                                       |
| 2.4.13 Focus Appearance (AAA)            | Indicator area ≥ a 2 CSS px perimeter, and ≥ 3:1 change between focused and unfocused states.                                                                                       | The current 2 px outline with 2 px offset is close to this. Keep it.                                                                                |
| 2.5.7 Dragging Movements (AA)            | Any drag operation needs a single-pointer alternative. A native range slider whose track can be clicked satisfies this, and so does a text input beside the slider.                 | Replay scrubber passes (native range). Any future draggable triangle editor must keep the numeric inputs.                                           |
| 2.5.8 Target Size (Minimum) (AA)         | 24×24 CSS px, or one of five exceptions: spacing (24 px circle), equivalent control, inline-in-sentence, user-agent default not modified, essential. A slider counts as one target. | 18×18 checkbox (author-resized, so the UA exception does not apply; the spacing exception probably applies), footer inline links (inline exception) |
| 3.2.6 Consistent Help (A)                | Help mechanisms repeated across pages must appear in the same relative order.                                                                                                       | Applies once guide, model and parameter pages exist                                                                                                 |
| 3.3.7 Redundant Entry (A)                | Do not make users re-enter information within a process.                                                                                                                            | Already satisfied: config lives in the URL hash                                                                                                     |
| 1.4.11 Non-text Contrast (AA)            | UI component indicators, such as an input's only border, and graphical objects needed for understanding need 3:1.                                                                   | Input borders and replay/chart marks                                                                                                                |
| 1.4.1 Use of Color (A)                   | Colour must not be the only way to convey information.                                                                                                                              | Replay tiger states, T-Rex HP                                                                                                                       |
| 2.2.2 Pause, Stop, Hide (A)              | Auto-starting motion that lasts more than 5 s alongside other content needs a pause control.                                                                                        | Replay has Pause, so it passes. A future "shuffle battles" auto-cycle must have a pause too.                                                        |
| 4.1.3 Status Messages (AA)               | Progress and result messages must be programmatically announced.                                                                                                                    | `role=status` and `aria-live` are already used. Good.                                                                                               |

4.1.1 Parsing was removed in WCAG 2.2. Sources: W3C "What's New in WCAG 2.2", the Understanding docs for 2.4.11, 2.5.7, 2.5.8 and 1.4.11, and technique C39.

**Platform target guidance (beyond WCAG).** Apple HIG lists a default control size of 44×44 pt on iOS and iPadOS (minimum 28×28 pt). Android/Material recommends at least 48×48 dp with 8 dp spacing. Recommendation: 44 px on `(pointer: coarse)`.

### 2.2 Form UX for numeric parameter editors

- **Number inputs.** GOV.UK moved away from `type="number"` except for genuinely "incrementable" numbers. Their reasons:
  - Dragon cannot dictate into it.
  - NVDA reports it as unlabeled.
  - Browsers round or convert large values to exponential notation on arrow keys.
  - The scroll wheel changes the value by accident.

  They recommend `type="text"` with `inputmode="numeric"` (whole numbers) or `inputmode="decimal"`. Here, head counts and runs are incrementable, so `type=number` is acceptable. **The seed (0–4,294,967,295) is an identifier and should be text plus `inputmode=numeric`.**

- **Sliders.** NN/g: sliders only work when an approximate value is good enough, and are hard to set precisely on touch (steering law). Pair any slider with a text input. The 66 min/mode/max fields should stay as inputs. A visual mini-distribution can be added beside them, display-only.
- **Progressive disclosure.** NN/g: show a few important options first and defer specialised ones to a secondary area. The existing "Advanced" `<details>` is the right pattern. It needs grouping, a "changed only" filter, and better placement on desktop (see P1-4).
- **Validation.** Errors must be identified in text (WCAG 3.3.1/3.3.3). Silent clamping hides the system's correction. Show what happened and the allowed range.

### 2.3 Presenting Monte Carlo and probabilistic results to lay users

- **Frequencies over percentages.** Natural frequency formats ("x out of n") improve reasoning without instruction (Gigerenzer & Hoffrage 1995). Icon arrays help people with low numeracy understand risks (Galesic, Garcia-Retamero & Gigerenzer 2009).
- **Confidence intervals are widely misread, even by researchers** (Belia et al. 2005; Hoekstra et al. 2014). Here the 95% interval measures **Monte Carlo sampling precision of a model estimate**, not real-world certainty, so the risk of over-reading is high.
- **Error bars on bars bias judgement.** Correll & Gleicher 2014 ("Error Bars Considered Harmful") show that the mean-and-error encoding changes decisions, and propose alternatives such as gradients and violins. Since the three outcomes are mutually exclusive and sum to 100%, one 100% stacked bar or an icon array is a more natural primary encoding than three bars with whiskers.
- **Show outcomes as discrete draws.** Hypothetical Outcome Plots, which animate individual draws, beat error bars and violin plots on several judgements (Hullman, Resnick & Adar 2015). Quantile dotplots help lay decisions (Kay et al. 2016; Fernandes et al. 2018). The "random battle" replay is already a single HOP draw, and a "shuffle outcomes" mode would lean into this.
- **Words plus numbers.** Pairing verbal likelihood terms with numeric ranges improves interpretation (Budescu, Broomell & Por 2009, on IPCC language). The IPCC AR5 scale: virtually certain 99–100%, very likely 90–100%, likely 66–100%, about as likely as not 33–66%, unlikely 0–33%, very unlikely 0–10%, exceptionally unlikely 0–1%.
- **Spiegelhalter, Pearson & Short (2011)**, "Visualizing uncertainty about the future": tailor the display to the audience. Do not let visual precision imply certainty.

### 2.4 Data-visualisation accessibility

- **Text alternatives.** W3C WAI's complex-images tutorial says charts need a short description plus a long description, such as a data table, available to everyone. Chartability (Elavsky, Bennett & Moritz 2022) reports low contrast as the most common critical failure (88% of audits). It stresses keyboard probing, screen-reader testing, data tables, and "colour alone" checks.
- **Colour-blind-safe palettes.** Okabe & Ito's palette (verified hex values from R `grDevices`):
  - black #000000
  - orange #E69F00
  - sky blue #56B4E9
  - bluish green #009E73
  - yellow #F0E442
  - blue #0072B2
  - vermillion #D55E00
  - reddish purple #CC79A7
  - grey #999999

  Paul Tol's "bright" scheme: #4477AA, #EE6677, #228833, #CCBB44, #66CCEE, #AA3377, #BBBBBB. Okabe & Ito note that red/green confusion is symmetric, and that low-saturation colours (grey, pale green) are especially hard to separate. This is exactly the latched-vs-routed problem found in the audit.

- **Tooltips.** NN/g: hover tooltips are not normally available on touchscreens and must not hold essential information. Use tap/click "toggletips" or always-visible values.

### 2.5 Onboarding and tutorials

- NN/g, "Onboarding Tutorials vs. Contextual Help":
  - Tutorials interrupt users and are often skipped and forgotten.
  - Prefer **pull revelations**: contextual help triggered when it is relevant.
  - Make help easy to dismiss _and recall_.
  - Use progressive disclosure, don't rely on memorisation, and skip the obvious.
  - Their positive example is an interactive tutorial that is _not auto-launched_ and makes users _perform_ the task (ArcGIS).
- NN/g, "Mobile-App Onboarding": skip onboarding when possible, because deck-of-cards tutorials did not improve task performance.
- PhET's **implicit scaffolding** (Podolefsky, Moore & Perkins 2013): guide exploration through affordances, constraints, cueing and feedback rather than explicit instructions. This fits a sandbox simulator well.
- **Accessible implementation.** WAI-ARIA APG dialog pattern: focus moves in, Esc closes, background is inert, focus returns. `<dialog>` is Baseline widely available (since March 2022). The Popover API is Baseline 2025 ("newly available since January 2025"). CSS anchor positioning support was not verified, so plan a JS positioning fallback.

### 2.6 Mobile-first, dark mode, typography

- **Dark mode.** web.dev recommends honouring `prefers-color-scheme` and offering a manual override (the `<dark-mode-toggle>` pattern), and avoiding pure white. `light-dark()` is Baseline 2024 (since May 2024).
- **Korean line breaking.** MDN: `word-break: keep-all` means "word breaks should not be used for CJK text". The screenshots show Hangul words split mid-word, for example "이 / 탈합니다" and "T- / Rex에". `text-wrap` (`balance`, `pretty`) is Baseline widely available (since March 2024). Support for the `pretty` value specifically was not verified per browser; treat it as progressive enhancement.
- **Web-font swap.** web.dev, "CSS size-adjust": fallback-font metric overrides prevent layout shift when a web font loads. Relevant now that Pretendard is self-hosted. The measured swap CLS is small (0.0008).

### 2.7 Perceived performance

- NN/g response-time limits: 0.1 s feels instant, 1 s keeps flow, 10 s holds attention. Use a percent-done indicator for operations over about 10 s. Looped spinners suit only 2–10 s waits.
- NN/g: skeleton screens reduce perceived load time for full-page loads under 10 s. For longer operations, progress bars are better.
- web.dev:
  - CLS good ≤ 0.1, poor > 0.25. Shifts within 500 ms of input are excluded.
  - INP good ≤ 200 ms, poor > 500 ms.
  - A long task is any task over 50 ms. Yield with `scheduler.yield()`, which needs a fallback because browser support is not universal.

### 2.8 Layouts that can host ads later without CLS or policy problems

- **Reserve space.** web.dev "Optimize CLS": ads are among the largest CLS contributors. Reserve space with `min-height` or `aspect-ratio`, vary by breakpoint, and keep the container from collapsing. Google Publisher Tag, "Minimize layout shift": the only guaranteed fix is to reserve enough space. The options are the largest configured size (most effective), the smallest, or the most likely. Fluid slots shift inherently and belong below the fold.
- **AdSense placement policy:**
  - Do not encourage accidental clicks.
  - Be careful placing ads near navigation, play buttons, download buttons, "game windows", video players and drop-downs.
  - Do not place ads under misleading headings. Labels are limited to "Advertisements" or "Sponsored Links".

  Whether a Korean label such as "광고" is accepted as an equivalent is **unverified**.

- **Google Publisher Policies.** No Google-served ads on screens without publisher content, with low-value content, or "used for alerts, navigation or other behavioral purposes". No ads on "dead end" screens. Content should be the focal point. This favours real guide and model pages, and means no ads inside the tutorial, update banner or reset dialog.
- **Auto ads** include anchor ads (sticky top or bottom, mainly mobile), vignettes (full-screen between page loads) and side rails. Pages can be excluded.
- **Better Ads Standards** for mobile web flag pop-ups, prestitials, ad density above 30%, flashing animated ads, postitials with countdown, full-screen scrollovers and large sticky ads.
- **Consent.** EEA and UK (since 16 Jan 2024) and Switzerland (since 31 Jul 2024) require a Google-certified, TCF-integrated CMP when serving personalised ads. Its banner must not obscure focus (2.4.11 Understanding names cookie banners) and must not shift layout.

---

## 3. Audit findings (measured)

### 3.1 Results summary

| #   | Finding                                                                                                                                                                                                                                                                                                               | Evidence                                                                 | Criterion                     | Severity       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------- | -------------- |
| A1  | Primary button text contrast: white on `#2a78d6` = **4.42:1** (light). Dark `#3987e5` = **3.64:1**, dark hover `#5598e7` = **2.99:1**. Applies to `.btn-large` (16 px, 600 weight, not "large text") and `.btn-primary.btn-small`.                                                                                    | axe `color-contrast` (light and dark); `palette.py`                      | 1.4.3                         | High           |
| A2  | Footer links `#2a78d6` on `--bg #f7f6f3` = **4.09:1**                                                                                                                                                                                                                                                                 | axe; `palette.py`                                                        | 1.4.3                         | Medium         |
| A3  | Input and select border `#d9d8d2` on white = **1.43:1** (dark `#3b3b38`/`#1d1d1c` = 1.5:1). The border is the only thing that marks the white input on a white panel.                                                                                                                                                 | `palette.py`; Understanding 1.4.11 fig. 31–32                            | 1.4.11                        | High           |
| A4  | **Keyboard focus is lost.** Enter on "시뮬레이션 실행" → `document.activeElement` = `BODY` during the run and after results. Cancel becomes enabled but is not focused. Results are not focused or announced beyond the polite verdict region.                                                                        | `kbd.mjs`                                                                | 2.4.3 (risk), usability       | High           |
| A5  | **Sticky run bar hides focused fields.** At 390×700 with Advanced open, **24 of 80 tab stops** were at least partly under the opaque `.run-bar`, most of them lying wholly within the bar's vertical band. On desktop the morale checkbox (tab 17) was out of view inside the nested scroller.                        | `misc.mjs`                                                               | 2.4.11 (F110)                 | High           |
| A6  | Replay tiger states use colour only (approach, latched and routed are all filled circles; latched is only 1.15× larger). T-Rex HP is shown by hue only (blue→red).                                                                                                                                                    | `replay.ts` lines 403–468                                                | 1.4.1                         | High           |
| A7  | Replay mark contrast against the arena (`#f5f5f3`), light mode: tiger `#eb6834` = **2.93:1**, latched `#1baf7a` = **2.58:1**, draw/routed = 3.09:1. CVD (ΔE00 after simulation): latched vs routed **8.3 deutan** (6.8 dark); low-HP T-Rex vs tiger **6.8 deutan / 5.5 tritan**; low-HP vs latched 7.7 protan (dark). | `palette.py`                                                             | 1.4.11, 1.4.1                 | Medium         |
| A8  | **Charts have no long description or data table.** `role=img` plus a one-line `aria-label` only. The tornado label lists 5 of 10 values. Histogram bins are reachable by mouse hover only.                                                                                                                            | `audit-out.json` `canvasA11y`                                            | 1.1.1 (complex image)         | Medium-High    |
| A9  | **Chart tooltips never show on touch.** After a tap the tooltip is hidden, because `pointerleave` fires right after the touch ends.                                                                                                                                                                                   | `misc.mjs` `tooltipAfterTap.hidden = true`                               | Usability                     | Medium         |
| A10 | **CLS 0.101–0.104** whenever the footer or anything below the results panel is in view when results render. The results panel grows from an empty state to about 1,800 px. Future ads below the results would be pushed down the same way.                                                                            | `cls3.mjs` (shift source `app-footer`, value 0.1013); first audit 0.1038 | CWV (CLS > 0.1)               | High (for ads) |
| A11 | **Long tasks 100–303 ms** when results render. Desktop default run: 170/163/303/108/75 ms (v0.1.0) and 101/199/112 ms (6c84e0e). The 5,000-run scenario hit 196 ms. On mid-range phones these are likely several times longer (unverified).                                                                           | `audit-out.json`, `cls2.mjs`                                             | INP risk (> 200 ms)           | Medium         |
| A12 | **Reduced motion ignored by the replay**: autoplays (`aria-pressed=true` 2.5 s after results) with `prefers-reduced-motion: reduce`. Only `scrollIntoView` and the progress transition honour it.                                                                                                                     | `audit.mjs` `reducedMotionReplay`                                        | 2.3.3 (AAA) / C39, comfort    | Medium         |
| A13 | **Silent input correction.** Typing 99999 tigers becomes 5000 on blur with no message and no `aria-invalid`. Clearing a field silently restores the old value. Triangular `orderRange` silently moves mode/max when min is raised.                                                                                    | `misc.mjs`                                                               | 3.3.1 / 3.3.3 (best practice) | Medium         |
| A14 | **Headline framing.** "T-Rex 승리 확률 100.0% (95% CI 96.3%–100.0%)" with n = 100. It shows 1-decimal false precision, uses jargon ("95% CI", "교환비 ∞", "스피어만 상관"), and the caveat appears only in the footer.                                                                                                | Screenshot 02 and 08; `i18n.ts` `verdict.*`                              | Comprehension                 | High           |
| A15 | Outcome chart draws three separate bars with CI whiskers for mutually exclusive shares (within-the-bar bias). Histograms have no y-axis title, although the `chart.runs` key exists unused.                                                                                                                           | `charts.ts` `paintOutcome`/`paintHistogram`                              | Comprehension                 | Low-Medium     |
| A16 | **Hangul words broken mid-word** in hints at desktop and mobile widths, e.g. "이 / 탈합니다", "능력치 / 에", "T- / Rex에".                                                                                                                                                                                            | Screenshot 01                                                            | Readability                   | Low-Medium     |
| A17 | **Desktop config panel is a nested scroll container** (`scrollHeight` 1042 vs `clientHeight` 874 at 1366×900). Morale and Advanced sit below the run bar and are easy to miss. Opening Advanced adds 22 parameter cards inside the inner scroller.                                                                    | `audit-out.json` `configPanelScroll`; screenshot 01                      | Discoverability               | Medium         |
| A18 | **Mobile length**: 3,710 px at 390 px wide (4,502 px at 320 px) after results. Replay is last. Config stays fully expanded above the results.                                                                                                                                                                         | `audit-out.json`                                                         | Mobile efficiency             | Low-Medium     |
| A19 | Small but WCAG-passing targets. 110 of 112 targets are under 44 px in at least one dimension: chips 32 px, param inputs 32 px, icon reset 30 px, checkbox 18 px (spacing exception), slider 16 px tall (one target).                                                                                                  | `audit-out.json` `targets_*`                                             | Platform guidance (44/48)     | Low            |
| A20 | Results empty state is a near-empty card (desktop LCP element = `.results-empty`). It wastes the right column, gives no quick start, and as an ad page would be "low publisher content".                                                                                                                              | Screenshot 01                                                            | Onboarding / AdSense          | Medium         |
| A21 | Presets have no selected state (`aria-pressed` absent). It is unclear which preset is active after editing.                                                                                                                                                                                                           | `form.ts` `buildPresets`                                                 | Feedback                      | Low            |
| A22 | Dark mode follows the OS only. There is no manual switch, and charts redraw only on the media-query change.                                                                                                                                                                                                           | `charts.ts` `watchColorScheme`, `replay.ts`                              | Preference                    | Low-Medium     |

### 3.2 What already works well (keep)

- axe found no violations other than colour contrast. Landmarks (`header`, `main`, `footer`), one h1, logical h2/h3, correct `html lang` that updates on switch, and the language button carries `lang` for its target language.
- Focus indicator: 2 px solid with 2 px offset on every stop tested (it should be close to SC 2.4.13 AAA). Tab order follows the visual order.
- Progress: a percent-done bar, run count, ETA (matches NN/g for waits over 10 s), screen-reader updates throttled per decile, Cancel available, and cost warnings before heavy runs.
- Stale-results banner, URL-hash sharing (satisfies redundant entry), `role=status` toast, `tabular-nums`, no horizontal overflow at 320 px, `touch-action: pan-y` on charts, charts that read theme tokens, and smooth scroll that honours reduced motion.
- Web-font swap CLS is negligible (0.0008 desktop, 0 mobile). LCP in the lab is about 200–245 ms.

---

## 4. Prioritised recommendations

Each recommendation lists: why, sources, files, and acceptance criteria (AC). Effort: S (≤ ½ day), M (1–2 days), L (≥ 3 days).

### P0 — fix before adding pages, tutorial or ads

#### P0-1 Contrast tokens: buttons, links, input borders (S)

- **Why:** A1, A2, A3 are the only axe violations, and they appear on the most important control.
- **What:**
  - Light: `--accent-strong` (button background) ≈ `#1f6fd1` (white text 4.94:1). Link colour should be ≥ 4.5:1 on `--bg` as well as `--surface`.
  - Dark: button background ≈ `#2b6fd1` (4.89:1) with white text. Hover must _darken_, not lighten, so white text keeps ≥ 4.5:1. Keep the lighter `#6da7ec`-type blue for links and focus only.
  - Form controls get `--control-border` ≥ 3:1 (e.g. `#8a8984` = 3.50:1 on white; `#6f6e69` = 3.30:1 on `#1d1d1c`). Decorative card borders can stay subtle.
- **Sources:** WCAG 1.4.3 and 1.4.11 (Understanding fig. 31–32 show input borders must be 3:1); Chartability (contrast is the most common failure).
- **Files:** `src/ui/styles.css` (`:root` and dark tokens, `.btn-primary`, `input`, `select`, `a`).
- **AC:**
  - axe with `wcag22aa` tags reports 0 `color-contrast` violations in light and dark, for the initial, results and hover states.
  - Every input and select border is ≥ 3:1 against its adjacent colour in both themes (scripted check).

#### P0-2 Focus management for run lifecycle and sticky bar (S–M)

- **Why:** A4 and A5. Keyboard and screen-reader users lose their place when Run disables itself, and focused fields hide under the sticky run bar.
- **What:**
  - On run start, move focus to Cancel. Alternatively, keep Run focusable with `aria-disabled="true"` and a "실행 중…" label.
  - On completion, focus the results heading (`#results-title`, `tabindex="-1"`) and announce the verdict. That replaces the mobile-only `scrollIntoView`; `focus()` scrolls anyway, and respects reduced motion with `{preventScroll}` plus a manual scroll.
  - On cancel or error, return focus to Run.
  - Add `scroll-padding-bottom: var(--runbar-h)` to `html` (mobile, single column) and `.config-panel` (desktop scroller). Keep `--runbar-h` in sync with a `ResizeObserver` or a fixed value.
  - Optionally, Esc cancels a running simulation while focus is in the config panel.
- **Sources:** WCAG 2.4.11 Understanding (sticky footers; C43 `scroll-padding`; F110); 2.4.3 Focus Order; APG focus management.
- **Files:** `src/ui/app.ts` (`run()`, `runBtn`, `cancelBtn`, results heading), `src/ui/styles.css` (`html`, `.config-panel`, `.run-bar`).
- **AC:** Playwright keyboard test.
  - After Enter on Run, `activeElement` is Cancel. After completion it is `#results-title`. It is never `BODY`.
  - Tabbing through every config control (Advanced open) at 390×700 and 1366×900: each focused element's rect does not intersect `.run-bar`'s rect.

#### P0-3 Headline framing: frequencies, honest precision, inline caveat (S–M)

- **Why:** A14. This is the highest-impact comprehension issue. Lay users, and even researchers, misread CIs. "100.0%" from 100 runs reads as certainty about a real fight. The caveat only in the footer risks being read as misleading content, which also matters for AdSense trust.
- **What (ko and en copy examples):**
  - **Headline (frequency first):** "이 모델로 500번 싸움을 돌려 보니 **T-Rex 쪽이 498번 이겼습니다** (99.6%)." / "In 500 simulated battles under this model, **the T-Rex side won 498** (99.6%)."
  - **Verbal plus numeric** (Budescu 2009; IPCC scale): add a calibrated word such as "거의 확실 (virtually certain, ≥ 99%)". Always show the number too.
  - **Precision line in plain words:** "시뮬레이션 정밀도: 실행 횟수를 늘려 다시 돌려도 대개 98.6–99.9% 사이 (95% 구간)". Add a "?" toggletip: "This range only reflects how many runs we simulated. It says nothing about whether the model's assumptions are right."
  - **No false precision:**
    - Digits: 0 decimals for n < 1,000, 1 decimal otherwise.
    - If k = n or k = 0, show "500/500 (> 99%)" or "0/500 (< 1%)", never "100.0%" or "0.0%".
    - Use the Wilson bound already computed.
  - **Inline caveat chip** next to the verdict, not only in the footer: "교육용 장난감 모델 · 실제 싸움 예측 아님 → 모델 설명". It links to the model page.
  - **Jargon:**
    - "교환비 ∞" → "T-Rex 손실 없음".
    - "민감도 (스피어만 상관)" → "무엇이 승패를 좌우했나", with ρ moved into the tooltip or the data table.
- **Sources:** Gigerenzer & Hoffrage 1995; Galesic et al. 2009; Belia et al. 2005; Hoekstra et al. 2014; Budescu et al. 2009; IPCC AR5 guidance; Spiegelhalter et al. 2011; MODEL.md ("treat the win probabilities as statements about the model").
- **Files:** `src/ui/app.ts` (`renderResults`, `card`), `src/ui/i18n.ts` (`verdict.*`, `stat.*`, `chart.sensitivity*`), `src/ui/format.ts` (precision helper).
- **AC:**
  - The verdict contains "k/n" counts in both languages.
  - "100.0%" or "0.0%" never renders for an empty or full outcome.
  - The caveat is visible inside `.verdict-box` at 320–1366 px.
  - A 5-person hallway test: at least 4 of 5 correctly say what the interval means (optional but recommended).

#### P0-4 Layout stability: results skeleton and reserved ad slots (M)

- **Why:** A10 (CLS 0.10 today), plus the future ad slots. Ads are among the largest CLS sources. Content that grows after a 4-second delay is not excluded by the 500 ms input window.
- **What:**
  - When a run starts, render the results layout as a **skeleton with final block sizes**: verdict box, cards grid, fixed-height chart boxes (heights are already fixed in CSS), and the replay square (`aspect-ratio: 1`). Content below therefore never moves.
  - Keep that space after cancel (show a "cancelled" state inside it).
  - Define ad containers now, empty and hidden behind a flag, each with:
    - `min-height` per breakpoint, set to the most likely served size per the GPT guidance (for example 250–280 px on mobile, 90–250 px on desktop, to be tuned with real fill data),
    - `contain: layout`,
    - a visible "Advertisements" label (policy-approved wording),
    - no collapse when unfilled. Show a neutral placeholder instead.
- **Sources:** web.dev CLS and Optimize CLS; GPT "Minimize layout shift"; NN/g skeleton screens.
- **Files:** `src/ui/app.ts` (`run`, `renderResults`, panel structure), `src/ui/styles.css`.
- **AC:**
  - A Playwright layout-shift budget runs in CI with the footer in view (`cls3.mjs` scenario): cumulative CLS ≤ 0.05 for run → results → replay load, at 1366×900 and 390×800.
  - Once ads exist, field CLS p75 ≤ 0.1 (CrUX or RUM).

#### P0-5 Chart text alternatives and touch-friendly values (M)

- **Why:** A8 and A9. The histograms and tornado chart carry data that is not available to screen-reader, keyboard or touch users.
- **What:**
  - Under each chart, add a `<details>` "데이터 표 보기 / Show data table" with a real `<table>`:
    - outcome: k, n, %, interval
    - histograms: bin range, runs, %
    - tornado: all 10 parameters, ρ, direction
  - Link the canvas to it with `aria-describedby`, or reference it in the `aria-label`.
  - Tooltips:
    - Show on `pointerdown` / `click` for touch and keep them until the next tap outside, or Esc.
    - Stop hiding on `pointerleave` for `pointerType === 'touch'`.
    - Always print the key values (median, mean) as text under the chart, so tooltips never hold essential information.
- **Sources:** W3C WAI complex images tutorial; Chartability (keyboard probing, data tables); NN/g tooltip guidelines.
- **Files:** `src/ui/charts.ts` (`CanvasChart` gets a `table()` slot and touch handling), `src/ui/app.ts`, `src/ui/i18n.ts`.
- **AC:**
  - Every chart has an adjacent table holding 100% of the plotted values, reachable by keyboard.
  - On a touch-emulated tap, `.chart-tip` stays visible ≥ 2 s and hides when tapping elsewhere.
  - axe still reports 0 violations.

### P1 — next iteration

#### P1-1 Replay readability: abstract glyph language, no characters (M–L)

- **Why:** A6, A7, A12, and the owner's goal of higher animation quality _without_ realistic animal characters.
- **What (all geometric; no silhouettes or sprites):**
  - **State by shape plus colour.** Each tiger state must be identifiable in grayscale:
    - approach: filled circle with a short velocity tick or fading trail (direction)
    - latched: diamond, plus a 1 px **tether line** to the host T-Rex
    - recover: hollow ring
    - routed: hollow ring with a dashed outline, fading as it leaves
    - dead: × that fades to 40% over 1 s instead of popping in
  - **T-Rex:** keep the oriented triangle. Add an **HP arc ring** around it (length = HP) so HP is not shown by hue alone. Show a brief **bite cone flash** (a wedge using the bite arc and reach) on each bite attempt, filled on a hit and outlined on a miss.
  - **Event cues:** a short expanding ring at kill and latch events (≤ 300 ms, disabled under reduced motion).
  - **Palette:** encode _side_ by colour (side A blue family, side B orange/vermillion family) and _state_ by shape. The candidate tokens below were validated with `palette2.py`. Every mark is ≥ 3:1 against the arena in both themes, and trex vs tiger ΔE00 ≥ 49 under all CVD simulations.

    | token            | light                       | dark      |
    | ---------------- | --------------------------- | --------- |
    | side A (T-Rex)   | `#0072B2` (5.19:1 vs white) | `#56B4E9` |
    | side B (tiger)   | `#D55E00` (3.87:1)          | `#E69F00` |
    | latched accent   | `#009E73` (3.42:1)          | `#2CC59A` |
    | routed / neutral | `#767676` (4.54:1)          | `#9a9993` |

    Latched vs routed is still close for deuteranopes (ΔE00 9.9 light / 5.7 dark). That is exactly why shape must carry state.

  - **Reduced motion:** when `prefers-reduced-motion: reduce`, do not autoplay. Show the final frame with a "재생" button. Snap the camera (no easing). Disable trails and pulses.
  - **Live DOM counters** beside the canvas (not drawn in it): "T-Rex 9/10 생존 · 호랑이 접근 52 · 매달림 3 · 도주 31 · 사망 14". These are accessible and readable, with `aria-live="off"` and a "describe current frame" button that announces once.
- **Sources:** WCAG 1.4.1 and 1.4.11, C39 (`prefers-reduced-motion`), 2.2.2; Okabe & Ito; Paul Tol; Chartability.
- **Files:** `src/ui/replay.ts` (`draw`, legend), `src/ui/charts.ts` (`readTheme` tokens), `src/ui/styles.css` (tokens, `.legend`, `.sw-*`), `src/ui/i18n.ts`. The engine trace may need bite and kill event arrays; coordinate with the engine/animation track.
- **AC:**
  - In a grayscale screenshot, a reviewer can name every tiger state from the legend.
  - All marks are ≥ 3:1 against the arena (scripted).
  - Under emulated reduced motion, `aria-pressed="false"` 3 s after results and no RAF loop runs.
  - No glyph uses an animal silhouette.

#### P1-2 Replay controls: timeline, stepping, shortcuts (M)

- **What:**
  - Event ticks on the scrubber (kills in side-B colour, T-Rex deaths in side-A colour). Clicking a tick jumps to it, which is a single-pointer alternative to dragging.
  - ±1 s step buttons, 44 px on coarse pointers.
  - Space (play/pause) and ←/→ (seek) when focus is inside `.replay`.
  - An enlarged slider hit area (≥ 24 px tall; 44 px on coarse pointers).
  - Optional "결과 섞어 보기 (shuffle outcomes)": auto-cycles the end states of random runs (a HOP), with a visible pause.
- **Sources:** WCAG 2.5.7, 2.5.8, 2.2.2; Hullman et al. 2015.
- **Files:** `src/ui/replay.ts`, `src/ui/app.ts`, `src/ui/styles.css`.
- **AC:**
  - Every replay function works with keyboard only and with single taps only.
  - Slider target height ≥ 24 px (44 px with `pointer: coarse`).

#### P1-3 Form feedback and touch sizing (S–M)

- **What:**
  - Inline validation: on an out-of-range or empty value, set `aria-invalid="true"` and show an error `<small>` linked via `aria-describedby`, e.g. "1–5,000 사이로 입력하세요 (5,000으로 맞췄습니다)". Clear it on a valid value.
  - Add allowed ranges to every hint.
  - Announce triangular auto-ordering, e.g. "최빈값이 최소값에 맞춰 40으로 조정됨".
  - Seed: `type="text" inputmode="numeric" pattern="[0-9]*" spellcheck="false"`.
  - Presets: `aria-pressed` on the chip matching the current counts and runs.
  - `@media (pointer: coarse)`: chips, `.btn-small`, `.btn-icon`, `.param-input` and the checkbox row ≥ 44 px.
- **Sources:** GOV.UK text input and blog (number inputs); WCAG 3.3.1/3.3.3; Apple HIG 44 pt; Android 48 dp; WCAG 2.5.8.
- **Files:** `src/ui/form.ts` (`numberField`, `paramRow`, `buildPresets`), `src/ui/styles.css`, `src/ui/i18n.ts`.
- **AC:**
  - Typing 99999 in tiger count shows a visible error and `aria-invalid` until corrected or acknowledged.
  - At 390 px with coarse pointer emulation, every target is ≥ 44×44 px except inline text links.

#### P1-4 Advanced parameter editor structure (M)

- **What:**
  - Group the 22 parameters by purpose (몸집·속도 / 공격 / 지구력 / 사기), each with a short intro.
  - Add a "변경한 것만 보기" filter and a per-row mini triangle sparkline (display-only, min/mode/max on the bounds axis, default as a ghost).
  - Each row gets a "?" link to `/parameters/#<id>`.
  - Desktop: avoid the nested scroller hiding Morale and Advanced under the run bar. Either let the left column scroll with the page and keep only the run bar sticky, or open Advanced as a wide non-modal drawer.
- **Sources:** NN/g progressive disclosure; NN/g sliders (keep text inputs); WCAG 2.5.7 (no drag-only handles).
- **Files:** `src/ui/form.ts`, `src/ui/styles.css`, `src/sim/params.ts` (category metadata).
- **AC:**
  - At 1366×900 with Advanced closed, Morale and the Advanced summary are visible without inner scrolling.
  - The changed-only filter works.
  - Every parameter row deep-links to its reference entry.

#### P1-5 Help pages, glossary and opt-in tutorial (L) — owner request

- **Information architecture** (Vite multi-page; same header on every page):
  - `/` 시뮬레이터
  - `/guide/` 사용법: quick start, step-by-step, FAQ, how to read the results
  - `/model/` 모델 설명: rendered from MODEL.md, with diagrams
  - `/parameters/` 파라미터 사전: one card per parameter with `id` anchors, unit, default triangle, source, what it does, and its typical sensitivity direction
  - `/about/` 버전·변경 내역·개인정보·문의

  Header navigation stays in the **same relative order on every page**, with "도움말/가이드" always in the same slot (WCAG 3.2.6). Language and theme toggles are in the same place too.

- **Pull help on the simulator:**
  1. Empty-state "처음이세요? 3단계로 시작" card in the results panel: pick a matchup, run, read the result. This fixes A20 and adds real publisher content.
  2. "?" toggletips (disclosure buttons with `aria-expanded`, not hover-only) for Monte Carlo, 95% 구간, LHS, CV, 삼각분포, 민감도. Each links to `/guide/#glossary-*`.
  3. An opt-in "1분 투어" button in the header and the empty state. Never auto-launch.
- **Tutorial design** (interactive, learn-by-doing, after ArcGIS):
  - Six steps: preset → run (explain the progress bar) → headline and precision → what mattered most → watch a battle (legend) → change one parameter, see the stale banner, re-run and compare.
  - Each step waits for the user to _perform_ the action. Steps show "2/6", Back, Next, and "투어 종료".
  - Implementation: a non-modal popover anchored to the real control. Esc closes it. Focus moves into the step and returns afterwards (APG). It must not cover the focused control or the Run bar (2.4.11).
  - Respect reduced motion. Store progress and dismissal in `localStorage` with try/catch. Make it re-launchable from the header and `/guide/`.
  - Add guided "experiments" in `/guide/` (PhET implicit scaffolding): "사기 모델을 끄면?", "호랑이 수를 10배로?". Each opens the simulator with a prepared `#s=` hash.
- **AdSense interplay:** the guide, model and parameter pages are the natural ad-bearing content. **No ads inside the tour, toggletips, update banner or reset dialog** (no ads on "alerts, navigation or behavioral" screens).
- **Sources:** NN/g onboarding vs contextual help; NN/g mobile onboarding; Podolefsky et al. 2013; WAI-ARIA APG dialog; MDN `<dialog>` and Popover API Baseline status; WCAG 3.2.6, 2.4.11; Google Publisher Policies.
- **Files:** new `guide/index.html`, `model/index.html`, `parameters/index.html`, `about/index.html` with Vite MPA `build.rollupOptions.input`; new `src/ui/tour.ts`, `src/ui/help.ts`; `src/ui/app.ts` (header nav), `src/ui/i18n.ts`, `src/ui/styles.css`. The CSP stays unchanged if the pages use the same bundle approach.
- **AC:**
  - The tour completes with keyboard only and with touch only.
  - Esc exits at any step and focus returns to the trigger.
  - It never opens unless requested.
  - Header navigation order is identical on all pages (scripted DOM comparison).
  - Every glossary term on the simulator links to an anchor that exists.

#### P1-6 Results hierarchy and chart encodings (M)

- **What:**
  - Answer-first order:
    1. Verdict (P0-3)
    2. One **100% stacked bar or 10×10 icon array** for the T-Rex / tigers / draw split. Each cell is a share of runs; the precision band appears as a thin bracket or in text.
    3. "무엇이 승패를 좌우했나": the top 3 sensitivities as plain sentences, e.g. "호랑이의 초당 피해가 클수록 호랑이에게 유리했습니다 (가장 큰 영향)"
    4. Charts
    5. Replay
  - Split the stat cards into "누가 이겼나" (3) and "전투 양상" (5, collapsible on mobile).
  - Add the histogram y-axis title (the `chart.runs` key exists).
  - Mark the median on the duration histogram.
- **Sources:** Correll & Gleicher 2014; Galesic et al. 2009; Kay et al. 2016; Fernandes et al. 2018; NN/g progressive disclosure.
- **Files:** `src/ui/app.ts`, `src/ui/charts.ts`, `src/ui/i18n.ts`, `src/ui/styles.css`.
- **AC:**
  - The outcome display sums visibly to 100%.
  - The top-3 sentences render in ko and en.
  - The histogram y-axis is labelled "실행 수 / runs".

#### P1-7 Perceived performance and responsiveness (M)

- **What:**
  - **Live partial results** while running: update a running tally and the stacked bar about every 250 ms from the completed chunk summaries, with a note "추정치가 안정되는 중 (n=1,240)". This makes long waits informative.
  - Run button label "실행 중… 45%". The progress bar is already present.
  - Use the P0-4 skeleton for the results area.
  - Main thread:
    - Move `aggregate()` (Spearman, histograms) into a worker, or chunk it with `scheduler.yield()` plus a `setTimeout` fallback.
    - Render charts across frames.
    - Defer replay trace loading until the replay is near the viewport (`IntersectionObserver` is already used for playback).
- **Sources:** NN/g response-time limits and progress indicators; web.dev INP and long tasks.
- **Files:** `src/ui/app.ts`, `src/ui/pool.ts`, `src/workers/sim.worker.ts`, `src/sim/montecarlo.ts`. Coordinate with the performance track.
- **AC:**
  - No main-thread task over 50 ms during or after a default run in the lab.
  - First partial estimate is visible within 1 s of Run.
  - Lab INP for "Run" click ≤ 200 ms at 4× CPU throttle.

#### P1-8 Theme switch (S–M)

- **What:**
  - A three-state control (시스템 / 라이트 / 다크) in the header or settings, stored in `localStorage` (try/catch).
  - Implement as `:root[data-theme]` overrides of the same tokens.
  - Charts and replay must redraw on a manual switch: call `redrawAllCharts()` and reset the replay theme cache, not just the media-query listener.
  - Set the `theme-color` meta accordingly.
  - Avoid a flash of the wrong theme. Because CSP forbids inline scripts, load a tiny external `theme-init.js` as a blocking script in `<head>` before the CSS.
- **Sources:** web.dev `prefers-color-scheme` (manual override pattern; avoid pure white); MDN `light-dark()` Baseline 2024.
- **Files:** `index.html`, new `public/theme-init.js` or `src/theme.ts`, `src/ui/styles.css`, `src/ui/charts.ts`, `src/ui/replay.ts`.
- **AC:**
  - The choice persists across reloads with no wrong-theme flash (screenshot at DOMContentLoaded).
  - Charts repaint within one frame of switching.
  - P0-1 contrast holds in all three modes.

#### P1-9 Korean typography (S)

- **What:**
  - `:lang(ko) { word-break: keep-all; overflow-wrap: anywhere; }` for body text, hints and help.
  - `text-wrap: balance` on h1–h3 and the verdict.
  - `text-wrap: pretty` on paragraphs as progressive enhancement.
  - Optionally, fallback `@font-face` metric overrides (`size-adjust`, `ascent-override`) for Pretendard to remove the residual swap shift.
- **Sources:** MDN `word-break`; MDN `text-wrap` (Baseline); web.dev size-adjust.
- **Files:** `src/ui/styles.css`.
- **AC:** At 320, 390 and 1366 px, no Hangul word in hints or help is split across lines (visual diff of screenshot 01's hint area).

#### P1-10 Version display and update flow (S–M) — owner request, UX side only

- **What:**
  - Footer and `/about/` show "v0.1.0 · 2026-10-19 · 변경 내역", linking to the changelog. Use `tabular-nums` and inject at build time.
  - When a newer deployed version is detected (mechanism owned by the release/deploy track), show a **non-modal** `role="status"` banner: "새 버전 v0.2.0이 있습니다. [지금 새로고침]".
    - **Never auto-reload while a simulation is running.** Defer until idle, and keep the `#s=` scenario hash across the reload.
    - Do not block the Run button. Dismissible, and reappears on the next visit only.
  - "사이트 데이터 초기화 후 새로고침" lives in `/about/` or settings, not the main header. It asks for confirmation in a `<dialog>` that lists what is cleared (language, theme, tour progress, cached files) and what is kept (the scenario link). Focus follows APG.
- **Sources:** WCAG 4.1.3, 2.4.11; WAI-ARIA APG dialog; NN/g (non-interrupting help/notices).
- **Files:** `src/ui/app.ts` (footer, banner), new `src/ui/version.ts`, `about/index.html`, `src/ui/i18n.ts`, `src/ui/styles.css`.
- **AC:**
  - The version is visible in the footer on every page.
  - The banner appears without moving layout (it reserves space or overlays non-interactive area), with CLS 0.
  - A reload triggered mid-run is deferred until the run completes or is cancelled.

### P2 — later or opportunistic

- **P2-1 Mobile flow** (M): after the first run, collapse the scenario form into a summary chip ("T-Rex 10 vs 호랑이 100 · 500회 [수정]"), so results come first. Show a mini progress bar inside the sticky run bar. Consider ordering on mobile: verdict → replay → charts. AC: after a default run at 390 px, the verdict and replay are reachable within 2 screen heights. Files: `app.ts`, `form.ts`, `styles.css`.
- **P2-2 Ad-slot map and exclusion zones** (S to define, implement with the ads track):
  - Candidate slots:
    - (a) full-width slot between `<main>` and the footer
    - (b) after the replay section, at the end of results, ≥ 32 px from replay controls (spacing is a heuristic, unverified)
    - (c) in-article slots on guide, model and parameter pages
  - **Exclusion zones:** config panel, sticky run bar, presets, replay canvas and controls (treat as "game window / video player"), tour popovers, dialogs, banners.
  - **Disable Auto ads anchor and vignette formats on `/`**: a bottom anchor collides with the sticky run bar (2.4.11 and accidental clicks), and Better Ads flags large sticky ads.
  - The CMP banner must not cover Run or focused fields, and must not shift layout.
  - AC: an ad-overlay QA script shows no ad container within the exclusion zones at 320–1920 px. CLS budget as in P0-4.
- **P2-3 Multi-species readiness** (M; coordinates with species planning):
  - Colour encodes **side** (two hue families only); **species** is encoded by abstract glyph shape (triangle, circle, diamond, square, hexagon, chevron).
  - Legend and parameter groups are generated from a species schema. A matchup picker uses cards with an abstract glyph and 3 key stats.
  - This keeps the palette CVD-safe as species are added, and complies with the owner's "no realistic characters" rule.
  - AC: adding a species requires no new colour tokens. All glyphs are distinguishable in grayscale at 12 px.
- **P2-4 Compare mode** (M): "기준으로 고정" pins a result. After a change, show deltas, e.g. "T-Rex 승률 −12%p (n=500 vs 500)". Pairs with the stale banner.
- **P2-5 UX regression in CI** (S–M): a Playwright job running axe (WCAG 2.2 AA tags), the layout-shift budget, the keyboard focus test (P0-2), the target-size scan and the reduced-motion check. ROADMAP already lists a Playwright smoke test.
- **P2-6 Skip link** (S): "결과로 건너뛰기", visible on focus. There are 22+ tab stops before the results. Not required, since landmarks satisfy 2.4.1, but cheap.
- **P2-7 Remember last scenario** (S): optional "지난 설정 불러오기" from `localStorage`. The URL hash already covers sharing.

---

## 5. Open questions and unverified items

- Whether AdSense accepts a localised label ("광고") as equivalent to "Advertisements": **unverified**. The policy text found lists only "Advertisements" or "Sponsored Links".
- Exact safe distances between ads and interactive controls: the policy gives no pixel value. 32 px is my heuristic.
- Field performance on mid-range Android: lab long tasks (100–300 ms) were measured on a fast container. The phone multiplier is **unverified**. Measure with 4–6× CPU throttling or RUM.
- CSS anchor positioning and `text-wrap: pretty` cross-browser status: **not verified**. Use JS positioning and progressive enhancement.
- 2.5.8 status of the 18 px morale checkbox: it probably passes the spacing exception, since its label is the adjacent target area, but enlarging it is still recommended.
- CVD thresholds: the ΔE00 numbers come from Machado-2009 simulation at full severity. "< ~10 = confusable for small marks" is a working heuristic, not a standard.
- The tutorial's effect on comprehension and retention, and the headline's comprehension effect, should be validated with 5–8 users (ko-first audience). The research cited is mostly English-language and medical/forecast contexts.

---

## 6. Sources

WCAG / W3C

- What's New in WCAG 2.2 — https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- Understanding 2.5.8 Target Size (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Understanding 2.5.7 Dragging Movements — https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- Understanding 2.4.13 Focus Appearance — https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- Understanding 2.4.11 Focus Not Obscured (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- Understanding 3.2.6 Consistent Help — https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html
- Understanding 3.3.7 Redundant Entry — https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html
- Understanding 1.4.11 Non-text Contrast — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Understanding 2.2.2 Pause, Stop, Hide — https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- Understanding 2.3.3 Animation from Interactions — https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- Understanding 4.1.3 Status Messages — https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- Understanding 2.4.3 Focus Order — https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html
- Technique C39 prefers-reduced-motion — https://www.w3.org/WAI/WCAG22/Techniques/css/C39
- WAI Images Tutorial: Complex images — https://www.w3.org/WAI/tutorials/images/complex/
- WAI-ARIA APG Dialog (Modal) pattern — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

Platform guidance

- Apple HIG Accessibility (44×44 pt default, 28×28 pt minimum) — https://developer.apple.com/design/human-interface-guidelines/accessibility
- Android Accessibility Help: Touch target size (48×48 dp) — https://support.google.com/accessibility/android/answer/7101858

Forms / UX research

- GOV.UK Design System: Text input (numbers, inputmode) — https://design-system.service.gov.uk/components/text-input/
- GOV.UK blog: Why we changed the input type for numbers (2020) — https://technology.blog.gov.uk/2020/02/24/why-the-gov-uk-design-system-team-changed-the-input-type-for-numbers/
- NN/g Slider Design: Rules of Thumb — https://www.nngroup.com/articles/gui-slider-controls/
- NN/g Progressive Disclosure — https://www.nngroup.com/articles/progressive-disclosure/
- NN/g Onboarding Tutorials vs. Contextual Help — https://www.nngroup.com/articles/onboarding-tutorials/
- NN/g Mobile-App Onboarding — https://www.nngroup.com/articles/mobile-app-onboarding/
- NN/g Tooltip Guidelines — https://www.nngroup.com/articles/tooltip-guidelines/
- NN/g Progress Indicators — https://www.nngroup.com/articles/progress-indicators/
- NN/g Skeleton Screens — https://www.nngroup.com/articles/skeleton-screens/
- NN/g Response Times: The 3 Important Limits — https://www.nngroup.com/articles/response-times-3-important-limits/
- Podolefsky, Moore, Perkins (2013) Implicit scaffolding in interactive simulations — https://arxiv.org/abs/1306.6544

Uncertainty communication

- Gigerenzer & Hoffrage (1995) How to improve Bayesian reasoning without instruction: Frequency formats. Psychological Review — https://doi.org/10.1037/0033-295X.102.4.684
- Galesic, Garcia-Retamero, Gigerenzer (2009) Using icon arrays to communicate medical risks: overcoming low numeracy. Health Psychology — https://pubmed.ncbi.nlm.nih.gov/19290713/
- Belia, Fidler, Williams, Cumming (2005) Researchers misunderstand confidence intervals and standard error bars. Psychological Methods — https://pubmed.ncbi.nlm.nih.gov/16392994/
- Hoekstra, Morey, Rouder, Wagenmakers (2014) Robust misinterpretation of confidence intervals. Psychonomic Bulletin & Review — https://doi.org/10.3758/s13423-013-0572-3
- Correll & Gleicher (2014) Error Bars Considered Harmful — https://graphics.cs.wisc.edu/Papers/2014/CG14/
- Hullman, Resnick, Adar (2015) Hypothetical Outcome Plots Outperform Error Bars and Violin Plots… PLOS ONE — https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0142444
- Kay, Kola, Hullman, Munson (2016) When (ish) is My Bus? CHI — https://doi.org/10.1145/2858036.2858558
- Fernandes, Walls, Munson, Hullman, Kay (2018) Uncertainty Displays Using Quantile Dotplots or CDFs Improve Transit Decision-Making. CHI — https://doi.org/10.1145/3173574.3173718
- Budescu, Broomell, Por (2009) Improving communication of uncertainty in the reports of the IPCC. Psychological Science — https://pubmed.ncbi.nlm.nih.gov/19207697/
- IPCC AR5 Guidance Note on Consistent Treatment of Uncertainties (likelihood scale) — https://www.ipcc.ch/site/assets/uploads/2017/08/AR5_Uncertainty_Guidance_Note.pdf
- Spiegelhalter, Pearson, Short (2011) Visualizing uncertainty about the future. Science — https://pubmed.ncbi.nlm.nih.gov/21903802/

Data-viz accessibility and colour

- Chartability POUR-CAF workbook — https://chartability.github.io/POUR-CAF/
- Elavsky, Bennett, Moritz (2022) How accessible is my visualization? Evaluating visualization accessibility with Chartability. CGF — https://doi.org/10.1111/cgf.14522
- Okabe & Ito, Color Universal Design — https://jfly.uni-koeln.de/color/
- R grDevices palette.colors ("Okabe-Ito" hex values) — https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/palette.html (values read from R source `colorstuff.R`)
- Paul Tol, Colour schemes — https://sronpersonalpages.nl/~pault/

Web platform / performance

- web.dev Cumulative Layout Shift — https://web.dev/articles/cls
- web.dev Optimize CLS — https://web.dev/articles/optimize-cls
- web.dev Interaction to Next Paint — https://web.dev/articles/inp
- web.dev Optimize long tasks (scheduler.yield) — https://web.dev/articles/optimize-long-tasks
- web.dev prefers-color-scheme — https://web.dev/articles/prefers-color-scheme
- web.dev CSS size-adjust for @font-face — https://web.dev/articles/css-size-adjust
- MDN light-dark() (Baseline 2024) — https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark
- MDN Popover API (Baseline 2025) — https://developer.mozilla.org/en-US/docs/Web/API/Popover_API
- MDN `<dialog>` (Baseline widely available) — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
- MDN word-break (keep-all for CJK) — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/word-break
- MDN text-wrap (Baseline) — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap

Ads

- Google Publisher Tag: Minimize layout shift — https://developers.google.com/publisher-tag/guides/minimize-layout-shift
- AdSense Ad placement policies — https://support.google.com/adsense/answer/1346295
- Google Publisher Policies: Google-served ads on screens without publisher-content — https://support.google.com/publisherpolicies/answer/11112688
- AdSense: About Auto ads (anchor, vignette, side rails, exclusions) — https://support.google.com/adsense/answer/9261805
- AdSense: Consent management requirements for EEA, UK, Switzerland — https://support.google.com/adsense/answer/13554116
- Coalition for Better Ads: Better Ads Standards — https://www.betterads.org/standards/

---

## Appendix A — reproduction

```
SP=/tmp/claude-0/-home-user-trex-vs-tiger-sim/984a8a44-eb4d-53ff-a9c5-7e1dac2ca18c/scratchpad
cd $SP/ux-copy && npx vite build && npx vite preview --port 4317 --strictPort &
cd $SP/uxscripts
node audit.mjs $SP     # axe (light/dark), target sizes, tab order, CLS/long tasks, mobile, reduced motion -> audit-out.json
node kbd.mjs           # focus after keyboard Run, tab sequence, live regions, landmarks, text-spacing
node misc.mjs          # focus obscured by sticky run bar, touch tooltip, silent clamping, seed input type
node cls2.mjs          # load CLS/LCP with Pretendard, post-run CLS (footer below fold)
node cls3.mjs          # post-run CLS with footer in view (reproduces 0.10)
python3 palette.py     # current palette: WCAG contrast + CIEDE2000 under protan/deutan/tritan
python3 palette2.py    # candidate palette validation
```

## Appendix B — key raw numbers

- axe violations: `color-contrast` only. Light initial: 3 nodes (`.btn-large`, 2 footer links). Light results: 4 nodes. Dark results: 2 nodes (`.btn-large`, `.btn-primary.btn-small`).
- Contrast:

  | element                    | ratio |
  | -------------------------- | ----- |
  | white / `#2a78d6`          | 4.42  |
  | white / `#3987e5`          | 3.64  |
  | white / `#5598e7`          | 2.99  |
  | link `#2a78d6` / `#f7f6f3` | 4.09  |
  | border `#d9d8d2` / white   | 1.43  |
  | tiger / arena (light)      | 2.93  |
  | latched / arena (light)    | 2.58  |

- CLS: 0.1013 (footer in view, desktop 1366×900); 0.0008 load (font swap); ~0 when footer below fold.
- Long tasks (ms): 170, 163, 303, 108, 75 (v0.1.0 desktop); 101, 199, 112 (6c84e0e desktop); 88, 102 (mobile 390); 71, 196 (5,000 runs, 10 vs 20).
- Focus obscured: 24 of 80 tab stops at 390×700 with Advanced open.
- Page height after results: 3,710 px (390 px wide), 4,502 px (320 px wide).
- Targets < 24 px: checkbox 18×18; replay range 16 px tall; footer inline links 15 px tall. 110 of 112 targets < 44 px in at least one dimension.

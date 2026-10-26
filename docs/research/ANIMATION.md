# Replay animation: audit, research and design proposal

Track: animation · Project: T-Rex vs Tiger Monte Carlo simulator (origin/main `6c84e0e`) · Date: 2026-10-19

Constraint: agents remain abstract glyphs (triangles, dots, diamonds, rings, arrows, wedges, lines); this document proposes no animal or character drawings.

---

## 0. Summary

**What is wrong today (measured)**

1. **The trace stores states only as 0.5 s samples and records no events.** Between 2.4% and 7.7% of latches are never visible in the default-size scenarios, because no frame sample falls inside them. In 500v5000 the figure is 39.5%. State changes appear on average 0.16–0.22 s (sim time) late. Bites, throws and kills cannot be shown at all.
2. **Colour is the only cue separating three tiger states.** Approaching, latched and routed tigers are all filled dots of near-identical size. Under simulated deuteranopia, approach vs latched collapses from ΔE2000 59 to 17, and latched vs routed falls to ΔE 8.3 (6.8 in dark mode, with only 0.3 L* difference). In the light theme the approach and latched colours are 2.93:1 and 2.58:1 against the arena, below the WCAG 3:1 non-text minimum.
3. **Motion is piecewise-linear and jumps at state changes.** Agents show velocity kinks every 0.5 s of sim time. Tigers freeze and then teleport whenever their state changes between samples. Latched tigers slide across their host instead of riding it.
4. **Worst-case density renders slowly.** In the test environment the current renderer reaches 22–29 fps for 500v5000. The cause is merged-arc Path2D fills and per-T-Rex fill/stroke with per-frame colour strings.
5. **The replay autoplays even when `prefers-reduced-motion: reduce` is set**, and the timeline has no event markers or "skip to contact". First contact happens on average at 43% of a default 10v100 battle.

**What I propose**

- **(a) An event log in the trace.** It costs 8 bytes per event (`Uint16Array`, 4 × u16), is emitted at 12 points in `engine.ts`, and consumes no RNG.
  - Prototyped and checked on 656 runs across 8 scenarios: summaries and Float32 frames are bit-identical with and without events, and 619,652 frame-state samples match the event-reconstructed states exactly.
  - Typical size is 1–4% of the frame payload; the observed maximum is 119 KiB.
  - A pathological case (1v5000, 3600 s, latch-fail churn) produces 2.85 M events, so the log needs priority classes and a 2 MiB cap with a documented fallback.
- **(b) A renderer built on exact event times.** Positions use centripetal Catmull-Rom interpolation, and latched tigers ride their host's pose. The visual language rule is **hue = side, shape = state, grey = out of the fight**. HP is shown as an in-glyph fill gauge. Trails and effects run under budgets, the camera uses a SmoothDamp log-zoom, density is drawn as fillRect LOD squares, and there is a cached timeline strip with event markers and a reduced-motion overview.
- **(c) Measurable acceptance criteria.**
  - The prototype holds **56–60 fps for 500v5000 and 60 fps for 10v100 and 50v1000** in a deliberately pessimistic environment: headless Chromium with software-only canvas.
  - Draw JS p95 is ≤ 10 ms; trace preparation is ≤ 8.4 ms.

A working prototype (kept outside the repository) is at `<local-workspace>/anim-proto/` (see Appendix C).

---

## 1. Method and caveats

- **Code audit:** `src/ui/replay.ts`, `src/sim/engine.ts`, `src/workers/sim.worker.ts`, `src/ui/app.ts`, `src/ui/charts.ts` (`readTheme`), `src/ui/styles.css`, `public/_headers`, and `docs/MODEL.md` §trace, all at origin/main `6c84e0e`.
- **Instrumented engine copy** (`anim-proto/src/sim/engine-ev.ts`, a diff against an identical copy of `engine.ts`). It emits events and is driven by `driver.ts`, `stress.ts` and `latency.ts` across the scenario matrix 1v1, 1v10, 1v100, 10v100, 10v1000, 50v1000, 500v5000 and 1v5000 (3600 s max). Engine copies were byte-compared with the repo (`diff -q`: identical).
- **Renderer prototype** (`anim-proto/src/proto.ts`) with three modes:
  - `mode=legacy`: a port of the production renderer, used for A/B comparison.
  - `mode=new`: the first iteration.
  - `style=v2`: the final visual language in this report.
- **Measurement:** Playwright drove the prototype over 5 s of playback at 2× from just before first contact. I recorded rAF intervals and per-frame JS time, for a desktop profile (1280×900 at DPR 2) and a "mobile" profile (390×844 at DPR 3, touch).
- **Caveat (important):** the measurement browser is HeadlessChrome 141 with **"Canvas: Software only, hardware acceleration unavailable"** and a SwiftShader WebGL renderer on 4 CPU cores (taken from `chrome://gpu`).
  - The "mobile" profile only emulates viewport and DPR; it is **not** a phone CPU or GPU.
  - All fps numbers here are therefore CPU-raster numbers. They are useful as a pessimistic, reproducible CI baseline, but **must be re-validated on real devices** (see §7, P3).
- **Colour checks:** CVD simulation uses the Machado et al. (2009) matrices at severity 100, as embedded in colorspacious (`colorspacious/cvd.py`, https://github.com/njsmith/colorspacious/blob/master/colorspacious/cvd.py; the original page https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html refused connections from the sandbox). Colour differences are ΔE2000 and contrast ratios follow the WCAG relative-luminance formula. The script is `anim-research/bin/cvd.py`.
- **Sources:** each external claim carries a URL.
  - WCAG Understanding documents and the ARIA APG slider were read from the W3C GitHub sources, because w3.org returned HTTP 403 to the sandbox; the canonical w3.org URLs are cited.
  - Items I could not confirm first-hand are marked **[unverified]**.

---

## 2. Audit of the current replay

### 2.1 Trace format (engine.ts)

| Aspect                | Current behaviour (origin/main)                                                                                                                                                                                                                                  | Consequence                                                                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sampling              | `record()` runs every `traceEvery` ticks. It starts at `traceMinEvery = 5` ticks, i.e. 0.5 s at `DT = 0.1` (engine.ts L319–338, L590–596).                                                                                                                       | Positions and states are known only at 0.5 s granularity.                                                                                                                                                                                            |
| Payload per frame     | T-Rex: `Float32Array` of x, y, heading, hpFrac (16 B per T-Rex). Tiger: `Float32Array` of x, y, state (12 B per tiger; the state is a small integer stored as a float).                                                                                          | 2–3× larger than needed (see §5.4).                                                                                                                                                                                                                  |
| Budget and decimation | `maxFrames = floor(6e6 / (4N + 3M))`. When it is exceeded, every other frame is dropped and the interval doubles (L321, L592–595; documented in MODEL.md L364–365).                                                                                              | 10v100 never decimates (17,647 frames, about 8,800 s). The 0.5 s cadence holds up to about 986 s for 10v1000, 176 s for 500v5000 and 199 s for 1v5000. In the long stress run (1v5000, 3600 s) frames ended up **16 s apart** (226 frames, 13.6 MB). |
| Events                | None. Bites, misses, throws, kills, routs and latch attempts are not recorded.                                                                                                                                                                                   | Strikes, hits and kills cannot be visualised; state changes are quantised to frames.                                                                                                                                                                 |
| Determinism           | Replay re-simulates the run with `trace = true`, and "tracing consumes no random numbers" (MODEL.md L84).                                                                                                                                                        | Any event logging must keep this invariant (§5.3).                                                                                                                                                                                                   |
| Transport             | Worker transfers each frame's two buffers zero-copy (sim.worker.ts L50; MDN: transfer "is literally moved between contexts in a fast and efficient zero-copy operation", https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects). | Good. Events should join the transfer list.                                                                                                                                                                                                          |

**Measured cost of frame sampling** (`anim-proto/src/latency.ts`; exact event times from the instrumented engine compared with when a frame-sampled renderer would show them):

| Scenario         | Runs | Latches | Latches < 0.5 s | Latches with **no** frame inside (invisible today) | Mean / max state-change lag (sim s) |
| ---------------- | ---- | ------- | --------------- | -------------------------------------------------- | ----------------------------------- |
| 1v1              | 100  | 316     | 6.0%            | 4.7%                                               | 0.16 / 0.4                          |
| 1v10             | 100  | 5,087   | 5.1%            | 2.4%                                               | 0.20 / 0.4                          |
| 10v100 (default) | 60   | 3,044   | 13.3%           | 7.0%                                               | 0.20 / 0.4                          |
| 10v1000          | 10   | 4,725   | 13.8%           | 7.7%                                               | 0.21 / 0.4                          |
| 500v5000         | 2    | 124     | 73.4%           | 39.5%                                              | 0.22 / 0.4                          |

None of these runs decimated. In decimated long runs the lag and invisibility scale with the frame interval, up to 16 s in the stress case.

### 2.2 Renderer (replay.ts)

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Where              | Severity            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------- |
| R1  | **Tiger state is read from frame `a`** (the last sample at or before t), so state flips are late (table above) and sub-0.5 s states vanish.                                                                                                                                                                                                                                                                                                                                                                                                                                             | L442, L391         | High                |
| R2  | **Position interpolation is piecewise-linear** between 0.5 s samples. Velocity is discontinuous at every sample: 4 visible "kinks" per second at the default 2×, 32 at 16×.                                                                                                                                                                                                                                                                                                                                                                                                             | L411–412, L447–448 | Medium              |
| R3  | **Teleports.** When a tiger's state differs between `a` and `b`, `g = 0` freezes it at the old position until the next sample, where it jumps. Latch snap (contact to body surface) and throw (+3 m) show up as jumps.                                                                                                                                                                                                                                                                                                                                                                  | L445–448           | Medium              |
| R4  | **Latched tigers are lerped in world space** between two host-relative positions. They cut across the host body chord when the host turns instead of rotating with it.                                                                                                                                                                                                                                                                                                                                                                                                                  | L447–449           | Low–Medium          |
| R5  | **Heading** uses shortest-arc angle lerp, which is equivalent to 2D slerp, i.e. constant angular speed (https://en.wikipedia.org/wiki/Slerp). Correct. Tigers have no direction cue at all.                                                                                                                                                                                                                                                                                                                                                                                             | L49–54, L413       | Info / Low          |
| R6  | **Colour-only state coding.** Approach, latched and routed are all filled circles; latched is only 15% larger. This fails "Use of Color" (colour must not be the only visual means; https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html). See the CVD table in §2.3.                                                                                                                                                                                                                                                                                                          | L449–468           | High                |
| R7  | **Contrast.** Light theme: approach `#eb6834` is 2.93:1 and latched `#1baf7a` is 2.58:1 against the arena (`#f5f5f3`). Both are below the 3:1 non-text contrast threshold, which "should not be rounded" (https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).                                                                                                                                                                                                                                                                                                          | styles.css L14–19  | Medium              |
| R8  | **HP as colour.** The T-Rex fill is an sRGB blend from `--c-hp-low` (red) to `--c-trex` (blue). It is colour-only and perceptually non-uniform, and a new `rgb()` string is built per T-Rex per frame.                                                                                                                                                                                                                                                                                                                                                                                  | L404–435           | Medium              |
| R9  | **Auto camera.** The target box is the raw min/max of all living T-Rex and all non-routed tigers, including recovering tigers retreating up to 40 m, so outliers drive the zoom. Tiger positions in the box are not interpolated (L314), so the target steps every sample. Easing is frame-rate independent (`1 − exp(−3·dt)`, L358; see Driscoll: https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/) but runs linearly on view width, so zoom speed is perceptually uneven. There is no hysteresis, so the view "breathes" as tigers drop in and out. | L276–322, L355–366 | Medium              |
| R10 | **Draw cost at density.** Each T-Rex gets its own `beginPath`/`fill`/`stroke`; tigers are merged into one Path2D of arcs per state. In the micro-benchmark (§3.6) merged arcs were the slowest primitive on CPU raster. The production port measured **22–29 fps** for 500v5000 against **56–60 fps** for v2 (§7).                                                                                                                                                                                                                                                                      | L407–468           | Medium (worst case) |
| R11 | **DPR changes** (moving the window between monitors, or browser zoom) are not observed unless the element also resizes. MDN recommends watching `matchMedia` for devicePixelRatio changes (https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio). The DPR cap of 3 is good.                                                                                                                                                                                                                                                                                         | L329, L172         | Low                 |
| R12 | **Reduced motion is ignored.** `app.ts` calls `replayView.load(trace)` with autoplay defaulting to `true` (replay.ts L188–200, app.ts L400). Pause exists, so 2.2.2 Pause, Stop, Hide is met (https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html). But 2.3.3 Animation from Interactions asks sites to "Take advantage of the reduce motion feature in the user agent or operating system" (https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).                                                                                                | app.ts L400        | Medium              |
| R13 | **Timeline.** A native range input with step 0.1: accessible, but with no event markers, no state overview and no skip-to-contact. Mean first contact falls at 25% (1v1), 43% (10v100) and 13–16% (1000+ tigers) of the battle duration.                                                                                                                                                                                                                                                                                                                                                | L118–128           | Medium (UX)         |
| R14 | **Legend and description.** The legend is a static DOM list, which is good. The canvas `aria-label` is static ("triangles are T-Rex, dots are tigers") and never states what is happening.                                                                                                                                                                                                                                                                                                                                                                                              | L130–170           | Low                 |
| R15 | **Good, keep:** rAF only while playing and visible (IntersectionObserver plus `visibilitychange`; MDN notes rAF "calls are paused in most browsers when running in background tabs or hidden `<iframe>`s", https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame); a 250 ms dt clamp; DPR cap 3; a fixed 1:1 aspect-ratio stage (no layout shift, which matters later for AdSense CLS); deterministic re-simulation; zero-copy transfer.                                                                                                                        | —                  | —                   |

### 2.3 Colour-vision check of the current and proposed palettes (ΔE2000; values below about 10–15 are hard to tell apart for small glyphs)

| Pair                                                          | Normal | Protan | Deutan   | Tritan | Grey ΔL* |
| ------------------------------------------------------------- | ------ | ------ | -------- | ------ | -------- |
| current light: approach `#eb6834` – latched `#1baf7a`         | 59.2   | 14.7   | **16.7** | 65.6   | **3.9**  |
| current light: latched – routed `#8d8c87`                     | 24.7   | 14.9   | **8.3**  | 26.5   | 5.4      |
| current dark: latched `#199e70` – routed                      | 23.7   | 11.9   | **6.8**  | 25.5   | **0.3**  |
| current light: T-Rex `#2a78d6` – approach                     | 48.5   | 52.1   | 59.3     | 68.0   | 9.3      |
| Okabe-Ito light: vermilion `#D55E00` – bluish green `#009E73` | 54.4   | 18.2   | 20.5     | 62.7   | 3.5      |
| Okabe-Ito light: bluish green – grey `#767676`                | 25.9   | 16.7   | **9.9**  | 25.0   | 8.1      |

**Conclusion.** Swapping to a colour-blind-safe palette (Okabe-Ito, https://clauswilke.com/dataviz/color-pitfalls.html, Table 19.1) helps contrast but **does not by itself fix** state confusion: latched vs routed stays below 10 under deutan. The fix is **redundant coding by shape** (Wilke ch. 20, "Redundant coding", https://clauswilke.com/dataviz/redundant-coding.html) plus a smaller palette (§6). Visual evidence: `anim-proto/shots/legacy-10v100-t26-deut.png` (latched tigers indistinguishable from routed) vs `v2-10v100-t26-deut.png`.

---

## 3. Research: techniques, sources and the decision for this project

### 3.1 Interpolation, easing and heading

- **Render "in the past" between two known snapshots.** Multiplayer games interpolate between authoritative snapshots rather than extrapolating (Gambetta, https://www.gabrielgambetta.com/entity-interpolation.html). Gaffer On Games buffers snapshots and notes how good plain linear interpolation looks even at 10 packets per second (https://gafferongames.com/post/snapshot_interpolation/). Our replay has the whole trace, so it can always use neighbours on both sides.
- **Centripetal Catmull-Rom** passes through the samples and avoids the cusps and self-intersections of the uniform parameterisation: "As the parameterization approaches to uniform, cusps and self-intersections occur" (Yuksel, Schaefer and Keyser, https://www.cemyuksel.com/research/catmullrom_param/). Use it over frames z, a, b, c when an agent's state is constant across all four. Otherwise fall back to linear interpolation anchored at **exact event times** (latch start and end, throw), and clamp to the arena.
- **Heading:** in 2D, slerp reduces to shortest-arc angle interpolation at constant angular speed ("spherical distance from the starting point varies uniformly with the interpolation parameter", https://en.wikipedia.org/wiki/Slerp). Keep the current `lerpAngle` for T-Rex. Tigers get a derived heading: the direction of motion between their anchors, used for the approach tick and rout arrow.
- **Do not ease simulation motion.** Easing (slow-in/slow-out, https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation) would misrepresent simulated speeds. Apply easing only to **non-data transitions**: camera moves, effect rings and UI. Heer and Robertson found slow-in/slow-out supports tracking, and simple transitions about 1 s long performed best (https://idl.cs.washington.edu/files/2007-AnimatedTransitions-InfoVis.pdf; https://idl.uw.edu/papers/animated-transitions).
- **Effect durations:** NN/g recommends 100–500 ms for most UI animations, about 100 ms for simple feedback, and 200–300 ms for substantial changes (https://www.nngroup.com/articles/animation-duration/). Event glyphs below use 220–500 ms (900 ms only for a T-Rex death), timed in **real** time so they stay visible at 16×.

### 3.2 Motion trails and ghosting

- Trails are a standard way to show recent motion in many-agent animations. deck.gl's TripsLayer exposes `currentTime`, `trailLength` and `fadeTrail` (https://deck.gl/docs/api-reference/geo-layers/trips-layer). Motion blur, the "apparent streaking of moving objects", is the photographic analogue (https://en.wikipedia.org/wiki/Motion_blur_(media)).
- Tracking many moving objects is capacity-limited, and spatial crowding and high speed make tracking fail (https://en.wikipedia.org/wiki/Multiple_object_tracking). Short trails let viewers recover direction without tracking every glyph.
- Static traces beat animation for analysis. Robertson et al. found animation "the least effective form for analysis; both static depictions of trends are significantly faster than animation, and the small multiples display is more accurate", even though animation was the most enjoyable for presentation (https://www.microsoft.com/en-us/research/publication/effectiveness-of-animation-in-trend-visualization/). This supports the reduced-motion **overview** doubling as an analysis view (§5.7).
- **Decision:** draw trails **deterministically from the trace** (a polyline back 3 s of sim time from the current interpolated point, with three alpha buckets drawn in pre-blended opaque colours). Do not use an accumulation or "fade" buffer: that is not scrub-safe and breaks when the camera moves.
  - Budget: at most 100 T-Rex trails, and at most 400 tiger trails only when tiger glyph radius ≥ 3 px.
  - Measured in this environment: unbudgeted trails dropped 50v1000 to 25–33 fps; budgeted (tq3/tq4) gave 59–60 fps (`out/fps.jsonl`, `out/fps-trails.jsonl`).
  - Trails are off in reduced motion.

### 3.3 Camera smoothing and auto-framing

- Game cameras smooth a locked target with lerp-smoothing and use **camera windows** so small movements do not move the camera (Keren, "Scroll Back", https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers).
- Unity's SmoothDamp is "a spring-like damper function … The motion doesn't overshoot the target position" (https://docs.unity3d.com/6000.6/Documentation/ScriptReference/Vector3.SmoothDamp.html). The prototype uses the standard critically damped approximation (Game Programming Gems 4 form, **[unverified primary source; the code is the widely used Unity-compatible form]**).
- Smoothing must be frame-rate independent: lerping by a constant factor per frame "takes a chunk out between a and b each frame … so the smoothing will also be variable"; use `Pow(r, dt)`-style damping (Driscoll, URL above).
- **Zoom in log space.** d3's `interpolateZoom` implements van Wijk and Nuij's "Smooth and efficient zooming and panning" (https://d3js.org/d3-interpolate/zoom) for large jumps such as "jump to event". For continuous following, damp `log(viewWidth)` so zoom-in and zoom-out feel symmetric.
- **Decision:**
  - Auto target = **trimmed box** (2nd–98th percentile, at most 1,500 sampled tigers) of living T-Rex plus tigers in approach, latched or recover state, with 20 m padding and a 60 m minimum view.
  - Smoothing: SmoothDamp with 0.45 s on the centre and 0.6 s on log-zoom.
  - **Hysteresis:** ignore zoom-target changes under +6% (out) or −12% (in).
  - Snap on scrub or seek.
  - Reduced motion forces "whole arena".

### 3.4 Encoding events as abstract glyphs

- Preattentive "pop-out" works for a single distinct feature (hue, shape, size). A **conjunction** of features "normally cannot be detected preattentively" (Healey, https://www.csc2.ncsu.edu/faculty/healey/PP/). Each state must therefore differ in one strong channel (shape), with hue reserved for side. Never encode a state only by a conjunction of a slight size change plus a hue change, which is what latched vs approach does today.
- **Flash safety.** WCAG 2.3.1 limits flashing to "no more than three general flashes … within any one-second period", or a combined flashing area under 25% of a 10° visual field. For web content that field is approximated as a 341 × 256 px rectangle (https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html; definition text in the WCAG 2.2 glossary), so 25% = **21,824 px²**.
  - Decision: rate-limit fill flashes per T-Rex to ≤ 3/s real time.
  - Cap total filled-flash area per frame at 20,000 CSS px²; beyond that, wedges draw outline-only.
  - Use low-alpha fills (0.2), never full-screen flashes.
- Event glyph catalogue: §6.2.

### 3.5 HP and stamina

- **Accuracy ranking.** Cleveland and McGill's experiments found that "graphs displaying relative position on a common scale most accurately are most effective" (https://en.wikipedia.org/wiki/Graphical_perception). Heer and Bostock's crowdsourced replication of the spatial-encoding studies supports the same ordering (https://idl.uw.edu/papers/crowdsourcing-graphical-perception). Angle and arc encodings (rings) rank lower.
- **Tested in the prototype:**
  - Screen-aligned HP bars (v1) collided with neighbouring glyphs in clusters (`shots/10v100-new-t26.png`).
  - Rings sized to the glyph (v2a) became large overlapping circles at close zoom.
- **Decision:**
  - **HP = in-glyph gauge.** The T-Rex triangle is drawn as a pale tinted hollow with a 1.5 px outline; it is filled from the tail toward the nose with filled **area = HP fraction** (fill height h = 1 − √(1 − HP)).
  - The gauge appears only once the T-Rex is damaged, so a full-HP triangle stays solid.
  - It adds zero extra footprint and works at any zoom (`shots/v2-1v10-t60.png`).
  - Exact HP % goes in the focus inspector and tooltip.
- **Stamina** is not in the trace. A stamina ring is only worth adding for a **focused** tiger. That needs one u8 per tiger per frame (§5.4), so it is optional and later.

### 3.6 Density rendering for thousands of agents

- Canvas performance guidance:
  - MDN: pre-render repeating objects offscreen, avoid floating-point coordinates, use layered canvases for complex scenes, and use `alpha: false` when no transparency is needed (https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).
  - web.dev: batch canvas calls and avoid unnecessary state changes (https://web.dev/articles/canvas-performance).
- **Micro-benchmark** (`anim-proto/bench/bench.js`, same software-raster Chromium; N glyphs in 4 states, 2.6 px radius, 620 CSS px canvas; "draw+raster" forces the deferred raster with a 1 px `getImageData`):

| Method                                                         | 1,000 @DPR2 | 5,000 @DPR2       | 20,000 @DPR2 | 5,000 @DPR3 |
| -------------------------------------------------------------- | ----------- | ----------------- | ------------ | ----------- |
| per-agent `beginPath/arc/fill`                                 | 3.4 ms      | 15.2 ms           | 56.4 ms      | 16.8 ms     |
| one Path2D of arcs per state (production approach)             | 5.3 ms      | **25.9 ms**       | 119.5 ms     | 32.7 ms     |
| one Path2D of rects per state                                  | 2.3 ms      | 9.8 ms            | 46.8 ms      | 13.9 ms     |
| **`fillRect` per agent, grouped by state**                     | **1.2 ms**  | **3.5 ms**        | **13.6 ms**  | **4.8 ms**  |
| sprite atlas (`OffscreenCanvas` → `ImageBitmap`) + `drawImage` | 4.1 ms      | 19.0 ms (16.8 JS) | 81.2 ms      | 20.9 ms     |

- **Interpretation.** On CPU raster, a merged path with thousands of subpaths is the worst choice, and per-call `drawImage` overhead dominates sprite atlases. On GPU-accelerated canvases (most real phones and desktops) `drawImage` from an `ImageBitmap` is usually much cheaper **[unverified here: no GPU in the sandbox]**.
- **Decision: level of detail (LOD) by on-screen size.**
  - When the tiger radius is under 3 CSS px, draw state-grouped `fillRect` squares snapped to device pixels. Shape coding degrades to tone and size at that zoom, and the legend says "zoom in for detail".
  - When glyphs are ≥ 3 px, draw true shapes from per-state Path2D batches; at that zoom only hundreds of glyphs are in view.
  - Keep an atlas path behind a flag and benchmark it on real GPUs before adopting.
- `OffscreenCanvas` (2D) is supported in Chrome 69, Firefox 105 and Safari 16.4 (MDN BCD `api/OffscreenCanvas.json`, https://github.com/mdn/browser-compat-data/blob/main/api/OffscreenCanvas.json; MDN marks it "Baseline · Widely available", https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas). Rendering in a worker is possible later but not needed: draw JS is ≤ 10 ms p95 on the main thread even at 500v5000.
- For an optional "heat" view, `globalCompositeOperation = "lighter"` gives additive density (https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation). It is not needed given the 5,000-tiger cap (config.ts `LIMITS`).

### 3.7 Layered canvases

- MDN suggests splitting static background, game layer and UI into stacked canvases when "some objects need to move or change frequently, while others remain relatively static" (Optimizing canvas, URL above). web.dev says the same.
- **Decision:**
  - **One stage canvas** for arena, agents, trails and effects. In auto-camera mode the background moves every frame anyway, and redrawing a few grid lines is cheap. The prototype holds 60 fps without layering.
  - **One timeline canvas** whose static strip is rendered once into an offscreen bitmap; only the playhead is drawn per frame.
  - **HUD and legend in the DOM** (crisp text, i18n, accessible, CSP-safe).
  - Revisit an arena layer only if profiling on real devices shows the background matters.

### 3.8 devicePixelRatio and picture quality on mobile

- `devicePixelRatio` is the ratio of physical to CSS pixels. Page zoom changes it; pinch-zoom does not. Use `matchMedia` to detect changes (MDN, URL above). Re-size the backing store on DPR change as well as on element resize.
- `ResizeObserver`'s `devicePixelContentBox` gives exact device-pixel sizes ("Since Chrome 84"; web.dev, https://web.dev/articles/device-pixel-content-box). It is unavailable in Safari per BCD (Chrome 84, Firefox 108, Safari no; https://github.com/mdn/browser-compat-data/blob/main/api/ResizeObserverEntry.json), so treat it as a progressive enhancement over `round(cssSize × dpr)`.
- Safari refuses canvases over 16,777,216 pixels (https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/, 2022; **[current limit unverified for 2026]**). Our stage is at most 620 × 620 CSS px; at DPR 3 that is 1,860² ≈ 3.5 MP, well under the limit. A 390 px phone gives 1,110² ≈ 1.2 MP.
- **Decisions for crispness:**
  - Keep the DPR cap at 3, and cap at 2 when more than 2,000 glyphs are drawn: the micro-benchmark shows a 1.37× raster cost from DPR 2 to 3.
  - Snap LOD squares and 1 px lines to **device** pixels (`round(x·dpr)/dpr`), not CSS pixels.
  - Use `getContext('2d', { alpha: false })` for the stage.
  - Minimum tiger radius is 2.2 CSS px (6.6 device px at DPR 3).

### 3.9 Frame budget

- At 60 Hz "the browser has 16.66 milliseconds to produce each frame" (https://web.dev/articles/rendering-performance). The RAIL model advises producing an animation frame "in 10 ms or less" because the browser needs about 6 ms (https://web.dev/articles/rail).
- Refresh rates of 75, 120 and 144 Hz are common (MDN rAF), so use rAF timestamps and never assume 60. Safari on ProMotion iPhones reportedly limits page rendering to about 60 fps by a default feature flag (https://www.igeeksblog.com/this-hidden-safari-setting-unlocks-120hz-scrolling/; secondary source, **[unverified]**).
- iOS Low Power Mode capped rAF at 30 fps from iOS 14 (WebKit bug 215745, https://bugs.webkit.org/show_bug.cgi?id=215745; **[current iOS behaviour unverified]**). Interpolation and real-time effect durations already make the replay frame-rate independent.
- Main-thread tasks over 50 ms are "long tasks" (https://web.dev/articles/optimize-long-tasks). The replay must keep load and prepare work under that; measured ≤ 8.4 ms.
- **Target:** draw JS p95 ≤ 8 ms on a mid-range phone, leaving headroom for ads and INP. There is **adaptive quality**: if the rolling p95 frame interval exceeds 20 ms for 1 s, step down one tier (trails off → effects outline-only → DPR cap 2 → LOD squares at any zoom); step back up after 5 s of headroom.

### 3.10 Reduced motion

- `prefers-reduced-motion` reflects the OS setting (https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion). WCAG 2.3.3 says non-essential motion can trigger "dizziness, nausea and headaches" and suggests honouring that setting (URL above).
- **Decision:** with `reduce` set:
  - no autoplay;
  - show a **static overview** (whole-battle trajectories plus event markers; `shots/10v1000-rm-overview.png`);
  - an explicit Play click is still honoured, but with trails, effects and flashes off and the camera fixed to the whole arena;
  - scrubbing still works because it is user-driven;
  - optionally, four small-multiple snapshots (start, first contact, peak, end), following Robertson et al. (§3.2).

### 3.11 Colour-blind-safe palettes

- Okabe-Ito's eight colours (orange `#E69F00`, sky blue `#56B4E9`, bluish green `#009E73`, yellow `#F0E442`, blue `#0072B2`, vermilion `#D55E00`, reddish purple `#CC79A7`, black) are designed for "all color-vision deficiencies" (Wilke, URL above; Okabe and Ito's CUD page, https://jfly.uni-koeln.de/color/).
- Paul Tol's schemes are also "colour-blind safe", and some are graded for monochrome readability (https://personal.sron.nl/~pault/).
- viridis is perceptually uniform (measured in CAM02-UCS) and is used for sequential data (https://bids.github.io/colormap/). Use it only if a sequential channel is ever needed, e.g. a heat view; it is not needed for categorical states.
- **Decision (§6.1):** two side hues (blue T-Rex, vermilion/orange tigers) plus neutral grey, with all states coded by shape. Light-theme tiger hue becomes `#D55E00` (3.45:1 against the arena).

### 3.12 Legends

- Use **redundant coding** in legends: the legend shows exactly the shape and colour pair used in the plot (Wilke ch. 20, URL above).
- **Decision:** the DOM legend draws each swatch with the **same glyph functions** on 16 × 16 canvases. This keeps legend and stage identical by construction, and is CSP-safe (no inline styles).
  - The legend has two groups, "Agents" and "Events".
  - It doubles as toggles for trails, effects and morale-shock rings.
  - On mobile it collapses into a "What am I seeing?" disclosure.

### 3.13 Timeline, event markers and scrubbing

- The ARIA APG slider pattern defines arrows for one step, Page Up/Down for larger steps and Home/End for the ends. It recommends `aria-valuetext` for human-readable values, e.g. a "Media Seek Slider" announcing current and maximum time (https://www.w3.org/WAI/ARIA/apg/patterns/slider/).
- Keep the **native range input** (keyboard and AT for free), and set `aria-valuetext` to "12.5 s of 31.2 s" in the user's language.
- Draw a **sparkline-style strip** (Tufte: "a small intense, simple, word-sized graphic", https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/) above it, cached as a bitmap with only the playhead drawn per frame. The strip shows:
  - stacked state counts (approach, latched, recover, routed and left, dead);
  - a T-Rex-alive line;
  - ticks for T-Rex deaths;
  - a first-contact marker (▼);
  - optionally a kills-per-second histogram.
- **Buttons:** "Skip to contact" (jumps to first contact − 2 s) and "Next / previous event" (next T-Rex death, or next kill cluster).
- **Keyboard:** Space toggles play/pause; ←/→ ±1 s; Shift ±5 s; `[` `]` change speed.

### 3.14 Playback speed

- Keep 1, 2 (default), 4, 8 and 16×, and add **0.25× and 0.5×** for 1v1 and 1v10 latch and throw exchanges, where events come 0.1 s apart.
- Effects are timed in real seconds, so they stay legible at any speed. At 8× and above, wedges are outline-only and impact rings are capped (300 per frame), because up to 144 salient events fall in a 0.5 s window at 500v5000.
- Optional "skip quiet stretches": when no state-changing event falls within the next 3 s of sim time, play at max(speed, 8×), with an on-screen "fast-forwarding" chip. Ship "Skip to contact" first; it is simpler and covers the 43% idle approach.

---

## 4. Proposal (a): event model

### 4.1 Event types

Events are stamped with the tick index _after_ the update, `step + 1`, matching `record((step + 1) * DT)`. Event time is `step × DT`. Indices are u16; `0xFFFF` means "none".

| Code | Name         | a       | b                                   | v (u8)                                      | Class | Emit at (engine.ts @ `6c84e0e`)                                                                 |
| ---- | ------------ | ------- | ----------------------------------- | ------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| 1    | `BiteHit`    | T-Rex i | tiger j                             | damage / tiger max HP × 255 (clamped)       | P0    | L407–411, inside `if (rng.next() < acc)`, after `dmg` is computed and before `tHp[best] -= dmg` |
| 2    | `BiteMiss`   | T-Rex i | tiger j                             | 0                                           | P1    | `else` of the same `if` (L407)                                                                  |
| 3    | `Latch`      | tiger j | host i                              | latch angle in host frame, 256 steps (1.4°) | P0    | L492–500, after `tLatchAng[j]` is set                                                           |
| 4    | `LatchFail`  | tiger j | T-Rex r                             | 0                                           | P1    | L501–503                                                                                        |
| 5    | `Throw`      | tiger j | host h                              | 0                                           | P0    | L520, first line inside the shake `if`                                                          |
| 6    | `Release`    | tiger j | host h or 0xFFFF                    | 0 = stamina out, 1 = host died              | P0    | L509–511 (host gone), L530 (stamina)                                                            |
| 7    | `TigerDeath` | tiger j | killer T-Rex                        | 0 = bite, 1 = throw                         | P0    | `kill()` L238, with cause and killer passed as arguments                                        |
| 8    | `Rout`       | tiger j | host if it was latched, else 0xFFFF | 0                                           | P0    | L425–428                                                                                        |
| 9    | `Exit`       | tiger j | 0xFFFF                              | 0                                           | P0    | L567                                                                                            |
| 10   | `TrexDeath`  | T-Rex i | 0xFFFF                              | 0                                           | P0    | L581–584                                                                                        |
| 11   | `Exhausted`  | tiger j | target T-Rex                        | 0                                           | P0    | L483–486                                                                                        |
| 12   | `Resume`     | tiger j | 0xFFFF                              | 0                                           | P0    | L544–547                                                                                        |

- **P0** events change state. Together with the frames they reconstruct the exact tiger state at any tick. `BiteHit` implies `→ Recover`, or `→ Dead` when it is followed by `TigerDeath` in the same step; events within a step are applied in emission order.
- **P1** events are cosmetic (misses and failed latch attempts).
- Not recorded: `Approach → Recover` via `toRecover(j, 0, 0)` without an event. Every call site of `toRecover` and every `tState` assignment is covered by the table: `kill`, `toRecover` ×4, `Latched`, `Routed`, `Approach` (resume) and `Left`.

### 4.2 Encoding and memory

- **Layout:** a growable `Uint16Array`, 4 × u16 = **8 bytes per event**: `[step, type << 8 | v, a, b]`. The log is sorted by construction (emission order), so binary search by time works.
- **Range check** (config.ts `LIMITS`):
  - `maxTime ≤ 3600 s` → ≤ 36,000 steps < 65,535 ✔
  - `tigerCount ≤ 5000`, `trexCount ≤ 500` → indices < 0xFFFF ✔
  - Add a `static_assert`-style test so a future limit change cannot silently overflow.
- **Static per-run metadata** for the renderer, needed for wedge and tether geometry: `bodyRadius`, `tigerRadius`, `DT`, and per-T-Rex `reach` and `arc` (Float32, 8 B per T-Rex).
- **Transfer:** add `events.buffer` and the meta buffers to the worker transfer list (sim.worker.ts L50). Add `version: 2` to `BattleTrace`.
- **Observed volumes** (instrumented engine, `out/event-stats.json`, re-run in `verify/driver.log`):

| Scenario            | Runs | Events mean | Events max | Max bytes | % of frame bytes | P1 share | Max salient events / 0.5 s | First contact (fraction of duration) |
| ------------------- | ---- | ----------- | ---------- | --------- | ---------------- | -------- | -------------------------- | ------------------------------------ |
| 1v1                 | 200  | 20          | 67         | 0.5 KiB   | 0.8%             | 34%      | 3                          | 0.25                                 |
| 1v10                | 200  | 266         | 694        | 5.4 KiB   | 1.7%             | 37%      | 6                          | 0.05                                 |
| 1v100               | 100  | 857         | 2,164      | 16.9 KiB  | 3.7%             | 43%      | 22                         | 0.24                                 |
| 10v100              | 100  | 329         | 1,289      | 10.1 KiB  | 1.3%             | 34%      | 23                         | 0.43                                 |
| 10v1000             | 30   | 3,351       | 10,183     | 79.6 KiB  | 1.3%             | 31%      | 102                        | 0.13                                 |
| 50v1000             | 20   | 3,041       | 10,659     | 83.3 KiB  | 1.3%             | 29%      | 83                         | 0.16                                 |
| 500v5000            | 4    | 8,307       | 15,284     | 119.4 KiB | 2.1%             | 16%      | 143                        | 0.14                                 |
| 1v5000 (3600 s cap) | 2    | 3,172       | 5,439      | 42.5 KiB  | 2.1%             | 64%      | 144                        | 0.36                                 |

- **Stress cases** (`anim-proto/src/stress.ts`, re-run):
  - 50v1000, 1200 s, latch-and-throw churn: **33,023** events (258 KiB). Fine.
  - 1v5000, 3600 s, latch chance 0: **2.85 M** events in total (1,000,000 stored at the prototype's cap plus 1,849,115 dropped), which would be about 22.8 MB uncapped. Of the first 1 M recorded, 81% were P1 `LatchFail` and 19% were P0 `Exhausted`/`Resume`. The split of the dropped tail was not measured.
- **Budget policy:**
  - P1 log: cap at 32,768 events (256 KiB). Additionally record at most one `LatchFail` per tiger per 2 s and one `BiteMiss` per T-Rex per 1 s, using a per-agent last-step `Uint16Array` (deterministic, no RNG). P1 events beyond the cap are dropped and counted.
  - P0 log: cap at 262,144 events (2 MiB). If exceeded, stop logging and store `eventsCompleteUntilStep`. The renderer then uses exact states up to that step and falls back to today's frame-sampled states afterwards, with a small "detail reduced after t = …" note.
  - The P0 cap was never reached in the scenario matrix; the largest observed was about 15 k.
  - Total worst case: 2.25 MiB of events next to at most 24 MB of frames.

### 4.3 Determinism guarantees (verified on the prototype)

- Emission code reads existing state only. It **never calls `rng.next()`**, never reorders loops, and never changes control flow. It is guarded by `if (log)`, which is `null` when `trace = false`.
- `kill()` should take `(j, cause, killer)` as arguments rather than reading closure variables, as the prototype did, to keep it obviously side-effect free.
- **Bit-identity check:** 656 runs across 8 scenarios. `summary` (JSON-equal) and every Float32 frame (`Object.is` per element) are identical across original engine with trace, event engine with trace, and event engine without trace: **0 mismatches** (`verify/driver.log`).
- **Reconstruction check:** tiger states rebuilt from events match frame states at **619,652** samples, and T-Rex deaths match frames: **0 mismatches** (`scripts/statecheck.mjs`).
- **Overhead:** per-run time differs from the original by −3% to +2% (noise), e.g. 500v5000 at 2,985 ms vs 3,044 ms and 10v100 at 12.5 vs 12.8 ms. With `trace = false` the only cost is a null check.

### 4.4 Optional: compact frames (doubles temporal resolution in the same memory)

- **T-Rex:** x, y as u16 scaled to L/65535 (9 mm at 600 m, 76 mm at 5,000 m); heading as u16 (2π/65536); HP as u16 → 8 B instead of 16 B.
- **Tiger:** x, y as u16, state as u8, plus an optional stamina u8 → 6 B instead of 12 B.
- **Effect:** with the same 24 MB budget, the maximum frame count roughly doubles or more. For 1v5000 it grows from 399 to about 960 frames (5 B per tiger) or 800 (6 B with stamina). Under the existing power-of-two decimation, a 3600 s run is then sampled every 4 s or 8 s respectively, instead of 16 s. Alternatively, halve memory for mobile.
- Do this after events land, because events remove most of the need for dense state sampling.

---

## 5. Proposal (b): rendering architecture

### 5.1 Pipeline

```
worker: simulateBattle(trace=true) ──transfer──▶ main: ReplayView.load(trace)
   frames (Float32/u16) + events (Uint16) + meta        │
                                                        ▼
                         prepare(trace)  (≤ 8.4 ms measured, 500v5000)
                         • decode events → SoA (step, type, v, a, b)
                         • per-tiger state transitions (CSR offsets)
                         • per-tiger latch intervals (start, end, host, angle, end-kind)
                         • T-Rex death times, first-contact time
                         • per-frame state counts (timeline strip)
                                                        ▼
   rAF tick(ts) → time += dt·speed → World.update(time) → Camera.update(dt) → draw layers
```

- **`World.update(t)`** binary-searches the frame and fills reusable typed arrays (no per-frame allocation):
  - T-Rex position: centripetal Catmull-Rom over frames k−1, k, k+1, k+2.
  - T-Rex heading: shortest-arc lerp.
  - T-Rex HP: linear.
  - Alive flag: the death time from the event log.
  - Tiger state: last transition ≤ t in the tiger's CSR list. This is exact.
  - Latched tigers: computed from the **host's interpolated pose** plus the latch angle, so they ride and rotate with the host.
  - Other tigers: Catmull-Rom while their state is constant across the four frames; otherwise linear between **event-time anchors** (latch end at the host surface, throw at +3 m, next latch start).
- **Purity:** `prepare` and `World` are pure modules with no DOM access. Unit-test them in vitest next to the existing sim tests.

### 5.2 Layers and draw order (stage canvas, `alpha: false`)

1. Arena fill, adaptive grid (10/25/50/100/250/500 m so that cells are ≥ 48 px; it gives camera motion a visible reference), border.
2. Dead tigers (×) and dead T-Rex (outline triangles), low alpha.
3. Trails (budgeted, three alpha buckets, pre-blended opaque colours).
4. Latch tethers.
5. Tigers by state: routed → recover → approach → latched.
6. T-Rex triangles with HP gauge.
7. Event effects (wedges, rings, bursts; capped).
8. Focus highlight (selected agent) and scale bar.

Timeline canvas: a cached strip plus the playhead. HUD (counts, time, legend, inspector) lives in the DOM.

### 5.3 Batching rules

- One Path2D per style bucket per frame.
- Per-theme colour strings are precomputed once; no per-agent `fillStyle` changes and no per-frame `rgb()` strings.
- In LOD mode, use state-grouped `fillRect` with device-pixel snapping (§3.6).
- Cull outside the viewport.

### 5.4 Camera

As in §3.3: modes Auto (trimmed box, SmoothDamp, log-zoom with hysteresis), Whole arena, 2×/4× following the T-Rex centroid, and **Follow selected** (click or tap a T-Rex). Use d3-style van Wijk zoom for "jump to event".

### 5.5 Effects scheduler

- Events whose time falls in [t − 0.9 s × speed, t] are scanned with a binary search over the sorted log.
- Each effect's age is measured in real seconds, `(t − tₑ) / speed`. An effect is drawn when age < its duration, and alpha is quantised into 3 buckets so effects stay batchable.
- Limits: at most 300 effects per frame, ≤ 3 fill flashes per T-Rex per second, and ≤ 20,000 px² of filled flash area per frame (§3.4).

### 5.6 Adaptive quality

- A rolling p95 of rAF intervals selects one of four tiers:
  - T0: full.
  - T1: no tiger trails.
  - T2: effects outline-only and DPR ≤ 2.
  - T3: LOD squares at any zoom and no trails.
- Step down after 1 s above 20 ms; step up after 5 s below 12 ms.

### 5.7 Reduced-motion overview and accessibility

- **Overview:** whole-battle trajectories (tigers thinned to at most 600, alpha 0.18), T-Rex paths, latch diamonds and kill ×'s. Drawn once; no rAF.
- **Canvas `aria-label`:** updated on pause or seek, e.g. "12.5 s: 10 of 10 T-Rex alive; 12 approaching, 3 latched, 75 fled, 10 dead". Not updated during playback, to avoid chatter.
- **Keyboard:** see §3.13. Native range input with `aria-valuetext`.

### 5.8 CSP and AdSense compatibility

- Everything is canvas plus DOM classes. No inline styles, no `eval`, no external assets, so it fits the current CSP (`script-src 'self'; style-src 'self'`, `public/_headers`).
- The fixed-aspect stage causes no layout shift.
- rAF stops when off-screen or hidden (already implemented), which leaves main-thread headroom for future ad scripts.

---

## 6. Proposal (b, continued): visual language spec

### 6.1 Colour tokens

Rule: **hue = side, shape = state, grey = out of the fight.**

| Token                    | Light                                                  | Dark                          | Contrast vs arena (light / dark) | Use                                                                      |
| ------------------------ | ------------------------------------------------------ | ----------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| `--c-trex`               | `#2a78d6` (keep) or Okabe-Ito `#0072B2`                | `#3987e5` (keep) or `#56B4E9` | 4.04 or 4.63 / 4.20 or 6.65      | T-Rex glyphs, bite wedges, throw bursts                                  |
| `--c-tiger`              | **`#D55E00`** (change from `#eb6834`, which is 2.93:1) | `#d95926` (keep) or `#E69F00` | 3.45 / 3.93 or 6.82              | Tiger glyphs (approach, latched, recover), tethers, latch and kill rings |
| `--c-out` (routed, left) | `#767676`                                              | `#9a9993`                     | 4.05 / 5.38                      | Rout arrows and rout ring                                                |
| `--c-dead`               | `#8d8c87` at α 0.5                                     | same                          | — (de-emphasised on purpose)     | × markers and dead-T-Rex outlines                                        |
| `--c-latched`            | **retire from the replay**                             | —                             | —                                | Latched is coded by the diamond shape                                    |

- Changing `--c-tiger` also recolours the outcome charts (charts.ts L237); coordinate with the UX track. If the brand orange must stay in charts, add a replay-only token instead.
- Keep `--c-hp-low` for nothing in the replay: HP is now the gauge.

### 6.2 Glyphs, sizes and timings

r = tiger radius on screen = max(2.2 px, 0.8 m × scale); len = T-Rex length = max(11 px, 7 m × scale).

| Entity or state                | Glyph                                                    | Size                                            | Paint                                                                                                        | Motion and notes                                 |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| T-Rex, full HP                 | Isosceles triangle, nose along heading                   | length len, base 0.64·len                       | fill `--c-trex`; 1.25 px surface-coloured outline when N ≤ 50 or len ≥ 18                                    | Catmull-Rom position, slerped heading            |
| T-Rex, damaged                 | Same triangle: hollow plus gauge                         | same                                            | hollow at 16% tint with 1.5 px `--c-trex` stroke; tail-to-nose fill with **area = HP**                       | Gauge appears at HP < 99.5%                      |
| T-Rex, dead                    | Outline triangle                                         | same                                            | `--c-muted` 1.5 px at α 0.6                                                                                  | `TrexDeath` ring 10 → 36 px, 900 ms, `--c-trex`  |
| Tiger, approaching             | Dot plus heading tick                                    | dot r; tick from r to 2.3r along motion         | fill and 1.2 px tick in `--c-tiger`                                                                          | Tick shows travel direction                      |
| Tiger, latched                 | **Diamond** plus tether                                  | half-diagonal 1.35r                             | fill `--c-tiger`, 1.2 px surface outline; tether 1.25 px `--c-tiger` at α 0.85 to host centre                | Rides the host at the recorded latch angle       |
| Tiger, recovering              | Ring                                                     | radius 0.9r                                     | 1.4 px stroke `--c-tiger`                                                                                    | —                                                |
| Tiger, routed                  | **Chevron arrow** along flight direction                 | length 1.6r, half-width 1.1r                    | fill `--c-out`                                                                                               | Removed on `Exit`                                |
| Tiger, dead                    | ×                                                        | half-size 0.8r                                  | 1.2 px `--c-dead` at α 0.5                                                                                   | `TigerDeath` ring 1r → 4r, 500 ms, `--c-tiger`   |
| LOD (r < 3 px)                 | Device-snapped squares                                   | 1.6r (≥ 2 device px); latched 1.2×, routed 0.8× | approach `--c-tiger`; recover `--c-tiger` at α 0.45; latched `--c-tiger` at 1.2×; routed `--c-out` at α 0.75 | Overview density; legend notes "zoom for detail" |
| Trail                          | Polyline over 3 s of sim time                            | 2 px (T-Rex), 1 px (tiger)                      | side hue at α 0.38 → 0.13 in 3 buckets                                                                       | Budgets as in §3.2; off in reduced motion        |
| **BiteHit**                    | Wedge (reach × ±half-arc) plus impact ring on the tiger  | reach × scale; ring 1.2r → 3.4r                 | wedge fill `--c-trex` α 0.2 plus outline α 0.55; ring `--c-trex`                                             | 320 ms, ease-out; rate limits per §3.4           |
| **BiteMiss**                   | Wedge outline only                                       | as above                                        | outline α 0.55                                                                                               | 220 ms; P1, droppable                            |
| **Latch**                      | Contracting ring on the tiger                            | 3.2r → 1.2r                                     | `--c-tiger`                                                                                                  | 280 ms                                           |
| **Throw**                      | 3-ray burst (−26°, 0°, +26°) pointing away from the host | rays from 4 → 14 px out                         | `--c-trex` (the T-Rex's action)                                                                              | 360 ms                                           |
| **Rout**                       | Expanding ring, then arrow glyph                         | 1r → 2.5r                                       | `--c-out`                                                                                                    | 300 ms                                           |
| Morale shock (optional toggle) | 40 m circle around a kill                                | `CONSTANTS.moraleRadius` × scale                | `--c-tiger` at α 0.25                                                                                        | Off by default: it dominated v1 screenshots      |
| Exhausted, Resume, Release     | No effect                                                | —                                               | —                                                                                                            | The glyph change is the cue                      |

- **Easing:** effect rings use ease-out (cubic); alpha is quantised to 3 steps.
- **Durations** are in real time. All are 220–500 ms (NN/g range) except the 900 ms T-Rex death, which is deliberately emphasised as a rare event.
- **Screenshots:**
  - `anim-proto/shots/v2-10v100-t26.png`: v2 at default size.
  - `v2-10v100-t26-deut.png` and `v2-10v100-t26-gray.png`: under deuteranopia and achromatopsia emulation every state stays distinguishable by shape.
  - `v2-1v10-t60.png`: HP gauge.
  - `v2-500v5000-t20-fit.png`: LOD.
  - `v2-mobile-10v100-t26.png`: 390 px at DPR 3.
  - Compare with the legacy versions `10v100-legacy-t26.png` and `legacy-10v100-t26-deut.png`.

---

## 7. Proposal (c): acceptance criteria and performance targets

### Correctness (automated, vitest)

- **C1 Determinism.** For the scenario matrix (1v1, 1v10, 1v100, 10v100, 10v1000, 50v1000, 500v5000, 1v5000 at 3600 s; ≥ 2 runs each, ≥ 100 runs for ≤ 100 tigers), `RunSummary` and every frame are bit-identical with events on, events off, and against `6c84e0e`.
- **C2 No RNG use.** `Rng.next` call count per run is identical with and without the event log (instrumented counter).
- **C3 Reconstruction.** The event-derived tiger state equals the frame state at every frame sample (0 mismatches), and T-Rex death times agree with frame HP.
- **C4 Encoding bounds.** A test asserts `maxTime/DT < 65535` and `max(trexCount, tigerCount) < 0xFFFF` from `LIMITS`.
- **C5 Budget.** No P0 drops anywhere in the matrix. Stress 1v5000 at 3600 s stays at ≤ 2.25 MiB of events with `eventsCompleteUntilStep` set correctly, and the renderer shows the fallback note.
- **C6 Throughput.** `trace = false` simulation time regresses by ≤ 3% (median of 5 repetitions, existing bench harness).

### Visual and UX (Playwright plus unit tests on pure geometry)

- **V1 Shape-separable states.** Each tiger-state glyph is rendered alone into a 32 × 32 mask; pairwise mask IoU < 0.6. Screenshots under CDP `Emulation.setEmulatedVisionDeficiency` (deuteranopia, protanopia, achromatopsia) are reviewed in the PR.
- **V2 Contrast.** Every agent colour token is ≥ 3:1 against the arena, in both themes (automated check over the CSS tokens).
- **V3 Flash safety.** At 16× on 500v5000, per-T-Rex fill flashes are ≤ 3/s and filled flash area is ≤ 20,000 CSS px² per frame (instrumented counters, as `window.__fx` in the prototype).
- **V4 No teleports.** Sampling at 60 Hz, per-agent screen displacement per frame stays ≤ max(4 px, 3 × that agent's median displacement), except at `Throw` events (anchored, 3 m).
- **V5 Latched riding.** During every latch interval, the tiger-to-host-centre distance equals bodyRadius + tigerRadius within ±1%.
- **V6 Reduced motion.** With `reducedMotion: 'reduce'` emulated: no autoplay, 0 rAF callbacks in the 2 s after load, the overview is rendered, and Play still works on click.
- **V7 DPR.** After a DPR change (emulated 1 → 2), the backing store equals `round(css × min(dpr, 3))` ±1 within one frame.
- **V8 Controls.** "Skip to contact" lands within ±0.1 s of first contact − 2 s. The slider has `aria-valuetext` in ko and en. Keyboard shortcuts work. The legend glyphs come from the same draw functions as the stage (snapshot test).

### Performance

**P1 CI baseline (headless Chromium, software raster, 4 cores — this sandbox).** Measured over 5 s at 2× starting from first contact − 1 s. The prototype already meets these (`out/fps-v2.jsonl`):

| Scenario        | DPR     | Target fps (median) | Target frames > 33 ms | Target draw JS p95 | v2 measured                           | Legacy measured   |
| --------------- | ------- | ------------------- | --------------------- | ------------------ | ------------------------------------- | ----------------- |
| 10v100          | 2 and 3 | ≥ 58                | 0                     | ≤ 3 ms             | 60.2 / 60.2 fps, JS p95 1.1 ms        | 60 fps            |
| 50v1000         | 2 and 3 | ≥ 58                | ≤ 1%                  | ≤ 4 ms             | 60.0–60.2 fps, JS p95 2.7 ms          | 59–60 fps         |
| 500v5000 (auto) | 2 and 3 | ≥ 55                | ≤ 3%                  | ≤ 10 ms            | 56.4 / 59.8 fps, JS p95 10.0 / 7.3 ms | **25.0–26.2 fps** |
| 500v5000 (fit)  | 2 and 3 | ≥ 55                | ≤ 3%                  | ≤ 10 ms            | 59.8 / 59.8 fps                       | **22.4–29.0 fps** |

- **P2 Load.** `prepare()` ≤ 20 ms and no long task (> 50 ms) on replay load. Measured 0.8–8.4 ms (`scripts/prep.mjs`).
- **P3 Real devices** (manual, before release; not measurable here):
  - Mid-range Android, roughly Pixel 6a class with Chrome: ≥ 55 fps on 10v100 and ≥ 30 fps on 500v5000 with adaptive quality engaged.
  - iPhone 12-class Safari: the same.
  - 30 fps is acceptable in iOS Low Power Mode.
  - Record with the in-page fps overlay (`?debug=fps`).
- **P4 Memory.** Trace ≤ 26.3 MB (24 MB frames + 2.25 MiB events + meta); prepared indexes ≤ 2 MB; no typed-array allocation inside `draw()`.
- **P5 Seek latency.** From scrub input to the rendered frame takes < 16 ms (no re-simulation).

---

## 8. Suggested implementation order (PR-sized)

1. **Engine events.** Event types, `EventLog` with P0/P1 caps and coalescing, `kill(j, cause, by)`, meta, worker transfer list, `BattleTrace.version = 2`, tests C1–C6, and a MODEL.md trace section. No UI change.
2. **Replay core.** Pure `prepare` and `World` modules (event-exact states, Catmull-Rom, latched riding), plus the v2 glyphs, LOD, HP gauge, tokens (`--c-tiger` light change) and DOM legend. Tests V1, V2, V4, V5.
3. **Camera and timeline.** Trimmed-box SmoothDamp camera, cached timeline strip, skip-to-contact, next/previous event, 0.25×/0.5× speeds, keyboard, `aria-valuetext`, dynamic `aria-label`. Tests V8, P5.
4. **Effects, trails and adaptive quality.** Tests V3 and P1, plus the Playwright fps script as a CI job.
5. **Reduced-motion overview and DPR handling.** Tests V6 and V7.
6. _(Optional)_ u16 compact frames (§4.4) and a stamina channel with a focus-mode stamina ring.

## 9. Risks and open questions

- **GPU vs CPU raster.** The sprite-atlas vs `fillRect` choice may flip on GPU canvases. Keep both paths behind a flag until P3 measurements exist.
- **Brand colour change** (`--c-tiger` light) touches the outcome charts. Decide jointly with the UX and brand tracks.
- **Catmull-Rom overshoot** near arena walls and turn points is small with the centripetal parameterisation, but clamp to [0, L] anyway.
- **Fallback when the P0 cap is reached** adds a second code path. It is simple (frame-sampled states, as today) but needs a test.
- **Visual density at 16×** on 500v5000: effects are capped, but the scene is busy. Consider defaulting effects to outline-only above 8×.
- **Bundle size:** the prototype renderer is 43 KB unminified, including legacy mode, overview and the test harness. The production module is estimated at 12–18 KB minified **[estimate]**.

---

## Appendix A. Sources

Engineering:

- MDN, Optimizing canvas: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- MDN, Path2D: https://developer.mozilla.org/en-US/docs/Web/API/Path2D
- MDN, OffscreenCanvas: https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
- MDN, createImageBitmap: https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap
- MDN, globalCompositeOperation: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
- MDN, devicePixelRatio: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
- MDN, requestAnimationFrame: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- MDN, Page Visibility API: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- MDN, Transferable objects: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
- MDN, prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
- MDN BCD: https://github.com/mdn/browser-compat-data/blob/main/api/OffscreenCanvas.json and https://github.com/mdn/browser-compat-data/blob/main/api/ResizeObserverEntry.json
- web.dev, Canvas performance: https://web.dev/articles/canvas-performance
- web.dev, Rendering performance: https://web.dev/articles/rendering-performance
- web.dev, RAIL: https://web.dev/articles/rail
- web.dev, devicePixelContentBox: https://web.dev/articles/device-pixel-content-box
- web.dev, Optimize long tasks: https://web.dev/articles/optimize-long-tasks
- PQINA, Safari canvas limit: https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/
- WebKit bug 215745 (Low Power Mode rAF): https://bugs.webkit.org/show_bug.cgi?id=215745
- iGeeksBlog on Safari ProMotion (secondary source): https://www.igeeksblog.com/this-hidden-safari-setting-unlocks-120hz-scrolling/

Interpolation and camera:

- Gambetta, Entity interpolation: https://www.gabrielgambetta.com/entity-interpolation.html
- Gaffer On Games, Snapshot interpolation: https://gafferongames.com/post/snapshot_interpolation/
- Yuksel et al., Catmull-Rom parameterisation: https://www.cemyuksel.com/research/catmullrom_param/
- Slerp: https://en.wikipedia.org/wiki/Slerp
- d3 interpolateZoom: https://d3js.org/d3-interpolate/zoom
- Unity SmoothDamp: https://docs.unity3d.com/6000.6/Documentation/ScriptReference/Vector3.SmoothDamp.html
- Driscoll, frame-rate independent damping: https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/
- Keren, Scroll Back: https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers
- deck.gl TripsLayer: https://deck.gl/docs/api-reference/geo-layers/trips-layer
- Motion blur: https://en.wikipedia.org/wiki/Motion_blur_(media)

Perception and visualisation:

- Heer and Robertson 2007: https://idl.cs.washington.edu/files/2007-AnimatedTransitions-InfoVis.pdf
- Robertson et al. 2008: https://www.microsoft.com/en-us/research/publication/effectiveness-of-animation-in-trend-visualization/
- Multiple object tracking: https://en.wikipedia.org/wiki/Multiple_object_tracking
- Healey, preattentive processing: https://www.csc2.ncsu.edu/faculty/healey/PP/
- Graphical perception (Cleveland and McGill): https://en.wikipedia.org/wiki/Graphical_perception
- Heer and Bostock 2010: https://idl.uw.edu/papers/crowdsourcing-graphical-perception
- Twelve basic principles of animation: https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
- NN/g, animation duration: https://www.nngroup.com/articles/animation-duration/
- Tufte, sparklines: https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/

Colour:

- Wilke, Fundamentals of Data Visualization ch. 19–20: https://clauswilke.com/dataviz/color-pitfalls.html
- Okabe and Ito, CUD: https://jfly.uni-koeln.de/color/
- Paul Tol: https://personal.sron.nl/~pault/
- BIDS, viridis: https://bids.github.io/colormap/
- colorspacious (Machado 2009 matrices): https://github.com/njsmith/colorspacious/blob/master/colorspacious/cvd.py

Accessibility:

- WCAG 2.2 Understanding: Use of Color https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html ; Non-text Contrast https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html ; Three Flashes https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html ; Pause, Stop, Hide https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html ; Animation from Interactions https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- ARIA APG, Slider pattern: https://www.w3.org/WAI/ARIA/apg/patterns/slider/

Not retrievable from the sandbox:

- The Material 3 motion tokens page rendered no text (JavaScript app).
- The Mapbox wind-particles article and the Popmotion iOS article were blocked (Cloudflare challenge, 403).

None of these are cited.

## Appendix B. Raw measurements

- Event volumes per scenario: `anim-proto/out/event-stats.json`; re-run log `anim-proto/verify/driver.log`; stress `anim-proto/verify/stress.log`.
- Frame-sampling lag and invisibility: output of `anim-proto/out/latency.mjs` (§2.1 table).
- FPS: `anim-proto/out/fps.jsonl` (legacy, new, no-trails and no-fx variants), `out/fps-trails.jsonl` (trail budgets tq1–tq4), `out/fps-v2.jsonl` (final v2).
- Density micro-benchmark: `anim-proto/bench/bench.jsonl` (DPR 1, 2 and 3; 1k, 5k and 20k glyphs).
- CVD and contrast: `anim-research/bin/cvd.py`, run against `anim-research/pages2/cvd.py`.

## Appendix C. Prototype files (kept outside the repository)

All paths are under `<local-workspace>/anim-proto/`.

- **`src/sim/engine-ev.ts`:** `engine.ts` plus the event log (the diff is the reference implementation for §4). `src/sim/engine.ts` is a byte-identical copy of the repo file.
- **`src/proto.ts`:** renderer (`mode=legacy` | `new`, `style=v2`, `zoom=auto|fit|2|4`, `rm=1`, `theme=dark`, `tq=1..4`, `trails=0`, `effects=0`, `shock=1`). `src/proto.v1.ts` is the pre-v2 snapshot.
- **`src/driver.ts`, `src/stress.ts`, `src/latency.ts`, `src/gen.ts`:** determinism, budgets, lag and trace export.
- **`scripts/statecheck.mjs`, `scripts/fps.mjs`, `scripts/fps2.mjs`, `scripts/shots.mjs`, `scripts/shots2.mjs`, `scripts/prep.mjs`:** measurement scripts.
- **`out/index.html` plus `out/proto.js`:** serve `out/` with any static server, e.g. `python3 -m http.server 8765`, then open `index.html?trace=10v100&style=v2`.
- **`shots/*.png`:** all screenshots referenced above.

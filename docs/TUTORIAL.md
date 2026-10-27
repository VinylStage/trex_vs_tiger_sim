# Guided tour (tutorial)

> **한국어 요약**
>
> - 시뮬레이터 화면 위에 단계별 안내(가이드 투어)를 띄웁니다. 헤더의 **튜토리얼** 버튼, 첫 방문 안내 배너, 또는 `?tour=1` 링크로 시작합니다.
> - 각 단계는 `data-tour="<id>"` 속성이 붙은 요소를 찾아 주변을 밝히고(스포트라이트) 나머지 화면을 어둡게 합니다. 대상이 없거나 숨겨진 단계는 자동으로 건너뜁니다.
> - “실행” 단계에서 **빠른 데모(100회)**를 돌리면 결과가 나온 뒤 자동으로 결과 설명 단계로 넘어갑니다. 이미 결과가 있으면 데모 버튼은 나오지 않습니다.
> - 키보드: ← → 이동, Esc 닫기, Tab은 안내 상자 안에서만 순환합니다. 닫으면 투어를 시작한 버튼으로 포커스가 돌아갑니다. 동작 줄이기(prefers-reduced-motion) 설정을 따릅니다.
> - 첫 방문 배너는 `localStorage`의 `trexsim.tour` 값이 없을 때만 보입니다. 배너를 닫거나 투어를 시작 · 완료하면 다시 나오지 않습니다.
> - 단계 문구는 `src/i18n/ko.ts` · `src/i18n/en.ts`의 `tour.*` 키(한국어 · 영어)에 있고, 단계 목록은 `src/ui/tour-model.ts`의 `TOUR_STEPS`에 있습니다.

## Contents

- [Starting the tour](#starting-the-tour)
- [Steps](#steps)
- [Files](#files)
- [Adding or editing a step](#adding-or-editing-a-step)
- [The quick demo](#the-quick-demo)
- [Spotlight and popover placement](#spotlight-and-popover-placement)
- [Accessibility](#accessibility)
- [First-visit offer and storage](#first-visit-offer-and-storage)
- [Deep link](#deep-link)
- [CSP notes](#csp-notes)
- [Testing](#testing)

## Starting the tour

| Entry point         | Behaviour                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header button       | **튜토리얼** / **Tutorial**, next to the language switch. Always available.                                                                                   |
| First-visit offer   | A small banner under the header with **Start the tour** and **No thanks**. Shown only until the visitor decides; see [below](#first-visit-offer-and-storage). |
| Deep link `?tour=1` | Opens the tour right after the page loads (`/play/?tour=1`, `/en/play/?tour=1`); see [Deep link](#deep-link).                                                 |
| Intro link          | **1분 튜토리얼 시작** in the static intro under the simulator; starts the tour in place.                                                                      |

## Steps

Steps are shown in this order. "Anchor" is the `data-tour` id the step spotlights. A step is skipped while none of its required anchors is visible, so the counter (`n / N`) only counts the steps that can be shown right now. Before the first run there are 10 steps; once results exist there are 13.

| #   | id            | Anchor(s) (`data-tour`)           | Shown when                 | Notes                                                                                                                                    |
| --- | ------------- | --------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `welcome`     | none (centred)                    | always                     | What the simulator is; keyboard hints.                                                                                                   |
| 2   | `presets`     | `presets`                         | always                     | Preset chips.                                                                                                                            |
| 3   | `counts`      | `counts` (T-Rex and tiger fields) | always                     | Both fields share one spotlight.                                                                                                         |
| 4   | `runs`        | `runs`, `seed`                    | always                     | Two spotlights.                                                                                                                          |
| 5   | `advanced`    | `advanced`                        | always                     | Opens the `<details>` (firing `toggle` at once, so the lazy table is built before the step is measured) and restores its previous state. |
| 6   | `run`         | `run` (run bar)                   | always                     | Quick-demo button; see [The quick demo](#the-quick-demo).                                                                                |
| 7   | `results`     | `results` (results panel)         | `results-empty` is visible | Preview of what appears after a run. Replaced by steps 8–11 later.                                                                       |
| 8   | `verdict`     | `verdict`, `stat-cards`           | results exist              | Verdict line and summary cards.                                                                                                          |
| 9   | `outcome`     | `outcome-chart`                   | results exist              | Outcome bars with 95% CI; mentions the histograms.                                                                                       |
| 10  | `sensitivity` | `sensitivity-chart`               | results exist              | Spearman tornado chart.                                                                                                                  |
| 11  | `replay`      | `replay`                          | results exist              | Replay canvas and controls.                                                                                                              |
| 12  | `share`       | `share`                           | always                     | Copy-link button and what the URL contains.                                                                                              |
| 13  | `header`      | `lang`, `tour`                    | always                     | Language switch and the Tutorial button.                                                                                                 |
| 14  | `finish`      | none (centred)                    | always                     | Link to the guide page: `/guide/` (Korean) or `/en/guide/` (English).                                                                    |

## Files

| File                                            | Role                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/ui/tour-model.ts`                          | DOM-free logic: `TOUR_STEPS`, step filtering and navigation, `n / N` counter, rectangle helpers, popover placement, the storage flag, the deep link, `guideHref`. Unit-tested in `tests/tour.test.ts`.                                                                                  |
| `src/ui/tour.ts`                                | DOM layer: the `<dialog>`, SVG spotlight, popover, keyboard and focus handling. Imports `tour.css`. Loaded with `import()` on the first start (button, offer, `?tour=1` or an intro link) and warmed when the pointer enters the button, so the startup bundle does not carry it (#80). |
| `src/ui/tour-offer.ts`, `src/ui/tour-offer.css` | The first-visit offer, part of the startup page; **Start the tour** loads the tour.                                                                                                                                                                                                     |
| `src/ui/tour.css`                               | Tour styles. Uses the colour tokens from `styles.css`, so light and dark mode follow automatically.                                                                                                                                                                                     |
| `src/i18n/ko.ts`, `src/i18n/en.ts`              | All tour text under `tour.*` (Korean and English).                                                                                                                                                                                                                                      |
| `src/ui/app.ts`, `src/ui/form.ts`               | Carry the `data-tour` anchors, the header button, and the demo hook (`runDemo`).                                                                                                                                                                                                        |

## Adding or editing a step

1. **Anchor.** Add `data-tour="<id>"` to the element to highlight. With `h()` use `attrs: { 'data-tour': '<id>' }`; on an existing element use `el.dataset.tour = '<id>'`. Several elements may share one id; each visible one is spotlighted, and neighbours closer than 24 px share one hole.
2. **Text.** Add `tour.<step>.title` and `tour.<step>.body` to **both** dictionaries (`src/i18n/ko.ts`, `src/i18n/en.ts`). `tests/i18n.test.ts` fails if the key sets or placeholders differ.
3. **Step.** Add an entry to `TOUR_STEPS` in `src/ui/tour-model.ts` at the position where it should appear:

   ```ts
   { id: 'duration', title: 'tour.duration.title', body: 'tour.duration.body', targets: ['duration-chart'] },
   ```

   | Field      | Meaning                                                                                                                           |
   | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
   | `id`       | Unique step id (tested).                                                                                                          |
   | `title`    | i18n key of the heading.                                                                                                          |
   | `body`     | i18n key of the text (one paragraph).                                                                                             |
   | `targets`  | `data-tour` ids to spotlight. `[]` shows a centred dialog.                                                                        |
   | `requires` | Optional. `data-tour` ids that decide visibility instead of `targets` (at least one must be visible). Used by the `results` step. |
   | `expand`   | Optional. `data-tour` id of a `<details>` element to open during the step. Its previous `open` state is restored afterwards.      |
   | `extra`    | Optional. `'demo'` adds the quick-demo button, `'guide'` adds the guide link.                                                     |

4. Run `npm run check`. The step-data tests check unique ids and that every title and body exists in both languages.

To remove a step, delete its entry and its two i18n keys. Leftover `data-tour` attributes are harmless.

"Visible" means the element is connected and has at least one layout box (`getClientRects().length > 0`), so `hidden`, `display: none` and hidden ancestors all count as missing.

When a run finishes while the tour is open (the quick demo, or a run started before the tour), `app.ts` calls `tour.refresh()`. The tour re-renders the current step, or, if that step is no longer available, moves to the next available one (`resolveStep`). In practice this replaces the results preview (`7 / 10`) with the verdict step (`7 / 13`). The counter never shows more steps than are available (`stepCounter`).

## The quick demo

The `run` step offers **Run a quick demo (100 runs)** (`DEMO_RUNS` in `tour-model.ts`) when there are no results and no run is in progress.

- Clicking it calls `runDemo()` from the app. The app sets the run count to 100 in the form and the URL, keeps every other setting, and starts the normal run path (`run()` in `app.ts`, which uses the worker pool). Progress shows inside the spotlighted run bar.
- When the run resolves with results and the tour is still on the `run` step, the tour moves to the next step, which is now `verdict`. If the visitor already moved on to the results preview, that step is replaced by `verdict` (see above).
- While the demo runs, the button stays in place (marked `aria-disabled`) and keeps focus, so pressing Enter again does nothing.
- If the run fails or is cancelled, the step shows a short message and the button again, and the live region announces the failure.
- When results already exist, the button is not shown and the step says that the next steps use them.
- Closing the tour during the demo does not cancel the run.

## Spotlight and popover placement

- The tour is a full-viewport modal `<dialog>` in the top layer. An inline SVG covers it: a dimming rectangle with an SVG `<mask>` that has one black, rounded `<rect>` per hole. A ring `<div>` outlines each hole.
- Each target's rectangle is clipped by its scrolling ancestors (for example the sticky config panel on wide screens) and by the viewport, padded by 6 px, and merged with neighbours closer than 24 px (`mergeRects`).
- `placePopover` puts the popover below the targets, else above, else right, else left. If none fits whole, it goes on the side (above or below) with more room and scrolls inside itself (`maxH`), provided that leaves at least `MIN_POPOVER_ROOM` (160 px). Otherwise it docks to the bottom edge and the spotlight is trimmed to the part of the target above it. Without a target it is centred. It always keeps a 12 px margin inside the viewport.
- A sticky target (the run bar) is not scrolled to the centre: the tour scrolls the end of its container (the config panel) to the bottom edge, so the bar rests there with the space above it free for the popover.
- The popover is at most the viewport height minus 24 px. On short viewports (for example 320 × 256, which is 1280 × 1024 at 400% zoom) its text scrolls, starting at the top on every step, while the **Skip / Back / Next** row stays pinned to its bottom edge (`position: sticky`). `scroll-padding-bottom` is set to the height of that row, so a focused demo button or guide link is never scrolled in behind it.
- On step change the first target is scrolled into view (`block: 'center'`, or `'start'` for tall targets) unless all targets are already fully visible, smoothly unless reduced motion is requested. A new step first cancels any smooth scroll the previous step started (an instant `scrollTo` to the current position), so pressing Next quickly cannot carry the new target off screen. Layout is recomputed in `requestAnimationFrame` on window resize, on any scroll (a capturing `scroll` listener catches nested scroll containers), and when the body, the popover or a target changes size (`ResizeObserver`).
- Clicks on the dimmed page do nothing. The page behind the dialog is inert, so it cannot be operated during the tour, but it can still be scrolled.

## Accessibility

| Behaviour         | Implementation                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dialog semantics  | Native `<dialog>` opened with `showModal()` (implicit `role="dialog"`, page behind is inert), plus `aria-modal="true"`, `aria-labelledby` (step title) and `aria-describedby` (step text). |
| Focus on open     | Moves to **Next**, which stays visible even when the popover has to scroll (the button row is sticky).                                                                                     |
| Focus trap        | `Tab` / `Shift+Tab` cycle through the popover's buttons and links only.                                                                                                                    |
| Focus on close    | Returns to the element that had focus when the tour started (the header button or the offer's start button), falling back to the header **Tutorial** button.                               |
| Keyboard          | `→` next, `←` back (both ignored with Alt, Ctrl or Meta), `Esc` closes. At the first or last step the arrow keys do nothing; the last step closes only with **Done**.                      |
| Disabled controls | **Back** on the first step and the demo button while running use `aria-disabled="true"` instead of `disabled`, so focus never drops out of the dialog.                                     |
| Re-rendering      | A re-render updates the existing elements in place and only re-attaches the extra content when its set of elements changes, so the focused demo button or guide link keeps focus.          |
| Announcements     | A polite `aria-live` region inside the dialog announces "Step n of N: title" on every step change, "Running the demo…" when the demo starts and the failure message if it fails.           |
| Reduced motion    | With `prefers-reduced-motion: reduce`, scrolling is instant and the fade-in animations (Web Animations API) and the progress-bar transition are off.                                       |
| Colour            | Uses the existing light and dark tokens; the dimming and ring colours have dark-mode variants. The guide link uses the text colour with an accent underline (15:1 light, 13:1 dark).       |

## First-visit offer and storage

- **Key:** `localStorage['trexsim.tour']` (`TOUR_STORAGE_KEY`).
- **Values:** `dismissed` (the offer was declined, or the tour was started or closed before the end) and `completed` (**Done** was pressed on the last step or the guide link was followed). `completed` is never downgraded to `dismissed`. Any other value counts as no value.
- The offer is rendered with the page (under the header, in normal flow, so it causes no layout shift after load) only while no value is stored. It is not shown when the page was opened with `?tour=1`.
- Every storage access is wrapped in `try/catch`. If storage is blocked, the choice is kept in memory for the current page load only.
- To see the offer again, run `localStorage.removeItem('trexsim.tour')` in the browser console and reload.

## Deep link

Append **`?tour=1`** to the play page URL, for example `https://trex-vs-tiger.vinylims.com/play/?tour=1`. Any value except `0` works (`?tour` too).

- The query parameter is used instead of a hash parameter because the URL fragment already carries the shared scenario (`#s=…`, see [ADR-0003](adr/0003-no-backend-url-sharing.md)). Both can be combined: `/play/?tour=1#s=…`.
- On load the parameter is removed with `history.replaceState`, so reloading or copying the link afterwards does not restart the tour. Other query parameters and the fragment are kept.
- The deep link is not a page for search engines: the play page is `noindex` and not in the sitemap ([SEO.md](SEO.md#urls-and-languages)).
- Links made before #142 point at `/?tour=1` and `/en/?tour=1`. The lobby forwards them to the play page with the query kept ([SHARING.md](SHARING.md#link-routing)).
- The Korean guide links to `/play/?tour=1`, the English guide to `/en/play/?tour=1`. The tour runs in the language of the URL (`/play/` Korean, `/en/play/` English); nothing about the language is stored.
- The intro on the lobby (`index.html`, `en/index.html`) has a **1분 튜토리얼 시작 / Take the one-minute tour** link to the same deep link. The lobby does not run the app, so the link opens the play page, and the tour starts there.

## CSP notes

The tour runs under the production CSP (`style-src 'self'`, `script-src 'self'`):

- No inline styles in markup. Positions and sizes are set through the CSSOM (`el.style.left = …`), SVG geometry through attributes (`x`, `y`, `width`, `height`, `rx`, `mask`, `fill`), and animations through `Element.animate()`.
- Styles live in `src/ui/tour.css`, which Vite bundles into the emitted stylesheet.
- No `innerHTML`; all text is set with `textContent`.

## Testing

- **Unit tests:** `tests/tour.test.ts` covers the step data, filtering, navigation and counter, leaving a step that became unavailable (`resolveStep`), the rectangle helpers, `placePopover`, the storage flag (including missing and throwing storage), the deep link and `guideHref`.
- **Browser check (manual or Playwright):** with the production CSP injected, at 1366 px and 390 px, in light and dark mode: start from the header button, go forward and back with the keyboard and the mouse, check that focus stays inside the popover, run the demo (focus stays on the demo button, a second Enter does nothing, the tour lands on `7 / 13` even if Next was pressed during the run, a blocked worker is announced as a failure), check at 320 × 256 that the focused **Next** is inside the popover, close with Esc and check that focus returns, confirm the offer appears once, and check that there are no console or CSP errors and no horizontal overflow.

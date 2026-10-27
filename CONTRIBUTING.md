# Contributing

## Workflow (GitHub Flow, issue-driven)

1. Open or pick an issue. Every change is tracked by an issue.
2. Branch from `main`: `<type>/<issue-number>-<slug>` (e.g. `feat/3-sim-engine`), with the same `<type>` as the PR title. Changes that need no issue (a docs-only fix, the patch notes entry before a release) use `<type>/<slug>` (e.g. `docs/patch-notes-0.2.14`) and say why in the PR description.
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`). Breaking changes use `!` or a `BREAKING CHANGE:` footer.
4. Open a PR against `main` using the PR template and reference the issue (`Closes #N`).
5. CI must be green. PRs are **squash-merged**; the PR title becomes the commit subject, so it must be a valid conventional commit.
6. [release-please](https://github.com/googleapis/release-please) opens a release PR from the commit history; merging it tags a release and updates `CHANGELOG.md`.

## Release cadence

Every work cycle includes a release:

1. After each merged `feat` or `fix` PR (or a small batch merged together), check the open release-please PR.
2. Make sure `main` has the patch notes entry for the version it proposes (see below); add it in a small PR first if it is missing, so the release PR picks it up.
3. Validate it: the diff touches only `package.json`, `package-lock.json`, `.release-please-manifest.json` and `CHANGELOG.md`; run `npm run check` and `npm run build` on its head and confirm `dist/version.json` shows the new version. Its own CI does not run, because release-please creates it with `GITHUB_TOKEN`.
4. Squash-merge it. release-please then creates the tag (`trex-vs-tiger-sim-vX.Y.Z`) and the GitHub Release, and the IndexNow job submits the sitemap once production serves the new version.
5. Confirm the GitHub Release exists and that `https://trex-vs-tiger.vinylims.com/version.json` reports the new version; the site's version badge then offers the update to open tabs.

**Every release adds a patch notes entry.** The [patch notes page](https://trex-vs-tiger.vinylims.com/patch-notes/) (`/patch-notes/`, `/en/patch-notes/`) is generated from `PATCH_NOTES` in `src/content/patch-notes.ts`: one entry per version, newest first, with the version, the `CHANGELOG.md` date, a catchy ko and en title, 2–6 bullets in the categories ✨ new · 🛠 improved · 🐛 fixed · 🔒 security · ♿ accessibility · ⚠️ known issues, and the PR and issue numbers. Write it for visitors, playful but true: describe only what the release shipped, write Korean and English separately (not word for word) and follow the [content framing rules](#content-framing-rules). An entry for the next version can be written ahead; it stays hidden until `package.json` reaches that version, so it lands with the release. Also bump the "last updated" `<time>` in `patch-notes/index.html` and `en/patch-notes/index.html`. `tests/patch-notes.test.ts` fails, with instructions, when a version in `.release-please-manifest.json` or `CHANGELOG.md` has no entry, so the release PR's `npm run check` (step 3) catches a missing one.

While the version is below 1.0.0, every routine release bumps the **patch** version (`feat` and `fix` alike, `bump-patch-for-minor-pre-major`), and a breaking change (`feat!`) bumps the minor version (`bump-minor-pre-major`). A minor release for a large planned batch (an epic such as v0.2.0) is requested explicitly with a `Release-As: 0.X.0` footer in the commit that completes it.

## Local development

```bash
npm ci
npm run dev       # Vite dev server
npm run check     # typecheck + lint + format check + unit tests
npm run build     # production build into dist/
npm run test:coverage  # unit tests with a v8 coverage report in coverage/
```

`npm run test:coverage` prints a text summary and writes an HTML report (`coverage/index.html`) and `coverage/lcov.info`. It covers `src/**/*.ts` and has no thresholds; the baseline is recorded in `IMPLEMENTATION_AUDIT.md`. It is not part of `npm run check` or CI because instrumentation makes the suite several times slower.

Node version: see `.node-version`.

## Rules

- Logic changes require unit tests (`tests/`).
- Declarative config (JSON, YAML, `_headers`, `_routes.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`) carries no comments; document it in `docs/CONFIGURATION.md`. The only exception is the `# vX.Y.Z` after a SHA-pinned action, which Dependabot maintains. Build code such as the Vite plugins (`vite.pages.ts`, `vite.seo.ts`) is code and is documented in place, like `src/`.
- Model or parameter changes must cite sources in `docs/MODEL.md`.
- Keep diffs minimal; no drive-by refactors.
- Documentation (`ARCHITECTURE.md`, `ROADMAP.md`, `IMPLEMENTATION_AUDIT.md`) is updated in the same PR as the code.

## Content framing rules

The site is an educational Monte Carlo model and is being prepared for Google AdSense ([docs/ADSENSE.md](docs/ADSENSE.md)). Every PR that changes text, visuals or the animal roster follows these rules; the reasoning and sources are in [docs/research/ADSENSE.md §3.3](docs/research/ADSENSE.md#33-content-framing-rules-apply-now-also-guide-the-animation-and-new-animal-work).

Do:

- Present the method as the subject and the matchup as a toy scenario: Monte Carlo sampling, confidence intervals, sensitivity analysis, numbers effects and parameter uncertainty.
- Keep the educational disclaimer, including that the site does not promote or endorse real animal fighting.
- Use neutral, technical words: 전투 불능 / incapacitated, 이탈 / fled, 교전 / engagement, 물기 판정 / bite check.
- Draw agents as abstract glyphs only (dots, triangles, diamonds, rings, arrows, lines, squares). Mark incapacitated agents with a grey cross or a fade.

Do not:

- Draw animal or character shapes, silhouettes, faces, blood, wounds, splatter or corpses, in the replay, icons, OG images or tutorial art. Hit effects are not red.
- Model domestic animals or pets (dogs, cats, roosters, horses), living humans (_Homo sapiens_), real named individuals or specific zoo animals. The extinct hominin _Homo erectus_ is the one exception: it is modelled unclothed, without tools, weapons, fire or trained skill, and every place that shows it carries the physical-capability thought-experiment note ([docs/SPECIES.md §9](docs/SPECIES.md#9-content-rules)).
- Use words such as 학살, 도륙, 피, 잔혹, massacre, gore or "kill count" in UI, titles, alt text or share text.
- Link to or embed real animal-fight media, or promote products made from endangered species.

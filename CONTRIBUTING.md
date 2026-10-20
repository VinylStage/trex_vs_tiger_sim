# Contributing

## Workflow (GitHub Flow, issue-driven)

1. Open or pick an issue. Every change is tracked by an issue.
2. Branch from `main`: `<type>/<issue-number>-<slug>` (e.g. `feat/3-sim-engine`).
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`). Breaking changes use `!` or a `BREAKING CHANGE:` footer.
4. Open a PR against `main` using the PR template and reference the issue (`Closes #N`).
5. CI must be green. PRs are **squash-merged**; the PR title becomes the commit subject, so it must be a valid conventional commit.
6. [release-please](https://github.com/googleapis/release-please) opens a release PR from the commit history; merging it tags a release and updates `CHANGELOG.md`.

## Release cadence

Releasing is part of every work cycle, not a separate milestone:

1. After each merged `feat` or `fix` PR (or a small batch merged together), check the open release-please PR.
2. Validate it: the diff touches only `package.json`, `package-lock.json`, `.release-please-manifest.json` and `CHANGELOG.md`; run `npm run check` and `npm run build` on its head and confirm `dist/version.json` shows the new version. Its own CI does not run, because release-please creates it with `GITHUB_TOKEN`.
3. Squash-merge it. release-please then creates the tag (`trex-vs-tiger-sim-vX.Y.Z`) and the GitHub Release, and the IndexNow job submits the sitemap once production serves the new version.
4. Confirm the GitHub Release exists and that `https://trex-vs-tiger.vinylims.com/version.json` reports the new version; the site's version badge then offers the update to open tabs.

While the version is below 1.0.0, `feat` bumps the minor version and `fix` the patch version (`bump-minor-pre-major`).

## Local development

```bash
npm ci
npm run dev       # Vite dev server
npm run check     # typecheck + lint + format check + unit tests
npm run build     # production build into dist/
```

Node version: see `.node-version`.

## Rules

- Logic changes require unit tests (`tests/`).
- Config files carry no comments; document them in `docs/CONFIGURATION.md`.
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
- Model domestic animals or pets (dogs, cats, roosters, horses), humans, real named individuals or specific zoo animals.
- Use words such as 학살, 도륙, 피, 잔혹, massacre, gore or "kill count" in UI, titles, alt text or share text.
- Link to or embed real animal-fight media, or promote products made from endangered species.

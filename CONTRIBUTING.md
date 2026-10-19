# Contributing

## Workflow (GitHub Flow, issue-driven)

1. Open or pick an issue. Every change is tracked by an issue.
2. Branch from `main`: `<type>/<issue-number>-<slug>` (e.g. `feat/3-sim-engine`).
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`). Breaking changes use `!` or a `BREAKING CHANGE:` footer.
4. Open a PR against `main` using the PR template and reference the issue (`Closes #N`).
5. CI must be green. PRs are **squash-merged**; the PR title becomes the commit subject, so it must be a valid conventional commit.
6. [release-please](https://github.com/googleapis/release-please) opens a release PR from the commit history; merging it tags a release and updates `CHANGELOG.md`.

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

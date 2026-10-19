# ADR-0004: Zero runtime dependencies (vanilla TypeScript + Canvas)

- Status: Accepted
- Date: 2026-10-19
- Issue: #4

## Context

The UI needs a form, a few charts and an animated replay. Frameworks/chart libraries add bundle weight, supply-chain surface and upgrade churn.

## Decision

No runtime npm dependencies. DOM is built with small helpers; charts and replay are drawn on `<canvas>`. Only dev dependencies (Vite, TypeScript, Vitest, ESLint, Prettier).

## Consequences

- Small bundle, strict CSP (`script-src 'self'`) is easy.
- Chart code is maintained in-repo (`src/ui/charts.ts`) and must be kept simple.

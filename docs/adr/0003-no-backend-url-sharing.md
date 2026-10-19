# ADR-0003: No backend; share scenarios via URL fragment

- Status: Accepted
- Date: 2026-10-19
- Issue: #4

## Context

Users must be able to reproduce and share a configured scenario. Global result aggregation (Workers + D1) was considered and declined at kickoff.

## Decision

The full scenario (counts, seed, options, overridden parameter ranges) is serialised to JSON, base64url-encoded and stored in the URL fragment (`#s=`). Because the seed is included, the shared link reproduces identical results.

## Consequences

- No data storage, no PII, no rate limiting needed.
- The fragment is never sent to the server.
- Input from the URL is untrusted: decoded with `JSON.parse` only, validated against the schema, numeric values clamped to allowed ranges; unknown keys are dropped.

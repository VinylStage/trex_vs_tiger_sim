# Security Policy

## Supported versions

Only the latest release deployed from `main` is supported.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting ("Security" tab → "Report a vulnerability"). Do not open a public issue.

## Scope notes

- The site is fully static. There is no backend, no authentication and no user data storage.
- Scenario state is encoded in the URL fragment and is parsed with schema validation and value clamping; it is never evaluated as code.
- A strict Content-Security-Policy is applied via `public/_headers`.

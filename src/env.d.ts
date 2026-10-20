/** `package.json` version at build time, e.g. `0.1.0` (Vite `define`, see docs/VERSIONING.md). */
declare const __APP_VERSION__: string;
/** Full commit SHA the bundle was built from (`CF_PAGES_COMMIT_SHA`, else `git rev-parse HEAD`), or `dev`. */
declare const __BUILD_SHA__: string;
/** ISO 8601 timestamp of the build. */
declare const __BUILD_TIME__: string;

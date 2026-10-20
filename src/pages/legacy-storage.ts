/*
 * Browser storage that earlier releases wrote and this one no longer uses. v0.1.0 remembered the
 * interface language as 'trexsim.lang'; the language now comes from the URL only, so the app and
 * every content page delete the old value on load. The privacy pages name these keys too
 * (tests/pages.test.ts checks every 'trexsim.*' key in src/ against them).
 */

export const LEGACY_STORAGE_KEYS: readonly string[] = ['trexsim.lang'];

/** The part of `Storage` this module needs. */
export interface RemovableStorage {
  removeItem(key: string): void;
}

/**
 * `localStorage`, or null when it is missing or access throws (blocked storage). The one copy of
 * this guard: the tour uses it too (src/ui/tour.ts).
 */
export function localStorageOrNull(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Delete every legacy key; never throws (storage may be blocked or read-only). */
export function dropLegacyStorage(storage: RemovableStorage | null = localStorageOrNull()): void {
  if (!storage) return;
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      // Blocked storage: nothing to clean up.
    }
  }
}

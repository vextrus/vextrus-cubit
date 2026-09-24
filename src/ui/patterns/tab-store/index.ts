/**
 * A value kept in the TAB (`sessionStorage`): what a screen keeps for the life of one tab and no
 * longer — S-Ask's conversation (s-ask I-403) — read and written as JSON.
 *
 * The browser's store is a convenience, never a guarantee: a profile with storage disabled throws on
 * ACCESS, a full store throws on write, and a store another shape wrote holds text that is not JSON.
 * None of these is a fault of anybody's and none may take a screen down, so each is answered here, in
 * the one place, as "nothing kept" — the DataTable's own furniture store's ruling (`table-state.ts`).
 */

/** The tab's store, where the browser offers one. */
export function tabStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // Storage disabled throws on access: the screen keeps nothing, and loses nothing it had.
    return null;
  }
}

/** The JSON value kept under a key, or null where nothing readable is kept there. */
export function readKept(storage: Storage | null, key: string): unknown {
  if (storage === null) return null;
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    // Text another shape wrote, or a store that refuses the read: nothing readable is kept.
    return null;
  }
}

/** Keep a value under a key, or take the key away where the value is null. A store that refuses is not a fault. */
export function writeKept(storage: Storage | null, key: string, value: unknown): void {
  if (storage === null) return;
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or refused store keeps the value for this page only; the reader loses nothing on it.
  }
}

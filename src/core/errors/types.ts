/**
 * What a refusal is, before any module says which ones it has (R-SPINE-062).
 *
 * "Every code has an English message, a remedy hint, a severity and a surface hint" — the
 * four fields below plus the code itself, and nothing else. The severity and surface sets are
 * closed here: L-QTY-04 says "reason codes are closed enums, never prose", and an enum whose
 * members can be invented at the call site is prose with a type annotation. Widening either
 * set is a spec revision, never an in-session edit.
 */

/** How hard a refusal bites: it stops the work, holds it for a human, or only says so. */
export type RefusalSeverity = 'block' | 'defer' | 'warn';

/** Where a reader is expected to meet it. A hint for the surface, not the surface itself. */
export type RefusalSurface = 'field' | 'toast' | 'page' | 'log';

/** One member of the taxonomy. Exactly five fields, all required, no extras. */
export interface RefusalEntry {
  /** The code, repeated inside its own row so an entry read alone still knows its name. */
  readonly code: string;
  /** English, and a sentence: what was refused, in words a reader can act on. */
  readonly message: string;
  /** English, and a sentence: what to do about it. */
  readonly remedy: string;
  readonly severity: RefusalSeverity;
  readonly surface: RefusalSurface;
}

/**
 * A module registry: codes to entries, where every entry's `code` is the key it is filed
 * under. The constraint is what makes that a compile error rather than a test failure — `K`
 * is each key in turn, so an entry filed under the wrong name does not type-check.
 *
 * Written as a function because inference is what carries the literal key types through: a
 * plain annotation would widen the keys to `string` and take `RefusalCode` with it.
 */
export function registry<T extends { readonly [K in keyof T]: RefusalEntry & { readonly code: K } }>(
  entries: T,
): T {
  return entries;
}

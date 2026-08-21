/**
 * The typed string table (R-SPINE-060), composed.
 *
 * "Every user-facing string lives in one typed string table (`src/ui/strings.ts` per module)
 * keyed by id with English values; the compiler refuses a missing key." Read as one composed
 * table here folding a per-module table under `src/ui/strings/` — the same fold
 * `src/core/errors.ts` performs over `src/core/errors/`, and for the same reason: a table
 * kept in one flat file is a file every module edits and nobody owns. The barrel composes and
 * adds nothing, which is why it imports from `./strings/` and from nothing else.
 *
 * The compiler's refusal is `StringKey`: it is derived from the table rather than declared
 * beside it, so a key cannot exist as a type without a value to go with it, and `t()` takes
 * that type rather than `string`. A key nobody registered is a compile error at the call site
 * — not a lookup that quietly returns undefined and paints a blank label.
 *
 * Not a translation system: English values today, and one place for a second language to land
 * when there is one.
 */
import { SPINE_STRINGS } from './strings/spine';

/** Every registered string, by key. One module table today; the fold is the same for n. */
export const STRINGS = Object.freeze({ ...SPINE_STRINGS });

/** The closed key set: exactly the keys the table above carries. */
export type StringKey = keyof typeof STRINGS;

/** Read one string. The only reader — the table itself stays where it is. */
export function t(key: StringKey): string {
  return STRINGS[key];
}

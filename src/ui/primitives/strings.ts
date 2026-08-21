/**
 * The primitives module's string table (R-SPINE-060).
 *
 * "Every user-facing string lives in one typed string table (`src/ui/strings.ts` per module)
 * keyed by id with English values; the compiler refuses a missing key; no string literals in
 * JSX except test ids and codes." This is that table for `src/ui/primitives/**`, written the
 * way `src/ui/strings.ts` composes its module tables: a frozen record of `id → English`, a key
 * type derived from the record rather than declared beside it, and one reader that takes the
 * derived type so a key nobody registered is a compile error at the call site.
 *
 * Every value here is decided in docs/design/datum-primitives.md and quoted verbatim there
 * (AM-03 (2): "Copy is design: product voice is decided in the Design Decision, never
 * improvised by a builder"). A primitive that needs a new word adds it to the document first.
 *
 * Frozen, as the other tables are: a table an importer can edit at run time is a default, not
 * a decision.
 */
export const PRIMITIVES_STRINGS = Object.freeze({
  /** The Combobox while its loader is out — a pending request, never "no matches". */
  'primitives.combobox.loading': 'Searching…',
  /** The Combobox when the loader resolved to nothing for what was typed. */
  'primitives.combobox.empty': 'No matches for this search.',
  /** The name of a Dialog's own close control when it is rendered as an icon. */
  'primitives.dialog.close': 'Close',
  /** The same control on a Sheet; a separate key so the two can diverge without a rename. */
  'primitives.sheet.close': 'Close',
  /** The name of a Tag's remove control, followed by the tag's own words. */
  'primitives.tag.remove': 'Remove',
  /** The name of the region toasts are announced in. */
  'primitives.toast.region': 'Notifications',
} as const);

/** The closed key set: exactly the keys the table above carries. */
export type PrimitiveStringKey = keyof typeof PRIMITIVES_STRINGS;

/** Read one string. The only reader — the table itself stays where it is. */
export function ts(key: PrimitiveStringKey): string {
  return PRIMITIVES_STRINGS[key];
}

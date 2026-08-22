/**
 * The data module's string table (R-SPINE-060).
 *
 * "Every user-facing string lives in one typed string table (`src/ui/strings.ts` per module)
 * keyed by id with English values; the compiler refuses a missing key; no string literals in
 * JSX except test ids and codes." This is that table for `src/ui/data/**`, typed exactly as
 * `src/ui/primitives/strings.ts` types its own: a frozen record of `id → English`, a key type
 * derived from the record, and one reader that takes the derived type so a key nobody
 * registered is a compile error at the call site.
 *
 * Every value is decided in docs/design/datum-patterns.md §10 and quoted there verbatim
 * (AM-03 (2): copy is design). A value with a `{slot}` is a template — `fill` below puts the
 * one thing that varies into it, because a sentence assembled from loose words is a sentence
 * no translator can move.
 */
export const DATA_STRINGS = Object.freeze({
  /** The name of one row's selection control; the slot carries that row's own id. */
  'data.table.selectRow': 'Select row {id}',
  /** The name of a collapsed group's chevron. */
  'data.table.expandGroup': 'Expand group',
  /** The same control once the group is open. */
  'data.table.collapseGroup': 'Collapse group',
  /** The name of a column's resize handle; the slot carries the column's own label. */
  'data.table.resize': 'Resize column {column}',
  /** The word between the two counts a CoverageChip enumerates. */
  'data.coverage.of': 'of',
} as const);

/** The closed key set: exactly the keys the table above carries. */
export type DataStringKey = keyof typeof DATA_STRINGS;

/** Read one string. The only reader — the table itself stays where it is. */
export function ds(key: DataStringKey): string {
  return DATA_STRINGS[key];
}

/** Put `value` in a template's `{slot}`. The sentence stays the table's; only the slot moves. */
export function fill(key: DataStringKey, slot: string, value: string): string {
  return ds(key).replace(`{${slot}}`, value);
}

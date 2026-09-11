/**
 * The column state a reader owns, kept per user and per table (Design Direction 00 §5 rule 3:
 * "column pin/resize/sort/visibility persisted per user per table id").
 *
 * THE STORAGE KEY FORMAT — one line, so no consumer has to guess it:
 *
 *     cubit.datatable.v1:<tableId>
 *
 * `cubit` names the product, `datatable` the instrument, `v1` the payload version (a payload
 * written by a later shape is refused rather than half-read, which is what the version is FOR), and
 * `<tableId>` is the required `tableId` prop. "Per user" is the browser profile's own
 * `localStorage`: this seam holds a reader's furniture, never a fact of the register, so it never
 * travels to the server and a second person on the same screen never inherits it.
 *
 * Every read is total: a payload that is absent, unparseable, of another version, or of the right
 * version and the wrong shape all answer the SAME empty state. A table whose furniture cannot be
 * read is a table with default furniture — never a screen that throws (R-UI-050, ARCH-03).
 */

/** The payload version this module writes and the only one it reads. */
export const DATA_TABLE_STATE_VERSION = 1;

/** `cubit.datatable.v1:` — the prefix every key carries, spelled once (B-17). */
export const DATA_TABLE_STATE_PREFIX = `cubit.datatable.v${DATA_TABLE_STATE_VERSION}:`;

/** The one key a table's furniture lives at. */
export function dataTableStorageKey(tableId: string): string {
  return `${DATA_TABLE_STATE_PREFIX}${tableId}`;
}

/** One column's sort, in TanStack's own vocabulary so nothing translates on the way in or out. */
export interface DataTableSortEntry {
  readonly id: string;
  readonly desc: boolean;
}

/** The four furnishings §5 rule 3 names, plus the collapsed groups rule 4 asks to be remembered. */
export interface DataTableColumnState {
  readonly sizes: Readonly<Record<string, number>>;
  readonly pinned: { readonly left: readonly string[]; readonly right: readonly string[] };
  readonly sorting: readonly DataTableSortEntry[];
  readonly hidden: readonly string[];
  readonly collapsed: readonly string[];
}

/** What a table with no remembered furniture stands at — and what a corrupt payload falls back to. */
export const EMPTY_COLUMN_STATE: DataTableColumnState = Object.freeze({
  sizes: Object.freeze({}),
  pinned: Object.freeze({ left: Object.freeze([]), right: Object.freeze([]) }),
  sorting: Object.freeze([]),
  hidden: Object.freeze([]),
  collapsed: Object.freeze([]),
}) as DataTableColumnState;

/**
 * The two methods this seam uses, so a test hands in a plain object and the component never reaches
 * for a global it cannot have on the server (B-17).
 */
export interface DataTableStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's own store, where there is one; `null` on the server and in a locked-down profile. */
export function defaultStorage(): DataTableStorage | null {
  try {
    if (typeof window === "undefined" || window.localStorage === null) return null;
    return window.localStorage;
  } catch {
    // A profile with storage disabled throws on ACCESS, not on use: the table keeps its defaults.
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Every string of an array, or `[]` — a member of another type takes the whole field with it. */
function strings(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.every((member) => typeof member === "string") ? (value as string[]) : [];
}

/** Every finite positive pixel width of a record, dropping any entry that is not one. */
function sizes(value: unknown): Readonly<Record<string, number>> {
  if (!isRecord(value)) return {};
  const kept: Record<string, number> = {};
  for (const [id, width] of Object.entries(value)) {
    if (typeof width === "number" && Number.isFinite(width) && width > 0) kept[id] = width;
  }
  return kept;
}

function sorting(value: unknown): readonly DataTableSortEntry[] {
  if (!Array.isArray(value)) return [];
  const kept: DataTableSortEntry[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return [];
    if (typeof entry.id !== "string" || typeof entry.desc !== "boolean") return [];
    kept.push({ id: entry.id, desc: entry.desc });
  }
  return kept;
}

function pinned(value: unknown): DataTableColumnState["pinned"] {
  if (!isRecord(value)) return EMPTY_COLUMN_STATE.pinned;
  return { left: strings(value.left), right: strings(value.right) };
}

/**
 * The furniture at this table id, or the empty state. Total by construction: the only `JSON.parse`
 * in this module is inside the `try`, and every field is judged on its own, so a payload that has
 * lost one field keeps the others rather than being thrown away whole.
 */
export function readColumnState(storage: DataTableStorage | null, tableId: string): DataTableColumnState {
  if (storage === null || tableId === "") return EMPTY_COLUMN_STATE;
  let parsed: unknown;
  try {
    const raw = storage.getItem(dataTableStorageKey(tableId));
    if (raw === null) return EMPTY_COLUMN_STATE;
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_COLUMN_STATE;
  }
  if (!isRecord(parsed) || parsed.v !== DATA_TABLE_STATE_VERSION) return EMPTY_COLUMN_STATE;
  return {
    sizes: sizes(parsed.sizes),
    pinned: pinned(parsed.pinned),
    sorting: sorting(parsed.sorting),
    hidden: strings(parsed.hidden),
    collapsed: strings(parsed.collapsed),
  };
}

/** The furniture, written back. A store that refuses the write (quota, private mode) is not a fault. */
export function writeColumnState(storage: DataTableStorage | null, tableId: string, state: DataTableColumnState): void {
  if (storage === null || tableId === "") return;
  try {
    storage.setItem(dataTableStorageKey(tableId), JSON.stringify({ v: DATA_TABLE_STATE_VERSION, ...state }));
  } catch {
    // Nothing to say: the reader's furniture is a convenience, and the table is already drawn.
  }
}

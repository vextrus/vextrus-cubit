"use client";
/**
 * DataTable v2 — the one grid (Design Direction 00 §5, R-UI-005, R-UI-010, R-UI-012).
 *
 * TanStack Table over TanStack Virtual: past 200 rows it renders a window into a scroll container
 * that spans the whole list, so a register of any length costs one screenful, and it publishes what
 * it drew as `data-rows-rendered` beside `data-virtualised` — the pair the journey lane's
 * `settled()` reads to know the grid has stopped arriving (tests/e2e/support/settled.ts).
 *
 * DENSITY IS THE ROOT'S, NOT THE TABLE'S (§4.2, §5 rule 1). Every height and every padding here is
 * a read of `--row-h`, `--cell-px`, `--cell-py`, `--text-body` — the tokens `[data-density]` on the
 * app root revalues. `data.css` authors no `[data-density]` selector and reads neither
 * `--row-comfortable` nor `--row-compact`: a second home for the switch is exactly the fault that
 * left those tokens dead letters. The `density` prop below does not override a screen — it scopes a
 * density REGION (the gallery shows both at once), and the attribute it reflects is the same one
 * the root carries, so the same root rules revalue the same tokens inside it.
 *
 * The virtualiser is the one place that needs density as a NUMBER, because a viewBox of scroll
 * extent cannot be a custom property. It reads the computed `--row-h` off its own element first and
 * falls back to the nearest `[data-density]` attribute against the committed token table, so the
 * stylesheet and the estimate are the same instrument read twice, never two transcriptions.
 *
 * The filter fields and the inline cell editor are the shipped core Input, the truncation hint is
 * the shipped core Tooltip, the ENTERED mark is the one glyph table and the loading bones are the
 * shipped Skeleton: a table that re-implements a shipped primitive is the copy B-17 forbids.
 */
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnPinningState,
  type ColumnSizingState,
  type Header,
  type Row,
  type RowData,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { lightTokens } from "../../tokens";
import { BASIS_GLYPHS } from "../core/basis";
import { cx } from "../core/class-names";
import { Input } from "../core/input";
import { Skeleton } from "../core/skeleton";
import { Tooltip } from "../core/tooltip";
import {
  EMPTY_COLUMN_STATE,
  defaultStorage,
  readColumnState,
  writeColumnState,
  type DataTableColumnState,
  type DataTableStorage,
} from "./table-state";
import { TESTIDS } from "@/ui/testids";

export type DataTableDensity = "comfortable" | "compact";

/** What a column may tell the table about itself beyond its accessor. */
export interface DataTableColumnMeta {
  align?: "right";
  filterable?: boolean;
  /**
   * §5 rule 7's act law, as a per-column predicate: only a column that says so may be edited in
   * place. A measured or derived column says nothing and is read-only, with its Trace.
   */
  editable?: boolean;
  /**
   * The edit IS an act: the table commits nothing itself, it hands the entered value to
   * `onCellCommit` with `act: true` so the screen can open the one ConsequenceDialog over it.
   */
  act?: boolean;
}

/**
 * TanStack parameterises `ColumnMeta` by the row type and the cell-value type of the column it
 * describes, and a merged declaration has to repeat that parameter list exactly. None of the facts
 * above depends on either type, so the two are carried in type position and contribute no member.
 */
type ColumnTypesCarried<TData extends RowData, TValue> = { readonly [K in never]: (row: TData) => TValue };

/**
 * The table's column meta IS TanStack's `ColumnMeta` (B-17): the library ships an empty interface
 * for a host to fill, so filling it here makes a column fact the table does not define a compile
 * error at every call site, and leaves no shape for a caller to cast past.
 */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> extends DataTableColumnMeta, ColumnTypesCarried<TData, TValue> {}
}

export interface DataTableColumnPinning {
  left?: string[];
  right?: string[];
}

/** One group header row's identity: the key it is remembered by, and the words it reads. */
export interface DataTableGroupKey {
  readonly key: string;
  readonly label: string;
}

/** One subtotal of a group: a figure already written by the consumer, and the unit it is in. */
export interface DataTableSubtotal {
  readonly value: string;
  readonly unit: string;
}

/**
 * §5 rule 4's grouping. `of` says which group a row belongs to; the subtotals are either the
 * consumer's own or, given a figure and a unit per row, the built-in sum — exact, per unit, and
 * never through a float (B-07).
 */
export interface DataTableGroup<TRow> {
  readonly of: (row: TRow) => DataTableGroupKey | null;
  readonly valueOf?: (row: TRow) => string | null;
  readonly unitOf?: (row: TRow) => string;
  readonly subtotal?: (rows: readonly TRow[]) => readonly DataTableSubtotal[];
}

/** §5 rule 8's row states, as the row itself answers them. Selection is the table's own. */
export interface DataTableRowState {
  /** The row is shown with a ⚠ and its refusal beneath it — a refused row is never hidden. */
  readonly refused?: boolean;
  /** The row is stale: muted, and the sentence that says why, on hover and on focus. */
  readonly stale?: string;
}

/** What a commit carries out of the table (§5 rule 7). The table itself commits nothing. */
export interface DataTableCellCommit {
  readonly tableId: string;
  readonly rowId: string;
  readonly columnId: string;
  readonly value: string;
  /** The column declared `meta.act`: this goes through ConsequenceDialog, not straight to a store. */
  readonly act: boolean;
}

export interface DataTableProps<TRow> {
  /**
   * The identity the reader's furniture is remembered under — `cubit.datatable.v1:<tableId>`
   * (see table-state.ts). Required, because a table that persists column state under no name would
   * share one drawer with every other table on the screen.
   */
  tableId: string;
  columns: ColumnDef<TRow, unknown>[];
  data: TRow[];
  getRowId: (row: TRow, index: number) => string;
  /**
   * A density REGION, not a per-screen override (§5 rule 1). Left out — the normal case — the
   * table inherits the root's density like every other component.
   */
  density?: DataTableDensity;
  columnPinning?: DataTableColumnPinning;
  /** §5 rule 3's frozen key column: the first column is pinned left unless the caller says not to. */
  freezeKeyColumn?: boolean;
  onCellEdit?: (rowId: string, columnId: string, value: string) => void;
  /** §5 rule 7's seam: every committed edit, act or not, leaves through here. */
  onCellCommit?: (commit: DataTableCellCommit) => void;
  /** §5 rule 10: selection rises to the shell inspector. The table owns no inspector of its own. */
  onRowSelect?: (rowIds: readonly string[]) => void;
  group?: DataTableGroup<TRow>;
  rowStateOf?: (row: TRow, rowId: string) => DataTableRowState | undefined;
  /** The refusal drawn beneath a refused row — a RefusalState the consumer renders (ARCH-01). */
  renderRefusal?: (row: TRow, rowId: string) => ReactNode;
  /** §5 rule 1's sticky footer, by column id. Absent totals, there is no footer at all. */
  totals?: Readonly<Record<string, ReactNode>>;
  /**
   * The id a migrated table's rows already published, kept byte-identical. A raw `<table>` that
   * becomes this grid must go on answering to the ids its rows were written with, or every test
   * and every journey that named one is broken by a change that was meant to be invisible to them.
   * Left out, a row is `datatable-row` — the closed contract's own id.
   */
  rowTestId?: string;
  /** The `data-*` a migrated row published beside its id (`data-param=<key>`), kept verbatim. */
  rowDataOf?: (row: TRow, rowId: string) => Readonly<Record<string, string>>;
  /** The grid's accessible name, by either of R-UI-012's two routes. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** §5 rule 8's loading state: bones that keep the row height, and the header already real. */
  loading?: boolean;
  loadingRows?: number;
  className?: string;
  /**
   * A row the caller needs a reader to be able to reach — putting focus back where Back came from,
   * say. The table scrolls to it AND draws it whether or not its window has reached it, so a
   * consumer never reads this component's insides to find a row it can already name (B-17).
   */
  scrollToRowId?: string;
  /** The store the reader's furniture lives in; the browser's own unless a test hands in another. */
  storage?: DataTableStorage | null;
}

/** A density token's pixel length, as a number the virtualiser can measure in. */
function rowHeightOf(token: "--row-comfortable" | "--row-compact"): number {
  const px = Number.parseInt(lightTokens[token] ?? "", 10);
  if (Number.isNaN(px)) throw new Error(`${token} is not a pixel length (R-UI-005)`);
  return px;
}

/**
 * R-UI-005's two row heights, in px, read from the token table the stylesheet is generated from
 * rather than transcribed beside it (B-17). The stylesheet never names them: it reads `--row-h`.
 */
export const ROW_HEIGHT_PX: Readonly<Record<DataTableDensity, number>> = Object.freeze({
  comfortable: rowHeightOf("--row-comfortable"),
  compact: rowHeightOf("--row-compact"),
});

/** Compact is the default, at the root and here (§4.2). */
const DEFAULT_DENSITY: DataTableDensity = "compact";

const DEFAULT_COLUMN_WIDTH_PX = 150;
const OVERSCAN_ROWS = 8;
/** §5 rule 9: past this many rows the list is a window. Below it, every row is in the document. */
export const VIRTUALISE_ABOVE_ROWS = 200;
/** What one arrow press moves a column edge by, for a resize done on the keyboard (R-UI-012). */
const RESIZE_STEP_PX = 8;
const MIN_COLUMN_WIDTH_PX = 48;

const metaOf = (column: { columnDef: { meta?: DataTableColumnMeta } }): DataTableColumnMeta => column.columnDef.meta ?? {};

/**
 * A column header as text, for the accessible names the filter, the editor and the resize handle
 * owe (R-UI-012). A header may be a render function or an element, and neither stringifies into
 * anything a screen reader can use — the column id is the honest fallback.
 */
function headerText(column: { id: string; columnDef: { header?: unknown } }): string {
  const label = column.columnDef.header;
  if (typeof label === "string") return label;
  return column.id;
}

/**
 * The row height the virtualiser must estimate in, taken from the DOM the stylesheet drew: the
 * computed `--row-h` where the browser resolves it, else the density the nearest `[data-density]`
 * states, else compact. The custom property is asked for first so that a root which revalues
 * `--row-h` alone — without the attribute — is still measured correctly.
 */
export function resolveRowHeightPx(element: Element | null): number {
  if (element === null) return ROW_HEIGHT_PX[DEFAULT_DENSITY];
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    const declared = window.getComputedStyle(element).getPropertyValue("--row-h").trim();
    const px = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(declared);
    if (px !== null) return Number(px[1]);
  }
  const stated = element.closest("[data-density]")?.getAttribute("data-density");
  if (stated === "comfortable" || stated === "compact") return ROW_HEIGHT_PX[stated];
  return ROW_HEIGHT_PX[DEFAULT_DENSITY];
}

/* ------------------------------------------------------------------ exact subtotals (B-07) */

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

/**
 * Two decimal strings added exactly. Money and quantity never touch a float in this tree (B-07), so
 * the two figures are scaled to a common fraction length and added as integers.
 */
export function addDecimal(left: string, right: string): string {
  const a = DECIMAL.exec(left.trim());
  const b = DECIMAL.exec(right.trim());
  if (a === null || b === null) return left;
  const scale = Math.max((a[3] ?? "").length, (b[3] ?? "").length);
  const widen = (parts: RegExpExecArray): bigint => {
    const fraction = (parts[3] ?? "").padEnd(scale, "0");
    const magnitude = BigInt(`${parts[2] ?? "0"}${fraction}`);
    return parts[1] === "-" ? -magnitude : magnitude;
  };
  const sum = widen(a) + widen(b);
  const sign = sum < 0n ? "-" : "";
  const digits = (sum < 0n ? -sum : sum).toString().padStart(scale + 1, "0");
  if (scale === 0) return `${sign}${digits}`;
  return `${sign}${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
}

/** §5 rule 4's subtotals: one figure per unit, in the order the units first appear. */
export function subtotalsByUnit<TRow>(
  rows: readonly TRow[],
  valueOf: (row: TRow) => string | null,
  unitOf: (row: TRow) => string,
): readonly DataTableSubtotal[] {
  const order: string[] = [];
  const sums = new Map<string, string>();
  for (const row of rows) {
    const value = valueOf(row);
    if (value === null || value === "") continue;
    const unit = unitOf(row);
    const held = sums.get(unit);
    if (held === undefined) {
      order.push(unit);
      sums.set(unit, value);
    } else {
      sums.set(unit, addDecimal(held, value));
    }
  }
  return order.map((unit) => ({ unit, value: sums.get(unit) ?? "" }));
}

/* ------------------------------------------------------------------ the body's flat item list */

type BodyItem<TRow> =
  | { kind: "group"; id: string; label: string; count: number; subtotals: readonly DataTableSubtotal[] }
  | { kind: "row"; id: string; row: Row<TRow>; dataIndex: number };

/**
 * The rows to draw, in document order, with a group header before each run of them. The group's
 * count and subtotals are taken over the rows the group actually HAS, not over the ones a collapsed
 * group happens to be showing — a subtotal that changed when you folded a group would be a lie.
 */
function bodyItemsOf<TRow>(
  rows: readonly Row<TRow>[],
  group: DataTableGroup<TRow> | undefined,
  collapsed: ReadonlySet<string>,
): { items: BodyItem<TRow>[]; dataRows: Row<TRow>[] } {
  if (group === undefined) {
    const items = rows.map<BodyItem<TRow>>((row, index) => ({ kind: "row", id: row.id, row, dataIndex: index }));
    return { items, dataRows: [...rows] };
  }
  const order: DataTableGroupKey[] = [];
  const members = new Map<string, Row<TRow>[]>();
  for (const row of rows) {
    const key = group.of(row.original) ?? { key: "", label: "" };
    const held = members.get(key.key);
    if (held === undefined) {
      order.push(key);
      members.set(key.key, [row]);
    } else {
      held.push(row);
    }
  }
  const items: BodyItem<TRow>[] = [];
  const dataRows: Row<TRow>[] = [];
  for (const key of order) {
    const held = members.get(key.key) ?? [];
    const originals = held.map((row) => row.original);
    const subtotals =
      group.subtotal !== undefined
        ? group.subtotal(originals)
        : group.valueOf !== undefined && group.unitOf !== undefined
          ? subtotalsByUnit(originals, group.valueOf, group.unitOf)
          : [];
    items.push({ kind: "group", id: key.key, label: key.label, count: held.length, subtotals });
    if (collapsed.has(key.key)) continue;
    for (const row of held) {
      items.push({ kind: "row", id: row.id, row, dataIndex: dataRows.length });
      dataRows.push(row);
    }
  }
  return { items, dataRows };
}

/* ------------------------------------------------------------------------------- the table */

export function DataTable<TRow>({
  tableId,
  columns,
  data,
  getRowId,
  density,
  columnPinning,
  freezeKeyColumn = true,
  onCellEdit,
  onCellCommit,
  onRowSelect,
  group,
  rowStateOf,
  renderRefusal,
  totals,
  rowTestId = "datatable-row",
  rowDataOf,
  loading = false,
  loadingRows = 8,
  className,
  scrollToRowId,
  storage,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: DataTableProps<TRow>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  /* ----------------------------------------------------- the reader's furniture (§5 rule 3) */

  /**
   * The store is resolved once, and only in the browser: reading `localStorage` during render
   * would make the server's first paint and the client's differ, which is a hydration fault
   * dressed as a preference.
   */
  const [store, setStore] = useState<DataTableStorage | null>(null);
  const [furniture, setFurniture] = useState<DataTableColumnState>(EMPTY_COLUMN_STATE);
  const restored = useRef(false);

  useEffect(() => {
    const resolved = storage === undefined ? defaultStorage() : storage;
    setStore(resolved);
    setFurniture(readColumnState(resolved, tableId));
    restored.current = true;
  }, [storage, tableId]);

  // Written back only after the restore, so the first render never overwrites what is remembered
  // with the defaults it was drawn from.
  useEffect(() => {
    if (!restored.current) return;
    writeColumnState(store, tableId, furniture);
  }, [store, tableId, furniture]);

  const remember = useCallback((change: Partial<DataTableColumnState>): void => {
    setFurniture((held) => ({ ...held, ...change }));
  }, []);

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Sorting and filtering are per-column opt-ins: a column earns its sort control from
  // `enableSorting` and its filter field from `meta.filterable`, never by default.
  const tableColumns = useMemo<ColumnDef<TRow, unknown>[]>(
    () =>
      columns.map((column) => ({
        ...column,
        enableSorting: column.enableSorting === true,
        enableColumnFilter: column.meta?.filterable === true,
      })),
    [columns],
  );

  /** §5 rule 3: the key column is the first one, frozen, unless the caller pinned its own set. */
  const firstColumnId = columns[0]?.id ?? "";
  const pinning = useMemo<ColumnPinningState>(() => {
    const left = [...(columnPinning?.left ?? []), ...furniture.pinned.left];
    if (freezeKeyColumn && firstColumnId !== "" && !left.includes(firstColumnId)) left.unshift(firstColumnId);
    const right = [...(columnPinning?.right ?? []), ...furniture.pinned.right].filter((id) => !left.includes(id));
    return { left, right };
  }, [columnPinning, furniture.pinned, freezeKeyColumn, firstColumnId]);

  const sorting = useMemo<SortingState>(() => furniture.sorting.map((entry) => ({ ...entry })), [furniture.sorting]);
  const columnSizing = useMemo<ColumnSizingState>(() => ({ ...furniture.sizes }), [furniture.sizes]);
  const columnVisibility = useMemo<VisibilityState>(
    () => Object.fromEntries(furniture.hidden.map((id) => [id, false])),
    [furniture.hidden],
  );
  const collapsed = useMemo(() => new Set(furniture.collapsed), [furniture.collapsed]);

  const table = useReactTable<TRow>({
    data,
    columns: tableColumns,
    getRowId,
    state: { sorting, columnFilters, columnPinning: pinning, columnSizing, columnVisibility },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      remember({ sorting: next.map((entry) => ({ id: entry.id, desc: entry.desc })) });
    },
    onColumnSizingChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnSizing) : updater;
      remember({ sizes: { ...next } });
    },
    onColumnFiltersChange: setColumnFilters,
    // Ascending first and removable, so the control cycles ascending → descending → none.
    sortDescFirst: false,
    enableSortingRemoval: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: { size: DEFAULT_COLUMN_WIDTH_PX, minSize: MIN_COLUMN_WIDTH_PX },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const { items, dataRows } = useMemo(() => bodyItemsOf(rows, group, collapsed), [rows, group, collapsed]);
  const leafColumns = table.getAllLeafColumns();
  const visibleColumns = table.getVisibleLeafColumns();

  /* ------------------------------------------------------------- the geometry (§5 rule 1, 9) */

  const [rowHeight, setRowHeight] = useState<number>(ROW_HEIGHT_PX[density ?? DEFAULT_DENSITY]);
  /** The grid itself — the element the density region, where there is one, is stated on. */
  const rootRef = useRef<HTMLDivElement | null>(null);

  // The height is the stylesheet's; this only READS it, and re-reads it whenever the density the
  // root states changes underneath (R-UI-005's switch, which is one attribute at the root).
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    const settle = (): void => setRowHeight(resolveRowHeightPx(root));
    settle();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(settle);
    for (let node: Element | null = root; node !== null; node = node.parentElement) {
      observer.observe(node, { attributes: true, attributeFilter: ["data-density", "style"] });
    }
    return () => observer.disconnect();
  }, [density]);

  /** §5 rule 9: a window past 200 rows. Group rows and refusal notes lay out in flow, so a table
      that draws either is not windowed — a virtualiser needs every row to be one height. */
  const virtualised = items.length > VIRTUALISE_ABOVE_ROWS && group === undefined && renderRefusal === undefined && !loading;

  const virtualizer = useVirtualizer({
    count: virtualised ? dataRows.length : 0,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN_ROWS,
  });

  // The virtualiser caches its measurements and does not watch `estimateSize`, so a density change
  // would otherwise leave every row sitting at the old offset over the old scroll extent.
  const measuredRowHeight = useRef<number | null>(null);
  useEffect(() => {
    if (measuredRowHeight.current !== null && measuredRowHeight.current !== rowHeight) virtualizer.measure();
    measuredRowHeight.current = rowHeight;
  }, [virtualizer, rowHeight]);

  /**
   * The row a caller asked to be reachable, by position. Everything below is keyed on the position
   * rather than the id, so a sort or a filter that moves the row moves the answer with it.
   */
  const askedIndex = scrollToRowId === undefined ? -1 : dataRows.findIndex((row) => row.id === scrollToRowId);

  /** The row already travelled to, so the journey is made once per row asked for and not once per
      position it happens to be at. Sorting and filtering MOVE a row; they do not re-ask for it. */
  const travelledTo = useRef<string | null>(null);
  useEffect(() => {
    if (scrollToRowId === undefined) {
      travelledTo.current = null;
      return;
    }
    if (askedIndex < 0 || travelledTo.current === scrollToRowId) return;
    travelledTo.current = scrollToRowId;
    if (virtualised) virtualizer.scrollToIndex(askedIndex, { align: "start" });
  }, [virtualizer, askedIndex, scrollToRowId, virtualised]);

  /**
   * What the body draws: every item when the list is short, and the virtualiser's window plus the
   * asked-for row when it is long. The addition is what makes `scrollToRowId` an answer rather than
   * a request — scrolling a box is asynchronous, and a caller owed a row would otherwise be owed it
   * forever.
   */
  const placed = ((): { item: BodyItem<TRow>; offset: number | null }[] => {
    // Computed in render, never memoised: the virtualiser is one stable object that re-renders this
    // component when its window moves, so a memo keyed on it would hand back the window the table
    // had before it had measured anything — an empty list, forever.
    if (!virtualised) return items.map((item) => ({ item, offset: null }));
    const window = virtualizer.getVirtualItems().map((virtual) => ({ index: virtual.index, start: virtual.start }));
    const drawn =
      askedIndex < 0 || window.some((entry) => entry.index === askedIndex)
        ? window
        : [...window, { index: askedIndex, start: askedIndex * rowHeight }].sort((left, right) => left.index - right.index);
    return drawn.flatMap((entry) => {
      const item = items[entry.index];
      return item === undefined ? [] : [{ item, offset: entry.start }];
    });
  })();

  /* ------------------------------------------------------- the cell cursor (§5 rule 6, R-UI-012) */

  const [cursor, setCursor] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  /** Whether the cursor owns DOM focus: set by a gesture, never on mount — a table does not steal. */
  const [cursorFocused, setCursorFocused] = useState(false);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const anchor = useRef<number>(0);

  const lastRow = Math.max(dataRows.length - 1, 0);
  const lastCol = Math.max(visibleColumns.length - 1, 0);
  const clamped = { row: Math.min(cursor.row, lastRow), col: Math.min(cursor.col, lastCol) };

  const select = useCallback(
    (ids: readonly string[]): void => {
      setSelection(ids);
      onRowSelect?.(ids);
    },
    [onRowSelect],
  );

  const moveCursor = useCallback(
    (row: number, col: number, extend: boolean): void => {
      const nextRow = Math.min(Math.max(row, 0), lastRow);
      const nextCol = Math.min(Math.max(col, 0), lastCol);
      setCursor({ row: nextRow, col: nextCol });
      setCursorFocused(true);
      if (virtualised) virtualizer.scrollToIndex(nextRow);
      if (!extend) {
        anchor.current = nextRow;
        return;
      }
      const from = Math.min(anchor.current, nextRow);
      const to = Math.max(anchor.current, nextRow);
      select(dataRows.slice(from, to + 1).map((row) => row.id));
    },
    [lastRow, lastCol, virtualised, virtualizer, dataRows, select],
  );

  /**
   * §5 rule 6, in one place: arrows move the cell cursor, Tab moves to the next cell, Space selects
   * the row, ⇧ extends the range, Home/End reach the ends. Enter and Escape belong to the cell that
   * is being edited and are handled there; a cell that cannot be edited lets Enter through to the
   * consumer's own handler rather than swallowing it.
   */
  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented) return;
    const { row, col } = clamped;
    const extend = event.shiftKey;
    switch (event.key) {
      case "ArrowDown":
        moveCursor(row + 1, col, extend);
        break;
      case "ArrowUp":
        moveCursor(row - 1, col, extend);
        break;
      case "ArrowRight":
        moveCursor(row, col + 1, false);
        break;
      case "ArrowLeft":
        moveCursor(row, col - 1, false);
        break;
      case "Home":
        moveCursor(event.ctrlKey ? 0 : row, 0, false);
        break;
      case "End":
        moveCursor(event.ctrlKey ? lastRow : row, lastCol, false);
        break;
      case "Tab":
        if (event.shiftKey) {
          if (row === 0 && col === 0) return;
          moveCursor(col === 0 ? row - 1 : row, col === 0 ? lastCol : col - 1, false);
        } else {
          if (row === lastRow && col === lastCol) return;
          moveCursor(col === lastCol ? row + 1 : row, col === lastCol ? 0 : col + 1, false);
        }
        break;
      case " ": {
        const hit = dataRows[row];
        if (hit === undefined) return;
        anchor.current = row;
        select(selection.length === 1 && selection[0] === hit.id ? [] : [hit.id]);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  const headerGroups = table.getHeaderGroups();
  const filterable = leafColumns.some((column) => column.getCanFilter());
  // Every row the user can reach, header rows included: the filter row is one of them, and after a
  // filter the reachable body rows are the surviving ones, not the whole data prop (R-UI-012).
  const headerRowCount = headerGroups.length * (filterable ? 2 : 1);
  const footerCells = totals === undefined ? null : visibleColumns;
  const drawnRowCount = loading ? loadingRows : placed.length;

  /* -------------------------------------------------------------- the column chooser (§5 rule 3) */

  const [chooserOpen, setChooserOpen] = useState(false);
  const toggleColumn = (id: string, visible: boolean): void => {
    const hidden = new Set(furniture.hidden);
    if (visible) hidden.delete(id);
    else hidden.add(id);
    remember({ hidden: [...hidden] });
  };
  const togglePin = (id: string, pinned: boolean): void => {
    const left = furniture.pinned.left.filter((held) => held !== id);
    remember({ pinned: { left: pinned ? [...left, id] : left, right: furniture.pinned.right } });
  };
  const toggleGroup = (key: string): void => {
    const next = new Set(furniture.collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    remember({ collapsed: [...next] });
  };

  return (
    <div className={cx("cx-table-frame", className)}>
      <div
        className="cx-table"
        ref={rootRef}
        data-testid={TESTIDS.datatable.root}
        data-table-id={tableId}
        data-density={density}
        data-virtualised={virtualised ? "true" : undefined}
        /* §5 rule 9 — the count the journey lane's settled() polls for. It is the number of body
           rows this table has actually put in the document, which is the window when it is
           windowed and the whole list when it is not. */
        data-rows-rendered={drawnRowCount}
        role="grid"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-rowcount={headerRowCount + items.length + (footerCells === null ? 0 : 1)}
        aria-colcount={visibleColumns.length}
        aria-busy={loading || undefined}
      >
        {/* The scroll box is chrome, not structure: an unroled element between `grid` and its
            `rowgroup`s breaks the ownership chain the roles declare, so it presents nothing of its
            own (R-UI-012, Q-11). */}
        <div className="cx-table-viewport" data-testid={TESTIDS.datatable.viewport} role="presentation" ref={viewportRef}>
          <div className="cx-table-header" data-testid={TESTIDS.datatable.header} role="rowgroup">
            {headerGroups.map((group_, groupIndex) => (
              <div key={group_.id} className="cx-table-row" role="row" aria-rowindex={groupIndex + 1}>
                {group_.headers.map((header, index) => (
                  <HeaderCell key={header.id} header={header} colIndex={index + 1} />
                ))}
              </div>
            ))}
            {filterable
              ? headerGroups.map((group_, groupIndex) => (
                  <div
                    key={`filters-${group_.id}`}
                    className="cx-table-row cx-table-filters"
                    role="row"
                    aria-rowindex={headerGroups.length + groupIndex + 1}
                  >
                    {group_.headers.map((header, index) => (
                      <FilterCell key={header.id} header={header} colIndex={index + 1} />
                    ))}
                  </div>
                ))
              : null}
          </div>

          <div
            className="cx-table-body"
            role="rowgroup"
            style={virtualised ? { height: `${virtualizer.getTotalSize()}px` } : undefined}
          >
            {loading
              ? Array.from({ length: loadingRows }, (_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="cx-table-row cx-table-row-skeleton"
                    data-testid={TESTIDS.datatable.skeletonRow}
                    role="row"
                    aria-rowindex={headerRowCount + index + 1}
                  >
                    {visibleColumns.map((column, colIndex) => (
                      <div
                        key={column.id}
                        className="cx-table-cell"
                        role="gridcell"
                        aria-colindex={colIndex + 1}
                        style={cellStyle(column)}
                      >
                        <Skeleton className="cx-table-bone" />
                      </div>
                    ))}
                  </div>
                ))
              : placed.map(({ item, offset }, index) => {
                  const rowIndex = headerRowCount + (virtualised ? items.indexOf(item) : index) + 1;
                  const style = offset === null ? undefined : { transform: `translateY(${offset}px)` };
                  if (item.kind === "group") {
                    return (
                      <GroupRow
                        key={`group-${item.id}`}
                        item={item}
                        rowIndex={rowIndex}
                        colSpan={visibleColumns.length}
                        collapsed={collapsed.has(item.id)}
                        onToggle={() => toggleGroup(item.id)}
                      />
                    );
                  }
                  const state = rowStateOf?.(item.row.original, item.row.id);
                  const refused = state?.refused === true;
                  return (
                    <div className="cx-table-rowgroup" key={item.id} role="presentation" style={style}>
                      <div
                        className="cx-table-row"
                        data-testid={rowTestId}
                        {...(rowDataOf?.(item.row.original, item.row.id) ?? {})}
                        data-refused={refused ? "true" : undefined}
                        data-stale={state?.stale === undefined ? undefined : "true"}
                        role="row"
                        aria-rowindex={rowIndex}
                        aria-selected={selection.includes(item.row.id) || undefined}
                        data-selected={selection.includes(item.row.id) ? "true" : undefined}
                      >
                        {item.row.getVisibleCells().map((cell, colIndex) => (
                          <BodyCell
                            key={cell.id}
                            cell={cell}
                            rowId={item.row.id}
                            tableId={tableId}
                            colIndex={colIndex + 1}
                            rowHeader={colIndex === 0 && freezeKeyColumn}
                            isCursor={clamped.row === item.dataIndex && clamped.col === colIndex}
                            focusCursor={cursorFocused}
                            onCursor={() => {
                              setCursor({ row: item.dataIndex, col: colIndex });
                              anchor.current = item.dataIndex;
                            }}
                            stale={state?.stale}
                            refused={refused && colIndex === 0}
                            onGridKeyDown={onGridKeyDown}
                            onCellEdit={onCellEdit}
                            onCellCommit={onCellCommit}
                          />
                        ))}
                      </div>
                      {refused && renderRefusal !== undefined ? (
                        <div className="cx-table-refusal" data-testid={TESTIDS.datatable.rowRefusal} role="presentation">
                          {renderRefusal(item.row.original, item.row.id)}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
          </div>

          {footerCells === null ? null : (
            <div className="cx-table-footer" data-testid={TESTIDS.datatable.footer} role="rowgroup">
              <div className="cx-table-row" role="row" aria-rowindex={headerRowCount + items.length + 1}>
                {footerCells.map((column, index) => (
                  <div
                    key={column.id}
                    className="cx-table-cell cx-table-footercell"
                    data-testid={TESTIDS.datatable.total}
                    role="gridcell"
                    aria-colindex={index + 1}
                    data-align={metaOf(column).align}
                    data-pinned={column.getIsPinned() || undefined}
                    style={cellStyle(column)}
                  >
                    {totals?.[column.id] ?? null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
      {/* §5 rule 3's `⋯`. It sits OUTSIDE the grid's own subtree, over the header's trailing edge:
          a panel of checkboxes is not a row, a `grid` whose children are not rows is the
          aria-required-children failure Q-11 bans, and a control inside a `columnheader` would
          put its own words into that column's accessible name. */}
      <button
        type="button"
        className="cx-table-tools cx-reticle"
        data-testid={TESTIDS.datatable.columnsToggle}
        aria-expanded={chooserOpen}
        aria-label={COLUMNS_LABEL}
        onClick={() => setChooserOpen((open) => !open)}
      >
        {CHOOSER_GLYPH}
      </button>
      {chooserOpen ? (
        <div className="cx-table-chooser" data-testid={TESTIDS.datatable.columns} role="group" aria-label={COLUMNS_LABEL}>
          {leafColumns.map((column) => (
            <div className="cx-table-chooser-row" key={column.id}>
              <label className="cx-table-chooser-label">
                <input
                  className="cx-reticle"
                  type="checkbox"
                  data-testid={`datatable-column-toggle-${column.id}`}
                  checked={column.getIsVisible()}
                  onChange={(event) => toggleColumn(column.id, event.target.checked)}
                />
                {headerText(column)}
              </label>
              <button
                type="button"
                className="cx-table-chooser-pin cx-reticle"
                data-testid={`datatable-pin-${column.id}`}
                aria-pressed={column.getIsPinned() === "left"}
                onClick={() => togglePin(column.id, column.getIsPinned() !== "left")}
              >
                {PIN_GLYPH}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The one word the chooser is named by, in both places it is spelled (R-UI-012). */
const COLUMNS_LABEL = "Columns";

/** The marks the instrument draws with; §1 keeps a glyph a glyph and never a word in mono. */
const PIN_GLYPH = "⊕";
const CHOOSER_GLYPH = "⋯";
const COLLAPSED_GLYPH = "▸";
const EXPANDED_GLYPH = "▾";
const REFUSED_GLYPH = "⚠";

/** The sticky offset a pinned column sits at, and the width every cell of it shares. */
function cellStyle<TRow>(column: Header<TRow, unknown>["column"]): CSSProperties {
  const pinned = column.getIsPinned();
  const width = `${column.getSize()}px`;
  if (pinned === "left") return { width, left: `${column.getStart("left")}px` };
  if (pinned === "right") return { width, right: `${column.getAfter("right")}px` };
  return { width };
}

const ariaSortOf = (direction: false | "asc" | "desc"): "ascending" | "descending" | "none" => {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
};

interface HeaderCellProps<TRow> {
  header: Header<TRow, unknown>;
  colIndex: number;
}

function HeaderCell<TRow>({ header, colIndex }: HeaderCellProps<TRow>) {
  const { column } = header;
  const meta = metaOf(column);
  const sortable = column.getCanSort();
  const direction = column.getIsSorted();
  const context = header.getContext();
  const label = flexRender(column.columnDef.header, context);

  /** A resize on the keyboard: the edge is a control, so arrows move it (R-UI-012). */
  const onResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const step = event.key === "ArrowRight" ? RESIZE_STEP_PX : event.key === "ArrowLeft" ? -RESIZE_STEP_PX : 0;
    if (step === 0) return;
    event.preventDefault();
    if (!column.getCanResize()) return;
    const next = Math.max(column.getSize() + step, MIN_COLUMN_WIDTH_PX);
    context.table.setColumnSizing((held) => ({ ...held, [column.id]: next }));
  };

  return (
    <div
      className="cx-table-cell cx-table-headercell"
      role="columnheader"
      aria-sort={sortable ? ariaSortOf(direction) : undefined}
      aria-colindex={colIndex}
      data-align={meta.align}
      data-pinned={column.getIsPinned() || undefined}
      style={cellStyle(column)}
    >
      {sortable ? (
        <button
          type="button"
          className={cx("cx-table-sort", "cx-reticle")}
          data-direction={direction || undefined}
          onClick={column.getToggleSortingHandler()}
        >
          <span className="cx-table-sort-label">{label}</span>
          <span className="cx-table-sort-mark" aria-hidden="true">
            {direction === "asc" ? "↑" : direction === "desc" ? "↓" : ""}
          </span>
        </button>
      ) : (
        label
      )}
      {column.getCanResize() ? (
        <button
          type="button"
          className="cx-table-resize cx-reticle"
          data-testid={`datatable-resize-${column.id}`}
          aria-label={`Resize ${headerText(column)}`}
          onPointerDown={header.getResizeHandler()}
          onKeyDown={onResizeKeyDown}
        />
      ) : null}
    </div>
  );
}

function FilterCell<TRow>({ header, colIndex }: { header: Header<TRow, unknown>; colIndex: number }) {
  const { column } = header;
  const value = column.getFilterValue();

  return (
    <div
      className="cx-table-cell cx-table-filtercell"
      role="columnheader"
      aria-colindex={colIndex}
      data-pinned={column.getIsPinned() || undefined}
      style={cellStyle(column)}
    >
      {column.getCanFilter() ? (
        <Input
          data-testid={`datatable-filter-${column.id}`}
          aria-label={`Filter ${headerText(column)}`}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => column.setFilterValue(event.target.value)}
        />
      ) : null}
    </div>
  );
}

interface GroupRowProps<TRow> {
  item: Extract<BodyItem<TRow>, { kind: "group" }>;
  rowIndex: number;
  colSpan: number;
  collapsed: boolean;
  onToggle: () => void;
}

/** §5 rule 4: `▾ GF · column (4)` on the sunken surface, with the subtotals of what it holds. */
function GroupRow<TRow>({ item, rowIndex, colSpan, collapsed, onToggle }: GroupRowProps<TRow>) {
  return (
    <div
      className="cx-table-row cx-table-group"
      data-testid={TESTIDS.datatable.groupRow}
      data-group={item.id}
      role="row"
      aria-rowindex={rowIndex}
    >
      <div className="cx-table-cell cx-table-groupcell" role="gridcell" aria-colindex={1} aria-colspan={colSpan}>
        <button
          type="button"
          className="cx-table-group-toggle cx-reticle"
          data-testid={`datatable-group-toggle-${item.id}`}
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          <span className="cx-table-group-chevron" aria-hidden="true">
            {collapsed ? COLLAPSED_GLYPH : EXPANDED_GLYPH}
          </span>
          <span className="cx-table-group-label">{item.label}</span>
          <span className="cx-table-group-count">{`(${item.count})`}</span>
        </button>
        <span className="cx-table-group-subtotals" data-testid={TESTIDS.datatable.groupSubtotal}>
          {item.subtotals.map((subtotal) => (
            <span className="cx-table-group-subtotal" key={subtotal.unit}>
              <span className="cx-table-number">{subtotal.value}</span>
              <span className="cx-table-unit">{subtotal.unit}</span>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

interface BodyCellProps<TRow> {
  cell: Cell<TRow, unknown>;
  rowId: string;
  tableId: string;
  colIndex: number;
  /** §5 rule 3's key column names its row, which in an aria grid is `rowheader` (R-UI-012). */
  rowHeader: boolean;
  isCursor: boolean;
  focusCursor: boolean;
  onCursor: () => void;
  stale: string | undefined;
  refused: boolean;
  /** The grid's cursor keys, handled by the cell that has focus (§5 rule 6). */
  onGridKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onCellEdit?: (rowId: string, columnId: string, value: string) => void;
  onCellCommit?: (commit: DataTableCellCommit) => void;
}

function BodyCell<TRow>({
  cell,
  rowId,
  tableId,
  colIndex,
  rowHeader,
  isCursor,
  focusCursor,
  onCursor,
  stale,
  refused,
  onGridKeyDown,
  onCellEdit,
  onCellCommit,
}: BodyCellProps<TRow>) {
  const { column } = cell;
  const meta = metaOf(column);
  /** §5 rule 7: the act law's permission is the column's, and nothing else opens an editor. */
  const editable = meta.editable === true && (typeof onCellEdit === "function" || typeof onCellCommit === "function");
  const rendered = flexRender(column.columnDef.cell, cell.getContext());

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [entered, setEntered] = useState(false);
  const cellRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const wasEditing = useRef(false);
  // One edit, one outcome. Enter commits and Escape cancels by unmounting the editor, and removing
  // a focused field fires a native blur — which would reach the still-attached `onBlur` and either
  // commit twice or turn a cancel into a commit. The gesture that ends the edit claims it first.
  const settled = useRef(false);

  /** §5 rule 2: only a cell that is ACTUALLY clipped earns a Tooltip. */
  const [truncated, setTruncated] = useState(false);
  const [full, setFull] = useState("");
  useEffect(() => {
    const node = textRef.current;
    if (node === null) return;
    const measure = (): void => {
      setTruncated(node.scrollWidth > node.clientWidth);
      setFull(node.textContent ?? "");
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [rendered]);

  // The cursor owns DOM focus once a gesture has moved it — on mount too, because a cell that is
  // wrapped in a Tooltip the moment it is found to be clipped remounts under the reader's hands.
  useEffect(() => {
    if (isCursor && focusCursor && !editing) cellRef.current?.focus();
  }, [isCursor, focusCursor, editing]);

  // Leaving the editor puts focus back where the gesture started — a keyboard journey never ends
  // on the document body (R-UI-012).
  useEffect(() => {
    if (wasEditing.current && !editing) cellRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const startEditing = (): void => {
    setDraft(String(cell.getValue() ?? ""));
    settled.current = false;
    setEditing(true);
  };

  const commit = (): void => {
    if (settled.current) return;
    settled.current = true;
    setEditing(false);
    setEntered(true);
    onCellEdit?.(rowId, column.id, draft);
    onCellCommit?.({ tableId, rowId, columnId: column.id, value: draft, act: meta.act === true });
  };

  const cancel = (): void => {
    if (settled.current) return;
    settled.current = true;
    setEditing(false);
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // The grid's own cursor keys stop here: inside an editor an arrow is a caret move (R-UI-012).
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  /**
   * Enter belongs to this cell — it opens the editor where the act law permits one, and where it
   * does not it is left alone rather than swallowed (§5 rule 7). Every other key of §5 rule 6 is
   * the grid's cursor, handled in one place and delegated to from the cell that has focus.
   */
  const takeCursor = (): void => {
    if (!isCursor) onCursor();
  };

  const onCellKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter") {
      if (!editable || editing) return;
      event.preventDefault();
      event.stopPropagation();
      startEditing();
      return;
    }
    if (editing) return;
    onGridKeyDown(event);
  };

  const cellNode = (
    /* A gridcell IS the focusable unit of an aria grid (R-UI-012): the roving tabindex sits on
       it by design, so exactly one cell of the table is in the Tab order at a time. */
    <div
      ref={cellRef}
      className={cx("cx-table-cell", "cx-reticle")}
      data-testid={TESTIDS.datatable.cell}
      role={rowHeader ? "rowheader" : "gridcell"}
      aria-colindex={colIndex}
      tabIndex={isCursor ? 0 : -1}
      data-cursor={isCursor ? "true" : undefined}
      data-align={meta.align}
      data-pinned={column.getIsPinned() || undefined}
      data-basis={entered ? "ENTERED" : undefined}
      data-editable={editable ? "true" : undefined}
      data-stale={stale === undefined ? undefined : "true"}
      style={cellStyle(column)}
      onKeyDown={onCellKeyDown}
      // A focus this cell did not already own is a reader arriving at it: the cursor moves here and
      // a new range starts here. A focus it DID own is the cursor's own arrival — re-seating the
      // anchor there would collapse the range a ⇧+arrow is in the middle of taking (§5 rule 6).
      onFocus={takeCursor}
      onClick={takeCursor}
    >
      {refused ? (
        <span className="cx-table-refused-mark" data-testid={TESTIDS.datatable.rowRefused} aria-hidden="true">
          {REFUSED_GLYPH}
        </span>
      ) : null}
      {editable && editing ? (
        <Input
          data-testid={TESTIDS.datatable.cellEditor}
          className="cx-table-editor"
          aria-label={headerText(column)}
          // Not an autofocus: this editor exists only because the person just asked to edit this
          // cell, so the caret belongs in it. `autoFocus` would say the same thing in a word that
          // also means "steal the focus when the page loads", which is the thing that hurts.
          ref={(node) => {
            node?.focus();
          }}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onEditorKeyDown}
          onBlur={commit}
        />
      ) : (
        <>
          {entered ? (
            <span className="cx-table-basis" data-testid={TESTIDS.datatable.cellEntered} aria-hidden="true">
              {BASIS_GLYPHS.ENTERED}
            </span>
          ) : null}
          <span className="cx-table-cell-text" ref={textRef}>
            {rendered}
          </span>
        </>
      )}
    </div>
  );

  // §5 rule 2 and rule 8: the clipped cell's full value, and the stale cell's reason, are the same
  // affordance — one Tooltip, on hover AND on focus, and never on a cell that reads in full.
  const hint = stale ?? (truncated ? full : "");
  if (hint === "" || editing) return cellNode;
  return <Tooltip content={hint}>{cellNode}</Tooltip>;
}

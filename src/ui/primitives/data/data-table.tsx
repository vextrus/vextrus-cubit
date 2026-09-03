"use client";
/**
 * R-UI-010's DataTable: TanStack Table over TanStack Virtual. It renders a window of rows into a
 * scroll container that spans the whole list, so a register of any length costs one screenful
 * (R-UI-004), and the header stays put above it.
 *
 * Density is the prop `data-density` reflects; the two row heights R-UI-005 fixes live in the
 * stylesheet and in the virtualiser's estimate, which must agree — hence the one table of heights
 * below. Right alignment, pinning and sort state are read from the table instance and published as
 * data-attributes, so the stylesheet needs no knowledge of the column set.
 *
 * The filter fields and the inline cell editor are the shipped core Input: a table that
 * re-implements an input's chrome is the copy B-17 forbids.
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
  type Header,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { cx } from "../core/class-names";
import { Input } from "../core/input";

export type DataTableDensity = "comfortable" | "compact";

/** What a column may tell the table about itself beyond its accessor: alignment, filtering and inline
 * editing, the three column facts R-UI-005 and R-UI-010 give the table. */
export interface DataTableColumnMeta {
  align?: "right";
  filterable?: boolean;
  editable?: boolean;
}

/**
 * TanStack parameterises `ColumnMeta` by the row type and the cell-value type of the column it
 * describes, and a merged declaration has to repeat that parameter list exactly. None of the three
 * facts above depends on either type, so the two are carried in type position and contribute no
 * member: a column may set the facts the table reads, and nothing else.
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

export interface DataTableProps<TRow> {
  columns: ColumnDef<TRow, unknown>[];
  data: TRow[];
  getRowId: (row: TRow, index: number) => string;
  density?: DataTableDensity;
  columnPinning?: DataTableColumnPinning;
  onCellEdit?: (rowId: string, columnId: string, value: string) => void;
  className?: string;
}

/**
 * R-UI-005's two row heights, in px. The stylesheet draws the row from the density tokens
 * `--row-comfortable` and `--row-compact`, and the virtualiser estimates in numbers; the two are
 * the same instrument, so `row-height.test.ts` beside this file reads those tokens out of
 * src/ui/tokens.ts — the one home the stylesheet is generated from — and reds if either number
 * drifts from it (B-17). The token table is a computed value over every Datum token group, and a
 * client primitive does not carry it into the browser for two integers.
 */
export const ROW_HEIGHT_PX: Readonly<Record<DataTableDensity, number>> = Object.freeze({
  comfortable: 36,
  compact: 28,
});

const DEFAULT_COLUMN_WIDTH_PX = 150;
const OVERSCAN_ROWS = 8;

const metaOf = (column: { columnDef: { meta?: DataTableColumnMeta } }): DataTableColumnMeta => column.columnDef.meta ?? {};

/**
 * A column header as text, for the accessible names the filter and the editor owe (R-UI-012). A
 * header may be a render function or an element, and neither stringifies into anything a screen
 * reader can use — the column id is the honest fallback.
 */
function headerText(column: { id: string; columnDef: { header?: unknown } }): string {
  const label = column.columnDef.header;
  if (typeof label === "string") return label;
  return column.id;
}

export function DataTable<TRow>({
  columns,
  data,
  getRowId,
  density = "comfortable",
  columnPinning,
  onCellEdit,
  className,
}: DataTableProps<TRow>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const viewportRef = useRef<HTMLDivElement | null>(null);

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

  const pinning = useMemo<ColumnPinningState>(
    () => ({ left: columnPinning?.left ?? [], right: columnPinning?.right ?? [] }),
    [columnPinning],
  );

  const table = useReactTable<TRow>({
    data,
    columns: tableColumns,
    getRowId,
    state: { sorting, columnFilters, columnPinning: pinning },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    // Ascending first and removable, so the control cycles ascending → descending → none.
    sortDescFirst: false,
    enableSortingRemoval: true,
    defaultColumn: { size: DEFAULT_COLUMN_WIDTH_PX },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const rowHeight = ROW_HEIGHT_PX[density];

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN_ROWS,
  });

  // The virtualiser caches its measurements and does not watch `estimateSize`, so a density change
  // would otherwise leave every row sitting at the old offset over the old scroll extent: the
  // density switch R-UI-005 requires has to re-measure the list. Only that change does — on mount
  // the estimate the virtualiser was constructed with is already this row height, and re-measuring
  // it throws the freshly built cache away for the same numbers.
  const measuredRowHeight = useRef<number | null>(null);
  useEffect(() => {
    if (measuredRowHeight.current !== null && measuredRowHeight.current !== rowHeight) virtualizer.measure();
    measuredRowHeight.current = rowHeight;
  }, [virtualizer, rowHeight]);

  const headerGroups = table.getHeaderGroups();
  const filterable = table.getAllLeafColumns().some((column) => column.getCanFilter());
  // Every row the user can reach, header rows included: the filter row is one of them, and after a
  // filter the reachable body rows are the surviving ones, not the whole data prop (R-UI-012).
  const headerRowCount = headerGroups.length * (filterable ? 2 : 1);

  return (
    <div
      className={cx("cx-table", className)}
      data-testid="datatable"
      data-density={density}
      role="table"
      aria-rowcount={headerRowCount + rows.length}
    >
      {/* The scroll box is chrome, not structure: an unroled element between `table` and its
          `rowgroup`s breaks the ownership chain the roles declare, so it presents nothing of its
          own (R-UI-012, Q-11). */}
      <div className="cx-table-viewport" data-testid="datatable-viewport" role="presentation" ref={viewportRef}>
        <div className="cx-table-header" data-testid="datatable-header" role="rowgroup">
          {headerGroups.map((group, groupIndex) => (
            <div key={group.id} className="cx-table-row" role="row" aria-rowindex={groupIndex + 1}>
              {group.headers.map((header) => (
                <HeaderCell key={header.id} header={header} />
              ))}
            </div>
          ))}
          {filterable
            ? headerGroups.map((group, groupIndex) => (
                <div
                  key={`filters-${group.id}`}
                  className="cx-table-row cx-table-filters"
                  role="row"
                  aria-rowindex={headerGroups.length + groupIndex + 1}
                >
                  {group.headers.map((header) => (
                    <FilterCell key={header.id} header={header} />
                  ))}
                </div>
              ))
            : null}
        </div>

        <div
          className="cx-table-body"
          role="rowgroup"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;
            return (
              <div
                key={row.id}
                className="cx-table-row"
                data-testid="datatable-row"
                role="row"
                aria-rowindex={headerRowCount + virtualRow.index + 1}
                // Only the offset is written here. The row's height is the stylesheet's, read from
                // R-UI-005's density tokens — an inline pixel height would beat that rule and give
                // the two densities a second, silent home (B-17).
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {row.getVisibleCells().map((cell) => (
                  <BodyCell key={cell.id} cell={cell} rowId={row.id} onCellEdit={onCellEdit} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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

function HeaderCell<TRow>({ header }: { header: Header<TRow, unknown> }) {
  const { column } = header;
  const meta = metaOf(column);
  const sortable = column.getCanSort();
  const direction = column.getIsSorted();
  const label = flexRender(column.columnDef.header, header.getContext());

  return (
    <div
      className="cx-table-cell cx-table-headercell"
      role="columnheader"
      aria-sort={sortable ? ariaSortOf(direction) : undefined}
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
    </div>
  );
}

function FilterCell<TRow>({ header }: { header: Header<TRow, unknown> }) {
  const { column } = header;
  const value = column.getFilterValue();

  return (
    <div
      className="cx-table-cell cx-table-filtercell"
      role="columnheader"
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

interface BodyCellProps<TRow> {
  cell: Cell<TRow, unknown>;
  rowId: string;
  onCellEdit?: (rowId: string, columnId: string, value: string) => void;
}

function BodyCell<TRow>({ cell, rowId, onCellEdit }: BodyCellProps<TRow>) {
  const { column } = cell;
  const meta = metaOf(column);
  const editable = meta.editable === true && typeof onCellEdit === "function";
  const rendered = flexRender(column.columnDef.cell, cell.getContext());

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const wasEditing = useRef(false);
  // One edit, one outcome. Enter commits and Escape cancels by unmounting the editor, and removing
  // a focused field fires a native blur — which would reach the still-attached `onBlur` and either
  // commit twice or turn a cancel into a commit. The gesture that ends the edit claims it first.
  const settled = useRef(false);

  // Leaving the editor puts focus back where the gesture started — a keyboard journey never ends
  // on the document body (R-UI-012).
  useEffect(() => {
    if (wasEditing.current && !editing) buttonRef.current?.focus();
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
    onCellEdit?.(rowId, column.id, draft);
  };

  const cancel = (): void => {
    if (settled.current) return;
    settled.current = true;
    setEditing(false);
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
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

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    startEditing();
  };

  return (
    <div
      className="cx-table-cell"
      data-testid="datatable-cell"
      role="cell"
      data-align={meta.align}
      data-pinned={column.getIsPinned() || undefined}
      style={cellStyle(column)}
    >
      {editable && editing ? (
        <Input
          data-testid="datatable-cell-editor"
          className="cx-table-editor"
          aria-label={headerText(column)}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onEditorKeyDown}
          onBlur={commit}
        />
      ) : editable ? (
        <button
          ref={buttonRef}
          type="button"
          className={cx("cx-table-cell-button", "cx-reticle")}
          onKeyDown={onButtonKeyDown}
          onDoubleClick={startEditing}
        >
          {rendered}
        </button>
      ) : (
        rendered
      )}
    </div>
  );
}

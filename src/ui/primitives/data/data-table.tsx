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
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { cx } from "../core/class-names";
import { Input } from "../core/input";

export type DataTableDensity = "comfortable" | "compact";

/** What a column may tell the table about itself beyond its accessor (the increment's interfaces). */
export interface DataTableColumnMeta {
  align?: "right";
  filterable?: boolean;
  editable?: boolean;
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
 * R-UI-005's two row heights, in px: the virtualiser measures in numbers and the stylesheet in
 * tokens, and the two must be the same instrument, so the numbers are declared once here.
 */
const ROW_HEIGHT_PX: Record<DataTableDensity, number> = { comfortable: 36, compact: 28 };
const DEFAULT_COLUMN_WIDTH_PX = 150;
const OVERSCAN_ROWS = 8;

const metaOf = (column: { columnDef: { meta?: unknown } }): DataTableColumnMeta =>
  (column.columnDef.meta as DataTableColumnMeta | undefined) ?? {};

/** A column header as text, for the accessible names the filter and the editor owe (R-UI-012). */
function headerText<TRow>(header: Header<TRow, unknown>): string {
  const label = header.column.columnDef.header;
  if (typeof label === "string") return label;
  return header.column.id;
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
        enableColumnFilter: ((column.meta as DataTableColumnMeta | undefined) ?? {}).filterable === true,
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

  const headerGroups = table.getHeaderGroups();
  const filterable = table.getAllLeafColumns().some((column) => column.getCanFilter());

  return (
    <div
      className={cx("cx-table", className)}
      data-testid="datatable"
      data-density={density}
      role="table"
      aria-rowcount={data.length + 1}
    >
      <div className="cx-table-viewport" data-testid="datatable-viewport" ref={viewportRef}>
        <div className="cx-table-header" data-testid="datatable-header" role="rowgroup">
          {headerGroups.map((group) => (
            <div key={group.id} className="cx-table-row" role="row" aria-rowindex={1}>
              {group.headers.map((header) => (
                <HeaderCell key={header.id} header={header} />
              ))}
            </div>
          ))}
          {filterable
            ? headerGroups.map((group) => (
                <div key={`filters-${group.id}`} className="cx-table-row cx-table-filters" role="row">
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
                aria-rowindex={virtualRow.index + 2}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
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
          aria-label={`Filter ${headerText(header)}`}
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

  // Leaving the editor puts focus back where the gesture started — a keyboard journey never ends
  // on the document body (R-UI-012).
  useEffect(() => {
    if (wasEditing.current && !editing) buttonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const startEditing = (): void => {
    setDraft(String(cell.getValue() ?? ""));
    setEditing(true);
  };

  const commit = (): void => {
    setEditing(false);
    onCellEdit?.(rowId, column.id, draft);
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
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
          aria-label={String(column.columnDef.header ?? column.id)}
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

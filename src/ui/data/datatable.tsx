/**
 * DataTable — TanStack's table over a window this component computes from its props
 * (R-UI-010: "DataTable (TanStack; column pin/resize/sort/filter/group; virtualised; sticky
 * header/footer; row selection; inline edit cell)").
 *
 * The one decision everything else follows from: **the geometry is the props, never the
 * layout**. `height` says how tall the viewport is and `estimateRowHeight` says how tall a row
 * is, so the visible range is arithmetic on a scroll offset — nothing here measures an element
 * or subscribes to its size. Two things fall out of it. A table mounts in any DOM, including
 * one with none of the browser's measurement APIs in it, which is where its behaviour is
 * graded. And a fixed row height is what makes 50,000 rows scannable at a constant rhythm
 * (R-UI-005) — the density is a prop a screen chooses, not a measurement a browser discovers.
 *
 * `@tanstack/react-virtual` supports this directly: its `observeElementRect` and
 * `observeElementOffset` are options, so the rect below is the `height` prop and the offset is
 * the scroll container's own `scrollTop`. The library's own defaults measure the element, and
 * where a DOM cannot measure they report a viewport of zero — a table that renders nothing
 * rather than one that says so.
 *
 * The second decision: the table never mutates the data it was handed. Selection reports ids
 * from `getRowId`, an inline edit reports `(rowId, columnId, value)`, and what happens next is
 * the owner's business — a table that wrote to its own rows would be a second copy of the
 * truth sitting above the seam that holds it.
 *
 * Decided in docs/design/datum-patterns.md §2–§4.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type {
  Cell,
  Column,
  ColumnDef,
  ColumnPinningState,
  ColumnSizingState,
  ExpandedState,
  GroupingState,
  Header,
  Row,
  RowData,
  RowSelectionState,
  SortingState,
  Updater,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Virtualizer } from '@tanstack/react-virtual';
import { Checkbox } from '../primitives/choice';
import { Input } from '../primitives/field';
import { Button, IconButton } from '../primitives/button';
import { cx } from '../primitives/class-names';
import { countText } from './chips';
import { ds, fill } from './strings';

/**
 * What a column may say about itself beyond TanStack's own vocabulary. Declared here because
 * `ColumnMeta` is an empty interface until a module augments it, and these two markers are
 * this module's whole extension: which cells a reader may edit in place, and which ones are
 * numbers (right-aligned, tabular — R-UI-003).
 */
declare module '@tanstack/react-table' {
  // The two parameters are TanStack's own: a declaration merge has to restate them exactly,
  // even though the two markers below do not use either.
  interface ColumnMeta<TData extends RowData, TValue> {
    /** The cell activates into an input and commits through `onCellEdit` (§3). */
    readonly editable?: boolean;
    /** The cell holds a number: `.numeric`, right-aligned (R-UI-003). */
    readonly numeric?: boolean;
  }
}

/** A column definition, TanStack's own — re-exported so a screen imports one module. */
export type DataTableColumn<T> = ColumnDef<T, unknown>;

/** The five TanStack slices a screen may hold for the table (§3). */
export interface DataTableState {
  readonly sorting: SortingState;
  readonly grouping: GroupingState;
  readonly columnPinning: ColumnPinningState;
  readonly columnSizing: ColumnSizingState;
  readonly rowSelection: RowSelectionState;
}

export interface DataTableProps<T> {
  /** The rows, in the owner's order. Never mutated here. */
  readonly data: readonly T[];
  readonly columns: DataTableColumn<T>[];
  /** The identity of a row — the id selection and inline edits are reported with. */
  readonly getRowId: (row: T) => string;
  /** The viewport's height in px: the window is computed from it (§2). */
  readonly height: number;
  /** A row's height in px: the density switch, and the other half of the window (§2). */
  readonly estimateRowHeight: number;
  readonly enableRowSelection?: boolean;
  readonly onRowSelectionChange?: (selection: RowSelectionState) => void;
  /** A committed inline edit. The owner decides what to do with it (§3). */
  readonly onCellEdit?: (rowId: string, columnId: string, value: string) => void;
  /** Case-insensitive substring over the cells (§3). */
  readonly globalFilter?: string;
  readonly state?: Partial<DataTableState>;
  readonly onStateChange?: (state: DataTableState) => void;
  /**
   * Why this table is empty, in the screen's own words. Required: R-UI-020's "an empty list
   * says why it is empty" is not a thing a screen may forget to say.
   */
  readonly emptyReason: string;
  /** The sticky footer's content, rendered verbatim (§2). */
  readonly footer?: ReactNode;
}

/** Rows kept in the DOM above and below the viewport — a scroll's worth of headroom (§2). */
const OVERSCAN = 10;

/** The sort indicators. Glyphs, not copy: they are the ARIA state made visible (R-UI-060). */
const ASCENDING_MARK = '↑';
const DESCENDING_MARK = '↓';

/** A collapsed group's chevron, and an open one's. */
const COLLAPSED_MARK = '▸';
const EXPANDED_MARK = '▾';

/** `aria-sort`'s vocabulary, spelt as ARIA spells it. */
const ARIA_ASCENDING = 'ascending';
const ARIA_DESCENDING = 'descending';

/** The keys the table answers itself. */
const ENTER = 'Enter';
const ESCAPE = 'Escape';
const ARROW_LEFT = 'ArrowLeft';
const ARROW_RIGHT = 'ArrowRight';

/** One `--space-2` — what an arrow key moves a column edge by (§3). */
const RESIZE_STEP = 8;

/** The narrowest a column may be dragged: a cell that cannot show a character is not a cell. */
const MIN_COLUMN_WIDTH = 40;

/** The width of the selection gutter (§3). */
const SELECT_COLUMN_WIDTH = 28;

/** The cell being edited, while it is being edited. */
interface EditingCell {
  readonly rowId: string;
  readonly columnId: string;
  readonly value: string;
}

/** The empty state of every slice — what an uncontrolled table starts from. */
function emptySlices(): DataTableState {
  return {
    sorting: [],
    grouping: [],
    columnPinning: { left: [], right: [] },
    columnSizing: {},
    rowSelection: {},
  };
}

/** Apply a TanStack updater, which is either the next value or a function producing it. */
function applyUpdater<T>(updater: Updater<T>, previous: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(previous) : updater;
}

/**
 * The scroll offset, read from the container itself.
 *
 * The library's own version debounces a "scrolling stopped" callback on a timer and listens
 * for `scrollend`; this one reports the offset it was given and nothing else, so a table has
 * no timer running after the screen that mounted it has gone.
 */
function observeScrollTop(
  instance: Virtualizer<HTMLDivElement, HTMLElement>,
  cb: (offset: number, isScrolling: boolean) => void,
): (() => void) | undefined {
  const element = instance.scrollElement;
  if (element === null) return undefined;
  const onScroll = (): void => {
    cb(element.scrollTop, false);
  };
  onScroll();
  element.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    element.removeEventListener('scroll', onScroll);
  };
}

/** Where a pinned column sits, and the fact that it stays there while the rest scrolls (§3). */
function pinnedStyle<T>(column: Column<T, unknown>): CSSProperties {
  const pinned = column.getIsPinned();
  if (pinned === 'left') {
    return { position: 'sticky', left: `${String(column.getStart('left'))}px`, zIndex: 1 };
  }
  if (pinned === 'right') {
    return { position: 'sticky', right: `${String(column.getAfter('right'))}px`, zIndex: 1 };
  }
  return {};
}

/**
 * Which side a cell is pinned to, as an attribute the sheet can select on — the opaque surface
 * and the seam hairline §3 promises are paint, and paint belongs in data.css. `z-index` orders
 * the layers; it does not fill them, so without this a pinned cell is a window onto the cells
 * scrolling under it.
 */
function pinnedSide<T>(column: Column<T, unknown>): 'left' | 'right' | undefined {
  const pinned = column.getIsPinned();
  return pinned === 'left' || pinned === 'right' ? pinned : undefined;
}

/** A cell's width and pinning, together — the only geometry a cell carries. */
function cellStyle<T>(column: Column<T, unknown>): CSSProperties {
  return { width: `${String(column.getSize())}px`, ...pinnedStyle(column) };
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  height,
  estimateRowHeight,
  enableRowSelection = false,
  onRowSelectionChange,
  onCellEdit,
  globalFilter,
  state,
  onStateChange,
  emptyReason,
  footer,
}: DataTableProps<T>): ReactElement {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [internal, setInternal] = useState<DataTableState>(emptySlices);
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [editing, setEditing] = useState<EditingCell | null>(null);

  // A controlled slice is the screen's; every other slice is this table's own. A screen that
  // holds two of the five does not have to hold the other three to make them work.
  const current: DataTableState = { ...internal, ...state };

  const change = <K extends keyof DataTableState>(
    key: K,
    updater: Updater<DataTableState[K]>,
  ): void => {
    const next = applyUpdater(updater, current[key]);
    setInternal((old) => ({ ...old, [key]: next }));
    onStateChange?.({ ...current, [key]: next });
  };

  const table = useReactTable<T>({
    data: data as T[],
    columns,
    getRowId,
    state: {
      sorting: current.sorting,
      grouping: current.grouping,
      columnPinning: current.columnPinning,
      columnSizing: current.columnSizing,
      rowSelection: current.rowSelection,
      expanded,
      globalFilter: globalFilter ?? '',
    },
    enableRowSelection,
    globalFilterFn: 'includesString',
    columnResizeMode: 'onChange',
    onSortingChange: (updater) => {
      change('sorting', updater);
    },
    onGroupingChange: (updater) => {
      change('grouping', updater);
    },
    onColumnPinningChange: (updater) => {
      change('columnPinning', updater);
    },
    onColumnSizingChange: (updater) => {
      change('columnSizing', updater);
    },
    onRowSelectionChange: (updater) => {
      const next = applyUpdater(updater, current.rowSelection);
      change('rowSelection', next);
      // The ids are `getRowId`'s, never a position: an index-keyed selection means something
      // different after the next sort.
      onRowSelectionChange?.(next);
    },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const rows = table.getRowModel().rows;

  // The library subscribes `observeElementRect` once per scroll element, so the callback it
  // hands us is the only way back into its rect after mount. Keeping it means the viewport can
  // still be *the prop*: raise `height` and the window grows with the box (§2).
  const publishRect = useRef<((rect: { width: number; height: number }) => void) | null>(null);

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLElement>({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: OVERSCAN,
    // The viewport is the prop, at mount and forever after: no observer, and therefore no DOM
    // where this table refuses to run (§1, §2).
    initialRect: { width: 0, height },
    observeElementRect: (_instance, cb) => {
      publishRect.current = cb;
      cb({ width: 0, height });
      return () => {
        publishRect.current = null;
      };
    },
    observeElementOffset: observeScrollTop,
  });

  // Both halves of the geometry are props, so both are live. A taller viewport re-windows
  // rather than leaving blank space under the last row; a new `estimateRowHeight` — §2's
  // density switch, 36 comfortable against 28 compact — rebuilds the measurements, so
  // `item.start` and a row's own height stay on one pitch instead of overlapping.
  useEffect(() => {
    publishRect.current?.({ width: 0, height });
  }, [height]);
  useEffect(() => {
    virtualizer.measure();
  }, [estimateRowHeight, virtualizer]);

  const commitEdit = (cell: EditingCell): void => {
    onCellEdit?.(cell.rowId, cell.columnId, cell.value);
    setEditing(null);
  };

  const resize = <TValue,>(column: Column<T, TValue>, delta: number): void => {
    const next = Math.max(MIN_COLUMN_WIDTH, column.getSize() + delta);
    change('columnSizing', (old) => ({ ...old, [column.id]: next }));
  };

  const renderHeaderCell = (header: Header<T, unknown>): ReactElement => {
    const column = header.column;
    const sorted = column.getIsSorted();
    const label = flexRender(column.columnDef.header, header.getContext());
    // The column's own words where it has them: "Resize column Quantity" is a name a reader
    // recognises, and `qty` is one only its author does.
    const name = typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id;
    return (
      <div
        key={header.id}
        role="columnheader"
        aria-sort={
          sorted === 'asc' ? ARIA_ASCENDING : sorted === 'desc' ? ARIA_DESCENDING : undefined
        }
        data-pinned={pinnedSide(column)}
        className="datum-datatable-head-cell"
        style={cellStyle(column)}
      >
        {column.getCanSort() ? (
          <Button
            variant="ghost"
            data-testid="datatable-sort"
            className="datum-datatable-sort"
            onClick={column.getToggleSortingHandler()}
          >
            {label}
            {sorted === false ? null : (
              <span aria-hidden="true" className="datum-datatable-sort-mark">
                {sorted === 'asc' ? ASCENDING_MARK : DESCENDING_MARK}
              </span>
            )}
          </Button>
        ) : (
          <span className="datum-datatable-head-label">{label}</span>
        )}
        {column.getCanResize() ? (
          <span
            role="separator"
            tabIndex={0}
            aria-label={fill('data.table.resize', 'column', name)}
            // A focusable separator is a widget, not a divider: ARIA requires it to say where
            // it stands, and the arrow keys below move exactly this number (§3).
            aria-orientation="vertical"
            aria-valuenow={column.getSize()}
            aria-valuemin={MIN_COLUMN_WIDTH}
            className={cx('datum-datatable-resize', 'datum-focus-ring')}
            onMouseDown={header.getResizeHandler()}
            onTouchStart={header.getResizeHandler()}
            onKeyDown={(event) => {
              if (event.key === ARROW_LEFT) resize(column, -RESIZE_STEP);
              if (event.key === ARROW_RIGHT) resize(column, RESIZE_STEP);
            }}
          />
        ) : null}
      </div>
    );
  };

  const renderCell = (cell: Cell<T, unknown>, row: Row<T>): ReactElement => {
    const column = cell.column;
    const editable = column.columnDef.meta?.editable === true;
    const numeric = column.columnDef.meta?.numeric === true;
    const open =
      editing !== null && editing.rowId === row.id && editing.columnId === column.id;
    const display = String(cell.getValue() ?? '');
    const start = (): void => {
      if (!editable || open) return;
      setEditing({ rowId: row.id, columnId: column.id, value: display });
    };
    return (
      <div
        key={cell.id}
        role="gridcell"
        data-editable={editable ? '' : undefined}
        data-pinned={pinnedSide(column)}
        className={cx('datum-datatable-cell', numeric && 'numeric')}
        style={cellStyle(column)}
        onClick={editable ? start : undefined}
        tabIndex={editable && !open ? 0 : undefined}
        onKeyDown={
          editable
            ? (event) => {
                if (event.key === ENTER && !open) start();
              }
            : undefined
        }
      >
        {open && editing !== null ? (
          <Input
            data-testid="datatable-edit-cell"
            autoFocus
            className={cx('datum-datatable-edit', numeric && 'numeric')}
            value={editing.value}
            // Pre-filled and selected (§3): the commonest edit replaces the value outright,
            // and the second commonest starts by pressing an arrow key.
            onFocus={(event) => {
              event.currentTarget.select();
            }}
            onChange={(event) => {
              setEditing({ ...editing, value: event.target.value });
            }}
            onKeyDown={(event) => {
              if (event.key === ENTER) commitEdit({ ...editing, value: event.currentTarget.value });
              // Escape reverts: an edit nobody confirmed is not an edit (§3).
              if (event.key === ESCAPE) setEditing(null);
            }}
            onBlur={(event) => {
              commitEdit({ ...editing, value: event.target.value });
            }}
          />
        ) : (
          <span className="datum-datatable-value">
            {flexRender(column.columnDef.cell, cell.getContext())}
          </span>
        )}
      </div>
    );
  };

  const renderGroupRow = (row: Row<T>, style: CSSProperties, index: number): ReactElement => {
    const open = row.getIsExpanded();
    const spanned = table.getVisibleLeafColumns().length;
    return (
      <div
        key={row.id}
        role="row"
        aria-rowindex={index + 2}
        data-testid="datatable-group-row"
        className="datum-datatable-group-row"
        style={style}
      >
        {/* A row's children are cells or it is not a row — a chevron and two loose spans leave
            a reader inside a grid row with nothing addressable in it. The gutter is the same
            28 px the data rows and the header spend on selection, so a group row heads the
            column grid it is over instead of sitting 28 px to its left (§3). */}
        {enableRowSelection ? (
          <div
            role="gridcell"
            className="datum-datatable-select"
            style={{ width: `${String(SELECT_COLUMN_WIDTH)}px` }}
          />
        ) : null}
        <div role="gridcell" aria-colspan={spanned} className="datum-datatable-group-cell">
          <IconButton
            label={ds(open ? 'data.table.collapseGroup' : 'data.table.expandGroup')}
            aria-expanded={open}
            icon={open ? EXPANDED_MARK : COLLAPSED_MARK}
            className="datum-datatable-chevron"
            onClick={row.getToggleExpandedHandler()}
          />
          <span className="datum-datatable-group-value">{String(row.getGroupingValue(row.groupingColumnId ?? ''))}</span>
          <span className={cx('datum-datatable-group-count', 'numeric')}>
            ({countText(row.subRows.length)})
          </span>
        </div>
      </div>
    );
  };

  const renderRow = (row: Row<T>, style: CSSProperties, index: number): ReactElement => (
    <div
      key={row.id}
      role="row"
      aria-rowindex={index + 2}
      data-testid="datatable-row"
      data-selected={row.getIsSelected() ? '' : undefined}
      className="datum-datatable-row"
      style={style}
    >
      {enableRowSelection ? (
        <div role="gridcell" className="datum-datatable-select" style={{ width: `${String(SELECT_COLUMN_WIDTH)}px` }}>
          <Checkbox
            data-testid="datatable-select-row"
            aria-label={fill('data.table.selectRow', 'id', row.id)}
            checked={row.getIsSelected()}
            onCheckedChange={() => {
              row.toggleSelected();
            }}
          />
        </div>
      ) : null}
      {row.getVisibleCells().map((cell) => renderCell(cell, row))}
    </div>
  );

  const items = virtualizer.getVirtualItems();

  return (
    <div
      data-testid="datatable"
      role="grid"
      // The true extent, not the window's: a reader is told there are 50,000 rows even while
      // the DOM holds thirty of them (§2).
      aria-rowcount={data.length + 1}
      className="datum-datatable"
    >
      {/* The scroll container is the grid's row group: the header row and the windowed body
          rows are both inside it, and the spacer that holds the scrollbar open is marked
          presentational so a row's owner is still the group (§2). */}
      <div
        ref={scrollRef}
        role="rowgroup"
        className="datum-datatable-scroll"
        style={{ height: `${String(height)}px` }}
      >
        {/* Row 1 of `aria-rowcount`: with an extent declared, every rendered row states where
            it stands, and the header is the row a reader most often lands on first (§2). */}
        <div
          data-testid="datatable-header"
          role="row"
          aria-rowindex={1}
          className="datum-datatable-header"
        >
          {enableRowSelection ? (
            <div
              role="columnheader"
              className="datum-datatable-select"
              style={{ width: `${String(SELECT_COLUMN_WIDTH)}px` }}
            >
              {/* The gutter is empty on the screen by design (datum-patterns.md §3), and a
                  column header with nothing in it is a column a reader is never told the name
                  of (R-UI-012). The word is said in the cell and taken off the screen rather
                  than out of the accessibility tree — an `aria-label` would name the cell for
                  a screen reader and still leave the header text-empty. */}
              <span className="datum-datatable-select-name">{ds('data.table.selectColumn')}</span>
            </div>
          ) : null}
          {table.getHeaderGroups().map((group) => group.headers.map((header) => renderHeaderCell(header)))}
        </div>

        {rows.length === 0 ? (
          // R-UI-020: silence never happens — a table with nothing in it says why (§4).
          <div data-testid="datatable-empty" className="datum-datatable-empty">
            {emptyReason}
          </div>
        ) : (
          <div
            role="none"
            className="datum-datatable-body"
            style={{ height: `${String(virtualizer.getTotalSize())}px` }}
          >
            {items.map((item) => {
              const row = rows[item.index];
              if (row === undefined) return null;
              const style: CSSProperties = {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${String(estimateRowHeight)}px`,
                transform: `translateY(${String(item.start)}px)`,
              };
              return row.getIsGrouped()
                ? renderGroupRow(row, style, item.index)
                : renderRow(row, style, item.index);
            })}
          </div>
        )}

        {footer === undefined ? null : (
          // Not a row: the footer holds whatever the screen wrote (a total, a count), not a
          // cell per column, and calling it a row would promise a reader columns to move
          // along (§2).
          <div data-testid="datatable-footer" role="none" className="datum-datatable-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

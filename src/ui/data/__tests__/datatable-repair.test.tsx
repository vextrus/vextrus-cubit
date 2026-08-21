// @vitest-environment jsdom
/**
 * DataTable: the four repairs the review named, each pinned by the behaviour it restores.
 *
 *   - a focusable `role="separator"` is a widget, so it states `aria-valuenow` — without it
 *     axe's `aria-required-attr` fails the gallery, and the arrow keys move a value no reader
 *     is ever told (§3);
 *   - a `role="row"`'s children are cells: the group row's chevron, value and count live in one
 *     spanning `gridcell`, behind the same 28 px selection gutter the data rows spend, so a
 *     grouped and selectable table is one grid rather than two (§3);
 *   - with `aria-rowcount` declared, the header states `aria-rowindex="1"` (§2);
 *   - `height` and `estimateRowHeight` are live props, not mount-time readings: §2 calls the
 *     second one the density switch, and a switch that only works before first paint is not one.
 *
 * A pinned cell's opacity is paint, so it is asserted where paint lives — the module's own
 * sheet, plus the attribute the sheet selects on. No shims: a bare jsdom, as everywhere here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DataTableColumn } from '../index';

type DataModule = typeof import('../index');

const dataModule = async (): Promise<DataModule> => await import('../index');

const NAME_HEADER = 'Name';
const DEPT_HEADER = 'Department';
const EMPTY_REASON = 'No lines here yet.';

const HEIGHT = 400;
const TALLER = 1200;
const ROW_HEIGHT = 40;
const DENSE_ROW_HEIGHT = 20;

/** TanStack's default column width, and the step one arrow key moves it by (§3). */
const DEFAULT_WIDTH = 150;
const RESIZE_STEP = 8;
const MIN_COLUMN_WIDTH = 40;

/** The selection gutter's width (§3) — the same number the group row now leaves for it. */
const SELECT_COLUMN_WIDTH = 28;

const DEPARTMENTS = ['North', 'South'] as const;

interface Row {
  readonly id: string;
  readonly name: string;
  readonly dept: string;
}

/** Enough rows that a window is a window: 400 px of viewport cannot hold 200 of them. */
const ROWS: readonly Row[] = Array.from({ length: 200 }, (_unused, index) => ({
  id: `row-${String(index)}`,
  name: `Line ${String(index)}`,
  dept: DEPARTMENTS[index % DEPARTMENTS.length] ?? DEPARTMENTS[0],
}));

const getRowId = (row: Row): string => row.id;

function columnsFor(): DataTableColumn<Row>[] {
  return [
    { id: 'name', accessorKey: 'name', header: NAME_HEADER, enableSorting: true },
    { id: 'dept', accessorKey: 'dept', header: DEPT_HEADER, enableSorting: false },
  ];
}

const bodyRows = (): HTMLElement[] => screen.queryAllByTestId('datatable-row');

afterEach(cleanup);

describe('DataTable — a focusable separator states its value (§3)', () => {
  it('carries aria-valuenow, and the arrow key moves the number it states', async () => {
    const { DataTable } = await dataModule();
    render(
      <DataTable
        data={ROWS}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
      />,
    );

    const handles = within(screen.getByTestId('datatable-header')).getAllByRole('separator');
    const first = handles[0];
    if (first === undefined) throw new Error('no column carries a resize handle');

    // axe's `aria-required-attr` skips a separator only while it is *not* focusable; this one
    // is, so the attribute is not decoration.
    expect(first.getAttribute('tabindex')).toBe('0');
    expect(first.getAttribute('aria-valuenow')).toBe(String(DEFAULT_WIDTH));
    expect(first.getAttribute('aria-valuemin')).toBe(String(MIN_COLUMN_WIDTH));

    fireEvent.keyDown(first, { key: 'ArrowRight' });

    const after = within(screen.getByTestId('datatable-header')).getAllByRole('separator')[0];
    if (after === undefined) throw new Error('the resize handle vanished');
    expect(after.getAttribute('aria-valuenow')).toBe(String(DEFAULT_WIDTH + RESIZE_STEP));
  });
});

describe('DataTable — a row owns cells, group rows included (§3)', () => {
  it('puts the group row in one spanning gridcell behind the selection gutter', async () => {
    const { DataTable } = await dataModule();
    render(
      <DataTable
        data={ROWS}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        enableRowSelection
        state={{ grouping: ['dept'] }}
      />,
    );

    const group = screen.getAllByTestId('datatable-group-row')[0];
    if (group === undefined) throw new Error('grouping rendered no group row');

    // axe's `aria-required-children` fails a row on the first owned role outside
    // cell/columnheader/gridcell/rowheader — a bare button or span is exactly that.
    const owned = [...group.children];
    expect(owned.length).toBeGreaterThan(0);
    for (const child of owned) expect(child.getAttribute('role')).toBe('gridcell');

    // The gutter: the same 28 px the data rows spend, so the group heads its own column grid.
    const gutter = owned[0] as HTMLElement;
    expect(gutter.style.width).toBe(`${String(SELECT_COLUMN_WIDTH)}px`);
    expect(gutter.textContent).toBe('');

    // The chevron is still reachable, and the group still says what it is.
    expect(within(group).getByRole('button').getAttribute('aria-expanded')).toBe('true');
    expect(group.textContent ?? '').toContain(DEPARTMENTS[0]);
  });
});

describe('DataTable — every rendered row states where it stands (§2)', () => {
  it('gives the header row aria-rowindex 1 under the declared rowcount', async () => {
    const { DataTable } = await dataModule();
    render(
      <DataTable
        data={ROWS}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
      />,
    );

    expect(screen.getByTestId('datatable').getAttribute('aria-rowcount')).toBe(
      String(ROWS.length + 1),
    );
    expect(screen.getByTestId('datatable-header').getAttribute('aria-rowindex')).toBe('1');
  });
});

describe('DataTable — the geometry props stay live (§2)', () => {
  it('re-windows when height grows and re-pitches when the density switch moves', async () => {
    const { DataTable } = await dataModule();
    const view = render(
      <DataTable
        data={ROWS}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
      />,
    );

    const windowed = bodyRows().length;
    expect(windowed).toBeLessThan(ROWS.length);

    // A taller viewport is a bigger window, not a bigger box with the old window in it.
    view.rerender(
      <DataTable
        data={ROWS}
        columns={columnsFor()}
        getRowId={getRowId}
        height={TALLER}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
      />,
    );
    expect(bodyRows().length).toBeGreaterThan(windowed);

    // The density switch: rows are 20 px tall *and* sit on a 20 px pitch. A stale measurement
    // leaves `item.start` on the old 40 px, which is rows with gaps between them.
    view.rerender(
      <DataTable
        data={ROWS}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={DENSE_ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
      />,
    );
    const [first, second] = bodyRows();
    if (first === undefined || second === undefined) throw new Error('the window emptied');
    expect(first.style.height).toBe(`${String(DENSE_ROW_HEIGHT)}px`);
    expect(second.style.transform).toBe(`translateY(${String(DENSE_ROW_HEIGHT)}px)`);
  });
});

describe('DataTable — a pinned cell is opaque (§3, §12)', () => {
  it('marks the pinned side, and the sheet fills that side with a surface and a seam', async () => {
    const { DataTable } = await dataModule();
    render(
      <DataTable
        data={ROWS}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        state={{ columnPinning: { left: ['name'], right: [] } }}
      />,
    );

    const row = bodyRows()[0];
    if (row === undefined) throw new Error('the table rendered no row');
    const pinned = row.querySelector('[data-pinned="left"]');
    expect(pinned, 'the pinned cell carries no side for the sheet to select on').not.toBeNull();

    // jsdom applies no stylesheet, so the paint is read where it is written. `z-index` orders
    // the layers; only a fill makes the cell underneath stop showing through.
    const sheet = readFileSync(join(process.cwd(), 'src/ui/data/data.css'), 'utf8');
    expect(sheet).toContain('.datum-datatable-cell[data-pinned]');
    expect(sheet).toMatch(/\.datum-datatable-cell\[data-pinned\]\s*\{[^}]*background:/);
    expect(sheet).toMatch(/\[data-pinned='left'\][^{]*\{[^}]*border-right:/);
  });
});

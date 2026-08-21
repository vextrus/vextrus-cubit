// @vitest-environment jsdom
/**
 * DataTable: the parts of §2–§4's contract the public acceptance does not drive.
 *
 * Each of these is a promise the table makes to a reader rather than to a caller, and each one
 * is invisible to the suites that drive the happy path:
 *
 *   - a filter that leaves nothing still says why the list is empty (R-UI-020: "an empty list
 *     says why it is empty"), and the header stays so the columns teach the shape;
 *   - Escape abandons an inline edit without committing it — an edit nobody confirmed is not
 *     an edit;
 *   - a column edge answers the keyboard, because a resize a mouse can do and a keyboard
 *     cannot is a control half the users do not have (R-UI-012);
 *   - a group collapses and says so through `aria-expanded`;
 *   - `aria-rowcount` states the whole extent even though the DOM holds one window of it.
 *
 * No shims: like the acceptance suites, this runs in a jsdom with no observers in it.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DataTableColumn } from '../index';

type DataModule = typeof import('../index');

const dataModule = async (): Promise<DataModule> => await import('../index');

/** Copy and values the fixtures need; JSX carries no string literal (R-SPINE-060). */
const NAME_HEADER = 'Name';
const DEPT_HEADER = 'Department';
const QTY_HEADER = 'Quantity';
const EMPTY_REASON = 'No lines match this filter yet.';
const NO_MATCH = 'zzzz-no-such-line';
const TYPED = '42';

const HEIGHT = 600;
const ROW_HEIGHT = 40;

/** TanStack's default column width, which a keyboard resize moves by one `--space-2`. */
const DEFAULT_WIDTH = 150;
const RESIZE_STEP = 8;

interface Row {
  readonly id: string;
  readonly name: string;
  readonly dept: string;
  readonly qty: string;
}

const ROWS: readonly Row[] = [
  { id: 'row-1', name: 'Charlie', dept: 'North', qty: '5' },
  { id: 'row-2', name: 'Alpha', dept: 'South', qty: '9' },
  { id: 'row-3', name: 'Echo', dept: 'North', qty: '1' },
  { id: 'row-4', name: 'Bravo', dept: 'South', qty: '7' },
  { id: 'row-5', name: 'Delta', dept: 'North', qty: '3' },
  { id: 'row-6', name: 'Foxtrot', dept: 'South', qty: '2' },
];

const getRowId = (row: Row): string => row.id;

/** §3's marker, pre-declared so the object literal is not checked against `ColumnMeta` here. */
const EDITABLE = { editable: true };

function columnsFor(): DataTableColumn<Row>[] {
  return [
    { id: 'name', accessorKey: 'name', header: NAME_HEADER, enableSorting: true },
    { id: 'dept', accessorKey: 'dept', header: DEPT_HEADER, enableSorting: false },
    { id: 'qty', accessorKey: 'qty', header: QTY_HEADER, enableSorting: false, meta: EDITABLE },
  ];
}

const bodyRows = (): HTMLElement[] => screen.queryAllByTestId('datatable-row');

function rowFor(name: string): HTMLElement {
  const found = bodyRows().find((row) => (row.textContent ?? '').includes(name));
  if (found === undefined) throw new Error(`no datatable-row renders ${name}`);
  return found;
}

/** The leaf element that carries exactly this text — the cell's content, whatever wraps it. */
function leafWithText(root: HTMLElement, text: string): HTMLElement {
  const leaves = [...root.querySelectorAll<HTMLElement>('*')].filter(
    (element) => element.children.length === 0 && (element.textContent ?? '').trim() === text,
  );
  const first = leaves[0];
  if (first === undefined) throw new Error(`no element under this row reads ${text}`);
  return first;
}

function inlineWidths(): number[] {
  const widths: number[] = [];
  for (const element of screen.getByTestId('datatable').querySelectorAll<HTMLElement>('*')) {
    const match = /^(\d+(?:\.\d+)?)px$/.exec(element.style.width.trim());
    const digits = match?.[1];
    if (digits !== undefined) widths.push(Number(digits));
  }
  return widths;
}

afterEach(cleanup);

describe('DataTable — a filtered-out table is not a silent one (R-UI-020)', () => {
  it('renders the empty reason, and keeps the header, when nothing survives the filter', async () => {
    const { DataTable } = await dataModule();
    render(
      <DataTable
        data={ROWS}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        globalFilter={NO_MATCH}
      />,
    );

    expect(bodyRows().length).toBe(0);
    expect((screen.getByTestId('datatable-empty').textContent ?? '').trim()).toBe(EMPTY_REASON);
    // The columns still teach the shape of what is missing (§4).
    expect(screen.getByTestId('datatable-header')).toBeDefined();
  });

  it('states the whole extent through aria-rowcount, not the window’s (§2)', async () => {
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
  });
});

describe('DataTable — an edit nobody confirmed is not an edit (§3)', () => {
  it('reverts on Escape without calling onCellEdit', async () => {
    const { DataTable } = await dataModule();
    const onCellEdit = vi.fn();
    render(
      <DataTable
        data={ROWS}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        onCellEdit={onCellEdit}
      />,
    );

    const target = ROWS[1];
    if (target === undefined) throw new Error('the fixture lost its second row');
    fireEvent.click(leafWithText(rowFor(target.name), target.qty));

    const input = screen.getByTestId('datatable-edit-cell');
    fireEvent.change(input, { target: { value: TYPED } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onCellEdit).not.toHaveBeenCalled();
    expect(screen.queryByTestId('datatable-edit-cell')).toBeNull();
    // The cell reads what it always read: the owner's value, unchanged.
    expect(leafWithText(rowFor(target.name), target.qty)).toBeDefined();
  });
});

describe('DataTable — a column edge answers the keyboard (R-UI-012, §3)', () => {
  it('widens a column by one step on ArrowRight', async () => {
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

    expect(inlineWidths()).toContain(DEFAULT_WIDTH);

    const handles = within(screen.getByTestId('datatable-header')).getAllByRole('separator');
    const first = handles[0];
    if (first === undefined) throw new Error('no column carries a resize handle');
    fireEvent.keyDown(first, { key: 'ArrowRight' });

    expect(inlineWidths()).toContain(DEFAULT_WIDTH + RESIZE_STEP);
  });
});

describe('DataTable — a group says whether it is open (§3)', () => {
  it('collapses its members and reports it through aria-expanded', async () => {
    const { DataTable } = await dataModule();
    render(
      <DataTable
        data={ROWS}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        state={{ grouping: ['dept'] }}
      />,
    );

    // Groups mount expanded: every member is on screen under its group (§3).
    expect(bodyRows().length).toBe(ROWS.length);

    const group = screen.getAllByTestId('datatable-group-row')[0];
    if (group === undefined) throw new Error('grouping rendered no group row');
    const chevron = within(group).getByRole('button');
    expect(chevron.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(chevron);

    expect(bodyRows().length).toBeLessThan(ROWS.length);
    const collapsed = screen.getAllByTestId('datatable-group-row')[0];
    if (collapsed === undefined) throw new Error('the group row vanished when it collapsed');
    expect(within(collapsed).getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });
});

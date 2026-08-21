// @vitest-environment jsdom
/**
 * inc-006 acceptance — the DataTable (AC-1, AC-2; R-UI-010).
 *
 * R-UI-010 asks for "DataTable (TanStack; column pin/resize/sort/filter/group; virtualised;
 * sticky header/footer; row selection; inline edit cell)". AC-1 fixes the virtualisation in
 * numbers the props carry — 50,000 rows, `height={600}`, `estimateRowHeight={40}` — and AC-2
 * fixes the seven behaviours on top of it.
 *
 * The environment is the assertion, not a detail: this suite installs no shim of any kind, so
 * `ResizeObserver` and `IntersectionObserver` are undefined throughout. The Increment Spec's
 * procedures say the window is computed "from its `height` and `estimateRowHeight` props,
 * never from measured layout"; a component that reaches for a measurement here does not mount
 * at all, which is exactly the red the spec asks for.
 *
 * Every assertion is written against a rule rather than a snapshot of one implementation:
 *   - the window is bounded by the viewport the props describe (600 / 40 = 15 rows) below and
 *     by AC-1's ceiling of 100 above — not by an exact count some overscan setting produces;
 *   - the group-row count is derived from the fixture's own distinct values, so a fixture with
 *     one more department needs no edit here;
 *   - stickiness is "position: sticky reaches this element", however the module applies it —
 *     inline, computed, or through a rule in its own stylesheet;
 *   - the selection payload is decoded from any of the three shapes an `OnChangeFn` may hand
 *     back (an updater, a record, a list of ids), because AC-2 fixes *which ids are reported*
 *     and not the callback's calling convention.
 *
 * The barrel is loaded inside each test so a module that does not exist yet reads as one
 * missing behaviour per test rather than a single collection error.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DataTableColumn } from '../index';

type DataModule = typeof import('../index');

/** The barrel, per test (see the file header). */
const dataModule = async (): Promise<DataModule> => await import('../index');

/** The module's own stylesheet — where a `position: sticky` rule may lawfully live. */
const DATA_CSS = 'src/ui/data/data.css';

/** AC-1's numbers, spelled once: the viewport the window is computed from. */
const HEIGHT = 600;
const ROW_HEIGHT = 40;
const BIG_ROWS = 50_000;

/** 600 / 40 — the rows a viewport of this height holds at this density. */
const VIEWPORT_ROWS = HEIGHT / ROW_HEIGHT;

/** AC-1: "renders at most 100 elements with data-testid='datatable-row' at any scroll offset". */
const WINDOW_CEILING = 100;

/** Copy and values the fixtures need; JSX carries no string literal (R-SPINE-060). */
const NAME_HEADER = 'Name';
const DEPT_HEADER = 'Department';
const QTY_HEADER = 'Quantity';
const EMPTY_REASON = 'No lines match this filter yet.';
const FOOTER_TEXT = '6 lines';
const NEW_QTY = '42';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly dept: string;
  readonly qty: string;
}

/**
 * The six-row fixture the behaviour tests drive. Deliberately not in name order: a sort that
 * reorders nothing proves nothing.
 */
const SMALL: readonly Row[] = [
  { id: 'row-1', name: 'Charlie', dept: 'North', qty: '5' },
  { id: 'row-2', name: 'Alpha', dept: 'South', qty: '9' },
  { id: 'row-3', name: 'Echo', dept: 'North', qty: '1' },
  { id: 'row-4', name: 'Bravo', dept: 'South', qty: '7' },
  { id: 'row-5', name: 'Delta', dept: 'North', qty: '3' },
  { id: 'row-6', name: 'Foxtrot', dept: 'South', qty: '2' },
];

/** AC-1's dataset: 50,000 rows, generated in-memory by the test (no fixture file exists). */
function bigRows(count: number): Row[] {
  const made: Row[] = [];
  for (let index = 0; index < count; index += 1) {
    made.push({
      id: `row-${String(index)}`,
      name: `Item ${String(index).padStart(5, '0')}`,
      dept: index % 2 === 0 ? SMALL[0]?.dept ?? '' : SMALL[1]?.dept ?? '',
      qty: String(index % 97),
    });
  }
  return made;
}

const getRowId = (row: Row): string => row.id;

/**
 * Column `meta` is handed over as a pre-declared object rather than an inline literal:
 * TanStack's `ColumnMeta` is an empty interface until a module augments it, and an object
 * literal would then trip the excess-property check inside this test file. What the table
 * reads is the design decision's §3 marker — `meta: { editable: true }`.
 */
const EDITABLE = { editable: true };

function columnsFor(): DataTableColumn<Row>[] {
  return [
    { id: 'name', accessorKey: 'name', header: NAME_HEADER, enableSorting: true },
    { id: 'dept', accessorKey: 'dept', header: DEPT_HEADER, enableSorting: false },
    { id: 'qty', accessorKey: 'qty', header: QTY_HEADER, enableSorting: false, meta: EDITABLE },
  ];
}

/** The five TanStack slices AC-2 drives, always passed whole so a partial shape is never guessed. */
interface ControlledState {
  sorting: { id: string; desc: boolean }[];
  grouping: string[];
  columnPinning: { left: string[]; right: string[] };
  columnSizing: Record<string, number>;
  rowSelection: Record<string, boolean>;
}

function tableState(overrides: Partial<ControlledState>): ControlledState {
  return {
    sorting: [],
    grouping: [],
    columnPinning: { left: [], right: [] },
    columnSizing: {},
    rowSelection: {},
    ...overrides,
  };
}

const noop = (): void => {
  /* a controlled table needs a handler, not a state machine, to render */
};

// ─── reading the rendered table ────────────────────────────────────────────────────────────

const table = (): HTMLElement => screen.getByTestId('datatable');
const bodyRows = (): HTMLElement[] => screen.queryAllByTestId('datatable-row');

/** The trimmed text of every rendered row, in DOM order. */
const rowTexts = (): string[] => bodyRows().map((row) => (row.textContent ?? '').trim());

/** The row index a generated name carries (`Item 49999` → 49999). */
function renderedIndices(): number[] {
  const found: number[] = [];
  for (const text of rowTexts()) {
    const match = /Item (\d{5})/.exec(text);
    const digits = match?.[1];
    if (digits !== undefined) found.push(Number(digits));
  }
  return found;
}

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

/**
 * Scroll the table to an offset without knowing which element is the scroll container: every
 * element in the subtree is moved and told, and the one that listens reacts. jsdom has no
 * layout, so `scrollTop` is a plain stored value and a dispatched `scroll` event is the only
 * signal a virtualiser can be reading.
 */
function scrollTo(offset: number): void {
  const root = table();
  const elements: HTMLElement[] = [root, ...root.querySelectorAll<HTMLElement>('*')];
  act(() => {
    for (const element of elements) {
      element.scrollTop = offset;
      element.dispatchEvent(new Event('scroll'));
    }
  });
}

// ─── stickiness, however it is applied ─────────────────────────────────────────────────────

function stylesheet(): string {
  const path = join(process.cwd(), DATA_CSS);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/**
 * True when the module's own stylesheet declares `position: sticky` for this element.
 *
 * The rule being proved is R-UI-010's, as this file states it: `position: sticky` *reaches this
 * element*. So the sheet is read the way a browser reads it — each sticky-declaring rule's
 * selector list is split on commas and offered to jsdom's own selector engine. A substring test
 * over the selector text would accept a rule for a longer class name
 * (`.datum-datatable-header-ghost` for `.datum-datatable-header`) or a state-scoped rule
 * (`:hover`) that never selects the element as rendered; `matches` enforces the class-token
 * boundary and leaves interaction pseudo-classes unmatched in the default state, closing both.
 */
function sheetDeclaresSticky(element: HTMLElement): boolean {
  // Comments come out first: a brace inside prose would corrupt the `}` split below.
  const sheet = stylesheet().replace(/\/\*[\s\S]*?\*\//g, '');

  for (const chunk of sheet.split('}')) {
    // The declaration block is whatever follows the *last* opener in the chunk, so an at-rule
    // wrapper (`@media … { .sel {`) is unwrapped instead of being read as the selector.
    const open = chunk.lastIndexOf('{');
    if (open === -1) continue;
    const body = chunk.slice(open + 1).replace(/\s+/g, '');
    if (!body.includes('position:sticky')) continue;

    const prelude = chunk.slice(0, open);
    const nested = prelude.lastIndexOf('{');
    const selectorList = nested === -1 ? prelude : prelude.slice(nested + 1);

    for (const selector of selectorList.split(',')) {
      const trimmed = selector.trim();
      if (trimmed === '' || trimmed.startsWith('@')) continue;
      try {
        if (element.matches(trimmed)) return true;
      } catch {
        // An unparseable selector selects nothing here, so it is not a match.
      }
    }
  }
  return false;
}

function isSticky(element: HTMLElement): boolean {
  if (element.style.position === 'sticky') return true;
  const view = element.ownerDocument.defaultView;
  if (view !== null && view.getComputedStyle(element).position === 'sticky') return true;
  return sheetDeclaresSticky(element);
}

/** This element or the nearest ancestor inside `boundary` that is sticky, or null. */
function stickyWithin(element: HTMLElement, boundary: HTMLElement): HTMLElement | null {
  let walk: HTMLElement | null = element;
  while (walk !== null) {
    if (isSticky(walk)) return walk;
    if (walk === boundary) return null;
    walk = walk.parentElement;
  }
  return null;
}

/** Every inline pixel height in the subtree — the virtual spacer is the tallest of them. */
function tallestInlineHeight(root: HTMLElement): number {
  let tallest = 0;
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    for (const raw of [element.style.height, element.style.minHeight]) {
      const match = /^(\d+(?:\.\d+)?)px$/.exec(raw.trim());
      const digits = match?.[1];
      if (digits !== undefined) tallest = Math.max(tallest, Number(digits));
    }
  }
  return tallest;
}

/** The sort control of a named column, however the module names it. */
function sortControlFor(label: string): HTMLElement {
  const header = screen.getByTestId('datatable-header');
  const controls = within(header).getAllByTestId('datatable-sort');
  const named = controls.find((control) => {
    if ((control.textContent ?? '').includes(label)) return true;
    if ((control.getAttribute('aria-label') ?? '').includes(label)) return true;
    const cell = control.closest('[role="columnheader"]');
    return cell !== null && (cell.textContent ?? '').includes(label);
  });
  if (named === undefined) throw new Error(`no datatable-sort control for the ${label} column`);
  return named;
}

/** Every inline pixel width in the subtree, as numbers. */
function inlineWidths(root: HTMLElement): number[] {
  const widths: number[] = [];
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    const match = /^(\d+(?:\.\d+)?)px$/.exec(element.style.width.trim());
    const digits = match?.[1];
    if (digits !== undefined) widths.push(Number(digits));
  }
  return widths;
}

/**
 * The selected ids a report carries, whichever of the three shapes an `OnChangeFn` hands
 * over: an updater to apply to the previous record, the record itself, or a list of ids.
 * AC-2 fixes *which ids are reported* (the `getRowId` values), never the calling convention.
 */
function selectedIds(report: unknown, previous: Record<string, boolean>): string[] {
  const value =
    typeof report === 'function'
      ? (report as (old: Record<string, boolean>) => unknown)(previous)
      : report;
  if (Array.isArray(value)) return [...(value as unknown[])].map((id) => String(id)).sort();
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, on]) => on === true)
      .map(([id]) => id)
      .sort();
  }
  return [];
}

/** A checkbox is checked whether it is a Radix button with aria-checked or a real input. */
function isChecked(control: HTMLElement): boolean {
  if (control.getAttribute('aria-checked') === 'true') return true;
  return control instanceof HTMLInputElement && control.checked;
}

afterEach(cleanup);

describe('AC-1 — 50,000 rows, windowed from the props (R-UI-010)', () => {
  it('mounts in a jsdom where the observers are undefined', async () => {
    // The premise, asserted rather than assumed: nothing in this file installs a shim, so a
    // component that measures its own layout cannot mount here at all.
    expect(typeof globalThis.ResizeObserver).toBe('undefined');
    expect(typeof globalThis.IntersectionObserver).toBe('undefined');

    const { DataTable } = await dataModule();
    expect(() =>
      render(
        <DataTable
          data={bigRows(BIG_ROWS)}
          columns={columnsFor()}
          getRowId={getRowId}
          height={HEIGHT}
          estimateRowHeight={ROW_HEIGHT}
          emptyReason={EMPTY_REASON}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByTestId('datatable')).toBeDefined();
  });

  it('renders one viewport of rows, never the whole dataset', async () => {
    const { DataTable } = await dataModule();
    render(
      <DataTable
        data={bigRows(BIG_ROWS)}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
      />,
    );

    // The window is the viewport the props describe: at least the 15 rows 600/40 holds, and
    // never more than AC-1's ceiling of 100. Overscan lives between the two.
    const count = bodyRows().length;
    expect(count).toBeGreaterThanOrEqual(VIEWPORT_ROWS);
    expect(count).toBeLessThanOrEqual(WINDOW_CEILING);

    // At the top of the dataset the window is the top of the dataset.
    expect(renderedIndices()).toContain(0);
  });

  it('sizes its spacer for all 50,000 rows, not for the window', async () => {
    const { DataTable } = await dataModule();
    render(
      <DataTable
        data={bigRows(BIG_ROWS)}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
      />,
    );

    // AC-1: "the inner spacer's total height accounts for all 50,000 rows" — the scrollbar a
    // reader drags is the whole dataset's, which is what makes the window invisible.
    expect(tallestInlineHeight(table())).toBeGreaterThanOrEqual(BIG_ROWS * ROW_HEIGHT);
  });

  it('renders the far end of the data after the scroll offset moves there', async () => {
    const { DataTable } = await dataModule();
    render(
      <DataTable
        data={bigRows(BIG_ROWS)}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
      />,
    );

    scrollTo(BIG_ROWS * ROW_HEIGHT - HEIGHT);

    const indices = renderedIndices();
    expect(indices.length).toBeGreaterThan(0);
    // The last screen of a 50,000-row list is the last screen of it: within a hundred rows of
    // the end, never row 0 still sitting there.
    expect(Math.max(...indices)).toBeGreaterThanOrEqual(BIG_ROWS - WINDOW_CEILING);
    expect(bodyRows().length).toBeLessThanOrEqual(WINDOW_CEILING);
  });

  it('keeps header and footer sticky (R-UI-010: sticky header/footer)', async () => {
    const { DataTable } = await dataModule();
    render(
      <DataTable
        data={bigRows(BIG_ROWS)}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        footer={<span>{FOOTER_TEXT}</span>}
      />,
    );

    const header = screen.getByTestId('datatable-header');
    const footer = screen.getByTestId('datatable-footer');
    expect(isSticky(header), 'the header does not use sticky positioning').toBe(true);
    expect(isSticky(footer), 'the footer does not use sticky positioning').toBe(true);
    expect((footer.textContent ?? '').includes(FOOTER_TEXT)).toBe(true);
  });
});

describe('AC-2 — sort, filter, select, edit, group, pin, resize (R-UI-010)', () => {
  it('cycles a sortable column ascending then descending, and reorders the rows', async () => {
    const { DataTable } = await dataModule();
    render(
      <DataTable
        data={SMALL}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
      />,
    );

    const sorted = [...SMALL].map((row) => row.name).sort();
    const first = sorted[0] ?? '';
    const last = sorted[sorted.length - 1] ?? '';

    // Unsorted, the fixture's own order.
    expect(rowTexts()[0] ?? '').toContain(SMALL[0]?.name ?? '');

    fireEvent.click(sortControlFor(NAME_HEADER));
    expect(rowTexts()[0] ?? '', 'the first activation did not sort ascending').toContain(first);

    fireEvent.click(sortControlFor(NAME_HEADER));
    expect(rowTexts()[0] ?? '', 'the second activation did not sort descending').toContain(last);
  });

  it('narrows the visible rows through the globalFilter prop', async () => {
    const { DataTable } = await dataModule();
    const target = SMALL[4]?.name ?? '';
    const view = render(
      <DataTable
        data={SMALL}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
      />,
    );
    expect(bodyRows().length).toBe(SMALL.length);

    view.rerender(
      <DataTable
        data={SMALL}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        globalFilter={target}
      />,
    );

    expect(bodyRows().length).toBe(1);
    expect(rowTexts()[0] ?? '').toContain(target);
  });

  it('reports the getRowId values of selected rows through onRowSelectionChange', async () => {
    const { DataTable } = await dataModule();
    const onRowSelectionChange = vi.fn();
    render(
      <DataTable
        data={SMALL}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        enableRowSelection
        onRowSelectionChange={onRowSelectionChange}
      />,
    );

    // One checkbox per row (R-UI-010: row selection).
    expect(screen.getAllByTestId('datatable-select-row').length).toBe(SMALL.length);

    const chosen = SMALL[1];
    if (chosen === undefined) throw new Error('the fixture lost its second row');
    const control = within(rowFor(chosen.name)).getByTestId('datatable-select-row');
    fireEvent.click(control);

    expect(onRowSelectionChange).toHaveBeenCalled();
    const report: unknown = onRowSelectionChange.mock.calls.at(-1)?.[0];
    // The id is the one `getRowId` gave, never the row's position — an index-keyed selection
    // means something different after the next sort.
    expect(selectedIds(report, {})).toEqual([chosen.id]);
    expect(isChecked(control), 'the selected row does not read as checked').toBe(true);
  });

  it('activates an editable cell into an input and commits through onCellEdit', async () => {
    const { DataTable } = await dataModule();
    const onCellEdit = vi.fn();
    render(
      <DataTable
        data={SMALL}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        onCellEdit={onCellEdit}
      />,
    );

    const target = SMALL[1];
    if (target === undefined) throw new Error('the fixture lost its second row');
    expect(screen.queryByTestId('datatable-edit-cell')).toBeNull();

    fireEvent.click(leafWithText(rowFor(target.name), target.qty));

    const input = screen.getByTestId('datatable-edit-cell');
    fireEvent.change(input, { target: { value: NEW_QTY } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // (rowId, columnId, value) — the owner of the data decides what to do with it; the table
    // never mutates the rows it was handed.
    expect(onCellEdit).toHaveBeenCalledWith(target.id, 'qty', NEW_QTY);
  });

  it('renders one group row per distinct value when state.grouping is set', async () => {
    const { DataTable } = await dataModule();
    const departments = [...new Set(SMALL.map((row) => row.dept))];
    render(
      <DataTable
        data={SMALL}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        state={tableState({ grouping: ['dept'] })}
        onStateChange={noop}
      />,
    );

    const groups = screen.getAllByTestId('datatable-group-row');
    // Derived from the fixture, not frozen: a seventh row in a third department needs no edit.
    expect(groups.length).toBe(departments.length);
    const text = groups.map((group) => group.textContent ?? '').join(' | ');
    for (const department of departments) expect(text).toContain(department);
  });

  it('keeps a pinned column sticky and sizes a column from state.columnSizing', async () => {
    const { DataTable } = await dataModule();
    const wide = 320;
    const narrow = 200;
    const view = render(
      <DataTable
        data={SMALL}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        state={tableState({
          columnPinning: { left: ['name'], right: [] },
          columnSizing: { name: wide },
        })}
        onStateChange={noop}
      />,
    );

    // Pinned: the cell still renders, and it is sticky rather than scrolling away.
    const target = SMALL[0];
    if (target === undefined) throw new Error('the fixture lost its first row');
    const row = rowFor(target.name);
    const cell = leafWithText(row, target.name);
    expect(
      stickyWithin(cell, row),
      'the pinned column’s cell does not use sticky positioning',
    ).not.toBeNull();

    // Sized: the prop is what sets the width, so changing it changes the width.
    expect(inlineWidths(table())).toContain(wide);
    view.rerender(
      <DataTable
        data={SMALL}
        columns={columnsFor()}
        getRowId={getRowId}
        height={HEIGHT}
        estimateRowHeight={ROW_HEIGHT}
        emptyReason={EMPTY_REASON}
        state={tableState({
          columnPinning: { left: ['name'], right: [] },
          columnSizing: { name: narrow },
        })}
        onStateChange={noop}
      />,
    );
    expect(inlineWidths(table())).toContain(narrow);
    expect(inlineWidths(table())).not.toContain(wide);
  });
});

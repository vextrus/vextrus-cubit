// @vitest-environment jsdom
/**
 * AC-4 / AC-5 — the DataTable: structure, density, alignment, sort, filter, virtualisation and
 * pinning (R-UI-005, R-UI-010, Q-11, B-19).
 *
 * Every expected value is DERIVED from the fixture the test itself passes in — the ascending order
 * is the fixture's own quantities sorted, the filtered row count is the fixture filtered, the
 * total scroll extent is the fixture's length times the smaller of R-UI-005's two row heights.
 * Nothing is a transcript of what a run happened to print.
 *
 * jsdom lays nothing out, so the geometry the criteria claim is asserted through the attributes the
 * closed contract fixes (`data-density`, `data-align`, `data-pinned`, `aria-sort`) and through the
 * measurement stubs the increment's test procedures name; 36/28 px rows, hairlines and sticky
 * positioning are graded by the gallery leaf's J-004 baselines.
 */
import { afterEach, describe, expect, test } from "vitest";
import { waitFor } from "@testing-library/react";
import type { Barrels, KeyboardUser } from "./support/primitives";
import {
  COLUMN_IDS,
  ROW_HEIGHT_COMPACT_PX,
  TABLE_ROWS,
  TESTIDS,
  VIRTUAL_ROW_COUNT,
  allTestId,
  filterTestId,
  formatQty,
  dt,
  getRowId,
  keyboardUser,
  loadBarrels,
  requireTestId,
  tabUntil,
  tableColumns,
  textOf,
  virtualRows,
} from "./support/primitives";
import { VIEWPORT_HEIGHT_PX, mount, scrollViewport, unmountAll } from "./support/render";

afterEach(() => {
  unmountAll();
});

const table = (
  b: Barrels,
  props: Record<string, unknown> = {},
  rows: readonly unknown[] = TABLE_ROWS,
): ReturnType<typeof dt> =>
  dt(b, "DataTable", { columns: tableColumns(), data: rows, getRowId, ...props });

const rootOf = (): HTMLElement =>
  requireTestId(document.body, TESTIDS.datatable, "AC-4: the DataTable renders a root testid");

const rows = (): HTMLElement[] => allTestId(document.body, TESTIDS.datatableRow);

/** A row's quantity cell is the one whose text carries the two-decimal shape the column renders. */
const QTY_SHAPE = /^-?\d+\.\d{2}$/;
const qtyCell = (row: HTMLElement): HTMLElement | undefined =>
  allTestId(row, TESTIDS.datatableCell).find((cell) => QTY_SHAPE.test(textOf(cell)));

const renderedQuantities = (): string[] =>
  rows()
    .map((row) => textOf(qtyCell(row)))
    .filter((text) => text !== "");

const columnHeader = (label: string): HTMLElement => {
  const header = requireTestId(document.body, TESTIDS.datatableHeader, "AC-4: the DataTable renders a header");
  const hit = [...header.querySelectorAll('[role="columnheader"]')].find((cell) =>
    (cell.textContent ?? "").includes(label),
  );
  expect(hit, `AC-4: no role="columnheader" reads \`${label}\``).toBeTruthy();
  return hit as HTMLElement;
};

const sortStateOf = (label: string): string => columnHeader(label).getAttribute("aria-sort") ?? "none";

/** Reach the sortable column's sort control by Tab travel and press Enter (Q-11). */
async function activateSort(user: KeyboardUser, label: string): Promise<void> {
  const button = columnHeader(label).querySelector("button");
  expect(
    button,
    `AC-4: the \`${label}\` column header renders a keyboard-reachable sort button (Design Decision §3)`,
  ).toBeTruthy();
  await tabUntil(user, (active) => active === button, `the \`${label}\` sort button`);
  await user.keyboard("{Enter}");
}

describe("AC-4: DataTable structure, density and alignment", () => {
  test("AC-4: it renders the root, a header and one row per visible row", async () => {
    const b = await loadBarrels();
    mount(table(b));

    rootOf();
    requireTestId(document.body, TESTIDS.datatableHeader, "AC-4: the DataTable renders a header");
    expect(rows().length, "AC-4: one datatable-row per visible row of the data prop").toBe(TABLE_ROWS.length);
  });

  test("AC-4: density defaults to comfortable and reflects the prop as data-density", async () => {
    const b = await loadBarrels();
    mount(table(b));
    expect(
      rootOf().getAttribute("data-density"),
      'AC-4: density defaults to "comfortable", reflected as data-density on the root (R-UI-005)',
    ).toBe("comfortable");

    unmountAll();
    mount(table(b, { density: "compact" }));
    expect(
      rootOf().getAttribute("data-density"),
      'AC-4: density="compact" is reflected as data-density on the root (R-UI-005)',
    ).toBe("compact");
  });

  test("AC-4: only the meta.align \"right\" column's cells carry data-align=\"right\"", async () => {
    const b = await loadBarrels();
    mount(table(b));

    const aligned: string[] = [];
    const misaligned: string[] = [];
    for (const row of rows()) {
      for (const cell of allTestId(row, TESTIDS.datatableCell)) {
        const isQty = QTY_SHAPE.test(textOf(cell));
        const flag = cell.getAttribute("data-align");
        if (isQty && flag !== "right") misaligned.push(`the quantity cell \`${textOf(cell)}\` has data-align=${String(flag)}`);
        if (!isQty && flag === "right") misaligned.push(`the cell \`${textOf(cell)}\` is right-aligned but its column declares no meta.align`);
        if (isQty && flag === "right") aligned.push(textOf(cell));
      }
    }
    expect(misaligned, "AC-4: meta.align \"right\" — and only it — renders data-align=\"right\" (R-UI-005)").toEqual([]);
    expect(aligned.length, "AC-4: every row renders its right-aligned quantity cell").toBe(TABLE_ROWS.length);
  });
});

describe("AC-4: DataTable sorting", () => {
  test("AC-4: the sort control cycles aria-sort ascending → descending → none, reordering rows", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("AC-4 sorting");
    const header = tableColumns().find((c) => c.id === COLUMN_IDS.qty)?.header ?? COLUMN_IDS.qty;
    mount(table(b));

    const unsorted = TABLE_ROWS.map((r) => formatQty(r.qty));
    const ascending = [...TABLE_ROWS].map((r) => r.qty).sort((x, y) => x - y).map(formatQty);
    const descending = [...ascending].reverse();

    expect(sortStateOf(header), "AC-4: a sortable column starts unsorted").toBe("none");
    expect(renderedQuantities(), "AC-4: unsorted rows keep the data prop's order").toEqual(unsorted);

    await activateSort(user, header);
    await waitFor(() => {
      expect(sortStateOf(header), "AC-4: the first activation sorts ascending").toBe("ascending");
    });
    expect(renderedQuantities(), "AC-4: ascending reorders the rows accordingly").toEqual(ascending);

    await activateSort(user, header);
    await waitFor(() => {
      expect(sortStateOf(header), "AC-4: the second activation sorts descending").toBe("descending");
    });
    expect(renderedQuantities(), "AC-4: descending reorders the rows accordingly").toEqual(descending);

    await activateSort(user, header);
    await waitFor(() => {
      expect(sortStateOf(header), "AC-4: the third activation returns the column to unsorted").toBe("none");
    });
    expect(renderedQuantities(), "AC-4: unsorted restores the data prop's order").toEqual(unsorted);
  });
});

describe("AC-4: DataTable filtering", () => {
  test("AC-4: a meta.filterable column renders datatable-filter-{columnId}, and typing narrows the rows", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("AC-4 filtering");
    mount(table(b));

    const filter = requireTestId(
      document.body,
      filterTestId(COLUMN_IDS.item),
      `AC-4: the meta.filterable \`${COLUMN_IDS.item}\` column renders its filter input`,
    );
    expect(
      allTestId(document.body, filterTestId(COLUMN_IDS.element)).length,
      "AC-4: a column without meta.filterable renders no filter input",
    ).toBe(0);

    const query = TABLE_ROWS[3]?.item ?? "";
    const expected = TABLE_ROWS.filter((r) => r.item.toLowerCase().includes(query.toLowerCase()));
    expect(expected.length, "the fixture must make this query selective").toBeLessThan(TABLE_ROWS.length);

    await user.type(filter, query);

    await waitFor(() => {
      expect(rows().length, `AC-4: typing \`${query}\` narrows the rendered rows to the matching set`).toBe(
        expected.length,
      );
    });
    expect(
      rows().map((row) => textOf(row)).join(" | "),
      "AC-4: the surviving rows are the matching ones",
    ).toContain(query);
  });
});

describe("AC-5: DataTable virtualisation and pinning", () => {
  test("AC-5: a thousand rows render a windowed set over a full-length scroll extent", async () => {
    const b = await loadBarrels();
    const data = virtualRows();
    mount(table(b, {}, data));

    const viewport = requireTestId(
      document.body,
      TESTIDS.datatableViewport,
      "AC-5: the DataTable renders a scroll container",
    );
    const header = requireTestId(document.body, TESTIDS.datatableHeader, "AC-5: the header is rendered");

    expect(
      rows().length,
      `AC-5: ${VIRTUAL_ROW_COUNT} rows over a ${VIEWPORT_HEIGHT_PX} px viewport must render a window, not the whole list`,
    ).toBeLessThan(100);
    expect(rows().length, "AC-5: the window is not empty").toBeGreaterThan(0);

    const totalPx = largestInlineHeightPx(viewport);
    const floor = VIRTUAL_ROW_COUNT * ROW_HEIGHT_COMPACT_PX;
    expect(
      totalPx,
      `AC-5: the virtualiser's total-size element must span all ${VIRTUAL_ROW_COUNT} rows — at least ${floor} px, the row count times the smaller of R-UI-005's two row heights`,
    ).toBeGreaterThanOrEqual(floor);

    const rowPx = totalPx / VIRTUAL_ROW_COUNT;
    const firstLabels = new Set(rows().map((row) => textOf(row.querySelector(`[data-testid="${TESTIDS.datatableCell}"]`))));
    const targetIndex = Math.floor(VIRTUAL_ROW_COUNT / 2);
    await scrollViewport(viewport, targetIndex * rowPx);

    // A window plus whatever overscan the virtualiser keeps on each side — generous, because the
    // criterion is "rows near that offset", not a particular overscan setting.
    const tolerance = Math.ceil(VIEWPORT_HEIGHT_PX / rowPx) + 40;
    await waitFor(() => {
      const indices = renderedRowIndices(data.length);
      expect(indices.length, "AC-5: rows are rendered after the scroll").toBeGreaterThan(0);
      expect(
        indices.some((i) => Math.abs(i - targetIndex) <= tolerance),
        `AC-5: after scrolling to row ~${targetIndex} the rendered rows must be near that offset — got ${indices.slice(0, 5).join(", ")}…`,
      ).toBe(true);
    });

    const nowLabels = rows().map((row) => textOf(row.querySelector(`[data-testid="${TESTIDS.datatableCell}"]`)));
    expect(
      nowLabels.filter((label) => firstLabels.has(label)),
      "AC-5: the first rows are no longer rendered once the viewport is scrolled far into the list",
    ).toEqual([]);
    expect(document.body.contains(header), "AC-5: the sticky header stays rendered throughout").toBe(true);
  });

  test("AC-5: every visible cell of a pinned column carries data-pinned", async () => {
    const b = await loadBarrels();
    mount(table(b, { columnPinning: { left: [COLUMN_IDS.item] } }));

    const pinnedText = new Set(TABLE_ROWS.map((r) => r.item));
    const wrong: string[] = [];
    let pinnedSeen = 0;
    for (const row of rows()) {
      for (const cell of allTestId(row, TESTIDS.datatableCell)) {
        const text = textOf(cell);
        const flag = cell.getAttribute("data-pinned");
        if (pinnedText.has(text)) {
          pinnedSeen += 1;
          if (flag !== "left") wrong.push(`the pinned cell \`${text}\` has data-pinned=${String(flag)}`);
        } else if (flag !== null) {
          wrong.push(`the unpinned cell \`${text}\` has data-pinned="${flag}"`);
        }
      }
    }
    expect(wrong, 'AC-5: a column pinned via columnPinning renders every visible cell with data-pinned="left"').toEqual([]);
    expect(pinnedSeen, "AC-5: every visible row contributes a cell of the pinned column").toBe(TABLE_ROWS.length);
  });
});

/** The largest inline `height: …px` inside the viewport — the virtualiser's total-size element. */
function largestInlineHeightPx(viewport: HTMLElement): number {
  let largest = 0;
  for (const node of viewport.querySelectorAll("*")) {
    const height = (node as HTMLElement).style?.height ?? "";
    const match = /^([\d.]+)px$/.exec(height.trim());
    if (match) largest = Math.max(largest, Number(match[1]));
  }
  expect(
    largest,
    "AC-5: the scroll container holds no element with an inline pixel height — a virtualiser sizes its total extent so the scrollbar reflects the whole list",
  ).toBeGreaterThan(0);
  return largest;
}

/** The 1-based row numbers currently rendered, read out of the generated `Line {n}` item copy. */
function renderedRowIndices(count: number): number[] {
  const out: number[] = [];
  for (const row of rows()) {
    const match = /Line (\d+)/.exec(textOf(row));
    if (!match) continue;
    const n = Number(match[1]);
    if (n >= 1 && n <= count) out.push(n - 1);
  }
  return out;
}

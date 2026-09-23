// @vitest-environment jsdom
/**
 * DataTable v2 — §5 rules 4 and 9 together: a GROUPED list past 200 rows is a window too.
 *
 * The grid used to refuse a window whenever it drew group rows ("a virtualiser needs every row to be
 * one height"), which was never true of this grid: a group header is one `--row-h` like every line,
 * and the craft look measured all 434 rows of the served register at exactly 28 px. The refusal
 * cost the register its whole list in the document — 23,447 nodes, a 3 MB page, and an axe walk of
 * 13–14 s per capture (craft look, session 7). The window now runs over the ITEMS the body draws —
 * group headers and lines alike — so a grouped register costs a screenful like any other.
 *
 * What a window may not cost is asserted beside it: every group row keeps the subtotal of the rows
 * it HAS (not of the rows the window happens to hold), `aria-rowindex` still counts every row the
 * reader can reach, and a row asked for by id is drawn wherever the window stands.
 */
import { act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { FigureProvider, type FigureFormat } from "../../core/figures";
import { DataTable, ROW_HEIGHT_PX, VIRTUALISE_ABOVE_ROWS, subtotalsByUnit, type DataTableColumnDef } from "../data-table";
import { TESTIDS, testIdSelector } from "@/ui/testids";
import { allTestId, byTestId, mount, rowIdOf, scrollViewport, textOf, unmountAll, VIEWPORT_HEIGHT_PX, type Line } from "./support";

afterEach(() => {
  unmountAll();
});

const columns: DataTableColumnDef<Line>[] = [
  { id: "item", accessorKey: "item", header: "Item", size: 160 },
  { id: "qty", accessorKey: "qty", header: "Qty", size: 96, meta: { align: "right" } },
  { id: "unit", accessorKey: "unit", header: "Unit", size: 64 },
];

/** The register's own grouping: level · class (s-takeoff I-235). */
const group = {
  of: (row: Line) => ({ key: `${row.level}-${row.klass}`, label: `${row.level} · ${row.klass}` }),
  valueOf: (row: Line) => row.qty,
  unitOf: (row: Line) => row.unit,
};

const LEVELS = ["FOUNDATION", "GF", "1F", "2F"] as const;
const CLASSES = ["pile_cap", "column"] as const;

/** `count` lines spread over the level × class groups, in group order, figures that add exactly. */
function groupedLines(count: number): Line[] {
  const groups = LEVELS.flatMap((level) => CLASSES.map((klass) => ({ level, klass })));
  const per = Math.ceil(count / groups.length);
  return Array.from({ length: count }, (_unused, index) => {
    const at = groups[Math.floor(index / per)] ?? groups[groups.length - 1];
    return { id: `g${index + 1}`, item: `Line ${index + 1}`, level: at?.level ?? "GF", klass: at?.klass ?? "column", qty: `${index + 1}.125`, unit: "m3" };
  });
}

const root = (): HTMLElement => byTestId(document.body, TESTIDS.datatable.root) as HTMLElement;
const viewport = (): HTMLElement => byTestId(document.body, TESTIDS.datatable.viewport) as HTMLElement;
const rows = (): HTMLElement[] => allTestId(document.body, TESTIDS.datatable.row);
const groupRows = (): HTMLElement[] => allTestId(document.body, TESTIDS.datatable.groupRow);
const bodyRows = (): HTMLElement[] => [...root().querySelectorAll('.cx-table-body [role="row"]')] as HTMLElement[];

const table = (data: readonly Line[], props: Record<string, unknown> = {}) => (
  <DataTable tableId="test-grouped-window" columns={columns} data={[...data]} getRowId={rowIdOf} storage={null} group={group} {...props} />
);

/** What the window can hold at most: the viewport's rows plus the overscan either side, and the one asked for. */
const WINDOW_CEILING = Math.ceil(VIEWPORT_HEIGHT_PX / ROW_HEIGHT_PX.compact) + 2 * 8 + 1;

describe("§5 rules 4 + 9: a grouped list past 200 rows is a window", () => {
  test("a grouped register of 1,000 lines draws a window of items, and says so", async () => {
    const data = groupedLines(1000);
    mount(table(data));
    await waitFor(() => {
      expect(root().getAttribute("data-virtualised"), "§5 rule 9: a grouped list is windowed like any other").toBe("true");
    });
    await waitFor(() => {
      expect(bodyRows().length, "the window is not empty").toBeGreaterThan(0);
    });
    expect(bodyRows().length, "a window holds a screenful and its overscan, never the list").toBeLessThanOrEqual(WINDOW_CEILING);
    expect(
      root().getAttribute("data-rows-rendered"),
      "data-rows-rendered counts every body row the window put in the document, group headers included",
    ).toBe(String(bodyRows().length));
    expect(groupRows().length, "the first group's header stands at the top of the window").toBeGreaterThan(0);
    expect(rows().length, "and the lines beneath it").toBeGreaterThan(0);
  });

  test("every group row keeps the subtotal of the rows it HAS, not of the rows the window holds", async () => {
    const data = groupedLines(1000);
    mount(table(data));
    await waitFor(() => {
      expect(groupRows().length).toBeGreaterThan(0);
    });
    const first = groupRows()[0] as HTMLElement;
    const key = first.getAttribute("data-group") ?? "";
    const members = data.filter((line) => group.of(line).key === key);
    const [owed] = subtotalsByUnit(members, group.valueOf, group.unitOf);
    expect(members.length, "the first group holds more lines than the window draws").toBeGreaterThan(WINDOW_CEILING);
    expect(textOf(first), "the header counts the rows the group has").toContain(`(${members.length})`);
    expect(
      byTestId(first, TESTIDS.datatable.groupSubtotal)?.querySelector("[data-value]")?.getAttribute("data-value"),
      "and its subtotal is the exact sum over all of them",
    ).toBe(owed?.value);
  });

  test("aria-rowindex counts every row the reader can reach, group headers included, wherever the window stands", async () => {
    const data = groupedLines(1000);
    mount(table(data));
    await waitFor(() => {
      expect(bodyRows().length).toBeGreaterThan(0);
    });
    const groupsInAll = new Set(data.map((line) => group.of(line).key)).size;
    // One header row, then every group header and every line.
    expect(Number(root().getAttribute("aria-rowcount")), "the grid's row count is header + groups + lines").toBe(1 + groupsInAll + data.length);

    // Scroll to just past the fourth group's header: the window's rows state their places in the
    // WHOLE list, and that header is among them (the overscan reaches back over it).
    const per = Math.ceil(data.length / groupsInAll);
    await scrollViewport(viewport(), (3 * (per + 1) + 2) * ROW_HEIGHT_PX.compact);
    await waitFor(() => {
      expect(Number(bodyRows()[0]?.getAttribute("aria-rowindex")), "the window has moved").toBeGreaterThan(2 * (per + 1));
    });
    expect(groupRows().length, "the fourth group's header is in the window").toBe(1);
    const indices = bodyRows().map((row) => Number(row.getAttribute("aria-rowindex")));
    expect(indices, "the window's rows are consecutive places in the list").toEqual(indices.map((_unused, at) => (indices[0] ?? 0) + at));
    const header = groupRows()[0] as HTMLElement;
    const at = Number(header.getAttribute("aria-rowindex"));
    // Row 1 is the column header; item 0 is row 2. Each group is its header and `per` lines.
    expect((at - 2) % (per + 1), "a group header sits at the place its run of lines begins").toBe(0);
    const groupIndex = (at - 2) / (per + 1);
    expect(groupIndex, "the fourth group's").toBe(3);
    expect(header.getAttribute("data-group"), "and it is the group of that run").toBe(`${LEVELS[Math.floor(groupIndex / 2)]}-${CLASSES[groupIndex % 2]}`);
  });

  test("a row asked for by id is drawn, at its own item's place, however far down the grouped list it stands", async () => {
    const data = groupedLines(1000);
    const asked = data[data.length - 3] as Line;
    mount(table(data, { scrollToRowId: asked.id }));
    await waitFor(() => {
      expect(rows().some((row) => row.querySelector(testIdSelector(TESTIDS.datatable.cell))?.textContent === asked.item), "the asked row is in the document").toBe(true);
    });
    const drawn = rows().find((row) => row.querySelector(testIdSelector(TESTIDS.datatable.cell))?.textContent === asked.item) as HTMLElement;
    const groupsInAll = new Set(data.map((line) => group.of(line).key)).size;
    // Every group header before it, plus the lines before it, plus the column header row, plus one.
    expect(Number(drawn.getAttribute("aria-rowindex")), "it states its place in the whole list").toBe(1 + groupsInAll + (data.length - 3) + 1);
  });

  test("the cursor travels by line and the window follows by item, group headers counted", async () => {
    const user = userEvent.setup();
    const data = groupedLines(1000);
    const groupsInAll = new Set(data.map((line) => group.of(line).key)).size;
    const per = Math.ceil(data.length / groupsInAll);
    // The first line of the fifth group: five group headers stand above it in the window's list.
    const from = 4 * per;
    mount(table(data, { scrollToRowId: data[from]?.id }));
    // jsdom lays nothing out: the box is given the extent a browser would measure, and where the
    // virtualiser asks it to scroll is recorded — the ask is the answer.
    const box = viewport();
    Object.defineProperty(box, "scrollHeight", { configurable: true, get: () => (groupsInAll + data.length + 1) * ROW_HEIGHT_PX.compact });
    const scrolled: number[] = [];
    box.scrollTo = ((options?: ScrollToOptions | number) => {
      scrolled.push(typeof options === "object" ? (options.top ?? Number.NaN) : Number.NaN);
    }) as HTMLElement["scrollTo"];
    const line = await waitFor(() => {
      const found = rows().find((row) => row.querySelector(testIdSelector(TESTIDS.datatable.cell))?.textContent === data[from]?.item);
      expect(found, "the asked line is drawn").toBeDefined();
      return found as HTMLElement;
    });
    await act(async () => {
      (line.querySelector(testIdSelector(TESTIDS.datatable.cell)) as HTMLElement).focus();
      await Promise.resolve();
    });
    await user.keyboard("{ArrowDown}");
    // The next line is ITEM from + 1 + 5 (the five headers above it): scrolled to its bottom edge.
    const item = from + 1 + 5;
    expect(scrolled, "ArrowDown scrolls the next line's ITEM into view, not a header's height short per group passed").toContain(
      (item + 1) * ROW_HEIGHT_PX.compact - VIEWPORT_HEIGHT_PX,
    );
  });

  test("at 200 items a grouped list is drawn whole", () => {
    // 8 groups + 192 lines = 200 items: not past 200.
    const data = groupedLines(VIRTUALISE_ABOVE_ROWS - 8);
    mount(table(data));
    expect(root().getAttribute("data-virtualised"), "200 items is not past 200 rows").toBeNull();
    expect(bodyRows().length, "every group header and every line is drawn").toBe(VIRTUALISE_ABOVE_ROWS);
  });

  test("the cost: a grouped 424-line register, measured in DOM nodes", async () => {
    const data = groupedLines(424);
    // The register's width: ten columns (kind · value · unit · bases · coverage · formula · variables
    // · calibration · engine · source, s-takeoff I-235), each a plain cell here.
    const wide: DataTableColumnDef<Line>[] = [
      ...columns,
      ...["bases", "coverage", "formula", "variables", "calibration", "engine", "source"].map<DataTableColumnDef<Line>>((id) => ({
        id,
        header: id,
        accessorFn: (row) => `${id} of ${row.item}`,
        size: 120,
      })),
    ];
    mount(table(data, { columns: wide }));
    await waitFor(() => {
      expect(bodyRows().length).toBeGreaterThan(0);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const nodes = document.body.querySelectorAll("*").length;
    // The measurement the handoff quotes: before the window, every one of the 432 body rows stood in
    // the document; now a screenful does.
    process.stdout.write(`MEASURE grouped-424 body-rows=${bodyRows().length} nodes=${nodes}\n`);
    expect(bodyRows().length, "a window, not 432 rows").toBeLessThanOrEqual(WINDOW_CEILING);
  });
});

describe("§5 rules 4 + 5: a group's own sum is a figure, written through the one figure seam", () => {
  /** A seam that marks what it wrote, so the suite sees WHICH conventions a subtotal went through. */
  const marking = (mark: string): FigureFormat => ({
    figure: (value) => `${mark}${value}`,
    money: (amount) => amount,
    date: (at) => at.toISOString(),
  });
  const small: readonly Line[] = groupedLines(16);
  const firstSubtotal = (): HTMLElement =>
    byTestId(groupRows()[0] as HTMLElement, TESTIDS.datatable.groupSubtotal)?.querySelector("[data-value]") as HTMLElement;
  const owed = (): string => {
    const key = groupRows()[0]?.getAttribute("data-group") ?? "";
    return subtotalsByUnit(small.filter((line) => group.of(line).key === key), group.valueOf, group.unitOf)[0]?.value ?? "";
  };

  test("the group's own conventions write its sum, and the exact decimal rides data-value", () => {
    mount(table(small, { group: { ...group, format: marking("G:") } }));
    expect(firstSubtotal().textContent, "the sum is written by the conventions the group was handed").toBe(`G:${owed()}`);
    expect(firstSubtotal().getAttribute("data-value"), "and carries its exact decimal for a suite and a copy (B-07)").toBe(owed());
  });

  test("without its own, the tree's FigureProvider writes it — the conventions every figure primitive reads", () => {
    mount(<FigureProvider format={marking("T:")}>{table(small)}</FigureProvider>);
    expect(firstSubtotal().textContent).toBe(`T:${owed()}`);
  });

  test("with neither, the exact decimal is shown as summed — a primitive never invents a grouping", () => {
    mount(table(small));
    expect(firstSubtotal().textContent).toBe(owed());
  });

  test("a consumer's own subtotal arrives written, and is shown as written", () => {
    const written = { of: group.of, subtotal: () => [{ value: "1,00,000.5", unit: "m3" }] };
    mount(<FigureProvider format={marking("T:")}>{table(small, { group: written })}</FigureProvider>);
    expect(firstSubtotal().textContent, "never written twice").toBe("1,00,000.5");
  });

  test("a group states its count unless its screen says not to", () => {
    mount(table(small));
    expect(groupRows()[0]?.textContent, "§5 rule 4's default: `(n)`").toMatch(/\(\d+\)/);
    unmountAll();
    mount(table(small, { group: { ...group, showCount: false } }));
    expect(groupRows()[0]?.textContent, "a Decision that rules no parenthesised count gets none (s-boq §1)").not.toMatch(/\(\d+\)/);
  });
});

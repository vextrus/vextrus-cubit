// @vitest-environment jsdom
/**
 * DataTable v2 — I-356 and I-357: a group row writes the group's own sum IN the column it sums, its
 * unit a UnitBadge in the unit column, and the grid's bands — group rows and the total row — stand on
 * `--surface-band`, which is told apart from the field in both themes.
 *
 * The 2026-09-23 craft look found the BOQ's `128.782 m3` drawn at the far end of one spanning cell,
 * reading as a stray figure rather than the sum of the Quantity column above it, its unit plain text
 * beside the badges the lines wear; and in dark the group row had no fill at all. Every expectation
 * is derived from the fixture passed in and from the header the same table draws — a group row's
 * cell is "under" a column exactly when it states that column's `aria-colindex`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import userEvent from "@testing-library/user-event";
import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { DataTable, addDecimal, type DataTableColumnDef, type DataTableColumnMeta } from "../data-table";
import { CLIPPED, LINES, allTestId, byTestId, mount, rowIdOf, textOf, unmountAll, type Line } from "./support";
import { TESTIDS } from "@/ui/testids";

afterEach(() => {
  unmountAll();
});

const RULES = readFileSync(resolve(process.cwd(), "src/ui/primitives/data/data.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** One rule block's declarations, by the selector that opens it. */
function block(selector: string): string {
  const at = RULES.indexOf(`${selector} {`);
  expect(at, `data.css declares a \`${selector}\` rule`).toBeGreaterThan(-1);
  return RULES.slice(RULES.indexOf("{", at) + 1, RULES.indexOf("}", at));
}

const WIDTH = { item: 160, level: 80, qty: 96, unit: 64 } as const;

/** The fixture's four columns; `value` and `unit` say which carry the group's sum (I-356). */
function columnsWith(marks: { value?: keyof typeof WIDTH; unit?: keyof typeof WIDTH } = {}): DataTableColumnDef<Line>[] {
  const meta = (id: keyof typeof WIDTH, own: DataTableColumnMeta = {}): DataTableColumnMeta => ({
    ...own,
    ...(marks.value === id ? { groupSubtotal: "value" as const } : {}),
    ...(marks.unit === id ? { groupSubtotal: "unit" as const } : {}),
  });
  return [
    { id: "item", accessorKey: "item", header: "Item", size: WIDTH.item, meta: meta("item") },
    { id: "level", accessorKey: "level", header: "Level", size: WIDTH.level, meta: meta("level") },
    { id: "qty", accessorKey: "qty", header: "Qty", size: WIDTH.qty, meta: meta("qty", { align: "right" }) },
    { id: "unit", accessorKey: "unit", header: "Unit", size: WIDTH.unit, meta: meta("unit") },
  ];
}

/** Grouped by class, as a bill groups its lines: `column` holds 0.405 + 0.405 m3. */
const byClass = {
  of: (row: Line) => ({ key: row.klass, label: `${row.klass} · concrete` }),
  valueOf: (row: Line) => row.qty,
  unitOf: (row: Line) => row.unit,
};

/** Grouped by level: GF holds m3 AND m2, the two never added (L-QTY-04). */
const byLevel = { ...byClass, of: (row: Line) => ({ key: row.level, label: row.level }) };

const table = (columns: DataTableColumnDef<Line>[], props: Record<string, unknown> = {}) => (
  <DataTable tableId="test-group-columns" columns={columns} data={[...LINES]} getRowId={rowIdOf} storage={null} {...props} />
);

const groupRow = (key: string): HTMLElement => {
  const row = allTestId(document.body, TESTIDS.datatable.groupRow).find((node) => node.getAttribute("data-group") === key);
  expect(row, `the group \`${key}\` draws its row`).toBeDefined();
  return row as HTMLElement;
};

const cellsOf = (row: HTMLElement): HTMLElement[] => [...row.querySelectorAll<HTMLElement>(':scope > [role="gridcell"]')];

/** The `aria-colindex` the header states for a column — what "under this column" means. */
const colIndexOf = (header: string): string => {
  const cell = [...document.querySelectorAll('[role="columnheader"]')].find((node) => textOf(node) === header);
  expect(cell, `the header draws \`${header}\``).toBeDefined();
  return (cell as HTMLElement).getAttribute("aria-colindex") ?? "";
};

const cellUnder = (row: HTMLElement, header: string): HTMLElement => {
  const at = colIndexOf(header);
  const cell = cellsOf(row).find((node) => node.getAttribute("aria-colindex") === at);
  expect(cell, `the group row draws a cell under \`${header}\` (aria-colindex ${at})`).toBeDefined();
  return cell as HTMLElement;
};

describe("I-356: a group's sum stands in the column it sums", () => {
  test("the words span the columns before the figures; the sum is in the figure cell, its unit a badge in the unit cell", () => {
    mount(table(columnsWith({ value: "qty", unit: "unit" }), { group: byClass }));
    const row = groupRow("column");
    const sum = addDecimal("0.405", "0.405");

    const words = cellsOf(row)[0] as HTMLElement;
    expect(words.getAttribute("aria-colspan"), "the words span Item and Level — every column before the figures").toBe("2");
    expect(words.style.width, "and are exactly as wide as the two columns they span").toBe(`${WIDTH.item + WIDTH.level}px`);
    expect(textOf(words), "the words are the group's").toContain("column · concrete");
    expect(textOf(words), "and carry no figure: the sum is not the words' to state").not.toContain(sum);

    const figures = cellUnder(row, "Qty");
    expect(figures.getAttribute("data-align"), "the sum is set as the figures above it are: right-aligned, mono").toBe("right");
    expect(figures.style.width, "in the figure column's own width").toBe(`${WIDTH.qty}px`);
    const subtotal = byTestId(figures, TESTIDS.datatable.groupSubtotal);
    expect(subtotal, "the one `datatable-group-subtotal` of the row stands in the figure column").not.toBeNull();
    expect(
      subtotal?.querySelector("[data-value]")?.getAttribute("data-value"),
      "the exact sum of the group's own figures (B-07)",
    ).toBe(sum);
    expect(subtotal?.querySelector("[data-unit]")?.getAttribute("data-unit"), "each sum states the unit it is in").toBe("m3");
    expect(allTestId(figures, TESTIDS.unit.badge), "the unit is not repeated beside the figure when it has its own column").toEqual([]);

    const units = cellUnder(row, "Unit");
    expect(allTestId(units, TESTIDS.unit.badge).map(textOf), "the unit stands under the units, in the shipped UnitBadge").toEqual(["m3"]);
    expect(allTestId(row, TESTIDS.datatable.groupSubtotal).length, "one subtotal hook per group row, as before").toBe(1);
  });

  test("the row's cells tile the grid: every column is covered exactly once", () => {
    mount(table(columnsWith({ value: "qty", unit: "unit" }), { group: byClass }));
    const count = Number(byTestId(document.body, TESTIDS.datatable.root)?.getAttribute("aria-colcount"));
    for (const row of allTestId(document.body, TESTIDS.datatable.groupRow)) {
      const covered = cellsOf(row).flatMap((cell) => {
        const from = Number(cell.getAttribute("aria-colindex"));
        const span = Number(cell.getAttribute("aria-colspan") ?? "1");
        return Array.from({ length: span }, (_unused, at) => from + at);
      });
      expect(covered, `group \`${row.getAttribute("data-group")}\` covers columns 1…${count} once each`).toEqual(
        Array.from({ length: count }, (_unused, at) => at + 1),
      );
    }
  });

  test("a group holding two units writes both, figures under the figures and units under the units, in one order", () => {
    mount(table(columnsWith({ value: "qty", unit: "unit" }), { group: byLevel }));
    const row = groupRow("GF");
    const figures = [...cellUnder(row, "Qty").querySelectorAll("[data-value]")].map((node) => node.getAttribute("data-value"));
    expect(figures, "cubic and square metres are two sums, never one (L-QTY-04)").toEqual([addDecimal("0.405", "0.405"), "96.00"]);
    expect(allTestId(cellUnder(row, "Unit"), TESTIDS.unit.badge).map(textOf), "each unit in the order of its figure").toEqual(["m3", "m2"]);
  });

  test("with no unit column after the figures, each sum keeps its unit beside it", () => {
    mount(table(columnsWith({ value: "qty" }), { group: byClass }));
    const figures = cellUnder(groupRow("column"), "Qty");
    expect(allTestId(figures, TESTIDS.unit.badge).map(textOf), "a sum is never shown without the unit it is in").toEqual(["m3"]);
  });

  test("a grid that marks no figure column keeps the one spanning cell, with the sums at its end", () => {
    mount(table(columnsWith(), { group: byClass }));
    const cells = cellsOf(groupRow("column"));
    expect(cells.length, "one cell").toBe(1);
    expect(cells[0]?.getAttribute("aria-colspan"), "spanning the whole grid").toBe("4");
    expect(byTestId(cells[0] as HTMLElement, TESTIDS.datatable.groupSubtotal), "holding the sums").not.toBeNull();
  });

  test("a figure column that is the first column has no room for words before it, and keeps the spanning cell", () => {
    const [item, level, qty, unit] = columnsWith({ value: "qty", unit: "unit" });
    mount(table([qty, item, level, unit] as DataTableColumnDef<Line>[], { group: byClass }));
    expect(cellsOf(groupRow("column")).length, "the words always have a cell to stand in").toBe(1);
  });

  test("hiding the figure column from the chooser folds the row back into its spanning cell", async () => {
    const user = userEvent.setup();
    mount(table(columnsWith({ value: "qty", unit: "unit" }), { group: byClass }));
    expect(cellsOf(groupRow("column")).length, "one cell per column past the words").toBe(3);
    await user.click(byTestId(document.body, TESTIDS.datatable.columnsToggle) as HTMLElement);
    await user.click(byTestId(document.body, "datatable-column-toggle-qty") as HTMLElement);
    await waitFor(() => {
      expect(cellsOf(groupRow("column")).length, "the sums still stand — at the end of the one cell").toBe(1);
    });
    expect(byTestId(groupRow("column"), TESTIDS.datatable.groupSubtotal), "and the hook with them").not.toBeNull();
  });

  test("a group's words that are clipped carry their whole text on focus; words that fit carry nothing", async () => {
    const long = "column · concrete";
    CLIPPED.add(long);
    mount(table(columnsWith({ value: "qty", unit: "unit" }), { group: byClass }));

    const toggle = byTestId(groupRow("column"), "datatable-group-toggle-column") as HTMLElement;
    await act(async () => {
      toggle.focus();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        textOf(byTestId(document.body, TESTIDS.tooltip.content)),
        "§5 rule 2: words cut at the figure column are read in full in the shipped Tooltip",
      ).toBe(long);
    });

    const fitting = byTestId(groupRow("beam"), "datatable-group-toggle-beam") as HTMLElement;
    await act(async () => {
      fitting.focus();
      await Promise.resolve();
    });
    expect(
      allTestId(document.body, TESTIDS.tooltip.content).map(textOf),
      "a group whose words read in full is not tooltipped",
    ).not.toContain("beam · concrete");
  });

  test("a PINNED figure column's sum is pinned with it, under its own header", () => {
    mount(table(columnsWith({ value: "qty", unit: "unit" }), { group: byClass, columnPinning: { left: ["qty"] } }));
    const figures = cellUnder(groupRow("column"), "Qty");
    expect(figures.getAttribute("data-pinned"), "the sum stays with the frozen figures when the grid scrolls sideways").toBe("left");
    expect(byTestId(figures, TESTIDS.datatable.groupSubtotal), "and it is the sum").not.toBeNull();
  });
});

describe("the bands a row draws follow the row's own column order", () => {
  test("a pinned column's total stands under its header, not under the column declared in its place", () => {
    mount(table(columnsWith(), { columnPinning: { left: ["qty"] }, totals: { qty: "TOTAL-QTY" } }));
    const footer = byTestId(document.body, TESTIDS.datatable.footer);
    const under = [...(footer?.querySelectorAll<HTMLElement>('[role="gridcell"]') ?? [])].find(
      (cell) => cell.getAttribute("aria-colindex") === colIndexOf("Qty"),
    );
    expect(textOf(under), "the header draws pinned columns first; so does the total row").toBe("TOTAL-QTY");
  });
});

describe("I-357: the grid's bands stand on --surface-band", () => {
  test("a group row, the total row and their frozen cells read the band; the header stays on the field", () => {
    expect(block(".cx-table-group"), "a group row is a band").toContain("background-color: var(--surface-band);");
    expect(block(".cx-table-footer"), "the total row is a band").toContain("background-color: var(--surface-band);");
    expect(
      block(".cx-table-footer .cx-table-cell[data-pinned],\n.cx-table-group .cx-table-cell[data-pinned]"),
      "a frozen cell of a band paints the band, not a hole of field colour",
    ).toContain("background-color: var(--surface-band);");
    expect(
      block(".cx-table-header"),
      "the header stays on the field: a banded header over a banded first group row reads as one double-height band",
    ).toContain("background-color: var(--surface-app);");
    expect(RULES.includes("--surface-sunken);\n  font-weight"), "no band is drawn on the well colour any more").toBe(false);
  });
});

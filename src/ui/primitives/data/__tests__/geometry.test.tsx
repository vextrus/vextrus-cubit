// @vitest-environment jsdom
/**
 * DataTable v2 — §5 rules 1, 2, 3 and 9: the row is the root's `--row-h`, no cell wraps, the
 * header and the key column are frozen with the corner in the right order, and past 200 rows the
 * grid is a window that says how much of itself it drew.
 *
 * The stylesheet is read as a stylesheet, not guessed at through jsdom (which lays nothing out):
 * the density rules are a fact about the file, and the file is the only place they can be checked.
 * Every behavioural expectation is derived from the fixture the test itself passes in.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, waitFor } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { afterEach, describe, expect, test } from "vitest";
import { DataTable, ROW_HEIGHT_PX, VIRTUALISE_ABOVE_ROWS } from "../data-table";
import {
  CLIPPED,
  LINES,
  allTestId,
  byTestId,
  lineRows,
  mount,
  rowIdOf,
  textOf,
  unmountAll,
  type Line,
} from "./support";

afterEach(() => {
  unmountAll();
});

const CSS = readFileSync(resolve(process.cwd(), "src/ui/primitives/data/data.css"), "utf8");
/** The stylesheet with its prose removed: a comment is not a selector and not a token read. */
const RULES = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** One rule block's declarations, by the selector that opens it. */
function block(selector: string): string {
  const at = RULES.indexOf(`${selector} {`);
  expect(at, `data.css declares a \`${selector}\` rule`).toBeGreaterThan(-1);
  return RULES.slice(RULES.indexOf("{", at) + 1, RULES.indexOf("}", at));
}

const columns: ColumnDef<Line, unknown>[] = [
  { id: "item", accessorKey: "item", header: "Item", size: 160 },
  { id: "level", accessorKey: "level", header: "Level", size: 80 },
  { id: "qty", accessorKey: "qty", header: "Qty", size: 96, meta: { align: "right" }, enableSorting: true },
  { id: "unit", accessorKey: "unit", header: "Unit", size: 64 },
];

const table = (props: Record<string, unknown> = {}, data: readonly Line[] = LINES) => (
  <DataTable tableId="test-geometry" columns={columns} data={[...data]} getRowId={rowIdOf} storage={null} {...props} />
);

const root = (): HTMLElement => {
  const node = byTestId(document.body, "datatable");
  expect(node, "the grid renders its `datatable` root").not.toBeNull();
  return node as HTMLElement;
};

const rows = (): HTMLElement[] => allTestId(document.body, "datatable-row");

/** The virtualiser's total-size element — the largest inline pixel height under the viewport. */
function totalExtentPx(): number {
  const viewport = byTestId(document.body, "datatable-viewport");
  expect(viewport, "the grid renders its scroll container").not.toBeNull();
  let largest = 0;
  for (const node of (viewport as HTMLElement).querySelectorAll("*")) {
    const match = /^([\d.]+)px$/.exec(((node as HTMLElement).style?.height ?? "").trim());
    if (match) largest = Math.max(largest, Number(match[1]));
  }
  return largest;
}

describe("§5 rule 1: the row height is the ROOT's density token, and padding never sets it", () => {
  test("data.css authors no density selector and reads neither of R-UI-001's two row heights", () => {
    expect(
      RULES.includes("[data-density"),
      "§4.2/R-UI-086: density switches tokens at the ROOT. A `[data-density]` selector in a component stylesheet is the second home that left `--row-h` a dead letter on main",
    ).toBe(false);
    for (const dead of ["--row-compact", "--row-comfortable"]) {
      expect(
        RULES.includes(dead),
        `§5 rule 1: the grid reads \`--row-h\`, never \`${dead}\` — a component that reads the raw height has to spell the switch itself`,
      ).toBe(false);
    }
  });

  test("the row, the header, the footer and the cell are drawn from --row-h, --cell-px and --cell-py", () => {
    expect(block(".cx-table-row"), "§5 rule 1: a row is `--row-h` tall").toContain("height: var(--row-h);");
    const cell = block(".cx-table-cell");
    expect(cell, "§5 rule 1: the cell's horizontal padding is the density token").toContain("padding-inline: var(--cell-px);");
    expect(cell, "§5 rule 1: the cell's vertical padding is the density token").toContain("padding-block: var(--cell-py);");
    expect(cell, "§5 rule 1: the cell fills the row it is in").toContain("height: 100%;");
    expect(
      cell,
      "§5 rule 1: padding must NEVER set the row height — a border-box cell at 100% keeps `--cell-py` inside `--row-h`",
    ).toContain("box-sizing: border-box;");
    expect(block(".cx-table-header"), "§5 rule 1: the header is sticky").toContain("position: sticky;");
    expect(block(".cx-table-footer"), "§5 rule 1: the footer is sticky where totals exist").toContain("position: sticky;");
    expect(block(".cx-table-editor"), "a control inside a cell stands at the density's control height").toContain(
      "height: var(--control-h);",
    );
  });

  test("the virtualiser measures the density the root states, and re-measures when it changes", async () => {
    const data = lineRows(1000);
    mount(table({}, data));
    await waitFor(() => {
      expect(totalExtentPx(), "no density stated: compact is the default, at the root and here").toBe(
        data.length * ROW_HEIGHT_PX.compact,
      );
    });

    await act(async () => {
      document.documentElement.dataset.density = "comfortable";
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        totalExtentPx(),
        "R-UI-005: comfortable at the ROOT re-measures the list — a cached measurement leaves every row at the old height",
      ).toBe(data.length * ROW_HEIGHT_PX.comfortable);
    });
  });

  test("a row carries no inline height: the two heights live in the stylesheet alone", () => {
    mount(table({}, lineRows(20)));
    expect(
      rows().filter((row) => row.style.height !== "").map((row) => row.style.height),
      "B-17: an inline height would beat the density rule and give the switch a second home",
    ).toEqual([]);
  });
});

describe("§5 rule 2: no wrapping cell, and a Tooltip only where one is actually clipped", () => {
  test("the cell's text box truncates rather than wrapping", () => {
    const text = block(".cx-table-cell-text");
    for (const declaration of ["white-space: nowrap;", "overflow: hidden;", "text-overflow: ellipsis;"]) {
      expect(text, `§5 rule 2: the cell declares \`${declaration}\``).toContain(declaration);
    }
  });

  test("a truncated cell answers with the full value on focus; a cell that fits answers nothing", async () => {
    const long = LINES[0]?.item ?? "";
    CLIPPED.add(long);
    mount(table());

    const clipped = rows()
      .flatMap((row) => allTestId(row, "datatable-cell"))
      .find((cell) => textOf(cell) === long);
    expect(clipped, `the fixture's \`${long}\` cell is rendered`).toBeTruthy();

    await act(async () => {
      (clipped as HTMLElement).focus();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        textOf(byTestId(document.body, "tooltip-content")),
        "§5 rule 2: a TRUNCATED cell carries the full value in the shipped Tooltip, on focus as well as on hover",
      ).toBe(long);
    });

    const fitting = rows()
      .flatMap((row) => allTestId(row, "datatable-cell"))
      .find((cell) => textOf(cell) === (LINES[1]?.item ?? ""));
    await act(async () => {
      (fitting as HTMLElement).focus();
      await Promise.resolve();
    });
    expect(
      allTestId(document.body, "tooltip-content").map(textOf),
      "§5 rule 2: detection is `scrollWidth > clientWidth` — a cell that reads in full is not tooltipped",
    ).not.toContain(LINES[1]?.item ?? "");
  });
});

describe("§5 rule 3: the sticky header and the frozen key column, with the corner in order", () => {
  test("the first column is pinned left in every band of the grid", () => {
    mount(table());
    const pinned = (id: string): string | null =>
      byTestId(document.body, id)?.querySelector('[data-pinned="left"]')?.getAttribute("data-pinned") ?? null;
    expect(pinned("datatable-header"), "§5 rule 3: the header's key cell is frozen").toBe("left");
    expect(
      rows().every((row) => (row.querySelector('[data-pinned="left"]')?.textContent ?? "") !== ""),
      "§5 rule 3: every body row's key cell is frozen",
    ).toBe(true);
    expect(
      rows()[0]?.querySelector('[role="rowheader"]'),
      "§5 rule 3: the frozen key column NAMES its row — `rowheader` is the aria grid's `th[scope=row]`",
    ).toBeTruthy();
  });

  test("the corner cell outranks both the header band and the frozen column", () => {
    expect(block(".cx-table-cell[data-pinned]"), "a frozen cell is sticky").toContain("position: sticky;");
    expect(block(".cx-table-cell[data-pinned]")).toContain("z-index: var(--z-sticky);");
    expect(block(".cx-table-header"), "the header stands above a frozen body cell").toContain(
      "z-index: calc(var(--z-sticky) + 1);",
    );
    expect(
      block(".cx-table-header .cx-table-cell[data-pinned],\n.cx-table-footer .cx-table-cell[data-pinned]"),
      "§5 rule 3: the corner is a frozen HEADER cell, above both",
    ).toContain("z-index: calc(var(--z-sticky) + 2);");
  });
});

describe("§5 rule 9: virtualised past 200 rows, and it publishes what it drew", () => {
  test(`at ${VIRTUALISE_ABOVE_ROWS} rows the whole list is in the document and nothing claims to be windowed`, () => {
    const data = lineRows(VIRTUALISE_ABOVE_ROWS);
    mount(table({}, data));
    expect(root().getAttribute("data-virtualised"), "§5 rule 9: 200 rows is not past 200 rows").toBeNull();
    expect(rows().length, "every row is drawn").toBe(data.length);
    expect(
      root().getAttribute("data-rows-rendered"),
      "the count the journey lane's settled() reads is the rows actually in the document",
    ).toBe(String(data.length));
  });

  test(`past ${VIRTUALISE_ABOVE_ROWS} rows the grid is a window over a full-length extent`, async () => {
    const data = lineRows(VIRTUALISE_ABOVE_ROWS + 800);
    mount(table({}, data));
    await waitFor(() => {
      expect(rows().length, "§5 rule 9: a long list renders a window, not the whole list").toBeLessThan(data.length);
    });
    expect(rows().length, "the window is not empty").toBeGreaterThan(0);
    expect(
      root().getAttribute("data-virtualised"),
      "tests/e2e/support/settled.ts reads `[data-virtualised]` — the selector is spelled exactly",
    ).toBe("true");
    expect(
      root().getAttribute("data-rows-rendered"),
      "tests/e2e/support/settled.ts reads `data-rows-rendered` off that same element, as a decimal count",
    ).toBe(String(rows().length));
    expect(totalExtentPx(), "the scroll extent spans every row, so the scrollbar tells the truth").toBe(
      data.length * ROW_HEIGHT_PX.compact,
    );
  });
});

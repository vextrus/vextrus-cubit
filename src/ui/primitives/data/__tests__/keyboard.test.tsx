// @vitest-environment jsdom
/**
 * DataTable v2 — §5 rules 6, 7 and 8: the cell cursor and the aria grid it moves in, the inline
 * edit the act law permits (and the one it does not), and the numeric treatment a figure gets.
 *
 * Every gesture begins on the keyboard, and every expectation is read semantically — the roving
 * tabindex, the roles, the editor's accessible name, the seam's arguments — never by counting nodes.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTable } from "../data-table";
import { LINES, allTestId, byTestId, mount, rowIdOf, textOf, unmountAll, type Line } from "./support";

afterEach(() => {
  unmountAll();
});

/** The act law, as a fixture: the entered quantity may be edited, the measured value may not. */
const columns: ColumnDef<Line, unknown>[] = [
  { id: "item", accessorKey: "item", header: "Item", size: 160 },
  { id: "qty", accessorKey: "qty", header: "Qty", size: 96, meta: { align: "right", editable: true, act: true } },
  { id: "unit", accessorKey: "unit", header: "Unit", size: 64 },
];

const table = (props: Record<string, unknown> = {}) => (
  <DataTable tableId="test-keyboard" columns={columns} data={[...LINES]} getRowId={rowIdOf} storage={null} {...props} />
);

const rows = (): HTMLElement[] => allTestId(document.body, "datatable-row");
const cellsOf = (row: number): HTMLElement[] => allTestId(rows()[row] as HTMLElement, "datatable-cell");
const cell = (row: number, col: number): HTMLElement => cellsOf(row)[col] as HTMLElement;
const editor = (): HTMLInputElement | null => byTestId(document.body, "datatable-cell-editor") as HTMLInputElement | null;

/** Put the cursor where a reader would have left it, through focus alone. */
async function focusCell(row: number, col: number): Promise<HTMLElement> {
  const node = cell(row, col);
  await act(async () => {
    node.focus();
    await Promise.resolve();
  });
  return node;
}

const cursor = (): HTMLElement | null => document.querySelector('[data-cursor="true"]');

describe("§5 rule 6: the cell cursor, drawn with the reticle, in a real aria grid", () => {
  test("the grid announces its shape, and exactly one cell is in the Tab order", async () => {
    mount(table());
    const root = byTestId(document.body, "datatable") as HTMLElement;
    expect(root.getAttribute("role"), "R-UI-012: the instrument is a grid, not a list of divs").toBe("grid");
    expect(Number(root.getAttribute("aria-colcount")), "the grid announces its columns").toBe(columns.length);
    expect(
      cellsOf(0).map((node) => node.getAttribute("aria-colindex")),
      "every cell names its column's place",
    ).toEqual(columns.map((_column, index) => String(index + 1)));

    const inTabOrder = allTestId(document.body, "datatable-cell").filter((node) => node.tabIndex === 0);
    expect(inTabOrder.length, "§5 rule 6: a roving tabindex puts exactly one cell in the Tab order").toBe(1);
    expect(
      allTestId(document.body, "datatable-cell").every((node) => node.className.split(/\s+/).includes("cx-reticle")),
      "§5 rule 6: the cursor is the reticle (R-UI-012), drawn on the CELL",
    ).toBe(true);
  });

  test("arrows move the cursor, Tab moves to the next cell, and the roving tabindex follows", async () => {
    const user = userEvent.setup();
    mount(table());
    await focusCell(0, 0);

    await user.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(cursor(), "ArrowDown moves the cursor one row down").toBe(cell(1, 0));
    });
    expect(document.activeElement, "the cursor owns DOM focus wherever it is").toBe(cell(1, 0));
    expect(cell(1, 0).tabIndex, "the cursor is the one cell in the Tab order").toBe(0);
    expect(cell(0, 0).tabIndex, "every other cell is out of it").toBe(-1);

    await user.keyboard("{ArrowRight}");
    await waitFor(() => {
      expect(cursor(), "ArrowRight moves one column along").toBe(cell(1, 1));
    });

    await user.keyboard("{Tab}");
    await waitFor(() => {
      expect(cursor(), "§5 rule 6: Tab is the NEXT CELL, not the next control outside the grid").toBe(cell(1, 2));
    });

    await user.keyboard("{Tab}");
    await waitFor(() => {
      expect(cursor(), "Tab off the last column wraps to the first cell of the next row").toBe(cell(2, 0));
    });

    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    await waitFor(() => {
      expect(cursor(), "the cursor stops at the first row rather than leaving the grid").toBe(cell(0, 0));
    });
  });

  test("Space selects the row and ⇧+arrow takes the range between", async () => {
    const user = userEvent.setup();
    const onRowSelect = vi.fn();
    mount(table({ onRowSelect }));
    await focusCell(1, 0);

    await user.keyboard(" ");
    await waitFor(() => {
      expect(rows()[1]?.getAttribute("aria-selected"), "Space selects the cursor's row").toBe("true");
    });

    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
    await waitFor(() => {
      expect(
        rows().map((row) => row.getAttribute("data-selected")),
        "§5 rule 6: ⇧+arrow takes the range from the anchor to the cursor, and nothing else",
      ).toEqual([null, "true", "true", "true", null]);
    });
    expect(
      onRowSelect.mock.calls.at(-1),
      "the range rises to the shell as the ids it covers, in the grid's own order",
    ).toEqual([[LINES[1]?.id, LINES[2]?.id, LINES[3]?.id]]);
  });
});

describe("§5 rule 7: inline edit only where the act law permits it", () => {
  test("Enter on a permitted cell opens the editor, and the commit leaves through the act seam", async () => {
    const user = userEvent.setup();
    const onCellCommit = vi.fn();
    mount(table({ onCellCommit }));

    const edited = await focusCell(0, 1);
    const before = textOf(edited);
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(editor(), "Enter on an editable cell swaps its value for the shipped core Input").not.toBeNull();
    });
    expect(editor()?.getAttribute("aria-label"), "R-UI-012: the editor is named by its column").toBe("Qty");
    expect(editor()?.value, "the editor opens prefilled with the cell's own value").toBe(before);

    const next = `${Number(before) + 1}`;
    await user.clear(editor() as HTMLInputElement);
    await user.type(editor() as HTMLInputElement, next);
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(editor(), "Enter closes the editor").toBeNull();
    });
    expect(
      onCellCommit.mock.calls,
      "§5 rule 7: the table commits NOTHING itself — the entered value leaves through the seam, flagged as the act it is",
    ).toEqual([[{ tableId: "test-keyboard", rowId: LINES[0]?.id, columnId: "qty", value: next, act: true }]]);
    expect(
      textOf(byTestId(cell(0, 1), "datatable-cell-entered")),
      "§5 rule 7: an edited cell wears the ENTERED basis glyph (R-UI-002's table, not a second one)",
    ).toBe("✎");
    expect(document.activeElement, "a keyboard journey never ends on the document body").toBe(cell(0, 1));
  });

  test("Escape cancels: nothing commits, and the basis of the cell is unchanged", async () => {
    const user = userEvent.setup();
    const onCellCommit = vi.fn();
    mount(table({ onCellCommit }));

    await focusCell(0, 1);
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(editor()).not.toBeNull();
    });
    await user.clear(editor() as HTMLInputElement);
    await user.type(editor() as HTMLInputElement, "99");
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(editor(), "Escape closes the editor").toBeNull();
    });
    expect(onCellCommit.mock.calls, "§5 rule 6: Escape cancels — it commits nothing").toEqual([]);
    expect(
      byTestId(cell(0, 1), "datatable-cell-entered"),
      "a cancelled edit leaves no ENTERED mark behind: nothing was entered",
    ).toBeNull();
  });

  test("a column the act law does not permit REFUSES the edit", async () => {
    const user = userEvent.setup();
    const onCellCommit = vi.fn();
    const onCellEdit = vi.fn();
    mount(table({ onCellCommit, onCellEdit }));

    const readOnly = await focusCell(0, 0);
    expect(
      readOnly.getAttribute("data-editable"),
      "§5 rule 7: a measured or derived column declares no `meta.editable`, so it is read-only",
    ).toBeNull();
    await user.keyboard("{Enter}");
    await user.keyboard("7");
    await waitFor(() => {
      expect(editor(), "§5 rule 7: Enter on a non-permitted column opens NO editor").toBeNull();
    });
    expect(onCellEdit.mock.calls, "and commits nothing through the legacy callback").toEqual([]);
    expect(onCellCommit.mock.calls, "and nothing through the act seam either").toEqual([]);
    expect(textOf(readOnly), "the cell still reads what it read").toBe(LINES[0]?.item ?? "");
  });
});

describe("§5 rule 8: a figure is mono, tabular and right-aligned; the grouping is the seam's", () => {
  test("only the numeric column is right-aligned, and it renders the consumer's grouped figure verbatim", () => {
    // The lakh/crore grouping is `src/core/format.ts`'s (L-FMT-01). ARCH-01 keeps src/ui out of the
    // document seam, so the table takes the grouped string as the column's own cell renderer —
    // and must render it exactly, digit-group separators and all.
    const lakh = "1,00,00,000";
    mount(
      <DataTable
        tableId="test-numbers"
        columns={[
          { id: "item", accessorKey: "item", header: "Item" },
          { id: "qty", accessorKey: "qty", header: "Qty", meta: { align: "right" }, cell: () => lakh },
        ]}
        data={[...LINES]}
        getRowId={rowIdOf}
        storage={null}
      />,
    );
    const first = cellsOf(0);
    expect(first[0]?.getAttribute("data-align"), "a word column is not a number column").toBeNull();
    expect(first[1]?.getAttribute("data-align"), "§5 rule 5: a figure is right-aligned").toBe("right");
    expect(textOf(first[1]), "the lakh/crore grouping the seam wrote is rendered verbatim").toBe(lakh);
  });
});

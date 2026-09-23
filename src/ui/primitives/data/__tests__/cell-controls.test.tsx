// @vitest-environment jsdom
/**
 * DataTable v2 — §5 rule 6 with controls in the cells: a grid is ONE Tab stop.
 *
 * The served register put an IdChip (a value and a copy, two stops) and an EvidenceLink on every one
 * of its 424 lines, and every one of them was in the Tab order beside a grid whose cells rove at -1
 * (craft look, session 7). Inside a body cell those controls now leave the Tab order and are reached
 * through the cell: Enter or F2 enters the cell's controls, Tab walks them and then leaves the cell,
 * Escape hands the cursor back to the cell, and Enter and Space belong to the control. Outside a
 * grid the same controls keep their own stops.
 */
import { act, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { IdChip } from "../../core/id-chip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../overlay/dropdown-menu";
import { EvidenceLink } from "@/ui/patterns/evidence-link";
import { TESTIDS } from "@/ui/testids";
import { DataTable, type DataTableColumnDef } from "../data-table";
import { LINES, allTestId, byTestId, mount, rowIdOf, unmountAll, type Line } from "./support";

afterEach(() => {
  unmountAll();
});

const DIGEST = "a32187c9d1e04b7f8a6c5e3d2b1f0a9e";

const columns: DataTableColumnDef<Line>[] = [
  { id: "item", accessorKey: "item", header: "Item", size: 160 },
  { id: "digest", header: "Calibration", size: 160, cell: () => <IdChip value={DIGEST} /> },
  { id: "source", header: "Source", size: 200, cell: ({ row }) => <EvidenceLink href={`/design#${row.original.id}`} basis="MEASURED" label={`DXF_HANDLE:${row.original.id}`} /> },
  { id: "unit", accessorKey: "unit", header: "Unit", size: 64 },
];

const onRowSelect = vi.fn();
const table = () => <DataTable tableId="test-cell-controls" columns={columns} data={[...LINES]} getRowId={rowIdOf} storage={null} onRowSelect={onRowSelect} />;

const rows = (): HTMLElement[] => allTestId(document.body, TESTIDS.datatable.row);
const cell = (row: number, col: number): HTMLElement => allTestId(rows()[row] as HTMLElement, TESTIDS.datatable.cell)[col] as HTMLElement;

async function focusCell(row: number, col: number): Promise<HTMLElement> {
  const node = cell(row, col);
  await act(async () => {
    node.focus();
    await Promise.resolve();
  });
  return node;
}

describe("§5 rule 6: the controls a cell holds are reached through the cell", () => {
  test("inside a grid no IdChip stop and no EvidenceLink is in the Tab order; exactly one cell is", () => {
    mount(table());
    const grid = byTestId(document.body, TESTIDS.datatable.root) as HTMLElement;
    const tabbable = [...grid.querySelectorAll<HTMLElement>("a[href], button, [tabindex]")].filter((node) => node.tabIndex >= 0 && node.closest(".cx-table-body") !== null);
    expect(
      tabbable.map((node) => node.getAttribute("data-testid")),
      "the body of a grid is one Tab stop — the cursor's cell — however many controls its rows hold",
    ).toEqual([TESTIDS.datatable.cell]);
    expect(allTestId(grid, "id-chip-copy").every((node) => node.tabIndex === -1), "every copy control is out of the Tab order").toBe(true);
    expect(allTestId(grid, TESTIDS.evidence.link).every((node) => node.tabIndex === -1), "every Trace link is out of the Tab order").toBe(true);
    expect(
      [...grid.querySelectorAll<HTMLElement>(".cx-id-chip-value")].every((node) => node.tabIndex === -1),
      "every chip's value is out of the Tab order",
    ).toBe(true);
  });

  test("outside a grid the same controls keep their own stops", () => {
    render(
      <div>
        <IdChip value={DIGEST} />
        <EvidenceLink href="/design" basis="MEASURED" label="DXF_HANDLE:1A4" />
      </div>,
    );
    expect((document.querySelector(".cx-id-chip-value") as HTMLElement).tabIndex, "the value is a stop of its own").toBe(0);
    expect((byTestId(document.body, "id-chip-copy") as HTMLElement).tabIndex, "and so is its copy").toBe(0);
    expect((byTestId(document.body, TESTIDS.evidence.link) as HTMLElement).tabIndex, "and so is a Trace link").toBe(0);
  });

  test("Enter enters a cell's controls, Tab walks them and then leaves the cell, Escape returns to the cell", async () => {
    const user = userEvent.setup();
    mount(table());
    const chipCell = await focusCell(0, 1);
    const value = chipCell.querySelector(".cx-id-chip-value") as HTMLElement;
    const copy = byTestId(chipCell, "id-chip-copy") as HTMLElement;

    await user.keyboard("{Enter}");
    expect(document.activeElement, "Enter puts focus on the cell's first control — the chip's value, whose tooltip carries the whole id").toBe(value);

    await user.keyboard("{Tab}");
    expect(document.activeElement, "Tab walks to the cell's next control — the copy").toBe(copy);

    // The copy's tooltip opened with the focus, and Escape closes what is open innermost first: the
    // tooltip answers the first press (and prevents it), the cell the next.
    await user.keyboard("{Escape}");
    expect(document.activeElement, "the first Escape is the open tooltip's").toBe(copy);
    await user.keyboard("{Escape}");
    expect(document.activeElement, "the next hands the cursor back to the cell").toBe(chipCell);

    await user.keyboard("{F2}");
    expect(document.activeElement, "F2 enters the controls too").toBe(value);
    await user.keyboard("{Tab}{Tab}");
    await waitFor(() => {
      expect(document.activeElement, "Tab past the cell's last control moves the cursor to the next cell").toBe(cell(0, 2));
    });
  });

  test("Enter and Space belong to the control: Space on the copy copies and selects no row", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    onRowSelect.mockClear();
    mount(table());
    await focusCell(0, 1);
    await user.keyboard("{Enter}{Tab}");
    const copy = byTestId(cell(0, 1), "id-chip-copy") as HTMLElement;
    expect(document.activeElement).toBe(copy);

    await user.keyboard(" ");
    await waitFor(() => {
      expect(writeText, "Space pressed the copy").toHaveBeenCalledWith(DIGEST);
    });
    expect(onRowSelect, "and did not take the row — Space on a control is the control's").not.toHaveBeenCalled();
  });

  test("a key a control already answered stays the control's — a row menu's Escape and arrows are the menu's", async () => {
    // A Radix menu's content is portalled out of the cell, but its React events still bubble through
    // the cell. The menu answers (and prevents) its own keys; the grid must not answer them twice.
    const user = userEvent.setup();
    const menuColumns: DataTableColumnDef<Line>[] = [
      { id: "item", accessorKey: "item", header: "Item", size: 160 },
      {
        id: "menu",
        header: "",
        size: 48,
        meta: { control: true },
        cell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Row actions">⋯</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Duplicate line</DropdownMenuItem>
              <DropdownMenuItem>Delete line</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ];
    mount(<DataTable tableId="test-cell-menu" columns={menuColumns} data={[...LINES]} getRowId={rowIdOf} storage={null} />);
    const menuCell = await focusCell(0, 1);
    const trigger = within(menuCell).getByRole("button", { name: "Row actions" });

    await user.keyboard("{Enter}");
    expect(document.activeElement, "Enter enters the cell: its one control, the menu's trigger").toBe(trigger);

    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(document.activeElement?.getAttribute("role"), "Enter on the trigger opens the menu").toBe("menuitem");
    });
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement?.textContent, "ArrowDown moves inside the menu").toBe("Delete line");
    expect(document.querySelector('[data-cursor="true"]'), "and not the grid's cursor").toBe(menuCell);

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement, "Escape closes the menu and focus goes back to its trigger, as the menu rules").toBe(trigger);
    });
  });

  test("a cell that holds no control lets Enter through, as before", async () => {
    const user = userEvent.setup();
    mount(table());
    const plain = await focusCell(0, 3);
    await user.keyboard("{Enter}");
    expect(document.activeElement, "the cursor stays on a cell with nothing to enter").toBe(plain);
  });
});

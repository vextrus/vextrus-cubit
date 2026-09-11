// @vitest-environment jsdom
/**
 * DataTable v2 — §5 rules 4, 5 and 10: the group row with its subtotals and its remembered fold,
 * the column furniture kept per user per table id, and the four row states a register needs.
 *
 * The storage seam is a plain object handed in, so the round trip is asserted on the PAYLOAD the
 * product writes rather than on a mock's call log, and the corrupt-payload fallback is asserted by
 * putting a corrupt payload where the product will look.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTable, addDecimal, subtotalsByUnit } from "../data-table";
import { DATA_TABLE_STATE_VERSION, dataTableStorageKey, readColumnState } from "../table-state";
import {
  LINES,
  allTestId,
  byTestId,
  memoryStorage,
  mount,
  rowIdOf,
  textOf,
  unmountAll,
  type Line,
} from "./support";

afterEach(() => {
  unmountAll();
});

const columns: ColumnDef<Line, unknown>[] = [
  { id: "item", accessorKey: "item", header: "Item", size: 160 },
  { id: "qty", accessorKey: "qty", header: "Qty", size: 96, meta: { align: "right" }, enableSorting: true },
  { id: "unit", accessorKey: "unit", header: "Unit", size: 64 },
];

const TABLE_ID = "takeoff-register-lines";

const table = (props: Record<string, unknown> = {}, data: readonly Line[] = LINES) => (
  <DataTable tableId={TABLE_ID} columns={columns} data={[...data]} getRowId={rowIdOf} storage={null} {...props} />
);

const rows = (): HTMLElement[] => allTestId(document.body, "datatable-row");
const groups = (): HTMLElement[] => allTestId(document.body, "datatable-group-row");

/** The fixture's own grouping: level · class, exactly as §5 rule 4 writes one. */
const group = {
  of: (row: Line) => ({ key: `${row.level}-${row.klass}`, label: `${row.level} · ${row.klass}` }),
  valueOf: (row: Line) => row.qty,
  unitOf: (row: Line) => row.unit,
};

describe("§5 rule 4: group rows with subtotals, and a fold that is remembered", () => {
  test("the sum is exact and per unit, never through a float", () => {
    expect(addDecimal("0.405", "0.405"), "two quantities add at their own precision").toBe("0.810");
    expect(addDecimal("0.1", "0.2"), "B-07: 0.1 + 0.2 is 0.3, not 0.30000000000000004").toBe("0.3");
    expect(
      subtotalsByUnit(LINES, (row) => row.qty, (row) => row.unit),
      "§5 rule 4: one subtotal per unit, in the order the units first appear",
    ).toEqual([
      { unit: "m3", value: addDecimal(addDecimal(addDecimal("0.405", "0.405"), "12.60"), "1.40") },
      { unit: "m2", value: "96.00" },
    ]);
  });

  test("a group reads `▾ GF · column (2)` with its subtotals, and the fold survives a remount", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    mount(table({ group, storage }));

    const first = groups()[0];
    expect(textOf(first), "§5 rule 4: the group names itself, then counts what it holds").toContain("GF · column");
    expect(textOf(first), "the count is the rows the group HAS").toContain("(2)");
    expect(
      textOf(byTestId(first as HTMLElement, "datatable-group-subtotal")),
      "the subtotal is the exact sum of the group's own figures, with its unit",
    ).toBe(`${addDecimal("0.405", "0.405")}m3`);
    expect(rows().length, "every row of every group is drawn while nothing is folded").toBe(LINES.length);

    await user.click(byTestId(document.body, "datatable-group-toggle-GF-column") as HTMLElement);
    await waitFor(() => {
      expect(rows().length, "§5 rule 4: folding a group takes its members out of the grid").toBe(LINES.length - 2);
    });
    expect(
      textOf(groups()[0]),
      "the subtotal of a folded group is still the sum of what it holds — a fold changes no figure",
    ).toContain(addDecimal("0.405", "0.405"));

    // The fold is furniture, so it is remembered by table id and restored by the next mount.
    expect(readColumnState(storage, TABLE_ID).collapsed, "the fold is written under this table's key").toEqual([
      "GF-column",
    ]);
    unmountAll();
    mount(table({ group, storage }));
    await waitFor(() => {
      expect(rows().length, "§5 rule 4: the collapsed state is remembered").toBe(LINES.length - 2);
    });
  });
});

describe("§5 rule 5: column state persisted per user, keyed by table id", () => {
  test("the key format is `cubit.datatable.v1:<tableId>`", () => {
    expect(
      dataTableStorageKey(TABLE_ID),
      "one drawer per table id, per browser profile — the format is documented in table-state.ts",
    ).toBe(`cubit.datatable.v${DATA_TABLE_STATE_VERSION}:${TABLE_ID}`);
  });

  test("sort, width, visibility and pin make the round trip through the store", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    mount(table({ storage }));

    // Sort: the sortable column announces itself with aria-sort, and its control is the button
    // inside that header cell — the way a reader reaches it (R-UI-012).
    const sort = document.querySelector('[role="columnheader"][aria-sort] button');
    await user.click(sort as HTMLElement);
    await waitFor(() => {
      expect(readColumnState(storage, TABLE_ID).sorting, "a sort is remembered").toEqual([{ id: "qty", desc: false }]);
    });

    // Width: the column edge, moved on the keyboard (R-UI-012).
    const edge = byTestId(document.body, "datatable-resize-qty") as HTMLElement;
    edge.focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => {
      expect(readColumnState(storage, TABLE_ID).sizes.qty, "a resize is remembered").toBeGreaterThan(96);
    });

    // Visibility and pin: the column chooser in the header's ⋯.
    await user.click(byTestId(document.body, "datatable-columns-toggle") as HTMLElement);
    await user.click(byTestId(document.body, "datatable-column-toggle-unit") as HTMLElement);
    await user.click(byTestId(document.body, "datatable-pin-qty") as HTMLElement);
    await waitFor(() => {
      const held = readColumnState(storage, TABLE_ID);
      expect(held.hidden, "a hidden column is remembered").toEqual(["unit"]);
      expect(held.pinned.left, "a pinned column is remembered").toEqual(["qty"]);
    });

    const remembered = readColumnState(storage, TABLE_ID);
    unmountAll();
    mount(table({ storage }));
    await waitFor(() => {
      expect(
        allTestId(document.body, "datatable-header")[0]?.querySelectorAll('[role="columnheader"]').length,
        "the remembered hidden column does not come back",
      ).toBe(columns.length - 1);
    });
    expect(readColumnState(storage, TABLE_ID), "the second mount neither loses nor rewrites the furniture").toEqual(
      remembered,
    );
  });

  test("a corrupt payload is read as no furniture at all, and the grid still draws", async () => {
    const key = dataTableStorageKey(TABLE_ID);
    for (const corrupt of ["{", "null", "[]", '{"v":99,"hidden":["item"]}', '{"v":1,"hidden":"item","sorting":7}']) {
      expect(
        readColumnState(memoryStorage({ [key]: corrupt }), TABLE_ID),
        `a payload of \`${corrupt}\` is not furniture — the fallback is the empty state, never a throw`,
      ).toEqual({ sizes: {}, pinned: { left: [], right: [] }, sorting: [], hidden: [], collapsed: [] });
    }

    const storage = memoryStorage({ [key]: '{"v":1,"hidden":"item"' });
    mount(table({ storage }));
    await waitFor(() => {
      expect(rows().length, "a table whose furniture cannot be read is a table with default furniture").toBe(
        LINES.length,
      );
    });
  });
});

describe("§5 rule 10: the four row states, and the selection that rises to the shell", () => {
  test("a selected row is marked and raised; the table imports no inspector of its own", async () => {
    const user = userEvent.setup();
    const onRowSelect = vi.fn();
    mount(table({ onRowSelect }));

    const cell = allTestId(rows()[0] as HTMLElement, "datatable-cell")[0] as HTMLElement;
    await act(async () => {
      cell.focus();
      await Promise.resolve();
    });
    await user.keyboard(" ");
    await waitFor(() => {
      expect(rows()[0]?.getAttribute("data-selected"), "§5 rule 10: a selected row says so").toBe("true");
    });
    expect(onRowSelect.mock.calls, "§5 rule 10: selection rises to the shell as row ids, nothing more").toEqual([
      [[LINES[0]?.id]],
    ]);
  });

  test("a refused row is SHOWN with its mark and its refusal beneath it, never hidden", () => {
    const refusedId = LINES[2]?.id;
    mount(
      table({
        rowStateOf: (row: Line) => (row.id === refusedId ? { refused: true } : undefined),
        renderRefusal: (row: Line) => <p>{`no quantity for ${row.item}`}</p>,
      }),
    );
    expect(rows().length, "§5 rule 8: a refused row is never hidden").toBe(LINES.length);
    const refused = rows().find((row) => row.getAttribute("data-refused") === "true");
    expect(refused, "the refused row marks itself").toBeTruthy();
    expect(
      textOf(byTestId(refused as HTMLElement, "datatable-row-refused")),
      "the row carries the warning mark",
    ).toBe("⚠");
    expect(
      textOf(byTestId(document.body, "datatable-row-refusal")),
      "the refusal is rendered beneath the row, by the consumer's own RefusalState",
    ).toContain(LINES[2]?.item ?? "");
  });

  test("a stale row is muted and says why on focus", async () => {
    const reason = "read before the last measure";
    mount(table({ rowStateOf: (row: Line) => (row.id === LINES[0]?.id ? { stale: reason } : undefined) }));
    const cell = allTestId(rows()[0] as HTMLElement, "datatable-cell")[0] as HTMLElement;
    expect(cell.getAttribute("data-stale"), "§5 rule 8: a stale cell is muted through its own attribute").toBe("true");
    await act(async () => {
      cell.focus();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(textOf(byTestId(document.body, "tooltip-content")), "a stale row says why, on focus").toBe(reason);
    });
  });

  test("loading draws bones that keep the row height, and no data row", () => {
    mount(table({ loading: true, loadingRows: 6 }));
    expect(rows().length, "§5 rule 8: nothing is read while the answer is still arriving").toBe(0);
    expect(allTestId(document.body, "datatable-skeleton-row").length, "the bones keep the layout").toBe(6);
    expect(
      allTestId(document.body, "datatable-header").length,
      "the header is real while the body is a bone (§3.2's loading cell)",
    ).toBe(1);
  });
});

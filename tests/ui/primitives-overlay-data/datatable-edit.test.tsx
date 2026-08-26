// @vitest-environment jsdom
/**
 * The DataTable's inline edit cell (R-UI-010's named DataTable feature; Design Decision §3's
 * "Inline edit" contract; the closed contract's `datatable-cell-editor` id).
 *
 * The gesture begins on the keyboard and its response is read semantically — the editor's role and
 * accessible name, the callback's arguments, the focus destination — never by counting nodes
 * (Q-11). Every expected value is derived from the fixture the test passes in: the row id is the
 * fixture's own `getRowId`, the column id and header are the fixture column's, and the prefilled
 * value is the cell's own rendered text.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import type { Barrels, ColumnFixture, KeyboardUser } from "./support/primitives";
import {
  TABLE_ROWS,
  TESTIDS,
  allTestId,
  dt,
  getRowId,
  keyboardUser,
  loadBarrels,
  requireTestId,
  tabUntil,
  tableColumns,
  textOf,
} from "./support/primitives";
import { mount, unmountAll } from "./support/render";

afterEach(() => {
  unmountAll();
});

/** The fixture's editable column — the one the roster declares `meta.editable` on (B-19). */
const editableColumn = (columns: ColumnFixture[] = tableColumns()): ColumnFixture => {
  const hit = columns.find((column) => column.meta?.editable === true);
  expect(hit, "the column fixture must declare a meta.editable column for the edit contract").toBeTruthy();
  return hit as ColumnFixture;
};

const table = (
  b: Barrels,
  onCellEdit: (rowId: string, columnId: string, value: string) => void,
  columns: ColumnFixture[] = tableColumns(),
): React.ReactElement =>
  dt(b, "DataTable", { columns, data: TABLE_ROWS, getRowId, onCellEdit });

const firstRow = (): HTMLElement => {
  const rows = allTestId(document.body, TESTIDS.datatableRow);
  expect(rows.length, "the table must render its rows before a cell can be edited").toBeGreaterThan(0);
  return rows[0] as HTMLElement;
};

/** The editable cell of the first row, found through the column's own alignment/edit affordance. */
const editableCellButton = (): HTMLButtonElement => {
  const cells = allTestId(firstRow(), TESTIDS.datatableCell);
  const button = cells.map((cell) => cell.querySelector("button")).find((node) => node !== null);
  expect(
    button,
    "Design Decision §3: an editable cell renders its value inside a full-cell button",
  ).toBeTruthy();
  return button as HTMLButtonElement;
};

const editor = (): HTMLInputElement =>
  requireTestId(
    document.body,
    TESTIDS.datatableCellEditor,
    "Design Decision §3: Enter on an editable cell swaps its value for the core Input",
  ) as HTMLInputElement;

const noEditor = (): boolean => allTestId(document.body, TESTIDS.datatableCellEditor).length === 0;

/** Tab to the editable cell and open its editor with Enter — the keyboard gesture Q-11 requires. */
async function openEditor(user: KeyboardUser): Promise<{ button: HTMLButtonElement; value: string }> {
  const button = editableCellButton();
  const value = textOf(button);
  await tabUntil(user, (active) => active === button, "the editable cell's button");
  await user.keyboard("{Enter}");
  await waitFor(() => {
    expect(noEditor(), "the editor opens on Enter").toBe(false);
  });
  return { button, value };
}

describe("the DataTable's inline edit cell", () => {
  test("Enter opens the editor prefilled and named by its column, and Enter commits once", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("the inline edit cell");
    const column = editableColumn();
    const onCellEdit = vi.fn();
    mount(table(b, onCellEdit));

    const { value } = await openEditor(user);
    const input = editor();

    expect(
      Number(input.value),
      "Design Decision §3: the editor opens prefilled with the cell's value",
    ).toBe(Number(value));
    expect(
      input.getAttribute("aria-label"),
      "Design Decision §3: the editor is named by its column header (R-UI-012)",
    ).toBe(column.header);
    expect(document.activeElement, "Design Decision §3: the editor is focused on mount").toBe(input);

    // A new value derived from the fixture's own, so nothing here is a transcript.
    const next = `${Number(value) + 1}`;
    await user.clear(input);
    await user.type(input, next);
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(noEditor(), "Design Decision §3: Enter closes the editor").toBe(true);
    });
    expect(
      onCellEdit.mock.calls,
      "Design Decision §3: Enter commits exactly one onCellEdit(rowId, columnId, value) call",
    ).toEqual([[getRowId(TABLE_ROWS[0]), column.id, next]]);
    expect(
      document.activeElement,
      "Design Decision §3: focus returns to the cell button — a keyboard journey never ends on the body",
    ).toBe(editableCellButton());
  });

  test("Escape cancels: no onCellEdit, and focus returns to the cell button", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("the inline edit cell");
    const onCellEdit = vi.fn();
    mount(table(b, onCellEdit));

    const { value } = await openEditor(user);
    const input = editor();
    await user.clear(input);
    await user.type(input, `${Number(value) + 1}`);
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(noEditor(), "Design Decision §3: Escape closes the editor").toBe(true);
    });
    expect(onCellEdit.mock.calls, "Design Decision §3: Escape cancels — it commits nothing").toEqual([]);
    expect(document.activeElement, "Design Decision §3: focus returns to the cell button").toBe(
      editableCellButton(),
    );
  });

  test("leaving the editor commits once through blur", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("the inline edit cell");
    const column = editableColumn();
    const onCellEdit = vi.fn();
    mount(table(b, onCellEdit));

    const { value } = await openEditor(user);
    const input = editor();
    await user.clear(input);
    await user.type(input, `${Number(value) + 2}`);
    await act(async () => {
      fireEvent.focusOut(input);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(noEditor(), "Design Decision §3: blur closes the editor").toBe(true);
    });
    expect(
      onCellEdit.mock.calls,
      "Design Decision §3: blur commits one onCellEdit(rowId, columnId, value) call",
    ).toEqual([[getRowId(TABLE_ROWS[0]), column.id, `${Number(value) + 2}`]]);
  });

  test("the gesture that ends the edit settles it: the unmount's blur neither doubles a commit nor overturns a cancel", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("the inline edit cell");
    const onCellEdit = vi.fn();
    mount(table(b, onCellEdit));

    // Removing a focused field fires a native blur in a real browser. Batching the two events into
    // one act reproduces that race deterministically: the editor is still attached when the blur
    // arrives, so both handlers run for one keystroke.
    await openEditor(user);
    const committing = editor();
    await act(async () => {
      fireEvent.keyDown(committing, { key: "Enter" });
      fireEvent.focusOut(committing);
      await Promise.resolve();
    });
    expect(
      onCellEdit.mock.calls.length,
      "one Enter is one commit, whatever blur the unmount fires behind it",
    ).toBe(1);

    onCellEdit.mockClear();
    await openEditor(user);
    const cancelling = editor();
    await act(async () => {
      fireEvent.keyDown(cancelling, { key: "Escape" });
      fireEvent.focusOut(cancelling);
      await Promise.resolve();
    });
    expect(
      onCellEdit.mock.calls,
      "Escape cancels: the blur that follows the editor's unmount must not commit in its place",
    ).toEqual([]);
  });

  test("a column whose header is not a string still names its editor", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("the inline edit cell");
    const column = editableColumn();
    // The normal TanStack idiom: a header that renders rather than reads. It stringifies into
    // nothing a screen reader can use, so the column id must stand in (R-UI-012).
    const columns = tableColumns().map((candidate) =>
      candidate.id === column.id
        ? ({
            ...candidate,
            header: () => React.createElement("span", null, column.header),
          } as unknown as ColumnFixture)
        : candidate,
    );
    const onCellEdit = vi.fn();
    mount(table(b, onCellEdit, columns));

    await openEditor(user);
    const label = editor().getAttribute("aria-label") ?? "";

    expect(label, "R-UI-012: a rendered header names the editor by its column id").toBe(column.id);
    expect(
      /=>|function|\[object/.test(label),
      `R-UI-012: the editor's accessible name must not be a stringified header — got \`${label}\``,
    ).toBe(false);
  });
});

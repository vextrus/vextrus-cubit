// @vitest-environment jsdom
/**
 * R-UI-012: what the DataTable announces about its own shape. `aria-rowcount` is the total of the
 * rows the user can reach — the header rows the table actually renders plus the rows currently in
 * its row model — and every rendered row's `aria-rowindex` names its place in that same set. A
 * count taken from the unfiltered data prop while the indices are taken from the filtered model
 * describes two different tables.
 *
 * Both expected values are derived from the document the table itself renders (B-19).
 */
import { afterEach, describe, expect, test } from "vitest";
import { waitFor } from "@testing-library/react";
import type { Barrels } from "./support/primitives";
import {
  COLUMN_IDS,
  TABLE_ROWS,
  TESTIDS,
  allTestId,
  dt,
  filterTestId,
  getRowId,
  keyboardUser,
  loadBarrels,
  requireTestId,
  tableColumns,
} from "./support/primitives";
import { mount, unmountAll } from "./support/render";

afterEach(() => {
  unmountAll();
});

const table = (b: Barrels): ReturnType<typeof dt> =>
  dt(b, "DataTable", { columns: tableColumns(), data: TABLE_ROWS, getRowId });

/** The rows the header actually renders — the column-header row, and the filter row when it exists. */
const headerRowCount = (): number =>
  requireTestId(document.body, TESTIDS.datatableHeader, "the DataTable renders a header").querySelectorAll(
    '[role="row"]',
  ).length;

const bodyRowIndices = (): number[] =>
  allTestId(document.body, TESTIDS.datatableRow).map((row) => Number(row.getAttribute("aria-rowindex")));

const rowCount = (): number =>
  Number(
    requireTestId(document.body, TESTIDS.datatable, "the DataTable renders a root").getAttribute("aria-rowcount"),
  );

/** The count and the indices must describe one set: the body's places follow the header's. */
function expectOneSet(visibleRows: number, when: string): void {
  const headers = headerRowCount();
  expect(rowCount(), `R-UI-012: ${when}, aria-rowcount is the reachable rows — ${headers} header + ${visibleRows} body`).toBe(
    headers + visibleRows,
  );
  expect(
    bodyRowIndices(),
    `R-UI-012: ${when}, each body row's aria-rowindex continues from the last header row`,
  ).toEqual(Array.from({ length: visibleRows }, (_, i) => headers + i + 1));
}

describe("R-UI-012: the DataTable's announced row shape", () => {
  test("the count covers the header rows, and the indices continue from them", async () => {
    const b = await loadBarrels();
    mount(table(b));

    expect(headerRowCount(), "the fixture's filterable column renders a filter row beside the header row").toBe(2);
    expectOneSet(TABLE_ROWS.length, "unfiltered");
  });

  test("filtering narrows the count with the rows it narrows", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("the DataTable's row shape");
    mount(table(b));

    const query = TABLE_ROWS[3]?.item ?? "";
    const expected = TABLE_ROWS.filter((row) => row.item.toLowerCase().includes(query.toLowerCase()));
    expect(expected.length, "the fixture must make this query selective").toBeLessThan(TABLE_ROWS.length);

    await user.type(
      requireTestId(document.body, filterTestId(COLUMN_IDS.item), "the filterable column renders its filter input"),
      query,
    );

    await waitFor(() => {
      expect(allTestId(document.body, TESTIDS.datatableRow).length, "the filter narrows the rendered rows").toBe(
        expected.length,
      );
    });
    expectOneSet(expected.length, "filtered");
  });
});

// @vitest-environment jsdom
/**
 * R-UI-005's density switch on a MOUNTED table. The public criterion asserts the reflected
 * attribute; this suite asserts the consequence the clause is actually about — the two row heights
 * — on the one path a user-reachable control will take: toggling the prop in place, never a
 * remount. A virtualiser that caches its measurements passes the attribute check and still lays the
 * list out at the old height, so the scroll extent is the observable that tells the truth.
 *
 * Every expected value is derived: the extent is the fixture's own row count times the density's
 * row height, both imported from the single declaration in the support roster (B-19).
 */
import { afterEach, describe, expect, test } from "vitest";
import { act, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import {
  DATA_BARREL,
  ROW_HEIGHT_COMFORTABLE_PX,
  ROW_HEIGHT_COMPACT_PX,
  TESTIDS,
  VIRTUAL_ROW_COUNT,
  allTestId,
  getRowId,
  loadBarrels,
  requireTestId,
  tableColumns,
  virtualRows,
} from "./support/primitives";
import { mount, unmountAll } from "./support/render";

afterEach(() => {
  unmountAll();
});

const TOGGLE_TESTID = "density-toggle";

/** The largest inline `height: …px` under the viewport — the virtualiser's total-size element. */
function totalExtentPx(viewport: HTMLElement): number {
  let largest = 0;
  for (const node of viewport.querySelectorAll("*")) {
    const match = /^([\d.]+)px$/.exec(((node as HTMLElement).style?.height ?? "").trim());
    if (match) largest = Math.max(largest, Number(match[1]));
  }
  expect(largest, "the virtualiser sizes its total extent so the scrollbar reflects the whole list").toBeGreaterThan(0);
  return largest;
}

describe("R-UI-005: the density switch on a mounted DataTable", () => {
  test("toggling the density prop in place re-measures the list", async () => {
    const b = await loadBarrels();
    const component = b.data.DataTable;
    expect(typeof component, `${DATA_BARREL} does not export a component named \`DataTable\``).toBe("function");
    const data = virtualRows();

    // The consumer R-UI-005 names: a control that changes density on a table already on screen.
    function Harness(): React.ReactElement {
      const [density, setDensity] = React.useState("comfortable");
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "button",
          {
            type: "button",
            "data-testid": TOGGLE_TESTID,
            onClick: () => setDensity((current) => (current === "comfortable" ? "compact" : "comfortable")),
          },
          "density",
        ),
        React.createElement(component as React.ComponentType<Record<string, unknown>>, {
          columns: tableColumns(),
          data,
          getRowId,
          density,
        }),
      );
    }

    mount(React.createElement(Harness));

    const root = requireTestId(document.body, TESTIDS.datatable, "the DataTable renders a root");
    const viewport = requireTestId(document.body, TESTIDS.datatableViewport, "the DataTable renders a scroll container");

    expect(root.getAttribute("data-density"), "the table starts comfortable").toBe("comfortable");
    expect(
      totalExtentPx(viewport),
      `R-UI-005: ${VIRTUAL_ROW_COUNT} comfortable rows span ${VIRTUAL_ROW_COUNT * ROW_HEIGHT_COMFORTABLE_PX} px`,
    ).toBe(VIRTUAL_ROW_COUNT * ROW_HEIGHT_COMFORTABLE_PX);

    await act(async () => {
      fireEvent.click(requireTestId(document.body, TOGGLE_TESTID, "the harness renders its density control"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(root.getAttribute("data-density"), "the toggle switches the table to compact").toBe("compact");
    });
    await waitFor(() => {
      expect(
        totalExtentPx(viewport),
        `R-UI-005: the compact list must re-measure to ${VIRTUAL_ROW_COUNT * ROW_HEIGHT_COMPACT_PX} px — a cached measurement leaves every row at the comfortable height`,
      ).toBe(VIRTUAL_ROW_COUNT * ROW_HEIGHT_COMPACT_PX);
    });
  });

  test("a row's height is the stylesheet's, never an inline pixel that outranks it", async () => {
    const b = await loadBarrels();
    const component = b.data.DataTable;
    mount(
      React.createElement(component as React.ComponentType<Record<string, unknown>>, {
        columns: tableColumns(),
        data: virtualRows(20),
        getRowId,
        density: "compact",
      }),
    );

    const withInlineHeight = allTestId(document.body, TESTIDS.datatableRow).filter(
      (row) => row.style.height !== "",
    );
    expect(
      withInlineHeight.map((row) => row.style.height),
      "R-UI-005/B-17: the two row heights live in the stylesheet's density rules; an inline height would beat them and give density a second home",
    ).toEqual([]);
  });
});

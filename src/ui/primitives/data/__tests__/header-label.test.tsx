// @vitest-environment jsdom
/**
 * DataTable v2 — a composed header's words (s-takeoff I-472, R-UI-082, R-UI-012).
 *
 * A header may be a render function (a word inside its Tooltip trigger, say), and a function states
 * no text the table can name the column by where no header is rendered: the column drawer's label,
 * the resize handle's name, the filter's name. The table read the column's id there, so the
 * register's drawer listed `bases` in lower case beside `Kind` and `Value`. A column states its words
 * as `meta.label`; a string header stays its own words. Every expectation is read off the columns the
 * test passes in.
 */
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { DataTable, type DataTableColumnDef } from "../data-table";
import { LINES, byTestId, mount, rowIdOf, textOf, unmountAll, type Line } from "./support";
import { TESTIDS } from "@/ui/testids";

afterEach(() => {
  unmountAll();
});

/** The words the composed header draws, and the words its column states for it. */
const COMPOSED = { id: "qty", said: "Quantity" } as const;
const PLAIN = { id: "item", said: "Item" } as const;
const TAIL = { id: "tail", said: "Tail" } as const;

function columns(label: string | undefined): DataTableColumnDef<Line>[] {
  return [
    { id: PLAIN.id, accessorKey: "item", header: PLAIN.said, size: 160, meta: { filterable: true } },
    {
      id: COMPOSED.id,
      accessorKey: "qty",
      // A header composed as a screen composes one: the word inside an element of its own.
      header: () => <span className="hinted">{COMPOSED.said}</span>,
      size: 96,
      meta: { filterable: true, ...(label === undefined ? {} : { label }) },
    },
    // A trailing column, so the composed one is not the row's last: the last column carries no resize
    // handle (a grid ends at its last column, and the Columns tool stands over that edge).
    { id: TAIL.id, header: TAIL.said, accessorFn: () => "", size: 64 },
  ];
}

const table = (label: string | undefined) => (
  <DataTable tableId="test-header-label" columns={columns(label)} data={[...LINES]} getRowId={rowIdOf} storage={null} />
);

/** The drawer's label for one column, opened as a reader opens it — the `⋯` beside the header. */
async function drawerLabel(id: string): Promise<string> {
  await userEvent.setup().click(byTestId(document.body, TESTIDS.datatable.columnsToggle) as HTMLElement);
  const toggle = byTestId(document.body, `datatable-column-toggle-${id}`);
  expect(toggle, `the drawer lists \`${id}\``).not.toBeNull();
  return textOf(toggle?.closest("label"));
}

describe("I-472: a composed header is named by the words its column states", () => {
  test("the drawer, the resize handle and the filter say the column's words, never its id", async () => {
    mount(table(COMPOSED.said));
    expect(await drawerLabel(COMPOSED.id), "the drawer lists the column by its words").toBe(COMPOSED.said);
    const resize = byTestId(document.body, `datatable-resize-${COMPOSED.id}`);
    expect(resize?.getAttribute("aria-label"), "the resize handle is named by them").toContain(COMPOSED.said);
    expect(resize?.getAttribute("aria-label"), "and not by the id").not.toMatch(new RegExp(`\\b${COMPOSED.id}\\b`, "u"));
    const filter = byTestId(document.body, `datatable-filter-${COMPOSED.id}`);
    expect(filter?.getAttribute("aria-label"), "and so is its filter").toContain(COMPOSED.said);
  });

  test("a string header is its own words; a composed header that states none still falls back to its id", async () => {
    mount(table(undefined));
    expect(await drawerLabel(PLAIN.id), "a string header needs no label").toBe(PLAIN.said);
    const composed = byTestId(document.body, `datatable-column-toggle-${COMPOSED.id}`);
    expect(textOf(composed?.closest("label")), "without a label the id is what is left — the fallback, not the rule").toBe(COMPOSED.id);
  });
});

describe("the last column carries no resize handle", () => {
  test("its right edge is the grid's own, where the Columns tool stands (SC 2.5.8)", () => {
    mount(table(undefined));
    expect(byTestId(document.body, `datatable-resize-${COMPOSED.id}`), "an inner column is resized from its edge").not.toBeNull();
    expect(byTestId(document.body, `datatable-resize-${TAIL.id}`), "the last column offers no handle beneath the Columns tool").toBeNull();
  });
});

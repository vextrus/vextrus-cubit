// @vitest-environment jsdom
/**
 * I-285 and I-286, read from the DOM the two screens draw: the sets and the drawings a set may name
 * are GRIDS — the one shipped DataTable — and each stands inside the region whose id the closed
 * contract already named, publishing the row count the table itself drew.
 *
 * WHY THIS SUITE EXISTS BESIDE screens.test.ts. That suite judges the anatomy of a row; this one
 * judges the SURFACE the rows stand on, which is what the craft rubric reads: the region the
 * retrying reads wait on (`data-rows-rendered`), and the `role="grid"` candidate inside it that the
 * rubric measures the primary work surface at (AM-08 Part 2, scripts/probe/lib/craft.mjs). A list
 * that answered every row assertion and was no grid is exactly what these screens were before.
 *
 * Nothing is transcribed: the ids come from the registry, the row counts from the data handed in.
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { createHash, randomUUID } from "node:crypto";
import { createElement, type FunctionComponent } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { productModule } from "../../server/support/wire";
import { TESTIDS } from "../../../src/ui/testids";

/** The two mountable screens (increment interfaces, Design Decision § 1). */
const SETS_DIR = "src/app/(app)/t/[tenant]/p/[project]/drawings/sets";
const SETS_INDEX_COMPONENT = `${SETS_DIR}/sets-index.tsx`;
const SET_BROWSER_COMPONENT = `${SETS_DIR}/[set]/set-browser.tsx`;

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";

/** A component of the product, as this file mounts one. */
type Mountable = (props: Record<string, unknown>) => unknown;

afterEach(() => {
  cleanup();
});

async function componentOf(home: string, name: string): Promise<Mountable> {
  const module = await productModule<Record<string, unknown>>(home);
  expect(typeof module[name], `${home} publishes \`${name}\` (increment interfaces)`).toBe("function");
  return module[name] as Mountable;
}

function mount(component: Mountable, props: Record<string, unknown>): HTMLElement {
  const { container } = render(createElement(component as unknown as FunctionComponent, props));
  return container;
}

function all(scope: HTMLElement, testId: string): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)];
}

function one(scope: HTMLElement, testId: string, where: string): HTMLElement {
  const found = all(scope, testId);
  expect(found.length, `${where} renders exactly one ${testId} (Design Decision § 7)`).toBe(1);
  return found[0] as HTMLElement;
}

/** The sha256 of some text, lowercase hex — the address a drawing revision is content-addressed by. */
function sha256OfText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

let seed = 0;

/** One row of the sets index, as the module answers one. */
function summary(name: string, pinned: boolean) {
  seed += 1;
  return {
    setId: randomUUID(),
    name,
    memberCount: seed,
    revisionCount: pinned ? seed : 0,
    currentDigest: pinned ? sha256OfText(`${name}-${seed}`) : null,
  };
}

/** One drawing lineage of `count` revisions, as the module answers one. */
function lineage(name: string, count: number) {
  const drawingId = randomUUID();
  const revisions = Array.from({ length: count }, (_, at) => ({
    revisionId: at === 0 ? drawingId : randomUUID(),
    sha256: sha256OfText(`${name}-${(seed += 1)}`),
    ordinal: at + 1,
    createdAt: new Date(Date.UTC(2026, 0, 1 + at)).toISOString(),
  }));
  return { drawingId, name, format: "dxf", revisions, current: revisions[count - 1] };
}

/**
 * The grid a region holds, judged as a grid: the DataTable's own root, the table it is remembered
 * under, the density its rows read at, and the count it says it drew — which the region repeats, so
 * a retrying read and the rubric are looking at the same number (B-17).
 */
function gridOf(region: HTMLElement, tableId: string, rows: number): HTMLElement {
  const grid = one(region, TESTIDS.datatable.root, `the region ${region.getAttribute("data-testid") ?? ""}`);
  expect(grid.getAttribute("role"), "the primary work surface is a grid — the candidate the craft rubric measures (AM-08 Part 2)").toBe("grid");
  expect(grid.getAttribute("data-table-id"), "remembered under this screen's own table id").toBe(tableId);
  expect(grid.getAttribute("data-density"), "and read at the compact 28 px row every reference surface of this product reads at (CLAUDE.md's grid law)").toBe("compact");
  expect(grid.getAttribute("data-rows-rendered"), `the table publishes the ${rows} rows it drew`).toBe(String(rows));
  expect(region.getAttribute("data-rows-rendered"), "and the region a retrying read waits on repeats that very number, never the length of the data it handed over").toBe(String(rows));
  return grid;
}

describe("I-285: the sets index is a grid", () => {
  test("I-285: the sets stand in one DataTable inside the region the contract names, which publishes the rows it drew", async () => {
    const screen = await componentOf(SETS_INDEX_COMPONENT, "SetsIndex");
    const held = [summary("Tender set", true), summary("Revision set", false), summary("Structural set", true)];
    const container = mount(screen, { tenantId: TENANT, projectId: PROJECT, sets: held, canPin: true, createSet: async () => ({ created: true, setId: randomUUID() }) });

    const region = one(container, TESTIDS.sets.index, "the sets index");
    const grid = gridOf(region, "s-drawings-sets", held.length);

    const rows = all(grid, TESTIDS.set.row);
    expect(
      rows.map((row) => row.getAttribute("data-set")),
      "one grid row per set the project holds, in the order the module answered them",
    ).toEqual(held.map((set) => set.setId));
    expect(
      rows.map((row) => row.querySelector('[role="rowheader"]')?.textContent),
      "and the frozen key column of each row is that set's own name",
    ).toEqual(held.map((set) => set.name));
    for (const row of rows) {
      expect(row.getAttribute("role"), "a row of the grid is a row of the grid (R-UI-012)").toBe("row");
      const cells = [...row.querySelectorAll<HTMLElement>(`[data-testid="${TESTIDS.datatable.cell}"]`)];
      expect(cells.length, "drawn as cells — the name, the two counts, the digest and the door").toBe(5);
      expect(cells[0]?.getAttribute("role"), "the name is the frozen key column, which is the row's header cell (§5 rule 3)").toBe("rowheader");
      expect(cells[0]?.getAttribute("data-pinned"), "and it is pinned left, so it stands still while the row scrolls").toBe("left");
    }
  });
});

describe("I-286: the drawings a set may name are a grid", () => {
  test("I-286: the lineages stand in one DataTable inside the region the contract names, which publishes the rows it drew", async () => {
    const screen = await componentOf(SET_BROWSER_COMPONENT, "SetBrowser");
    const member = lineage("member.dxf", 2);
    const outsider = lineage("outsider.dxf", 1);
    const set = { setId: randomUUID(), name: "Tender set", members: [member.drawingId], revisions: [] };
    const container = mount(screen, {
      tenantId: TENANT,
      projectId: PROJECT,
      set,
      lineages: [member, outsider],
      canPin: true,
      toggle: async () => ({ toggled: true, member: true }),
      preview: async () => ({ previewed: false, refusal: "SET_NOT_PINNABLE" }),
      commit: async () => ({ committed: false, refusal: "SET_NOT_PINNABLE" }),
    });

    const region = one(container, TESTIDS.set.drawings, "the set browser");
    const grid = gridOf(region, "s-drawings-set-members", 2);

    const rows = all(grid, TESTIDS.set.drawing);
    expect(
      rows.map((row) => row.getAttribute("data-drawing")),
      "one grid row per lineage the project holds, whether or not the set names it",
    ).toEqual([member.drawingId, outsider.drawingId]);
    expect(
      rows.map((row) => row.querySelector('[role="rowheader"]')?.textContent),
      "and the frozen key column of each row is that drawing's own name",
    ).toEqual([member.name, outsider.name]);
    for (const row of rows) {
      expect(row.getAttribute("role"), "a row of the grid is a row of the grid (R-UI-012)").toBe("row");
      const cells = [...row.querySelectorAll<HTMLElement>(`[data-testid="${TESTIDS.datatable.cell}"]`)];
      expect(cells.length, "drawn as cells — the name, the count, the revision history and the membership toggle").toBe(4);
      expect(cells[0]?.getAttribute("role"), "the drawing's name is the frozen key column, which is the row's header cell (§5 rule 3)").toBe("rowheader");
      expect(cells[3]?.getAttribute("data-control"), "and the toggle stands in a control well, so cell and control are one target (WCAG 2.2 SC 2.5.8)").toBe("true");
    }

    // I-101: the column a reader may not act through is not built at all — a control that can only
    // refuse is theatre, and an empty well would still be a column of the grid.
    cleanup();
    const denied = mount(screen, { tenantId: TENANT, projectId: PROJECT, set, lineages: [member, outsider], canPin: false, toggle: async () => ({ toggled: false, refusal: "PERMISSION_NOT_HELD" }) });
    const deniedRows = all(one(denied, TESTIDS.set.drawings, "the denied set browser"), TESTIDS.set.drawing);
    expect(deniedRows.length, "the browser stands whole for a reader without PIN_SET — knowledge is not permission (I-101)").toBe(2);
    for (const row of deniedRows) {
      expect([...row.querySelectorAll(`[data-testid="${TESTIDS.datatable.cell}"]`)].length, "with three columns and no membership well").toBe(3);
    }
    expect(all(denied, TESTIDS.set.memberToggle).length, "and no toggle at all").toBe(0);
  });
});

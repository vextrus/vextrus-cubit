// @vitest-environment jsdom
/**
 * I-288 — the schedules region is the PRIMARY work surface, and it says so where the instrument
 * reads (docs/design/s-schedules.md §0 I-288, §1's region table, §7's hook contract; AM-08 Part 2).
 *
 * The craft rubric takes `workSurface` at the largest OUTERMOST candidate inside `shell-main` —
 * `[data-testid$="-grid"]` among them — so a schedules region whose scrolling frame carried no id
 * was measured at one `schedules-table` inside it, a quarter of the surface a reader reads. What is
 * asserted here is exactly that frame: that it carries the registry's `schedules-grid`, that every
 * stored table stands INSIDE it (so no table can be the outermost candidate), that the registry pane
 * and the sheet rail are left outside it as regions of their own, and that its `data-rows-rendered`
 * is the sum of the stored tables' band counts — a notes-only sheet saying `0` honestly.
 *
 * Nothing here freezes a number: every expectation is derived from the view the mount was handed, so
 * a fixture bearing another table grows the expectation with it (B-19). The chrome is the SHIPPED
 * chrome the route binds (I-170), and the id is read from the one registry, never spelled (AM-09 §1).
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { cleanup, render } from "@testing-library/react";
import { Fragment, createElement, type ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { SchedulesWorkspace, type SchedulesAddresses, type SchedulesChrome, type SchedulesDoors } from "@/modules/takeoff/schedules-ui";
import type { ScheduleCellView, ScheduleTableView, SchedulesView, SheetView } from "@/modules/takeoff/schedules-ui/view";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { EvidenceLink } from "@/ui/patterns/evidence-link";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button, EmptyState, EnumLabel, IdChip, NumberInput, Skeleton, Tooltip, UnitBadge } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { TESTIDS, testIdSelector } from "@/ui/testids";
// jsdom performs no layout, so a virtualised table renders nothing at all unless its scroll
// container is given a measurable box. The stubs are the shipped DataTable's own — installed from
// their one home, never written a second time beside them (B-17).
import { installDomStubs } from "../primitives-overlay-data/support/render";

afterEach(cleanup);

const TENANT = "7c2f0b3c-1111-4111-8111-111111111111";
const PROJECT = "7c2f0b3c-2222-4222-8222-222222222222";
const DRAWING = "7c2f0b3c-3333-4333-8333-333333333333";
const REVISION = "7c2f0b3c-4444-4444-8444-444444444444";

/* --------------------------------------------------------------------------- the reading, staged */

/** One stored cell, citing the one entity it was read off. */
function aCell(columnIndex: number, text: string): ScheduleCellView {
  return { columnIndex, text, sourceKeys: [`DXF_HANDLE:${columnIndex}${text.length}`] };
}

/** One stored table of `bands` data rows beneath its stored header band (I-250 — a header is not data). */
function aTable(scheduleKey: string, title: string, mark: string, bands: number): ScheduleTableView {
  return {
    scheduleKey,
    viewKey: `${scheduleKey}:view`,
    title,
    header: { rowIndex: 0, cells: [aCell(0, "MARK"), aCell(1, "SIZE")] },
    rows: Array.from({ length: bands }, (_unused, at) => ({
      rowIndex: at + 1,
      cells: [aCell(0, `${mark}${at + 1}`), aCell(1, "300x450")],
    })),
  };
}

/** One sheet of the pinned revision, holding whatever it is given and nothing else (I-248). */
function aSheet(layoutName: string, over: Partial<SheetView> = {}): SheetView {
  return {
    drawingId: DRAWING,
    layoutName,
    schedules: [],
    deferrals: [],
    families: [],
    notes: { proposals: [], readings: [], standings: [] },
    ...over,
  };
}

function aView(sheets: readonly SheetView[]): SchedulesView {
  return { projectId: PROJECT, setRevisionId: REVISION, sheets };
}

/** The bands the chosen sheet's stored tables hold, added up — the frame's own number (I-288). */
function storedBands(sheet: SheetView): number {
  return sheet.schedules.reduce((total, table) => total + table.rows.length, 0);
}

/* ------------------------------------------------------------------------------------ the mount */

const ADDRESSES: SchedulesAddresses = {
  selection: (sheet, sourceKeys) => `/t/${TENANT}/p/${PROJECT}/viewer/${sheet.drawingId}/${sheet.layoutName}?s=${sourceKeys.join(",")}`,
  drawings: `/t/${TENANT}/p/${PROJECT}/drawings`,
  participants: `/t/${TENANT}/p/${PROJECT}/settings/participants`,
};

/** The doors, never pressed here: this suite reads what the region PUBLISHES, and clicks nothing. */
const DOORS: SchedulesDoors = {
  schedules: () => Promise.reject(new Error("this suite presses no door")),
  previewTranscribeSheetNotes: () => Promise.reject(new Error("this suite presses no door")),
  commitTranscribeSheetNotes: () => Promise.reject(new Error("this suite presses no door")),
};

/** The shipped chrome, bound as `schedules-screen.tsx` binds it — what a reader sees is what mounts. */
const CHROME: SchedulesChrome = {
  testIds: {
    screen: TESTIDS.schedules.screen,
    empty: TESTIDS.schedules.empty,
    sheets: TESTIDS.schedules.sheets,
    sheetRow: TESTIDS.schedules.sheetRow,
    grid: TESTIDS.schedules.grid,
    table: TESTIDS.schedules.table,
    cell: TESTIDS.schedules.cell,
    deferral: TESTIDS.schedules.deferral,
    registry: TESTIDS.schedules.registry,
    family: TESTIDS.schedules.family,
    variant: TESTIDS.schedules.variant,
    zone: TESTIDS.schedules.zone,
    notes: TESTIDS.schedules.notes,
    standing: TESTIDS.schedules.standing,
    reading: TESTIDS.schedules.reading,
    proposal: TESTIDS.schedules.proposal,
    proposalValue: TESTIDS.schedules.proposalValue,
    transcribe: TESTIDS.schedules.transcribe,
    inspector: TESTIDS.schedules.inspector,
  },
  navTestId: TESTIDS.takeoff.navSchedules,
  DataTable,
  RefusalState,
  ConsequenceDialog,
  EmptyState,
  Button,
  NumberInput,
  Skeleton,
  IdChip,
  EnumLabel,
  UnitBadge,
  EvidenceLink,
  Tooltip,
  // The lane's tabs row and the frame's ONE inspector are the shell's, not this region's: the mount
  // claims both slots and renders what it is handed in place (the register's and s-levels' stages).
  TabsAside: () => null,
  InspectorMount: ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children ?? null),
};

/** Mount the shipped workspace over one reading and answer its own root. */
function mount(view: SchedulesView): HTMLElement {
  installDomStubs();
  const { container } = render(
    createElement(SchedulesWorkspace, {
      view,
      tenantId: TENANT,
      projectId: PROJECT,
      permitted: { MEASURE: true },
      offline: false,
      chrome: CHROME,
      doors: DOORS,
      addresses: ADDRESSES,
    }),
  );
  const root = container.querySelector<HTMLElement>(testIdSelector(TESTIDS.schedules.screen));
  expect(root, "the workspace renders its own root (§7)").not.toBeNull();
  return root as HTMLElement;
}

function one(root: HTMLElement, id: string): HTMLElement {
  const found = [...root.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
  expect(found.length, `exactly one ${id} stands on this screen, and ${found.length} do`).toBe(1);
  return found[0] as HTMLElement;
}

function all(root: HTMLElement, id: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
}

/* ------------------------------------------------------------------------------- the assertions */

describe("I-288: the schedules region publishes itself as the primary work surface", () => {
  test("the region's scrolling frame carries the registry's grid id, and every stored table stands inside it", () => {
    const sheet = aSheet("S-02", {
      schedules: [aTable("sched:columns", "COLUMN SCHEDULE", "C", 3), aTable("sched:beams", "BEAM SCHEDULE", "B", 2)],
    });
    const root = mount(aView([sheet]));

    const frame = one(root, TESTIDS.schedules.grid);
    const tables = all(root, TESTIDS.schedules.table);
    expect(tables.length, "both stored tables are drawn").toBe(sheet.schedules.length);
    for (const table of tables) {
      expect(
        frame.contains(table) && frame !== table,
        `the ${table.getAttribute("data-schedule") ?? "?"} table stands INSIDE the frame — a candidate inside a candidate is part of that region, never a region of its own (AM-08 Part 2)`,
      ).toBe(true);
    }
    // The notes panel is inside the region too (§1's region table), which is what makes the frame the
    // whole primary rather than the tables alone.
    expect(frame.contains(one(root, TESTIDS.schedules.notes)), "the notes panel scrolls inside the schedules region (§1, I-248)").toBe(true);
  });

  test("the frame publishes the sum of the stored tables' band counts, and each table still states its own", () => {
    const sheet = aSheet("S-02", {
      schedules: [aTable("sched:columns", "COLUMN SCHEDULE", "C", 3), aTable("sched:beams", "BEAM SCHEDULE", "B", 2)],
    });
    const root = mount(aView([sheet]));

    const frame = one(root, TESTIDS.schedules.grid);
    expect(
      frame.getAttribute("data-rows-rendered"),
      `the region states the bands its sheet's stored tables hold, added and not re-counted (I-250, I-288): ${storedBands(sheet)}`,
    ).toBe(String(storedBands(sheet)));

    // Each table goes on stating what IT drew, off the grid's own number: the frame's statement is
    // about the region, and it replaces nothing.
    for (const table of all(root, TESTIDS.schedules.table)) {
      expect(
        table.getAttribute("data-rows-rendered"),
        `the ${table.getAttribute("data-schedule") ?? "?"} table still publishes a row count of its own (§7)`,
      ).toMatch(/^\d+$/);
    }
  });

  test("a notes-only sheet publishes 0 — the honest count of a sheet that holds no table", () => {
    const sheet = aSheet("S-03", {
      notes: {
        proposals: [
          { kind: "LAP", sourceKey: "DXF_HANDLE:4122", text: "TENSION LAP 50d", valueAsWritten: "50", unitAsWritten: "d", canonical: "50", proposedBy: "grammar", callId: null, governs: null },
        ],
        readings: [],
        standings: [],
      },
    });
    const root = mount(aView([sheet]));

    const frame = one(root, TESTIDS.schedules.grid);
    expect(all(root, TESTIDS.schedules.table).length, "this sheet holds no schedule at all").toBe(0);
    expect(
      frame.getAttribute("data-rows-rendered"),
      "a region holding notes and no table says 0 — which is what that sheet holds, not a region that failed to paint (I-288)",
    ).toBe(String(storedBands(sheet)));
    expect(storedBands(sheet), "and the number derived from the reading is in fact zero").toBe(0);
  });

  test("the registry pane and the sheet rail are left outside the frame — each is a region of its own", () => {
    const sheet = aSheet("S-02", { schedules: [aTable("sched:columns", "COLUMN SCHEDULE", "C", 3)] });
    const root = mount(aView([sheet]));

    const frame = one(root, TESTIDS.schedules.grid);
    for (const id of [TESTIDS.schedules.registry, TESTIDS.schedules.sheets]) {
      const region = one(root, id);
      expect(frame.contains(region), `${id} stands beside the work surface, never wrapped by it (I-233, I-249, I-288)`).toBe(false);
      expect(region.contains(frame), `${id} does not hold the schedules region either`).toBe(false);
      expect(region.getAttribute("data-testid"), `${id} keeps its own id and takes no second one`).toBe(id);
    }
  });
});

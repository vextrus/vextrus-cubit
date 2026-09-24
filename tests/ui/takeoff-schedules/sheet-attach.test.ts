// @vitest-environment node
/**
 * I-550, I-551 — every schedule stands on the sheet that shows it, the rail lists only the sheets
 * that hold something, and a sheet's schedules stack in the order a quantity surveyor takes a
 * structure off (docs/design/s-schedules.md §0; `sheetsOfReading`, src/modules/takeoff/schedules-ui/
 * attach.ts; core's `sheetOfKey`, L-CAD-05).
 *
 * What walk-0 and walk-1 found (BLOCKS_DEMO): S-Schedules opened on "Model space" with every one of
 * F-RCC6-BNBC's seven schedules stacked there, ROOF BEAM SCHEDULE first, while S-11 COLUMN SCHEDULE —
 * the sheet a QS clicks for the column schedule — said only that its notes read no figure, and all 28
 * layouts stood in the rail because every sheet's title block is words.
 *
 * WHAT IS READ AND NOTHING IS STAGED: the committed fixture read by the SHIPPED `cad/` CLI and put
 * through the partition's pure stages (`../../takeoff/partition/support/bnbc-stages`) — the tables,
 * deferrals and families the rebuild stores — and composed by the screen's own reading. The sheet
 * roster is the artifact's; nothing below is transcribed from the screen.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { proposeNotes } from "@/core/notes/grammar";
import { framesOfGraph, sheetsOfGraph, spacesOfGraph } from "@/core/sheets/frames";
import { schedulesInQsOrder, sheetsOfReading, type DrawingReading, type LayoutWords } from "@/modules/takeoff/schedules-ui/attach";
import type { SheetView } from "@/modules/takeoff/schedules-ui/view";
import { BNBC_DXF, stagesOver } from "../../takeoff/partition/support/bnbc-stages";

/** How long the shipped CLI may take to read the drawing cold (the cad lane's own budget). */
const READ_MS = 300_000;

const DRAWING = "7c2f0b3c-3333-4333-8333-333333333333";

/** The sheet number a layout's name opens with — `S-11` of `S-11 COLUMN SCHEDULE`. */
const numberOf = (layoutName: string): string => layoutName.split(" ")[0] as string;

let rail: SheetView[];

beforeAll(async () => {
  const read = await stagesOver(BNBC_DXF);
  const { graph } = read;
  const layouts: LayoutWords[] = graph.layouts.map((layout) => ({
    layoutName: layout.name,
    kind: layout.kind,
    texts: graph.entities.filter((entity) => entity.space === layout.name && typeof entity.text === "string").map((entity) => ({ sourceKey: entity.key, text: entity.text as string })),
  }));
  const reading: DrawingReading = {
    drawingId: DRAWING,
    layouts,
    stored: {
      ingestId: "the committed fixture",
      schedules: read.reconstructed.tables.map((table) => ({ viewKey: table.viewKey, scheduleKey: table.scheduleKey, title: table.title, pitch: table.pitch, cells: table.cells })),
      deferrals: [...read.reconstructed.deferrals, ...read.registered.deferrals],
    },
    families: read.registered.families,
    anchors: new Map(read.evidence.views.map((view) => [view.viewKey, view.anchorKey])),
    record: { sheets: sheetsOfGraph(graph), spaces: spacesOfGraph(graph), frames: framesOfGraph(graph) },
    notesOf: (layout) => ({ proposals: proposeNotes(layout.texts).map((proposal) => ({ ...proposal, proposedBy: "grammar" as const, callId: null, governs: null })), readings: [], standings: [] }),
  };
  rail = sheetsOfReading(reading);
}, READ_MS);

describe("I-550: each schedule stands on the sheet whose window or title shows it", () => {
  // TEST_AMENDED (R0 Rev C, W-47): Rev C draws a slab panel schedule on each slab plan sheet —
  // S-19 (1ST FLOOR, 26CF), S-20 (TYPICAL FLOOR, 26D1), S-21 (ROOF & STAIR ROOF, 26D3) — so the
  // seven schedules on six sheets became ten on nine, each on the sheet that prints it.
  test("F-RCC6-BNBC's ten schedules stand on nine sheets — none on model space", () => {
    const placed = rail.flatMap((sheet) => sheet.schedules.map((table) => [numberOf(sheet.layoutName), table.title] as const));
    expect(placed, "every schedule the stages reconstructed, on the sheet that prints it, in the rail's order").toEqual([
      ["S-05", "PILE SCHEDULE  SCALE 1:50"],
      ["S-06", "PILE CAP SCHEDULE  SCALE 1:50"],
      ["S-11", "COLUMN SCHEDULE"],
      ["S-18", "ROOF BEAM SCHEDULE (1 OF 2)"],
      ["S-18", "ROOF BEAM SCHEDULE (2 OF 2)"],
      ["S-19", "SLAB PANEL SCHEDULE (1ST FLOOR)  SCALE 1:50"],
      ["S-20", "SLAB PANEL SCHEDULE (TYPICAL FLOOR)  SCALE 1:50"],
      ["S-21", "SLAB PANEL SCHEDULE (ROOF & STAIR ROOF)  SCALE 1:50"],
      ["S-25", "LINTEL & SUNSHADE SCHEDULE"],
      ["S-26", "BAR BENDING SCHEDULE (SAMPLE)"],
    ]);
    expect(new Set(placed.map(([sheet]) => sheet)).size).toBe(9);
  });

  test("S-11 COLUMN SCHEDULE holds the column schedule and the column families it named, and nothing of the beams'", () => {
    const s11 = rail.find((sheet) => numberOf(sheet.layoutName) === "S-11");
    expect(s11?.schedules.map((table) => table.title)).toEqual(["COLUMN SCHEDULE"]);
    expect(s11?.families.length, "the column schedule's own marks").toBeGreaterThan(0);
    expect(
      s11?.families.every((family) => /^C\d/.test(family.family)),
      `only column marks: ${JSON.stringify(s11?.families.map((family) => family.family))}`,
    ).toBe(true);
  });

  test("a deferral stands on the sheet of the view that deferred, and the long-section families on their own sheets", () => {
    const deferredOn = rail.filter((sheet) => sheet.deferrals.length > 0).map((sheet) => numberOf(sheet.layoutName));
    expect(deferredOn, "the two schedules that named no member say so where they are printed").toEqual(["S-25", "S-26"]);
    const familiesOn = rail.filter((sheet) => sheet.families.length > 0).map((sheet) => numberOf(sheet.layoutName));
    // The slab panel schedules' 43 families (W-47) stand on the three sheets that print them.
    expect(familiesOn).toEqual(["S-05", "S-06", "S-11", "S-16", "S-17", "S-18", "S-19", "S-20", "S-21"]);
  });
});

describe("I-248, I-551: the rail is the sheets that hold something, paper first, model space last", () => {
  test("a sheet whose title block is its only words is no row of the rail", () => {
    expect(rail.map((sheet) => (sheet.kind === "model" ? "model" : numberOf(sheet.layoutName)))).toEqual([
      "S-01",
      "S-02",
      "S-03",
      "S-05",
      "S-06",
      "S-11",
      "S-16",
      "S-17",
      "S-18",
      "S-19",
      "S-20",
      "S-21",
      "S-25",
      "S-26",
      "model",
    ]);
    const s10 = rail.find((sheet) => numberOf(sheet.layoutName) === "S-10");
    expect(s10, "S-10 COLUMN LAYOUT PLAN holds no schedule, no family and no figure a note states").toBeUndefined();
  });

  test("model space keeps only what its own words propose — no table, no deferral, no family", () => {
    const model = rail.find((sheet) => sheet.kind === "model");
    expect(model?.schedules).toEqual([]);
    expect(model?.deferrals).toEqual([]);
    expect(model?.families).toEqual([]);
  });
});

describe("I-551: a sheet's schedules stack foundation, columns, beams", () => {
  test("the stack is the QS's order whatever order the store keeps, and two of one class keep the store's", () => {
    const titles = ["ROOF BEAM SCHEDULE (1 OF 2)", "COLUMN SCHEDULE", "LINTEL & SUNSHADE SCHEDULE", "ROOF BEAM SCHEDULE (2 OF 2)", "PILE CAP SCHEDULE", "DOOR & WINDOW SCHEDULE", "PILE SCHEDULE"];
    expect(schedulesInQsOrder(titles.map((title) => ({ title }))).map((one) => one.title)).toEqual([
      "PILE SCHEDULE",
      "PILE CAP SCHEDULE",
      "COLUMN SCHEDULE",
      "ROOF BEAM SCHEDULE (1 OF 2)",
      "ROOF BEAM SCHEDULE (2 OF 2)",
      "LINTEL & SUNSHADE SCHEDULE",
      "DOOR & WINDOW SCHEDULE",
    ]);
  });
});

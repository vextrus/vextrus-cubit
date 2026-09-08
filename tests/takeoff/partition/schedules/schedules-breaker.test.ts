/**
 * Breaker acceptance for the fourth partition stage — three readings a really-drawn schedule owes
 * that the shipped reconstruction and registry do not give (L-CAD-08, R-TO-031).
 *
 * Every case here is a WHOLE artifact put through the shipped views stage (`partitionArtifact`) and
 * then through the two pure functions the increment publishes, so nothing below hand-feeds a view or
 * an assignment: what is graded is what a drawing drawn this way really reconstructs to.
 *
 * None of the three contradicts a criterion the public acceptance grades. AC-1's artifact carries one
 * trailing note and no stray text on a data band; AC-5's artifact carries two floor-band columns.
 * These are the same law applied to the drawings beside those — the ones the spec's own out-of-scope
 * says "rebuild and register the same way".
 */
import { describe, expect, test } from "vitest";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph/schema";
import { reconstructSchedules } from "@/modules/takeoff/partition/schedules/reconstruct";
import { registerMemberTypes } from "@/modules/takeoff/partition/schedules/registry";
import { partitionArtifact } from "@/modules/takeoff/partition/views/assign";

/** The spaces of the artifacts below, and the layers their texts stand on. */
const MODEL_SPACE = "Model";
const LAYER_CAPTIONS = "CAPTIONS";
const LAYER_TEXT = "SCHEDULE-TEXT";

/** The caption stands taller than the cells, which is what makes it a caption (L-CAD-06). */
const CAPTION_HEIGHT = 8;
const TEXT_HEIGHT = 2.5;

/** The caption the schedule is anchored on, and where it stands. */
const CAPTION = "COLUMN SCHEDULE";
const CAPTION_AT: readonly [number, number] = [600, 0];

/** The row spacing every artifact below draws its TABLE at — the pitch each one owes. */
const PITCH = 10;

/** One text as a drawing carries it: what it says, and where it was inserted. */
type Drawn = { readonly text: string; readonly x: number; readonly y: number };

/** One band of a drawing: the y its texts stand at, and the texts across it. */
type Band = { readonly y: number; readonly texts: readonly Drawn[] };

/** A source key of the DXF-handle scheme (L-CAD-02). */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/** A band drawn one cell per column, in column order. */
function band(y: number, xs: readonly number[], texts: readonly string[]): Band {
  return { y, texts: texts.map((text, index) => ({ text, x: xs[index] ?? 0, y })) };
}

/**
 * An EntityGraph v2 whose model space carries the caption and the bands asked for and nothing else —
 * no gridline, because L-CAD-08's reconstruction reads none.
 */
function artifactOf(bands: readonly Band[]): EntityGraph {
  let ordinal = 0;
  const colour = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" as const };
  const entities: unknown[] = [
    { key: handle((ordinal += 1)), type: "TEXT", space: MODEL_SPACE, layer: LAYER_CAPTIONS, colour, text: CAPTION, height: CAPTION_HEIGHT, points: [[...CAPTION_AT]] },
  ];
  for (const one of bands) {
    for (const text of one.texts) {
      entities.push({ key: handle((ordinal += 1)), type: "TEXT", space: MODEL_SPACE, layer: LAYER_TEXT, colour, text: text.text, height: TEXT_HEIGHT, points: [[text.x, text.y]] });
    }
  }
  return entityGraphSchema.parse({
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-breaker", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [{ name: MODEL_SPACE, kind: "model", bbox: { min: [-60, -260], max: [2100, 20] }, strays_rejected: 0 }],
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: [],
    counters: [],
  });
}

/** The one schedule table an artifact reconstructs to, with the registry folded out of it. */
function readingOf(bands: readonly Band[]): {
  readonly table: ReturnType<typeof reconstructSchedules>["tables"][number] | undefined;
  readonly deferrals: ReturnType<typeof reconstructSchedules>["deferrals"];
  readonly registry: ReturnType<typeof registerMemberTypes>;
} {
  const graph = artifactOf(bands);
  const partitioned = partitionArtifact(graph);
  const reconstructed = reconstructSchedules({ graph, views: partitioned.views, assignments: partitioned.assignments });
  return { table: reconstructed.tables[0], deferrals: reconstructed.deferrals, registry: registerMemberTypes(reconstructed.tables) };
}

/** The six columns and headers of the plain schedule the acceptance draws (AC-1). */
const XS: readonly number[] = [600, 630, 660, 690, 720, 750];
const HEADERS: readonly string[] = ["MARK", "GF TO 3RD", "4TH TO ROOF", "MAIN BAR", "TIES END ZONE", "TIES MID ZONE"];

/** One data row of that schedule, for a mark. */
function dataRow(mark: string): readonly string[] {
  return [mark, '12"x15"', '10"x12"', "8-16Ø", '10Ø @ 4" c/c', '10Ø @ 6" c/c'];
}

describe("breaker: a text standing off the table's columns is not a cell of it", () => {
  /**
   * L-CAD-08 takes a table's columns from its header, and a cell is what stands IN one. A revision
   * note drawn out in the margin, level with a data row, stands in no column of the table: folding it
   * into the nearest one rewrites the cell it lands on — and where it lands on the mark column, the
   * member that row names stops being a mark at all and the family is lost with no deferral to say so
   * (R-TO-031, L-QTY-04: half an answer is worse than none).
   */
  test("a margin note level with a data row neither joins the mark cell nor costs the row its family", () => {
    const reading = readingOf([
      band(-20, XS, HEADERS),
      // The margin note stands at x=400 — 200 out from the first column, where the columns themselves
      // stand 30 apart. Nothing about it is in the table.
      { y: -30, texts: [{ text: "REVISED 2024", x: 400, y: -30 }, ...band(-30, XS, dataRow("C-1")).texts] },
      band(-40, XS, dataRow("C2")),
    ]);

    const markCell = reading.table?.cells.find((cell) => cell.rowIndex === 1 && cell.columnIndex === 0);
    expect(markCell?.text).toBe("C-1");
    expect(reading.registry.families.map((family) => family.family)).toEqual(["C1", "C2"]);
  });
});

describe("breaker: the pitch is the table's own row spacing, not the median gap on the page", () => {
  /**
   * L-CAD-08 stops a table at a gap over 3.5× ITS PITCH, and the pitch is the spacing the schedule
   * stacks its rows at. A drawing whose general notes stand further apart than its rows must not
   * teach the reconstruction the notes' spacing: with the notes' gap taken for the pitch the 3.5×
   * stop never fires, and the notes themselves are stored as rows of the table carrying cited source
   * keys — a reader is shown a schedule with rows nobody drew.
   */
  test("three general notes stacked 5 pitches apart are cited by no cell, and the pitch stays the row spacing", () => {
    const reading = readingOf([
      band(-20, XS, HEADERS),
      band(-30, XS, dataRow("C-1")),
      band(-40, XS, dataRow("C2")),
      band(-90, [600], ["NOTE 1: TIES AS PER DETAIL"]),
      band(-140, [600], ["NOTE 2: COVER 40MM"]),
      band(-190, [600], ["NOTE 3: GRADE M25"]),
    ]);

    expect(reading.table?.pitch).toBe(PITCH);
    expect(reading.table?.cells.filter((cell) => cell.text.startsWith("NOTE"))).toEqual([]);
    // The header and the two data bands, and nothing beneath them.
    expect([...new Set(reading.table?.cells.map((cell) => cell.rowIndex) ?? [])]).toEqual([0, 1, 2]);
  });
});

describe("breaker: a schedule with no floor-band column still states a section and its rebar", () => {
  /**
   * R-TO-031 registers "sections, rebar zones" from a schedule, and the settled reading puts the
   * zones on the ROW — "every variant of that row carries the same zones". A schedule that heads its
   * section column `SIZE` rather than by a band of floors (the shape a beam schedule is drawn in, and
   * the one the spec says "rebuilds and registers the same way") states exactly the same facts. Today
   * such a row mints a family with no variant at all, so the section AND every zone the row states
   * are read and then dropped: placement is handed a member type that says nothing about the member,
   * and no deferral is recorded to say the reading was lost.
   */
  test("a MARK / SIZE / MAIN BAR / TIES schedule keeps the section and the rebar it states", () => {
    const xs = [600, 630, 660, 690];
    const reading = readingOf([
      band(-20, xs, ["MARK", "SIZE", "MAIN BAR", "TIES"]),
      band(-30, xs, ["C-1", '12"x15"', "8-16Ø", '10Ø @ 4" c/c']),
      band(-40, xs, ["C2", '15"x15"', "6-16Ø", '10Ø @ 4" c/c']),
    ]);

    const first = reading.registry.families.find((family) => family.family === "C1");
    expect(first).toBeDefined();
    // The section the row states, kept verbatim wherever the registry hangs it.
    expect(first?.variants.map((variant) => variant.sectionText)).toEqual(['12"x15"']);
    // And the rebar of that row, which `zonesOf` already reads and which must reach the answer.
    expect(first?.variants.flatMap((variant) => variant.zones.map((zone) => `${zone.zone}=${zone.text}`)).sort()).toEqual(['main=8-16Ø', 'ties=10Ø @ 4" c/c']);
  });
});

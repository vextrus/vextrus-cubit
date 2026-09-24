// @vitest-environment node
/**
 * FRM4-AD at the stage that reads it: what adjoins each side of a beam's run, and which drawn beams
 * the plan names.
 *
 * I-611 — until the slab panels are read, a side's slab reading is the plan's own two statements:
 * the thickness it states (`SLAB 150 THK`) and the plate it is cast over, tested by the ring as drawn.
 * A plan that states no slab reads no side; a probe off the plate reads "nothing adjoins" only where
 * the plan draws nothing else there. What was wrong: `sidesOf` read "0" off the widest unplaced ring's
 * BOX whether or not the plan stated any slab, so a beam plan whose widest ring was a grid bubble, or
 * whose second slab outline stood beside the first, billed beams at their full depth, COMPLETE —
 * S-15's SB-R4 on F-RCC6-BNBC Rev C, ~0.103 m³ over (L-QTY-06).
 *
 * PURE, in the unit lane: the shipped detector over hand-built v3 artifacts (every geometry drawn
 * HERE, B-19), then the two real drawings through the shipped `cad/` CLI.
 */
import { describe, expect, test } from "vitest";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph/schema";
import type { DetectedGrid, GridAxisRow } from "@/modules/takeoff/partition/grid/detect";
import { detectPlacements } from "@/modules/takeoff/partition/placement/detect";
import type { FamilyNamed, PlacementEvidence, RunReading, RunRow } from "@/modules/takeoff/partition/placement/rows";
import type { PlacementShares } from "@/modules/takeoff/partition/placement/shares";
import type { PartitionedView } from "@/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";
import { writtenAtV3 } from "../../../cad/support/entitygraph-versions";
import { BNBC_DXF, RCC6_DXF, stagesOver, type StagesRead } from "../support/bnbc-stages";

/** The grid every piece below is drawn on, and so the distance every share scales by. */
const SPACING = 2400;

/** The platform edition's own shares (the seed's): the band is 192 and the reach 2160. */
const SHARES: PlacementShares = { containmentMerge: "0.08", nearAnchor: "0.9", footprintMin: "0.6", footprintMax: "2.5" };

const CAPTION_KEY = "DXF_HANDLE:1";
const VIEW: PartitionedView = { viewKey: `${VIEW_TYPE.LAYOUT_PLAN}:${CAPTION_KEY}`, type: VIEW_TYPE.LAYOUT_PLAN, reason: null, caption: "ROOF BEAM LAYOUT", anchorKey: CAPTION_KEY };
const COLOUR = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" as const };

/** The columns' drawn side, and the beams' drawn width — inside the band, so the band pairs them. */
const COLUMN_SIDE = 400;
const WIDTH = 150;
const FACE = COLUMN_SIDE / 2;

type Point = readonly [number, number];
type Piece = { readonly said: string; readonly at: Point } | { readonly ring: readonly Point[]; readonly layer: string } | { readonly line: readonly [Point, Point]; readonly layer?: string };

/** A beam drawn as its two edge lines, half its width either side of its axis. */
function beam(from: Point, to: Point, width = WIDTH, layer?: string): Piece[] {
  const along = Math.abs(to[0] - from[0]) >= Math.abs(to[1] - from[1]) ? "x" : "y";
  const [dx, dy] = along === "x" ? [0, width / 2] : [width / 2, 0];
  const on = layer === undefined ? {} : { layer };
  return [
    { line: [[from[0] - dx, from[1] - dy], [to[0] - dx, to[1] - dy]], ...on },
    { line: [[from[0] + dx, from[1] + dy], [to[0] + dx, to[1] + dy]], ...on },
  ];
}

const box = (min: Point, max: Point): Point[] => [
  [min[0], min[1]],
  [max[0], min[1]],
  [max[0], max[1]],
  [min[0], max[1]],
];

/** Columns at A1, B1, C1, A2, B2, C2, each lettered `C1` at its centre. */
const COLUMNS: readonly Piece[] = [0, SPACING, 2 * SPACING].flatMap((x) =>
  [0, SPACING].flatMap((y): Piece[] => [
    { ring: box([x - FACE, y - FACE], [x + FACE, y + FACE]), layer: "COLUMN" },
    { said: "C1", at: [x, y] },
  ]),
);

/** The beam on grid 1 across bay A–B, lettered below it; and the one across bay B–C, lettered below it. */
const AB1 = [...beam([FACE, 0], [SPACING - FACE, 0]), { said: "B1", at: [SPACING / 2, -2 * WIDTH] as Point }];
const BC1 = [...beam([SPACING + FACE, 0], [2 * SPACING - FACE, 0]), { said: "B2", at: [1.5 * SPACING, -2 * WIDTH] as Point }];
/** The beam on grid 2 across bay A–B, lettered above it. */
const AB2 = [...beam([FACE, SPACING], [SPACING - FACE, SPACING]), { said: "B3", at: [SPACING / 2, SPACING + 2 * WIDTH] as Point }];

const STATED: Piece = { said: "SLAB 150 THK", at: [SPACING / 2, SPACING / 2] };

const FAMILIES: readonly FamilyNamed[] = [
  { family: "C1", variants: [{ sectionWidth: COLUMN_SIDE, sectionDepth: COLUMN_SIDE }] },
  ...["B1", "B2", "B3"].map((family): FamilyNamed => ({ family, variants: [{ sectionWidth: WIDTH, sectionDepth: 450 }] })),
];

const axis = (family: "letter" | "numeral", label: string, along: "x" | "y", position: number, index: number): GridAxisRow => ({
  viewKey: VIEW.viewKey,
  family,
  label,
  axis: along,
  position,
  bubbleKey: `DXF_HANDLE:F${String(index)}0`,
  labelKey: `DXF_HANDLE:F${String(index)}1`,
  minSpacing: SPACING,
});
const GRID: DetectedGrid = {
  views: 1,
  axes: [axis("letter", "A", "x", 0, 1), axis("letter", "B", "x", SPACING, 2), axis("letter", "C", "x", 2 * SPACING, 3), axis("numeral", "1", "y", 0, 4), axis("numeral", "2", "y", SPACING, 5)],
  deferrals: [],
};

/** The drawing, parsed by the mirror; `frozen` names the layers its layer table freezes (v3, I-417). */
function drawn(pieces: readonly Piece[], frozen: readonly string[] = []): EntityGraph {
  const entities = pieces.map((piece, index) => {
    const key = `DXF_HANDLE:${(index + 2).toString(16).toUpperCase()}`;
    if ("said" in piece) return { key, type: "TEXT", space: "Model", layer: "TEXT", colour: COLOUR, text: piece.said, height: 150, points: [[piece.at[0], piece.at[1]]], rotation: 0 };
    if ("line" in piece) return { key, type: "LINE", space: "Model", layer: piece.layer ?? "BEAM", colour: COLOUR, points: piece.line.map((point) => [point[0], point[1]]) };
    return { key, type: "LWPOLYLINE", space: "Model", layer: piece.layer, colour: COLOUR, closed: true, points: piece.ring.map((point) => [point[0], point[1]]) };
  });
  const layers = [...new Set(entities.map((entity) => entity.layer))].map((name) => ({ name, on: true, frozen: frozen.includes(name), plot: true }));
  return entityGraphSchema.parse(
    writtenAtV3({
      layers,
      entitygraph_version: 2,
      ingest: { scheme: "DXF_HANDLE", tool: "cubit-test", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
      insunits: { code: 4, unit: "mm", unmapped: false },
      layouts: [{ name: "Model", kind: "model", bbox: null, strays_rejected: 0 }],
      dropped_layouts: [],
      entities,
      derived: [],
      block_attributes: [],
      counters: [],
    }),
  );
}

/** Each placed beam's two sides, by its mark, as `value basis` (or null where the side is unread). */
function sidesByMark(pieces: readonly Piece[]): Record<string, readonly [string | null, string | null]> {
  const graph = drawn(pieces);
  const evidence: PlacementEvidence = { graph, views: [VIEW], assignments: new Map(graph.entities.map((entity) => [entity.key, VIEW.viewKey])), grid: GRID, shares: SHARES, families: FAMILIES };
  const placed = detectPlacements(evidence);
  const runs = new Map((placed.runs ?? []).map((run) => [run.placementKey, run]));
  const said = (reading: RunReading | null): string | null => (reading === null ? null : `${reading.value} ${reading.basis}`);
  return Object.fromEntries(
    placed.placements
      .filter((row) => row.elementType === "beam")
      .map((row) => {
        const run = runs.get(row.placementKey) as RunRow;
        return [row.mark, [said(run.sides[0]), said(run.sides[1])] as const];
      }),
  );
}

/** A grid bubble drawn as a closed ring (an octagon, as a CIRCLE is flattened) — no slab of anything. */
function bubble(centre: Point, radius: number): Piece {
  const ring = Array.from({ length: 8 }, (_, index): Point => [centre[0] + radius * Math.cos((index * Math.PI) / 4), centre[1] + radius * Math.sin((index * Math.PI) / 4)]);
  return { ring, layer: "GRID" };
}

describe("I-611: a side reads the plan's own slab reading, and nothing adjoins only where that reading says so", () => {
  test("a beam plan that draws no slab and states none reads no side — its one closed ring a grid bubble is no plate", () => {
    // Red before: the bubble was the widest unplaced ring, both probes stood off its box, and both
    // sides read "nothing adjoins" — the beam billed at its full depth, COMPLETE.
    expect(sidesByMark([...COLUMNS, ...AB1, bubble([SPACING / 2, -3 * SPACING], 300)])).toEqual({ B1: [null, null] });
  });

  test("a plan that draws its slab plate but states no thickness reads no side either — off the plate is not a reading nobody stated", () => {
    // Red before: the probe below the perimeter beam stood off the plate and read "0", the one above it nothing.
    expect(sidesByMark([...COLUMNS, ...AB1, { ring: box([0, 0], [SPACING, SPACING]), layer: "SLAB" }])).toEqual({ B1: [null, null] });
  });

  test("a stated slab over its plate: the perimeter beam reads nothing below it and the stated thickness above — F-RCC6's 0/150", () => {
    expect(sidesByMark([...COLUMNS, ...AB1, STATED, { ring: box([0, 0], [SPACING, SPACING]), layer: "SLAB" }])).toEqual({ B1: ["0 DERIVED", "150 TRANSCRIBED"] });
  });

  test("SB-R4's shape: a second slab outline beside the plate is not 'nothing' — the side standing on it is unread", () => {
    const plate = { ring: box([0, 0], [SPACING, SPACING]), layer: "SLAB" };
    // The machine-room roof: narrower than the stair roof, drawn beside it, its own thickness captioned in words the reader does not take for a slab statement.
    const beside = { ring: box([SPACING, 0], [2 * SPACING - FACE, SPACING - FACE]), layer: "SLAB" };
    // Red before: BC1 stood off the one plate on both sides and read [0, 0].
    expect(sidesByMark([...COLUMNS, ...AB1, ...BC1, STATED, plate, beside, { said: "MRR 150 THK", at: [1.5 * SPACING, SPACING / 2] }])).toEqual({
      B1: ["0 DERIVED", "150 TRANSCRIBED"],
      B2: ["0 DERIVED", null],
    });
  });

  test("the plate is tested as drawn, not by its box: a probe in the corner an L-shaped plate does not cover stands off it", () => {
    // The plate runs A–C along grid 1 and turns up past grid 2 only over bay B–C: AB2's upper side is off it.
    const plate = {
      ring: [[0, 0], [2 * SPACING, 0], [2 * SPACING, 2 * SPACING], [SPACING, 2 * SPACING], [SPACING, SPACING], [0, SPACING]] as Point[],
      layer: "SLAB",
    };
    // Red before: the probe above AB2 stood inside the plate's box and read the stated 150 — a soffit that is not there.
    expect(sidesByMark([...COLUMNS, ...AB2, STATED, plate])).toEqual({ B3: ["150 TRANSCRIBED", "0 DERIVED"] });
  });
});

/** What the stage placed and could not name over one artifact: each beam as `mark@(x,y)`, and each unnamed pair by its axis. */
function namedAndUnnamed(pieces: readonly Piece[], frozen: readonly string[] = []): { readonly named: string[]; readonly unnamed: string[] } {
  const graph = drawn(pieces, frozen);
  const evidence: PlacementEvidence = { graph, views: [VIEW], assignments: new Map(graph.entities.map((entity) => [entity.key, VIEW.viewKey])), grid: GRID, shares: SHARES, families: FAMILIES };
  const placed = detectPlacements(evidence);
  return {
    named: placed.placements
      .filter((row) => row.elementType === "beam")
      .map((row) => `${row.mark}@(${row.x},${row.y})`)
      .sort(),
    unnamed: (placed.unnamed ?? []).map((pair) => `(${pair.from.join(",")})-(${pair.to.join(",")}) ${pair.width} ${pair.gridLetter ?? ""}${pair.gridNumeral ?? ""}`).sort(),
  };
}

/**
 * An edge beam drawn as three spans end to end along grid 1 — 200 to 1600, 1600 to 3200, 3200 to 4600
 * — and lettered once, `B1`, beside the first. The spans meet where nothing else is drawn, as EB1a–c
 * meet at the cantilevers that carry them on F-RCC6-BNBC's S-14.
 */
const SPAN_1 = beam([FACE, 0], [1600, 0]);
const SPAN_2 = beam([1600, 0], [3200, 0]);
const SPAN_3 = beam([3200, 0], [2 * SPACING - FACE, 0]);
const LETTERED_ONCE: Piece = { said: "B1", at: [900, -2 * WIDTH] };

describe("I-612: one mark names the end-to-end spans of its stated width that no other mark letters", () => {
  test("lettered once beside its first span, the beam's three spans are all named by that mark — nothing is left unnamed", () => {
    // Red before: only the first span was named, the other two were drawn and read by nobody.
    expect(namedAndUnnamed([...COLUMNS, ...SPAN_1, ...SPAN_2, ...SPAN_3, LETTERED_ONCE])).toEqual({ named: ["B1@(2400,0)", "B1@(3900,0)", "B1@(900,0)"], unnamed: [] });
  });

  test("a span the plan letters itself is its own: the chain stops at it, and the span two marks reach is named by neither", () => {
    const own: Piece = { said: "B2", at: [3900, -2 * WIDTH] };
    expect(namedAndUnnamed([...COLUMNS, ...SPAN_1, ...SPAN_2, ...SPAN_3, LETTERED_ONCE, own]), "B1 reaches the middle span from one end, B2 from the other").toEqual({
      named: ["B1@(900,0)", "B2@(3900,0)"],
      unnamed: ["(1600.0,0.0)-(3200.0,0.0) 150.0 B1"],
    });
  });

  test("in line across a gap is not end to end: the spans past the gap are not the lettered beam's, and are disclosed", () => {
    const apart = beam([1700, 0], [3200, 0]);
    expect(namedAndUnnamed([...COLUMNS, ...SPAN_1, ...apart, ...SPAN_3, LETTERED_ONCE])).toEqual({
      named: ["B1@(900,0)"],
      unnamed: ["(1700.0,0.0)-(3200.0,0.0) 150.0 B1", "(3200.0,0.0)-(4600.0,0.0) 150.0 C1"],
    });
  });

  test("a span drawn at a width its mark's schedule does not state is not that mark's beam", () => {
    const wider = beam([1600, 0], [3200, 0], 250);
    // 250 is the schedule's width of no family here, so it is no framed member at all and is not disclosed either.
    expect(namedAndUnnamed([...COLUMNS, ...SPAN_1, ...wider, LETTERED_ONCE])).toEqual({ named: ["B1@(900,0)"], unnamed: [] });
  });
});

describe("I-613: every pair drawn as a framed member that nothing names is enumerated", () => {
  test("an unlettered beam is disclosed by where it is drawn; a pair on a layer the drawing freezes is on no sheet, and is not", () => {
    const shown = beam([FACE, SPACING], [SPACING - FACE, SPACING]);
    const superseded = beam([SPACING + FACE, SPACING], [2 * SPACING - FACE, SPACING], WIDTH, "OLD-SCHEME");
    expect(namedAndUnnamed([...COLUMNS, ...shown, ...superseded], ["OLD-SCHEME"])).toEqual({ named: [], unnamed: ["(200.0,2400.0)-(2200.0,2400.0) 150.0 A2"] });
    // Red before for the superseded pair: with the layer shown it is a drawn beam like the other.
    expect(namedAndUnnamed([...COLUMNS, ...shown, ...superseded]).unnamed).toEqual(["(200.0,2400.0)-(2200.0,2400.0) 150.0 A2", "(2600.0,2400.0)-(4600.0,2400.0) 150.0 B2"]);
  });
});

/** How long a real drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;
let bnbcRead: Promise<StagesRead> | undefined;
let rcc6Read: Promise<StagesRead> | undefined;
const bnbc = (): Promise<StagesRead> => (bnbcRead ??= stagesOver(BNBC_DXF));
const rcc6 = (): Promise<StagesRead> => (rcc6Read ??= stagesOver(RCC6_DXF));

/** The layouts of F-RCC6-BNBC Rev C, by the address a placement names them by. */
const STAIR_ROOF = "v:LAYOUT_PLAN:DXF_HANDLE:2157";
const TYPICAL = "v:LAYOUT_PLAN:DXF_HANDLE:F31";
const FIRST_FLOOR = "v:LAYOUT_PLAN:DXF_HANDLE:2116";
const ROOF = "v:LAYOUT_PLAN:DXF_HANDLE:10C1";
const GRADE_BEAMS = "v:LAYOUT_PLAN:DXF_HANDLE:2073";
/** F-RCC6's foundation plan, whose tie beams it letters on the perimeter spans only. */
const RCC6_TIE_BEAMS = "v:LAYOUT_PLAN:DXF_HANDLE:241";

describe("I-611 on the two drawings", () => {
  test("F-RCC6-BNBC: S-15's SB-R4 reads no side — the machine-room roof adjoins its north side — and no beam layout states a slab, so no beam side is read", async () => {
    const read = await bnbc();
    const runs = new Map((read.placed.runs ?? []).map((run) => [run.placementKey, run]));
    const sbr4 = read.placed.placements.find((row) => row.viewKey === STAIR_ROOF && row.mark === "SBR4");
    expect(sbr4, "S-15 places SB-R4").toBeDefined();
    expect(runs.get(sbr4?.placementKey ?? "")?.sides, "both sides unread: the line is PARTIAL, naming the slab thickness").toEqual([null, null]);
    const beams = read.placed.placements.filter((row) => row.elementType === "beam");
    expect(beams.filter((row) => runs.get(row.placementKey)?.sides.some((side) => side !== null)).map((row) => `${row.viewKey} ${row.mark}`), "no beam side is read on a plan that states no slab").toEqual([]);
  }, BUDGET_MS);

  test("F-RCC6-BNBC: EB1 and 1EB1 name their three square spans each by chain — EB1a–c on S-14, 1EB1a–c on S-13 — by the one mark", async () => {
    const read = await bnbc();
    const spans = (view: string, mark: string): string[] =>
      read.placed.placements
        .filter((row) => row.viewKey === view && row.mark === mark)
        .map((row) => `${row.outlineKey} ${row.markKey}`)
        .sort();
    expect(spans(TYPICAL, "EB1"), "EB1a (EE8, beside its label), EB1b (EEA) and EB1c (EEC), all by the label F2D").toEqual([
      "DXF_HANDLE:EE8 DXF_HANDLE:F2D",
      "DXF_HANDLE:EEA DXF_HANDLE:F2D",
      "DXF_HANDLE:EEC DXF_HANDLE:F2D",
    ]);
    expect(spans(FIRST_FLOOR, "1EB1").length, "and S-13's 1EB1 the same three").toBe(3);
  }, BUDGET_MS);

  test("F-RCC6-BNBC: the pairs each plan draws as a beam and nobody names, enumerated per plan — the slanted spans, TG1", async () => {
    const read = await bnbc();
    const byPlan: Record<string, string[]> = {};
    for (const pair of read.placed.unnamed ?? []) (byPlan[pair.viewKey] ??= []).push(pair.edgeKeys[0]);
    // TEST_AMENDED (GB-READ, s-schedules I-673): S-08 letters every grade-beam span and the marks
    // name them now; what it leaves is its four slanted spans — GB4 across the chamfer and GB5 to the
    // ramp — which wait, like the beam layouts', for a run read along its own direction (FRM4-E).
    expect(Object.fromEntries(Object.entries(byPlan).map(([view, keys]) => [view, keys.length])), "S-08's slanted grade beams, and each beam layout's slanted spans").toEqual({
      [GRADE_BEAMS]: 4,
      [FIRST_FLOOR]: 6,
      [TYPICAL]: 3,
      [ROOF]: 2,
    });
    // S-14: EB1d and EB2's two 45° spans wait for their runs to be read along their own direction (FRM4-E).
    expect(byPlan[TYPICAL], "EB1d (EEE), EB2a (EF0), EB2b (EF2)").toEqual(["DXF_HANDLE:EEE", "DXF_HANDLE:EF0", "DXF_HANDLE:EF2"]);
    // S-13 adds TG1 — its 400 pair lettered on itself at 0° and turned across it (I-460) — and PB4/PB5.
    expect(read.placed.unnamed?.find((pair) => pair.viewKey === FIRST_FLOOR && pair.width === "400.0")?.edgeKeys, "TG1").toEqual(["DXF_HANDLE:D38", "DXF_HANDLE:D39"]);
  }, BUDGET_MS);

  test("F-RCC6: the tie-beam plan letters its perimeter spans only, and the chain names the 28 interior spans drawn end to end with them — 60, the golden's own count", async () => {
    const read = await rcc6();
    const ties = read.placed.placements.filter((row) => row.viewKey === RCC6_TIE_BEAMS && row.elementType === "tie_beam");
    // Red before: 32 — the interior spans were drawn and read by nobody, the tie beams billed at half.
    expect(ties.length, "30 TB1 and 30 TB2 in the golden (fixtures/rcc6/inputs.json)").toBe(60);
    const lettered = new Set(read.graph.entities.filter((entity) => entity.text === "TB1" || entity.text === "TB2").map((entity) => entity.key));
    expect(ties.every((row) => lettered.has(row.markKey)), "each named by a mark the plan draws").toBe(true);
    expect(read.placed.unnamed ?? [], "and nothing the plan draws as a beam is left unnamed").toEqual([]);
  }, BUDGET_MS);

  test("F-RCC6: its 44 perimeter runs still read 0 on the outer side and 150 on the inner — the COMPLETE beam lines stand", async () => {
    const read = await rcc6();
    const perimeter = (read.placed.runs ?? []).filter((run) => {
      const values = run.sides.map((side) => side?.value ?? null);
      return values.includes("0") && values.includes("150");
    });
    expect(perimeter.length).toBe(44);
  }, BUDGET_MS);
});

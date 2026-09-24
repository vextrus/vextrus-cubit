// @vitest-environment node
/**
 * GB-READ at the stage that reads it (s-schedules I-673, I-674): a grade beam is a tie beam,
 * and a tie beam stops at the face of the cap it frames into — the cap the pile-cap layout places,
 * which the grade-beam layout redraws without a mark.
 *
 * Three plans of one drawing, each drawn at its own place in model space and read off its own grid:
 * a column layout lettering its columns, a pile-cap layout lettering its caps, and a grade-beam layout
 * redrawing the caps as bare rings and lettering its beams `GB1`. Before, a grade beam named no class
 * and was left unnamed; named, it would have run on to the columns a storey up — over by the caps'
 * reach past the columns at both ends (L-QTY-06).
 *
 * PURE, in the unit lane: the shipped detector over a hand-built v3 artifact (every geometry drawn
 * HERE, B-19).
 */
import { describe, expect, test } from "vitest";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph/schema";
import type { DetectedGrid, GridAxisRow } from "@/modules/takeoff/partition/grid/detect";
import { detectPlacements } from "@/modules/takeoff/partition/placement/detect";
import type { FamilyNamed, PlacementEvidence } from "@/modules/takeoff/partition/placement/rows";
import type { PlacementShares } from "@/modules/takeoff/partition/placement/shares";
import type { PartitionedView } from "@/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";
import { writtenAtV3 } from "../../../cad/support/entitygraph-versions";

/** The grid every plan is drawn on: five letters along x, one numeral. */
const SPACING = 2400;
const SHARES: PlacementShares = { containmentMerge: "0.08", nearAnchor: "0.9", footprintMin: "0.6", footprintMax: "2.5" };
const COLOUR = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" as const };

/** A column 300 square; a cap 1200 square about it; a grade beam 150 wide. */
const COLUMN_HALF = 150;
const CAP_HALF = 600;
const WIDTH = 150;

type Point = readonly [number, number];
type Plan = { readonly key: string; readonly caption: string; readonly origin: Point };
type Piece = { readonly plan: Plan } & ({ readonly said: string; readonly at: Point } | { readonly ring: readonly Point[]; readonly layer: string } | { readonly line: readonly [Point, Point] });

const COLUMNS: Plan = { key: "DXF_HANDLE:A1", caption: "COLUMN LAYOUT PLAN", origin: [0, 0] };
const CAPS: Plan = { key: "DXF_HANDLE:A2", caption: "PILE CAP LAYOUT PLAN", origin: [0, 20000] };
const GRADE: Plan = { key: "DXF_HANDLE:A3", caption: "GRADE BEAM LAYOUT", origin: [0, 40000] };
const PLANS = [COLUMNS, CAPS, GRADE];

const viewOf = (plan: Plan): PartitionedView => ({ viewKey: `${VIEW_TYPE.LAYOUT_PLAN}:${plan.key}`, type: VIEW_TYPE.LAYOUT_PLAN, reason: null, caption: plan.caption, anchorKey: plan.key });
const at = (plan: Plan, point: Point): Point => [plan.origin[0] + point[0], plan.origin[1] + point[1]];
const box = (plan: Plan, centre: Point, halfX: number, halfY: number): Point[] => [
  at(plan, [centre[0] - halfX, centre[1] - halfY]),
  at(plan, [centre[0] + halfX, centre[1] - halfY]),
  at(plan, [centre[0] + halfX, centre[1] + halfY]),
  at(plan, [centre[0] - halfX, centre[1] + halfY]),
];

/** A grade beam along grid 1 from one letter to the next, drawn grid to grid as a grade-beam layout draws it, lettered above. */
function gradeBeam(fromX: number, toX: number, mark: string): Piece[] {
  return [
    { plan: GRADE, line: [at(GRADE, [fromX, -WIDTH / 2]), at(GRADE, [toX, -WIDTH / 2])] },
    { plan: GRADE, line: [at(GRADE, [fromX, WIDTH / 2]), at(GRADE, [toX, WIDTH / 2])] },
    { plan: GRADE, said: mark, at: at(GRADE, [(fromX + toX) / 2, 2 * WIDTH]) },
  ];
}

/** Columns lettered `C1` at A1, B1, C1 and D1 on the column layout. */
const COLUMN_PIECES: Piece[] = [0, 1, 2, 3].flatMap((bay): Piece[] => [
  { plan: COLUMNS, ring: box(COLUMNS, [bay * SPACING, 0], COLUMN_HALF, COLUMN_HALF), layer: "COLUMN" },
  { plan: COLUMNS, said: "C1", at: at(COLUMNS, [bay * SPACING, 0]) },
]);

/** A cap about each of the columns at A1 and B1: lettered on the cap layout, a bare ring on the grade-beam layout. */
const CAP_PIECES: Piece[] = [0, 1].flatMap((bay): Piece[] => [
  { plan: CAPS, ring: box(CAPS, [bay * SPACING, 0], CAP_HALF, CAP_HALF), layer: "FDN" },
  { plan: CAPS, said: "PC1", at: at(CAPS, [bay * SPACING, 0]) },
  { plan: GRADE, ring: box(GRADE, [bay * SPACING, 0], CAP_HALF, CAP_HALF), layer: "FDN" },
]);

/**
 * PC5's shape: one cap under two columns, centred midway between C and D and reaching 200 past each —
 * so its own grid reference is C/1 (the lower label of the tie), and an end at C/1 or D/1 stands
 * inside it. The margin is the cap's own reach past the column line, drawn apart from the column's
 * 150 so the two faces tell apart.
 */
const WIDE_MARGIN = 200;
const WIDE_HALF_X = SPACING / 2 + WIDE_MARGIN;
const WIDE_CAP: Piece[] = [
  { plan: CAPS, ring: box(CAPS, [2.5 * SPACING, 0], WIDE_HALF_X, CAP_HALF), layer: "FDN" },
  { plan: CAPS, said: "PC5", at: at(CAPS, [2.5 * SPACING, 0]) },
  { plan: GRADE, ring: box(GRADE, [2.5 * SPACING, 0], WIDE_HALF_X, CAP_HALF), layer: "FDN" },
];

const FAMILIES: readonly FamilyNamed[] = [
  { family: "C1", variants: [{ sectionWidth: 2 * COLUMN_HALF, sectionDepth: 2 * COLUMN_HALF }] },
  { family: "PC1", variants: [{ sectionWidth: 2 * CAP_HALF, sectionDepth: 2 * CAP_HALF }] },
  { family: "PC5", variants: [{ sectionWidth: 2 * WIDE_HALF_X, sectionDepth: 2 * CAP_HALF }] },
  { family: "GB1", variants: [{ sectionWidth: WIDTH, sectionDepth: 450 }] },
];

/** Each plan's grid: A–E along x, 1 across it, at the plan's own origin. */
const gridOf = (plans: readonly Plan[]): DetectedGrid => ({
  views: plans.length,
  axes: plans.flatMap((plan, index): GridAxisRow[] =>
    [
      ["letter", "A", "x", 0],
      ["letter", "B", "x", SPACING],
      ["letter", "C", "x", 2 * SPACING],
      ["letter", "D", "x", 3 * SPACING],
      ["letter", "E", "x", 4 * SPACING],
      ["numeral", "1", "y", 0],
    ].map(([family, label, along, position], axisIndex) => ({
      viewKey: viewOf(plan).viewKey,
      family: family as "letter" | "numeral",
      label: label as string,
      axis: along as "x" | "y",
      position: (along === "x" ? plan.origin[0] : plan.origin[1]) + (position as number),
      bubbleKey: `DXF_HANDLE:F${String(index)}${String(axisIndex)}0`,
      labelKey: `DXF_HANDLE:F${String(index)}${String(axisIndex)}1`,
      minSpacing: SPACING,
    })),
  ),
  deferrals: [],
});

/** The drawing, parsed by the mirror, and each of its entities assigned to the plan it was drawn on. */
function evidenceOf(pieces: readonly Piece[], plans: readonly Plan[] = PLANS, families: readonly FamilyNamed[] = FAMILIES): PlacementEvidence {
  const planOf = new Map<string, Plan>();
  const entities = pieces.map((piece, index) => {
    const key = `DXF_HANDLE:${(index + 0x100).toString(16).toUpperCase()}`;
    planOf.set(key, piece.plan);
    if ("said" in piece) return { key, type: "TEXT", space: "Model", layer: "TEXT", colour: COLOUR, text: piece.said, height: 150, points: [[piece.at[0], piece.at[1]]], rotation: 0 };
    if ("line" in piece) return { key, type: "LINE", space: "Model", layer: "BEAM", colour: COLOUR, points: piece.line.map((point) => [point[0], point[1]]) };
    return { key, type: "LWPOLYLINE", space: "Model", layer: piece.layer, colour: COLOUR, closed: true, points: piece.ring.map((point) => [point[0], point[1]]) };
  });
  const layers = [...new Set(entities.map((entity) => entity.layer))].map((name) => ({ name, on: true, frozen: false, plot: true }));
  const graph: EntityGraph = entityGraphSchema.parse(
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
  const assignments = new Map(graph.entities.map((entity) => [entity.key, viewOf(planOf.get(entity.key) as Plan).viewKey]));
  return { graph, views: plans.map(viewOf), assignments, grid: gridOf(plans), shares: SHARES, families };
}

/** Each grade beam the stage placed, as `mark class clear`, in the order of its run along grid 1. */
function gradeBeamsOf(pieces: readonly Piece[]): string[] {
  const placed = detectPlacements(evidenceOf(pieces));
  const runs = new Map((placed.runs ?? []).map((run) => [run.placementKey, run]));
  return placed.placements
    .filter((row) => row.viewKey === `v:${viewOf(GRADE).viewKey}`)
    .sort((left, right) => left.x - right.x)
    .map((row) => `${row.mark} ${row.elementType} ${runs.get(row.placementKey)?.clear?.value ?? "unread"}`);
}

describe("I-673: a grade-beam mark names a tie beam", () => {
  test("the grade-beam layout's lettered span is placed as a tie beam, and nothing it draws is left unnamed", () => {
    const pieces = [...COLUMN_PIECES, ...CAP_PIECES, ...gradeBeam(0, SPACING, "GB1")];
    // Red before: `GB` named no class, so the span was placed as nothing and disclosed as unnamed.
    expect(gradeBeamsOf(pieces).map((said) => said.split(" ").slice(0, 2).join(" "))).toEqual(["GB1 tie_beam"]);
    expect(detectPlacements(evidenceOf(pieces)).unnamed ?? []).toEqual([]);
  });
});

describe("I-674: a tie beam stops at the face of the cap it frames into", () => {
  test("cut at the faces of the caps the pile-cap layout places — never run on to the columns a storey up", () => {
    const pieces = [...COLUMN_PIECES, ...CAP_PIECES, ...gradeBeam(0, SPACING, "GB1")];
    // 2400 grid to grid, less the caps' 600 at each end. Red before: 2100.0, cut at the columns' 150 — 900 over.
    expect(gradeBeamsOf(pieces)).toEqual([`GB1 tie_beam ${String(SPACING - 2 * CAP_HALF)}.0`]);
  });

  test("a cap wider than a bay carries the end that stands inside it, though the end's nearest grid is not the cap's own", () => {
    const pieces = [...COLUMN_PIECES, ...CAP_PIECES, ...WIDE_CAP, ...gradeBeam(SPACING, 2 * SPACING, "GB1")];
    // B → C: PC1's 600 at B, and PC5 — centred midway between C and D, reaching 200 back past C — at C.
    expect(gradeBeamsOf(pieces)).toEqual([`GB1 tie_beam ${String(SPACING - CAP_HALF - WIDE_MARGIN)}.0`]);
    const pastD = [...COLUMN_PIECES, ...CAP_PIECES, ...WIDE_CAP, ...gradeBeam(3 * SPACING, 4 * SPACING, "GB1")];
    // D → E, E carrying nothing: PC5 reaches 200 past D, and the end at D stands inside it though its
    // nearest grid is D/1 and the cap's own is C/1. Red before: that end met only D's column, 150 — 50 over.
    expect(gradeBeamsOf(pastD)).toEqual([`GB1 tie_beam ${String(SPACING - WIDE_MARGIN)}.0`]);
  });

  test("a floor beam is not carried by a cap of another plan — a cap carries only what stands on the foundation", () => {
    const beams: Plan = { key: "DXF_HANDLE:A4", caption: "1ST FLOOR BEAM LAYOUT", origin: [0, 60000] };
    // The same geometry on a floor-beam plan, lettered B1: cut at the columns, as it always was.
    const floor: Piece[] = [
      { plan: beams, line: [at(beams, [0, -WIDTH / 2]), at(beams, [SPACING, -WIDTH / 2])] },
      { plan: beams, line: [at(beams, [0, WIDTH / 2]), at(beams, [SPACING, WIDTH / 2])] },
      { plan: beams, said: "B1", at: at(beams, [SPACING / 2, 2 * WIDTH]) },
    ];
    const placed = detectPlacements(evidenceOf([...COLUMN_PIECES, ...CAP_PIECES, ...floor], [...PLANS, beams], [...FAMILIES, { family: "B1", variants: [{ sectionWidth: WIDTH, sectionDepth: 450 }] }]));
    const b1 = placed.placements.find((row) => row.mark === "B1");
    expect(b1?.elementType).toBe("beam");
    expect((placed.runs ?? []).find((run) => run.placementKey === b1?.placementKey)?.clear?.value, "2400 less the columns' 200 at each end").toBe(`${String(SPACING - 2 * COLUMN_HALF)}.0`);
  });
});

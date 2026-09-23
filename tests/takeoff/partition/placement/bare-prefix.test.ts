/**
 * I-321 AT THE STAGE THAT READS IT: a schedule row whose mark is a BARE CLASS PREFIX — `P` — names the
 * family of every member of that class a plan places under a NUMBER — `P1`, `P2`, … — and only where
 * three things the drawing states agree:
 *
 *   · the row is the SOLE family of its class the schedules registered;
 *   · its `NOS` cell states exactly the number of members of that class the plans place — read as
 *     corroboration, never as a count (T-SCHED-NORULES);
 *   · its diameter equals every placed ring, at the scale the drawing's plans and schedules agree on,
 *     to the half-unit the schedule printed it to.
 *
 * Otherwise the numbered members stay untyped and MEMBER_TYPE_UNKNOWN stands (L-QTY-01: never a guess).
 * The number stays the placement's identity; only `memberFamily` is the prefix's to name.
 *
 * PURE, in the unit lane: the shipped detector over one hand-built artifact, drawn at F-RCC6-BNBC's
 * own shape — ⌀500 rings with each pile's number written at its centre, and a column family whose
 * schedule section tells the stage what the drawing was drawn at. A drawing is not a test's input
 * (B-19): every geometry below is drawn HERE. The real drawing is graded in
 * tests/takeoff/partition/schedules/bnbc-pile-schedule.test.ts.
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { DetectedGrid, GridAxisRow } from "@/modules/takeoff/partition/grid/detect";
import { detectPlacements } from "@/modules/takeoff/partition/placement/detect";
import { classOfFamily, classOfPrefix } from "@/modules/takeoff/partition/placement/law";
import type { FamilyNamed, PlacementEvidence, PlacementRow } from "@/modules/takeoff/partition/placement/rows";
import type { PlacementShares } from "@/modules/takeoff/partition/placement/shares";
import type { PartitionedView } from "@/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";

/** The grid every plan below is drawn on, and therefore the distance every share scales by. */
const SPACING = 4000;

/** The bands this file draws to, as the shares an edition states them in (L-MEA-01, handed in). */
const SHARES: PlacementShares = { containmentMerge: "0.08", nearAnchor: "0.9", footprintMin: "0.6", footprintMax: "2.5" };

/** The view every entity below stands in. */
const CAPTION_KEY = "DXF_HANDLE:1";
const VIEW: PartitionedView = { viewKey: `${VIEW_TYPE.LAYOUT_PLAN}:${CAPTION_KEY}`, type: VIEW_TYPE.LAYOUT_PLAN, reason: null, caption: "PILE LAYOUT PLAN", anchorKey: CAPTION_KEY };

const COLOUR = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" as const };

/** The pile's drawn diameter, and the column's drawn side — the schedule states both at these. */
const DIA = 500;
const COLUMN_SIDE = 400;

/** One piece of the drawing: a text where it stands, a square ring, or a round one. */
type Piece =
  | { readonly said: string; readonly at: readonly [number, number] }
  | { readonly square: readonly [number, number]; readonly side: number }
  | { readonly circle: readonly [number, number]; readonly diameter: number };

/** A circle as an extractor flattens one: sixteen chords, starting on the axis, so its box is exact. */
function ring(centre: readonly [number, number], diameter: number): [number, number][] {
  return Array.from({ length: 16 }, (_unused, at) => {
    const angle = (at / 16) * 2 * Math.PI;
    return [centre[0] + (diameter / 2) * Math.cos(angle), centre[1] + (diameter / 2) * Math.sin(angle)] as [number, number];
  });
}

function square(centre: readonly [number, number], side: number): [number, number][] {
  const [x, y] = centre;
  return [
    [x - side / 2, y - side / 2],
    [x + side / 2, y - side / 2],
    [x + side / 2, y + side / 2],
    [x - side / 2, y + side / 2],
  ];
}

function entitiesOf(pieces: readonly Piece[]): EntityGraph["entities"] {
  return pieces.map((piece, index) => {
    const key = `DXF_HANDLE:${(index + 2).toString(16).toUpperCase()}`;
    if ("said" in piece) return { key, type: "TEXT", space: "Model", layer: "PLAN", colour: COLOUR, text: piece.said, height: 200, points: [[piece.at[0], piece.at[1]]] as [number, number][] };
    const points = "circle" in piece ? ring(piece.circle, piece.diameter) : square(piece.square, piece.side);
    return { key, type: "LWPOLYLINE", space: "Model", layer: "PLAN", colour: COLOUR, closed: true, points };
  });
}

const AXES: readonly GridAxisRow[] = [
  { viewKey: VIEW.viewKey, family: "letter", label: "A", axis: "x", position: 0, bubbleKey: "DXF_HANDLE:F01", labelKey: "DXF_HANDLE:F02", minSpacing: SPACING },
  { viewKey: VIEW.viewKey, family: "numeral", label: "1", axis: "y", position: 0, bubbleKey: "DXF_HANDLE:F03", labelKey: "DXF_HANDLE:F04", minSpacing: SPACING },
];
const GRID: DetectedGrid = { views: 1, axes: AXES, deferrals: [] };

/** Two columns whose schedule section states the drawing's scale, and three piles, each numbered at its centre. */
function drawn(diameter = DIA): Piece[] {
  const columns = [0, 1].flatMap((at) => [{ square: [at * SPACING, 0] as const, side: COLUMN_SIDE }, { said: "C1", at: [at * SPACING, 0] as const }]);
  const piles = [0, 1, 2].flatMap((at) => [{ circle: [at * SPACING, -2 * SPACING] as const, diameter }, { said: `P${at + 1}`, at: [at * SPACING, -2 * SPACING] as const }]);
  return [...columns, ...piles];
}

/** The column family: what tells the stage the drawing was drawn at one unit per unit (L-MEA-01). */
const C1: FamilyNamed = { family: "C1", variants: [{ sectionWidth: COLUMN_SIDE, sectionDepth: COLUMN_SIDE }] };

/** The pile schedule's one row, as the registry folds it: the bare prefix, its diameter, its NOS. */
function pileRow(options: { dia?: string | null; placed?: number | null } = {}): FamilyNamed {
  const dia = options.dia === undefined ? String(DIA) : options.dia;
  const placed = options.placed === undefined ? 3 : options.placed;
  return {
    family: "P",
    variants: [{ sectionWidth: null, sectionDepth: null, ...(dia === null ? {} : { dimensions: [{ dimension: "dia", text: dia, value: Number(dia) }] }) }],
    ...(placed === null ? {} : { corroboration: { placed } }),
  };
}

function placed(pieces: readonly Piece[], families: readonly FamilyNamed[]): PlacementRow[] {
  const entities = entitiesOf(pieces);
  const graph: EntityGraph = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-test", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [{ name: "Model", kind: "model", bbox: null, strays_rejected: 0 }],
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: [],
    counters: [],
  };
  const evidence: PlacementEvidence = { graph, views: [VIEW], assignments: new Map(entities.map((entity) => [entity.key, VIEW.viewKey])), grid: GRID, shares: SHARES, families };
  return [...detectPlacements(evidence).placements].sort((left, right) => (left.mark < right.mark ? -1 : left.mark > right.mark ? 1 : left.placementKey < right.placementKey ? -1 : 1));
}

/** The family each pile was given, by its number. */
function pileFamilies(rows: readonly PlacementRow[]): Record<string, string | null> {
  return Object.fromEntries(rows.filter((row) => row.elementType === "pile").map((row) => [row.mark, row.memberFamily]));
}

const UNTYPED = { P1: null, P2: null, P3: null };

describe("I-321: what a bare prefix names", () => {
  test("a bare prefix names a class and never a member; a numbered mark names a member of one", () => {
    expect([classOfPrefix("P"), classOfPrefix("PC"), classOfPrefix("p"), classOfPrefix("S"), classOfPrefix("P1")], "exact, like the map: `S` is nothing, and a number makes a mark, not a prefix").toEqual([
      "pile",
      "pile_cap",
      "pile",
      null,
      null,
    ]);
    expect([classOfFamily("P"), classOfFamily("P7"), classOfFamily("PC3"), classOfFamily("RB1")], "a family is of the class its mark or its prefix names").toEqual(["pile", "pile", "pile_cap", null]);
  });
});

describe("I-321: the bare prefix types the numbered members of its class where the drawing corroborates it", () => {
  test("sole row, NOS equal to the plans' piles, diameter equal to every ring: every pile is typed P and keeps its own number", () => {
    const rows = placed(drawn(), [C1, pileRow()]);
    expect(pileFamilies(rows), "the prefix names the TYPE of each numbered pile").toEqual({ P1: "P", P2: "P", P3: "P" });
    expect(rows.filter((row) => row.elementType === "pile").map((row) => row.mark), "the number stays the placement's identity (L-REG-04)").toEqual(["P1", "P2", "P3"]);
  });

  test("typing the piles moves nothing else about any member", () => {
    const without = placed(drawn(), [C1]);
    const with_ = placed(drawn(), [C1, pileRow()]);
    expect(with_.map((row) => ({ ...row, memberFamily: row.elementType === "pile" ? null : row.memberFamily })), "every key, point and reference is what it was").toEqual(without);
  });

  test("a NOS the plans do not bear out types nothing", () => {
    expect(pileFamilies(placed(drawn(), [C1, pileRow({ placed: 4 })])), "the schedule says four, the plans place three: which three the row describes is a guess").toEqual(UNTYPED);
    expect(pileFamilies(placed(drawn(), [C1, pileRow({ placed: null })])), "a row stating no NOS corroborates nothing").toEqual(UNTYPED);
  });

  test("a diameter the rings do not bear out types nothing, and a row stating none types nothing", () => {
    expect(pileFamilies(placed(drawn(600), [C1, pileRow()])), "a ⌀600 ring is not the ⌀500 member the row describes").toEqual(UNTYPED);
    expect(pileFamilies(placed(drawn(), [C1, pileRow({ dia: null })])), "a bare prefix types only a member whose size the schedule states and the plan draws").toEqual(UNTYPED);
    expect(pileFamilies(placed(drawn(500.3), [C1, pileRow()])), "a ring drawn inside the half-unit the schedule printed `500` to IS a ⌀500 ring").toEqual({ P1: "P", P2: "P", P3: "P" });
  });

  test("a second family of the class, bare or numbered, and the prefix no longer says which type a pile is", () => {
    const numbered = pileFamilies(placed(drawn(), [C1, pileRow(), { family: "P2", variants: [] }]));
    expect(numbered, "P2's own family still names P2; the other numbers stay untyped rather than guessed").toEqual({ P1: null, P2: "P2", P3: null });
    expect(pileFamilies(placed(drawn(), [C1, pileRow(), pileRow()])), "two schedules both writing `P` state two readings of one type").toEqual(UNTYPED);
  });

  test("a drawing whose schedules state no section states no scale, so no ring can be judged against a diameter", () => {
    expect(pileFamilies(placed(drawn(), [pileRow()])), "no stated section, no drawn scale (L-MEA-01): the corroboration cannot be made, so nothing is typed").toEqual(UNTYPED);
  });
});

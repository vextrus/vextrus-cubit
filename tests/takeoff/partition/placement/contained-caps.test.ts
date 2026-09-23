/**
 * I-333 AT THE STAGE THAT READS IT: a plan that draws TWO populations — a pile cap's outline and,
 * inside it, the circles of the piles it stands on — places the member its mark NAMES, and the plan
 * the member's ring encloses is carried beside it.
 *
 *   · A mark standing inside closed rings names the innermost of them whose size agrees with the
 *     section its own schedule states, at the drawing's scale — and that ring alone.
 *   · A ring holding no mark that lies inside a ring a mark so names belongs to no mark.
 *   · A mark standing in no ring its schedule agrees with — a column mark inside a slab's ring — and
 *     a mark whose schedule states no section at all anchor by nearness, exactly as before.
 *   · The ring's own plan: a rectangle by its own sides (turned or not), a polygon by its shoelace,
 *     never a bounding box — in the unit the header states, or the one the drawing's notes declare
 *     where the header is unitless and the drawn scale bears the declaration out (I-302).
 *
 * PURE, in the unit lane: the shipped detector over hand-built artifacts drawn at F-RCC6-BNBC's own
 * shape (S-06). A drawing is not a test's input (B-19): every geometry below is drawn HERE. The real
 * drawing is graded in tests/takeoff/partition/placement/bnbc-pile-caps.test.ts.
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { DetectedGrid, GridAxisRow } from "@/modules/takeoff/partition/grid/detect";
import { detectPlacements } from "@/modules/takeoff/partition/placement/detect";
import type { DetectedPlacements, FamilyNamed, PlacementEvidence, PlacementRow } from "@/modules/takeoff/partition/placement/rows";
import type { PlacementShares } from "@/modules/takeoff/partition/placement/shares";
import type { PartitionedView } from "@/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";

/** The grid every plan below is drawn on, and therefore the distance every share scales by. */
const SPACING = 4000;

/** The bands this file draws to, as the shares an edition states them in (L-MEA-01, handed in). */
const SHARES: PlacementShares = { containmentMerge: "0.08", nearAnchor: "0.9", footprintMin: "0.6", footprintMax: "2.5" };

const CAPTION_KEY = "DXF_HANDLE:1";
const VIEW: PartitionedView = { viewKey: `${VIEW_TYPE.LAYOUT_PLAN}:${CAPTION_KEY}`, type: VIEW_TYPE.LAYOUT_PLAN, reason: null, caption: "PILE CAP LAYOUT", anchorKey: CAPTION_KEY };
const COLOUR = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" as const };

/** What the schedules state: a cap 2000 square, a four-pile cap 2600 square, a column 400 square. */
const CAP = 2000;
const BIG_CAP = 2600;
const PILE = 500;
const COLUMN = 400;

type Point = readonly [number, number];

/** One piece of the drawing: a text where it stands, or a closed ring through the given points. */
type Piece = { readonly said: string; readonly at: Point } | { readonly ring: readonly Point[] };

function square(centre: Point, side: number): Point[] {
  const [x, y] = centre;
  return [
    [x - side / 2, y - side / 2],
    [x + side / 2, y - side / 2],
    [x + side / 2, y + side / 2],
    [x - side / 2, y + side / 2],
  ];
}

/** A circle as an extractor flattens one: sixteen chords, starting on the axis, so its box is exact. */
function circle(centre: Point, diameter: number): Point[] {
  return Array.from({ length: 16 }, (_unused, at) => {
    const angle = (at / 16) * 2 * Math.PI;
    return [centre[0] + (diameter / 2) * Math.cos(angle), centre[1] + (diameter / 2) * Math.sin(angle)] as const;
  });
}

/** A rectangle turned 45° about its centre — S-06's `5FB`, whose box is not its plan. */
function turned(centre: Point, long: number, short: number): Point[] {
  const c = Math.SQRT1_2;
  return [
    [-long / 2, -short / 2],
    [long / 2, -short / 2],
    [long / 2, short / 2],
    [-long / 2, short / 2],
  ].map(([x, y]) => [centre[0] + c * ((x as number) - (y as number)), centre[1] + c * ((x as number) + (y as number))] as const);
}

/** A 2100 × 1750 ring with two corners chamfered 750 × 500 — S-06's PC2 shape: shoelace 3,300,000. */
function chamfered(centre: Point): Point[] {
  const [x, y] = centre;
  return [
    [x - 1050, y - 875],
    [x + 1050, y - 875],
    [x + 1050, y + 375],
    [x + 300, y + 875],
    [x - 300, y + 875],
    [x - 1050, y + 375],
  ];
}

/** A cap of `side` with four piles at its quarter points, and (optionally) one at its centre. */
function capWithPiles(centre: Point, side: number, options: { centrePile?: boolean } = {}): Piece[] {
  const offset = side / 4;
  const piles = [
    [centre[0] - offset, centre[1] - offset],
    [centre[0] + offset, centre[1] - offset],
    [centre[0] + offset, centre[1] + offset],
    [centre[0] - offset, centre[1] + offset],
    ...(options.centrePile === true ? [centre] : []),
  ] as Point[];
  return [{ ring: square(centre, side) }, ...piles.map((at) => ({ ring: circle(at, PILE) }))];
}

function entitiesOf(pieces: readonly Piece[]): EntityGraph["entities"] {
  return pieces.map((piece, index) => {
    const key = `DXF_HANDLE:${(index + 2).toString(16).toUpperCase()}`;
    if ("said" in piece) return { key, type: "TEXT", space: "Model", layer: "PLAN", colour: COLOUR, text: piece.said, height: 200, points: [[piece.at[0], piece.at[1]]] as [number, number][] };
    return { key, type: "LWPOLYLINE", space: "Model", layer: "PLAN", colour: COLOUR, closed: true, points: piece.ring.map((point) => [point[0], point[1]] as [number, number]) };
  });
}

const AXES: readonly GridAxisRow[] = [
  { viewKey: VIEW.viewKey, family: "letter", label: "A", axis: "x", position: 0, bubbleKey: "DXF_HANDLE:F01", labelKey: "DXF_HANDLE:F02", minSpacing: SPACING },
  { viewKey: VIEW.viewKey, family: "numeral", label: "1", axis: "y", position: 0, bubbleKey: "DXF_HANDLE:F03", labelKey: "DXF_HANDLE:F04", minSpacing: SPACING },
];
const GRID: DetectedGrid = { views: 1, axes: AXES, deferrals: [] };

/** The families as the registry folds them: what a member IS, at the size its schedule states. */
const family = (name: string, width: number, depth = width): FamilyNamed => ({ family: name, variants: [{ sectionWidth: width, sectionDepth: depth }] });
const FAMILIES: readonly FamilyNamed[] = [family("PC1", CAP), family("PC4", BIG_CAP), family("PC2", 2100, 1750), family("C1", COLUMN)];

/** Two columns stated at their schedule's size: what tells the stage the drawing's scale. */
const COLUMNS: readonly Piece[] = [0, 1].flatMap((at) => [
  { ring: square([at * SPACING, 3 * SPACING], COLUMN) },
  { said: "C1", at: [at * SPACING + 350, 3 * SPACING + 350] as const },
]);

function detected(pieces: readonly Piece[], options: { families?: readonly FamilyNamed[]; unit?: "mm" | "unitless"; declared?: boolean } = {}): DetectedPlacements {
  const entities = entitiesOf(pieces);
  const unitless = options.unit === "unitless";
  const graph: EntityGraph = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-test", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: unitless ? { code: 0, unit: "unitless", unmapped: false } : { code: 4, unit: "mm", unmapped: false },
    layouts: [{ name: "Model", kind: "model", bbox: null, strays_rejected: 0 }],
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: [],
    counters: [],
  };
  const evidence: PlacementEvidence = {
    graph,
    views: [VIEW],
    assignments: new Map(entities.map((entity) => [entity.key, VIEW.viewKey])),
    grid: GRID,
    shares: SHARES,
    families: options.families ?? FAMILIES,
    ...(options.declared === true ? { declaredUnit: { unit: "mm" as const, sourceKey: "DXF_HANDLE:NOTES" } } : {}),
  };
  return detectPlacements(evidence);
}

/** The key of the entity at a piece's index — the artifact order `entitiesOf` minted it in. */
const keyAt = (index: number): string => `DXF_HANDLE:${(index + 2).toString(16).toUpperCase()}`;

const ofMark = (rows: readonly PlacementRow[], mark: string): PlacementRow[] => rows.filter((row) => row.mark === mark);

describe("I-333: a mark standing inside rings names the innermost one its schedule agrees with", () => {
  test("a cap drawn over its piles is ONE cap, placed by its outline — never one per pile circle", () => {
    const caps = [0, 1, 2].flatMap((at) => [...capWithPiles([at * SPACING, 0], CAP), { said: "PC1", at: [at * SPACING, 0] as const }]);
    const read = detected(caps);
    const placed = ofMark(read.placements, "PC1");
    expect(placed.length, "three caps, three members — the twelve circles are what they stand on").toBe(3);
    expect(placed.map((row) => row.outlineKey), "each placed by its OUTLINE, the first ring of its group").toEqual([0, 6, 12].map(keyAt));
    expect(read.scale, "the drawing reads at its own scale: the circles answer for no cap").toBe(1);
  });

  test("a mark written over its centre pile names the cap, not the pile it happens to stand on (PC4, PC5)", () => {
    const cap = [...capWithPiles([0, 0], BIG_CAP, { centrePile: true }), { said: "PC4", at: [0, 0] as const }];
    const placed = ofMark(detected(cap).placements, "PC4");
    expect(placed.map((row) => row.outlineKey), "the 2600 outline — an ungated innermost-ring rule would place a ⌀500 PC4").toEqual([keyAt(0)]);
  });

  test("a ring near a cap's mark but outside the cap is not a second member of it", () => {
    const cap = [...capWithPiles([0, 0], CAP), { said: "PC1", at: [0, 0] as const }];
    const footing = { ring: square([1900, 0], 1500) };
    const read = detected([...cap, footing]);
    expect(ofMark(read.placements, "PC1").map((row) => row.outlineKey), "the mark named its own ring, and that ring alone").toEqual([keyAt(0)]);
  });

  test("a mark inside a ring its schedule does NOT agree with anchors by nearness exactly as before (F-RCC6's slab ring)", () => {
    const slab = { ring: square([2000, 3 * SPACING], 12000) };
    const without = detected([...COLUMNS]);
    const within = detected([slab, ...COLUMNS]);
    // The slab is drawn first, so every key after it is one along: what is compared is where each
    // column stands and what it is, which is what the placement says about the drawing.
    const where = (rows: readonly PlacementRow[]) => rows.map((row) => ({ mark: row.mark, x: row.x, y: row.y, family: row.memberFamily, letter: row.gridLetter, numeral: row.gridNumeral }));
    expect(where(ofMark(within.placements, "C1")), "the columns stand where they stood; the slab named nothing").toEqual(where(ofMark(without.placements, "C1")));
    expect(where(ofMark(within.placements, "C1")).length, "both of them").toBe(2);
    expect(within.placements.some((row) => row.outlineKey === keyAt(0)), "the slab ring is no column").toBe(false);
  });

  test("a mark whose schedule states no section is not judged — a pile number inside its circle inside an unmarked cap places the circle", () => {
    // S-04's shape: every pile numbered at its circle's centre, the caps drawn round them unmarked.
    const quarter = CAP / 4;
    const pieces: Piece[] = [0, 1].flatMap((at) => {
      const centre: Point = [at * SPACING, 0];
      const piles: Point[] = [
        [centre[0] - quarter, centre[1] - quarter],
        [centre[0] + quarter, centre[1] - quarter],
        [centre[0] + quarter, centre[1] + quarter],
        [centre[0] - quarter, centre[1] + quarter],
      ];
      return [{ ring: square(centre, CAP) }, ...piles.flatMap((pile, index): Piece[] => [{ ring: circle(pile, PILE) }, { said: `P${at * 4 + index + 1}`, at: pile }])];
    });
    const read = detected(pieces);
    const piles = read.placements.filter((row) => row.elementType === "pile");
    expect(piles.length, "eight numbered piles, eight members").toBe(8);
    expect(piles.every((row) => row.outlineKey !== keyAt(0) && row.outlineKey !== keyAt(9)), "each placed by its own circle — the unmarked caps round them are nobody's here").toBe(true);
  });
});

describe("I-333: the plan the placed ring encloses rides beside the placement", () => {
  test("a rectangle by its own sides, turned or square; a polygon by its shoelace; never a bounding box", () => {
    const pieces: Piece[] = [
      { ring: square([0, 0], CAP) },
      { said: "PC1", at: [0, 0] },
      { ring: turned([SPACING, 0], 2000, 1000) },
      { said: "PC1", at: [SPACING, 0] },
      { ring: chamfered([2 * SPACING, 0]) },
      { said: "PC2", at: [2 * SPACING, -40] },
      ...COLUMNS,
    ];
    const read = detected(pieces, { families: [family("PC1", 2000, 1000), family("PC2", 2100, 1750), family("C1", COLUMN)] });
    const byRing = new Map((read.outlines ?? []).map((outline) => [outline.sourceKey, outline]));
    expect(byRing.get(keyAt(0)), "a square cap by its sides").toMatchObject({ geometry: "PRISM_RECT", length: "2000.0", breadth: "2000.0", area: "4000000.0", perimeter: "8000.0", unit: "mm", areaUnit: "mm2", unitSourceKey: null });
    expect(byRing.get(keyAt(2)), "the turned cap by ITS sides — its box is 2121 × 2121 and 4.5 m², the drawing's plan is 2.0 m²").toMatchObject({ geometry: "PRISM_RECT", length: "2000.0", breadth: "1000.0", area: "2000000.0", perimeter: "6000.0" });
    expect(byRing.get(keyAt(4)), "the chamfered cap by its shoelace, and no sides at all").toMatchObject({ geometry: "PRISM_POLY", length: null, breadth: null, area: "3300000.0" });
    expect(read.placements.filter((row) => row.elementType === "pile_cap").every((row) => byRing.has(row.outlineKey)), "every placed cap carries its plan").toBe(true);
  });

  test("a unitless header reads the plan in the unit the drawing's notes declare — cited — and in none where nothing is declared", () => {
    const pieces: Piece[] = [{ ring: square([0, 0], CAP) }, { said: "PC1", at: [0, 0] }];
    const declared = detected(pieces, { unit: "unitless", declared: true });
    expect(declared.outlines?.find((outline) => outline.sourceKey === keyAt(0)), "mm, as the notes declare it, cited to them (I-302)").toMatchObject({ unit: "mm", areaUnit: "mm2", unitSourceKey: "DXF_HANDLE:NOTES", area: "4000000.0" });
    expect(detected(pieces, { unit: "unitless" }).outlines, "a figure in a unit nobody named is no figure (L-CAD-02)").toEqual([]);
  });
});

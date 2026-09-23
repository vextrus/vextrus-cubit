/**
 * I-460 AT THE STAGE THAT READS IT: a mark TURNED to run along the one drawn pair it stands on is
 * that pair's own lettering, and names it — which is how a structural plan letters a beam running up
 * the sheet (T-TEXT-ROTATED), and what EntityGraph v3's world rotation (I-415) lets the placement stage
 * tell apart from a label that merely fell on a pair.
 *
 * The rule's refutation is the case it must refuse: F-RCC6's trimmer lettering `40B` stands at 0° on
 * exactly ONE pair that is not its own and runs along it. A mark written the way the sheet reads says
 * nothing about which member it names, so it names nothing; and TG1's `D75` on S-13, turned ACROSS its
 * pair, names nothing either. Where the drawing states two readings of one pair — two turned marks on
 * it, its own lettering against a label beside it, one mark on two crossing pairs — nothing names it
 * (L-QTY-04). A mark on a pair never letters another (I-344(b): S-14's `LB1` and `B31` named each
 * other). And an artifact stored at the v2 floor states no rotation, so it reads exactly as before.
 *
 * PURE, in the unit lane: the shipped detector over one hand-built v3 artifact, drawn at F-RCC6-BNBC's
 * own shape — 400 columns at the grid's crossings, 250-wide beams drawn as edge-line pairs between their
 * faces, wider than the edition's pairing band (0.08 × 2400 = 192) so only a stated width admits them.
 * A drawing is not a test's input (B-19): every geometry below is drawn HERE. The real drawing is
 * graded in bnbc-beam-sections.test.ts.
 */
import { describe, expect, test } from "vitest";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph/schema";
import type { DetectedGrid, GridAxisRow } from "@/modules/takeoff/partition/grid/detect";
import { detectPlacements } from "@/modules/takeoff/partition/placement/detect";
import type { FamilyNamed, PlacementEvidence, PlacementRow, RunRow } from "@/modules/takeoff/partition/placement/rows";
import type { PlacementShares } from "@/modules/takeoff/partition/placement/shares";
import type { PartitionedView } from "@/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";
import { asStoredV2, writtenAtV3 } from "../../../cad/support/entitygraph-versions";

/** The grid every piece below is drawn on, and so the distance every share scales by. */
const SPACING = 2400;

/** The platform edition's own shares (the seed's), so the band is 192 and the reach 2160. */
const SHARES: PlacementShares = { containmentMerge: "0.08", nearAnchor: "0.9", footprintMin: "0.6", footprintMax: "2.5" };

/** The view every entity stands in. */
const CAPTION_KEY = "DXF_HANDLE:1";
const VIEW: PartitionedView = { viewKey: `${VIEW_TYPE.LAYOUT_PLAN}:${CAPTION_KEY}`, type: VIEW_TYPE.LAYOUT_PLAN, reason: null, caption: "BEAM LAYOUT PLAN", anchorKey: CAPTION_KEY };

const COLOUR = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" as const };

/** The columns' drawn side and the beams' drawn width — what their schedules state them at. */
const COLUMN_SIDE = 400;
const WIDTH = 250;
const HALF = WIDTH / 2;

/** The column faces a beam between two grid lines is drawn from and to. */
const FACE = COLUMN_SIDE / 2;

/** One piece of the drawing: a text where it stands and which way it is written, a square ring, or one edge line. */
type Piece =
  | { readonly said: string; readonly at: readonly [number, number]; readonly turn?: number }
  | { readonly square: readonly [number, number]; readonly side: number }
  | { readonly line: readonly [readonly [number, number], readonly [number, number]] };

/** A beam drawn as its two edge lines, half its width either side of the axis from one point to another. */
function beam(from: readonly [number, number], to: readonly [number, number], width = WIDTH): Piece[] {
  const along = Math.abs(to[0] - from[0]) >= Math.abs(to[1] - from[1]) ? "x" : "y";
  const [dx, dy] = along === "x" ? [0, width / 2] : [width / 2, 0];
  return [
    { line: [[from[0] - dx, from[1] - dy], [to[0] - dx, to[1] - dy]] },
    { line: [[from[0] + dx, from[1] + dy], [to[0] + dx, to[1] + dy]] },
  ];
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

/** Four columns at the grid's crossings A1, A2, B1, B2, each lettered `C1` at its centre. */
const COLUMNS: readonly Piece[] = [
  [0, 0],
  [0, SPACING],
  [SPACING, 0],
  [SPACING, SPACING],
].flatMap((at) => [{ square: at as [number, number], side: COLUMN_SIDE }, { said: "C1", at: at as [number, number] }]);

/** The beam up the sheet on grid A, A1 to A2 — the member this rule exists for. */
const UP_THE_SHEET = beam([0, FACE], [0, SPACING - FACE]);
/** The beam across the sheet on grid 1, A1 to B1, lettered BESIDE it (below it) as every such beam is. */
const ACROSS = [...beam([FACE, 0], [SPACING - FACE, 0]), { said: "B1", at: [SPACING / 2, -2 * WIDTH] as const }];
/** The beam across the sheet on grid 2, A2 to B2, which no mark of its own letters. */
const TOP = beam([FACE, SPACING], [SPACING - FACE, SPACING]);

/** The families the schedules state: the column (whose section states the scale) and the beams. */
const FAMILIES: readonly FamilyNamed[] = [
  { family: "C1", variants: [{ sectionWidth: COLUMN_SIDE, sectionDepth: COLUMN_SIDE }] },
  ...["B1", "B2", "B5", "B7", "B8"].map((family): FamilyNamed => ({ family, variants: [{ sectionWidth: WIDTH, sectionDepth: 450 }] })),
  { family: "B9", variants: [{ sectionWidth: 300, sectionDepth: 600 }] },
];

const AXES: readonly GridAxisRow[] = [
  { viewKey: VIEW.viewKey, family: "letter", label: "A", axis: "x", position: 0, bubbleKey: "DXF_HANDLE:F01", labelKey: "DXF_HANDLE:F02", minSpacing: SPACING },
  { viewKey: VIEW.viewKey, family: "letter", label: "B", axis: "x", position: SPACING, bubbleKey: "DXF_HANDLE:F03", labelKey: "DXF_HANDLE:F04", minSpacing: SPACING },
  { viewKey: VIEW.viewKey, family: "numeral", label: "1", axis: "y", position: 0, bubbleKey: "DXF_HANDLE:F05", labelKey: "DXF_HANDLE:F06", minSpacing: SPACING },
  { viewKey: VIEW.viewKey, family: "numeral", label: "2", axis: "y", position: SPACING, bubbleKey: "DXF_HANDLE:F07", labelKey: "DXF_HANDLE:F08", minSpacing: SPACING },
];
const GRID: DetectedGrid = { views: 1, axes: AXES, deferrals: [] };

/** The drawing as the current extractor writes it (v3), parsed by the mirror so it is a lawful artifact. */
function drawn(pieces: readonly Piece[]): EntityGraph {
  const entities = pieces.map((piece, index) => {
    const key = `DXF_HANDLE:${(index + 2).toString(16).toUpperCase()}`;
    if ("said" in piece) return { key, type: "TEXT", space: "Model", layer: "TEXT", colour: COLOUR, text: piece.said, height: 150, points: [[piece.at[0], piece.at[1]]], rotation: piece.turn ?? 0 };
    if ("line" in piece) return { key, type: "LINE", space: "Model", layer: "BEAM", colour: COLOUR, points: piece.line.map((point) => [point[0], point[1]]) };
    return { key, type: "LWPOLYLINE", space: "Model", layer: "COLUMN", colour: COLOUR, closed: true, points: square(piece.square, piece.side) };
  });
  return entityGraphSchema.parse(
    writtenAtV3({
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

/** What the shipped stage places over one artifact: its beams, and the run each measures. */
function read(graph: EntityGraph): { readonly beams: readonly PlacementRow[]; readonly runs: ReadonlyMap<string, RunRow> } {
  const evidence: PlacementEvidence = { graph, views: [VIEW], assignments: new Map(graph.entities.map((entity) => [entity.key, VIEW.viewKey])), grid: GRID, shares: SHARES, families: FAMILIES };
  const placed = detectPlacements(evidence);
  return { beams: placed.placements.filter((row) => row.elementType === "beam"), runs: new Map((placed.runs ?? []).map((run) => [run.placementKey, run])) };
}

/** The beams placed, as `mark@(x,y)`, in a stable order. */
function marksOf(graph: EntityGraph): string[] {
  return read(graph)
    .beams.map((row) => `${row.mark}@(${row.x},${row.y})`)
    .sort();
}

/** Where the beam up the sheet, the one across it and the unlettered top one each place when named. */
const UP = `(0,${SPACING / 2})`;
const ACROSS_AT = `(${SPACING / 2},0)`;
const TOP_AT = `(${SPACING / 2},${SPACING})`;

/** The mark lettered on the beam up the sheet, at its centre, written as `turn` says. */
const onTheBeam = (mark: string, turn: number | undefined, at: readonly [number, number] = [0, SPACING / 2]): Piece => (turn === undefined ? { said: mark, at } : { said: mark, at, turn });

describe("I-460: a turned mark on its own pair names it", () => {
  test("a mark turned up the sheet on the beam it letters names that beam, which measures its clear between the columns' faces", () => {
    const graph = drawn([...COLUMNS, ...UP_THE_SHEET, onTheBeam("B2", 90), ...ACROSS]);
    expect(marksOf(graph), "B2 up the sheet, B1 across it").toEqual([`B1@${ACROSS_AT}`, `B2@${UP}`]);
    const { beams, runs } = read(graph);
    const up = beams.find((row) => row.mark === "B2") as PlacementRow;
    const mark = graph.entities.find((entity) => entity.text === "B2");
    expect(up.markKey, "named by the turned mark itself — the atom it was read from (L-CAD-03)").toBe(mark?.key);
    expect(up.memberFamily, "typed by its own family").toBe("B2");
    expect(runs.get(up.placementKey)?.clear, "A1's face to A2's: 2400 less the two 200 half-columns, in the header's millimetres").toMatchObject({ value: "2000.0", unit: "mm", basis: "MEASURED" });
  });

  test("read downward (270°) it is the same lettering; within the drift the member's own width allows it still runs along it, beyond it it does not", () => {
    expect(marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, onTheBeam("B2", 270)])), "270° runs along the beam as 90° does").toEqual([`B2@${UP}`]);
    // Carried the beam's 2000 length, 89.5° drifts 17 off its axis — inside half its 250 width.
    expect(marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, onTheBeam("B2", 89.5)])), "a hair off 90° is still along it").toEqual([`B2@${UP}`]);
    // 85° drifts 174 — out past the beam's edge line: not a mark written along this member.
    expect(marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, onTheBeam("B2", 85)])), "a mark that leaves the member within its own length does not run along it").toEqual([]);
  });

  test("F-RCC6's `40B`, drawn here: a mark at 0° standing on exactly one pair across the sheet, not its own and running along it, names NOTHING", () => {
    const fortyB = { said: "B5", at: [SPACING / 2, SPACING] as const, turn: 0 };
    expect(marksOf(drawn([...COLUMNS, ...TOP, fortyB])), "the top pair stays unplaced: a mark written the way the sheet reads is no pair's own lettering").toEqual([]);
    // The same mark a hair off 0° — as a drawing written by a rotation leaves it — is still written across the sheet.
    expect(marksOf(drawn([...COLUMNS, ...TOP, { ...fortyB, turn: 0.5 }])), "0.5° is not turned").toEqual([]);
    expect(marksOf(drawn([...COLUMNS, ...TOP, { ...fortyB, turn: 180 }])), "nor is a mark written upside down across it").toEqual([]);
    // What the rotation-blind rule would have done, and what the member gets where a label stands BESIDE it.
    expect(marksOf(drawn([...COLUMNS, ...TOP, { said: "B5", at: [SPACING / 2, SPACING - 2 * WIDTH] }])), "a label beside the pair names it, as I-344 always read").toEqual([`B5@${TOP_AT}`]);
  });

  test("S-13's TG1 `D75`, drawn here: a mark turned ACROSS the pair it stands on names nothing — and stays out of the lettering of every other pair", () => {
    const across = { said: "B7", at: [SPACING / 2, 0] as const, turn: 90 };
    expect(marksOf(drawn([...COLUMNS, ...beam([FACE, 0], [SPACING - FACE, 0]), across])), "turned, but not along the pair it stands on").toEqual([]);
    expect(marksOf(drawn([...COLUMNS, ...ACROSS, across])), "the pair's own label beside it still names it").toEqual([`B1@${ACROSS_AT}`]);
  });

  test("a mark written across the sheet on a beam running up it names nothing", () => {
    expect(marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, onTheBeam("B2", 0)])), "0° on a pair along y: not along it").toEqual([]);
  });
});

describe("I-460: where the drawing states two readings, nothing is taken (L-QTY-04)", () => {
  test("two turned marks on one pair that disagree name it neither way", () => {
    const twice = [onTheBeam("B2", 90, [0, 800]), onTheBeam("B7", 90, [0, 1600])];
    expect(marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, ...twice])), "B2 and B7 both letter it").toEqual([]);
    const agreeing = drawn([...COLUMNS, ...UP_THE_SHEET, onTheBeam("B2", 90, [0, 800]), onTheBeam("B2", 90, [0, 1600])]);
    const lettered = agreeing.entities.filter((entity) => entity.text === "B2").map((entity) => entity.key);
    expect(lettered.length, "the drawing letters it twice").toBe(2);
    expect(
      read(agreeing).beams.map((row) => [row.mark, row.markKey]),
      "lettered twice alike, it is named once, by the lower key (L-REG-04)",
    ).toEqual([["B2", [...lettered].sort()[0]]]);
  });

  test("its own lettering against the label beside it: named where they agree, and by neither where they do not", () => {
    const beside = (mark: string): Piece => ({ said: mark, at: [2 * WIDTH, SPACING / 2] });
    expect(marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, onTheBeam("B2", 90), beside("B8")])), "B2 on it, B8 beside it").toEqual([]);
    const agree = drawn([...COLUMNS, ...UP_THE_SHEET, onTheBeam("B2", 90), beside("B2")]);
    const turned = agree.entities.find((entity) => entity.text === "B2" && entity.rotation === 90);
    expect(
      read(agree).beams.map((row) => [row.mark, row.markKey]),
      "the two agree: named by its own lettering",
    ).toEqual([["B2", turned?.key]]);
  });

  test("a turned mark standing where two pairs cross letters neither", () => {
    const crossing = beam([-SPACING / 2, SPACING / 2], [SPACING / 2, SPACING / 2]);
    expect(marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, ...crossing, onTheBeam("B2", 90)])), "on both pairs at once: which one it letters the drawing did not say").toEqual([]);
  });

  test("and where the pair it crosses is one the edition's band drew — a pair is a pair, whichever pairing read it", () => {
    // 150 apart, inside the band (192): the band pairs it, and only a stated width could pair the 250 up the sheet.
    const bandPair = beam([-SPACING / 2 + 200, SPACING / 2], [SPACING / 2 + 200, SPACING / 2], 150);
    expect(marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, onTheBeam("B2", 90)])), "alone on the beam up the sheet, B2 names it").toEqual([`B2@${UP}`]);
    expect(
      marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, ...bandPair, onTheBeam("B2", 90)])).filter((placed) => placed.endsWith(`@${UP}`)),
      "standing on it and on the band's pair at once, it letters neither",
    ).toEqual([]);
  });
});

describe("I-460: a mark standing on a pair the band drew is no label beside another", () => {
  test("a label written across the sheet on a band pair does not name the stated-width pair it stands beside", () => {
    // The band's pair across the sheet, clear of the beam up it, and a 0° mark ON it 700 off that beam's axis.
    const bandPair = beam([FACE + 100, SPACING / 2], [SPACING - FACE, SPACING / 2], 150);
    const onBand = { said: "B2", at: [700, SPACING / 2] as const, turn: 0 };
    const beside = { said: "B2", at: [700, SPACING / 2 + 600] as const, turn: 0 };
    expect(marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, beside])).filter((placed) => placed.endsWith(`@${UP}`)), "the same label standing clear of every pair names the beam beside it").toEqual([
      `B2@${UP}`,
    ]);
    expect(
      marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, ...bandPair, onBand])).filter((placed) => placed.endsWith(`@${UP}`)),
      "standing on the band's pair it is that pair's mark or nobody's, never the next beam's (I-344(b))",
    ).toEqual([]);
  });
});

describe("I-460 keeps every fence I-344 set", () => {
  test("a turned mark names only its own pair — never the pair beside it (S-14's LB1 and B31)", () => {
    // A trimmer up the sheet 1000 off grid A, framed between the beams on grids 1 and 2, and lettered by nobody.
    const trimmer = beam([1000, HALF], [1000, SPACING - HALF]);
    const graph = drawn([...COLUMNS, ...UP_THE_SHEET, onTheBeam("B2", 90), ...ACROSS, ...TOP, { said: "B5", at: [SPACING / 2, SPACING + 2 * WIDTH] }, ...trimmer]);
    expect(marksOf(graph), "B2 names the beam it stands on, and the trimmer beside it stays unplaced").toEqual([`B1@${ACROSS_AT}`, `B2@${UP}`, `B5@${TOP_AT}`]);
  });

  test("the width binds as it did: a turned mark whose family is stated wider than the pair names nothing", () => {
    expect(marksOf(drawn([...COLUMNS, ...UP_THE_SHEET, onTheBeam("B9", 90)])), "B9 is scheduled 300 wide, the pair drawn 250").toEqual([]);
  });

  test("an artifact stored at the v2 floor states no rotation, and the same drawing reads exactly as it did before v3", () => {
    const pieces = [...COLUMNS, ...UP_THE_SHEET, onTheBeam("B2", 90), ...ACROSS];
    const stored = entityGraphSchema.parse(asStoredV2(drawn(pieces)));
    expect(stored.entities.some((entity) => entity.rotation !== undefined), "the floor carries no rotation").toBe(false);
    expect(marksOf(stored), "the beam up the sheet waits for a declared re-ingest; the one beside its label is placed").toEqual([`B1@${ACROSS_AT}`]);
  });
});

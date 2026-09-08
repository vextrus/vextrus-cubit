/**
 * The mechanics L-CAD-07's grid backbone is graded on (R-TO-030, L-CAD-07, SEAM-TENANT).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts, the
 * recorded drawing and the stand-in for the `cad/` CLI all come from the stage the stored partition
 * already runs on (`./partition-stage`), so this file adds exactly what a grid needs beyond a
 * partitioned ingest: artifacts whose MODEL SPACE really carries bubbles — round closed rings each
 * enclosing one text — beside the things that are NOT bubbles, the doors the criteria drive, and the
 * store reads they are graded by.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's interfaces, its test
 * contract or the Bible publishes.
 */
import { expect } from "vitest";
import { TENANT_COLUMN } from "../../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../../db/__tests__/support/live-sql";
import {
  CAPTION_HEIGHT,
  INGEST_JOB_MODULE,
  INGEST_MODULE,
  LABEL_HEIGHT,
  MODEL_SPACE,
  PAPER_SPACE,
  PARTITION_MODULE,
  productModule,
  rebuildDoor,
  sql,
  stepSink,
  storageOf,
  tempDir,
  unique,
  type JsonValue,
  type Person,
  type ProgressLike,
  type StagedDrawing,
  type StepRecord,
} from "./partition-stage";
import { stageDrawing, stubCli, withCadCommand } from "../../support/ingest-stage";

export { MODEL_SPACE, PAPER_SPACE };

/* ------------------------------------------------------------------ the homes the spec names */

/** The door the overlay and placement read a stored grid through (test contract: `gridOf`). */
export const GRID_DOOR_MODULE = PARTITION_MODULE;

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The stage this increment adds, and the stage it runs after (test contract, riskNotes (a)). */
export const GRID_STAGE = "grid";
export const CONVENTIONS_STAGE = "conventions";
export const STORED_STEP = "stored";

/** The two tables a grid's rows land in (test contract). */
export const GRIDS = "grids";
export const GRID_DEFERRALS = "grid_deferrals";

/** The two families a bubble sorts into, and the two world axes a family georeferences along. */
export const FAMILY_LETTER = "letter";
export const FAMILY_NUMERAL = "numeral";
export const AXIS_X = "x";
export const AXIS_Y = "y";

/** What a layout plan with no lawful bubble evidence georeferences as (test contract, L-CAD-07). */
export const GRID_NO_BUBBLE_EVIDENCE = "GRID_NO_BUBBLE_EVIDENCE";

/**
 * How far one vertex of a ring may stand from the ring's mean radius, as a SHARE of that radius,
 * before the ring is no longer "a circle" in L-CAD-07's sense. A circle crosses the seam flattened
 * into a polygon (L-CAD-02), so its vertices are a rounding apart from exact, and the tolerance the
 * settled reading fixes for that is relative rather than absolute.
 *
 * Declared once here and cited wherever this acceptance judges a ring round — a tolerance transcribed
 * a second time is a second rule, and the two would drift apart at the next scenario (B-19).
 */
export const ROUNDNESS_TOLERANCE = 1e-6;

/** The two captions the artifacts are drawn around, and the classes the grammar reads them as. */
export const CAPTION_PLAN = "TYPICAL FLOOR PLAN";
export const CAPTION_SCHEDULE = "COLUMN SCHEDULE";
export const LAYOUT_PLAN = "LAYOUT_PLAN";
export const SCHEDULE = "SCHEDULE";

/** The layers the staged artifacts carry — census data, never environment names (test contract). */
export const LAYER_CAPTIONS = "CAPTIONS";
export const LAYER_BUBBLES = "GRID-BUBBLES";
export const LAYER_LABELS = "GRID-LABELS";
export const LAYER_LINES = "GRID-LINES";
export const LAYER_GRID = "GRID";

/** The DXF types the artifacts are built from. */
const TYPE_TEXT = "TEXT";
const TYPE_LINE = "LINE";
const TYPE_RING = "LWPOLYLINE";

/** The five scenarios the criteria are staged over (test contract: fixture scenarios). */
export const SCENARIO = Object.freeze({
  PLAN: "grid-plan",
  RENAMED: "grid-plan-renamed",
  NO_BUBBLES: "grid-plan-no-bubbles",
  ROLELESS: "grid-plan-roleless",
  SCHEDULE_BUBBLES: "grid-schedule-bubbles",
} as const);

/** One of the five. */
export type GridScenario = (typeof SCENARIO)[keyof typeof SCENARIO];

/**
 * How many decimals two readings of one measurement are compared to. Both sides compute a centroid
 * as the mean of the same doubles, so they agree bit for bit unless one of them rounds elsewhere;
 * comparing to a nanometre of a drawing whose grid spacing is tens of units is exact in substance
 * while leaving the last bit of a double to be the last bit of a double.
 */
const PLACES = 9;

/**
 * One measurement, at the precision the two sides are compared to. A rounded zero is answered as
 * positive zero: a centroid that lands on the origin from below is the same place as one that lands
 * on it from above, and `-0` and `0` are not equal to a deep comparison.
 */
export function atPrecision(value: number): number {
  const rounded = Math.round(value * 10 ** PLACES) / 10 ** PLACES;
  return rounded === 0 ? 0 : rounded;
}

/* ------------------------------------------------------------------ the shapes the doors answer in */

/** One `grids` row, as the store holds one and as the door answers one (test contract). */
export type GridAxisRow = {
  viewKey: string;
  family: string;
  label: string;
  axis: string;
  position: number;
  bubbleKey: string;
  labelKey: string;
  minSpacing: number;
};

/** One `grid_deferrals` row: the view that georeferenced as deferred, and why (L-CAD-07). */
export type GridDeferralRow = { viewKey: string; reason: string };

/** What `gridOf` answers for a drawing whose partition has been rebuilt (test contract). */
export type StoredGrid = { axes: unknown[]; deferrals: unknown[] } & Record<string, unknown>;

/** The module door the overlay and placement read a stored grid through. */
export type GridDoor = { gridOf: (scope: { tenantId: string; projectId: string; drawingId: string }) => Promise<StoredGrid | null> };

/* ------------------------------------------------------------------ loading the doors */

/** One door, with the calls this stage makes through it asserted by name before it is used. */
async function doorOf<T>(home: string, calls: readonly string[]): Promise<T> {
  const door = await productModule<Record<string, unknown>>(home);
  for (const call of calls) expect(typeof door[call], `${home} publishes \`${call}\``).toBe("function");
  return door as T;
}

/** The takeoff module's door onto a stored grid (increment interfaces: `gridOf`). */
export async function gridDoor(): Promise<GridDoor> {
  return doorOf<GridDoor>(GRID_DOOR_MODULE, ["gridOf"]);
}

/* ------------------------------------------------------------------ a hand-authored artifact */

/** A colour every built entity carries: channels, never a spelled colour (the artifact's own shape). */
const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" };

/** One drawn record of the built artifact, in the shape the mirror validates (L-CAD-05). */
export type Drawn = { key: string; type: string; space: string; layer: string; text?: string; height?: number; points?: number[][]; closed?: boolean };

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/** A closed ring of `vertices` points evenly spaced about a centre — a circle, as the seam carries one. */
function ringPoints(centre: readonly [number, number], radius: number, vertices: number): number[][] {
  return Array.from({ length: vertices }, (_unused, index) => {
    const angle = (2 * Math.PI * index) / vertices;
    return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
  });
}

/** A square ring of four vertices about a centre — closed, and not round. */
function squarePoints(centre: readonly [number, number], radius: number): number[][] {
  return [
    [centre[0] - radius, centre[1] - radius],
    [centre[0] + radius, centre[1] - radius],
    [centre[0] + radius, centre[1] + radius],
    [centre[0] - radius, centre[1] + radius],
  ];
}

/** One bubble as the artifacts draw one: what its text says, where it stands, and how it is drawn. */
type BubbleSpec = { text: string; centre: [number, number]; radius: number; vertices: number; round: boolean };

/** The bubble radius every artifact draws, and how many vertices a round ring is drawn from. */
const RADIUS = 3;
const VERTICES = 16;

/** The five lawful bubbles of the `grid-plan` cluster: three letters along x, two numerals along y. */
const PLAN_BUBBLES: readonly BubbleSpec[] = [
  { text: "a.", centre: [0, -30], radius: RADIUS, vertices: VERTICES, round: true },
  { text: "B", centre: [20, -30], radius: RADIUS, vertices: VERTICES, round: true },
  { text: "c", centre: [50, -30], radius: RADIUS, vertices: VERTICES, round: true },
  { text: "1", centre: [-30, -10], radius: RADIUS, vertices: VERTICES, round: true },
  { text: "2", centre: [-30, -25], radius: RADIUS, vertices: VERTICES, round: true },
];

/**
 * The five lawful bubbles of the SECOND layout plan `grid-plan` draws — the same rule read the other
 * way round: its letters spread along y and its numerals along x.
 *
 * A family georeferences along the world axis ITS OWN BUBBLES spread along (L-CAD-07, per-view), which
 * is a rule no drawing where the letters always run across the sheet can tell apart from the habit
 * `letter → x, numeral → y`. This view is drawn transposed so that the two readings disagree, and its
 * own minimum spacing (30) is not the first plan's (15) so that a spacing taken over the whole drawing
 * rather than over the view disagrees too.
 */
const TRANSPOSED_BUBBLES: readonly BubbleSpec[] = [
  { text: "f.", centre: [1170, -20], radius: RADIUS, vertices: VERTICES, round: true },
  { text: "G", centre: [1170, -60], radius: RADIUS, vertices: VERTICES, round: true },
  { text: "h", centre: [1170, -90], radius: RADIUS, vertices: VERTICES, round: true },
  { text: "7", centre: [1210, -120], radius: RADIUS, vertices: VERTICES, round: true },
  { text: "8", centre: [1250, -120], radius: RADIUS, vertices: VERTICES, round: true },
];

/** The two lawful bubbles the `grid-schedule-bubbles` artifact draws inside its SCHEDULE view. */
const SCHEDULE_BUBBLES: readonly BubbleSpec[] = [
  { text: "A", centre: [600, -30], radius: RADIUS, vertices: VERTICES, round: true },
  { text: "B", centre: [620, -30], radius: RADIUS, vertices: VERTICES, round: true },
];

/** Where each caption stands. Far enough apart that no caption reaches another's cluster. */
const PLAN_AT: [number, number] = [0, 0];
const SCHEDULE_AT: [number, number] = [600, 0];
const TRANSPOSED_AT: [number, number] = [1200, 0];

/** The opaque layer names `grid-plan-renamed` re-draws the same artifact on (AC-5, held out). */
const OPAQUE: Readonly<Record<string, string>> = Object.freeze({
  [LAYER_CAPTIONS]: "P7",
  [LAYER_BUBBLES]: "Q3",
  [LAYER_LABELS]: "R9",
  [LAYER_LINES]: "T4",
  [LAYER_GRID]: "V6",
});

/** What a built artifact carries, so a criterion derives its expectations from it (B-19). */
export type BuiltGridArtifact = {
  /** Which of the five this is. */
  scenario: GridScenario;
  /** The artifact as bytes, for the stand-in CLI to write. */
  json: string;
  /** The graph, as an object. */
  graph: Record<string, JsonValue>;
  /** Every ORIGINAL record, model space and paper alike. */
  originals: readonly Drawn[];
  /** The keys of the caption entities anchoring a view, by the words those captions say. */
  anchorOf: ReadonlyMap<string, readonly string[]>;
  /** The keys of the three things AC-1 names as standing outside the grid; null where undrawn. */
  excluded: { pairedRing: string | null; looseLabel: string | null; squareRing: string | null };
  /** Every model-space layer the artifact draws on, in code-point order. */
  layers: readonly string[];
};

/**
 * An EntityGraph v2 whose model space carries a `TYPICAL FLOOR PLAN` cluster and a `COLUMN SCHEDULE`
 * cluster, drawn to whichever of the five scenarios is asked for. Every ordinal is minted from
 * `salt`, so two artifacts built here are two different drawings — and two artifacts built with the
 * SAME salt carry the same source keys, which is what lets a renamed drawing be compared row for row
 * against the one it was renamed from (AC-5).
 */
export function buildGridArtifact(scenario: GridScenario, salt: number): BuiltGridArtifact {
  const base = salt * 0x10000;
  let ordinal = 0;
  const next = (): string => handle(base + (ordinal += 1));
  const originals: Drawn[] = [];
  const anchorOf = new Map<string, string[]>();
  const excluded: BuiltGridArtifact["excluded"] = { pairedRing: null, looseLabel: null, squareRing: null };

  /** The layer a record is drawn on — opaque where the renamed scenario re-draws the same artifact. */
  const on = (layer: string): string => (scenario === SCENARIO.RENAMED ? (OPAQUE[layer] ?? layer) : layer);

  const caption = (text: string, at: [number, number]): void => {
    const key = next();
    anchorOf.set(text, [...(anchorOf.get(text) ?? []), key]);
    originals.push({ key, type: TYPE_TEXT, space: MODEL_SPACE, layer: on(LAYER_CAPTIONS), text, height: CAPTION_HEIGHT, points: [[...at]] });
  };

  const bubble = (spec: BubbleSpec, ringLayer: string, labelLayer: string): { ringKey: string; labelKey: string } => {
    const ringKey = next();
    originals.push({
      key: ringKey,
      type: TYPE_RING,
      space: MODEL_SPACE,
      layer: on(ringLayer),
      closed: true,
      points: spec.round ? ringPoints(spec.centre, spec.radius, spec.vertices) : squarePoints(spec.centre, spec.radius),
    });
    const labelKey = next();
    originals.push({ key: labelKey, type: TYPE_TEXT, space: MODEL_SPACE, layer: on(labelLayer), text: spec.text, height: LABEL_HEIGHT, points: [[...spec.centre]] });
    return { ringKey, labelKey };
  };

  const line = (from: [number, number], to: [number, number], layer: string): void => {
    originals.push({ key: next(), type: TYPE_LINE, space: MODEL_SPACE, layer: on(layer), points: [[...from], [...to]] });
  };

  caption(CAPTION_PLAN, PLAN_AT);
  caption(CAPTION_SCHEDULE, SCHEDULE_AT);

  if (scenario === SCENARIO.PLAN || scenario === SCENARIO.RENAMED) {
    for (const spec of PLAN_BUBBLES) bubble(spec, LAYER_BUBBLES, LAYER_LABELS);

    // A round ring enclosing a text that normalises to neither a bare letter nor a bare numeral.
    excluded.pairedRing = bubble({ text: "C1", centre: [10, -50], radius: RADIUS, vertices: VERTICES, round: true }, LAYER_BUBBLES, LAYER_LABELS).ringKey;
    // A bare letter standing inside no ring at all.
    excluded.looseLabel = next();
    originals.push({ key: excluded.looseLabel, type: TYPE_TEXT, space: MODEL_SPACE, layer: on(LAYER_LABELS), text: "D", height: LABEL_HEIGHT, points: [[60, -50]] });
    // A closed ring that is not round, enclosing a bare letter.
    excluded.squareRing = bubble({ text: "E", centre: [30, -60], radius: RADIUS, vertices: 4, round: false }, LAYER_BUBBLES, LAYER_LABELS).ringKey;

    line([-5, -30], [55, -30], LAYER_LINES);
    line([-30, -5], [-30, -30], LAYER_LINES);
    line([0, -35], [0, -5], LAYER_LINES);
    line([595, -5], [640, -5], LAYER_LINES);
    line([595, -15], [640, -15], LAYER_LINES);
    originals.push({ key: next(), type: TYPE_TEXT, space: MODEL_SPACE, layer: on(LAYER_LABELS), text: "300x450", height: LABEL_HEIGHT, points: [[605, -10]] });

    // A SECOND layout plan on the same sheet, drawn transposed: its letters run down the page and its
    // numerals across it. Every rule is the same rule; only the drawing disagrees with the habit.
    caption(CAPTION_PLAN, TRANSPOSED_AT);
    for (const spec of TRANSPOSED_BUBBLES) bubble(spec, LAYER_BUBBLES, LAYER_LABELS);
    line([1160, -20], [1260, -20], LAYER_LINES);
    line([1210, -10], [1210, -130], LAYER_LINES);
  }

  if (scenario === SCENARIO.NO_BUBBLES) {
    // Grid lines on a layer called GRID and two bare letters beside them — and no ring anywhere, so
    // there is no bubble evidence to read however the layers are named (AC-2, AC-5).
    line([-5, -30], [55, -30], LAYER_GRID);
    line([-30, -5], [-30, -30], LAYER_GRID);
    line([0, -35], [0, -5], LAYER_GRID);
    line([20, -35], [20, -5], LAYER_GRID);
    line([595, -5], [640, -5], LAYER_GRID);
    line([595, -15], [640, -15], LAYER_GRID);
    originals.push({ key: next(), type: TYPE_TEXT, space: MODEL_SPACE, layer: on(LAYER_LABELS), text: "A", height: LABEL_HEIGHT, points: [[0, -30]] });
    originals.push({ key: next(), type: TYPE_TEXT, space: MODEL_SPACE, layer: on(LAYER_LABELS), text: "B", height: LABEL_HEIGHT, points: [[20, -30]] });
  }

  if (scenario === SCENARIO.ROLELESS) {
    // Rings, label texts and grid lines in equal number on ONE layer: the resolver's plurality is
    // strict, so that layer carries no role at all and nothing on it is a candidate (AC-6).
    for (const spec of PLAN_BUBBLES) bubble(spec, LAYER_GRID, LAYER_GRID);
    line([-5, -30], [55, -30], LAYER_GRID);
    line([-30, -5], [-30, -30], LAYER_GRID);
    line([0, -35], [0, -5], LAYER_GRID);
    line([20, -35], [20, -5], LAYER_GRID);
    line([50, -35], [50, -5], LAYER_GRID);
  }

  if (scenario === SCENARIO.SCHEDULE_BUBBLES) {
    // Lawful bubbles, on the layers a role reads — but standing inside the SCHEDULE view, which is
    // not a view a grid may be read off (L-CAD-06, L-CAD-07).
    for (const spec of SCHEDULE_BUBBLES) bubble(spec, LAYER_BUBBLES, LAYER_LABELS);
    line([595, -5], [640, -5], LAYER_LINES);
    line([595, -15], [640, -15], LAYER_LINES);
    line([-5, -30], [55, -30], LAYER_LINES);
    line([-30, -5], [-30, -30], LAYER_LINES);
    line([0, -35], [0, -5], LAYER_LINES);
  }

  // The paper layout: a sheet's own furniture, which L-CAD-06 does not partition at all.
  originals.push({ key: next(), type: TYPE_TEXT, space: PAPER_SPACE, layer: "TITLEBLOCK", text: "S-101 GENERAL ARRANGEMENT", height: 3, points: [[5, 5]] });
  originals.push({ key: next(), type: TYPE_LINE, space: PAPER_SPACE, layer: "TITLEBLOCK", points: [[0, 0], [297, 210]] });

  const graph: Record<string, JsonValue> = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: { min: [-60, -140], max: [1300, 20] }, strays_rejected: 0 },
      { name: PAPER_SPACE, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 },
    ] as unknown as JsonValue,
    dropped_layouts: [],
    entities: originals.map((record) => ({ ...record, colour: CHANNELS })) as unknown as JsonValue,
    derived: [],
    block_attributes: [],
    counters: [],
  };

  const layers = [...new Set(originals.filter((record) => record.space === MODEL_SPACE).map((record) => record.layer))].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );

  return { scenario, json: JSON.stringify(graph), graph, originals, anchorOf, excluded, layers };
}

/* ------------------------------------------------------------------ the acceptance's own reading */

/** Where a record stands: the mean of the points it is drawn from (AC-1's vertex centroid). */
function centroidOf(record: Drawn): [number, number] {
  const points = record.points ?? [];
  const summed = points.reduce<[number, number]>((held, point) => [held[0] + (point[0] ?? 0), held[1] + (point[1] ?? 0)], [0, 0]);
  return [summed[0] / points.length, summed[1] / points.length];
}

/** How many vertices a ring must carry before equidistance means anything — see `roundnessOf`. */
const FEWEST_ROUND_VERTICES = 5;

/**
 * A ring's centre and radius where it is round, or null where it is not. Round is: more vertices than
 * a quadrilateral — the square ring of `grid-plan` has four corners equidistant from its own centre,
 * so equidistance alone would read a square as a circle — and every vertex standing within
 * `ROUNDNESS_TOLERANCE`, as a share, of the ring's MEAN radius from its vertex centroid, since a
 * circle crosses the seam flattened into a polygon.
 *
 * That mean is the ring's radius, and it is the ONE quantity both halves of the rule are read from:
 * whether the ring is a circle at all, and what "inside" it means. A second radius derived a second
 * way would be a second rule, and the two would draw different boundaries (B-19, L-CAD-07).
 */
function roundnessOf(ring: Drawn): { centre: [number, number]; radius: number } | null {
  const points = ring.points ?? [];
  if (points.length < FEWEST_ROUND_VERTICES) return null;
  const centre = centroidOf(ring);
  const radii = points.map((point) => Math.hypot((point[0] ?? 0) - centre[0], (point[1] ?? 0) - centre[1]));
  const mean = radii.reduce((held, radius) => held + radius, 0) / radii.length;
  if (!(mean > 0)) return null;
  return radii.every((radius) => Math.abs(radius - mean) <= ROUNDNESS_TOLERANCE * mean) ? { centre, radius: mean } : null;
}

/** Is this ring round? The same single derivation, asked as a yes or no. */
function isRound(ring: Drawn): boolean {
  return roundnessOf(ring) !== null;
}

/**
 * L-CAD-07's label normalisation: dotless, uppercase. A label is a bubble's label only where what is
 * left is a bare letter A–Z or a bare numeral.
 */
export function normalisedLabelOf(text: string): { label: string; family: string } | null {
  const normalised = text.replaceAll(".", "").trim().toUpperCase();
  if (/^[A-Z]$/.test(normalised)) return { label: normalised, family: FAMILY_LETTER };
  if (/^[0-9]+$/.test(normalised)) return { label: normalised, family: FAMILY_NUMERAL };
  return null;
}

/**
 * The rows AC-1 states an artifact yields, read off the artifact itself by this acceptance's own
 * reading of L-CAD-07's rule: a round closed ring enclosing exactly one text whose normalised form
 * is a bare letter or a bare numeral; each family georeferenced along the world axis its bubbles
 * really spread along; and one minimum spacing for the whole view.
 *
 * Derived, never transcribed (B-19): an artifact that changes changes the expectation with it.
 */
export function expectedGridRows(built: BuiltGridArtifact, within: readonly string[] | null = null): Omit<GridAxisRow, "viewKey">[] {
  const standing = built.originals.filter((record) => record.space === MODEL_SPACE && (within === null || within.includes(record.key)));
  const texts = standing.filter((record) => typeof record.text === "string" && (record.points ?? []).length > 0);
  const rings = standing.filter((record) => record.closed === true && isRound(record));

  type Found = { bubbleKey: string; labelKey: string; label: string; family: string; centre: [number, number] };
  const found: Found[] = [];
  for (const ring of rings) {
    // The ring's own radius — the one the roundness rule derived — is what "inside" is measured by.
    const round = roundnessOf(ring);
    if (round === null) continue;
    const centre = round.centre;
    const inside = texts.filter((text) => {
      const at = centroidOf(text);
      return Math.hypot(at[0] - centre[0], at[1] - centre[1]) < round.radius;
    });
    if (inside.length !== 1) continue;
    const only = inside[0]!;
    const read = normalisedLabelOf(only.text ?? "");
    if (read === null) continue;
    found.push({ bubbleKey: ring.key, labelKey: only.key, label: read.label, family: read.family, centre });
  }

  // Each family georeferences along the world axis its own bubbles spread along.
  const axisOf = new Map<string, string>();
  for (const family of [FAMILY_LETTER, FAMILY_NUMERAL]) {
    const members = found.filter((bubble) => bubble.family === family);
    if (members.length === 0) continue;
    const spreadX = Math.max(...members.map((m) => m.centre[0])) - Math.min(...members.map((m) => m.centre[0]));
    const spreadY = Math.max(...members.map((m) => m.centre[1])) - Math.min(...members.map((m) => m.centre[1]));
    axisOf.set(family, spreadX >= spreadY ? AXIS_X : AXIS_Y);
  }

  const positionOf = (bubble: Found): number => (axisOf.get(bubble.family) === AXIS_X ? bubble.centre[0] : bubble.centre[1]);

  // The view's minimum grid spacing. A spacing is the distance BETWEEN AXES of one family, and an
  // axis is named by its label (compared dotless and uppercase) — so a family georeferences a spacing
  // only where it carries two or more DISTINCT labels, however many bubbles or positions it draws,
  // and the spacing is the least non-zero distance between the positions of two different labels of
  // that family (L-CAD-07, L-MEA-01). Two bubbles saying the same label are one axis bubbled at both
  // ends, which is ordinary drafting: the width of an axis is not a spacing between axes.
  let minSpacing = Number.POSITIVE_INFINITY;
  for (const family of axisOf.keys()) {
    const members = found.filter((bubble) => bubble.family === family);
    if (new Set(members.map((bubble) => bubble.label)).size < 2) continue;
    for (const one of members) {
      for (const other of members) {
        if (one.label === other.label) continue;
        const gap = Math.abs(positionOf(one) - positionOf(other));
        if (gap > 0) minSpacing = Math.min(minSpacing, gap);
      }
    }
  }
  if (!(minSpacing > 0) || !Number.isFinite(minSpacing)) return [];

  return found.map((bubble) => ({
    family: bubble.family,
    label: bubble.label,
    axis: axisOf.get(bubble.family) ?? "",
    position: atPrecision(positionOf(bubble)),
    bubbleKey: bubble.bubbleKey,
    labelKey: bubble.labelKey,
    minSpacing: atPrecision(minSpacing),
  }));
}

/** Any list of grid rows, in one order — the store's order is nobody's contract (C-05). */
export function byBubble<T extends { bubbleKey: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => (left.bubbleKey < right.bubbleKey ? -1 : left.bubbleKey > right.bubbleKey ? 1 : 0));
}

/* ------------------------------------------------------------------ staging a drawing to partition */

/** A drawing of a built artifact, recorded by the shipped ingest pipeline. */
export type StagedGridIngest = { drawing: StagedDrawing; ingestId: string; artifact: BuiltGridArtifact };

/**
 * A recorded drawing whose ingest artifact is the built one: the bytes are seeded into the store, and
 * the shipped ingest job is run over a stand-in CLI that hands back the artifact. What lands is a
 * real `ingests` row, written by the product's own pipeline (the same staging the stored partition's
 * own suites do — B-17).
 */
export async function stageGridIngest(person: Person, projectId: string, scenario: GridScenario, salt: number): Promise<StagedGridIngest> {
  const job = await productModule<{ runIngestJob: (payload: unknown, progress: ProgressLike, deps: { storage: unknown }) => Promise<void> }>(INGEST_JOB_MODULE);
  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(INGEST_MODULE);

  const artifact = buildGridArtifact(scenario, salt);
  const bytes = new TextEncoder().encode(`0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; ${scenario}\n`);
  const drawing = await stageDrawing(person, projectId, bytes, { name: unique(`${scenario}.dxf`), format: "dxf" });
  const stub = stubCli({ artifact: artifact.json, stderr: "", exitCode: 0 });

  await withCadCommand(stub.command, async () => {
    await job.runIngestJob(
      { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
      { jobId: unique(`ingest-${scenario}`), tempDir: tempDir("ingest"), step: async () => undefined },
      { storage: await storageOf() },
    );
  });

  const record = await records.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
  expect(record, `staging ${scenario} left no ingest record — a partition is a reading of a record`).not.toBeNull();
  return { drawing, ingestId: (record as { ingestId: string }).ingestId, artifact };
}

/** One run of the shipped partition job over a staged ingest, with the steps it recorded. */
export async function runGridPartition(person: Person, staged: StagedGridIngest, label = "grid"): Promise<StepRecord[]> {
  const rebuild = await rebuildDoor();
  const sink = stepSink(label);
  await rebuild.runPartitionJob(
    { tenantId: person.tenantId, drawingId: staged.drawing.drawingId, ingestId: staged.ingestId, requestedBy: person.userId },
    sink.progress,
    { storage: await storageOf() },
  );
  return sink.steps;
}

/* ------------------------------------------------------------------ reading the store */

/** Every `grids` row of one ingest, as the acceptance's own audit read. */
export function gridRows(tenantId: string, ingestId: string): GridAxisRow[] {
  return sql(
    `select view_key, family, label, axis, position::text, bubble_key, label_key, min_spacing::text
       from ${ident(GRIDS)}
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
      order by bubble_key;`,
  ).map((row) => ({
    viewKey: row[0] ?? "",
    family: row[1] ?? "",
    label: row[2] ?? "",
    axis: row[3] ?? "",
    position: atPrecision(Number(row[4] ?? "")),
    bubbleKey: row[5] ?? "",
    labelKey: row[6] ?? "",
    minSpacing: atPrecision(Number(row[7] ?? "")),
  }));
}

/** Every `grid_deferrals` row of one ingest, as the acceptance's own audit read. */
export function gridDeferralRows(tenantId: string, ingestId: string): GridDeferralRow[] {
  return sql(
    `select view_key, reason from ${ident(GRID_DEFERRALS)}
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
      order by view_key;`,
  ).map((row) => ({ viewKey: row[0] ?? "", reason: row[1] ?? "" }));
}

/** A field of an answered row, under either the door's spelling or the column's (C-05: shapes are free). */
function field(row: Record<string, unknown>, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake];
}

/** One axis row the door answered, read under the names the test contract fixes for it. */
export function axisRowOf(answered: unknown): GridAxisRow {
  const row = (answered ?? {}) as Record<string, unknown>;
  return {
    viewKey: String(field(row, "viewKey", "view_key") ?? ""),
    family: String(row["family"] ?? ""),
    label: String(row["label"] ?? ""),
    axis: String(row["axis"] ?? ""),
    position: atPrecision(Number(row["position"])),
    bubbleKey: String(field(row, "bubbleKey", "bubble_key") ?? ""),
    labelKey: String(field(row, "labelKey", "label_key") ?? ""),
    minSpacing: atPrecision(Number(field(row, "minSpacing", "min_spacing"))),
  };
}

/** One deferral row the door answered, the same way. */
export function deferralRowOf(answered: unknown): GridDeferralRow {
  const row = (answered ?? {}) as Record<string, unknown>;
  return { viewKey: String(field(row, "viewKey", "view_key") ?? ""), reason: String(row["reason"] ?? "") };
}

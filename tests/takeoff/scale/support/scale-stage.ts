/**
 * The mechanics L-MEA-05's scale engine is graded on (R-TO-020, L-MEA-05, L-ACT-02, SEAM-TENANT).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts, the
 * recorded drawing and the stand-in for the `cad/` CLI all come from the stage the stored partition
 * and the grid backbone already run on (`../../partition/support/partition-stage`,
 * `../../partition/support/grid-stage`), so this file adds exactly what a scale needs beyond a
 * partitioned ingest: artifacts whose model space really carries grid bubbles, DIMENSION originals
 * whose paint arrives as derived records, and a header that says (or refuses to say) a unit.
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
  PRINCIPAL,
  actorOf,
  byCodePoint,
  closeStage,
  grantRole,
  openSheetsStage,
  productModule,
  rebuildDoor,
  sql,
  stagePerson,
  stepSink,
  storageOf,
  tempDir,
  unique,
  viewAssignmentRows,
  type ActorCtx,
  type JsonValue,
  type Person,
  type ProgressLike,
  type StagedDrawing,
  type StepRecord,
} from "../../partition/support/partition-stage";
import { stageDrawing, stubCli, withCadCommand } from "../../support/ingest-stage";

export { MODEL_SPACE, PAPER_SPACE, PRINCIPAL, actorOf, byCodePoint, closeStage, grantRole, openSheetsStage, productModule, sql, stagePerson, storageOf, viewAssignmentRows };
export type { ActorCtx, Person, StagedDrawing, StepRecord };

/* ------------------------------------------------------------------ the homes the spec names */

/** The modules this increment publishes (test contract: procedures). */
export const SCALE_MODULE = "src/core/scale/index.ts";
export const SCALE_PROPOSALS_MODULE = "src/core/scale/proposals.ts";
export const SCALE_DOOR_MODULE = "src/modules/takeoff/scale/index.ts";
export const AFFIRM_SCALE_MODULE = "src/core/acts/affirm-scale.ts";
export const ACTS_MODULE = "src/core/acts/index.ts";
export const DB_MODULE = "src/core/db.ts";

/** The shipped one reader of the refusal marker — the product's own answer to "was this a refusal?" (ARCH-03). */
export const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The act, the permission it moves and the arm its Consequence renders through (test contract). */
export const AFFIRM_SCALE = "AFFIRM_SCALE";
export const MEASURE = "MEASURE";
export const SUBJECTS = "SUBJECTS";

/** The refusal codes this engine answers with (test contract, L-MEA-05). */
export const SCALE_NO_EVIDENCE = "SCALE_NO_EVIDENCE";
export const SCALE_UNIT_UNMAPPED = "SCALE_UNIT_UNMAPPED";
export const SCALE_OBSERVATION_UNCITED = "SCALE_OBSERVATION_UNCITED";
export const SCALE_OBSERVATION_OBLIQUE = "SCALE_OBSERVATION_OBLIQUE";
export const SCALE_OBSERVATION_UNVERIFIED = "SCALE_OBSERVATION_UNVERIFIED";

/** The two tables an affirmation lands in (test contract). */
export const SCALE_AFFIRMATIONS = "scale_affirmations";
export const CALIBRATIONS = "calibrations";

/** The four ranks, in the precedence L-MEA-05 fixes (test contract). */
export const QS_TWO_POINT = "QS_TWO_POINT";
export const GRID_SPACING = "GRID_SPACING";
export const DIMENSION_RATIO = "DIMENSION_RATIO";
export const FILE_UNITS = "FILE_UNITS";

/** How a QS observation states where its distance came from (test contract: `distanceBasis ENTERED`). */
export const ENTERED = "ENTERED";

/** The header spelling every mapped scenario carries, and the one a code outside the map reports. */
export const MM = "mm";
export const UNITLESS = "unitless";

/**
 * How far apart a dimension's drawn span and a grid gap may stand and still be the same distance
 * (riskNotes (4): "within 0.1 unit"). Declared once and cited wherever this acceptance judges a
 * match — a tolerance transcribed twice is two rules that drift apart at the next scenario (B-19).
 */
export const GRID_MATCH_TOLERANCE = 0.1;

/** How many places a factor is rendered to (the increment's interfaces: `toFixed(12, …)`). */
export const FACTOR_PLACES = 12;

/* ------------------------------------------------------------------ exact decimal arithmetic */

const SCALE_ONE = 10n ** BigInt(FACTOR_PLACES);

/**
 * A ratio of two whole numbers as a 12-place half-even decimal string — this acceptance's own
 * arithmetic, so an expectation is derived from the fixture's numbers rather than transcribed from
 * what the product happened to answer (B-19). Whole numbers only, because every quantity a staged
 * factor is built from (a stated measurement, a drawn span, a metres-per-unit denominator) is one.
 */
export function ratio12(numerator: bigint, denominator: bigint): string {
  expect(denominator > 0n, "a ratio this acceptance derives is taken over a positive denominator").toBe(true);
  const scaled = numerator * SCALE_ONE;
  let whole = scaled / denominator;
  const remainder = scaled % denominator;
  const twice = remainder * 2n;
  if (twice > denominator || (twice === denominator && whole % 2n === 1n)) whole += 1n;
  return `${whole / SCALE_ONE}.${(whole % SCALE_ONE).toString().padStart(FACTOR_PLACES, "0")}`;
}

/** Metres per drawing unit for a mapped header spelling, as a whole-number ratio (riskNotes (1)). */
export const METRES_PER: Readonly<Record<string, { numerator: bigint; denominator: bigint }>> = Object.freeze({
  mm: { numerator: 1n, denominator: 1000n },
  cm: { numerator: 1n, denominator: 100n },
  m: { numerator: 1n, denominator: 1n },
});

/** The 12-place rendering of one mapped spelling's metres-per-drawing-unit. */
export function metresPerString(unit: keyof typeof METRES_PER | string): string {
  const held = METRES_PER[unit];
  expect(held, `${unit} is one of the whole-number unit ratios this stage derives from`).toBeTruthy();
  return ratio12((held as { numerator: bigint }).numerator, (held as { denominator: bigint }).denominator);
}

/* ------------------------------------------------------------------ the shapes the doors answer in */

/** One machine proposal, as the test contract names its fields. */
export type ProposalRow = { rank: string; factorX: string; factorY: string; evidence: readonly string[] } & Record<string, unknown>;

/** What one view's calibration reads as once an act has affirmed it (AC-5). */
export type AffirmedRow = {
  calibrationKey?: string;
  rank?: string;
  factorX?: string;
  factorY?: string;
  actId?: string;
  anisotropy?: string;
  placeable?: boolean;
} & Record<string, unknown>;

/** What the door answers for one view (test contract: `proposals`, `affirmed`, `refusal`). */
export type ScaleAnswer = { proposals?: unknown; affirmed?: unknown; refusal?: unknown } & Record<string, unknown>;

/** The takeoff door onto a view's scale (increment interfaces: `scaleProposalsOf`). */
export type ScaleDoor = {
  scaleProposalsOf: (scope: { tenantId: string; projectId: string; drawingId: string }, deps: { storage: unknown }) => Promise<unknown>;
};

/** The pure core, as this acceptance drives it (increment interfaces). */
export type ScaleCore = {
  SCALE_RANKS: readonly string[];
  SCALE_UNITS: readonly string[];
  precedenceOf: (rank: string) => number;
  strongestOf: <T extends { rank: string }>(candidates: readonly T[]) => T | null;
  metresPer: (unit: string | null) => string | null;
  unitFactor: (unit: string | null) => { factorX: string; factorY: string } | null;
  factorPair: (x: string | number, y: string | number) => { factorX: string; factorY: string };
  isFactorString: (value: string) => boolean;
  calibrationKey: (viewKey: string, factorX: string, factorY: string) => string;
  citeObservation: (raw: unknown) => { axis: string; drawn: unknown; factor: string } & Record<string, unknown>;
  anisotropyOf?: (factorX: string, factorY: string) => string;
  verifyAxis?: (...args: never[]) => unknown;
};

/** SEAM-ACT through the surface this acceptance drives it by (L-ACT-02). */
export type ConsequenceLike = {
  actType: string;
  rendering: string;
  subjects: readonly { subjectId: string; before: readonly string[]; after: readonly string[] }[];
  effects?: { linesRederiving?: unknown; signaturesVoiding?: unknown };
} & Record<string, unknown>;

export type ActsSeam = {
  ACT_TYPES: readonly string[];
  ACT_PERMISSION: Record<string, string>;
  consequenceDigest: (consequence: ConsequenceLike) => string;
  preview: (ctx: unknown, input: unknown) => Promise<ConsequenceLike>;
  commit: (ctx: unknown, input: unknown, carriedDigest: string) => Promise<{ actId: string; consequenceDigest: string; consequence: ConsequenceLike }>;
};

/* ------------------------------------------------------------------ loading the doors */

/** One door, with the calls this stage makes through it asserted by name before it is used. */
async function doorOf<T>(home: string, calls: readonly string[]): Promise<T> {
  const door = await productModule<Record<string, unknown>>(home);
  for (const call of calls) expect(typeof door[call], `${home} publishes \`${call}\``).toBe("function");
  return door as T;
}

/** The pure core (increment interfaces: `src/core/scale/index.ts`). */
export async function scaleCore(): Promise<ScaleCore> {
  return doorOf<ScaleCore>(SCALE_MODULE, ["precedenceOf", "strongestOf", "metresPer", "unitFactor", "factorPair", "isFactorString", "calibrationKey", "citeObservation"]);
}

/** The takeoff module's door onto a view's scale (increment interfaces: `scaleProposalsOf`). */
export async function scaleDoor(): Promise<ScaleDoor> {
  return doorOf<ScaleDoor>(SCALE_DOOR_MODULE, ["scaleProposalsOf"]);
}

/** The act seam (L-ACT-02's pair, at its one home). */
export async function actsDoor(): Promise<ActsSeam> {
  return doorOf<ActsSeam>(ACTS_MODULE, ["preview", "commit", "consequenceDigest"]);
}

/**
 * The refusal code a failure carries, whether it arrived bare or wrapped by a transport — asked of
 * the product's own marker rather than re-implemented here.
 *
 * A refusal is an answer the product marks on the Error it hands back, and `src/core/faults` is the
 * one reader of that marker (ARCH-03, ARCH-02): running the thrown value through it is the same
 * reading a screen or a transport would get, so a failure this answers `null` for is one the product
 * itself would treat as a plain fault.
 */
export async function refusalCodeOf(failure: unknown): Promise<string | null> {
  const marker = await productModule<{ refusalCodeOf: (failure: unknown) => string | null }>(REFUSAL_MARKER_MODULE);
  expect(typeof marker.refusalCodeOf, `${REFUSAL_MARKER_MODULE} publishes \`refusalCodeOf\``).toBe("function");
  return marker.refusalCodeOf(failure);
}

/** What a call did: the value it answered, or the failure it threw. */
export async function attempt<T>(body: () => Promise<T>): Promise<{ answered: T | null; failure: unknown }> {
  try {
    return { answered: await body(), failure: null };
  } catch (failure) {
    return { answered: null, failure };
  }
}

/* ------------------------------------------------------------------ a hand-authored artifact */

/** A colour every built entity carries: channels, never a spelled colour (the artifact's own shape). */
const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" };

/** The DXF types the artifacts are built from. */
const TYPE_TEXT = "TEXT";
const TYPE_LINE = "LINE";
const TYPE_RING = "LWPOLYLINE";
const TYPE_DIMENSION = "DIMENSION";

/** The layers the staged artifacts draw on — census data, never environment names. */
const LAYER_CAPTIONS = "CAPTIONS";
const LAYER_BUBBLES = "GRID-BUBBLES";
const LAYER_LABELS = "GRID-LABELS";
const LAYER_LINES = "GRID-LINES";
const LAYER_DIMS = "DIMS";
const LAYER_NOTES = "NOTES";

/** The four scenarios the criteria are staged over (test contract: fixture scenarios). */
export const SCENARIO = Object.freeze({
  GRID_DIMS: "scale-grid-dims",
  UNITS_ONLY: "scale-units-only",
  UNMAPPED: "scale-unmapped",
  UNITLESS: "scale-unitless",
} as const);

/** One of the four. */
export type ScaleScenario = (typeof SCENARIO)[keyof typeof SCENARIO];

/** The `$INSUNITS` record each scenario's header reports (L-CAD-02's closed map). */
const INSUNITS: Readonly<Record<ScaleScenario, { code: number; unit: string | null; unmapped: boolean }>> = Object.freeze({
  [SCENARIO.GRID_DIMS]: { code: 4, unit: MM, unmapped: false },
  [SCENARIO.UNITS_ONLY]: { code: 4, unit: MM, unmapped: false },
  [SCENARIO.UNMAPPED]: { code: 3, unit: null, unmapped: true },
  [SCENARIO.UNITLESS]: { code: 0, unit: UNITLESS, unmapped: false },
});

/** The text the "SCALE 1:100" note says — a claim about scale that is not evidence of one (AC-4). */
export const SCALE_NOTE = "SCALE 1:100";

/** One bubble of a staged cluster: the ring, the label inside it, and where the pair stands. */
export type Bubble = { key: string; labelKey: string; label: string; family: "letter" | "numeral"; centre: [number, number] };

/** One staged DIMENSION: the original a key names, and the paint that says how far it reaches. */
export type Dimension = {
  /** The original entity's own key — the atom the evidence cites (L-CAD-03). */
  key: string;
  /** The world axis its paint measures along. */
  axis: "x" | "y";
  /** What its measurement text states, as text and as the number that text says. */
  statedText: string;
  stated: number;
  /** The raw drawn span of its non-text paint along that axis (riskNotes (3)). */
  span: number;
};

/** One cluster of a staged artifact: a caption and everything drawn around it. */
export type Cluster = {
  caption: string;
  captionKey: string;
  bubbles: readonly Bubble[];
  lineKeys: readonly string[];
  dimensions: readonly Dimension[];
};

/** What a built artifact carries, so a criterion derives its expectations from it (B-19). */
export type BuiltScaleArtifact = {
  scenario: ScaleScenario;
  json: string;
  graph: Record<string, JsonValue>;
  insunits: { code: number; unit: string | null; unmapped: boolean };
  clusters: readonly Cluster[];
  /** The key of the "SCALE 1:100" note, where the scenario draws one. */
  noteKey: string | null;
};

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/** A closed ring of evenly spaced points about a centre — a circle, as the seam carries one. */
function ringPoints(centre: readonly [number, number], radius: number, vertices: number): number[][] {
  return Array.from({ length: vertices }, (_unused, index) => {
    const angle = (2 * Math.PI * index) / vertices;
    return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
  });
}

/** One drawn record, in the shape the artifact mirror validates (L-CAD-05). */
type Drawn = Record<string, JsonValue>;

/** The bubble radius every artifact draws, and how many vertices a round ring is drawn from. */
const RADIUS = 3;
const VERTICES = 16;

/** Where each cluster of a multi-view scenario stands — far enough that no caption reaches another. */
const CLUSTER_AT: readonly [number, number][] = [
  [0, 0],
  [600, 0],
  [1200, 0],
];

/**
 * The bubbles a lettered/numbered cluster draws, relative to the cluster's own origin.
 *
 * The gaps between adjacent positions are deliberately UNEQUAL and in no useful order — letters
 * stand 20 then 30 apart, numerals 15, 20 then 21 — so the pair a span really falls between can only
 * be found by comparing that span against each gap, and is the first pair neither in the order the
 * rings were drawn nor in the order their positions run. A cluster whose gaps were all equal, or
 * whose matching pair were always the first, would let a reader that never compares anything pass
 * (B-19). The first five entries keep their positions: a suite that cites a bubble by its ordinal
 * cites the same drawn ring it did before.
 */
const CLUSTER_BUBBLES: readonly { text: string; at: [number, number]; family: "letter" | "numeral" }[] = [
  { text: "A", at: [0, -30], family: "letter" },
  { text: "B", at: [20, -30], family: "letter" },
  { text: "C", at: [50, -30], family: "letter" },
  { text: "1", at: [-30, -10], family: "numeral" },
  { text: "2", at: [-30, -25], family: "numeral" },
  { text: "3", at: [-30, -45], family: "numeral" },
  { text: "4", at: [-30, -66], family: "numeral" },
];

/**
 * An EntityGraph v2 built to one of the four scenarios: model space carries captioned clusters of
 * grid bubbles and grid lines, and — where the scenario asks for them — DIMENSION originals with no
 * points of their own whose paint arrives as derived records naming them as `src` (riskNotes (3)).
 *
 * Every ordinal is minted from `salt`, so two artifacts built here are two different drawings.
 */
export function buildScaleArtifact(scenario: ScaleScenario, salt: number): BuiltScaleArtifact {
  const base = salt * 0x10000;
  let ordinal = 0;
  const next = (): string => handle(base + (ordinal += 1));
  const entities: Drawn[] = [];
  const derived: Drawn[] = [];
  const clusters: Cluster[] = [];
  let noteKey: string | null = null;

  const text = (value: string, at: [number, number], height: number, layer: string): string => {
    const key = next();
    entities.push({ key, type: TYPE_TEXT, space: MODEL_SPACE, layer, colour: CHANNELS as unknown as JsonValue, text: value, height, points: [[...at]] as unknown as JsonValue });
    return key;
  };

  const line = (from: [number, number], to: [number, number], layer: string): string => {
    const key = next();
    entities.push({ key, type: TYPE_LINE, space: MODEL_SPACE, layer, colour: CHANNELS as unknown as JsonValue, points: [[...from], [...to]] as unknown as JsonValue });
    return key;
  };

  const bubble = (spec: { text: string; at: [number, number]; family: "letter" | "numeral" }, origin: readonly [number, number]): Bubble => {
    const centre: [number, number] = [origin[0] + spec.at[0], origin[1] + spec.at[1]];
    const key = next();
    entities.push({
      key,
      type: TYPE_RING,
      space: MODEL_SPACE,
      layer: LAYER_BUBBLES,
      colour: CHANNELS as unknown as JsonValue,
      closed: true,
      points: ringPoints(centre, RADIUS, VERTICES) as unknown as JsonValue,
    });
    const labelKey = text(spec.text, centre, LABEL_HEIGHT, LAYER_LABELS);
    return { key, labelKey, label: spec.text, family: spec.family, centre };
  };

  /**
   * One dimension as `cad/` emits one: an original carrying no points at all, and paint that names
   * it — a line spanning what it measures, and the measurement text (riskNotes (3), L-CAD-03).
   */
  const dimension = (from: [number, number], to: [number, number], stated: number): Dimension => {
    const key = next();
    entities.push({ key, type: TYPE_DIMENSION, space: MODEL_SPACE, layer: LAYER_DIMS, colour: CHANNELS as unknown as JsonValue });
    derived.push({ src: key, type: TYPE_LINE, space: MODEL_SPACE, layer: LAYER_DIMS, colour: CHANNELS as unknown as JsonValue, points: [[...from], [...to]] as unknown as JsonValue });
    const midpoint: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    derived.push({
      src: key,
      type: TYPE_TEXT,
      space: MODEL_SPACE,
      layer: LAYER_DIMS,
      colour: CHANNELS as unknown as JsonValue,
      text: `${stated}`,
      height: LABEL_HEIGHT,
      points: [[...midpoint]] as unknown as JsonValue,
    });
    const spanX = Math.abs(to[0] - from[0]);
    const spanY = Math.abs(to[1] - from[1]);
    return { key, axis: spanX >= spanY ? "x" : "y", statedText: `${stated}`, stated, span: Math.max(spanX, spanY) };
  };

  const cluster = (caption: string, origin: readonly [number, number], o: { bubbles: boolean; dimensions?: readonly Dimension[] }): Cluster => {
    const captionKey = text(caption, [origin[0], origin[1]], CAPTION_HEIGHT, LAYER_CAPTIONS);
    const bubbles = o.bubbles ? CLUSTER_BUBBLES.map((spec) => bubble(spec, origin)) : [];
    const lineKeys = [
      line([origin[0] - 5, origin[1] - 30], [origin[0] + 55, origin[1] - 30], LAYER_LINES),
      line([origin[0] - 30, origin[1] - 5], [origin[0] - 30, origin[1] - 69], LAYER_LINES),
    ];
    return { caption, captionKey, bubbles, lineKeys, dimensions: o.dimensions ?? [] };
  };

  if (scenario === SCENARIO.GRID_DIMS) {
    const origin = CLUSTER_AT[0] as [number, number];
    // Two dimensions whose paint spans two ADJACENT grid positions — one along each world axis —
    // and a third whose span matches no gap of either family while stating the same ratio as the
    // first, so the ratio rank stands where the grid rank does and only their evidence differs.
    //
    // Nothing here lines up with the order things were declared or drawn in, and that is the point:
    // the unmatched dimension is the FIRST one drawn along x, and the pair its axis's match really
    // falls between is the LAST pair of the letters (B..C, 30 apart), not the first (A..B, 20). Its
    // own span stands 1 unit from a real gap — ten times GRID_MATCH_TOLERANCE — so a reader that
    // matched loosely, or by ordinal, or not at all, answers different evidence than a reader that
    // compares each span against each gap (B-19).
    const offGrid = dimension([origin[0] + 0, origin[1] - 55], [origin[0] + 21, origin[1] - 55], 5250);
    const alongX = dimension([origin[0] + 0, origin[1] - 60], [origin[0] + 30, origin[1] - 60], 7500);
    const alongY = dimension([origin[0] - 45, origin[1] - 25], [origin[0] - 45, origin[1] - 45], 4000);
    clusters.push(cluster("TYPICAL FLOOR PLAN", origin, { bubbles: true, dimensions: [offGrid, alongX, alongY] }));
    // A note that SAYS a scale. It is a claim, not evidence: no proposal may cite it (AC-4).
    noteKey = text(SCALE_NOTE, [origin[0] + 60, origin[1] - 60], LABEL_HEIGHT, LAYER_NOTES);
  }

  if (scenario === SCENARIO.UNITS_ONLY) {
    clusters.push(cluster("TYPICAL FLOOR PLAN", CLUSTER_AT[0] as [number, number], { bubbles: true }));
    clusters.push(cluster("SECOND FLOOR PLAN", CLUSTER_AT[1] as [number, number], { bubbles: true }));
    // A third view drawn with no bubble at all: it georeferences no grid, so it carries no grid rows
    // and no grid-spacing proposal can stand on it (AC-8).
    clusters.push(cluster("ROOF PLAN", CLUSTER_AT[2] as [number, number], { bubbles: false }));
  }

  if (scenario === SCENARIO.UNMAPPED || scenario === SCENARIO.UNITLESS) {
    clusters.push(cluster("TYPICAL FLOOR PLAN", CLUSTER_AT[0] as [number, number], { bubbles: true }));
  }

  // The paper layout: a sheet's own furniture, which L-CAD-06 does not partition at all.
  entities.push({ key: next(), type: TYPE_TEXT, space: PAPER_SPACE, layer: "TITLEBLOCK", colour: CHANNELS as unknown as JsonValue, text: "S-101 GENERAL ARRANGEMENT", height: 3, points: [[5, 5]] as unknown as JsonValue });

  const insunits = INSUNITS[scenario];
  const graph: Record<string, JsonValue> = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { ...insunits } as unknown as JsonValue,
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: { min: [-100, -200], max: [1300, 40] }, strays_rejected: 0 },
      { name: PAPER_SPACE, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 },
    ] as unknown as JsonValue,
    dropped_layouts: [],
    entities: entities as unknown as JsonValue,
    derived: derived as unknown as JsonValue,
    block_attributes: [],
    counters: [],
  };

  return { scenario, json: JSON.stringify(graph), graph, insunits, clusters, noteKey };
}

/* ------------------------------------------------------------------ the acceptance's own reading */

/** The world position a bubble georeferences along its family's axis (L-CAD-07, per view). */
function positionOf(bubble: Bubble): number {
  return bubble.family === "letter" ? bubble.centre[0] : bubble.centre[1];
}

/**
 * The two bubbles a dimension's span matches: two ADJACENT positions of the family that
 * georeferences along that dimension's own axis, a gap apart that is the span within 0.1 unit
 * (riskNotes (4)). Null where the span matches no gap at all.
 *
 * Derived from the built artifact, never transcribed: a fixture that moves a bubble moves this.
 */
export function matchedBubblesOf(cluster: Cluster, dimension: Dimension): Bubble[] | null {
  const family = dimension.axis === "x" ? "letter" : "numeral";
  const members = cluster.bubbles.filter((bubble) => bubble.family === family).sort((left, right) => positionOf(left) - positionOf(right));
  for (let index = 1; index < members.length; index += 1) {
    const before = members[index - 1] as Bubble;
    const after = members[index] as Bubble;
    if (Math.abs(Math.abs(positionOf(after) - positionOf(before)) - dimension.span) <= GRID_MATCH_TOLERANCE) return [before, after];
  }
  return null;
}

/**
 * How far a dimension's span stands from the NEAREST gap between adjacent positions of the family
 * that georeferences its axis — the distance riskNotes (4) judges against GRID_MATCH_TOLERANCE.
 *
 * A case states with this how near a miss it staged: a span that misses every gap by miles proves
 * nothing about a reader that matches loosely, and one that misses by less than the tolerance is not
 * a miss at all.
 */
export function nearestGapMissOf(cluster: Cluster, dimension: Dimension): number {
  const family = dimension.axis === "x" ? "letter" : "numeral";
  const members = cluster.bubbles.filter((bubble) => bubble.family === family).sort((left, right) => positionOf(left) - positionOf(right));
  const misses = members.slice(1).map((after, index) => Math.abs(Math.abs(positionOf(after) - positionOf(members[index] as Bubble)) - dimension.span));
  expect(misses.length, `the family georeferencing ${dimension.axis} draws at least two positions, so there is a gap to compare against at all`).toBeGreaterThan(0);
  return Math.min(...misses);
}

/**
 * The bubbles of the family that georeferences a dimension's own axis which its match does NOT fall
 * between — everything a grid-spacing match may not cite for it (riskNotes (4)).
 *
 * Derived from the same comparison the match itself is derived by, so a fixture that moves a bubble
 * moves both sides of the judgement at once (B-19).
 */
export function unmatchedBubblesOf(cluster: Cluster, dimension: Dimension): Bubble[] {
  const family = dimension.axis === "x" ? "letter" : "numeral";
  const matched = new Set((matchedBubblesOf(cluster, dimension) ?? []).map((bubble) => bubble.key));
  return cluster.bubbles.filter((bubble) => bubble.family === family && !matched.has(bubble.key));
}

/**
 * The factor one dimension states, in metres per drawing unit: what its text says divided by what it
 * really spans, carried into metres by the header's own unit (riskNotes (1), (2), (3)).
 */
export function factorOf(dimension: Dimension, unit: string): string {
  const metres = METRES_PER[unit];
  expect(metres, `the staged header spells ${unit}, which this stage carries a whole-number metre ratio for`).toBeTruthy();
  const held = metres as { numerator: bigint; denominator: bigint };
  return ratio12(BigInt(dimension.stated) * held.numerator, BigInt(dimension.span) * held.denominator);
}

/* ------------------------------------------------------------------ staging a drawing to partition */

/** A drawing of a built artifact, recorded by the shipped ingest pipeline and partitioned. */
export type StagedScale = { drawing: StagedDrawing; ingestId: string; artifact: BuiltScaleArtifact };

/**
 * A recorded drawing whose ingest artifact is the built one, partitioned by the shipped job: the
 * bytes are seeded into the store and the shipped ingest job runs over a stand-in CLI that hands
 * back the artifact, so what lands is a real `ingests` row written by the product's own pipeline
 * (B-17 — the staging the stored partition's own suites do).
 */
export async function stageScaleIngest(person: Person, projectId: string, scenario: ScaleScenario, salt: number): Promise<StagedScale> {
  const job = await productModule<{ runIngestJob: (payload: unknown, progress: ProgressLike, deps: { storage: unknown }) => Promise<void> }>(INGEST_JOB_MODULE);
  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(INGEST_MODULE);

  const artifact = buildScaleArtifact(scenario, salt);
  const bytes = new TextEncoder().encode(`0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; ${scenario} ${salt}\n`);
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
  expect(record, `staging ${scenario} left no ingest record — a scale is a reading of a record`).not.toBeNull();
  const staged = { drawing, ingestId: (record as { ingestId: string }).ingestId, artifact };
  await runScalePartition(person, staged, scenario);
  return staged;
}

/** One run of the shipped partition job over a staged ingest, with the steps it recorded. */
export async function runScalePartition(person: Person, staged: StagedScale, label = "scale"): Promise<StepRecord[]> {
  const rebuild = await rebuildDoor();
  const sink = stepSink(label);
  await rebuild.runPartitionJob(
    { tenantId: person.tenantId, drawingId: staged.drawing.drawingId, ingestId: staged.ingestId, requestedBy: person.userId },
    sink.progress,
    { storage: await storageOf() },
  );
  return sink.steps;
}

/**
 * The view one original entity landed in, read out of the partition the product itself wrote. A view
 * is named here by something drawn in it rather than by a key shape typed out, so the acceptance
 * follows the partition instead of restating how it composes a key (B-19).
 */
export function viewKeyHolding(person: Person, staged: StagedScale, entityKey: string): string {
  const rows = viewAssignmentRows(person.tenantId, staged.ingestId).filter((row) => row.entityKey === entityKey);
  expect(rows.length, `the partition assigned ${entityKey} to exactly one view (L-CAD-06 is total over model space)`).toBe(1);
  return (rows[0] as { viewKey: string }).viewKey;
}

/** The view each cluster of a staged artifact was partitioned into, in the order they were drawn. */
export function viewKeysOf(person: Person, staged: StagedScale): string[] {
  return staged.artifact.clusters.map((cluster) => viewKeyHolding(person, staged, cluster.captionKey));
}

/* ------------------------------------------------------------------ reading the door */

/** The scope every door of the takeoff lane is asked in. */
export function scopeOf(person: Person, projectId: string, staged: StagedScale): { tenantId: string; projectId: string; drawingId: string } {
  return { tenantId: person.tenantId, projectId, drawingId: staged.drawing.drawingId };
}

/** A field under either the door's spelling or the column's (C-05: response shapes are free). */
function field(row: Record<string, unknown>, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake];
}

/**
 * What the door answered for one view, whether it answers a list of views or a map keyed by view.
 * The shape of a row is nobody's contract (C-05); that an answer stands for the view is.
 */
export function answerFor(answered: unknown, viewKey: string): ScaleAnswer {
  if (Array.isArray(answered)) {
    const found = (answered as Record<string, unknown>[]).filter((row) => String(field(row, "viewKey", "view_key") ?? "") === viewKey);
    expect(found.length, `the door answers exactly one scale reading for the view ${viewKey}`).toBe(1);
    return found[0] as ScaleAnswer;
  }
  const held = (answered ?? {}) as Record<string, unknown>;
  const byKey = held[viewKey];
  expect(byKey, `the door answers a scale reading for the view ${viewKey} — membership is positive, and a view it says nothing about is silence (L-MEA-05)`).toBeTruthy();
  return byKey as ScaleAnswer;
}

/** The proposals of one answer, in the order the door put them in. */
export function proposalsOf(answer: ScaleAnswer): ProposalRow[] {
  const held = answer.proposals;
  expect(Array.isArray(held), "a view's `proposals` are a list, ranked (R-TO-020)").toBe(true);
  return (held as Record<string, unknown>[]).map((row) => ({
    ...row,
    rank: String(row["rank"] ?? ""),
    factorX: String(field(row, "factorX", "factor_x") ?? ""),
    factorY: String(field(row, "factorY", "factor_y") ?? ""),
    evidence: ((field(row, "evidence", "evidence") ?? []) as unknown[]).map((entry) => String(entry)),
  }));
}

/** One answer's affirmed calibration, read under the names the test contract fixes for it. */
export function affirmedOf(answer: ScaleAnswer): AffirmedRow | null {
  const held = answer.affirmed;
  if (held === null || held === undefined) return null;
  const row = held as Record<string, unknown>;
  return {
    ...row,
    calibrationKey: String(field(row, "calibrationKey", "calibration_key") ?? ""),
    rank: String(row["rank"] ?? ""),
    factorX: String(field(row, "factorX", "factor_x") ?? ""),
    factorY: String(field(row, "factorY", "factor_y") ?? ""),
    actId: String(field(row, "actId", "act_id") ?? ""),
    anisotropy: row["anisotropy"] === null || row["anisotropy"] === undefined ? undefined : String(row["anisotropy"]),
    placeable: row["placeable"] as boolean | undefined,
  };
}

/* ------------------------------------------------------------------ the act */

/** One point of a QS observation: the key it cites, and where it was taken (increment interfaces). */
export type CitedPointInput = { sourceKey: string; x: string; y: string };

/** One two-point observation, as the act is given one. */
export type ObservationInput = { points: [CitedPointInput, CitedPointInput]; distance: { value: string; unit: string }; distanceBasis: string };

/** A cited point on the 0.1 lattice. */
export function citedPoint(sourceKey: string, x: string, y: string): CitedPointInput {
  return { sourceKey, x, y };
}

/** One observation: two cited points, and the distance a person ENTERED between them. */
export function observation(from: CitedPointInput, to: CitedPointInput, distance: { value: string; unit: string }): ObservationInput {
  return { points: [from, to], distance, distanceBasis: ENTERED };
}

/**
 * What one affirmation asks for: the project, the drawing, the rank it stands on, the views it names
 * (one scale group — L-MEA-05) and, at rank QS_TWO_POINT, the observations it stands on.
 *
 * The named views ride under both published spellings, equal by construction, so the door reads them
 * under whichever the interfaces spell — the acceptance is grading the law, not a field name.
 */
export function affirming(o: {
  projectId: string;
  drawingId: string;
  rank: string;
  viewKeys: readonly string[];
  observations?: readonly ObservationInput[];
}): Record<string, unknown> {
  return {
    type: AFFIRM_SCALE,
    projectId: o.projectId,
    drawingId: o.drawingId,
    rank: o.rank,
    viewKeys: [...o.viewKeys],
    views: [...o.viewKeys],
    observations: [...(o.observations ?? [])],
  };
}

/* ------------------------------------------------------------------ reading the store */

/**
 * Every row of one table in one workspace, as JSON — hex-encoded across psql so no value of a row
 * can be mistaken for the field separator. Read whole rather than column by column: what a criterion
 * states is that a row CARRIES a fact, and the column it is spelled in is the migration's business.
 */
export function rowsOf(table: string, tenantId: string): Record<string, unknown>[] {
  return sql(
    `select encode(convert_to(row_to_json(t)::text, 'UTF8'), 'hex') from ${ident(table)} t
      where t.${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid;`,
  ).map((row) => JSON.parse(Buffer.from(row[0] ?? "", "hex").toString("utf8")) as Record<string, unknown>);
}

/** Every string a row carries, arrays flattened — what the row says, whatever it spells it under. */
export function saidBy(row: Record<string, unknown>): string[] {
  const said: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") said.push(value);
    else if (typeof value === "number" || typeof value === "boolean") said.push(String(value));
    else if (Array.isArray(value)) for (const entry of value) walk(entry);
    else if (value !== null && typeof value === "object") for (const entry of Object.values(value)) walk(entry);
  };
  walk(row);
  return said;
}

/** The rows of a table that name this act — however the table spells the column it names it in. */
export function rowsNaming(table: string, tenantId: string, actId: string): Record<string, unknown>[] {
  return rowsOf(table, tenantId).filter((row) => saidBy(row).includes(actId));
}

/** How many rows of a table this workspace holds at all. */
export function rowsHeld(table: string, tenantId: string): number {
  return rowsOf(table, tenantId).length;
}

// RECORD_MANUAL_MEASUREMENT (R-TO-040, L-ACT-03's "manual measurement acts" under MEASURE), rendered as
// L-ACT-02's pair — docs/design/s-measure.md, I-373 … I-387, I-495.
//
// A QS traced an outline, a run or a set of points on one view of a sheet, under a condition's recipe.
// The act registers ONE register row for it — a markless key derived from what was traced (I-378),
// through the register's own door (`registerSightingsIn`, I-495) — and records the measurement
// beside it: the recipe as applied, the geometry as the act judged each point of it, and the scale it
// was measured at. It writes no quantity line: results are offers to the gate, published by the
// campaign's measure run (R-TO-040, I-384).
//
// Nothing the viewer states is taken on its word. The act reads, on its own transaction, the campaign,
// the pinned set, the sheet's discipline, the view and its scale, the drawing's own geometry and the
// hand measurements already standing, and it refuses by name where a measurement cannot stand:
// no campaign, a condition the project's chest does not hold standing, a sheet outside the pinned
// set, an unconfirmed discipline, a kind another discipline states, a view that draws no scope, a view with no scale of record, a unit the bill does not
// convert, no level, a point off the view, a degenerate geometry, an edit of a measurement that no
// longer stands, a second measurement of one scope, a cell the product already measures, a cell
// measured on another view, and ground another measurement already covers.
//
// An edit is a new act naming the standing measurement it replaces (I-379): its key carries that
// predecessor, and in the same transaction the predecessor's register row is repudiated. A delete is
// REPUDIATE. A trace whose own key stands repudiated succeeds it, so delete-then-re-trace works.
import { KIND_DISCIPLINE } from "../catalogue/maps";
import { BEARS } from "../catalogue/bears";
import { isFoundationClass } from "../catalogue/level-basis";
import { editionOf } from "../campaigns";
import { and, campaigns, drawingSetRevisions, eq, grids, viewAssignments, type TenantTx } from "../db";
import { REFUSALS, type RefusalCode } from "../errors";
import { artifactAt } from "../entitygraph/artifact";
import type { EntityGraph } from "../entitygraph/schema";
import { refusal } from "../faults/refusal-marker";
import { judgeOffer, type MeasuredUnder } from "../gate/evaluate";
import { levelSegment, viewKey as viewKeyOf } from "../identity";
import { liveLevelsOf } from "../levels/store";
import { manualIdentityOf, manualViewRef } from "../manual/identity";
import {
  HAND_LEVEL_SLOT,
  NO_SCOPE_VIEW_CLASSES,
  degenerateReason,
  figureOf,
  figureUnitOf,
  geometryBasis,
  mapPoints,
  normalisedGeometry,
  pointCountOf,
  type HandLevel,
  type JudgedPoint,
  type MeasuredGeometry,
  type Recipe,
  type RecipeReading,
  type StatedGeometry,
  type StatedPoint,
} from "../manual/law";
import { cellKeyOf, cellsOf, collisionOf, type Footprint } from "../manual/overlap";
import { extentOf, judgePoint, type DrawingFacts, type DrawnPath, type DrawnShape, type GridAxisLine } from "../manual/snaps";
import { junctionFactsIn, manualOffersOf } from "../manual/offer";
import { conditionIn, linesOfCampaignIn, measurementsIn, recordMeasurementIn, type ConditionStanding, type LineOfCell, type StoredMeasurement } from "../manual/store";
import { drawnUnitOf, snapReachOf } from "../manual/units";
import { readsAsANumber, registerScopeIn, registerSightingIn, repudiateObjectIn, repudiatedObjectsIn, type RegisterScope } from "../register/store";
import { affirmationsOfRecord } from "../scale/store";
import { scaleTolerancesOf } from "../scale/tolerances";
import { confirmationsOf, projectDrawingsOf, sheetIdOf, type SheetSourceRecord } from "../sheets";
import type { Discipline } from "../sheets/law";
import { recordOf, type ManifestMember } from "../sets";
import { parseSourceKey } from "../sources";
import { appStorage } from "../storage/app";
import type { Unit } from "../units/canon";
import { viewRecordsOf, type ViewRecord } from "../views";
import { canonical, type Consequence, type ConsequenceMeasurement, type ConsequenceSubject, type OfferedFigure } from "./consequence";
import { actChangesNothing } from "./refusals";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const RECORD_MANUAL_MEASUREMENT = "RECORD_MANUAL_MEASUREMENT" as const;

/** How a register object stands before the act, and how it stands after — the words the card shows. */
const REGISTERED = "REGISTERED";
const REPUDIATED = "REPUDIATED";

/** The standing a hand row is registered at (I-387): a person saw the scope on the drawing. */
const MEASURED = "MEASURED";

/** The codes this act answers with, read off the closed taxonomy rather than agreed with by chance (Q-07). */
const PARTITION_NOT_AVAILABLE: RefusalCode = REFUSALS.PARTITION_NOT_AVAILABLE.code;
const VIEW_SCALE_UNAFFIRMED: RefusalCode = REFUSALS.VIEW_SCALE_UNAFFIRMED.code;
const DUPLICATE_IDENTITY: RefusalCode = REFUSALS.DUPLICATE_IDENTITY.code;
const READING_NOT_NUMERIC: RefusalCode = REFUSALS.READING_NOT_NUMERIC.code;

/**
 * The act's input: which project, drawing, sheet and view the QS measured on; the recipe they applied;
 * the level they stated; the geometry they traced, each point with the source keys it was snapped
 * on; and — for an edit — the standing measurement it replaces.
 */
export type RecordManualMeasurementInput = {
  readonly type: typeof RECORD_MANUAL_MEASUREMENT;
  readonly projectId: string;
  /** The drawing revision measured on — the row the pinned manifest cites as a revision. */
  readonly drawingId: string;
  /** The sheet, and the coordinate space its points are in: `model`, or a paper layout's name. */
  readonly layoutName: string;
  /** The partition's own key for the view the QS measured on. */
  readonly viewKey: string;
  readonly recipe: Recipe;
  /** A live level of the stack, the FOUNDATION slot, or nothing yet (refused, I-377). */
  readonly level: { readonly levelId: string } | { readonly slot: string } | null;
  readonly geometry: StatedGeometry;
  /** The object key of the standing measurement this edit replaces, or null for a new one (I-379). */
  readonly replaces: string | null;
};

/* ------------------------------------------------------------------ the reads the act judges over */

/**
 * Everything the act reads, as one port: the act's own transaction answers it in production, and a
 * test answers it from a stage in memory, so the judgement below is proved by name without a store.
 */
export type ManualReader = {
  /** The campaign standing on the project now, and the register scope it opens (L-REG-07). */
  campaign(): Promise<{ readonly scope: RegisterScope; readonly campaignId: string } | null>;
  /** The condition the project's chest holds under an id, standing or retired, or null where it holds none (I-374). */
  condition(conditionId: string): Promise<ConditionStanding | null>;
  /** The pinned revision's manifest (L-REG-06). */
  manifest(setRevisionId: string): Promise<readonly ManifestMember[]>;
  /** The ingest record that stands for one drawing revision of the project, or null where none does. */
  record(drawingId: string): Promise<SheetSourceRecord | null>;
  views(ingestId: string): Promise<readonly ViewRecord[]>;
  /** The discipline a person confirmed for one sheet, the newest confirmation first (L-REG-03). */
  sheetDiscipline(ingestId: string, layoutName: string): Promise<Discipline | null>;
  /** The scale of record one view stands under (L-MEA-05), or null where no act affirmed one. */
  calibration(ingestId: string, partitionViewKey: string): Promise<{ readonly factorX: string; readonly factorY: string; readonly calibrationKey: string } | null>;
  /** The edition's scale-verification tolerance (L-MEA-05). */
  tolerance(): Promise<string>;
  /** The drawing's own geometry, the partition's assignments and the grid, for judging points (I-387). */
  drawingFacts(record: SheetSourceRecord): Promise<DrawingFacts>;
  /** The live levels of the project's stack, by surrogate (L-MEA-07). */
  liveLevels(): Promise<ReadonlySet<string>>;
  /** Every hand measurement of the revision, standing or not. */
  measurements(scope: RegisterScope): Promise<readonly StoredMeasurement[]>;
  /** Every object of the revision a person has struck (L-ACT-01). */
  repudiated(scope: RegisterScope): Promise<ReadonlySet<string>>;
  /** Every line the campaign published, with its object's level. */
  lines(scope: RegisterScope, campaignId: string): Promise<readonly LineOfCell[]>;
};

/** The reads, answered on the act's own transaction — so the Consequence is judged against the state its write lands in (L-ACT-02). */
export function readerOn(ctx: ActorCtx, projectId: string, tx: TenantTx): ManualReader {
  const project = { tenantId: ctx.tenantId, projectId };
  return {
    async campaign() {
      const scope = await registerScopeIn(tx, ctx.tenantId, projectId);
      if (scope === null) return null;
      const held = await tx
        .select({ campaignId: campaigns.campaignId })
        .from(campaigns)
        .where(and(eq(campaigns.tenantId, ctx.tenantId), eq(campaigns.setRevisionId, scope.setRevisionId)))
        .limit(1);
      const campaignId = held[0]?.campaignId;
      return campaignId === undefined ? null : { scope, campaignId };
    },
    condition: (conditionId) => conditionIn(tx, project, conditionId),
    async manifest(setRevisionId) {
      const rows = await tx
        .select()
        .from(drawingSetRevisions)
        .where(and(eq(drawingSetRevisions.tenantId, ctx.tenantId), eq(drawingSetRevisions.setRevisionId, setRevisionId)))
        .limit(1);
      const row = rows[0];
      return row === undefined ? [] : recordOf(row).manifest;
    },
    async record(drawingId) {
      const drawings = await projectDrawingsOf(tx, project);
      return drawings.find((drawing) => drawing.drawingId === drawingId)?.record ?? null;
    },
    views: (ingestId) => viewRecordsOf(tx, { tenantId: ctx.tenantId, ingestId }),
    async sheetDiscipline(ingestId, layoutName) {
      const sheetId = sheetIdOf(ingestId, layoutName);
      // Newest first: a sheet re-confirmed stands at its latest confirmation (L-REG-03).
      return (await confirmationsOf(tx, project)).find((confirmation) => confirmation.sheetId === sheetId)?.discipline ?? null;
    },
    async calibration(ingestId, partitionViewKey) {
      const standing = (await affirmationsOfRecord(tx, { tenantId: ctx.tenantId, ingestId })).get(partitionViewKey);
      return standing === undefined ? null : { factorX: standing.factorX, factorY: standing.factorY, calibrationKey: standing.calibrationKey };
    },
    tolerance: async () => (await scaleTolerancesOf(project)).verification,
    async drawingFacts(record) {
      const graph = await artifactAt(ctx.tenantId, record.artifactSha256, appStorage(), `ingest ${record.ingestId}`);
      const assigned = await tx
        .select({ entityKey: viewAssignments.entityKey, viewKey: viewAssignments.viewKey })
        .from(viewAssignments)
        .where(and(eq(viewAssignments.tenantId, ctx.tenantId), eq(viewAssignments.ingestId, record.ingestId)));
      const axes = await tx
        .select({ bubbleKey: grids.bubbleKey, viewKey: grids.viewKey, axis: grids.axis, position: grids.position })
        .from(grids)
        .where(and(eq(grids.tenantId, ctx.tenantId), eq(grids.ingestId, record.ingestId)));
      return {
        shapes: shapesOf(graph),
        assigned: new Map(assigned.map((row) => [row.entityKey, row.viewKey])),
        axes: new Map(axes.map((row) => [row.bubbleKey, { viewKey: row.viewKey, axis: row.axis, position: row.position } satisfies GridAxisLine])),
      };
    },
    liveLevels: async () => new Set((await liveLevelsOf(tx, project)).map((level) => level.levelId)),
    measurements: (scope) => measurementsIn(tx, scope),
    repudiated: async (scope) => new Set((await repudiatedObjectsIn(tx, scope)).map((row) => row.objectKey)),
    lines: (scope, campaignId) => linesOfCampaignIn(tx, scope, campaignId),
  };
}

/**
 * Every drawn thing of an artifact, by source key: an original's own points, and the paint that names
 * it as `src` (a dimension, an exploded block) merged under the original's key (L-CAD-03).
 */
function shapesOf(graph: EntityGraph): Map<string, DrawnShape> {
  const shapes = new Map<string, { space: string; paths: DrawnPath[] }>();
  const pathOf = (record: { readonly points?: readonly (readonly [number, number])[] | undefined; readonly closed?: boolean | undefined }): DrawnPath | null =>
    record.points === undefined || record.points.length === 0 ? null : { points: record.points, closed: record.closed === true };
  for (const entity of graph.entities) {
    const path = pathOf(entity);
    shapes.set(entity.key, { space: entity.space, paths: path === null ? [] : [path] });
  }
  for (const paint of graph.derived) {
    const path = pathOf(paint);
    const held = shapes.get(paint.src);
    if (path !== null && held !== undefined) held.paths.push(path);
  }
  return shapes;
}

/* ------------------------------------------------------------------ the judgement */

/** What the act would do, derived from the state the reader answered (L-ACT-02). */
export type Derived = {
  readonly scope: RegisterScope;
  /** The campaign the measurement stands in (L-REG-07). */
  readonly campaignId: string;
  readonly discipline: Discipline;
  readonly ingestId: string;
  readonly mark: string;
  readonly view: { readonly viewClass: string; readonly captionAnchorSourceKey: string };
  readonly x: number;
  readonly y: number;
  readonly level: HandLevel;
  readonly drawnUnit: Unit;
  readonly figureUnit: Unit;
  readonly recipe: Recipe;
  readonly predecessor: StoredMeasurement | null;
  readonly measurement: ConsequenceMeasurement;
};

/** A refusal this act answers, carrying the act type and the facts the card's evidence link needs (I-40). */
function refused<D extends object>(code: RefusalCode, detail: string, facts: D): Error {
  return refusal(code, detail, { actType: RECORD_MANUAL_MEASUREMENT, ...facts });
}

/** A kind the class does not bear is a statement no lawful condition makes (the chest refuses it, R-TO-041). */
function requireBorne(recipe: Recipe): void {
  for (const { kind } of recipe.kinds) {
    if (!BEARS.some((row) => row.class === recipe.elementClass && row.kind === kind)) {
      throw new Error(`a ${recipe.elementClass} bears no ${kind}, so no recipe measures it (L-MEA-04) — the condition that stated it was never lawful`);
    }
  }
  if (recipe.kinds.length === 0) throw new Error("a recipe that measures no kind measures nothing (R-TO-041)");
}

/**
 * The readings a recipe applies, as the act records them (I-374): a figure that is no number is
 * refused by name; a reading claiming to be TRANSCRIBED from a note the drawing does not hold is
 * demoted to ENTERED — a claim the act cannot reproduce makes a reading weaker, never stronger.
 */
function judgedReadings(readings: readonly RecipeReading[], facts: DrawingFacts): RecipeReading[] {
  return readings.map((reading) => {
    if (!readsAsANumber(reading.valueAsWritten)) {
      throw refused(READING_NOT_NUMERIC, `the recipe's ${reading.attribute} reads "${reading.valueAsWritten}", which states no number`, { attribute: reading.attribute });
    }
    if (reading.basis !== "TRANSCRIBED") return { ...reading, sourceKey: null };
    const cited = reading.sourceKey === null ? null : parseSourceKey(reading.sourceKey);
    if (cited === null || !facts.shapes.has(cited)) return { ...reading, basis: "ENTERED", sourceKey: null };
    return reading;
  });
}

/**
 * The level a measurement stands at, as a register level (I-377). A foundation class stands in the
 * lawful-null FOUNDATION slot whatever was stated — L-CAD-07's level basis, the slot the placement
 * stands a drawn one in, so a hand footing and the machine's meet in one cell (I-382) — and the card
 * shows it before the person confirms. Any other class stands on a live level of the stack the person
 * stated: none, the UNRESOLVED slot (I-368), a level the stack no longer holds, or the FOUNDATION slot
 * for a class that stands on a storey is no level it can be billed by.
 */
function statedLevel(input: RecordManualMeasurementInput, live: ReadonlySet<string>): HandLevel {
  if (isFoundationClass(input.recipe.elementClass)) return { slot: HAND_LEVEL_SLOT };
  const level = input.level;
  if (level !== null && "levelId" in level && live.has(level.levelId)) return { levelId: level.levelId };
  throw refused(REFUSALS.MANUAL_LEVEL_UNSTATED.code, `a ${input.recipe.elementClass} stands on a level of the stack, and the measurement names none it holds (I-377, I-368)`, {
    level: input.level,
  });
}

/** Two recipes and geometries that say the same thing — an edit that would change nothing (L-ACT-01). */
function sameMeasurement(a: { recipe: Recipe; traced: MeasuredGeometry; level: string; viewKey: string; space: string }, b: StoredMeasurement): boolean {
  return (
    canonical(a.recipe) === canonical(b.recipe) &&
    canonical(normalisedGeometry(a.traced)) === canonical(normalisedGeometry(b.traced)) &&
    a.level === b.level &&
    a.viewKey === b.viewKey &&
    a.space === b.space
  );
}

/**
 * The act, judged against what the reader answered. Every refusal is answered in the order the card
 * says its preconditions (s-measure §3), then the geometry, then the guards against what already
 * stands — and each by its registered name.
 */
export async function deriveMeasurement(input: RecordManualMeasurementInput, reader: ManualReader): Promise<Derived> {
  requireBorne(input.recipe);
  if (input.geometry.geometry !== input.recipe.geometry) {
    throw new Error(`the recipe measures a ${input.recipe.geometry} and the trace is a ${input.geometry.geometry} — the tool arms the condition's own geometry (I-374)`);
  }

  const opened = await reader.campaign();
  if (opened === null) throw refused(REFUSALS.MANUAL_NO_CAMPAIGN.code, `project ${input.projectId} has no campaign open`, { projectId: input.projectId });
  const { scope, campaignId } = opened;

  // The recipe's condition, where it names one, stands in this project's chest (I-374): the store's
  // key would otherwise answer a condition it does not hold with a fault, not a name.
  const conditionId = input.recipe.conditionId;
  if (conditionId !== null) {
    const condition = await reader.condition(conditionId);
    if (condition === null || condition.retired) {
      throw refused(REFUSALS.MANUAL_CONDITION_NOT_STANDING.code, `condition ${conditionId} ${condition === null ? "is not in this project's chest" : "was retired"}`, { conditionId });
    }
  }

  const member = (await reader.manifest(scope.setRevisionId)).find((cited) => cited.revisionId === input.drawingId);
  if (member === undefined) {
    throw refused(REFUSALS.MANUAL_SHEET_NOT_PINNED.code, `drawing ${input.drawingId} is not a revision the pinned set ${scope.setRevisionId} cites`, { drawingId: input.drawingId });
  }

  const record = await reader.record(input.drawingId);
  if (record === null) throw refused(PARTITION_NOT_AVAILABLE, `drawing ${input.drawingId} has no ingest record, so it has no views to measure on`, { drawingId: input.drawingId });
  const view = (await reader.views(record.ingestId)).find((candidate) => candidate.viewKey === input.viewKey);
  if (view === undefined) throw refused(PARTITION_NOT_AVAILABLE, `the partition of drawing ${input.drawingId} holds no view ${input.viewKey}`, { drawingId: input.drawingId, viewKey: input.viewKey });
  const viewClass = view.confirmed?.type ?? view.type;
  if (NO_SCOPE_VIEW_CLASSES.includes(viewClass)) {
    throw refused(REFUSALS.MANUAL_VIEW_DRAWS_NO_SCOPE.code, `${input.viewKey} is a ${viewClass}, which draws no scope (I-375)`, { viewKey: input.viewKey, viewClass });
  }

  const discipline = await reader.sheetDiscipline(record.ingestId, input.layoutName);
  if (discipline === null) {
    throw refused(REFUSALS.MANUAL_DISCIPLINE_UNCONFIRMED.code, `nobody confirmed the discipline of sheet ${input.layoutName} of drawing ${input.drawingId}`, { drawingId: input.drawingId, layoutName: input.layoutName });
  }
  for (const { kind } of input.recipe.kinds) {
    if (KIND_DISCIPLINE[kind] !== discipline) {
      throw refused(REFUSALS.MANUAL_KIND_NOT_THIS_DISCIPLINE.code, `${kind} is stated by the ${KIND_DISCIPLINE[kind]} set, and this sheet is ${discipline}`, { kind, discipline: KIND_DISCIPLINE[kind] });
    }
  }

  const calibration = await reader.calibration(record.ingestId, view.viewKey);
  if (calibration === null) throw refused(VIEW_SCALE_UNAFFIRMED, `${view.viewKey} has no scale of record`, { viewKey: view.viewKey });
  const drawnUnit = drawnUnitOf(calibration, await reader.tolerance());
  const figureUnit = drawnUnit === null ? null : figureUnitOf(input.recipe.geometry, drawnUnit);
  if (drawnUnit === null || figureUnit === null) {
    throw refused(REFUSALS.MANUAL_UNIT_NOT_CONVERTIBLE.code, `${view.viewKey} is affirmed at ${calibration.factorX} × ${calibration.factorY} m per unit, which is full size in no unit the bill converts`, {
      viewKey: view.viewKey,
      factorX: calibration.factorX,
      factorY: calibration.factorY,
    });
  }

  const level = statedLevel(input, await reader.liveLevels());

  // Each point, judged against the drawing itself (I-387, I-375).
  const facts = await reader.drawingFacts(record);
  const named = { viewKey: view.viewKey, space: input.layoutName, extent: extentOf(facts, { viewKey: view.viewKey, space: input.layoutName }), reach: snapReachOf(drawnUnit) };
  let demoted = 0;
  const judged = mapPoints<StatedPoint, JudgedPoint>(input.geometry, (point) => {
    const verdict = judgePoint(point, facts, named);
    if (verdict.judged === undefined) {
      throw refused(REFUSALS.MANUAL_RING_OFF_VIEW.code, `${verdict.offView} — every point stands in ${view.viewKey}`, { viewKey: view.viewKey });
    }
    if (verdict.demoted) demoted += 1;
    return verdict.judged;
  });
  const traced = normalisedGeometry(judged);
  const degenerate = degenerateReason(traced);
  if (degenerate !== null) throw refused(REFUSALS.MANUAL_GEOMETRY_DEGENERATE.code, degenerate, { geometry: traced.geometry });
  const recipe: Recipe = { ...input.recipe, readings: judgedReadings(input.recipe.readings, facts) };

  // What already stands in the revision: the hand measurements, and the objects a person struck.
  const measured = await reader.measurements(scope);
  const struck = await reader.repudiated(scope);
  const standing = measured.filter((row) => !struck.has(row.objectKey));
  const registerView = manualViewRef({ viewClass: view.type, anchorKey: view.anchorKey }, member.sha256);
  const viewKey = viewKeyOf(registerView);
  const levelKey = levelSegment(level);

  let predecessor: StoredMeasurement | null = null;
  if (input.replaces !== null) {
    predecessor = standing.find((row) => row.objectKey === input.replaces) ?? null;
    if (predecessor === null) {
      throw refused(REFUSALS.MANUAL_PREDECESSOR_NOT_STANDING.code, `${input.replaces} is no standing hand measurement of this revision`, { objectKey: input.replaces });
    }
    if (sameMeasurement({ recipe, traced, level: levelKey, viewKey, space: input.layoutName }, predecessor)) throw actChangesNothing(RECORD_MANUAL_MEASUREMENT, [predecessor.objectKey]);
  }

  // The key: a trace whose key stands repudiated succeeds it, and so on until a key is free (I-379);
  // a key that stands un-repudiated is a real second measurement of one scope (L-REG-03).
  const held = new Set(measured.map((row) => row.objectKey));
  let supersedes = input.replaces;
  let identity = manualIdentityOf({ elementClass: recipe.elementClass, kinds: recipe.kinds.map((entry) => entry.kind), geometry: traced, space: input.layoutName, supersedes }, registerView, level);
  for (let hop = 0; held.has(identity.objectKey); hop += 1) {
    if (!struck.has(identity.objectKey) || hop > measured.length) {
      throw refused(DUPLICATE_IDENTITY, `${identity.objectKey} is already measured in this revision`, { objectKey: identity.objectKey });
    }
    supersedes = identity.objectKey;
    identity = manualIdentityOf({ elementClass: recipe.elementClass, kinds: recipe.kinds.map((entry) => entry.kind), geometry: traced, space: input.layoutName, supersedes }, registerView, level);
  }

  // Machine against hand, at cell grain (I-382): a cell the product measures is not measured by hand.
  const handKeys = new Set(measured.map((row) => row.objectKey));
  const claimed = new Set(cellsOf({ elementClass: recipe.elementClass, kinds: recipe.kinds.map((entry) => entry.kind), level: levelKey }));
  const machine = (await reader.lines(scope, campaignId)).find(
    (line) => line.level !== null && !handKeys.has(line.objectKey) && !struck.has(line.objectKey) && claimed.has(cellKeyOf(line.elementClass, line.kind, line.level)),
  );
  if (machine !== undefined) {
    throw refused(REFUSALS.MANUAL_CELL_MACHINE_MEASURED.code, `${machine.objectKey} already publishes ${machine.kind} in this cell`, { objectKey: machine.objectKey, kind: machine.kind });
  }

  // Hand against hand (I-380, I-381): the standing measurements, never the one this edit replaces.
  const candidate: Footprint = { objectKey: identity.objectKey, elementClass: recipe.elementClass, kinds: recipe.kinds.map((entry) => entry.kind), level: levelKey, viewKey, space: input.layoutName, geometry: traced };
  const others: Footprint[] = standing
    .filter((row) => row.objectKey !== predecessor?.objectKey)
    .map((row) => ({ objectKey: row.objectKey, elementClass: row.elementClass, kinds: row.kinds, level: row.level, viewKey: row.viewKey, space: row.space, geometry: row.traced }));
  const collision = collisionOf(candidate, others);
  if (collision?.collision === "other-view") {
    throw refused(REFUSALS.MANUAL_CELL_OTHER_VIEW.code, `${collision.other.objectKey} measures this cell on ${collision.other.viewKey}`, { objectKey: collision.other.objectKey, viewKey: collision.other.viewKey });
  }
  if (collision?.collision === "overlap") {
    throw refused(REFUSALS.MANUAL_OVERLAP.code, `${collision.other.objectKey} already measures some of this ground`, { objectKey: collision.other.objectKey });
  }

  return {
    scope,
    campaignId,
    discipline,
    ingestId: record.ingestId,
    mark: identity.mark,
    view: registerView,
    x: identity.x,
    y: identity.y,
    level,
    drawnUnit,
    figureUnit,
    recipe,
    predecessor,
    measurement: {
      objectKey: identity.objectKey,
      supersedes,
      replaces: predecessor?.objectKey ?? null,
      recipe,
      level,
      drawingId: input.drawingId,
      layoutName: input.layoutName,
      partitionViewKey: view.viewKey,
      viewKey,
      calibrationKey: calibration.calibrationKey,
      factorX: calibration.factorX,
      factorY: calibration.factorY,
      drawnUnit,
      figureUnit,
      traced,
      figure: figureOf(traced),
      basis: geometryBasis(traced),
      demoted,
    },
  };
}

/**
 * The judgement one transaction has already made of one statement. The seam's commit recomputes the
 * Consequence under the project's state lock and then hands the SAME statement to this act's commit
 * on the SAME transaction, with nothing written between (L-ACT-02) — so the second reading of the
 * drawing, the partition and every standing measurement would answer what the first did, and is
 * asked once. Keyed weakly by the transaction and the statement: a new transaction judges afresh.
 */
const judgedOn = new WeakMap<TenantTx, WeakMap<RecordManualMeasurementInput, Promise<Derived>>>();

/** The act's judgement of a statement on a transaction, made once per transaction and statement. */
function derivedOn(ctx: ActorCtx, input: RecordManualMeasurementInput, tx: TenantTx): Promise<Derived> {
  let byStatement = judgedOn.get(tx);
  if (byStatement === undefined) {
    byStatement = new WeakMap();
    judgedOn.set(tx, byStatement);
  }
  let derived = byStatement.get(input);
  if (derived === undefined) {
    derived = deriveMeasurement(input, readerOn(ctx, input.projectId, tx));
    byStatement.set(input, derived);
  }
  return derived;
}

/**
 * What the gate would answer for each kind of the measurement (s-measure I-373, I-384): the one offer
 * builder the campaign's run offers through, asked of the gate's own `judgeOffer` under the campaign's
 * edition, over the members the ring runs past as the run will read them. A kind the gate would refuse
 * — or a ring whose members cannot all be laid on it (I-389) — refuses the act by that name: a
 * measurement that could never publish is not recorded to sight its cell as though it might.
 */
async function offeredFiguresOf(ctx: ActorCtx, derived: Derived, tx: TenantTx): Promise<OfferedFigure[]> {
  const held = await tx
    .select({ campaignId: campaigns.campaignId, projectId: campaigns.projectId, setRevisionId: campaigns.setRevisionId, editionId: campaigns.editionId, editionDigest: campaigns.editionDigest })
    .from(campaigns)
    .where(and(eq(campaigns.tenantId, ctx.tenantId), eq(campaigns.campaignId, derived.campaignId)))
    .limit(1);
  const under: MeasuredUnder | undefined = held[0];
  if (under === undefined) throw refused(REFUSALS.MANUAL_NO_CAMPAIGN.code, `campaign ${derived.campaignId} is not held`, { campaignId: derived.campaignId });
  const edition = await editionOf(tx, ctx.tenantId, under.editionId);
  if (edition === null) throw new Error(`the campaign ${under.campaignId} cites the rule-set edition ${under.editionId}, which this workspace does not hold (L-REG-07)`);

  const m = derived.measurement;
  const hand = await measurementsIn(tx, derived.scope);
  // What this act strikes stands for nothing once it commits (I-379), as the run will read it.
  const struck = new Set([...(await repudiatedObjectsIn(tx, derived.scope)).map((row) => row.objectKey), ...(derived.predecessor === null ? [] : [derived.predecessor.objectKey])]);
  const junctions = await junctionFactsIn(
    tx,
    derived.scope,
    { elementClass: derived.recipe.elementClass, level: derived.level, ingestId: derived.ingestId, partitionViewKey: m.partitionViewKey, calibrationKey: m.calibrationKey },
    hand,
    struck,
  );
  const offerings = manualOffersOf(
    { objectKey: m.objectKey, setRevisionId: derived.scope.setRevisionId, actId: null, drawingId: m.drawingId, viewKey: m.viewKey, recipe: derived.recipe, traced: m.traced, figureUnit: derived.figureUnit, calibrationKey: m.calibrationKey, multiplier: "1", junctions },
    edition,
  );
  // The row this act would register, as the gate reads the register: where it stands.
  const registered = new Map([[m.objectKey, "levelId" in derived.level ? { levelSlot: null, levelId: derived.level.levelId } : { levelSlot: derived.level.slot, levelId: null }]]);
  return offerings.map((offering): OfferedFigure => {
    if (offering.state === "not-offered") return { kind: offering.kind, arm: "not-offered" };
    if (offering.state === "refused") throw refused(offering.code, `${offering.kind} cannot be offered: ${JSON.stringify(offering.detail)}`, { kind: offering.kind, ...offering.detail });
    const judgement = judgeOffer(offering.offer, under, edition, registered);
    switch (judgement.arm) {
      case "refused":
        throw refused(judgement.refusal.code, `the gate would refuse ${offering.kind} of ${m.objectKey}`, { kind: offering.kind });
      case "queued":
        return { kind: offering.kind, arm: "queued", cause: judgement.item.cause };
      case "published":
        return {
          kind: offering.kind,
          arm: "published",
          ruleId: judgement.line.ruleId,
          ruleVersion: judgement.line.ruleVersion,
          value: judgement.line.value ?? null,
          unit: judgement.line.unit,
          formula: judgement.line.formula,
          coverage: judgement.line.coverage ?? "COMPLETE",
          quantityBasis: judgement.line.quantityBasis,
        };
    }
  });
}

/** The preview's whole answer on one transaction, made once per transaction and statement (as `derivedOn`). */
const previewedOn = new WeakMap<TenantTx, WeakMap<RecordManualMeasurementInput, Promise<ConsequenceMeasurement>>>();

function measurementOn(ctx: ActorCtx, input: RecordManualMeasurementInput, tx: TenantTx): Promise<ConsequenceMeasurement> {
  let byStatement = previewedOn.get(tx);
  if (byStatement === undefined) {
    byStatement = new WeakMap();
    previewedOn.set(tx, byStatement);
  }
  let previewed = byStatement.get(input);
  if (previewed === undefined) {
    previewed = (async () => {
      const derived = await derivedOn(ctx, input, tx);
      return { ...derived.measurement, campaignId: derived.campaignId, offered: await offeredFiguresOf(ctx, derived, tx) };
    })();
    byStatement.set(input, previewed);
  }
  return previewed;
}

/** The subjects the act judges: the new register object, and the one an edit strikes. */
function subjectsOf(derived: Derived): ConsequenceSubject[] {
  const subjects: ConsequenceSubject[] = [{ subjectId: derived.measurement.objectKey, subjectLabel: derived.recipe.conditionName, before: [], after: [REGISTERED] }];
  if (derived.predecessor !== null) {
    subjects.push({ subjectId: derived.predecessor.objectKey, subjectLabel: derived.predecessor.conditionName, before: [REGISTERED], after: [REPUDIATED] });
  }
  return subjects;
}

export const recordManualMeasurement: ActRendering<RecordManualMeasurementInput> = {
  async preview(ctx: ActorCtx, input: RecordManualMeasurementInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derivedOn(ctx, input, tx);
    return {
      actType: RECORD_MANUAL_MEASUREMENT,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "MEASUREMENT",
      subjects: subjectsOf(derived),
      measurement: await measurementOn(ctx, input, tx),
    };
  },

  async commit(ctx: ActorCtx, input: RecordManualMeasurementInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const derived = await derivedOn(ctx, input, tx);
    const measurement = derived.measurement;

    // The register row, through the register's own door (I-495): the store's key is the guard.
    const answered = await registerSightingIn(tx, derived.scope, {
      discipline: derived.discipline,
      elementType: derived.recipe.elementClass,
      mark: derived.mark,
      view: derived.view,
      x: derived.x,
      y: derived.y,
      level: derived.level,
      standing: MEASURED,
      content: { recipe: derived.recipe, traced: measurement.traced, space: measurement.layoutName, supersedes: measurement.supersedes },
    });
    if (!answered.registered || answered.objectKey !== measurement.objectKey) {
      throw refused(DUPLICATE_IDENTITY, `${measurement.objectKey} was registered by another writer between the read and the write (${pointCountOf(measurement.traced)} points)`, { objectKey: answered.objectKey });
    }

    await recordMeasurementIn(tx, derived.scope, {
      objectKey: measurement.objectKey,
      actId: act.actId,
      drawingId: measurement.drawingId,
      ingestId: derived.ingestId,
      layoutName: measurement.layoutName,
      partitionViewKey: measurement.partitionViewKey,
      viewKey: measurement.viewKey,
      recipe: derived.recipe,
      level: derived.level,
      traced: measurement.traced,
      figure: measurement.figure,
      drawnUnit: derived.drawnUnit,
      figureUnit: derived.figureUnit,
      calibrationKey: measurement.calibrationKey,
      supersedes: measurement.supersedes,
    });

    // An edit strikes what it replaces, in this transaction (I-379): the bill withholds its lines.
    if (derived.predecessor !== null) await repudiateObjectIn(tx, derived.scope, derived.predecessor.objectKey, act.actId);
  },
};

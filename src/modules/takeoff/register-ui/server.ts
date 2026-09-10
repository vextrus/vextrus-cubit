// The register workspace's reading (R-TO-050, S-Takeoff): one project's pinned campaign, composed
// into the one value the screen renders.
//
// It composes rather than computes. What a register object IS and how an attribute stands are the
// register's own (`@/core/register/store`, `@/modules/takeoff/register`), what a campaign is open on
// a project is the campaigns seam's, and what stack a drawing proposes is the partition's — this
// file asks each of them once and lays the answers side by side (B-17, ARCH-02).
//
// Nothing here judges: a refused sighting and a deferred one are both stated, a repudiated object
// stands in the reading as REPUDIATED with every line it published still marked on it (I-173), and
// no figure is re-derived.
import { and, asc, drawingSetRevisions, eq, forTenant, quantityLines, queueItems, registerObservations } from "@/core/db";
import { campaignsOf } from "@/core/campaigns";
import { levelsOf } from "@/modules/takeoff/levels";
import { QUANTITY_BASES, type QuantityBasis } from "@/core/offers/law";
import { standingOf, type ObservationRow, type RegisterScope } from "@/core/register/store";
import { proposedLevelStackOf } from "@/modules/takeoff/partition";
import { refusedSightingsOf, registerObjectsOf, repudiatedObjectsOf } from "@/modules/takeoff/register";
import { citedKeysOf, sheetOfView, variablesOf } from "@/modules/takeoff/trace";
import type { RegisterView, ViewAttribute, ViewLevelStack, ViewLine, ViewObject, ViewReading, ViewRefusal } from "./view";

/** Which project's register is being read, in which workspace. */
export type RegisterViewScope = { readonly tenantId: string; readonly projectId: string };

/** The basis a queue item leaves an object standing on: interpreted, and uncorroborated (L-QTY-04). */
const INTERPRETED: QuantityBasis = "INTERPRETED";

/** The kind the offered level stack is keyed on (L-ACT-02's closed enum, `LevelStackGroupKey`). */
const PROPOSED_LEVEL_STACK = "PROPOSED_LEVEL_STACK" as const;

/** The corroboration states an object can be read at (R-TO-050's per-object attribute). */
const REPUDIATED = "REPUDIATED";
const SUSPENDED = "SUSPENDED";
const AGREED = "AGREED";
const NONE = "NONE";

/**
 * The weakest basis over a set, in the roster's own order — later is weaker (L-QTY-01's weakest-wins
 * roll-up, read off the roster rather than ranked a second time here, settled reading 1).
 */
function weakest(bases: readonly QuantityBasis[]): QuantityBasis | null {
  let held: QuantityBasis | null = null;
  for (const basis of bases) {
    if (held === null || QUANTITY_BASES.indexOf(basis) > QUANTITY_BASES.indexOf(held)) held = basis;
  }
  return held;
}

/** One stored reading, as the inspector shows one. */
function readingOf(row: ObservationRow): ViewReading {
  return {
    observationId: row.observationId,
    valueAsWritten: row.valueAsWritten,
    unitAsWritten: row.unitAsWritten,
    basis: row.basis,
    precedence: row.precedence,
    sourceKey: row.sourceKey,
  };
}

/**
 * How an object's readings corroborate, over all of its attributes: a person's judgement that the
 * object is nothing stands above everything, a disagreement anywhere suspends the object as it
 * suspends the attribute (R-TO-051: "disagreements suspend and show as such"), an object with a
 * settled reading is AGREED, and one nobody has read is NONE.
 */
function corroborationOf(attributes: readonly ViewAttribute[], repudiated: boolean): string {
  if (repudiated) return REPUDIATED;
  if (attributes.some((attribute) => attribute.standing === SUSPENDED)) return SUSPENDED;
  if (attributes.some((attribute) => attribute.standing === AGREED)) return AGREED;
  return NONE;
}

/**
 * The whole reading of one project's register (test contract: `registerViewOf`). A project with no
 * campaign open answers the empty reading rather than a fault: an absence is a state, and the screen
 * teaches the next action from it (R-UI-050).
 */
export async function registerViewOf(scope: RegisterViewScope): Promise<RegisterView> {
  const open = await campaignsOf(scope);
  const campaign = open[open.length - 1];
  if (campaign === undefined) {
    return { tenantId: scope.tenantId, projectId: scope.projectId, campaign: null, objects: [], lines: [], refusals: [], levelStacks: [] };
  }

  const registerScope: RegisterScope = { tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId: campaign.setRevisionId };
  const [objectRows, repudiatedRows, refusedRows, published, deferred, observations, levelRows, manifest] = await Promise.all([
    registerObjectsOf(registerScope),
    repudiatedObjectsOf(registerScope),
    refusedSightingsOf(registerScope),
    linesOfCampaign(scope.tenantId, campaign.campaignId),
    queuedOfCampaign(scope.tenantId, campaign.campaignId),
    observationsOfRevision(registerScope),
    levelsOf(scope),
    manifestOfRevision(scope.tenantId, campaign.setRevisionId),
  ]);

  const struck = new Set(repudiatedRows.map((row) => row.objectKey));
  const levelLabels = new Map(levelRows.map((level) => [level.levelId, level.label]));

  // Every input is already keyed by object key, so the composition below is keyed too: R-TO-050 asks
  // this table to hold 50 000 lines, and a scan per line over the objects (or per object over the
  // lines and the revision's readings) would price one page render in hundreds of millions of
  // comparisons. One pass each, then lookups.
  const objectByKey = new Map(objectRows.map((row) => [row.objectKey, row]));
  const queuedKeys = new Set(deferred.map((item) => item.objectKey));
  const observationsByObject = new Map<string, ObservationRow[]>();
  for (const row of observations) {
    const held = observationsByObject.get(row.objectKey);
    if (held === undefined) observationsByObject.set(row.objectKey, [row]);
    else held.push(row);
  }

  /* --- the sheet each line's evidence stands on: one resolution per drawing, never one per row
     (R-TO-050 asks this table to hold 50 000 lines, and a lookup per line would price the page in
     as many round trips). --- */
  const layoutByDrawing = new Map<string, string>();
  for (const drawingId of new Set(published.map((row) => row.drawingId))) {
    layoutByDrawing.set(drawingId, await sheetOfView(scope, drawingId));
  }

  /* --- the lines, each marked with whether a person has struck the object it was measured off --- */
  const lines: ViewLine[] = published.map((row) => {
    const variables = variablesOf(row.bindings);
    return {
      lineId: row.lineId,
      objectKey: row.objectKey,
      kind: row.kind,
      class: row.class,
      level: levelOf(objectByKey.get(row.objectKey), levelLabels),
      value: row.value,
      unit: row.unit,
      formula: row.formula,
      variables,
      quantityBasis: row.quantityBasis,
      selectionBasis: row.selectionBasis,
      coverage: row.coverage,
      calibrationKeys: [...row.calibrationKeys],
      engine: row.engine,
      sourceKey: row.viewKey,
      repudiated: struck.has(row.objectKey),
      // The Trace's own two readings: where the evidence stands, and which entities it cites.
      drawingId: row.drawingId,
      layoutName: layoutByDrawing.get(row.drawingId) ?? null,
      sourceKeys: citedKeysOf({ sourceKey: row.viewKey, variables }),
    };
  });

  const basisByObject = new Map<string, QuantityBasis[]>();
  for (const line of lines) {
    const held = basisByObject.get(line.objectKey);
    if (held === undefined) basisByObject.set(line.objectKey, [line.quantityBasis]);
    else held.push(line.quantityBasis);
  }

  /* --- the objects, the struck among them: a repudiation is stated, never a disappearance (I-173) --- */
  const objects: ViewObject[] = objectRows.map((row) => {
    const attributes = attributesOf(observationsByObject.get(row.objectKey) ?? []);
    const basis = weakest(basisByObject.get(row.objectKey) ?? []) ?? (queuedKeys.has(row.objectKey) ? INTERPRETED : (row.standing as QuantityBasis));
    return {
      objectKey: row.objectKey,
      discipline: row.discipline,
      level: levelOf(row, levelLabels),
      class: row.elementType,
      mark: row.mark,
      basis,
      role: row.standing,
      corroboration: corroborationOf(attributes, struck.has(row.objectKey)),
      sourceKey: row.placementKey,
      attributes,
    };
  });

  /* --- what produced no line: a deferral says its cause, a refusal says its code (R-UI-020) --- */
  const refusals: ViewRefusal[] = [
    ...deferred.map((item): ViewRefusal => ({ code: item.cause, objectKey: item.objectKey, kind: item.kind })),
    ...refusedRows.map((row): ViewRefusal => ({ code: row.refusal, objectKey: row.objectKey, kind: null })),
  ];

  /* --- the level stacks the pinned revision's drawings propose, one offered group each --- */
  const levelStacks: ViewLevelStack[] = [];
  for (const member of manifest) {
    const offer = await proposedLevelStackOf({ tenantId: scope.tenantId, projectId: scope.projectId, drawingId: member.drawingId });
    if (offer === null) continue;
    levelStacks.push({
      key: { kind: PROPOSED_LEVEL_STACK, drawingId: offer.group.drawingId, ingestId: offer.group.ingestId },
      label: member.name,
      count: offer.levels.length,
      levels: offer.levels.map((level) => ({ label: level.label, ordinal: level.ordinal })),
    });
  }

  return { tenantId: scope.tenantId, projectId: scope.projectId, campaign: { campaignId: campaign.campaignId, setRevisionId: campaign.setRevisionId }, objects, lines, refusals, levelStacks };
}

/** The level a register row stands on, as a reader reads it: the label, never the surrogate's id. */
function levelOf(row: { levelId: string | null; levelSlot: string | null; levelLabel: string | null } | undefined, labels: ReadonlyMap<string, string>): string {
  if (row === undefined) return "";
  if (row.levelId !== null) return labels.get(row.levelId) ?? "";
  return row.levelSlot ?? row.levelLabel ?? "";
}

/**
 * Every attribute of one object, with how it stands derived from the readings the ledger holds. The
 * readings handed in are that object's own, already drawn off the revision's list in one pass.
 */
function attributesOf(readings: readonly ObservationRow[]): ViewAttribute[] {
  const held = new Map<string, ObservationRow[]>();
  for (const row of readings) {
    const list = held.get(row.attribute);
    if (list === undefined) held.set(row.attribute, [row]);
    else list.push(row);
  }
  return [...held.entries()].map(([attribute, readings]) => {
    const standing = standingOf(readings);
    return {
      attribute,
      standing: standing.standing,
      canonicalValue: standing.canonicalValue,
      canonicalUnit: standing.canonicalUnit,
      competing: standing.competing.map(readingOf),
      overruled: standing.overruled.map(readingOf),
    };
  });
}

/** Every line one campaign published, in the order they were published (L-QTY-03). */
async function linesOfCampaign(tenantId: string, campaignId: string) {
  return forTenant({ tenantId }).transaction((tx) =>
    tx
      .select()
      .from(quantityLines)
      .where(and(eq(quantityLines.tenantId, tenantId), eq(quantityLines.campaignId, campaignId)))
      .orderBy(asc(quantityLines.publishedAt), asc(quantityLines.lineId)),
  );
}

/** Every scope one campaign deferred rather than measured, with the cause it was deferred for. */
async function queuedOfCampaign(tenantId: string, campaignId: string) {
  return forTenant({ tenantId }).transaction((tx) =>
    tx
      .select()
      .from(queueItems)
      .where(and(eq(queueItems.tenantId, tenantId), eq(queueItems.campaignId, campaignId)))
      .orderBy(asc(queueItems.queuedAt), asc(queueItems.queueItemId)),
  );
}

/** Every reading of every attribute of one pinned revision, in the store's own append order. */
async function observationsOfRevision(scope: RegisterScope): Promise<ObservationRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(registerObservations)
      .where(and(eq(registerObservations.tenantId, scope.tenantId), eq(registerObservations.setRevisionId, scope.setRevisionId)))
      .orderBy(asc(registerObservations.appendSeq)),
  );
}

/** The drawings the pinned revision names, as the pin recorded them (L-REG-06). */
async function manifestOfRevision(tenantId: string, setRevisionId: string): Promise<{ drawingId: string; name: string }[]> {
  const held = await forTenant({ tenantId }).transaction((tx) =>
    tx
      .select({ manifest: drawingSetRevisions.manifest })
      .from(drawingSetRevisions)
      .where(and(eq(drawingSetRevisions.tenantId, tenantId), eq(drawingSetRevisions.setRevisionId, setRevisionId)))
      .limit(1),
  );
  return (held[0]?.manifest ?? []).map((member) => ({ drawingId: member.drawingId, name: member.name }));
}

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
import { measurementStatementOf, reportedAbsencesOf, residueOf, runDeferralsOf, unclassedStatementOf, type PlacedManifestView, type RunDeferral } from "@/core/residue";
import { levelStackOf, levelsOf } from "@/modules/takeoff/levels";
import { QUANTITY_BASES, type QuantityBasis } from "@/core/offers/law";
import { standingOf, type ObservationRow, type RegisterScope } from "@/core/register/store";
import { proposedLevelStackOf } from "@/modules/takeoff/partition";
import { refusedSightingsOf, registerObjectsOf, repudiatedObjectsOf } from "@/modules/takeoff/register";
import { citedKeysOf, entitySelectionOf, handObjectsOf, handObjectWords, levelLabelOf, omissionsOf, pinnedRecordsOf, tracedLineOf, variablesOf, type PinnedRecord } from "@/modules/takeoff/trace";
import { declaredOf } from "./declared";
import { levelRank, readingOrder, type LineRank } from "./order";
import { unlinedRefusalsOf } from "./unlined";
import type { RegisterView, ViewAttribute, ViewLevelStack, ViewLine, ViewObject, ViewReading, ViewRefusal } from "./view";

/** Which project's register is being read, in which workspace. */
export type RegisterViewScope = { readonly tenantId: string; readonly projectId: string };

/**
 * What a caller asks of the reading beyond the register itself. `declared`: read the coverage
 * certificate's residue for what the drawings name and the run measured none of (I-650) — the
 * screen asks it; a caller that renders no such list (Ask, the workbook export) is not made to pay for
 * the residue's read, and its reading carries no `declared` at all.
 */
export type RegisterViewOptions = { readonly declared?: boolean };

/** The basis a queue item leaves an object standing on: interpreted, and uncorroborated (L-QTY-04). */
const INTERPRETED: QuantityBasis = "INTERPRETED";

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
export async function registerViewOf(scope: RegisterViewScope, options: RegisterViewOptions = {}): Promise<RegisterView> {
  const open = await campaignsOf(scope);
  const campaign = open[open.length - 1];
  if (campaign === undefined) {
    return { tenantId: scope.tenantId, projectId: scope.projectId, campaign: null, objects: [], lines: [], refusals: [], levelStacks: [], measured: false, declared: [] };
  }

  const registerScope: RegisterScope = { tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId: campaign.setRevisionId };
  const [objectRows, repudiatedRows, refusedRows, published, deferred, observations, levelRows, manifest, reported, stack, residue] = await Promise.all([
    registerObjectsOf(registerScope),
    repudiatedObjectsOf(registerScope),
    refusedSightingsOf(registerScope),
    linesOfCampaign(scope.tenantId, campaign.campaignId),
    queuedOfCampaign(scope.tenantId, campaign.campaignId),
    observationsOfRevision(registerScope),
    levelsOf(scope),
    manifestOfRevision(scope.tenantId, campaign.setRevisionId),
    reportedAbsencesOf(scope, campaign),
    levelStackOf(scope),
    // The coverage certificate's own residue of THIS campaign, read for what the drawings name and
    // the run measured none of (I-650) — the statement is the certificate's, never re-derived.
    options.declared === true ? residueOf({ ...scope, campaignId: campaign.campaignId }) : null,
  ]);

  const struck = new Set(repudiatedRows.map((row) => row.objectKey));
  const levelLabels = new Map(levelRows.map((level) => [level.levelId, level.label]));
  const levelOrdinals = new Map(levelRows.map((level) => [level.levelId, level.ordinal]));

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

  /* --- the sheet each line stands on, and what its Trace selects there: the record each drawing
     of the pinned revision was measured on is read ONCE (R-TO-050 asks this table to hold 50 000
     lines, and a read per line would price the page in as many round trips), and each line is then
     resolved against it by the Trace's own pure reading — per VIEW and per MEMBER, never one sheet
     per drawing: F-RCC6-BNBC's lines stand on S-04, S-06, S-10 and S-13..15 of one file (I-421). */
  // Every drawing the revision pins, not only those a line was published off: a queue item and a
  // refused sighting are about members that produced no line, and they reveal where they stand too
  // (R-TO-011, I-557).
  const records = await pinnedRecordsOf(scope, campaign.setRevisionId, [...published.map((row) => row.drawingId), ...manifest.map((member) => member.drawingId)]);
  // The hand measurements among the objects: named by their condition, filed under the sheet their
  // ring was traced on (s-measure I-666) — one read, whatever their count.
  const hand = await handObjectsOf(scope, objectRows.map((row) => row.objectKey));

  /* --- the lines, each marked with whether a person has struck the object it was measured off, in
     the order a register is READ (s-takeoff I-350): level, class, mark in natural order, kind. The
     store's own order is `published_at, line_id`, and one campaign publishes at one instant, so it
     was the order of the line ids — one pile's count, concrete and boring scattered across its
     group while the tree beside it listed P1 … P89. Ranked once per line, then sorted. --- */
  const ranked = published.map((row) => {
    const object = objectByKey.get(row.objectKey);
    const rank: LineRank = {
      rank: levelRank(object, levelOrdinals),
      level: levelLabelOf(object, levelLabels),
      class: row.class,
      mark: object?.mark ?? "",
      kind: row.kind,
      lineId: row.lineId,
    };
    return { row, rank };
  });
  ranked.sort((left, right) => readingOrder(left.rank, right.rank));
  const lines: ViewLine[] = ranked.map(({ row }) => {
    const variables = variablesOf(row.bindings);
    const record = records.get(row.drawingId);
    const traced = tracedLineOf(row, record, undefined, hand);
    return {
      lineId: row.lineId,
      objectKey: row.objectKey,
      kind: row.kind,
      class: row.class,
      level: levelLabelOf(objectByKey.get(row.objectKey), levelLabels),
      value: row.value,
      unit: row.unit,
      formula: row.formula,
      variables,
      quantityBasis: row.quantityBasis,
      selectionBasis: row.selectionBasis,
      coverage: row.coverage,
      omitted: omissionsOf(row.omitted),
      calibrationKeys: [...row.calibrationKeys],
      engine: row.engine,
      sourceKey: row.viewKey,
      repudiated: struck.has(row.objectKey),
      // The Trace's own readings: the sheet the line stands on, how a reader names it (its number —
      // I-179 — or null for model space, which the chip says in words), and what the Trace selects.
      drawingId: row.drawingId,
      layoutName: traced.layoutName,
      sheetLabel: traced.layoutName === null || record === undefined ? null : record.labelOf(traced.layoutName),
      // Two lists, never one: every key the line CITES — what the JSON export has always published
      // as `sourceKeys` (I-426) — and what its Trace SELECTS, the member's outline and mark, which
      // the line does not cite at all (I-421).
      sourceKeys: citedKeysOf({ sourceKey: row.viewKey, variables }),
      traceKeys: traced.flyTo,
    };
  });

  const basisByObject = new Map<string, QuantityBasis[]>();
  for (const line of lines) {
    const held = basisByObject.get(line.objectKey);
    if (held === undefined) basisByObject.set(line.objectKey, [line.quantityBasis]);
    else held.push(line.quantityBasis);
  }

  // The sheet each hand object's lines stand on, as a reader names it — what its name says (I-666).
  const handSheets = new Map<string, string>();
  for (const line of lines) if (hand.has(line.objectKey) && line.sheetLabel !== null && !handSheets.has(line.objectKey)) handSheets.set(line.objectKey, line.sheetLabel);

  /* --- the objects, the struck among them: a repudiation is stated, never a disappearance (I-173) --- */
  const objects: ViewObject[] = objectRows.map((row) => {
    const attributes = attributesOf(observationsByObject.get(row.objectKey) ?? []);
    const basis = weakest(basisByObject.get(row.objectKey) ?? []) ?? (queuedKeys.has(row.objectKey) ? INTERPRETED : (row.standing as QuantityBasis));
    return {
      objectKey: row.objectKey,
      discipline: row.discipline,
      level: levelLabelOf(row, levelLabels),
      class: row.elementType,
      // A hand object is named by its condition, sheet and level, never by its `~m.` mark (I-666).
      mark: ((measured) => (measured === undefined ? row.mark : handObjectWords(measured, handSheets.get(row.objectKey) ?? null, levelLabelOf(row, levelLabels))))(hand.get(row.objectKey)),
      basis,
      role: row.standing,
      corroboration: corroborationOf(attributes, struck.has(row.objectKey)),
      sourceKey: row.placementKey,
      attributes,
    };
  });

  /* --- what produced no line: a deferral says its cause, a refusal says its code (R-UI-020) --- */
  const refusals: ViewRefusal[] = [
    // What a measure run could not measure for want of what is set up first, BY NAME and first — each
    // view no affirmation names, each storey whose height stands at none (MEASURE-REFUSE, s-coverage
    // I-484). Only once a run has been carried over the campaign: before one, nothing was
    // deferred, and the register's empty state says so.
    ...(reported.measured
      ? runDeferralsOf({
          observations: reported.observations.map((row) => ({ class: row.class, code: row.code ?? "", objectKey: row.objectKey ?? null, sourceEntity: row.source ?? null, view: row.view ?? null })),
          levels: stack.map((level) => ({ levelId: level.levelId, label: level.label, ordinal: level.ordinal, standing: level.height.standing })),
          objects: objectRows.filter((row) => !struck.has(row.objectKey)).map((row) => ({ objectKey: row.objectKey, levelId: row.levelId, elementType: row.elementType })),
          lines: published.map((row) => ({ objectKey: row.objectKey, omitted: omissionsOf(row.omitted).map((omission) => omission.code) })),
        }).map((deferral) => deferralRow(deferral, reported.views))
      : []),
    ...deferred.map((item): ViewRefusal => ({ code: item.cause, objectKey: item.objectKey, kind: item.kind, ...queueSheetOf(item.objectKey, records) })),
    ...refusedRows.map((row): ViewRefusal => ({ code: row.refusal, objectKey: row.objectKey, kind: null, ...queueSheetOf(row.objectKey, records) })),
    // And every object the run published no line for that nothing above names, by the reason the
    // rails' latest report gave it — never silence (I-668, walk-2 BD-3). Only once a run has
    // been carried: before one, no object has been asked anything.
    ...(reported.measured
      ? unlinedRefusalsOf({
          objects: objectRows.filter((row) => !struck.has(row.objectKey)),
          lined: new Set(published.map((row) => row.objectKey)),
          named: new Set([...deferred.map((item) => item.objectKey), ...refusedRows.map((row) => row.objectKey)]),
          observations: reported.observations.map((row) => ({ code: row.code ?? null, kind: row.kind, objectKey: row.objectKey ?? null })),
        }).map((row): ViewRefusal => ({ ...row, ...queueSheetOf(row.objectKey, records) }))
      : []),
  ];

  /* --- the level stacks the pinned revision's drawings propose, one offered group each --- */
  const levelStacks: ViewLevelStack[] = [];
  for (const member of manifest) {
    const offer = await proposedLevelStackOf({ tenantId: scope.tenantId, projectId: scope.projectId, drawingId: member.drawingId });
    if (offer === null) continue;
    // The key and the count, never the levels: the browser hands the key back, and the door resolves the
    // offer again, with the readings the drawing stated (L-ACT-02, `levelsOfferedUnder`).
    levelStacks.push({
      key: { kind: offer.group.kind, drawingId: offer.group.drawingId, ingestId: offer.group.ingestId },
      label: member.name,
      count: offer.levels.length,
    });
  }

  // What the drawings name and no run measured, stated only once a run has been carried: before one,
  // everything is unmeasured and the work surface says so (I-649/b).
  const declared =
    residue === null
      ? undefined
      : reported.measured
        ? declaredOf({
        measurement: measurementStatementOf(residue.cells),
        unclassed: unclassedStatementOf(residue.input.unclassed ?? []),
            registeredClasses: new Set(objectRows.map((row) => row.elementType)),
          })
        : [];

  return {
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    campaign: { campaignId: campaign.campaignId, setRevisionId: campaign.setRevisionId },
    objects,
    lines,
    refusals,
    levelStacks,
    measured: reported.measured,
    ...(declared === undefined ? {} : { declared }),
  };
}

/**
 * Where a queue item or a refused sighting stands (R-TO-011, I-557): the member its key names,
 * resolved by the Trace's one reading of a named entity to the outline and the mark its stored
 * placement was read off, on the sheet the outline stands on, with that sheet's number. Nothing where
 * the pinned records hold no such placement — the row then keeps its key and offers no link.
 */
function queueSheetOf(objectKey: string, records: ReadonlyMap<string, PinnedRecord>): Pick<ViewRefusal, "sheet"> {
  const selection = entitySelectionOf(objectKey, records);
  if (selection === null) return {};
  const record = records.get(selection.drawingId);
  return { sheet: { ...selection, sheetLabel: record === undefined ? null : record.labelOf(selection.layoutName) } };
}

/**
 * One run deferral as the deferred-and-refused region states a row (I-484): its registered
 * code; what it is about, whole and unique — the view's address, the storey's level id — so no two
 * rows share a key; and what it names in the words a QS knows it by, with where it is fixed — the
 * view's caption and the sheet it stands on, flown to the caption; the storey's own label. A
 * deferral is about a view or a storey and never one kind, so it names none.
 */
function deferralRow(deferral: RunDeferral, views: readonly PlacedManifestView[]): ViewRefusal {
  if ("view" in deferral) {
    const placed = views.find((view) => view.address === deferral.view);
    const sheet =
      placed === undefined || placed.layoutName === ""
        ? null
        : { drawingId: placed.drawingId, layoutName: placed.layoutName, sourceKey: placed.anchorKey ?? placed.address };
    const caption = deferral.caption ?? (placed?.caption === undefined || placed.caption === "" ? null : placed.caption);
    return { code: deferral.code, objectKey: deferral.view, kind: null, deferral: { subject: "VIEW", name: caption ?? "", sheet } };
  }
  return { code: deferral.code, objectKey: deferral.levelId, kind: null, deferral: { subject: "STOREY", name: deferral.label } };
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
export async function manifestOfRevision(tenantId: string, setRevisionId: string): Promise<{ drawingId: string; name: string }[]> {
  const held = await forTenant({ tenantId }).transaction((tx) =>
    tx
      .select({ manifest: drawingSetRevisions.manifest })
      .from(drawingSetRevisions)
      .where(and(eq(drawingSetRevisions.tenantId, tenantId), eq(drawingSetRevisions.setRevisionId, setRevisionId)))
      .limit(1),
  );
  return (held[0]?.manifest ?? []).map((member) => ({ drawingId: member.drawingId, name: member.name }));
}

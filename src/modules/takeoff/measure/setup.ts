// The read-only setup every rail of one campaign is handed (L-MEA-08: "rails share only setup, the
// register and the document stage").
//
// A rail is a pure function that reaches no store, so everything it would have had to ask for is
// read here, once, for the whole roster: the placements of the pinned revision's drawings, the
// member-type variants their schedules registered, the project's live level stack with each level's
// storey height, and the affirmed calibration of every view. Read once and shared, so two rails over
// one campaign cannot disagree about what the drawings said.
//
// Nothing is judged here and nothing is derived: a view no act has affirmed is simply absent from
// the calibrations, and what a rail makes of that absence is the rail's (riskNotes (3)). Nothing is
// converted either — every reading is carried as the drawing wrote it, and the canon is reached at
// the gate (B-17, L-FRM-06).
import { drawingSetRevisions, eq, and, forTenant, type TenantTx } from "@/core/db";
import { levelStackOf } from "@/modules/takeoff/levels";
import type { LevelSetup, MemberVariantSetup, PlacementSetup, RailSetup } from "@/core/offers/contract";
import { affirmationsOfRecord } from "@/core/scale/store";
import { viewAddressOf, viewRecordsOf } from "@/core/views";
import { ingestRecordOf } from "@/modules/takeoff/ingest";
import { memberTypesOf, placementsOf } from "@/modules/takeoff/partition";

/** Which campaign's revision a setup is read for, in which project of which workspace. */
export type RailSetupScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly setRevisionId: string;
};

/**
 * The engine that read these placements. This lane ingests vector CAD and nothing else, so what a
 * placement of it was read by is the vector engine — a raster reading arrives with the vectoriser
 * that produces one, and would carry its own engine and its own INTERPRETED basis (L-QTY-03).
 */
const VECTOR = "VECTOR";

/** The drawings the pinned revision names, in the order its manifest addresses them (L-REG-06). */
async function drawingsOfRevision(tx: TenantTx, scope: RailSetupScope): Promise<string[]> {
  const rows = await tx
    .select({ manifest: drawingSetRevisions.manifest })
    .from(drawingSetRevisions)
    .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setRevisionId, scope.setRevisionId)))
    .limit(1);
  return (rows[0]?.manifest ?? []).map((member) => member.drawingId);
}

/** One level of the live stack, as a rail reads it: the standing, and the reading it stands at. */
function levelSetupOf(level: Awaited<ReturnType<typeof levelStackOf>>[number]): LevelSetup {
  // Under AGREED every current reading says the same height, so the first of them IS the reading —
  // and under SUSPENDED and NONE there is no height at all (L-MEA-07).
  const stands = level.height.standing === "AGREED" ? level.height.current[0] : undefined;
  return {
    levelId: level.levelId,
    label: level.label,
    ordinal: level.ordinal,
    height:
      stands === undefined
        ? { standing: level.height.standing, value: null, unit: null, basis: null, sourceKey: null }
        : {
            standing: level.height.standing,
            value: stands.valueAsWritten,
            unit: stands.unitAsWritten,
            basis: stands.basis,
            sourceKey: stands.sourceKey,
          },
  };
}

/**
 * The setup of one campaign's pinned revision, whole.
 *
 * A drawing the revision names that nothing has ingested, or whose partition has not been rebuilt,
 * contributes nothing rather than failing the read: what a rail could not find is the rail's to
 * report as an observation, and a measurement that threw over one unpartitioned drawing would cost
 * every other drawing of the set its lines (ARCH-03, L-MEA-08).
 */
export async function railSetupOf(scope: RailSetupScope): Promise<RailSetup> {
  const levels = (await levelStackOf({ tenantId: scope.tenantId, projectId: scope.projectId })).map(levelSetupOf);
  const drawingIds = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => drawingsOfRevision(tx, scope));

  const placements: Record<string, PlacementSetup> = {};
  const memberTypes: Record<string, Record<string, readonly MemberVariantSetup[]>> = {};
  const calibrations: Record<string, Record<string, string>> = {};

  for (const drawingId of drawingIds) {
    const record = await ingestRecordOf({ tenantId: scope.tenantId, drawingId });
    if (record === null) continue;
    const viewsScope = { tenantId: scope.tenantId, projectId: scope.projectId, drawingId };

    for (const placement of (await placementsOf(viewsScope)) ?? []) {
      placements[placement.placementKey] = {
        drawingId: placement.drawingId,
        ingestId: placement.ingestId,
        viewKey: placement.viewKey,
        memberFamily: placement.memberFamily,
        engine: VECTOR,
        // A count provenances to the entity it was counted off, which is the placement itself
        // (L-QTY-03: "the (drawing, view) read from", and the source entity beside it).
        sourceEntity: placement.placementKey,
      };
    }

    const registered = await memberTypesOf(viewsScope);
    if (registered !== null) {
      const families: Record<string, readonly MemberVariantSetup[]> = memberTypes[registered.ingestId] ?? {};
      for (const family of registered.families) {
        families[family.family] = family.variants.map((variant) => ({
          variantKey: variant.variantKey,
          bandFrom: variant.bandFrom,
          bandTo: variant.bandTo,
          sectionText: variant.sectionText,
          sectionWidth: variant.sectionWidth,
          sectionDepth: variant.sectionDepth,
          sectionUnit: variant.sectionUnit,
          sourceKeys: variant.sourceKeys,
        }));
      }
      memberTypes[registered.ingestId] = families;
    }

    // A view is held in two key spaces and this is where they are joined. The partition stores a view
    // under its own key and the scale store files an affirmation against that same key, because the
    // affirmation is evidence about a stored view; a placement, a register row and every offer name
    // the view by L-REG-04's address, derived from the same two facts by `viewAddressOf` (B-17). A
    // rail asks for the calibration of the view its placement cites, so the address is the key this
    // setup answers under — the translation belongs to whoever spans the two stores, and that is here.
    const addresses = await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
      const scoped = { tenantId: scope.tenantId, ingestId: record.ingestId };
      const held = new Map((await viewRecordsOf(tx, scoped)).map((view) => [view.viewKey, viewAddressOf(view)]));
      return { held, affirmed: await affirmationsOfRecord(tx, scoped) };
    });
    const views: Record<string, string> = calibrations[record.ingestId] ?? {};
    // A view the partition no longer holds is filed under the only name the affirmation has: dropping
    // it would lose a standing calibration, and a rail that cannot match it reports the absence.
    for (const [viewKey, standing] of addresses.affirmed) views[addresses.held.get(viewKey) ?? viewKey] = standing.calibrationKey;
    calibrations[record.ingestId] = views;
  }

  return {
    placements,
    memberTypes,
    levels,
    calibrations,
    // A seam, empty until a general-notes reader lands: no grade is stated, so nothing is selected
    // by, and the selection basis rolls up to DEFAULTED at the gate (L-QTY-01, riskNotes (5)).
    grades: {},
  };
}

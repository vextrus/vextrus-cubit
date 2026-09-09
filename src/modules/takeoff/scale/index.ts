// L-MEA-05's one door onto a drawing's scale (ARCH-02): for every view of the drawing's current
// partition, what the machine proposes (ranks 2 to 4, recomputed from the frozen artifact, the
// stored grid and the file's own header on every read and stored by nothing), what an act has
// affirmed, and — for a view no act names — the refusal that says so by name (R-TO-020).
//
// The engine is core's (`@/core/scale`): the act seam derives AFFIRM_SCALE's Consequence over the
// same evidence and may not reach into a module (ARCH-01), so a proposal has one reading and this
// door asks for it rather than keeping a second one (B-17).
import { REFUSALS } from "@/core/errors";
import { refusal } from "@/core/faults/refusal-marker";
import { forTenant, type TenantTx } from "@/core/db";
import { judgeAnisotropy, proposalsFor, scaleAbsenceCodeOf, type AnisotropyJudgement, type ScaleAbsenceCode, type ScaleProposal } from "@/core/scale";
import { scaleEvidenceOf } from "@/core/scale/evidence";
import { affirmationsOfRecord, type AffirmedCalibration } from "@/core/scale/store";
import { scaleTolerancesOf } from "@/core/scale/tolerances";
import type { Storage } from "@/core/storage";
import { viewAddressOf, viewRecordsOf, type ViewRecord } from "@/core/views";
import { ingestRecordOf } from "@/modules/takeoff/ingest";
import { drawingProjectOf } from "@/modules/takeoff/partition/store";

export { scaleTolerancesOf } from "@/core/scale/tolerances";
export type { AffirmedCalibration } from "@/core/scale/store";
export type { AnisotropyJudgement, FactorPair, ScaleAbsenceCode, ScaleProposal, ScaleRank, ScaleTolerances } from "@/core/scale";

/** Which drawing's scale is being asked about, in whose workspace and under which project. */
export type ScaleScope = { readonly tenantId: string; readonly projectId: string; readonly drawingId: string };

/** What this door needs beyond the store: the object store the frozen artifact is read from. */
export type ScaleDeps = { readonly storage: Storage };

/** One view's affirmed scale as the door answers it: the calibration, and its anisotropy judged. */
export type AffirmedScale = AffirmedCalibration & AnisotropyJudgement;

/**
 * One view's scale, whole: what the machine offers, what an act affirmed, and — where none has — the
 * refusal that says so. `affirmed` and `refusal` are never both set and never both null: a view has
 * a scale or is told by name why it has none (L-MEA-05: "declared, never silent").
 */
export type ViewScale = {
  readonly viewKey: string;
  readonly type: ViewRecord["type"];
  readonly caption: string;
  readonly proposals: readonly ScaleProposal[];
  readonly affirmed: AffirmedScale | null;
  readonly refusal: ScaleAbsenceCode | null;
};

/**
 * The scale of every view of a drawing's current partition (R-TO-020's panel, per sheet).
 *
 * A drawing this workspace does not hold under this project is refused with the code every other
 * named-workspace door answers; one nothing has ingested, or whose partition has not been rebuilt,
 * refuses PARTITION_NOT_AVAILABLE — there is no view to have a scale.
 */
export async function scaleProposalsOf(scope: ScaleScope, deps: ScaleDeps): Promise<ViewScale[]> {
  const projectId = await drawingProjectOf(scope.tenantId, scope.drawingId);
  if (projectId === null || projectId !== scope.projectId) {
    throw refusal(REFUSALS.WORKSPACE_PERMISSION_NOT_HELD.code, `drawing ${scope.drawingId} is not a drawing of project ${scope.projectId} in this workspace`);
  }
  const record = await ingestRecordOf({ tenantId: scope.tenantId, drawingId: scope.drawingId });
  if (record === null) throw refusal(REFUSALS.PARTITION_NOT_AVAILABLE.code, `drawing ${scope.drawingId} has no ingest record, so it has no views to scale`);

  const tolerances = await scaleTolerancesOf({ tenantId: scope.tenantId, projectId: scope.projectId });

  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx: TenantTx) => {
    const recordScope = { tenantId: scope.tenantId, ingestId: record.ingestId };
    const views = await viewRecordsOf(tx, recordScope);
    if (views.length === 0) throw refusal(REFUSALS.PARTITION_NOT_AVAILABLE.code, `drawing ${scope.drawingId} has no stored partition yet, so it has no views to scale`);

    const viewKeys = views.map((view) => view.viewKey);
    const evidence = await scaleEvidenceOf(tx, { ...recordScope, viewKeys }, record, deps.storage, tolerances);
    const proposals = proposalsFor(evidence);
    const affirmed = await affirmationsOfRecord(tx, recordScope);
    // A view no act names has no scale; where rank 4 could not even be read, the header is why.
    const absence = scaleAbsenceCodeOf(evidence.unit);

    return views.map((view) => {
      // A view is named to the world by L-REG-04's address, which is what a placement and a register
      // row cite it under: an affirmation is filed against that address, so the calibration a rail
      // reads is the one this door says the view stands under (B-17). The partition's own key stays
      // inside the partition, where the evidence is keyed by it.
      const address = viewAddressOf(view);
      const standing = affirmed.get(address) ?? null;
      return {
        viewKey: address,
        type: view.type,
        caption: view.caption,
        proposals: proposals.get(view.viewKey) ?? [],
        affirmed: standing === null ? null : { ...standing, ...judgeAnisotropy(standing, tolerances.anisotropy) },
        refusal: standing === null ? absence : null,
      };
    });
  });
}

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
import type { EntityGraph } from "@/core/entitygraph/schema";
import { judgeAnisotropy, proposalsFor, scaleAbsenceCodeOf, type AnisotropyJudgement, type ScaleAbsenceCode, type ScaleProposal } from "@/core/scale";
import { scaleEvidenceOf, useStatedLengths } from "@/core/scale/evidence";
import { measurementTextsOf, type StatedLength } from "@/core/scale/proposals";
import { exact, factorOf } from "@/core/units/canon";
import { parseFeetInches } from "@/modules/takeoff/partition/notation";
import { affirmationsOfRecord, type AffirmedCalibration } from "@/core/scale/store";
import { scaleTolerancesOf } from "@/core/scale/tolerances";
import type { Storage } from "@/core/storage";
import { viewRecordsOf, type ViewRecord } from "@/core/views";
import { ingestRecordOf } from "@/modules/takeoff/ingest";
import { drawingProjectOf } from "@/modules/takeoff/partition/store";

export { scaleTolerancesOf } from "@/core/scale/tolerances";
export type { AffirmedCalibration } from "@/core/scale/store";
export type { AnisotropyJudgement, FactorPair, ScaleAbsenceCode, ScaleProposal, ScaleRank, ScaleTolerances } from "@/core/scale";

/**
 * The lengths a drawing's dimension texts state in units the TEXTS name, per DIMENSION source key
 * (L-MEA-05 rank 3, I-295): `15'-0"` states fifteen feet whatever `$INSUNITS` failed to say, so the
 * ratio it leaves over its drawn span is metres per drawing unit and the machine may propose it on
 * a unitless header. A bare number names no unit and is read by core under the header as before.
 *
 * The feet-and-inches reading is the notation grammar's, spelled once for the whole product
 * (`../partition/notation`, this module's own — ARCH-01 admits it, B-17 forbids a second): this
 * function is only where the engine's question meets that answer. The inch's metres are the
 * measurement canon's for the same reason (L-FRM-06).
 *
 * A dimension whose texts state MORE than one length states none this can use: which of two words
 * the draughtsman measured by is not this function's to decide (L-QTY-04, fail-closed).
 */
export function statedLengthsOf(graph: EntityGraph): ReadonlyMap<string, StatedLength> {
  const stated = new Map<string, StatedLength>();
  for (const [key, texts] of measurementTextsOf(graph)) {
    const read = texts.flatMap((text) => {
      const inches = parseFeetInches(text);
      return inches === null ? [] : [{ text, metres: exact(inches).mul(factorOf("in")) }];
    });
    const only = read.length === 1 ? read[0] : undefined;
    if (only === undefined || !only.metres.gt(0)) continue;
    stated.set(key, { text: only.text, metres: only.metres.toString() });
  }
  return stated;
}

/**
 * …and the same reading handed down to core, once, for the gatherer that cannot ask for it.
 *
 * AFFIRM_SCALE is rendered in `src/core/acts` and gathers its own evidence inside the transaction it
 * writes in; core may not reach this module for the grammar (ARCH-01), and the act seam takes no
 * dependency parameter for a rendering to fill. Both doors that perform the act — the tRPC procedure
 * and this route's server action — load this module for the panel's own read, so registering here is
 * registering everywhere the act can be performed, and the panel then offers no rank the act behind
 * it would refuse (I-295b). It is the same reading in both places by construction: one function.
 */
useStatedLengths(statedLengthsOf);

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
    const evidence = await scaleEvidenceOf(tx, { ...recordScope, viewKeys }, record, deps.storage, tolerances, statedLengthsOf);
    const proposals = proposalsFor(evidence);
    const affirmed = await affirmationsOfRecord(tx, recordScope);
    // A view no act names has no scale; where rank 4 could not even be read, the header is why.
    const absence = scaleAbsenceCodeOf(evidence.unit);

    return views.map((view) => {
      const standing = affirmed.get(view.viewKey) ?? null;
      return {
        viewKey: view.viewKey,
        type: view.type,
        caption: view.caption,
        proposals: proposals.get(view.viewKey) ?? [],
        affirmed: standing === null ? null : { ...standing, ...judgeAnisotropy(standing, tolerances.anisotropy) },
        refusal: standing === null ? absence : null,
      };
    });
  });
}

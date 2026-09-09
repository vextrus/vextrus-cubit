// One campaign, measured: the rail roster run over the campaign's pinned revision, and everything it
// offered handed to the gate as one batch (L-MEA-08, SEAM-GATE).
//
// The gate is NOT reached from here. `src/modules/**` cannot import `src/core/gate` at all — the ban
// is total and the committed scan beside the gate enforces it — so the run takes the gate as a
// dependency, typed through the rail↔gate contract's own `GateEvaluate`, and the worker's handler is
// the composition root that hands the real one in (riskNotes (2), ARCH-01, B-23).
//
// The steps are recorded durably as the run passes them, so a job that died halfway says where
// (SEAM-JOBS: "workers report progress events"). Nothing here judges an offer: what publishes, what
// is deferred and what is refused is the gate's alone, and this file reports the verdict it answered.
import { campaignOf } from "@/core/campaigns";
import { REFUSALS } from "@/core/errors";
import { refusal } from "@/core/faults/refusal-marker";
import type { JobPayloads, JobProgress } from "@/core/jobs";
import type { Kind } from "@/core/catalogue/kinds";
import type { GateEvaluate, Offer, Rail, RailObservation } from "@/core/offers/contract";
import { registerObjectsOf } from "@/modules/takeoff/register";
import { railSetupOf } from "./setup";

/**
 * The steps one measurement reports, in the order they run: what the rails offered, what the gate
 * made of it, and what the campaign now stands at. A step is a member of this list or it is not
 * reported at all — the list is the roster (B-19).
 */
export const MEASURE_STEPS = ["measure:rails", "measure:gate", "measure:verdict"] as const;

/** One step of a measurement, drawn from the closed list above. */
export type MeasureStep = (typeof MEASURE_STEPS)[number];

/** The steps by name, so a caller reads the spelling from the roster rather than repeating it. */
const [STEP_RAILS, STEP_GATE, STEP_VERDICT] = MEASURE_STEPS;

/**
 * What a measurement is run with: the rails that read the revision, and the gate that judges what
 * they offered. Both are handed in — the roster so a rail landed later needs no edit here, the gate
 * because this layer may not name it (B-23).
 */
export type MeasureDeps = {
  readonly rails: Readonly<Partial<Record<Kind, Rail>>>;
  readonly gate: GateEvaluate;
};

/**
 * Measure one campaign.
 *
 * A campaign the project no longer holds is refused by its registered code rather than failed: the
 * job log records the code and the attempt ends refused, which is an answer about the address the
 * work named (ARCH-03, B-21, R-SPINE-062). A stale campaign is NOT refused — freshness blocks
 * signing and never measuring, and what the campaign snapshotted is exactly what it goes on
 * measuring against (L-REG-07).
 */
export async function runMeasureJob(payload: JobPayloads["measure"], progress: JobProgress, deps: MeasureDeps): Promise<void> {
  const scope = { tenantId: payload.tenantId, projectId: payload.projectId };
  const campaign = await campaignOf(scope, payload.campaignId);
  if (campaign === null) {
    throw refusal(REFUSALS.CAMPAIGN_NOT_FOUND.code, "a measurement was asked for a campaign this project does not hold", {
      projectId: payload.projectId,
      campaignId: payload.campaignId,
    });
  }

  const roster = Object.entries(deps.rails) as readonly [Kind, Rail][];
  const offers: Offer[] = [];
  const observations: RailObservation[] = [];
  if (roster.length > 0) {
    const registerScope = { tenantId: payload.tenantId, projectId: payload.projectId, setRevisionId: campaign.setRevisionId };
    const objects = await registerObjectsOf(registerScope);
    // Read once for the whole roster: rails share their setup, so two rails over one campaign cannot
    // disagree about what the drawings said (L-MEA-08).
    const setup = await railSetupOf(registerScope);
    for (const [kind, rail] of roster) {
      const batch = rail({ campaignId: campaign.campaignId, setRevisionId: campaign.setRevisionId, kind, objects, setup });
      offers.push(...batch.offers);
      observations.push(...batch.observations);
    }
  }
  await progress.step(STEP_RAILS, { rails: roster.length, offers: offers.length, observations: observations.length });

  const verdict = await deps.gate({ tenantId: payload.tenantId, projectId: payload.projectId, campaignId: campaign.campaignId }, { offers, observations });
  await progress.step(STEP_GATE, { published: verdict.published, queued: verdict.queued, refused: verdict.refused });

  // The refusals by code, never by object: a step's detail is what an operator reads, and a line per
  // refused object would be a residue — which is L-QTY-05's, read from the stores the gate wrote.
  const byCode: Record<string, number> = {};
  for (const answer of verdict.refusals) byCode[answer.code] = (byCode[answer.code] ?? 0) + 1;
  await progress.step(STEP_VERDICT, { campaignId: campaign.campaignId, published: verdict.published, queued: verdict.queued, refused: verdict.refused, refusals: byCode });
}

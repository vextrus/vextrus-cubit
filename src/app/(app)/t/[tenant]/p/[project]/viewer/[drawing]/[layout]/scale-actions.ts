"use server";
// R-TO-020's three doors for the scale panel: the reading of every view's scale, and L-ACT-02's pair
// for the one act this region commits — AFFIRM_SCALE, previewed and committed over the seam.
//
// The shapes are `partition-actions.ts`'s, verbatim: one dialect for an act door in this route, not a
// second per region (B-17). The dialog is a browser component and the digest is what binds a commit
// to the state it was shown over, so the preview answers BOTH the consequence and its digest —
// L-ACT-02 forbids leaving the digest to the caller.
//
// All three doors are opened through the one server-call seam (`@/server/call`): it reads what the
// browser stated against the schemas below, resolves the presented session ONCE for the action, and
// carries a registered refusal back in this region's own answer shape — a submission that is not the
// shape a door is asked in is answered MALFORMED rather than thrown (ARCH-03, B-21).
//
// The actor is derived here and never taken from the form: `projectActorFor` is the one place that
// turns a session and a project into a workspace-scoped actor (B-17, ARCH-02). A registered refusal
// is carried back to the screen that asked, never turned into a fault and never swallowed
// (ARCH-03, B-21).
import { z } from "zod";
import { commit, consequenceDigest, preview, type AffirmScaleInput, type Consequence } from "@/core/acts";
import type { RefusalCode } from "@/core/errors";
import { isScaleRank, type ScaleRank, type ScaleTolerances, type TwoPointObservation } from "@/core/scale";
import { appStorage } from "@/core/storage/app";
import { scaleProposalsOf, scaleTolerancesOf, type ViewScale } from "@/modules/takeoff/scale";
import { serverCall } from "@/server/call";
import { projectActorFor } from "@/server/routers/spine";

/** The act this region renders, and the permission L-ACT-03 makes it move. */
const AFFIRM_SCALE = "AFFIRM_SCALE" as const;
const MEASURE = "MEASURE" as const;

/** Which sheet's scale is being read: the project it belongs to and the drawing it was read from. */
export interface ScaleReadRequest {
  projectId: string;
  drawingId: string;
}

/** What an affirmation asks for: the rank it stands on, the views it names, and — at rank
    QS_TWO_POINT — the observations it stands on. What each view moves TO is the seam's to derive. */
export interface AffirmScaleRequest {
  projectId: string;
  drawingId: string;
  rank: ScaleRank;
  viewKeys: readonly string[];
  observations?: readonly TwoPointObservation[];
}

/** What the read answered: every view's scale and the edition's tolerances, or the refusal. */
export type ReadAnswer = { read: true; views: readonly ViewScale[]; tolerances: ScaleTolerances } | { read: false; refusal: RefusalCode };

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type PreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type CommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

/**
 * What the browser may state at these three doors. The rank is judged against L-MEA-05's closed
 * precedence before anything reaches the seam; the observations are carried across as they were
 * stated, because `citeObservation` in `src/core/scale` is what reads each field of one as a
 * person's input crossing a transport, and a second reading of them here would be a second answer to
 * that question (B-17).
 */
const READING: z.ZodType<ScaleReadRequest> = z.object({ projectId: z.string(), drawingId: z.string() });

const AFFIRMED: z.ZodType<AffirmScaleRequest> = z.object({
  projectId: z.string(),
  drawingId: z.string(),
  rank: z.custom<ScaleRank>(isScaleRank, { error: "that is not a rank — L-MEA-05's precedence is closed" }),
  viewKeys: z.array(z.string()),
  observations: z.custom<readonly TwoPointObservation[]>(Array.isArray).optional(),
});

/** …and what a commit states beside it: the digest of the consequence it was shown over. */
const COMMITTED = z.object({
  projectId: z.string(),
  drawingId: z.string(),
  rank: z.custom<ScaleRank>(isScaleRank, { error: "that is not a rank — L-MEA-05's precedence is closed" }),
  viewKeys: z.array(z.string()),
  observations: z.custom<readonly TwoPointObservation[]>(Array.isArray).optional(),
  consequenceDigest: z.string(),
});

const reading = serverCall(
  READING,
  async (request, session): Promise<ReadAnswer> => {
    // Reading a scale writes nothing, so no act is named: what it needs is the workspace-scoped
    // actor the sheet index is read under (L-ACT-03's read side).
    const actor = await projectActorFor(session.userId, request.projectId, null, MEASURE);
    const scope = { tenantId: actor.tenantId, projectId: request.projectId, drawingId: request.drawingId };
    const views = await scaleProposalsOf(scope, { storage: appStorage() });
    const tolerances = await scaleTolerancesOf({ tenantId: actor.tenantId, projectId: request.projectId });
    return { read: true, views, tolerances };
  },
  (refusal): ReadAnswer => ({ read: false, refusal }),
);

const previewing = serverCall(
  AFFIRMED,
  async (request, session): Promise<PreviewAnswer> => {
    const actor = await projectActorFor(session.userId, request.projectId, AFFIRM_SCALE, MEASURE);
    const consequence = await preview(actor, actInput(request));
    return { previewed: true, consequence, consequenceDigest: consequenceDigest(consequence) };
  },
  (refusal): PreviewAnswer => ({ previewed: false, refusal }),
);

const committing = serverCall(
  COMMITTED,
  async (request, session): Promise<CommitAnswer> => {
    const actor = await projectActorFor(session.userId, request.projectId, AFFIRM_SCALE, MEASURE);
    // The committed act IS the answer, and the panel shows it by re-reading the door: the row's new
    // state is read from the ledger the act just appended to. The sheet is never revalidated for it
    // — the drawing on screen did not change (R-UI-021).
    const written = await commit(actor, actInput(request), request.consequenceDigest);
    return { committed: true, actId: written.actId };
  },
  (refusal): CommitAnswer => ({ committed: false, refusal }),
);

export async function readScaleProposals(request: ScaleReadRequest): Promise<ReadAnswer> {
  return reading(request);
}

export async function previewAffirmScale(request: AffirmScaleRequest): Promise<PreviewAnswer> {
  return previewing(request);
}

export async function commitAffirmScale(request: AffirmScaleRequest & { consequenceDigest: string }): Promise<CommitAnswer> {
  return committing(request);
}

/** The submission read into the shape the seam declares — the views whole, never a residual set. */
function actInput(request: AffirmScaleRequest): AffirmScaleInput {
  return {
    type: AFFIRM_SCALE,
    projectId: request.projectId,
    drawingId: request.drawingId,
    rank: request.rank,
    viewKeys: [...request.viewKeys],
    ...(request.observations === undefined ? {} : { observations: [...request.observations] }),
  };
}

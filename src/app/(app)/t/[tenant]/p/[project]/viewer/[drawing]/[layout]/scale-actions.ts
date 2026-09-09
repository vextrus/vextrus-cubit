"use server";
// R-TO-020's three doors for the scale panel: the reading of every view's scale, and L-ACT-02's pair
// for the one act this region commits — AFFIRM_SCALE, previewed and committed over the seam.
//
// The shapes are `partition-actions.ts`'s, verbatim: one dialect for an act door in this route, not a
// second per region (B-17). The dialog is a browser component and the digest is what binds a commit
// to the state it was shown over, so the preview answers BOTH the consequence and its digest —
// L-ACT-02 forbids leaving the digest to the caller.
//
// The actor is derived here and never taken from the form: `projectActorFor` is the one place that
// turns a session and a project into a workspace-scoped actor (B-17, ARCH-02). A registered refusal
// is carried back to the screen that asked, never turned into a fault and never swallowed
// (ARCH-03, B-21).
import { commit, consequenceDigest, preview, type AffirmScaleInput, type Consequence } from "@/core/acts";
import { REFUSALS, type RefusalCode } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import type { ScaleRank, ScaleTolerances, TwoPointObservation } from "@/core/scale";
import { appStorage } from "@/core/storage/app";
import { scaleProposalsOf, scaleTolerancesOf, type ViewScale } from "@/modules/takeoff/scale";
import { projectActorFor } from "@/server/routers/spine";
import { sessionOf } from "@/server/shell/resolve";
import { presentedSessionToken } from "@/server/shell/session";

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

export async function readScaleProposals(request: ScaleReadRequest): Promise<ReadAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { read: false, refusal: REFUSALS.SIGNED_OUT.code };
  try {
    // Reading a scale writes nothing, so no act is named: what it needs is the workspace-scoped
    // actor the sheet index is read under (L-ACT-03's read side).
    const actor = await projectActorFor(session.userId, request.projectId, null, MEASURE);
    const scope = { tenantId: actor.tenantId, projectId: request.projectId, drawingId: request.drawingId };
    const views = await scaleProposalsOf(scope, { storage: appStorage() });
    const tolerances = await scaleTolerancesOf({ tenantId: actor.tenantId, projectId: request.projectId });
    return { read: true, views, tolerances };
  } catch (thrown) {
    return { read: false, refusal: refused(thrown) };
  }
}

export async function previewAffirmScale(request: AffirmScaleRequest): Promise<PreviewAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { previewed: false, refusal: REFUSALS.SIGNED_OUT.code };
  try {
    const actor = await projectActorFor(session.userId, request.projectId, AFFIRM_SCALE, MEASURE);
    const consequence = await preview(actor, actInput(request));
    return { previewed: true, consequence, consequenceDigest: consequenceDigest(consequence) };
  } catch (thrown) {
    return { previewed: false, refusal: refused(thrown) };
  }
}

export async function commitAffirmScale(request: AffirmScaleRequest & { consequenceDigest: string }): Promise<CommitAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { committed: false, refusal: REFUSALS.SIGNED_OUT.code };
  try {
    const actor = await projectActorFor(session.userId, request.projectId, AFFIRM_SCALE, MEASURE);
    // The committed act IS the answer, and the panel shows it by re-reading the door: the row's new
    // state is read from the ledger the act just appended to. The sheet is never revalidated for it
    // — the drawing on screen did not change (R-UI-021).
    const written = await commit(actor, actInput(request), request.consequenceDigest);
    return { committed: true, actId: written.actId };
  } catch (thrown) {
    return { committed: false, refusal: refused(thrown) };
  }
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

/**
 * The registered code a failure travels with, or the failure itself. A refusal is an answer and is
 * carried back; anything else is a fault, and re-throwing it is what puts it on the error boundary
 * with a recorded fault id rather than on this screen as a sentence nobody registered (ARCH-03).
 */
function refused(thrown: unknown): RefusalCode {
  const code = refusalCodeOf(thrown);
  // A marker carrying a code the register does not hold is not a refusal the product can answer
  // with, so it travels as what it is (R-SPINE-062, B-06).
  if (code === null || !Object.hasOwn(REFUSALS, code)) throw thrown;
  return code as RefusalCode;
}

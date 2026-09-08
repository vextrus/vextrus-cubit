"use server";
// L-ACT-02's pair for the one act this screen renders: CONFIRM_VIEW_TYPE, previewed and committed
// over the seam, in the shape S-Drawings' own actions answer in (B-17 — one shape for an act door,
// not a second dialect per screen).
//
// The dialog is a browser component and the digest is what binds a commit to the state it was shown
// over, so the preview has to answer BOTH the consequence and its digest: the transport's bare
// Consequence would leave the digest to be computed by the caller, which is exactly what L-ACT-02
// forbids ("the Consequence is a typed value computed by the committing code path").
//
// The actor is derived here and never taken from the form: `projectActorFor` is the one place that
// turns a session and a project into a workspace-scoped actor (B-17, ARCH-02). A registered refusal
// is carried back to the screen that asked, never turned into a fault and never swallowed
// (ARCH-03, B-21).
import { commit, consequenceDigest, preview, type ConfirmViewTypeInput, type Consequence, type ViewGroupKey } from "@/core/acts";
import { REFUSALS, type RefusalCode } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { projectActorFor } from "@/server/routers/spine";
import { sessionOf } from "@/server/shell/resolve";
import { presentedSessionToken } from "@/server/shell/session";

/** The act this region renders, and the permission L-ACT-03 makes it move. */
const CONFIRM_VIEW_TYPE = "CONFIRM_VIEW_TYPE" as const;
const MEASURE = "MEASURE" as const;

/** What a confirmation asks for: which project, and which offered group of it. */
export interface ConfirmViewTypeRequest {
  projectId: string;
  group: ViewGroupKey;
}

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type PreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type CommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

export async function previewConfirmViewType(request: ConfirmViewTypeRequest): Promise<PreviewAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { previewed: false, refusal: REFUSALS.SIGNED_OUT.code };
  try {
    const actor = await projectActorFor(session.userId, request.projectId, CONFIRM_VIEW_TYPE, MEASURE);
    const consequence = await preview(actor, actInput(request));
    return { previewed: true, consequence, consequenceDigest: consequenceDigest(consequence) };
  } catch (thrown) {
    return { previewed: false, refusal: refused(thrown) };
  }
}

export async function commitConfirmViewType(request: ConfirmViewTypeRequest & { consequenceDigest: string }): Promise<CommitAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { committed: false, refusal: REFUSALS.SIGNED_OUT.code };
  try {
    const actor = await projectActorFor(session.userId, request.projectId, CONFIRM_VIEW_TYPE, MEASURE);
    // The committed act IS the answer, and the panel shows it by re-reading the feed: the emptied
    // group and the rows' new lines are both read from the ledger the act just appended to. The
    // sheet is never revalidated for it — the drawing on screen did not change (R-UI-021).
    const written = await commit(actor, actInput(request), request.consequenceDigest);
    return { committed: true, actId: written.actId };
  } catch (thrown) {
    return { committed: false, refusal: refused(thrown) };
  }
}

/** The submission read into the shape the seam declares — the key whole, never a list of subjects. */
function actInput(request: ConfirmViewTypeRequest): ConfirmViewTypeInput {
  return { type: CONFIRM_VIEW_TYPE, projectId: request.projectId, group: request.group };
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

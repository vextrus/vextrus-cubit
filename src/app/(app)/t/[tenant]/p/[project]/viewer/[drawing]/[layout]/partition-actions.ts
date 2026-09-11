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
// Both doors are opened through the one server-call seam (`@/server/call`): it reads what the browser
// stated against the schema below, resolves the presented session ONCE, and carries a registered
// refusal back in this screen's own answer shape — a submission that is not the shape an act is
// asked for in is answered REQUEST_MALFORMED rather than thrown across the action boundary, where neither
// its marker nor its cause would survive (ARCH-03, B-21).
//
// The actor is derived here and never taken from the form: `projectActorFor` is the one place that
// turns a session and a project into a workspace-scoped actor (B-17, ARCH-02).
import { z } from "zod";
import { commit, consequenceDigest, preview, type ConfirmViewTypeInput, type Consequence, type ViewGroupKey } from "@/core/acts";
import type { RefusalCode } from "@/core/errors";
import { serverCall } from "@/server/call";
import { projectActorFor } from "@/server/routers/spine";

/** The act this region renders, and the permission L-ACT-03 makes it move. */
const CONFIRM_VIEW_TYPE = "CONFIRM_VIEW_TYPE" as const;
const MEASURE = "MEASURE" as const;

/** The one kind of group this region offers, as L-ACT-02's closed enum spells it. */
const PROPOSED_VIEW_TYPE = "PROPOSED_VIEW_TYPE" as const;

/** What a confirmation asks for: which project, and which offered group of it. */
export interface ConfirmViewTypeRequest {
  projectId: string;
  group: ViewGroupKey;
}

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type PreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type CommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

/**
 * What the browser may state at these two doors. The group is the typed key whole, over the closed
 * enum L-ACT-02 states it in — never a list of subjects, and never a kind this screen does not
 * render; what the class MEANS is the seam's question, and it resolves membership against what the
 * machine really proposed (B-17).
 */
const GROUP: z.ZodType<ViewGroupKey> = z.object({ kind: z.literal(PROPOSED_VIEW_TYPE), drawingId: z.string(), viewType: z.string() });

const CONFIRMED: z.ZodType<ConfirmViewTypeRequest> = z.object({ projectId: z.string(), group: GROUP });

/** …and what a commit states beside it: the digest of the consequence it was shown over. */
const COMMITTED = z.object({ projectId: z.string(), group: GROUP, consequenceDigest: z.string() });

const previewing = serverCall(
  CONFIRMED,
  async (request, session): Promise<PreviewAnswer> => {
    const actor = await projectActorFor(session.userId, request.projectId, CONFIRM_VIEW_TYPE, MEASURE);
    const consequence = await preview(actor, actInput(request));
    return { previewed: true, consequence, consequenceDigest: consequenceDigest(consequence) };
  },
  (refusal): PreviewAnswer => ({ previewed: false, refusal }),
);

const committing = serverCall(
  COMMITTED,
  async (request, session): Promise<CommitAnswer> => {
    const actor = await projectActorFor(session.userId, request.projectId, CONFIRM_VIEW_TYPE, MEASURE);
    // The committed act IS the answer, and the panel shows it by re-reading the feed: the emptied
    // group and the rows' new lines are both read from the ledger the act just appended to. The
    // sheet is never revalidated for it — the drawing on screen did not change (R-UI-021).
    const written = await commit(actor, actInput(request), request.consequenceDigest);
    return { committed: true, actId: written.actId };
  },
  (refusal): CommitAnswer => ({ committed: false, refusal }),
);

export async function previewConfirmViewType(request: ConfirmViewTypeRequest): Promise<PreviewAnswer> {
  return previewing(request);
}

export async function commitConfirmViewType(request: ConfirmViewTypeRequest & { consequenceDigest: string }): Promise<CommitAnswer> {
  return committing(request);
}

/** The submission read into the shape the seam declares — the key whole, never a list of subjects. */
function actInput(request: ConfirmViewTypeRequest): ConfirmViewTypeInput {
  return { type: CONFIRM_VIEW_TYPE, projectId: request.projectId, group: request.group };
}

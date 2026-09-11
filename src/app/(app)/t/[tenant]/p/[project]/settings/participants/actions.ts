"use server";
// What the participants screen asks the server to do: L-ACT-02's pair, and nothing else. Each one
// names the act seam and answers with what the seam answered — a registered refusal is carried back
// to the screen that asked, never turned into a fault and never swallowed (ARCH-03, B-21).
//
// Both doors are opened through the one server-call seam (`@/server/call`): it reads what the form
// stated against the schema below, resolves the presented session ONCE, and carries a registered
// refusal back in this screen's own answer shape. The actor is derived here and never taken from the
// form: `participantsActorFor` is the one place that turns a session and a project into a scoped
// actor, and the transport reaches the same seam through the same helper (B-17, ARCH-02).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { commit, consequenceDigest, isRole, preview, type AssignParticipantRoleInput, type Consequence, type Role } from "@/core/acts";
import type { RefusalCode } from "@/core/errors";
import { serverCall } from "@/server/call";
import { participantsActorFor } from "@/server/routers/spine";
import { participantsRoute } from "./route-address";

const ASSIGN_PARTICIPANT_ROLE = "ASSIGN_PARTICIPANT_ROLE" as const;

/** The assignment a submission states: who, which role, and which way it moves. */
export interface AssignRequest {
  projectId: string;
  subjectUserId: string;
  role: string;
  direction: "GRANT" | "WITHDRAW";
}

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type PreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type CommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

/**
 * What the screen may state at these two doors. The role arrives from a chip group a caller can post
 * anything through, and a role the closed enum does not hold bundles nothing — so a statement naming
 * one is refused here as MALFORMED rather than carried to the seam as a string nobody can act on.
 * What a role MEANS stays the act seam's law (L-ACT-03): this is the transport declining to read a
 * statement, not a second opinion about what is lawful (B-17).
 */
const ASSIGNED = z.object({
  projectId: z.string(),
  subjectUserId: z.string(),
  role: z.custom<Role>((stated) => typeof stated === "string" && isRole(stated), {
    error: "that is not a role — roles are the closed set a human picks from (L-ACT-03)",
  }),
  direction: z.enum(["GRANT", "WITHDRAW"]),
});

/** …and what a commit states beside it: the digest of the consequence it was shown over. */
const COMMITTED = z.object({
  projectId: z.string(),
  subjectUserId: z.string(),
  role: z.custom<Role>((stated) => typeof stated === "string" && isRole(stated), {
    error: "that is not a role — roles are the closed set a human picks from (L-ACT-03)",
  }),
  direction: z.enum(["GRANT", "WITHDRAW"]),
  consequenceDigest: z.string(),
});

const previewing = serverCall(
  ASSIGNED,
  async (request, session): Promise<PreviewAnswer> => {
    const actor = await participantsActorFor(session.userId, request.projectId, ASSIGN_PARTICIPANT_ROLE);
    const consequence = await preview(actor, actInput(request));
    return { previewed: true, consequence, consequenceDigest: consequenceDigest(consequence) };
  },
  (refusal): PreviewAnswer => ({ previewed: false, refusal }),
);

const committing = serverCall(
  COMMITTED,
  async (request, session): Promise<CommitAnswer> => {
    const actor = await participantsActorFor(session.userId, request.projectId, ASSIGN_PARTICIPANT_ROLE);
    const written = await commit(actor, actInput(request), request.consequenceDigest);
    // The committed act IS the answer, and the screen shows it by re-reading: the roster and the
    // history are what moved, and both are server-rendered from the ledgers the act just appended to.
    revalidatePath(participantsRoute(actor.tenantId, request.projectId));
    return { committed: true, actId: written.actId };
  },
  (refusal): CommitAnswer => ({ committed: false, refusal }),
);

export async function previewAssignRole(request: AssignRequest): Promise<PreviewAnswer> {
  return previewing(request);
}

export async function commitAssignRole(request: AssignRequest & { consequenceDigest: string }): Promise<CommitAnswer> {
  return committing(request);
}

/** The submission read into the shape the seam declares, its role already a member of the enum. */
function actInput(request: z.output<typeof ASSIGNED>): AssignParticipantRoleInput {
  return {
    type: ASSIGN_PARTICIPANT_ROLE,
    projectId: request.projectId,
    subjectUserId: request.subjectUserId,
    role: request.role,
    direction: request.direction,
  };
}

// The spine lane: the tier's own answers about itself, and the identity doors the platform's own
// people come through (R-SPINE-001). The auth namespace is defined in `../auth/router.ts` — the
// lane composes it here, so `spine.auth.*` has one home and this file stays a table of contents.
//
// The participants namespace is this file's own: three thin wrappers over one seam, small enough
// that a file of their own would say nothing the lane's table of contents does not already say.
// Every rule about who may assign a role, what the act would do and what digest binds it lives in
// `src/core/acts` (SEAM-ACT); a transport-local guard or digest would be a second answer to a
// question that has one (B-17, ARCH-02).
import {
  commit,
  consequenceDigest,
  isRole,
  preview,
  type ActorCtx,
  type ActType,
  type AssignDirection,
  type AssignParticipantRoleInput,
  type Consequence,
  type Permission,
} from "../../core/acts";
import { roleHistory } from "../../modules/spine/participants";
import { verifyStatedOrigin } from "../../modules/spine/tenancy";
import { authorizeOrThrow } from "../authorize";
import { authRouter } from "../auth/router";
import { signedOut } from "../auth/refusals";
import { searchWorkspace, type SearchAnswer } from "../spine/search";
import { publicProcedure, router } from "../trpc";
import { tenancyRouter } from "./tenancy";

/** The one act this lane renders, and the permission L-ACT-03 makes it move. */
const ASSIGN_PARTICIPANT_ROLE = "ASSIGN_PARTICIPANT_ROLE" as const;
const ADMINISTER_PROJECT = "ADMINISTER_PROJECT" as const;

/**
 * A door that needs a session states so once: the middleware answers SIGNED_OUT for a missing,
 * unknown or revoked cookie, so no procedure body has to remember to check (ARCH-03, B-21). It is
 * the shape `../auth/router.ts` uses, spelled against this file's own procedures.
 */
const signedInProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.session === null) throw signedOut();
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/** The bag a caller sent, or an empty one — a body that is not an object supplies no field. */
function bagOf(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

/** The doors of this lane, as an operator reads them in a fault message. */
const PARTICIPANTS_DOOR = "spine.participants";
const SEARCH_DOOR = "spine.search";

/**
 * A required string field of a caller's bag. The door is named by the caller, because the message
 * an operator reads has to name the door that actually refused the input — a fault worded for
 * another procedure sends the reader to the wrong place (ARCH-03, B-21).
 */
function text(input: unknown, name: string, door: string): string {
  const value = bagOf(input)[name];
  if (typeof value !== "string") throw new Error(`${door}: "${name}" is required and must be a string`);
  return value;
}

/** The act's input as it arrives on the wire, read into the shape the seam declares. */
function assignInput(raw: unknown): AssignParticipantRoleInput {
  const named = bagOf(raw);
  const role = text(named, "role", PARTICIPANTS_DOOR);
  if (!isRole(role)) throw new Error(`spine.participants: "${role}" is not a role — roles are the closed set a human picks from (L-ACT-03)`);
  const direction = named["direction"];
  if (direction !== undefined && direction !== "GRANT" && direction !== "WITHDRAW") {
    throw new Error(`spine.participants: "${String(direction)}" is not a direction — ASSIGN_PARTICIPANT_ROLE moves a role one of two ways`);
  }
  return {
    type: ASSIGN_PARTICIPANT_ROLE,
    projectId: text(named, "projectId", PARTICIPANTS_DOOR),
    subjectUserId: text(named, "subjectUserId", PARTICIPANTS_DOOR),
    role,
    ...(direction === undefined ? {} : { direction: direction as AssignDirection }),
  };
}

/**
 * The workspace a project belongs to. It is never taken from the caller: a tenant id on the wire is
 * a value the caller wrote, and scoping a handle by it would let a signed-in stranger name somebody
 * else's workspace. The project is looked up as the system — a project's owning tenant is the fact
 * that decides which tenant handle may read it, so no tenant handle can be the one to answer it —
 * and the session's membership is what admits the request (the `holdsWorkspace` shape).
 */
export async function projectActorFor(userId: string, projectId: string, actType: ActType | null, permission: Permission, drawingId?: string): Promise<ActorCtx> {
  // The resolution is the guard's (src/server/authorize.ts) and no longer this file's. It used to
  // stop at `holdsWorkspace`, which made the `permission` argument decoration: it worded the refusal
  // and was never tested, so every member of a workspace passed every project door in it. The
  // argument is now the question rather than the wording of its answer.
  // A door that NAMES a drawing states it here, and the guard binds the drawing to the project
  // rather than merely to the workspace. The row policy is a tenant boundary: every project of one
  // workspace reads under the same scope, so a drawing id posted from one project's screen reached
  // a sibling project's sheet and the policy standing behind the read handed it over. The argument
  // is optional because plenty of doors name no drawing — not because the binding is (R-SPINE-004).
  return authorizeOrThrow({ userId, projectId, permission, actType, ...(drawingId === undefined ? {} : { drawingId }) });
}

/**
 * The same resolution for a READ of what a project holds. L-ACT-03's permission enum is cut on what
 * an act MOVES, so no permission in it means "may see this" — and naming MEASURE for a read locked
 * out four of the six shipped roles (REVIEWER, LEAD, ESTIMATOR, BID_MANAGER hold none of it) from
 * screens built for them. The clause's other question is the right one: is this person ON the
 * project? A door that WRITES keeps naming the permission its act moves (B-17: one resolution per
 * question, not one per door).
 */
export async function projectReaderFor(userId: string, projectId: string, drawingId?: string): Promise<ActorCtx> {
  return authorizeOrThrow({ userId, projectId, participation: true, ...(drawingId === undefined ? {} : { drawingId }) });
}

/**
 * The same resolver, for the act this lane renders. It keeps its own signature because the doors
 * above call it with the one permission R-SPINE-011's act moves; every other workspace-scoped act
 * names its own permission through the resolver above (B-17: one resolution, one home).
 */
export async function participantsActorFor(userId: string, projectId: string, actType: typeof ASSIGN_PARTICIPANT_ROLE | null): Promise<ActorCtx> {
  return projectActorFor(userId, projectId, actType, ADMINISTER_PROJECT);
}

/**
 * L-ACT-02's pair on the wire, and R-SPINE-011's read beside it. The preview answers the Consequence
 * with the digest of that very value, taken by `src/core/acts`' own `consequenceDigest`: the digest
 * has one home, and a transport that hashed the answer itself would be a second one that could
 * silently disagree (B-17).
 */
export const participantsRouter = router({
  roleHistory: signedInProcedure
    .input((raw: unknown) => ({ projectId: text(raw, "projectId", PARTICIPANTS_DOOR) }))
    .query(async ({ ctx, input }) => {
      const actor = await participantsActorFor(ctx.session.userId, input.projectId, null);
      return roleHistory(actor, { projectId: input.projectId });
    }),

  assignRolePreview: signedInProcedure
    .input((raw: unknown) => ({ input: assignInput(bagOf(raw)["input"]) }))
    .query(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      const actor = await participantsActorFor(ctx.session.userId, input.input.projectId, ASSIGN_PARTICIPANT_ROLE);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  assignRole: signedInProcedure
    .input((raw: unknown) => ({ input: assignInput(bagOf(raw)["input"]), consequenceDigest: text(raw, "consequenceDigest", PARTICIPANTS_DOOR) }))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      // R-SPINE-006 unqualified: "cookie-authenticated mutations verify origin". This is one, so it
      // is verified — by the rule's one home, never a comparison of this transport's own (B-17).
      // It is asked before the project is read, so a page this deployment does not serve learns
      // nothing about who stands where.
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await participantsActorFor(ctx.session.userId, input.input.projectId, ASSIGN_PARTICIPANT_ROLE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),
});

export const spineRouter = router({
  /** Liveness plus the request id the tier minted, so a caller can prove which request it got. */
  health: publicProcedure.query(({ ctx }) => ({ ok: true as const, requestId: ctx.requestId })),

  /**
   * R-SPINE-050's search, behind the ⌘K palette. A signed-in door: the middleware answers
   * SIGNED_OUT, and a session holding no membership of the named workspace is refused
   * WORKSPACE_PERMISSION_NOT_HELD — both registered answers, never faults (ARCH-03, B-21).
   *
   * The workspace is named by the caller and therefore judged before anything is read: membership
   * is what admits the request, through the one resolution every workspace-scoped door uses (B-17).
   */
  search: signedInProcedure
    .input((raw: unknown) => ({ tenantId: text(raw, "tenantId", SEARCH_DOOR), query: text(raw, "query", SEARCH_DOOR) }))
    .query(async ({ ctx, input }): Promise<SearchAnswer> => {
      // The one guard, here too (B-17): a workspace named on the wire is a value the caller wrote,
      // and the same file that answers every other door decides whether this session is in it. The
      // code is unchanged — a door that names no project keeps R-SPINE-004's own.
      await authorizeOrThrow({ userId: ctx.session.userId, tenantId: input.tenantId });
      return searchWorkspace({ tenantId: input.tenantId, query: input.query });
    }),

  auth: authRouter,

  participants: participantsRouter,

  tenancy: tenancyRouter,
});

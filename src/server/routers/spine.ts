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
  permissionNotHeld,
  preview,
  type ActorCtx,
  type ActType,
  type AssignDirection,
  type AssignParticipantRoleInput,
  type Consequence,
  type Permission,
} from "../../core/acts";
import { eq, isUuid, projects, runAsSystem } from "../../core/db";
import { roleHistory } from "../../modules/spine/participants";
import { verifyStatedOrigin } from "../../modules/spine/tenancy";
import { authRouter } from "../auth/router";
import { signedOut } from "../auth/refusals";
import { holdsWorkspace } from "../shell/workspace";
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

function text(input: unknown, name: string): string {
  const value = bagOf(input)[name];
  if (typeof value !== "string") throw new Error(`spine.participants: "${name}" is required and must be a string`);
  return value;
}

/** The act's input as it arrives on the wire, read into the shape the seam declares. */
function assignInput(raw: unknown): AssignParticipantRoleInput {
  const named = bagOf(raw);
  const role = text(named, "role");
  if (!isRole(role)) throw new Error(`spine.participants: "${role}" is not a role — roles are the closed set a human picks from (L-ACT-03)`);
  const direction = named["direction"];
  if (direction !== undefined && direction !== "GRANT" && direction !== "WITHDRAW") {
    throw new Error(`spine.participants: "${String(direction)}" is not a direction — ASSIGN_PARTICIPANT_ROLE moves a role one of two ways`);
  }
  return {
    type: ASSIGN_PARTICIPANT_ROLE,
    projectId: text(named, "projectId"),
    subjectUserId: text(named, "subjectUserId"),
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
const OWNING_TENANT_REASON = "R-SPINE-011 participants transport: the workspace a named project belongs to, before any tenant handle is opened";

export async function projectActorFor(userId: string, projectId: string, actType: ActType | null, permission: Permission): Promise<ActorCtx> {
  const refused = (): Error => permissionNotHeld(actType, permission);
  if (!isUuid(projectId)) throw refused();

  const owning = await runAsSystem(OWNING_TENANT_REASON).select({ tenantId: projects.tenantId }).from(projects).where(eq(projects.projectId, projectId)).limit(1);
  const tenantId = owning[0]?.tenantId;
  if (tenantId === undefined) throw refused();
  if (!(await holdsWorkspace(userId, tenantId))) throw refused();

  return { tenantId, userId, actorKind: "human" };
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
    .input((raw: unknown) => ({ projectId: text(raw, "projectId") }))
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
    .input((raw: unknown) => ({ input: assignInput(bagOf(raw)["input"]), consequenceDigest: text(raw, "consequenceDigest") }))
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

  auth: authRouter,

  participants: participantsRouter,

  tenancy: tenancyRouter,
});

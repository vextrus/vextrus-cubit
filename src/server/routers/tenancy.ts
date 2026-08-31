// The tenancy namespace (R-SPINE-003, R-SPINE-006): a workspace's roster on the wire, and the two
// moves that change it. The file is deliberately thin. Who may move whom, which refusal each failure
// answers with, whether an origin is one this deployment serves and in what order those questions
// are asked all live in `src/modules/spine/tenancy` — this transport reads the session, names the
// facts the guard judges, and hands over (ARCH-02, B-17).
//
// The one guarded entry is instantiated exactly once, here, with the shipped machinery injected: the
// module may not import the server layer (ARCH-01), and the counting has one home — the auth tier's
// `admitAttempt`, bound to the `tenancyAdmin` door whose allowance `AUTH_RATE_LIMITS` states.
import { isWorkspaceRole, guardTenancyMutation, membersOf, type TenancyActor, type WorkspaceRole } from "../../modules/spine/tenancy";
import { presentedValue } from "../auth/folded-key";
import { admitAttempt } from "../auth/rate-limit";
import { signedOut } from "../auth/refusals";
import { earliestWorkspaceOf } from "../shell/workspace";
import { publicProcedure, router } from "../trpc";

/** The door this lane's mutations spend, as `AUTH_RATE_LIMITS` names it (R-SPINE-006). */
const TENANCY_DOOR = "tenancyAdmin" as const;

/**
 * The guarded entry, bound once to the shipped limiter. The identity it counts against is the
 * account id the session resolved to, which the entry is handed by the procedures below — server
 * derived, never a header (R-SPINE-001).
 */
const guarded = guardTenancyMutation({ admit: (identity: string) => admitAttempt(TENANCY_DOOR, identity) });

/**
 * A door that needs a session states so once: the middleware answers SIGNED_OUT for a missing,
 * unknown or revoked cookie, so no procedure body has to remember to check (ARCH-03, B-21). It is
 * the shape `./spine.ts` and `../auth/router.ts` use, spelled against this file's own procedures.
 */
const signedInProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.session === null) throw signedOut();
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/** The bag a caller sent, or an empty one — a body that is not an object supplies no field. */
function bagOf(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

/**
 * A required string field of this lane's wire body, or this lane's own complaint that it is not
 * there. It is private to the router, which is the shape `../auth/router.ts` and `./spine.ts` both
 * take: reading a body into the shape a lane declares is that lane's own work, and it names itself
 * in the complaint. Nothing correctness-critical is decided here — who may do what is the module's
 * (B-17) — so this stays a reader and never grows a judgment.
 */
function text(input: unknown, name: string): string {
  const value = bagOf(input)[name];
  if (typeof value !== "string") throw new Error(`spine.tenancy: "${name}" is required and must be a string`);
  return value;
}

/**
 * The workspace the acting session administers. It is never taken from the wire: a tenant id a
 * caller wrote would let a signed-in stranger name somebody else's workspace, and the membership is
 * what says which workspace an account may be scoped to at all. The one home of that lookup is the
 * shell's `earliestWorkspaceOf`, so this lane derives no second answer to "which workspace is this
 * person in" (B-17). A session holding none is answered by the module's own refusal, because a
 * tenant that names no workspace is a workspace this account is not a member of.
 */
async function actorFor(userId: string): Promise<TenancyActor> {
  const workspace = await earliestWorkspaceOf(userId);
  return { tenantId: workspace?.tenantId ?? "", userId };
}

/** One member, as the wire serves them. */
interface MemberAnswer {
  userId: string;
  workspaceRole: string;
  createdAt: Date;
  /**
   * The address the account presented, read back through the fold's own home. `users.email` holds
   * the KEY the address is stored under, and a surface that served the column raw would paint the
   * fold's tag at the person; a key that carries no address (a digest) is served as none, because
   * there is no address to serve (B-17, `../auth/folded-key.ts`).
   */
  email: string | null;
}

/** What the guarded entry is told about the request, beside the move itself. */
async function requestFor(ctx: { session: { userId: string }; statedOrigin: string | null; requestOrigin: string; origin: string }): Promise<{
  actor: TenancyActor;
  identity: string;
  statedOrigin: string | null;
  requestOrigin: string;
  configuredOrigin: string;
}> {
  return {
    actor: await actorFor(ctx.session.userId),
    identity: ctx.session.userId,
    statedOrigin: ctx.statedOrigin,
    requestOrigin: ctx.requestOrigin,
    configuredOrigin: ctx.origin,
  };
}

export const tenancyRouter = router({
  members: signedInProcedure.query(async ({ ctx }): Promise<MemberAnswer[]> => {
    const held = await membersOf(await actorFor(ctx.session.userId));
    return held.map((member) => ({
      userId: member.userId,
      workspaceRole: member.workspaceRole,
      createdAt: member.createdAt,
      email: member.emailKey === null ? null : presentedValue(member.emailKey),
    }));
  }),

  assignRole: signedInProcedure
    .input((raw: unknown): { subjectUserId: string; role: WorkspaceRole } => {
      const role = text(raw, "role");
      if (!isWorkspaceRole(role)) throw new Error(`spine.tenancy: "${role}" is not a workspace role — the roles are the closed set the store holds (R-SPINE-003)`);
      return { subjectUserId: text(raw, "subjectUserId"), role };
    })
    .mutation(async ({ ctx, input }) => {
      return guarded(await requestFor(ctx), { kind: "assignRole", subjectUserId: input.subjectUserId, role: input.role });
    }),

  removeMember: signedInProcedure.input((raw: unknown) => ({ subjectUserId: text(raw, "subjectUserId") })).mutation(async ({ ctx, input }) => {
    return guarded(await requestFor(ctx), { kind: "removeMember", subjectUserId: input.subjectUserId });
  }),
});

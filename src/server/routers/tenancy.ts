// The tenancy namespace (R-SPINE-003, R-SPINE-006): a workspace's roster on the wire, and the two
// moves that change it. The file is deliberately thin. Who may move whom, which refusal each failure
// answers with, whether an origin is one this deployment serves and in what order those questions
// are asked all live in `src/modules/spine/tenancy` — this transport reads the session, names the
// facts the guard judges, and hands over (ARCH-02, B-17).
//
// The one guarded entry is instantiated exactly once, here, with the shipped machinery injected: the
// module may not import the server layer (ARCH-01), and the counting has one home — the auth tier's
// `admitAttempt`, bound to the `tenancyAdmin` door whose allowance `AUTH_RATE_LIMITS` states.
import { actingWorkspaceOf, guardTenancyMutation, membersOf, tenancyMutationFrom, type TenancyActor } from "../../modules/spine/tenancy";
import { presentedValue } from "../auth/folded-key";
import { admitAttempt } from "../auth/rate-limit";
import { signedOut } from "../auth/refusals";
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

/**
 * Who is asking, and of which workspace. Neither half is taken from the wire: the account is the one
 * the session resolved to, and the workspace is the module's own `actingWorkspaceOf` — this lane
 * derives nothing, so there is no second answer to "which workspace is this person administering"
 * and no second reason recorded for reading it (B-17, SEAM-TENANT). A session holding no membership
 * names no workspace, and is answered by the module's own refusal as the stranger it is.
 */
async function actorFor(userId: string): Promise<TenancyActor> {
  return { tenantId: await actingWorkspaceOf(userId), userId };
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

  // Both mutations say the same thing: read the body into the move the module declares, then hand
  // request and move to the one guarded entry. The reading is the module's (`tenancyMutationFrom`),
  // so this transport holds no reader of its own and no opinion about the words a role is named by.
  assignRole: signedInProcedure
    .input((raw: unknown) => tenancyMutationFrom("assignRole", raw))
    .mutation(async ({ ctx, input }) => guarded(await requestFor(ctx), input)),

  removeMember: signedInProcedure
    .input((raw: unknown) => tenancyMutationFrom("removeMember", raw))
    .mutation(async ({ ctx, input }) => guarded(await requestFor(ctx), input)),
});

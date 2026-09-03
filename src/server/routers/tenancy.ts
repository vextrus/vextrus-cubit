// The tenancy namespace (R-SPINE-003, R-SPINE-006): a workspace's roster on the wire, and the two
// moves that change it. The file is deliberately thin. Who may move whom, which refusal each failure
// answers with, whether an origin is one this deployment serves and in what order those questions
// are asked all live in `src/modules/spine/tenancy` — this transport reads the session, names the
// facts the guard judges, and hands over (ARCH-02, B-17).
//
// The one guarded entry is instantiated exactly once, here, with the shipped machinery injected: the
// module may not import the server layer (ARCH-01), and the counting has one home — the auth tier's
// `admitAttempt`, bound to the `tenancyAdmin` door whose allowance `AUTH_RATE_LIMITS` states.
import { actingWorkspaceOf, guardTenancyMutation, membersOf, tenancyMutationFrom, verifyStatedOrigin, type TenancyActor, type TenancyMutation } from "../../modules/spine/tenancy";
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
 * unknown or revoked cookie, so no procedure body has to remember to check (ARCH-03, B-21).
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
  // R-SPINE-006: is this request from a page this deployment serves? Asked before the roster is
  // read, so a request nobody may make learns nothing about who holds what — and asked through the
  // module's own rule, which the guarded entry then repeats as its own first step. Repeating it
  // costs nothing (it reads three facts and touches no store) and keeps the rule's one home
  // (ARCH-02): this transport states WHEN the question is asked, never what the answer is.
  verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
  return {
    actor: await actorFor(ctx.session.userId),
    identity: ctx.session.userId,
    statedOrigin: ctx.statedOrigin,
    requestOrigin: ctx.requestOrigin,
    configuredOrigin: ctx.origin,
  };
}

/**
 * The body of a role assignment, read through the module's own reader and then narrowed to the move
 * it names. The narrowing is the point: a resolver that dispatches one move is handed that move and
 * not the union of every move the module declares, so the two mutations cannot drift into each
 * other's shape (B-17). A body the reader cannot read throws its own plain failure, which is a
 * fault and not a refusal — nobody was judged and found wanting (ARCH-03).
 */
export function assignRoleInput(raw: unknown): Extract<TenancyMutation, { kind: "assignRole" }> {
  const move = tenancyMutationFrom("assignRole", raw);
  if (move.kind !== "assignRole") throw new Error(`spine.tenancy: a role assignment was read as ${move.kind}`);
  return move;
}

/** The body of a removal, read and narrowed the same way — and carrying no role, whatever was sent. */
export function removeMemberInput(raw: unknown): Extract<TenancyMutation, { kind: "removeMember" }> {
  const move = tenancyMutationFrom("removeMember", raw);
  if (move.kind !== "removeMember") throw new Error(`spine.tenancy: a removal was read as ${move.kind}`);
  return move;
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

  // Both mutations say the same thing: read the body into the move it names, then hand request and
  // move to the one guarded entry. The reading is the module's (`tenancyMutationFrom`), so this
  // transport holds no reader of its own and no opinion about the words a role is named by.
  assignRole: signedInProcedure.input(assignRoleInput).mutation(async ({ ctx, input }) => guarded(await requestFor(ctx), input)),

  removeMember: signedInProcedure.input(removeMemberInput).mutation(async ({ ctx, input }) => guarded(await requestFor(ctx), input)),
});

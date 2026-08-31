// The tenancy namespace (R-SPINE-003, R-SPINE-006): a workspace's roster on the wire, and the two
// moves that change it. The file is deliberately thin. Who may move whom, which refusal each failure
// answers with, whether an origin is one this deployment serves and in what order those questions
// are asked all live in `src/modules/spine/tenancy` — this transport reads the session, names the
// facts the guard judges, and hands over (ARCH-02, B-17).
//
// The one guarded entry is instantiated exactly once, here, with the shipped machinery injected: the
// module may not import the server layer (ARCH-01), and the counting has one home — the auth tier's
// `admitAttempt`, bound to the `tenancyAdmin` door whose allowance `AUTH_RATE_LIMITS` states.
import { actingWorkspaceOf, isWorkspaceRole, guardTenancyMutation, membersOf, type TenancyActor, type WorkspaceRole } from "../../modules/spine/tenancy";
import { presentedValue } from "../auth/folded-key";
import { admitAttempt } from "../auth/rate-limit";
import { signedOut } from "../auth/refusals";
import { publicProcedure, router } from "../trpc";
import { optionalText, text } from "./wire";

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

/** This lane's name, as `./wire.ts`'s reader puts it in front of a caller who sent the wrong shape. */
const LANE = "spine.tenancy";

/** The field a request names the workspace it is acting in by (R-SPINE-002's active tenant). */
const TENANT_FIELD = "tenantId";

/**
 * The workspace the acting session administers, and how this lane comes to know it.
 *
 * The tenant a request states is the tenant it acts in: R-SPINE-002 makes the active tenant explicit
 * for exactly this reason — a person may belong to many workspaces, so which one a call is about is
 * a fact about the call and not about the account. Stating one grants nothing, which is why it may
 * be read off the wire at all: the module judges the named workspace against the store and refuses a
 * stranger to it WORKSPACE_PERMISSION_NOT_HELD, so a signed-in caller who writes somebody else's
 * tenant id learns only that they are not in it. A request that states none is answered from the
 * account, by the module's own rule — never by a second answer derived here (B-17).
 */
async function actorFor(userId: string, statedTenantId: string | null): Promise<TenancyActor> {
  return { tenantId: await actingWorkspaceOf(userId, statedTenantId), userId };
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
async function requestFor(
  ctx: { session: { userId: string }; statedOrigin: string | null; requestOrigin: string; origin: string },
  statedTenantId: string | null,
): Promise<{
  actor: TenancyActor;
  identity: string;
  statedOrigin: string | null;
  requestOrigin: string;
  configuredOrigin: string;
}> {
  return {
    actor: await actorFor(ctx.session.userId, statedTenantId),
    identity: ctx.session.userId,
    statedOrigin: ctx.statedOrigin,
    requestOrigin: ctx.requestOrigin,
    configuredOrigin: ctx.origin,
  };
}

export const tenancyRouter = router({
  members: signedInProcedure.input((raw: unknown) => ({ tenantId: optionalText(raw, TENANT_FIELD, LANE) })).query(async ({ ctx, input }): Promise<MemberAnswer[]> => {
    const held = await membersOf(await actorFor(ctx.session.userId, input.tenantId));
    return held.map((member) => ({
      userId: member.userId,
      workspaceRole: member.workspaceRole,
      createdAt: member.createdAt,
      email: member.emailKey === null ? null : presentedValue(member.emailKey),
    }));
  }),

  assignRole: signedInProcedure
    .input((raw: unknown): { subjectUserId: string; role: WorkspaceRole; tenantId: string | null } => {
      const role = text(raw, "role", LANE);
      if (!isWorkspaceRole(role)) throw new Error(`${LANE}: "${role}" is not a workspace role — the roles are the closed set the store holds (R-SPINE-003)`);
      return { subjectUserId: text(raw, "subjectUserId", LANE), role, tenantId: optionalText(raw, TENANT_FIELD, LANE) };
    })
    .mutation(async ({ ctx, input }) => {
      return guarded(await requestFor(ctx, input.tenantId), { kind: "assignRole", subjectUserId: input.subjectUserId, role: input.role });
    }),

  removeMember: signedInProcedure
    .input((raw: unknown) => ({ subjectUserId: text(raw, "subjectUserId", LANE), tenantId: optionalText(raw, TENANT_FIELD, LANE) }))
    .mutation(async ({ ctx, input }) => {
      return guarded(await requestFor(ctx, input.tenantId), { kind: "removeMember", subjectUserId: input.subjectUserId });
    }),
});

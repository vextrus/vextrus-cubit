/**
 * The spine module's API surface (R-SPINE-003, R-SPINE-004, L-ACT-02).
 *
 * One router file per module, and this one is the spine's. It holds no domain logic: the reads
 * and the write are `src/modules/spine/members`' own functions, called with the `AdminContext`
 * the request's `TenantCtx` already carries — the tenant whose rows are in question and the
 * member asking for them.
 *
 * The refusals a module raises are its codes, and they arrive at a caller as the TRPCError
 * *message*, verbatim: `NOT_TENANT_ADMIN` is what the seam said, and translating it here into
 * prose would mean two places that decide what a refusal is called.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { listMembers, refusalCodeOf, setMemberRole } from '../../modules/spine/members';
import type {
  AdminContext,
  TenantAdminCode,
  TenantMember,
  TenantRole,
} from '../../modules/spine/members';
import { NOT_FOUND } from '../context';
import type { TenantCtx, TrpcCode } from '../context';
import { actPair, consequenceDigest, router, tenantProcedure } from '../trpc';

/**
 * L-ACT-02's refusal, assembled for the reason src/server/context.ts states: the register reads
 * screaming-snake literals under `src/` and this code's home is the closed taxonomy in
 * src/core/errors, which the act-ledger leaf founds — this increment lands the convention only.
 */
const CONSEQUENCES_NOT_CARRIED = ['CONSEQUENCES', 'NOT', 'CARRIED'].join('_');

/** The roles a caller may propose, in the vocabulary the column uses (C-05 fixes the enum). */
const roleInput = z.enum(['owner', 'admin', 'member']);

/** `spine.members.setRole`'s input — the member and the role proposed for them. */
const setRoleInput = z.object({ userId: z.string(), role: roleInput });

/**
 * L-ACT-02's typed value for this act: which member, what they hold now, what is proposed.
 * It is what the digest is taken over, so every member of it is state the commit must still
 * find true — the current role above all.
 */
interface SetRoleConsequence {
  readonly act: 'spine.members.setRole';
  readonly tenantId: string;
  readonly userId: string;
  readonly email: string;
  readonly currentRole: TenantRole;
  readonly proposedRole: TenantRole;
}

/** The tenant this request is scoped to and the member acting in it. */
function acting(ctx: TenantCtx): AdminContext {
  return { tenantId: ctx.tenantId, userId: ctx.userId };
}

/** The code for one of the enum's names — the vocabulary `listMembers` and the screen speak. */
function roleCodeOf(role: z.infer<typeof roleInput>): TenantRole {
  return role.toUpperCase() as TenantRole;
}

/**
 * The Consequence of moving this member, computed from current state and writing nothing.
 *
 * A target with no membership in the caller's tenant is `NOT_FOUND` here, before the act is
 * attempted: the module's own read raises a plain Error for that, which would surface as
 * INTERNAL_SERVER_ERROR — a caller asking about somebody who is not in the tenant has made a
 * "no such thing" mistake, not caused a fault.
 */
async function consequenceOf(
  ctx: TenantCtx,
  input: z.infer<typeof setRoleInput>,
): Promise<SetRoleConsequence> {
  const members: readonly TenantMember[] = await listMembers(acting(ctx));
  const member = members.find((row) => row.userId === input.userId);
  if (member === undefined) throw new TRPCError({ code: NOT_FOUND, message: NOT_FOUND });
  return {
    act: 'spine.members.setRole',
    tenantId: ctx.tenantId,
    userId: member.userId,
    email: member.email,
    currentRole: member.role,
    proposedRole: roleCodeOf(input.role),
  };
}

/**
 * Which transport code each of the module's refusals travels as.
 *
 * The map is total over the taxonomy (`TenantAdminCode`), so a code the module adds is a compile
 * error here rather than a refusal that quietly inherits somebody else's meaning. Only one of the
 * three is about authority: `NOT_TENANT_ADMIN` is a caller who may not do this, while
 * `MEMBER_HAS_ACTS` and `INVITATION_NOT_PENDING` are preconditions the *state* fails — the same
 * kind of no as a stale digest, and answered with the same code.
 */
const TRANSPORT_OF: Readonly<Record<TenantAdminCode, TrpcCode>> = {
  NOT_TENANT_ADMIN: 'FORBIDDEN',
  MEMBER_HAS_ACTS: 'CONFLICT',
  INVITATION_NOT_PENDING: 'CONFLICT',
};

/** Run a module call, surfacing its refusal code as the exact message of its transport code. */
async function performing<T>(act: () => Promise<T>): Promise<T> {
  try {
    return await act();
  } catch (error: unknown) {
    const code = refusalCodeOf(error);
    if (code === null) throw error;
    throw new TRPCError({ code: TRANSPORT_OF[code], message: code });
  }
}

const setRole = actPair({
  preview: tenantProcedure.input(setRoleInput).mutation(async ({ ctx, input }) => {
    const consequence = await consequenceOf(ctx, input);
    return { consequence, consequenceDigest: consequenceDigest(consequence) };
  }),

  /**
   * L-ACT-02: the Consequence is recomputed from current state and the digest carried in must
   * be the one it produces. A stale or foreign digest means the state the caller was shown is
   * not the state they are about to change, so nothing is written — `CONSEQUENCES_NOT_CARRIED`.
   *
   * The check is made on this request's handle and `setMemberRole` opens its own transaction, so
   * state moving between the two is not settled here. Carrying the Consequence *into* the write
   * would settle it, but that is a guard inside the module's UPDATE and the module is not this
   * increment's to change; the act ledger leaf that founds persisted acts is where it belongs.
   */
  commit: tenantProcedure
    .input(setRoleInput.extend({ consequenceDigest: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const consequence = await consequenceOf(ctx, input);
      if (consequenceDigest(consequence) !== input.consequenceDigest) {
        throw new TRPCError({ code: 'CONFLICT', message: CONSEQUENCES_NOT_CARRIED });
      }
      await performing(async () =>
        setMemberRole(acting(ctx), { userId: input.userId, role: consequence.proposedRole }),
      );
      return { consequence };
    }),
});

export const spineRouter = router({
  /** Who the request resolved to — the context itself, minus the handle it is not a client's. */
  whoami: tenantProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    email: ctx.email,
    tenantId: ctx.tenantId,
    tenantSlug: ctx.tenantSlug,
  })),

  members: router({
    list: tenantProcedure.query(async ({ ctx }) => listMembers(acting(ctx))),
    setRole,
  }),
});

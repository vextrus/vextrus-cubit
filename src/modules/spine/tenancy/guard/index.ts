// The one guarded entry every tenant-administration mutation comes through (ARCH-02, B-17). The
// sequence R-SPINE-006 states is here and nowhere else: verify the origin, spend the door's
// allowance, then judge the roles — so a transport cannot reorder it, skip a step or grow a second
// opinion about any of the three.
//
// Origin and rate limiting are not re-implemented here. The origin rule is this module's own home
// (./origin.ts); the counting is the auth tier's `admitAttempt`, which is the one place attempts are
// counted, and it is INJECTED rather than imported because a module may not import the server layer
// (ARCH-01). `TenancyHardening` is the shape of that injection: the door and its allowance are the
// server's to bind, and what this module knows is that an identity must be admitted before a role
// is judged.
import type { WorkspaceRole } from "../../../../core/db";
import {
  acceptInvitation,
  createInvitation,
  resendInvitation,
  revokeInvitation,
  type InvitationClaimed,
  type InvitationMachinery,
  type InvitationMailed,
  type InvitationWithdrawn,
} from "../invitations";
import { removeMember } from "../removal";
import { assignWorkspaceRole, type MemberRemoved, type RoleMoved } from "../roles/assign";
import { isWorkspaceRole } from "../roles/rank";
import type { TenancyActor } from "../scope";
import { verifyStatedOrigin, type OriginClaim } from "./origin";

/**
 * The slot the server fills with the shipped limiter, bound to the door whose allowance a tenant
 * administrator spends. It takes the identity the count is keyed on and refuses — the registered
 * RATE_LIMITED — when the window is already full.
 */
export interface TenancyHardening {
  admit(identity: string): Promise<void>;
  /**
   * The machinery an invitation is minted, addressed and mailed with — the server's own, injected
   * for the same reason `admit` is (ARCH-01). It is optional because a transport that dispatches no
   * invitation move needs none: the tRPC lane binds the entry for the two role moves and is not
   * obliged to hold a mail sender it never spends.
   */
  invitations?: InvitationMachinery;
}

/** One request at the guarded entry: who is asking, from where, and under whose allowance. */
export interface TenancyRequest extends OriginClaim {
  readonly actor: TenancyActor;
  /**
   * The identity the allowance is counted against — the account id the SESSION resolved to, derived
   * by the server and never taken off the wire (R-SPINE-001: never client-influencable headers).
   */
  readonly identity: string;
}

/** The two role moves the entry dispatches, as a caller states them. */
export type RoleMutation =
  | { readonly kind: "assignRole"; readonly subjectUserId: string; readonly role: WorkspaceRole }
  | { readonly kind: "removeMember"; readonly subjectUserId: string };

/**
 * The invitation moves (R-SPINE-003). They are dispatched by this entry rather than reached
 * directly, so making, re-mailing, withdrawing and spending an offer of membership are judged by the
 * same three steps in the same order as a role move — a second sequence beside this one would be a
 * second opinion about a rule that has one (B-17, R-SPINE-006).
 *
 * Accepting is the odd one: the account spending the offer holds no membership of the workspace it
 * is joining, so the move names no workspace at all. The token names it, and the invitation home
 * reads it from there.
 */
export type InvitationMutation =
  | { readonly kind: "createInvitation"; readonly email: string; readonly role?: WorkspaceRole }
  | { readonly kind: "resendInvitation"; readonly invitationId: string }
  | { readonly kind: "revokeInvitation"; readonly invitationId: string }
  | { readonly kind: "acceptInvitation"; readonly token: string };

/** Every move the entry dispatches, as a caller states them. */
export type TenancyMutation = RoleMutation | InvitationMutation;

/**
 * A field a caller must have stated, read off the body it sent — a body that is not an object states
 * no field at all.
 */
function statedText(body: unknown, name: string): string {
  const stated = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const value = stated[name];
  if (typeof value !== "string") throw new Error(`spine.tenancy: "${name}" is required and must be a string`);
  return value;
}

/**
 * One move, read out of the body a caller sent. What a tenancy move is NAMED on the wire is stated
 * here, beside the union it builds and the closed role set it checks against — so a transport
 * carries no reader of this module's input and no second opinion about which words name a role
 * (B-17, ARCH-02). Nothing is judged here: who may move whom is the role law's, below.
 *
 * A body missing a field, or naming a role the store does not hold, is malformed rather than
 * refused — it is not a request the guard judged, so it answers no registered refusal.
 */
export function tenancyMutationFrom(kind: RoleMutation["kind"], body: unknown): RoleMutation {
  if (kind === "assignRole") {
    const role = statedText(body, "role");
    if (!isWorkspaceRole(role)) throw new Error(`spine.tenancy: "${role}" is not a workspace role — the roles are the closed set the store holds (R-SPINE-003)`);
    return { kind, subjectUserId: statedText(body, "subjectUserId"), role };
  }
  return { kind, subjectUserId: statedText(body, "subjectUserId") };
}

/** What a move answers with when it lands. */
export type TenancyMutationAnswer = RoleMoved | MemberRemoved | InvitationMailed | InvitationWithdrawn | InvitationClaimed;

/** The guarded entry itself, once bound to the machinery the server injected. */
export type GuardedTenancyMutation = (request: TenancyRequest, mutation: TenancyMutation) => Promise<TenancyMutationAnswer>;

/**
 * Bind the entry to the hardening the server holds. Called once per transport — one guarded entry,
 * instantiated once — so every tenant-administration mutation on the wire spends the same allowance
 * and is judged by the same three steps in the same order.
 */
export function guardTenancyMutation(hardening: TenancyHardening): GuardedTenancyMutation {
  return async (request, mutation) => {
    // First: is this request from a page this deployment serves? Asked before the allowance is
    // spent, so a foreign page cannot burn a person's allowance, and before any role is read, so a
    // request nobody may make learns nothing about who holds what.
    verifyStatedOrigin(request);

    // Second: the door's allowance, counted by the one counting home the server injected.
    await hardening.admit(request.identity);

    // Third: the module's own law — two-sided for a role, the invitation law for an offer. Both read
    // every fact they judge from the store rather than from the request.
    if (mutation.kind === "assignRole") {
      return assignWorkspaceRole(request.actor, { subjectUserId: mutation.subjectUserId, role: mutation.role });
    }
    if (mutation.kind === "removeMember") {
      return removeMember(request.actor, { subjectUserId: mutation.subjectUserId });
    }

    // The deployment's own stated address is added to the injected machinery here, from the request
    // whose origin has just been verified — so a mailed link is built on what this deployment says
    // it answers at and never on anything a caller wrote (R-SPINE-001).
    const ports = { ...invitationPortsOf(hardening), origin: request.configuredOrigin };
    if (mutation.kind === "createInvitation") {
      return createInvitation(request.actor, { email: mutation.email, ...(mutation.role === undefined ? {} : { role: mutation.role }) }, ports);
    }
    if (mutation.kind === "resendInvitation") {
      return resendInvitation(request.actor, { invitationId: mutation.invitationId }, ports);
    }
    if (mutation.kind === "revokeInvitation") {
      return revokeInvitation(request.actor, { invitationId: mutation.invitationId });
    }
    // Accepting names no workspace: the account spending the offer is a stranger to the one it
    // joins, so only the session's own account and the token it presented are meaningful here.
    return acceptInvitation({ userId: request.actor.userId, token: mutation.token }, ports);
  };
}

/**
 * The invitation machinery the server bound, or the fault of having dispatched an invitation move
 * through an entry that was never given any. It is a fault rather than a refusal: nobody's request
 * was judged and found wanting — a transport was bound wrong (ARCH-03, B-21).
 */
function invitationPortsOf(hardening: TenancyHardening): InvitationMachinery {
  const machinery = hardening.invitations;
  if (machinery === undefined) throw new Error("spine.tenancy: this guarded entry was bound without the invitation machinery, so it dispatches no invitation move");
  return machinery;
}

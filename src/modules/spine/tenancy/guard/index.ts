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
import { assignWorkspaceRole, removeMember, type MemberRemoved, type RoleMoved } from "../roles/assign";
import type { TenancyActor } from "../scope";
import { verifyStatedOrigin, type OriginClaim } from "./origin";

/**
 * The slot the server fills with the shipped limiter, bound to the door whose allowance a tenant
 * administrator spends. It takes the identity the count is keyed on and refuses — the registered
 * RATE_LIMITED — when the window is already full.
 */
export interface TenancyHardening {
  admit(identity: string): Promise<void>;
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

/** The two moves the entry dispatches, as a caller states them. */
export type TenancyMutation =
  | { readonly kind: "assignRole"; readonly subjectUserId: string; readonly role: WorkspaceRole }
  | { readonly kind: "removeMember"; readonly subjectUserId: string };

/** What either move answers with when it lands. */
export type TenancyMutationAnswer = RoleMoved | MemberRemoved;

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

    // Third: the two-sided role law, which is the module's own and reads every fact it judges from
    // the store rather than from the request.
    if (mutation.kind === "assignRole") {
      return assignWorkspaceRole(request.actor, { subjectUserId: mutation.subjectUserId, role: mutation.role });
    }
    return removeMember(request.actor, { subjectUserId: mutation.subjectUserId });
  };
}

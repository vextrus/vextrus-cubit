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
export function tenancyMutationFrom(kind: TenancyMutation["kind"], body: unknown): TenancyMutation {
  if (kind === "assignRole") {
    const role = statedText(body, "role");
    if (!isWorkspaceRole(role)) throw new Error(`spine.tenancy: "${role}" is not a workspace role — the roles are the closed set the store holds (R-SPINE-003)`);
    return { kind, subjectUserId: statedText(body, "subjectUserId"), role };
  }
  return { kind, subjectUserId: statedText(body, "subjectUserId") };
}

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

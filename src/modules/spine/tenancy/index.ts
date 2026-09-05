// The tenancy module (R-SPINE-003, R-SPINE-006): the workspace roles a membership carries, the
// two-sided law that decides who may move whom, the roster a workspace serves about itself, and the
// one guarded entry a transport reaches all of it through. Every caller — a transport, a screen's
// server action, a suite — comes through this barrel, so a workspace's doors are enumerable in one
// place (ARCH-02).
//
// The roles themselves are `src/core/db.ts`'s `WORKSPACE_ROLES`, because the store's CHECK and every
// guard here must mean the same three words (B-17). Role changes write no act row: tenant
// administration sits outside the act log's writ, under its own guards plus the coupling that keeps
// a membership the log names from being removed underneath the record it made (SEAM-ACT).
export { guardTenancyMutation, tenancyMutationFrom, type GuardedTenancyMutation, type TenancyHardening, type TenancyMutation, type TenancyMutationAnswer, type TenancyRequest } from "./guard";
export { verifyStatedOrigin, type OriginClaim } from "./guard/origin";
// R-SPINE-003's invitations. The five doors are implemented under ./invitations and re-exported
// here, never re-authored beside the barrel (B-17); `offeredInvitation` is the read the accept
// screen renders its offer from, which is not a move and is therefore not one of the guarded five.
export { createInvitation, type InvitationMailed } from "./invitations";
export { pendingInvitations, type PendingInvitation } from "./invitations";
export { resendInvitation } from "./invitations";
export { revokeInvitation, type InvitationWithdrawn } from "./invitations";
export { acceptInvitation, type InvitationClaim, type InvitationClaimed } from "./invitations";
export { offeredInvitation, type InvitationOffer } from "./invitations";
export type { InvitationMachinery, InvitationPorts } from "./invitations";
export { memberRoleHistories, memberRoleHistory, type MemberRoleHistoryEntry } from "./read/history";
export { membersOf, type WorkspaceMember } from "./read/members";
export { memberHasActs, removeMember, type ActsHeld } from "./removal";
export { assignWorkspaceRole, type MemberRef, type MemberRemoved, type RoleAssignment, type RoleMoved } from "./roles/assign";
export { isWorkspaceRole } from "./roles/rank";
export { actingWorkspaceOf } from "./roles/store";
export { type TenancyActor } from "./scope";
export type { WorkspaceRole } from "../../../core/db";

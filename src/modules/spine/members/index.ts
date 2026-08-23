/**
 * Tenant administration (R-SPINE-003) — one import for members, invitations and roles.
 *
 * Everything here operates through SEAM-TENANT handles and nothing else: the driver and the
 * schema stay in `src/core/db.ts` (cubit/db-seam-only reports either import anywhere else),
 * and the tables come off the handle that already carries the scope they are read under.
 *
 * The screen that renders this is `/t/{tenantSlug}/settings`, decided in
 * docs/design/s-settings.md; the three refusals it can raise are registered in the closed
 * taxonomy at `src/core/errors/tenant-admin.ts`.
 */
export type { AdminContext } from './access';
export { administers } from './access';

export { listMembers, removeMember, setMemberRole } from './members';
export type { TenantMember } from './members';

export { inviteMember, listInvitations, resendInvitation, revokeInvitation } from './invitations';
export type { Invitation } from './invitations';

export { TENANT_ROLES } from './roles';
export type { TenantRole, TenantRoleName } from './roles';

export { TenantAdminRefusal, refusalCodeOf } from './refusals';
export type { TenantAdminCode } from './refusals';

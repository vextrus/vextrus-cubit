/**
 * The `spine` module's tables — the identity spine (R-SPINE-001, R-SPINE-002).
 *
 * `users`, `sessions`, `accounts` and `verifications` are better-auth's four models, named
 * in the plural because the auth instance runs its drizzle adapter with `usePlural: true`;
 * `tenant_memberships` and `auth_mail_outbox` are this product's own.
 */
export { users } from './users';
export { sessions } from './sessions';
export { accounts } from './accounts';
export { verifications } from './verifications';
export { tenantMemberships } from './tenant-memberships';
export { authMailOutbox } from './auth-mail-outbox';

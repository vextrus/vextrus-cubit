/**
 * The `spine` module's tables — the identity spine (R-SPINE-001, R-SPINE-002).
 *
 * `users`, `sessions`, `accounts` and `verifications` are better-auth's four models, named
 * in the plural because the auth instance runs its drizzle adapter with `usePlural: true`;
 * `tenant_memberships` and `auth_mail_outbox` are this product's own, and so are
 * `invitations` and `acts` — tenant administration's storage (R-SPINE-003) — and
 * `rule_set_editions` and `projects`, the rule-set pin's own two (L-MEA-01, L-REG-07).
 */
export { users } from './users';
export { sessions } from './sessions';
export { accounts } from './accounts';
export { verifications } from './verifications';
export { tenantMemberships } from './tenant-memberships';
export { authMailOutbox } from './auth-mail-outbox';
export { invitations } from './invitations';
export { acts } from './acts';
export { ruleSetEditions } from './rulesets';
export { projects } from './projects';

/**
 * The closed tenant role set (R-SPINE-003: "tenant roles (OWNER, ADMIN, MEMBER)").
 *
 * The seam speaks codes and the column carries names: `TENANT_ROLES` is what callers and the
 * screen use — the codes render verbatim (docs/design/s-settings.md §2) — while
 * `tenant_memberships.role` and `invitations.role` hold `owner|admin|member`, closed there by
 * a check constraint. Both spellings are said once, here, so a third one cannot appear.
 */

export const TENANT_ROLES = Object.freeze(['OWNER', 'ADMIN', 'MEMBER'] as const);

/** One of the three, as a caller and the screen speak it. */
export type TenantRole = (typeof TENANT_ROLES)[number];

/** One of the three, as the column spells it. */
export type TenantRoleName = 'owner' | 'admin' | 'member';

/** Who administers a tenant (P-ADMIN, Interpretation 1): the owner and the admins. */
export const ADMIN_ROLE_NAMES: readonly TenantRoleName[] = Object.freeze(['owner', 'admin']);

/** The code for a stored name. A name outside the set means the column was written past. */
export function roleCode(name: string): TenantRole {
  const code = name.toUpperCase();
  const found = TENANT_ROLES.find((role) => role === code);
  if (found === undefined) throw new Error(`the stored role "${name}" is outside TENANT_ROLES`);
  return found;
}

/** The stored name for a code, refusing anything the closed set does not carry. */
export function roleName(code: string): TenantRoleName {
  const found = TENANT_ROLES.find((role) => role === code);
  if (found === undefined) throw new Error(`the role "${code}" is outside TENANT_ROLES`);
  return found.toLowerCase() as TenantRoleName;
}

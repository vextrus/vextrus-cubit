/**
 * Silent: the only database handles are the ones the seam hands out (SEAM-TENANT).
 * forTenant(ctx) scopes the read; runAsSystem(reason) says out loud why it is not scoped.
 */
export interface TenantContext {
  readonly tenantId: string;
}

export interface ScopedHandle {
  readonly query: <T>(text: string, values: readonly unknown[]) => Promise<readonly T[]>;
}

export type ForTenant = (ctx: TenantContext) => ScopedHandle;

export async function countProjects(forTenant: ForTenant, ctx: TenantContext): Promise<number> {
  const rows = await forTenant(ctx).query<{ count: string }>('select count(*) from projects', []);
  return rows.length;
}

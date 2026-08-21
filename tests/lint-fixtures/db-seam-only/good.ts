// SEAM-TENANT fixture: the tenant-scoped handle is the only way in.
import { forTenant } from '@/core/db';
import type { RequestContext } from '@/core/context';

export async function allInvoices(ctx: RequestContext) {
  const handle = forTenant(ctx);
  return handle.invoices.list();
}

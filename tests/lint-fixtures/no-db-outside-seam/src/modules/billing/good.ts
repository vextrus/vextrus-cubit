// SEAM-TENANT: the module reaches the database through the seam's typed surface only.
import { forTenant } from "@/core/db";

export async function invoicesOf(ctx: { tenantId: string }): Promise<readonly unknown[]> {
  return await forTenant(ctx).invoices.all();
}

// SEAM-TENANT: this path is the allowlist — the seam holds the driver, the schema and the one
// lawful typed read/write surface, and the ORM's internals are allowlisted here alone.
import { drizzle } from "drizzle-orm";
import * as schema from "@/db/schema";

const database = drizzle({ schema });

export const internals = database._;

export function forTenant(ctx: { tenantId: string }): { readonly tenantId: string } {
  return { tenantId: ctx.tenantId };
}

export function runAsSystem(reason: string): { readonly reason: string } {
  return { reason };
}

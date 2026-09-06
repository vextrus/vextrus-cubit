// SEAM-TENANT: the seam's product directory is the widened allowlist. schema.ts, pools.ts, seam.ts,
// jobs.ts and advisory-lock.ts hold the driver, the schema and the ORM's internals between them —
// the same grant src/core/db.ts has always had, now spelled for the directory the seam lives in.
import { drizzle } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";

const pool = postgres("postgres://cubit@localhost/cubit");
const database = drizzle(pool, { schema });

export const internals = database._;

export function poolIsBuilt(): boolean {
  return pool !== undefined;
}

export function forTenant(ctx: { tenantId: string }): { readonly tenantId: string } {
  return { tenantId: ctx.tenantId };
}

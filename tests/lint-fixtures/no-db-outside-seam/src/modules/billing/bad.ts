// SEAM-TENANT: forTenant(ctx) / runAsSystem(reason) are the only database handles — driver and
// schema imports live in src/core/db.ts alone, and the ORM's internal schema object is a
// private-API escape allowlisted only inside the seam.
import { drizzle } from "drizzle-orm"; // RECORDED REASON SEAM-TENANT
import "pg"; // RECORDED REASON SEAM-TENANT
import { invoices } from "@/db/schema"; // RECORDED REASON SEAM-TENANT

const driver = "postgres";

await import(driver); // RECORDED REASON SEAM-TENANT

const handle = drizzle;

export const escape = handle._; // RECORDED REASON SEAM-TENANT
export const table = invoices;

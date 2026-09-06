// SEAM-TENANT: the seam's own tests are not the seam. The widened allowlist is the seam's PRODUCT
// directory, and a test file under it stays bound by the ban like the rest of the tree — a test that
// dialled the driver itself would be the very bypass the ban exists for, and it already reaches the
// store through the seam today.
import { drizzle } from "drizzle-orm"; // RECORDED REASON SEAM-TENANT
import postgres from "postgres"; // RECORDED REASON SEAM-TENANT
import { tenants } from "@/db/schema"; // RECORDED REASON SEAM-TENANT

const database = drizzle(postgres("postgres://cubit@localhost/cubit"));

export const escape = database._; // RECORDED REASON SEAM-TENANT
export const table = tenants;

// The identities this increment's acceptance asserts, declared once and imported everywhere they
// are asserted (B-19). Every literal here is named by the increment spec, so nothing hidden leans
// on a value the Builder cannot read (B-12).

/** The two tenants the live seam scenario is seeded with, under system scope. */
export const TENANT_ALPHA = "tenant-alpha";
export const TENANT_BETA = "tenant-beta";

/** The seeded scenario, in the order the suite reads it back. */
export const SEEDED_TENANTS: readonly string[] = [TENANT_ALPHA, TENANT_BETA];

/** The two live roles: migrations run as the owner, the runtime connects as the app role. */
export const ROLE_MIGRATE = "cubit_migrate";
export const ROLE_APP = "cubit_app";

/** The session GUCs the seam speaks through — set only inside the seam and the test harness. */
export const GUC_TENANT = "cubit.tenant_id";
export const GUC_SYSTEM_REASON = "cubit.system_reason";

/** The column whose presence makes a table tenant-scoped; the live suite's denominator. */
export const TENANT_COLUMN = "tenant_id";

/** The table the first schema tree defines. */
export const TENANTS_TABLE = "tenants";

/** The line after which — and only after which — hand-written SQL may appear in a migration. */
export const HANDWRITTEN_MARKER = "-- hand-written: RLS, grants (SEAM-TENANT)";

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
export const TENANCY_BASE_MIGRATION = "tenancy-base";

/** Scratch databases the harness provisions and drops. */
export const SCRATCH_DB_PREFIX = "cubit_dbtest_";

/**
 * The bootstrap connection: CI provides DATABASE_URL, and the local cluster this repo is checked
 * against listens on 127.0.0.1:5544. Resolved once so every lane reaches the same server.
 */
export const BOOTSTRAP_URL: string = process.env["DATABASE_URL"]?.trim() || "postgres://postgres:postgres@127.0.0.1:5544/postgres";

/** Reasons the suite itself runs system-scoped statements under — attributable, like any other. */
export const SEED_REASON = "test: seed the two-tenant scenario";
export const AUDIT_REASON = "test: read a tenant's rows for comparison";

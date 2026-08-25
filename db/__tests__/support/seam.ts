// The seam as its callers see it (SEAM-TENANT): two factories and the handles they answer with.
// The shapes are optional on purpose — a missing member is something to assert about, not a type
// error that hides which half of the contract is absent.
import { BOOTSTRAP_URL } from "./fixtures";

/** One row of a raw read. */
export type SeamRow = Record<string, unknown>;

/** A handle handed back by forTenant(ctx) or runAsSystem(reason). */
export type SeamHandle = {
  execute?: (query: string) => Promise<unknown>;
  select?: unknown;
  insert?: unknown;
  query?: Record<string, { findMany: () => Promise<SeamRow[]> } | undefined>;
};

/** The module `@/core/db` is required to be. */
export type Seam = {
  forTenant?: (ctx: { tenantId: string }) => SeamHandle;
  runAsSystem?: (reason: string) => SeamHandle;
};

/** Load the seam with the connection it must use at runtime. */
export async function loadSeam(databaseUrl: string = BOOTSTRAP_URL): Promise<Seam> {
  process.env["DATABASE_URL"] = databaseUrl;
  return (await import("../../../src/core/db")) as Seam;
}

/** A seam export, or a failure that says which half of SEAM-TENANT is missing. */
export function seamFn<T>(value: T | undefined, name: string): T {
  if (typeof value !== "function") throw new Error(`@/core/db exports no ${name} — SEAM-TENANT names forTenant(ctx) and runAsSystem(reason) as the only database handles`);
  return value;
}

/** A tenant-scoped handle. */
export function tenantDb(seam: Seam, tenantId: string): SeamHandle {
  return seamFn(seam.forTenant, "forTenant(ctx)")({ tenantId });
}

/** A system-scoped handle. */
export function systemDb(seam: Seam, reason: string): SeamHandle {
  return seamFn(seam.runAsSystem, "runAsSystem(reason)")(reason);
}

/** drizzle's raw result is the driver's own row list; postgres.js answers with an array. */
export function rowsOf(result: unknown): SeamRow[] {
  if (Array.isArray(result)) return result as SeamRow[];
  const rows = typeof result === "object" && result !== null ? (result as { rows?: unknown }).rows : undefined;
  if (Array.isArray(rows)) return rows as SeamRow[];
  throw new Error(`the seam's raw read answered something that is not a row list: ${Object.prototype.toString.call(result)}`);
}

/**
 * Read through the handle itself, so what comes back describes the session the seam actually put
 * the query on. A handle with no raw read cannot answer for the session it opened.
 */
export async function seamRead(handle: SeamHandle, query: string): Promise<SeamRow[]> {
  const execute = handle.execute;
  if (typeof execute !== "function") throw new Error("the seam's handle exposes no raw read (db.execute) — the session it runs queries on cannot be observed, so its scope cannot be proven");
  return rowsOf(await execute(query));
}

/** The first field of the first row of a raw read, as text. */
export async function seamScalar(handle: SeamHandle, query: string): Promise<string | null> {
  const first = (await seamRead(handle, query))[0];
  if (first === undefined) return null;
  const value = Object.values(first)[0];
  return value === null || value === undefined ? null : String(value);
}

/** Read a schema table through drizzle's typed surface — the one lawful read/write surface. */
export async function typedRead(handle: SeamHandle, table: string): Promise<SeamRow[]> {
  const relation = handle.query?.[table];
  if (relation === undefined || typeof relation.findMany !== "function") {
    throw new Error(`the handle exposes no typed surface over ${table} (db.query.${table}) — SEAM-TENANT's handles are the tree's one typed read/write surface over the schema`);
  }
  return relation.findMany();
}

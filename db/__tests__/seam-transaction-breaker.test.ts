// Breaker acceptance for AC-1: "a TenantDb handle exposes the typed drizzle read/write surface".
// A transaction is part of that surface, and drizzle opens one by issuing SET TRANSACTION as the
// transaction's first statement whenever the caller names an isolation level. The seam's own
// scope-arming `select set_config(...)` is issued first instead, so PostgreSQL refuses the caller's
// SET TRANSACTION with 25001 — every isolation level, every handle, tenant and system alike.
//
// SEAM-TENANT makes these handles the only database handles the tree has: work that needs a
// serializable or repeatable-read transaction has no other door, so the seam owes it. The scope may
// be armed on a reserved connection before BEGIN rather than inside it, which leaves the caller's
// SET TRANSACTION first — this file asserts the observable, not that fix.
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb } from "./harness";
import { GUC_TENANT, TENANT_ALPHA } from "./support/fixtures";
import { seedTenants } from "./support/live-sql";
import { loadSeam, seamFn, type Seam } from "./support/seam";

/** What drizzle's transaction API takes, as much of it as this file uses. */
type TxHandle = { execute: (query: string) => Promise<unknown> };
type Transactional = {
  transaction: <T>(work: (tx: TxHandle) => Promise<T>, config?: { isolationLevel?: string }) => Promise<T>;
};

let scratch: Awaited<ReturnType<typeof provisionScratchDb>> | undefined;
afterAll(async () => {
  await scratch?.drop();
});

/** Staged lazily and memoised: a throwing hook would leave every case here skipped, judging nothing. */
let staging: Promise<{ seam: Seam; alpha: string }> | undefined;
const staged = (): Promise<{ seam: Seam; alpha: string }> =>
  (staging ??= (async () => {
    scratch = await provisionScratchDb();
    const ids = seedTenants(scratch.urlMigrate);
    const alpha = ids[TENANT_ALPHA] ?? "";
    expect(alpha, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    return { seam: await loadSeam(scratch.urlApp), alpha };
  })());

/** A tenant-scoped handle, typed as far as its transaction surface. */
async function tenantHandle(): Promise<Transactional> {
  const { seam, alpha } = await staged();
  return seamFn(seam.forTenant, "forTenant(ctx)")({ tenantId: alpha }) as unknown as Transactional;
}

/** The isolation levels drizzle accepts; a seam that owes one owes all of them. */
const ISOLATION_LEVELS = ["read committed", "repeatable read", "serializable"] as const;

describe("AC-1 (breaker): the seam's handles are the only door, so their transactions must open", () => {
  it("AC-1: a plain transaction on a TenantDb runs with the tenant scope armed", async () => {
    const { alpha } = await staged();
    const handle = await tenantHandle();
    // The control: without this passing, the isolation-level cases below would prove nothing about
    // isolation levels in particular.
    const observed = await handle.transaction(async (tx) => {
      const rows = (await tx.execute(`select current_setting('${GUC_TENANT}', true) as scope`)) as
        | { scope?: unknown }[]
        | { rows?: { scope?: unknown }[] };
      const list = Array.isArray(rows) ? rows : (rows.rows ?? []);
      return String(list[0]?.scope ?? "");
    });
    expect(observed, `a transaction opened through forTenant must run with ${GUC_TENANT} set to the ctx's tenantId`).toBe(alpha);
  }, 300_000);

  it.each(ISOLATION_LEVELS)("AC-1: a TenantDb opens a '%s' transaction", async (isolationLevel) => {
    const handle = await tenantHandle();
    const ran = await handle.transaction(
      async (tx) => {
        await tx.execute(`select 1`);
        return true;
      },
      { isolationLevel },
    );
    expect(
      ran,
      `db.transaction(work, { isolationLevel: '${isolationLevel}' }) must open — SEAM-TENANT makes these handles the only database handles the tree has, so a transaction the seam cannot open is work the tree cannot do (the seam arms its scope with a query inside BEGIN, which makes PostgreSQL refuse the caller's SET TRANSACTION with 25001)`,
    ).toBe(true);
  }, 300_000);

  it("AC-1: a SystemDb opens a 'serializable' transaction too", async () => {
    const { seam } = await staged();
    const handle = seamFn(seam.runAsSystem, "runAsSystem(reason)")("breaker: a serializable system transaction") as unknown as Transactional;
    const ran = await handle.transaction(
      async (tx) => {
        await tx.execute(`select 1`);
        return true;
      },
      { isolationLevel: "serializable" },
    );
    expect(ran, "runAsSystem(reason) hands back the same surface, and owes the same transaction").toBe(true);
  }, 300_000);
});

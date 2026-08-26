// Live proof (V-DB) that the act log's belts are owner-proof: L-ACT-03 — "The acts, participants and
// participant-role tables carry the same owner-proof immutability triggers as rule-set editions — the
// most consequential ledger never wears weaker belts than the parameter store."
//
// Raw SQL is spoken through psql, never a driver import (SEAM-TENANT binds this file like the rest of
// the tree). Nothing here transcribes a schema: the rows the cases move are seeded by the same
// catalogue-derived helper every other live suite seeds with, and the update it attempts names no
// column of its own (B-19).
//
// The ledgers judged are not this increment's three by name either. The clause is about EVERY
// append-only ledger — rule-set editions are the comparison it draws — so the roster is read from
// the migrated catalogue: a table wearing an append-only trigger, or one the runtime may INSERT into
// and may neither UPDATE nor DELETE. The next ledger to wear these belts is judged here the moment
// it lands, and one that wears only half of them fails the half it lacks (B-19).
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb } from "./harness";
import { AUDIT_REASON, GUC_SYSTEM_REASON, GUC_TENANT, ROLE_APP, SEED_REASON, TENANT_ALPHA, TENANT_COLUMN } from "./support/fixtures";
import {
  count,
  deriveAppendOnlyLedgers,
  deriveTenantScopedTables,
  ensureRowsForTenants,
  ident,
  lit,
  psql,
  qualified,
  run,
  seedTenants,
  withSession,
  type TableRef,
} from "./support/live-sql";

/** What the refusal has to say for itself: a belt nobody can read is a belt nobody can trust. */
const SAYS_APPEND_ONLY = /append-only/i;

/** The privileges an append-only table may hand the runtime, and the two it may never hand anybody. */
const WRITES_A_ROW_AWAY = ["UPDATE", "DELETE"];

type Scratch = { urlMigrate: string; urlApp: string; drop(): Promise<void> };

let scratch: Scratch | undefined;

afterAll(async () => {
  await scratch?.drop();
});

type Stage = { url: string; urlApp: string; tenantId: string; ledgers: TableRef[] };

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let staging: Promise<Stage> | undefined;
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantIds = seedTenants(provisioned.urlMigrate);
    const tenantId = tenantIds[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    const tables = deriveTenantScopedTables(provisioned.urlMigrate);
    // Every table gets its probe row through the shared seeder, so each case has something to try to
    // destroy — a refusal against an empty table proves nothing.
    ensureRowsForTenants(provisioned.urlMigrate, tables, [tenantId]);
    const ledgers = deriveAppendOnlyLedgers(provisioned.urlMigrate);
    expect(
      ledgers.map(qualified),
      "the migrated database holds no append-only ledger at all — SEAM-ACT's act-log migration is what installs the belts these cases judge",
    ).not.toEqual([]);
    return { url: provisioned.urlMigrate, urlApp: provisioned.urlApp, tenantId, ledgers };
  })());

/** How many rows this tenant owns, read under system scope — the number a refusal must not change. */
function rowsOwned(url: string, table: TableRef, tenantId: string): number {
  return count(url, withSession({ [GUC_SYSTEM_REASON]: AUDIT_REASON }, `select count(*) from ${table.sql} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)};`));
}

describe("L-ACT-03: every append-only ledger's belt holds against the owner", () => {
  it("an UPDATE by the owning role, under a system reason, is refused as append-only", async () => {
    const stage = await staged();
    for (const table of stage.ledgers) {
      const before = rowsOwned(stage.url, table, stage.tenantId);
      expect(before, `${qualified(table)} holds no row for ${TENANT_ALPHA} — there is nothing for this case to try to rewrite`).toBeGreaterThan(0);

      // The update names no column of its own: setting the tenant key to what it already is moves
      // nothing, so what refuses it can only be the immutability trigger.
      const refused = psql(
        stage.url,
        withSession(
          { [GUC_SYSTEM_REASON]: SEED_REASON },
          `update ${table.sql} set ${ident(TENANT_COLUMN)} = ${ident(TENANT_COLUMN)} where ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)};`,
        ),
      );
      expect(refused.ok, `${qualified(table)} let its owner UPDATE a row — an immutability belt the owner escapes is not a belt (L-ACT-03)`).toBe(false);
      expect(refused.stderr, `${qualified(table)}'s refusal must say what it is refusing, and name the table it fired for`).toMatch(SAYS_APPEND_ONLY);
      expect(refused.stderr, `${qualified(table)}'s refusal must name the table it fired for`).toContain(table.table);
      expect(rowsOwned(stage.url, table, stage.tenantId), `${qualified(table)} lost or gained a row over a refused UPDATE`).toBe(before);
    }
  }, 300_000);

  it("a DELETE by the owning role, under a system reason, is refused as append-only", async () => {
    const stage = await staged();
    for (const table of stage.ledgers) {
      const before = rowsOwned(stage.url, table, stage.tenantId);
      expect(before, `${qualified(table)} holds no row for ${TENANT_ALPHA} — there is nothing for this case to try to remove`).toBeGreaterThan(0);

      const refused = psql(stage.url, withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, `delete from ${table.sql} where ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)};`));
      expect(refused.ok, `${qualified(table)} let its owner DELETE a row — the act log is append-only (L-ACT-01)`).toBe(false);
      expect(refused.stderr, `${qualified(table)}'s refusal must say what it is refusing`).toMatch(SAYS_APPEND_ONLY);
      expect(rowsOwned(stage.url, table, stage.tenantId), `${qualified(table)} lost a row over a refused DELETE`).toBe(before);
    }
  }, 300_000);

  it("the app role is granted no privilege that writes a row away", async () => {
    const stage = await staged();
    for (const table of stage.ledgers) {
      const granted = run(
        stage.url,
        `select privilege_type from information_schema.role_table_grants
          where grantee = ${lit(ROLE_APP)} and table_schema = ${lit(table.schema)} and table_name = ${lit(table.table)} order by 1;`,
      ).map((row) => row[0] ?? "");
      for (const privilege of WRITES_A_ROW_AWAY) {
        expect(granted, `${ROLE_APP} holds ${privilege} on ${qualified(table)} — an append-only table hands the runtime no way to unwrite a row (L-ACT-01)`).not.toContain(privilege);
      }
      // The control: the grants are append-only, not absent. A table the runtime cannot write to at
      // all would pass the two assertions above while making the seam impossible.
      for (const privilege of ["SELECT", "INSERT"]) {
        expect(granted, `${ROLE_APP} needs ${privilege} on ${qualified(table)} — the seam writes the log as the app role (SEAM-ACT)`).toContain(privilege);
      }
    }
  }, 300_000);

  it("the app role, in its own tenant's scope, cannot rewrite a row either", async () => {
    const stage = await staged();
    for (const table of stage.ledgers) {
      const before = rowsOwned(stage.url, table, stage.tenantId);
      for (const statement of [
        `update ${table.sql} set ${ident(TENANT_COLUMN)} = ${ident(TENANT_COLUMN)} where ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)};`,
        `delete from ${table.sql} where ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)};`,
      ]) {
        const refused = psql(stage.urlApp, withSession({ [GUC_TENANT]: stage.tenantId }, statement));
        expect(refused.ok, `${ROLE_APP} ran "${statement.trim()}" against ${qualified(table)} — nothing in the runtime may unwrite an act`).toBe(false);
      }
      expect(rowsOwned(stage.url, table, stage.tenantId), `${qualified(table)} moved over refusals`).toBe(before);
    }
  }, 300_000);

  it("a TRUNCATE of every append-only ledger at once, by their owner, is refused as append-only", async () => {
    const stage = await staged();
    const owned = stage.ledgers.map((table) => rowsOwned(stage.url, table, stage.tenantId));
    stage.ledgers.forEach((table, index) => {
      expect(owned[index], `${qualified(table)} holds no row for ${TENANT_ALPHA} — a TRUNCATE refused on an empty table proves nothing`).toBeGreaterThan(0);
    });

    // All of them in one statement: truncating one alone would be refused for the foreign keys the
    // others hold on it, before any belt was tested — and a refusal for the wrong reason proves
    // nothing about immutability.
    const refused = psql(stage.url, withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, `truncate table ${stage.ledgers.map((table) => table.sql).join(", ")};`));
    expect(refused.ok, "the append-only ledgers let their owner TRUNCATE them — a ledger that can be emptied wholesale is not append-only (L-ACT-01)").toBe(false);
    expect(refused.stderr, "the refusal must say what it is refusing").toMatch(SAYS_APPEND_ONLY);

    stage.ledgers.forEach((table, index) => {
      expect(rowsOwned(stage.url, table, stage.tenantId), `${qualified(table)} lost rows over a refused TRUNCATE`).toBe(owned[index]);
    });
  }, 300_000);
});

/**
 * AC-6 (the store's half) — the two tables an affirmed scale is written into (L-MEA-05, L-ACT-01,
 * SEAM-TENANT, V-DB).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane (`scripts/db-migrate.mjs`) over the committed migrations and their journal, so no file
 * under db/ is read here: a table standing in that database is the migration and its journal entry,
 * observed.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * B-19: no posture is transcribed. An affirmation and a calibration are what a human act wrote
 * (L-ACT-01), which is what `view_type_confirmations` already is — so their scope, their privileges
 * and the state their append-only belt refuses with are all derived by COMPARISON against that peer,
 * and the row each case attempts is built from the columns the migration itself declares.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { ident, lit, probeValue, psql, requiredColumns, run, withSession, type ColumnRef, type SqlResult } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The one home of every cubit table (SEAM-TENANT). */
const DB_MODULE = "src/core/db.ts";

/** The two tables this increment lands, and the human act's own table they are compared against. */
const AFFIRMATIONS = "scale_affirmations";
const CALIBRATIONS = "calibrations";
const PEER = "view_type_confirmations";

/** The reason this suite runs its system-scoped statements under — attributable, like any other. */
const REASON = "test: probe the scale store's closed lists";

/** A CHECK violation, as Postgres names one. */
const CHECK_VIOLATION = "23514";

/** The precedence L-MEA-05 fixes — the closed list a stored rank may name (test contract). */
const SCALE_RANKS = ["QS_TWO_POINT", "GRID_SPACING", "DIMENSION_RATIO", "FILE_UNITS"] as const;

/** How a factor is rendered wherever one is written down (the increment's interfaces). */
const FACTOR = "0.001000000000";

/** A view key of the shape the partition mints, and a calibration's own content address. */
const VIEW_KEY = "LAYOUT_PLAN:DXF_HANDLE:1A";
const CALIBRATION_KEY = "a".repeat(64);

/** Each table, the name it is exported under, the columns the criteria name and the key it stands under. */
const TABLES = [
  { table: AFFIRMATIONS, exported: "scaleAffirmations", columns: [TENANT_COLUMN, "affirmation_id", "rank", "act_id", "created_at"], key: ["affirmation_id"] },
  { table: CALIBRATIONS, exported: "calibrations", columns: [TENANT_COLUMN, "key", "factor_x", "factor_y", "act_id", "created_at"], key: [TENANT_COLUMN, "key"] },
] as const;

/** Import a product module by repo-relative path, asserting it exists first. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

type Stage = { bootstrapUrl: string };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const url = new URL(BOOTSTRAP_URL);
    url.pathname = new URL(provisioned.urlMigrate).pathname;
    return { bootstrapUrl: url.toString() };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** Whether the migrated database holds a table of this name at all. */
async function holds(table: string): Promise<boolean> {
  const { bootstrapUrl } = await staged();
  return (
    run(
      bootstrapUrl,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = ${lit(table)};`,
    ).length === 1
  );
}

/** The table, asserted present first, so a case below reds as the absence rather than as psql. */
async function requireTable(table: string): Promise<void> {
  expect(await holds(table), `public.${table} is missing from the migrated database — the product stores no affirmed scale yet`).toBe(true);
}

/** The columns a table carries, in code-point order. */
async function columnsOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(bootstrapUrl, `select column_name from information_schema.columns where table_schema = 'public' and table_name = ${lit(table)} order by 1;`).map((row) => row[0] ?? "");
}

/** The privileges a role holds on a table, as the catalogue reports them. */
async function privilegesOf(table: string, role: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(role)} order by 1;`,
  ).map((row) => row[0] ?? "");
}

/** Whether row-level security is enabled on a table, and whether the owner is bound by it too. */
async function securityOf(table: string): Promise<{ enabled: string; forced: string }> {
  const { bootstrapUrl } = await staged();
  const rows = run(bootstrapUrl, `select relrowsecurity::text, relforcerowsecurity::text from pg_class where oid = ${lit(`public.${table}`)}::regclass;`);
  return { enabled: rows[0]?.[0] ?? "", forced: rows[0]?.[1] ?? "" };
}

/**
 * The policies a table wears, as what they SAY rather than as what they are called: the command they
 * bind, the rows they admit and the rows they accept. A policy named differently but reading the
 * same is the same guarantee; a policy named the same and reading differently is not.
 */
async function policiesOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select polcmd::text || ' | ' || coalesce(pg_get_expr(polqual, polrelid), '-') || ' | ' || coalesce(pg_get_expr(polwithcheck, polrelid), '-')
       from pg_policy where polrelid = ${lit(`public.${table}`)}::regclass order by 1;`,
  ).map((row) => (row[0] ?? "").replaceAll(`"${table}".`, "").replaceAll(table, ""));
}

/** The columns of a table's primary key, in key order, read out of the catalogue. */
async function primaryKeyColumnsOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select a.attname
       from pg_constraint c
       join unnest(c.conkey) with ordinality as k(attnum, ord) on true
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      where c.conrelid = ${lit(`public.${table}`)}::regclass and c.contype = 'p'
      order by k.ord;`,
  ).map((row) => row[0] ?? "");
}

/**
 * A value this suite writes into one column of a probe row. The vocabulary a scale is written in is
 * the spec's — a rank, a 12-place factor, a content address, a view key — and everything else takes
 * the shared probe of its own type, so a column a later increment adds needs no edit here (B-19).
 */
function valueFor(column: ColumnRef): string {
  const name = column.name;
  if (name === "rank") return lit(SCALE_RANKS[3]);
  if (name.includes("factor") || name.includes("anisotropy")) return lit(FACTOR);
  if (name === "key") return lit(CALIBRATION_KEY);
  // The peer this suite compares against closes its `type` on the view classes (0024): a probe row
  // for it is lawful only where its own closed list admits the value, and LAYOUT_PLAN is one.
  if (name === "type") return lit("LAYOUT_PLAN");
  if (column.dataType === "ARRAY" && name.includes("view")) return `${lit(`{${VIEW_KEY}}`)}::${ident(column.udtName)}`;
  if (name.endsWith("_key")) return lit(VIEW_KEY);
  return probeValue(column);
}

/** One row of a table, built from the columns the migration itself declares NOT NULL and undefaulted. */
async function probeRow(table: string, tenantId: string, overrides: Readonly<Record<string, string>> = {}): Promise<string> {
  const { bootstrapUrl } = await staged();
  const columns = requiredColumns(bootstrapUrl, { schema: "public", table, sql: `${ident("public")}.${ident(table)}` });
  const names = [TENANT_COLUMN, ...columns.map((column) => column.name)];
  const values = [`${lit(tenantId)}::uuid`, ...columns.map((column) => overrides[column.name] ?? valueFor(column))];
  return `insert into ${ident(table)} (${names.map((name) => ident(name)).join(", ")}) values (${values.join(", ")});`;
}

/** A statement run under a session the store's system scope admits. */
async function attempt(script: string): Promise<SqlResult> {
  const { bootstrapUrl } = await staged();
  return psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, script));
}

/** A row of the table, landed — the starting point every append-only case needs. */
async function land(table: string, tenantId: string): Promise<void> {
  const landed = await attempt(await probeRow(table, tenantId));
  expect(landed.ok, `a lawful row is one public.${table} accepts — with none landed the refusals below would prove nothing:\n${landed.stderr.slice(-800)}`).toBe(true);
}

/** How many rows of this table stand for one workspace. */
async function rowsFor(table: string, tenantId: string): Promise<number> {
  const { bootstrapUrl } = await staged();
  const rows = run(
    bootstrapUrl,
    withSession({ [GUC_SYSTEM_REASON]: REASON }, `select count(*)::text from ${ident(table)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid;`),
  );
  return Number(rows[0]?.[0] ?? "0");
}

/** What an UPDATE and a DELETE of a landed row are answered with, for one table. */
async function rewrites(table: string): Promise<{ update: SqlResult; remove: SqlResult; standing: number }> {
  const tenantId = randomUUID();
  await land(table, tenantId);
  const where = `where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid`;
  const update = await attempt(`update ${ident(table)} set ${ident(TENANT_COLUMN)} = ${lit(randomUUID())}::uuid ${where};`);
  const remove = await attempt(`delete from ${ident(table)} ${where};`);
  return { update, remove, standing: await rowsFor(table, tenantId) };
}

describe("AC-6: the affirmation and the calibration are migrated, scoped and append-only", () => {
  it("AC-6: the product's own migration lane lands both tables, with the columns a scale is written in", async () => {
    for (const { table, columns } of TABLES) {
      expect(await holds(table), `the lane applied a migration that lands public.${table} — an affirmed scale with nowhere to stand is not stored (L-MEA-05)`).toBe(true);
      expect(await columnsOf(table), `public.${table} says whose it is, what was affirmed, and the act that carried it (L-ACT-01)`).toEqual(expect.arrayContaining([...columns]));
    }
  });

  it("AC-6: one affirmation stands per act, and one calibration per content address in a workspace", async () => {
    for (const { table, key } of TABLES) {
      await requireTable(table);
      expect(
        await primaryKeyColumnsOf(table),
        `the key of public.${table} is exactly (${key.join(", ")}) and nothing more: a calibration is named by what it says, so the same reading affirmed twice is the same row (L-MEA-05)`,
      ).toEqual([...key]);
    }
  });

  it("AC-6: each table is scoped exactly as the confirmation a human act already writes", async () => {
    const peerSecurity = await securityOf(PEER);
    expect([peerSecurity.enabled, peerSecurity.forced], `public.${PEER} is the posture these tables are compared against — with none there is nothing to compare`).toEqual(["true", "true"]);
    const peerPolicies = await policiesOf(PEER);
    expect(peerPolicies.length, `public.${PEER} wears the tenant-scope and system-scope policies these tables are compared against`).toBeGreaterThan(0);

    for (const { table } of TABLES) {
      await requireTable(table);
      expect(
        await securityOf(table),
        `row-level security on public.${table}, WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee the owner escapes is not a guarantee (SEAM-TENANT)`,
      ).toEqual(peerSecurity);
      expect(
        await policiesOf(table),
        `public.${table} admits exactly the rows a confirmation admits — the workspace's own, and a system session that has recorded its reason (SEAM-TENANT)`,
      ).toEqual(peerPolicies);
    }
  });

  it("AC-6: the app role appends a scale and can never write one away", async () => {
    const peer = await privilegesOf(PEER, ROLE_APP);
    expect(peer, `${ROLE_APP} reads and appends on public.${PEER} — a human act's own state change is never edited or dropped (L-ACT-01)`).toEqual(["INSERT", "SELECT"]);
    for (const { table } of TABLES) {
      await requireTable(table);
      expect(
        await privilegesOf(table, ROLE_APP),
        `${ROLE_APP} holds on public.${table} what it holds on public.${PEER}: an affirmation is a fact a person stated, and re-scaling is a new act, never an edit (L-MEA-05, L-ACT-01)`,
      ).toEqual(peer);
    }
  });

  it("AC-6: a landed row refuses to be updated or deleted, the way the peer ledger refuses", async () => {
    await requireTable(PEER);
    const peer = await rewrites(PEER);
    expect([peer.update.ok, peer.remove.ok], `public.${PEER}'s own belt is what these two are compared against — with none there is nothing to compare`).toEqual([false, false]);

    for (const { table } of TABLES) {
      await requireTable(table);
      const own = await rewrites(table);
      expect(own.update.ok, `an UPDATE of a landed row of public.${table} is refused — the owner too, since a guarantee the owner escapes is not a guarantee`).toBe(false);
      expect(own.remove.ok, `and a DELETE is refused: a scale somebody affirmed is a fact of the record, superseded by a later act rather than erased (L-ACT-01)`).toBe(false);
      expect(
        [own.update.sqlstate, own.remove.sqlstate],
        `and both are refused as public.${PEER} refuses them — one append-only rule, one spelling of it (B-17)`,
      ).toEqual([peer.update.sqlstate, peer.remove.sqlstate]);
      expect(own.standing, "the row is still standing after both attempts").toBe(1);
    }
  });

  it("AC-6: the store closes the ranks and the shape of a factor", async () => {
    const tables = TABLES.map(({ table }) => table);
    for (const table of tables) await requireTable(table);

    const carrying = async (column: string): Promise<string[]> => {
      const held: string[] = [];
      for (const table of tables) if ((await columnsOf(table)).includes(column)) held.push(table);
      return held;
    };

    const ranked = await carrying("rank");
    expect(ranked.length, "the rank a scale stood on is written down — L-MEA-05 asks an affirmation for the rank and the source keys under it").toBeGreaterThan(0);
    for (const table of ranked) {
      for (const rank of ["QS_TWO_POINTS", "file_units", "SCALE", ""]) {
        const refused = await attempt(await probeRow(table, randomUUID(), { rank: lit(rank) }));
        expect(refused.ok, `'${rank}' names no rank of L-MEA-05's precedence, so public.${table} refuses the row however it reached the insert`).toBe(false);
        expect(refused.sqlstate, `and it is a CHECK that refused '${rank}', not something else about the row`).toBe(CHECK_VIOLATION);
      }
      for (const rank of SCALE_RANKS) {
        const accepted = await attempt(await probeRow(table, randomUUID(), { rank: lit(rank) }));
        expect(accepted.ok, `every rank of the precedence is one public.${table} accepts — a closed list that admits none of them closes nothing:\n${accepted.stderr.slice(-400)}`).toBe(true);
      }
    }

    const factored = await carrying("factor_x");
    expect(factored.length, "the factor pair a calibration carries is written down, axis by axis").toBeGreaterThan(0);
    for (const table of factored) {
      for (const column of ["factor_x", "factor_y"]) {
        for (const value of ["0.001", "1", "1.0000000000000", "0.00100000000a", "-0.001000000000", ""]) {
          const refused = await attempt(await probeRow(table, randomUUID(), { [column]: lit(value) }));
          expect(
            refused.ok,
            `'${value}' is not the 12-place rendering a factor is spoken in, so public.${table} refuses it in ${column} — a store that took it would carry a scale nothing could compare (L-MEA-05)`,
          ).toBe(false);
          expect(refused.sqlstate, `and it is a CHECK that refused '${value}' in ${column}`).toBe(CHECK_VIOLATION);
        }
      }
    }
  });

  it("AC-6: both tables are declared once, in the typed surface every seam read passes through", async () => {
    const core = await productModule<Record<string, unknown>>(DB_MODULE);
    const surface = core["SEAM_SCHEMA"] as Record<string, unknown> | undefined;
    expect(surface, `${DB_MODULE} exports SEAM_SCHEMA`).toBeTruthy();

    for (const { table, exported } of TABLES) {
      const declared = core[exported];
      expect(declared, `${DB_MODULE} must export \`${exported}\` for public.${table} — every cubit table has one home (SEAM-TENANT, ARCH-02)`).toBeTruthy();
      expect(
        Object.values(surface ?? {}).includes(declared),
        `SEAM_SCHEMA must carry ${table}: a table joins the typed surface by joining that object (B-05), and the live seam suite counts it there`,
      ).toBe(true);
    }
  });
});

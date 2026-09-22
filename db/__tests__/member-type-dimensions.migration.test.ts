/**
 * 0058 — `member_type_dimensions`, the dimensions a schedule states for a member type BESIDE its
 * section: a pile's diameter and its length, read off the pile schedule's own cells (Interpretation
 * I-315, AM-06 §2, R-TO-031, SEAM-TENANT, V-DB).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane (`scripts/db-migrate.mjs`) over the committed migrations and their journal, so no file
 * under db/ is read here: a table standing in that database is the migration and its journal entry,
 * observed. Raw SQL is spoken through psql, never a driver import.
 *
 * B-19: no posture is transcribed. The table is one more table of the SAME stored partition as
 * `member_type_variants` — rebuilt per ingest, deleted and written again in one transaction — so its
 * scope and its privileges are derived by COMPARISON against that table.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { lit, psql, run, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The table 0058 lands, the name it is exported under, and the table it is compared against. */
const TABLE = "member_type_dimensions";
const EXPORTED = "memberTypeDimensions";
const PEER = "member_type_variants";

/** The one home of every cubit table, and where the schema tree offers it to drizzle-kit. */
const DB_MODULE = "src/core/db.ts";
const SCHEMA_FILE = "db/schema/takeoff-schedules.ts";
const SCHEMA_BARREL = "db/schema/index.ts";

/** The reason this suite runs its system-scoped statements under — attributable, like any other. */
const REASON = "test: probe the schedule dimensions' closed lists";

/** A CHECK violation, as Postgres names one. */
const CHECK_VIOLATION = "23514";

/** The scoping columns every table of the stored partition carries. */
const SCOPE: readonly string[] = [TENANT_COLUMN, "project_id", "drawing_id", "ingest_id"];

/** What a stored dimension says, and the grain it stands under. */
const COLUMNS: readonly string[] = [...SCOPE, "schedule_key", "family", "variant_key", "dimension", "text", "value", "unit", "source_keys", "created_at"];
const KEY: readonly string[] = [TENANT_COLUMN, "ingest_id", "schedule_key", "family", "variant_key", "dimension"];

/** The words a member count would be spelled with: the store holds what a member IS, never how many (R-TO-031). */
const COUNT_WORDS: readonly string[] = ["count", "members", "nos", "quantity"];

async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

let scratch: ScratchDb | undefined;
let staging: Promise<{ bootstrapUrl: string }> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<{ bootstrapUrl: string }> =>
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

async function columnsOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(bootstrapUrl, `select column_name from information_schema.columns where table_schema = 'public' and table_name = ${lit(table)} order by 1;`).map((row) => row[0] ?? "");
}

async function privilegesOf(table: string, role: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(role)} order by 1;`,
  ).map((row) => row[0] ?? "");
}

async function securityOf(table: string): Promise<{ enabled: string; forced: string }> {
  const { bootstrapUrl } = await staged();
  const rows = run(bootstrapUrl, `select relrowsecurity::text, relforcerowsecurity::text from pg_class where oid = ${lit(`public.${table}`)}::regclass;`);
  return { enabled: rows[0]?.[0] ?? "", forced: rows[0]?.[1] ?? "" };
}

/** The policies a table wears, as what they SAY: the command, the rows admitted, the rows accepted. */
async function policiesOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select polcmd::text || ' | ' || coalesce(pg_get_expr(polqual, polrelid), '-') || ' | ' || coalesce(pg_get_expr(polwithcheck, polrelid), '-')
       from pg_policy where polrelid = ${lit(`public.${table}`)}::regclass order by 1;`,
  ).map((row) => (row[0] ?? "").replaceAll(`"${table}".`, "").replaceAll(table, ""));
}

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

/** One lawful row — S-05's pile diameter — with whatever the case is probing overridden. */
function insertRow(override: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    schedule_key: lit("DXF_HANDLE:200A"),
    family: lit("P"),
    variant_key: lit("SECTION"),
    dimension: lit("dia"),
    text: lit("500"),
    value: "500",
    unit: lit("mm"),
    source_keys: `array[${lit("DXF_HANDLE:4EE")}]::text[]`,
    ...override,
  };
  const scope = [randomUUID(), randomUUID(), randomUUID(), randomUUID()].map((id) => `${lit(id)}::uuid`);
  const columns = [...SCOPE, ...Object.keys(values)];
  return `insert into "${TABLE}" (${columns.map((column) => `"${column}"`).join(", ")}) values (${[...scope, ...Object.values(values)].join(", ")});`;
}

async function attempt(override: Record<string, string> = {}): Promise<ReturnType<typeof psql>> {
  const { bootstrapUrl } = await staged();
  return psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, insertRow(override)));
}

describe("0058: the schedule dimensions are migrated, scoped and rewritable", () => {
  it("the product's own migration lane lands the table, with what a stored dimension says and nothing about how many", async () => {
    const columns = await columnsOf(TABLE);
    expect(columns, `public.${TABLE} says whose it is, which drawing, ingest, schedule, family and variant it was read for, and what it read there (I-315)`).toEqual([...COLUMNS].sort());
    expect(columns.filter((column) => COUNT_WORDS.some((word) => column.includes(word))), "no column carries a member count: a schedule's NOS is corroboration placement reads, stored nowhere (R-TO-031)").toEqual([]);
  });

  it("stands under the key its grain names: one row per dimension of one variant of one family", async () => {
    expect(await primaryKeyColumnsOf(TABLE), "a rebuilt partition replaces the rows of the ingest it rebuilt rather than standing a second set beside them (L-REG-04)").toEqual([...KEY]);
  });

  it("is scoped exactly as the variants it hangs from", async () => {
    const peer = await securityOf(PEER);
    expect([peer.enabled, peer.forced], `public.${PEER} is the posture compared against`).toEqual(["true", "true"]);
    expect(await securityOf(TABLE), "row-level security, WITH FORCE: a guarantee the owner escapes is not a guarantee (SEAM-TENANT)").toEqual(peer);
    const peerPolicies = await policiesOf(PEER);
    expect(peerPolicies.length, `public.${PEER} wears the policies compared against`).toBeGreaterThan(0);
    expect(await policiesOf(TABLE), "the workspace's own rows, and a system session that has recorded its reason — exactly as the variants (SEAM-TENANT)").toEqual(peerPolicies);
  });

  it("the app role reads, writes and takes away — never an UPDATE, which would edit a derivation in place", async () => {
    const peer = await privilegesOf(PEER, ROLE_APP);
    expect(peer, `${ROLE_APP} on public.${PEER}`).toEqual(["DELETE", "INSERT", "SELECT"]);
    expect(await privilegesOf(TABLE, ROLE_APP), "a partition is REBUILT, so its rows are read, written and taken away in one transaction (R-TO-030)").toEqual(peer);
  });

  it("a lawful row is one the store accepts, and a level may stand below zero", async () => {
    const lawful = await attempt();
    expect(lawful.ok, `S-05's diameter is a row the store accepts:\n${lawful.stderr.slice(-600)}`).toBe(true);
    const level = await attempt({ dimension: lit("top"), text: lit("-1829"), value: "-1829" });
    expect(level.ok, `a top level below the datum is a level, not a nonsense size:\n${level.stderr.slice(-600)}`).toBe(true);
  });

  it("a dimension no method declares, a unit nobody drew, a size of nothing and a row citing nothing are refused by CHECK", async () => {
    for (const [what, override] of [
      ["a dimension outside the roster", { dimension: lit("nos") }],
      ["a dimension spelled another way", { dimension: lit("DIA") }],
      ["a unit outside the two", { unit: lit("cm") }],
      ["a length of nothing", { dimension: lit("length"), value: "0" }],
      ["a negative diameter", { value: "-500" }],
      ["a row citing no entity", { source_keys: "array[]::text[]" }],
    ] as const) {
      const attempted = await attempt(override);
      expect(attempted.ok, `${what} is refused however it reached the insert`).toBe(false);
      expect(attempted.sqlstate, `and it is a CHECK that refused ${what}`).toBe(CHECK_VIOLATION);
    }
    const unitless = await attempt({ unit: "null" });
    expect(unitless.ok, "a dimension nobody gave a unit to is not stored at all — the reader reads none (L-MEA-01)").toBe(false);
  });

  it("is declared once, in the typed surface every seam read passes through", async () => {
    const core = await productModule<Record<string, unknown>>(DB_MODULE);
    const surface = core["SEAM_SCHEMA"] as Record<string, unknown> | undefined;
    const declared = core[EXPORTED];
    expect(declared, `${DB_MODULE} exports \`${EXPORTED}\` — every cubit table has one home (SEAM-TENANT)`).toBeTruthy();
    expect(Object.values(surface ?? {}).includes(declared), "SEAM_SCHEMA carries it").toBe(true);
    expect((await productModule<Record<string, unknown>>(SCHEMA_FILE))[EXPORTED], `${SCHEMA_FILE} offers the seam's own definition to the generator`).toBe(declared);
    expect((await productModule<Record<string, unknown>>(SCHEMA_BARREL))[EXPORTED], "and the schema barrel carries it, which is how the drift lane counts it").toBe(declared);
  });
});

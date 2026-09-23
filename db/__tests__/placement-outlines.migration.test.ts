/**
 * 0059 — `placement_outlines`, the plan the ring a member was placed by ENCLOSES: its geometry (a
 * rectangle or a polygon), its shoelace area, its perimeter and — for a rectangle — its own two sides,
 * in the unit the ring was read in and cited to the ring (Interpretation I-333, L-FRM-02, SEAM-TENANT,
 * V-DB).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane (`scripts/db-migrate.mjs`) over the committed migrations and their journal, so no file
 * under db/ is read here: a table standing in that database is the migration and its journal entry,
 * observed. Raw SQL is spoken through psql, never a driver import.
 *
 * B-19: no posture is transcribed. The table is one more table of the SAME stored partition as
 * `placements` — rebuilt per ingest, deleted and written again in one transaction — so its scope and
 * its privileges are derived by COMPARISON against that table.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { lit, psql, run, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The table 0059 lands, the name it is exported under, and the table it is compared against. */
const TABLE = "placement_outlines";
const EXPORTED = "placementOutlines";
const PEER = "placements";

/** The one home of every cubit table, and where the schema tree offers it to drizzle-kit. */
const DB_MODULE = "src/core/db.ts";
const SCHEMA_FILE = "db/schema/takeoff-placements.ts";
const SCHEMA_BARREL = "db/schema/index.ts";

/** The reason this suite runs its system-scoped statements under — attributable, like any other. */
const REASON = "test: probe the placement outlines' closed lists";

/** A CHECK violation, as Postgres names one. */
const CHECK_VIOLATION = "23514";

/** The scoping columns every table of the stored partition carries. */
const SCOPE: readonly string[] = [TENANT_COLUMN, "project_id", "drawing_id", "ingest_id"];

/** What a stored plan says, and the grain it stands under. */
const COLUMNS: readonly string[] = [...SCOPE, "placement_key", "source_key", "unit_source_key", "geometry", "unit", "area_unit", "area", "perimeter", "length", "breadth", "created_at"];
const KEY: readonly string[] = [TENANT_COLUMN, "ingest_id", "placement_key"];

/** The words a box would be spelled with: a plan is the ring's own, never the box around it (I-333). */
const BOX_WORDS: readonly string[] = ["bbox", "extent", "min_x", "max_x", "min_y", "max_y"];

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

/** One lawful row — S-06's chamfered PC2 — with whatever the case is probing overridden. */
function insertRow(override: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    placement_key: lit("v:LAYOUT_PLAN:DXF_HANDLE:202C|PC2|4572.0,-199775.0"),
    source_key: lit("DXF_HANDLE:5AF"),
    unit_source_key: lit("DXF_HANDLE:1F3E"),
    geometry: lit("PRISM_POLY"),
    unit: lit("mm"),
    area_unit: lit("mm2"),
    area: lit("3262500.0"),
    perimeter: lit("6960.1"),
    length: "null",
    breadth: "null",
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

describe("0059: the placement outlines are migrated, scoped and rewritable", () => {
  it("the product's own migration lane lands the table, with what a ring's plan says and no box around it", async () => {
    const columns = await columnsOf(TABLE);
    expect(columns, `public.${TABLE} says whose it is, which drawing, ingest and placement it was read for, and what the ring encloses (I-333)`).toEqual([...COLUMNS].sort());
    expect(columns.filter((column) => BOX_WORDS.some((word) => column.includes(word))), "no column carries a bounding box: a plan is the ring's own (L-FRM-02)").toEqual([]);
  });

  it("stands under the key its grain names: one plan per placement of one record", async () => {
    expect(await primaryKeyColumnsOf(TABLE), "a rebuilt partition replaces the rows of the ingest it rebuilt rather than standing a second set beside them (L-REG-04)").toEqual([...KEY]);
  });

  it("is scoped exactly as the placements it hangs from", async () => {
    const peer = await securityOf(PEER);
    expect([peer.enabled, peer.forced], `public.${PEER} is the posture compared against`).toEqual(["true", "true"]);
    expect(await securityOf(TABLE), "row-level security, WITH FORCE: a guarantee the owner escapes is not a guarantee (SEAM-TENANT)").toEqual(peer);
    const peerPolicies = await policiesOf(PEER);
    expect(peerPolicies.length, `public.${PEER} wears the policies compared against`).toBeGreaterThan(0);
    expect(await policiesOf(TABLE), "the workspace's own rows, and a system session that has recorded its reason — exactly as the placements (SEAM-TENANT)").toEqual(peerPolicies);
  });

  it("the app role reads, writes and takes away — never an UPDATE, which would edit a derivation in place", async () => {
    const peer = await privilegesOf(PEER, ROLE_APP);
    expect(peer, `${ROLE_APP} on public.${PEER}`).toEqual(["DELETE", "INSERT", "SELECT"]);
    expect(await privilegesOf(TABLE, ROLE_APP), "a partition is REBUILT, so its rows are read, written and taken away in one transaction (R-TO-030)").toEqual(peer);
  });

  it("a polygon with no sides and a rectangle with both are rows the store accepts; a header unit cites no declaration", async () => {
    const polygon = await attempt();
    expect(polygon.ok, `S-06's chamfered PC2 is a row the store accepts:\n${polygon.stderr.slice(-600)}`).toBe(true);
    const rectangle = await attempt({ geometry: lit("PRISM_RECT"), area: lit("2000000.0"), perimeter: lit("6000.0"), length: lit("2000.0"), breadth: lit("1000.0"), unit_source_key: "null" });
    expect(rectangle.ok, `the turned PC1 by its own sides is a row the store accepts:\n${rectangle.stderr.slice(-600)}`).toBe(true);
  });

  it("a geometry off the roster, a unit of the wrong dimension, half a rectangle and a polygon given sides are refused by CHECK", async () => {
    for (const [what, override] of [
      ["a geometry outside the two a ring is read as", { geometry: lit("FRUSTUM_RECT") }],
      ["a length unit that is no length", { unit: lit("mm2") }],
      ["an area unit that is no area", { area_unit: lit("mm") }],
      ["a unit the canon does not carry", { unit: lit("cm") }],
      ["a rectangle stating one side", { geometry: lit("PRISM_RECT"), length: lit("2000.0") }],
      ["a polygon given a length and a breadth", { length: lit("2100.0"), breadth: lit("1750.0") }],
    ] as const) {
      const attempted = await attempt(override);
      expect(attempted.ok, `${what} is refused however it reached the insert`).toBe(false);
      expect(attempted.sqlstate, `and it is a CHECK that refused ${what}`).toBe(CHECK_VIOLATION);
    }
    const unitless = await attempt({ unit: "null" });
    expect(unitless.ok, "a plan nobody gave a unit to is not stored at all — the reader reads none (L-CAD-02)").toBe(false);
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

/**
 * AC-4 — the six tables a reconstructed schedule and its member-type registry are rewritten into
 * (R-TO-030, R-TO-031, SEAM-TENANT, V-DB).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane (`scripts/db-migrate.mjs`) over the committed migrations and their journal, so no file
 * under db/ is read here: a table standing in that database is the migration and its journal entry,
 * observed.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * B-19: no posture is transcribed. These are six more tables of the SAME stored partition as
 * `convention_profiles` — rebuilt per ingest, deleted and written again in one transaction — so
 * their scope and their privileges are derived by COMPARISON against that table. An increment that
 * changes how the partition is scoped changes this case with it.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { lit, psql, run, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The one home of every cubit table (SEAM-TENANT). */
const DB_MODULE = "src/core/db.ts";

/** Where the schema tree offers these six to drizzle-kit — what the drift lane reads them back from. */
const SCHEMA_FILE = "db/schema/takeoff-schedules.ts";

/** The schema barrel the generator and the drift lane walk. */
const SCHEMA_BARREL = "db/schema/index.ts";

/** The table of the same stored partition these six are compared against. */
const PEER = "convention_profiles";

/** The reason this suite runs its system-scoped statements under — attributable, like any other. */
const REASON = "test: probe the schedule store's closed lists";

/** A CHECK violation, as Postgres names one. */
const CHECK_VIOLATION = "23514";

/** The scoping columns every table of the stored partition carries. */
const SCOPE: readonly string[] = [TENANT_COLUMN, "project_id", "drawing_id", "ingest_id"];

/** Each table, the name it is exported under, the columns it carries and the key it stands under. */
const TABLES = [
  {
    table: "schedules",
    exported: "schedules",
    columns: [...SCOPE, "view_key", "schedule_key", "title", "pitch", "created_at"],
    key: [TENANT_COLUMN, "ingest_id", "schedule_key"],
  },
  {
    table: "schedule_cells",
    exported: "scheduleCells",
    columns: [...SCOPE, "schedule_key", "row_index", "column_index", "text", "source_keys"],
    key: [TENANT_COLUMN, "ingest_id", "schedule_key", "row_index", "column_index"],
  },
  {
    table: "member_types",
    exported: "memberTypes",
    columns: [...SCOPE, "schedule_key", "family", "mark_text", "row_index", "source_keys"],
    key: [TENANT_COLUMN, "ingest_id", "schedule_key", "family"],
  },
  {
    table: "member_type_variants",
    exported: "memberTypeVariants",
    columns: [...SCOPE, "schedule_key", "family", "variant_key", "band_text", "band_from", "band_to", "section_text", "section_width", "section_depth", "section_unit", "source_keys"],
    key: [TENANT_COLUMN, "ingest_id", "schedule_key", "family", "variant_key"],
  },
  {
    table: "rebar_zones",
    exported: "rebarZones",
    columns: [...SCOPE, "schedule_key", "family", "variant_key", "zone", "text", "bars", "spacing", "spacing_unit", "spacing_bar", "source_keys"],
    key: [TENANT_COLUMN, "ingest_id", "schedule_key", "family", "variant_key", "zone"],
  },
  {
    table: "schedule_deferrals",
    exported: "scheduleDeferrals",
    columns: [...SCOPE, "view_key", "reason"],
    key: [TENANT_COLUMN, "ingest_id", "view_key"],
  },
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
  expect(await holds(table), `public.${table} is missing from the migrated database — the product does not store a schedule yet`).toBe(true);
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

/** The four ids every row of the stored partition is scoped by, as SQL. */
function scopeValues(): string {
  return [randomUUID(), randomUUID(), randomUUID(), randomUUID()].map((id) => `${lit(id)}::uuid`).join(", ");
}

/** One lawful row of each table, with whatever the case is probing overridden. */
function insertRow(table: string, override: Record<string, string> = {}): string {
  const key = lit("DXF_HANDLE:1");
  const cited = `array[${lit("DXF_HANDLE:2")}]::text[]`;
  const rows: Record<string, { columns: string[]; values: Record<string, string> }> = {
    schedules: {
      columns: ["view_key", "schedule_key", "title", "pitch"],
      values: { view_key: lit("SCHEDULE:DXF_HANDLE:1"), schedule_key: key, title: lit("COLUMN SCHEDULE"), pitch: "10" },
    },
    schedule_cells: {
      columns: ["schedule_key", "row_index", "column_index", "text", "source_keys"],
      values: { schedule_key: key, row_index: "0", column_index: "0", text: lit("MARK"), source_keys: cited },
    },
    member_types: {
      columns: ["schedule_key", "family", "mark_text", "row_index", "source_keys"],
      values: { schedule_key: key, family: lit("C1"), mark_text: lit("C-1"), row_index: "1", source_keys: cited },
    },
    member_type_variants: {
      columns: ["schedule_key", "family", "variant_key", "band_text", "band_from", "band_to", "section_text", "section_width", "section_depth", "section_unit", "source_keys"],
      values: {
        schedule_key: key,
        family: lit("C1"),
        variant_key: lit("GF-3RD"),
        band_text: lit("GF TO 3RD"),
        band_from: lit("GF"),
        band_to: lit("3RD"),
        section_text: lit('12"x15"'),
        section_width: "12",
        section_depth: "15",
        section_unit: lit("in"),
        source_keys: cited,
      },
    },
    rebar_zones: {
      columns: ["schedule_key", "family", "variant_key", "zone", "text", "bars", "spacing", "spacing_unit", "spacing_bar", "source_keys"],
      values: {
        schedule_key: key,
        family: lit("C1"),
        variant_key: lit("GF-3RD"),
        zone: lit("main"),
        text: lit("8-16Ø"),
        bars: `${lit('[{"n": 8, "diameterMm": 16}]')}::jsonb`,
        spacing: "4",
        spacing_unit: lit("in"),
        spacing_bar: "10",
        source_keys: cited,
      },
    },
    schedule_deferrals: {
      columns: ["view_key", "reason"],
      values: { view_key: lit("SCHEDULE:DXF_HANDLE:1"), reason: lit("SCHEDULE_NONE_RECONSTRUCTED") },
    },
  };
  const shape = rows[table];
  if (shape === undefined) throw new Error(`no lawful row is described for ${table}`);
  const columns = [...SCOPE, ...shape.columns];
  const values = [scopeValues(), ...shape.columns.map((column) => override[column] ?? shape.values[column] ?? "null")];
  return `insert into "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) values (${values.join(", ")});`;
}

/** That insert, attempted under a session the store's system scope admits. */
async function attempt(table: string, override: Record<string, string> = {}): Promise<ReturnType<typeof psql>> {
  const { bootstrapUrl } = await staged();
  return psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, insertRow(table, override)));
}

describe("AC-4: the schedule store's six tables are migrated, scoped and rewritable", () => {
  it("AC-4: the product's own migration lane lands all six, with the columns a stored schedule is made of", async () => {
    for (const { table, columns } of TABLES) {
      expect(await holds(table), `the lane applied a migration that lands public.${table} — a schedule with nowhere to stand is not stored (R-TO-030)`).toBe(true);
      expect(
        await columnsOf(table),
        `public.${table} says whose it is, which drawing, ingest and schedule it was read from, and what the stage read there (R-TO-031)`,
      ).toEqual(expect.arrayContaining([...columns]));
    }
  });

  it("AC-4: each table stands under the key its own grain names", async () => {
    for (const { table, key } of TABLES) {
      await requireTable(table);
      expect(
        await primaryKeyColumnsOf(table),
        `the key of public.${table} is exactly (${key.join(", ")}) and nothing more: a rebuilt partition replaces the rows of the ingest it rebuilt rather than standing a second set beside them (L-REG-04, R-TO-030)`,
      ).toEqual([...key]);
    }
  });

  it("AC-4: each table is scoped exactly as the convention profile it is rebuilt beside", async () => {
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
        `public.${table} admits exactly the rows the convention profile admits — the workspace's own, and a system session that has recorded its reason (SEAM-TENANT)`,
      ).toEqual(peerPolicies);
    }
  });

  it("AC-4: the app role rewrites a schedule and never accumulates one", async () => {
    const peer = await privilegesOf(PEER, ROLE_APP);
    expect(peer, `${ROLE_APP} reads, adds and takes away on public.${PEER} — never an UPDATE, which would edit a derivation in place instead of re-deriving it (L-REG-04)`).toEqual([
      "DELETE",
      "INSERT",
      "SELECT",
    ]);
    for (const { table } of TABLES) {
      await requireTable(table);
      expect(
        await privilegesOf(table, ROLE_APP),
        `${ROLE_APP} holds on public.${table} what it holds on public.${PEER}: a partition is REBUILT, so its rows are read, written and taken away again in one transaction (R-TO-030)`,
      ).toEqual(peer);
    }
  });

  it("AC-4: a lawful row of each table is one the store accepts", async () => {
    for (const { table } of TABLES) {
      await requireTable(table);
      const lawful = await attempt(table);
      expect(lawful.ok, `a lawful row is one public.${table} accepts — with none accepted the refusals below would prove nothing:\n${lawful.stderr.slice(-600)}`).toBe(true);
    }
  });

  it("AC-4: a cell citing nothing, a zone nobody named and a reason from another stage are refused", async () => {
    await requireTable("schedule_cells");
    for (const cited of ["array[]::text[]", "'{}'::text[]"]) {
      const attempted = await attempt("schedule_cells", { source_keys: cited });
      expect(attempted.ok, `a cell that cites no entity at all is not a cell anybody can trace back to the drawing (L-CAD-03); the store refuses ${cited}`).toBe(false);
      expect(attempted.sqlstate, `and it is a CHECK that refused ${cited}, not something else about the row`).toBe(CHECK_VIOLATION);
    }

    await requireTable("rebar_zones");
    for (const zone of ["stirrups", "MAIN", "ties-top", ""]) {
      const attempted = await attempt("rebar_zones", { zone: lit(zone) });
      expect(attempted.ok, `'${zone}' is outside the four zones a rebar column reads as, so the store refuses the row however it reached the insert (AC-6)`).toBe(false);
      expect(attempted.sqlstate, `and it is a CHECK that refused '${zone}'`).toBe(CHECK_VIOLATION);
    }

    await requireTable("schedule_deferrals");
    for (const reason of ["GRID_NO_BUBBLE_EVIDENCE", "CAPTION_UNCLASSIFIABLE", ""]) {
      const attempted = await attempt("schedule_deferrals", { reason: lit(reason) });
      expect(attempted.ok, `'${reason}' is not a reason a SCHEDULE view defers under — another stage's reason stored here would render as this stage's (riskNotes (2))`).toBe(false);
      expect(attempted.sqlstate, `and it is a CHECK that refused '${reason}'`).toBe(CHECK_VIOLATION);
    }
  });

  it("AC-4: a pitch that is not a spacing and a unit nobody drew are refused", async () => {
    await requireTable("schedules");
    for (const pitch of ["0", "-10"]) {
      const attempted = await attempt("schedules", { pitch });
      expect(attempted.ok, `a pitch of ${pitch} is not a row spacing the 3.5× stop could be measured in, so the store refuses the row`).toBe(false);
      expect(attempted.sqlstate, `and it is a CHECK that refused ${pitch}`).toBe(CHECK_VIOLATION);
    }

    await requireTable("member_type_variants");
    const unitless = await attempt("member_type_variants", { section_unit: "null" });
    expect(unitless.ok, `a section the drawing wrote without a unit carries none — never an inch nobody said:\n${unitless.stderr.slice(-600)}`).toBe(true);
    for (const unit of ["cm", "IN", "inch", ""]) {
      const attempted = await attempt("member_type_variants", { section_unit: lit(unit) });
      expect(attempted.ok, `'${unit}' is outside the two units a section is read in, so the store refuses the row`).toBe(false);
      expect(attempted.sqlstate, `and it is a CHECK that refused '${unit}'`).toBe(CHECK_VIOLATION);
    }
  });

  it("AC-4: all six are declared once, in the typed surface every seam read passes through", async () => {
    const core = await productModule<Record<string, unknown>>(DB_MODULE);
    const surface = core["SEAM_SCHEMA"] as Record<string, unknown> | undefined;
    expect(surface, `${DB_MODULE} exports SEAM_SCHEMA`).toBeTruthy();
    const schema = await productModule<Record<string, unknown>>(SCHEMA_FILE);
    const barrel = await productModule<Record<string, unknown>>(SCHEMA_BARREL);

    for (const { table, exported } of TABLES) {
      const declared = core[exported];
      expect(declared, `${DB_MODULE} must export \`${exported}\` for public.${table} — every cubit table has one home (SEAM-TENANT, ARCH-02)`).toBeTruthy();
      expect(
        Object.values(surface ?? {}).includes(declared),
        `SEAM_SCHEMA must carry ${table}: a table joins the typed surface by joining that object (B-05), and the live seam suite counts it there`,
      ).toBe(true);
      expect(schema[exported], `${SCHEMA_FILE} offers ${table} to the generator — the very definition the seam holds, never a second one`).toBe(declared);
      expect(barrel[exported], `and the schema barrel carries it, which is how the drift lane counts it`).toBe(declared);
    }
  });
});

/**
 * AC-2 (V-DB) — `notes_readings`, the table a transcribed note reading stands in (R-TO-034,
 * L-QTY-01, SEAM-TENANT, V-DB).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane (`scripts/db-migrate.mjs`) over the committed migrations and their journal, so no file
 * under db/ is read here: a table standing in that database is the migration and its journal entry,
 * observed, and a second run of the lane converging is that entry recorded.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * B-19: the three rosters the CHECKs are written from are read from the product's own law, never
 * transcribed — a kind the law gains tomorrow is admitted here without an edit, and one it never had
 * is refused.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../db/__tests__/harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, GUC_TENANT, ROLE_APP, TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { isTrue, lit, psql, run, withSession } from "../../../db/__tests__/support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

/** The lane that applies the committed migrations — the only way a table reaches a database. */
const MIGRATE_SCRIPT = join("scripts", "db-migrate.mjs");

/** The table this increment lands, and the law the three CHECKs are written from. */
const READINGS = "notes_readings";
const NOTES_LAW_MODULE = "src/modules/takeoff/notes/law.ts";

/** What postgres answers when a CHECK refuses a row. */
const CHECK_VIOLATION = "23514";

/** The reason this suite's system-scoped statements are recorded under — attributable, like any other. */
const REASON = "test: probe the notes_readings store";

/** The columns a stored note reading is made of (the increment's interfaces). */
const COLUMNS: readonly string[] = [
  TENANT_COLUMN,
  "project_id",
  "drawing_id",
  "layout_name",
  "reading_key",
  "kind",
  "actor_id",
  "source_key",
  "value_as_written",
  "unit_as_written",
  "canonical",
  "basis",
  "acceptance",
  "act_id",
];

/** Import a product module by repo-relative path, asserting it exists first. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

type Stage = { bootstrapUrl: string; urlMigrate: string };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const url = new URL(BOOTSTRAP_URL);
    url.pathname = new URL(provisioned.urlMigrate).pathname;
    return { bootstrapUrl: url.toString(), urlMigrate: provisioned.urlMigrate };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** Does the migrated database hold the table at all? */
async function holds(table: string): Promise<boolean> {
  const { bootstrapUrl } = await staged();
  return (
    run(
      bootstrapUrl,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = ${lit(table)};`,
    ).length > 0
  );
}

/** The table stands, or every case below would be probing nothing. */
async function requireTable(): Promise<void> {
  expect(await holds(READINGS), `the lane applied a migration that lands public.${READINGS} — a reading with nowhere to stand is not recorded (AC-2)`).toBe(true);
}

/** The columns the table really carries. */
async function columnsOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(bootstrapUrl, `select column_name from information_schema.columns where table_schema = 'public' and table_name = ${lit(table)} order by column_name;`).map(
    (row) => row[0] ?? "",
  );
}

/** The privileges a role holds on the table, as the catalogue reports them. */
async function privilegesOf(table: string, role: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(role)} order by privilege_type;`,
  )
    .map((row) => row[0] ?? "")
    .sort();
}

/** One lawful row, with whatever the case is probing overridden. */
function insertRow(override: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    [TENANT_COLUMN]: `${lit(randomUUID())}::uuid`,
    project_id: `${lit(randomUUID())}::uuid`,
    drawing_id: `${lit(randomUUID())}::uuid`,
    layout_name: lit("Model"),
    reading_key: lit("note:DXF_HANDLE:1F43:FY"),
    kind: lit("FY"),
    actor_id: `${lit(randomUUID())}::uuid`,
    source_key: lit("DXF_HANDLE:1F43"),
    value_as_written: lit("500 MPa"),
    unit_as_written: lit("MPa"),
    canonical: lit("500"),
    basis: lit("TRANSCRIBED"),
    acceptance: lit("ACCEPTED"),
    act_id: `${lit(randomUUID())}::uuid`,
    ...override,
  };
  return `insert into "${READINGS}" (${COLUMNS.map((column) => `"${column}"`).join(", ")}) values (${COLUMNS.map((column) => values[column] ?? "null").join(", ")});`;
}

/** That insert, attempted under a session the store's system scope admits. */
async function attempt(override: Record<string, string> = {}): Promise<ReturnType<typeof psql>> {
  const { bootstrapUrl } = await staged();
  return psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, insertRow(override)));
}

describe("AC-2: notes_readings is migrated, scoped, append-only and closed to what the law admits", () => {
  it("AC-2: the product's own migration lane lands the table with the columns a reading is made of, and running it again converges", async () => {
    await requireTable();
    expect(await columnsOf(READINGS), "a reading says whose it is, which sheet it was read on, what was read, on what basis and under which act (interfaces)").toEqual(
      expect.arrayContaining([...COLUMNS]),
    );

    const { urlMigrate } = await staged();
    const again = spawnSync(process.execPath, [join(REPO_ROOT, MIGRATE_SCRIPT)], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: urlMigrate },
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(
      again.status,
      `a second run of the migration lane converges — an unjournaled or rewritten migration re-runs and collides:\n${`${again.stdout ?? ""}${again.stderr ?? ""}`.slice(-1200)}`,
    ).toBe(0);
    expect(await holds(READINGS), "and the table it landed still stands").toBe(true);
  });

  it("AC-2: the table is tenant-scoped, with row-level security enabled AND forced", async () => {
    await requireTable();
    const { bootstrapUrl } = await staged();
    expect(await columnsOf(READINGS), `public.${READINGS} carries ${TENANT_COLUMN} — a reading belongs to one workspace (SEAM-TENANT)`).toContain(TENANT_COLUMN);

    const row = run(
      bootstrapUrl,
      `select c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = ${lit(READINGS)};`,
    )[0];
    expect(isTrue(row?.[0] ?? ""), `public.${READINGS} has row-level security ENABLED`).toBe(true);
    expect(isTrue(row?.[1] ?? ""), "and FORCED — an owner is not exempt from a workspace boundary (SEAM-TENANT)").toBe(true);

    const policies = run(
      bootstrapUrl,
      `select policyname from pg_policies where schemaname = 'public' and tablename = ${lit(READINGS)}
        and (coalesce(qual, '') like ${lit(`%${GUC_TENANT}%`)} or coalesce(with_check, '') like ${lit(`%${GUC_TENANT}%`)});`,
    );
    expect(policies.length, `public.${READINGS} carries a policy that reads ${GUC_TENANT} — the boundary is the store's, not a caller's WHERE`).toBeGreaterThan(0);
  });

  it("AC-2: a reading is added and never rewritten — the app role holds no privilege that would let it", async () => {
    await requireTable();
    const held = await privilegesOf(READINGS, ROLE_APP);
    expect(held, `${ROLE_APP} reads and adds public.${READINGS}`).toEqual(expect.arrayContaining(["INSERT", "SELECT"]));
    expect(held, `${ROLE_APP} cannot UPDATE public.${READINGS} — a re-reading is another reading, never a rewrite (R-TO-051, L-ACT-01)`).not.toContain("UPDATE");
    expect(held, `${ROLE_APP} cannot DELETE from public.${READINGS} — a superseded reading is kept, never taken away (L-QTY-01)`).not.toContain("DELETE");
  });

  it("AC-2: a value of each closed roster is one no CHECK refuses", async () => {
    await requireTable();
    const law = await productModule<{ NOTE_KINDS: readonly string[]; NOTE_ACCEPTANCES: readonly string[]; NOTE_BASIS: string }>(NOTES_LAW_MODULE);

    for (const kind of law.NOTE_KINDS) {
      for (const acceptance of law.NOTE_ACCEPTANCES) {
        const attempted = await attempt({ kind: lit(kind), acceptance: lit(acceptance), basis: lit(law.NOTE_BASIS), reading_key: lit(`note:${kind}:${acceptance}`) });
        expect(
          attempted.sqlstate,
          `'${kind}' read as '${acceptance}' on basis '${law.NOTE_BASIS}' is what the law admits, so no CHECK refuses it:\n${attempted.stderr.slice(-400)}`,
        ).not.toBe(CHECK_VIOLATION);
      }
    }
  });

  it("AC-2: a kind, a basis and a verdict the law never had are refused by the store itself", async () => {
    await requireTable();
    const law = await productModule<{ NOTE_KINDS: readonly string[]; NOTE_ACCEPTANCES: readonly string[]; NOTE_BASIS: string }>(NOTES_LAW_MODULE);

    for (const kind of ["FCK", "fy", "LAP_MIN", ""]) {
      expect(law.NOTE_KINDS, `'${kind}' is outside the roster the law closes`).not.toContain(kind);
      const attempted = await attempt({ kind: lit(kind) });
      expect(attempted.sqlstate, `'${kind}' is not a note kind, so the store refuses the row however it reached the insert (AC-2)`).toBe(CHECK_VIOLATION);
    }

    for (const basis of ["MEASURED", "ENTERED", "DERIVED", ""]) {
      expect(basis, "a note reading is read off the drawing's text and nothing else (L-QTY-01)").not.toBe(law.NOTE_BASIS);
      const attempted = await attempt({ basis: lit(basis) });
      expect(attempted.sqlstate, `a basis of '${basis}' is refused: a reading of a note is transcribed, by construction`).toBe(CHECK_VIOLATION);
    }

    for (const acceptance of ["AMENDED", "accepted", "PROPOSED", ""]) {
      expect(law.NOTE_ACCEPTANCES, `'${acceptance}' is outside the two verdicts the seam may judge`).not.toContain(acceptance);
      const attempted = await attempt({ acceptance: lit(acceptance) });
      expect(attempted.sqlstate, `a verdict of '${acceptance}' is refused by the store (AC-2)`).toBe(CHECK_VIOLATION);
    }
  });
});

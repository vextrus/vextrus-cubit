/**
 * The four tables the placement, expansion and levels-proposal stages land, as the store holds them
 * (V-DB, R-SPINE-004, SEAM-TENANT, L-CAD-07, L-REG-04, L-ACT-01).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane (`scripts/db-migrate.mjs`) over the committed migrations and their journal, so no file
 * under db/ is read here: a table standing in that database is the migration and its journal entry,
 * observed, and a second run of the lane converging is that entry recorded.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * B-19: nothing is transcribed. The tenant scoping is read through `enumerateTenantScopedTables` —
 * the same denominator `seam-tenant.live.test.ts` drives its per-table proofs from — the deferral
 * roster is read off the register that publishes it, and what the app role may NOT do is graded as
 * the retention property each table encodes: a stage's rows are rebuilt per ingest (R-TO-030) and a
 * person's authored range is neither rewritten nor erased (L-ACT-01). The shape roster is read the
 * same way, off the module that declares it (`MEMBER_SHAPES`): a list spelled twice is two lists.
 *
 * The note columns (I-303) are judged by what the store ACCEPTS and REFUSES rather than by reading
 * their CHECK definitions back, because the thing that matters about them is behavioural — a careless
 * constraint would forbid C7's row, which is a noted member whose note stated no range at all, and no
 * amount of reading the expression proves it was admitted.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { MEMBER_SHAPES } from "../../src/core/db/schema-takeoff-placements";
import { EXPANSION_DEFERRAL_REASONS } from "../../src/core/errors";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, GUC_TENANT, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { count, isTrue, lit, psql, run, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The lane that applies the committed migrations — the only way a table reaches a database. */
const MIGRATE_SCRIPT = join("scripts", "db-migrate.mjs");

/**
 * The three tables a partition REBUILDS: their rows are deleted and re-derived with the views they
 * were read off, so the app role holds DELETE on them and on nothing else here (R-TO-030).
 */
const PLACEMENTS = "placements";
const DEFERRALS = "expansion_deferrals";
const PROPOSED = "proposed_levels";
const REBUILT: readonly string[] = [PLACEMENTS, DEFERRALS, PROPOSED];

/** The fourth: what a person AUTHORED, which no rebuild may take away (L-ACT-01, L-CAD-07). */
const AUTHORED = "typical_ranges";

const TABLES: readonly string[] = [...REBUILT, AUTHORED];

/** The two ledgers an authored range points at: the levels it runs between, and the act that made it. */
const LEVELS = "levels";
const ACTS = "acts";

type Stage = { bootstrapUrl: string; urlMigrate: string; tenantScoped: string[] };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const url = new URL(BOOTSTRAP_URL);
    url.pathname = new URL(provisioned.urlMigrate).pathname;
    const bootstrapUrl = url.toString();
    return { bootstrapUrl, urlMigrate: provisioned.urlMigrate, tenantScoped: await enumerateTenantScopedTables(bootstrapUrl) };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** Which of this increment's tables the migrated database really holds, in the order declared. */
async function presentTables(): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  const held = new Set(
    run(
      bootstrapUrl,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p');`,
    ).map((row) => row[0] ?? ""),
  );
  return TABLES.filter((table) => held.has(table));
}

/** The privileges a role holds on a table, as the catalogue reports them. */
async function privilegesOf(table: string, role: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(role)}
      order by privilege_type;`,
  )
    .map((row) => row[0] ?? "")
    .sort();
}

/** The constraint definitions of one kind a table carries. */
async function constraintsOf(table: string, kind: "p" | "u" | "f" | "c"): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select pg_get_constraintdef(oid) from pg_constraint
      where conrelid = ${lit(`public.${table}`)}::regclass and contype = ${lit(kind)}
      order by conname;`,
  ).map((row) => row[0] ?? "");
}

/** Every upper-case literal a constraint definition admits — what a CHECK over a roster says. */
function literalsOf(definition: string): string[] {
  return [...definition.matchAll(/'([A-Z_]+)'/g)].map((found) => found[1] ?? "").sort();
}

/** The reason this suite's system-scoped statements run under — attributable, like any other. */
const REASON = "test: probe the placement store's note columns";

/** A CHECK violation, as Postgres names one — how a refusal is told from a mistake about the row. */
const CHECK_VIOLATION = "23514";

/**
 * What a plan note said about a member, as the five columns carry it (I-303). Every field is
 * optional and an absent one is written as NULL, because the whole point of these cases is which
 * COMBINATIONS the store admits: `{}` is the standing insert of a member no note named.
 */
type Note = { key?: string; text?: string; from?: string; to?: string; shape?: string };

/** The five columns a note is read into, beside the outline and the mark it was read off (I-303). */
const NOTE_COLUMNS: readonly string[] = ["note_key", "note_text", "note_from_label", "note_to_label", "note_shape"];

/** The columns a placement cannot be written without — everything the store requires of one. */
const REQUIRED: readonly string[] = [
  TENANT_COLUMN,
  "project_id",
  "drawing_id",
  "ingest_id",
  "placement_key",
  "view_key",
  "mark",
  "mark_text",
  "element_type",
  "x",
  "y",
  "outline_key",
  "mark_key",
];

/** The columns a placement is inserted with here: everything required, and the five a note fills. */
const INSERTED: readonly string[] = [...REQUIRED, ...NOTE_COLUMNS];

/** A text column's value, or NULL where the note said nothing there. */
function said(value: string | undefined): string {
  return value === undefined ? "null" : lit(value);
}

/**
 * One placement row as the store is asked to accept it: a column of S-10's layout plan, lawful in
 * every respect but the note the case hands in. Each row mints its own tenant and ingest, so the key
 * can never collide with a sibling case's and a refusal is never a duplicate key wearing a disguise.
 */
function insertPlacement(note: Note): string {
  return `insert into "${PLACEMENTS}" (${INSERTED.map((column) => `"${column}"`).join(", ")})
    values (${lit(randomUUID())}::uuid, ${lit(randomUUID())}::uuid, ${lit(randomUUID())}::uuid, ${lit(randomUUID())}::uuid,
            ${lit(`LAYOUT_PLAN:DXF_HANDLE:1|C7|1.0,2.0`)}, ${lit("LAYOUT_PLAN:DXF_HANDLE:1")}, ${lit("C7")}, ${lit("C7")}, ${lit("column")}, 1.0, 2.0,
            ${lit(`DXF_HANDLE:${randomUUID()}`)}, ${lit(`DXF_HANDLE:${randomUUID()}`)},
            ${said(note.key)}, ${said(note.text)}, ${said(note.from)}, ${said(note.to)}, ${said(note.shape)});`;
}

/** That insert, attempted under a session the store's system scope admits. */
async function attemptPlacement(note: Note): Promise<ReturnType<typeof psql>> {
  const { bootstrapUrl } = await staged();
  return psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, insertPlacement(note)));
}

/**
 * The two texts F-RCC6-BNBC's S-10 COLUMN LAYOUT PLAN passes to I-303, as the store must hold them:
 * the one that states a SHAPE and no range at all, and the one that states a range and leaves its top
 * open. They are written here as the drawing writes them — `%%C450` is what the entity carries, and a
 * reading never replaces what was drawn (L-CAD-03) — because these are the rows this increment exists
 * to make storable, and a case that invented its own note would prove the constraint rather than the
 * door.
 */
const PORCH: Note = { key: "DXF_HANDLE:9BA", text: "C7 %%C450 PORCH COLUMN", shape: MEMBER_SHAPES[0] };
const FLOATING: Note = { key: "DXF_HANDLE:9BC", text: "C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)", from: "1F" };

/** The name, type and nullability of every column of a table, as the catalogue describes them. */
async function columnsOf(table: string): Promise<Record<string, string>> {
  const { bootstrapUrl } = await staged();
  const rows = run(
    bootstrapUrl,
    `select column_name, data_type || ' ' || is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = ${lit(table)} order by 1;`,
  );
  return Object.fromEntries(rows.map((row) => [row[0] ?? "", row[1] ?? ""]));
}

describe("V-DB: the placement stages' four tables are migrated, tenant-scoped and posture-bound", () => {
  it("the product's own migration lane lands all four tables, and running it again converges", async () => {
    const { urlMigrate } = await staged();
    expect(await presentTables(), "the lane applied the migration that lands the three stages' tables").toEqual([...TABLES]);

    const again = spawnSync(process.execPath, [join(REPO_ROOT, MIGRATE_SCRIPT)], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: urlMigrate },
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(
      again.status,
      `a second run of the migration lane converges on the same database — an unjournaled or rewritten migration re-runs and collides:\n${`${again.stdout ?? ""}${again.stderr ?? ""}`.slice(-1200)}`,
    ).toBe(0);
    expect(await presentTables(), "and the tables it landed are still exactly the ones it landed").toEqual([...TABLES]);
  });

  it("all four carry tenant_id and stand in the enumeration the seam suite is driven from", async () => {
    const { tenantScoped } = await staged();
    for (const table of TABLES) {
      expect(
        tenantScoped,
        `public.${table} carries ${TENANT_COLUMN}, so every per-table proof seam-tenant.live.test.ts makes over this enumeration binds it too (R-SPINE-004, B-19)`,
      ).toContain(`public.${table}`);
    }
  });

  it("all four have row-level security enabled AND forced, with a policy that reads the tenant GUC", async () => {
    const { bootstrapUrl } = await staged();
    for (const table of TABLES) {
      const row = run(
        bootstrapUrl,
        `select c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = ${lit(table)};`,
      )[0];
      expect(isTrue(row?.[0] ?? ""), `public.${table} has row-level security ENABLED`).toBe(true);
      expect(isTrue(row?.[1] ?? ""), `public.${table} has row-level security FORCED — an owner is not exempt from a workspace boundary (SEAM-TENANT)`).toBe(true);
      const policies = count(
        bootstrapUrl,
        `select count(*) from pg_policies where schemaname = 'public' and tablename = ${lit(table)}
          and (coalesce(qual, '') like ${lit(`%${GUC_TENANT}%`)} or coalesce(with_check, '') like ${lit(`%${GUC_TENANT}%`)});`,
      );
      expect(policies, `public.${table} carries at least one policy that reads ${GUC_TENANT} — the boundary is the store's, not a caller's WHERE`).toBeGreaterThan(0);
    }
  });

  it("a rebuilt stage's rows may be re-derived, and an authored range may neither be rewritten nor erased", async () => {
    for (const table of REBUILT) {
      expect(
        await privilegesOf(table, ROLE_APP),
        `${ROLE_APP} reads, adds and clears public.${table} — a stage of a partition is rebuilt per ingest, rows and all (R-TO-030, L-REG-04)`,
      ).toEqual(expect.arrayContaining(["DELETE", "INSERT", "SELECT"]));
    }

    const authored = await privilegesOf(AUTHORED, ROLE_APP);
    expect(authored, `${ROLE_APP} cannot DELETE from public.${AUTHORED} — a rebuild may not take away what a person authored (L-ACT-01)`).not.toContain("DELETE");
    expect(authored, `${ROLE_APP} cannot UPDATE public.${AUTHORED} — a range is authored, never edited (L-ACT-01)`).not.toContain("UPDATE");
    // The two proofs above are only proofs if the role reaches the table at all.
    expect(authored, `${ROLE_APP} reads and adds public.${AUTHORED}`).toEqual(expect.arrayContaining(["INSERT", "SELECT"]));
  });

  it("an authored range names the levels it runs between and the act that authored it", async () => {
    expect(await presentTables(), `public.${AUTHORED} stands in the migrated database — its constraints are what this case reads`).toContain(AUTHORED);

    const keys = await constraintsOf(AUTHORED, "f");
    for (const column of ["from_level_id", "to_level_id"]) {
      expect(
        keys.some((definition) => definition.includes(column) && definition.includes(LEVELS)),
        `public.${AUTHORED}.${column} points at the level it names — a range runs between surrogates, never between labels (L-REG-02)`,
      ).toBe(true);
    }
    expect(
      keys.some((definition) => definition.includes("act_id") && definition.includes(ACTS)),
      `and public.${AUTHORED}.act_id points at the act that authored it (L-ACT-01)`,
    ).toBe(true);
  });

  it("the reason a view defers under is checked against the two the register admits, and no other", async () => {
    expect(await presentTables(), `public.${DEFERRALS} stands in the migrated database — its constraints are what this case reads`).toContain(DEFERRALS);

    const checks = (await constraintsOf(DEFERRALS, "c")).filter((definition) => definition.includes("reason"));
    expect(checks.length, `public.${DEFERRALS} carries a CHECK on reason — the roster is the store's, not a writer's memory (Q-07)`).toBeGreaterThan(0);
    const admitted = new Set(checks.flatMap((definition) => literalsOf(definition)));
    expect(
      [...admitted].sort(),
      `the CHECK admits exactly ${EXPANSION_DEFERRAL_REASONS.join(", ")} — a reason nobody registered is barred at the store as well as at the resolver (L-CAD-07, Q-07)`,
    ).toEqual([...EXPANSION_DEFERRAL_REASONS].sort());
  });

  it("I-303: what a plan note said about a member stands in five columns beside it, none of them required", async () => {
    expect(await presentTables(), `public.${PLACEMENTS} stands in the migrated database — its columns are what this case reads`).toContain(PLACEMENTS);

    const columns = await columnsOf(PLACEMENTS);
    for (const column of NOTE_COLUMNS) {
      expect(
        columns[column],
        `public.${PLACEMENTS}.${column} is a NULLABLE text column — the plan's typical members are noted by nobody and carry none of these, and a note stored is what lets the rebuild (which reads the drawing) and the re-expansion (which reads only these rows) answer the same rows (I-303, B-17)`,
      ).toBe("text YES");
    }
    for (const column of REQUIRED) {
      expect(
        columns[column],
        `and public.${PLACEMENTS}.${column} is still required — the note was added BESIDE the placement, never instead of any part of it`,
      ).toMatch(/ NO$/);
    }
  });

  it("I-303: a member no note named is inserted exactly as it always was", async () => {
    expect(await presentTables(), `public.${PLACEMENTS} stands in the migrated database — what it accepts is what this case reads`).toContain(PLACEMENTS);

    const typical = await attemptPlacement({});
    expect(
      typical.ok,
      `a placement carrying no note at all is one the store accepts — that is every one of the plan's typical members, and with none accepted the refusals below would prove nothing:\n${typical.stderr.slice(-600)}`,
    ).toBe(true);
  });

  it("I-303: the store holds S-10's two noted members — the one that stated a shape, and the one that stated a range", async () => {
    expect(await presentTables(), `public.${PLACEMENTS} stands in the migrated database — what it accepts is what this case reads`).toContain(PLACEMENTS);

    const porch = await attemptPlacement(PORCH);
    expect(
      porch.ok,
      `C7's row is NOTED WITH NO RANGE STATED — both labels null under a note key, which I-303 reads as "the level the plan draws, alone" — and it is the row a careless CHECK forbids:\n${porch.stderr.slice(-600)}`,
    ).toBe(true);

    const bare = await attemptPlacement({ key: PORCH.key, text: PORCH.text });
    expect(
      bare.ok,
      `and a note key with neither label nor shape is admitted too: a stored row with a note and both labels null says "noted, no range stated" and nothing else — there is no band with both ends open for it to be mistaken for (I-303):\n${bare.stderr.slice(-600)}`,
    ).toBe(true);

    const floating = await attemptPlacement(FLOATING);
    expect(
      floating.ok,
      `C5's row states a range whose TOP IS OPEN — "STARTS AT 1F" is a start and no end — so a from-label standing without a to-label is lawful and must not be checked into a pair:\n${floating.stderr.slice(-600)}`,
    ).toBe(true);
  });

  it("I-303: a note is stored WHOLE — its key and the words it was read from stand together or not at all", async () => {
    expect(await presentTables(), `public.${PLACEMENTS} stands in the migrated database — what it refuses is what this case reads`).toContain(PLACEMENTS);

    const keyAlone = await attemptPlacement({ key: PORCH.key });
    expect(keyAlone.ok, `a note key with no words is a citation nobody can read back, so the store refuses the row however it reached the insert (L-CAD-03)`).toBe(false);
    expect(keyAlone.sqlstate, `and it is a CHECK that refused a key with no words, not something else about the row`).toBe(CHECK_VIOLATION);

    const wordsAlone = await attemptPlacement({ text: PORCH.text });
    expect(wordsAlone.ok, `and words with no key are a reading of nothing — a note nobody can trace back to the entity it was read off (L-CAD-03)`).toBe(false);
    expect(wordsAlone.sqlstate, `and it is a CHECK that refused words with no key`).toBe(CHECK_VIOLATION);
  });

  it("I-303: nothing is STATED under no note — a label or a shape may only stand where a note stands", async () => {
    expect(await presentTables(), `public.${PLACEMENTS} stands in the migrated database — what it refuses is what this case reads`).toContain(PLACEMENTS);

    const stated: readonly Note[] = [{ from: "1F" }, { to: "6F" }, { from: "1F", to: "6F" }, { shape: MEMBER_SHAPES[0] }];
    for (const note of stated) {
      const attempt = await attemptPlacement(note);
      expect(
        attempt.ok,
        `${JSON.stringify(note)} narrows a member with no note behind it — and a narrowing with no evidence is the one thing I-303 may never do (L-QTY-01) — so the store refuses the row`,
      ).toBe(false);
      expect(attempt.sqlstate, `and it is a CHECK that refused ${JSON.stringify(note)}`).toBe(CHECK_VIOLATION);
    }
  });

  it("I-303: the shape a note stated is checked against the roster the reader publishes, and no other", async () => {
    expect(await presentTables(), `public.${PLACEMENTS} stands in the migrated database — its constraints are what this case reads`).toContain(PLACEMENTS);

    const checks = (await constraintsOf(PLACEMENTS, "c")).filter((definition) => definition.includes("note_shape") && definition.includes("'"));
    expect(checks.length, `public.${PLACEMENTS} carries a CHECK over note_shape — the roster is the store's, not a writer's memory (R-TO-032)`).toBeGreaterThan(0);
    const admitted = new Set(checks.flatMap((definition) => literalsOf(definition)));
    expect(
      [...admitted].sort(),
      `the CHECK admits exactly ${MEMBER_SHAPES.join(", ")} — the one roster, read off the module that declares it rather than spelled a second time (B-19, B-17)`,
    ).toEqual([...MEMBER_SHAPES].sort());

    for (const shape of MEMBER_SHAPES) {
      const attempt = await attemptPlacement({ key: PORCH.key, text: PORCH.text, shape });
      expect(attempt.ok, `'${shape}' is a member of the roster, so the store accepts it:\n${attempt.stderr.slice(-600)}`).toBe(true);
    }

    // Filtered against the roster rather than spelled against it: a shape this list names that the
    // reader later publishes is a member, and the case must grow with the roster instead of reddening.
    const outside = ["SQUARE", "RECTANGULAR", "round", "ROUND ", ""].filter((shape) => !(MEMBER_SHAPES as readonly string[]).includes(shape));
    expect(outside.length, "this case needs at least one shape the roster does not hold — with none there is no refusal to observe").toBeGreaterThan(0);
    for (const shape of outside) {
      const attempt = await attemptPlacement({ key: PORCH.key, text: PORCH.text, shape });
      expect(attempt.ok, `a shape of '${shape}' is outside the roster the reader publishes, so the store refuses the row however it reached the insert`).toBe(false);
      expect(attempt.sqlstate, `and it is a CHECK that refused '${shape}', not something else about the row`).toBe(CHECK_VIOLATION);
    }
  });
});

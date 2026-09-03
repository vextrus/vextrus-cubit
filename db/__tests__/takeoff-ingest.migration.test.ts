/**
 * AC-1 — the `ingests` table as the store holds it (R-TO-001, L-CAD-02, SEAM-TENANT, V-DB).
 *
 * An ingest record is evidence: it pins WHICH extractor, at which version and parameter set, took
 * which geometry out of which bytes. So the properties graded here are the ones that make the
 * record trustworthy afterwards — one home for the declaration, a migration the lane really
 * applies, a row nobody can quietly change, a scope no other workspace can read, and a job that can
 * only ever have written one row.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * B-19: the row-security posture is not transcribed — it is derived by COMPARISON against the
 * tenant-scoped tables already in the migrated database, so an increment that tightens the posture
 * tightens this case with it. Only what AC-1 itself defines (the column roster, the two index
 * definitions, the closed extractor scheme) is pinned, because those are what the criterion IS.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, GUC_TENANT, HANDWRITTEN_MARKER, ROLE_APP, TENANT_ALPHA, TENANT_COLUMN } from "./support/fixtures";
import { ident, isTrue, lit, psql, run, scalar, seedTenants, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The one home of every cubit table (SEAM-TENANT), and the tree the drift lane reads them back from. */
const DB_MODULE = "src/core/db.ts";
const SCHEMA_BARREL = "db/schema.ts";
const SCHEMA_AREA = "db/schema/takeoff-ingest.ts";

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
const MIGRATION = "takeoff-ingest";

/** The table, and the tables whose rows it points at. */
const TABLE = "ingests";
const DRAWINGS = "drawings";

/** The one thing a `scheme` may be while DXF is the only lane wired through the CLI (L-CAD-02). */
const SCHEME = "DXF_HANDLE";

/** The reason a system-scoped statement of this suite is made under — attributable, like any other. */
const REASON = "test: grade the ingest record's posture";

const MIGRATIONS = join(REPO_ROOT, "db", "migrations");
const JOURNAL = join(MIGRATIONS, "meta", "_journal.json");

/** Import a product module by repo-relative path, asserting it exists first. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

type Stage = { bootstrapUrl: string; urlApp: string; tenantScoped: string[]; tenantId: string; drawingId: string };

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

    // A row of `ingests` names a drawing, so one has to exist before the table can be driven at all.
    const tenantId = seedTenants(provisioned.urlMigrate)[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    const digest = "a".repeat(64);
    const drawingId = scalar(
      provisioned.urlMigrate,
      withSession(
        { [GUC_SYSTEM_REASON]: REASON },
        `insert into ${ident("files")} (${ident(TENANT_COLUMN)}, sha256, byte_length, format, scan_verdict)
           values (${lit(tenantId)}::uuid, ${lit(digest)}, 4, 'dxf', 'skipped');
         insert into ${ident(DRAWINGS)} (${ident(TENANT_COLUMN)}, project_id, sha256, name, format, uploaded_by)
           values (${lit(tenantId)}::uuid, ${lit(randomUUID())}::uuid, ${lit(digest)}, 'S-101.dxf', 'dxf', ${lit(randomUUID())}::uuid)
           returning drawing_id::text;`,
      ),
    );

    return { bootstrapUrl, urlApp: provisioned.urlApp, tenantScoped: await enumerateTenantScopedTables(bootstrapUrl), tenantId, drawingId };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** Every column of the table, with the type Postgres holds it as and whether it may be absent. */
async function columns(): Promise<Map<string, { type: string; nullable: boolean; fallback: string }>> {
  const { bootstrapUrl } = await staged();
  const rows = run(
    bootstrapUrl,
    `select column_name, data_type, is_nullable, coalesce(column_default, '')
       from information_schema.columns
      where table_schema = 'public' and table_name = ${lit(TABLE)}
      order by ordinal_position;`,
  );
  expect(rows.length, `the migrated database holds no public.${TABLE} — the ingest record's table has not landed`).toBeGreaterThan(0);
  return new Map(rows.map((row) => [row[0] ?? "", { type: row[1] ?? "", nullable: (row[2] ?? "") === "YES", fallback: row[3] ?? "" }]));
}

/** Every index on the table, by name, as Postgres reconstructs its definition. */
async function indexes(): Promise<Map<string, string>> {
  const { bootstrapUrl } = await staged();
  return new Map(
    run(bootstrapUrl, `select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = ${lit(TABLE)};`).map((row) => [row[0] ?? "", row[1] ?? ""]),
  );
}

/** One row this suite writes for itself, under a fresh job id, to see whether it holds still. */
function insertRow(stage: Stage, jobId: string): string {
  return `insert into ${ident(TABLE)} (${ident(TENANT_COLUMN)}, drawing_id, sha256, job_id, artifact_sha256, extractor_scheme, extractor_tool, extractor_tool_version, extractor_parameter_set_hash, facts)
            values (${lit(stage.tenantId)}::uuid, ${lit(stage.drawingId)}::uuid, ${lit("b".repeat(64))}, ${lit(jobId)}, ${lit("c".repeat(64))},
                    ${lit(SCHEME)}, 'ezdxf', '0.0.0', ${lit("d".repeat(64))}, '{"insunits":null}'::json);`;
}

describe("AC-1 — the ingest record is declared once, migrated, and holds still", () => {
  it("AC-1: exactly one db/migrations/*takeoff-ingest*.sql exists, the journal carries its tag, and the posture stands after the hand-written marker", () => {
    const matches = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith(".sql"))
      .filter((name) => name.includes(MIGRATION));
    expect(matches.length, `exactly one db/migrations/*${MIGRATION}*.sql is owed; found ${matches.length === 0 ? "none" : matches.join(", ")}`).toBe(1);

    const tag = (matches[0] ?? "").replace(/\.sql$/, "");
    expect(
      readFileSync(JOURNAL, "utf8").includes(tag),
      `db/migrations/meta/_journal.json carries no entry tagged ${tag}; a migration the journal does not name is a migration the lane never applies`,
    ).toBe(true);

    // The generated half and the hand-written half are separated by the marker the tree already
    // uses, so a later `drizzle-kit generate` can be read against what it would have written.
    const sql = readFileSync(join(MIGRATIONS, matches[0] ?? ""), "utf8");
    const marker = sql.indexOf(HANDWRITTEN_MARKER);
    expect(marker, `the migration must carry the line ${JSON.stringify(HANDWRITTEN_MARKER)} once, between the generated half and the hand-written one`).toBeGreaterThanOrEqual(0);
    expect(sql.indexOf(HANDWRITTEN_MARKER, marker + 1), "the hand-written marker stands exactly once").toBe(-1);
    for (const handwritten of ["row level security", "create policy", "grant ", "create trigger"]) {
      const at = sql.toLowerCase().indexOf(handwritten);
      expect(at, `the migration states \`${handwritten.trim()}\` — nothing generated declares the seam's posture`).toBeGreaterThanOrEqual(0);
      expect(at > marker, `\`${handwritten.trim()}\` belongs to the hand-written half, after the marker`).toBe(true);
    }
  });

  it("AC-1: src/core/db.ts declares the table once, the schema tree re-exports it, and the typed surface carries it", async () => {
    const core = await productModule<Record<string, unknown>>(DB_MODULE);
    const area = await productModule<Record<string, unknown>>(SCHEMA_AREA);
    const barrel = await productModule<Record<string, unknown>>(SCHEMA_BARREL);

    const declared = core[TABLE];
    expect(declared, `${DB_MODULE} must export \`${TABLE}\` — every cubit table has one home (SEAM-TENANT, ARCH-02)`).toBeTruthy();
    expect(area[TABLE], `${SCHEMA_AREA} must NAMED-re-export the same table object — a second declaration is a second home`).toBe(declared);
    // The drift lane generates only from db/schema.ts: a table missing from THAT reachable set makes
    // drizzle-kit write a DROP migration, whatever the area file says.
    expect(barrel[TABLE], `${SCHEMA_BARREL} must reach ${TABLE} — the drift lane generates from this barrel and from nothing else`).toBe(declared);

    const surface = core["SEAM_SCHEMA"] as Record<string, unknown> | undefined;
    expect(surface, `${DB_MODULE} exports SEAM_SCHEMA`).toBeTruthy();
    expect(
      Object.values(surface ?? {}).includes(declared),
      `SEAM_SCHEMA must carry ${TABLE}: a table joins the typed surface by joining that object (B-05)`,
    ).toBe(true);
  });

  it("AC-1: the record carries the facts it is a record OF — the bytes, the job, the artifact, the extractor's identity and what it counted", async () => {
    const held = await columns();
    const required: [string, string][] = [
      [TENANT_COLUMN, "uuid"],
      ["ingest_id", "uuid"],
      ["drawing_id", "uuid"],
      ["sha256", "text"],
      ["job_id", "text"],
      ["artifact_sha256", "text"],
      ["extractor_scheme", "text"],
      ["extractor_tool", "text"],
      ["extractor_tool_version", "text"],
      ["extractor_parameter_set_hash", "text"],
      // `json`, not `jsonb`: the counters are read back in the artifact's own order (AC-4), and
      // jsonb re-orders the keys of every object it stores.
      ["facts", "json"],
      ["created_at", "timestamp with time zone"],
    ];
    for (const [name, type] of required) {
      const column = held.get(name);
      expect(column, `public.${TABLE}.${name} is owed by AC-1`).toBeTruthy();
      expect(column?.type, `public.${TABLE}.${name} is ${type}`).toBe(type);
      expect(column?.nullable, `public.${TABLE}.${name} is a fact every record has — it cannot be absent`).toBe(false);
    }
    expect(held.get("ingest_id")?.fallback, "an ingest mints its own id").toContain("gen_random_uuid");

    // The two that a first ingest genuinely has nothing to say about: a re-ingest is declared with a
    // reason and names what it supersedes, and a first ingest supersedes nothing.
    for (const optional of ["supersedes_ingest_id", "declared_reason"]) {
      const column = held.get(optional);
      expect(column, `public.${TABLE}.${optional} is owed by AC-1`).toBeTruthy();
      expect(column?.nullable, `public.${TABLE}.${optional} is empty on a first ingest, so it may be absent`).toBe(true);
    }
    expect(held.get("supersedes_ingest_id")?.type, "a superseded record is named by its id").toBe("uuid");
    expect(held.get("declared_reason")?.type, "a declared reason is text a person wrote").toBe("text");
  });

  it("AC-1: a record points at a drawing that exists, and the only closed list is the extractor scheme", async () => {
    await columns();
    const { bootstrapUrl } = await staged();
    const foreign = run(
      bootstrapUrl,
      `select pg_get_constraintdef(oid) from pg_constraint where conrelid = ${lit(`public.${TABLE}`)}::regclass and contype = 'f';`,
    ).map((row) => row.join("|"));
    expect(
      foreign.some((definition) => definition.includes(DRAWINGS) && definition.includes("drawing_id")),
      `public.${TABLE} must point at public.${DRAWINGS} by drawing_id — a record of an ingest of nothing is not a record`,
    ).toBe(true);

    const checks = run(
      bootstrapUrl,
      `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = ${lit(`public.${TABLE}`)}::regclass and contype = 'c';`,
    );
    expect(
      checks.length,
      `public.${TABLE} carries exactly one CHECK — the closed extractor scheme. It carries ${checks.length}: ${checks.map((row) => row[0]).join(", ")}. Whether a declared reason and a superseded id go together is judged at the seam, where a refusal can be answered.`,
    ).toBe(1);
    const definition = checks[0]?.[1] ?? "";
    expect(definition, "the CHECK closes `extractor_scheme`").toContain("extractor_scheme");
    expect(definition, `the scheme list is closed to '${SCHEME}' — L-CAD-02's schemes are minted per extractor, and only ezdxf's lane is wired`).toContain(SCHEME);
    for (const unwired of ["PDF_OBJECT", "RASTER_TRACE"]) {
      expect(definition, `${unwired} mints no key through this pipeline yet, so the list does not admit it`).not.toContain(unwired);
    }
  });

  it("AC-1: one job writes one record, and a drawing's records are read newest-first by index", async () => {
    const held = await indexes();
    const jobOnce = held.get("ingests_job_once");
    expect(jobOnce, `the unique index ingests_job_once is what makes a retried attempt idempotent; the table carries ${[...held.keys()].join(", ")}`).toBeTruthy();
    expect(jobOnce?.toLowerCase(), "ingests_job_once is UNIQUE — otherwise a retry writes a second record for one job").toContain("unique");
    for (const column of [TENANT_COLUMN, "job_id"]) {
      expect(jobOnce, `ingests_job_once is keyed on ${column}`).toContain(column);
    }

    const byDrawing = held.get("ingests_by_drawing");
    expect(byDrawing, "the index ingests_by_drawing is the read every ingest history makes").toBeTruthy();
    for (const column of [TENANT_COLUMN, "drawing_id", "created_at"]) {
      expect(byDrawing, `ingests_by_drawing is keyed on ${column}`).toContain(column);
    }
  });

  it("AC-1: the table is tenant-scoped, wears the posture its peers wear, and names both policies", async () => {
    const { bootstrapUrl, tenantScoped } = await staged();
    const qualified = `public.${TABLE}`;
    expect(tenantScoped, `${qualified} carries ${TENANT_COLUMN} — a workspace's ingests are its own (R-SPINE-004)`).toContain(qualified);

    const posture = new Map<string, string>();
    for (const row of run(
      bootstrapUrl,
      `select n.nspname || '.' || c.relname, c.relrowsecurity::text || '/' || c.relforcerowsecurity::text
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r' and n.nspname = 'public';`,
    )) {
      posture.set(row[0] ?? "", row[1] ?? "");
    }
    // Not spelled here: whatever every other tenant-scoped table wears is what this one wears.
    const peers = tenantScoped.filter((peer) => peer !== qualified);
    expect(peers.length, "there are tenant-scoped tables to compare against").toBeGreaterThan(0);
    for (const peer of peers) {
      expect(posture.get(qualified), `${qualified} must wear the row-security posture ${peer} wears (SEAM-TENANT)`).toBe(posture.get(peer));
    }

    const policies = new Map(
      run(
        bootstrapUrl,
        `select polname, coalesce(pg_get_expr(polqual, polrelid), '') || ' ' || coalesce(pg_get_expr(polwithcheck, polrelid), '')
           from pg_policy where polrelid = ${lit(qualified)}::regclass;`,
      ).map((row) => [row[0] ?? "", row[1] ?? ""]),
    );
    expect(policies.get("ingests_tenant_scope"), `${qualified} carries the policy ingests_tenant_scope; it carries ${[...policies.keys()].join(", ") || "none"}`).toBeTruthy();
    expect(policies.get("ingests_tenant_scope"), "the tenant policy is judged against the scope the request armed").toContain(GUC_TENANT);
    expect(policies.get("ingests_system_scope"), `${qualified} carries the policy ingests_system_scope`).toBeTruthy();
    expect(policies.get("ingests_system_scope"), "a system read states its reason (SEAM-TENANT)").toContain(GUC_SYSTEM_REASON);
  });

  it("AC-1: an ingest record is evidence — the app role adds and reads it, and nothing takes one away", async () => {
    const stage = await staged();
    const held = run(
      stage.bootstrapUrl,
      `select distinct privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and table_name = ${lit(TABLE)} and grantee = ${lit(ROLE_APP)} order by privilege_type;`,
    ).map((row) => row[0] ?? "");
    expect(held, `${ROLE_APP} reads and adds ${TABLE} and does nothing else — an ingest is a record of what happened (R-TO-001)`).toEqual(["INSERT", "SELECT"]);

    // A grant is only half of it: the owner is not the app role, and FORCE ROW LEVEL SECURITY plus
    // the append-only triggers are what make the record hold still for everybody.
    const jobId = `probe-${randomUUID()}`;
    const written = psql(stage.bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, insertRow(stage, jobId)));
    expect(written.ok, `a record could not be written at all, so nothing about changing one can be judged:\n${written.stderr.slice(-600)}`).toBe(true);

    for (const [what, statement] of [
      ["changed", `update ${ident(TABLE)} set declared_reason = 'rewritten' where job_id = ${lit(jobId)};`],
      ["taken away", `delete from ${ident(TABLE)} where job_id = ${lit(jobId)};`],
      ["emptied", `truncate table ${ident(TABLE)};`],
    ] as const) {
      const attempt = psql(stage.bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, statement));
      expect(attempt.ok, `an ingest record that has been ${what} is not evidence — the append-only triggers must refuse this`).toBe(false);
    }

    const survivors = run(
      stage.bootstrapUrl,
      withSession({ [GUC_SYSTEM_REASON]: REASON }, `select coalesce(declared_reason, ''), job_id from ${ident(TABLE)} where job_id = ${lit(jobId)};`),
    );
    expect(survivors.length, "the record is still there, untouched, after every attempt to change it").toBe(1);
    expect(survivors[0]?.[0], "nothing of the record was rewritten").toBe("");

    // A second attempt of the SAME job writes nothing new: the unique index is the belt behind the
    // handler's own idempotency (AC-5).
    const second = psql(stage.bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, insertRow(stage, jobId)));
    expect(second.ok, "two records for one job id is exactly what ingests_job_once forbids").toBe(false);
  });

  it("AC-1: one workspace never sees another's ingest records", async () => {
    const stage = await staged();
    const jobId = `scope-${randomUUID()}`;
    const seeded = psql(stage.bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, insertRow(stage, jobId)));
    expect(seeded.ok, `the scoped read has nothing to be scoped against:\n${seeded.stderr.slice(-600)}`).toBe(true);

    const own = run(stage.urlApp, withSession({ [GUC_TENANT]: stage.tenantId }, `select count(*)::text from ${ident(TABLE)} where job_id = ${lit(jobId)};`));
    expect(own[0]?.[0], "the workspace whose ingest it is reads it — a scope that hides everything proves nothing").toBe("1");

    const stranger = run(stage.urlApp, withSession({ [GUC_TENANT]: randomUUID() }, `select count(*)::text from ${ident(TABLE)} where job_id = ${lit(jobId)};`));
    expect(stranger[0]?.[0], "another workspace's scope reads none of it (R-SPINE-004)").toBe("0");

    const forced = run(stage.bootstrapUrl, `select relforcerowsecurity::text from pg_class where oid = ${lit(`public.${TABLE}`)}::regclass;`);
    expect(isTrue(forced[0]?.[0] ?? ""), "row security is FORCED, so the owner is bound by the scope too (SEAM-TENANT)").toBe(true);
  });
});

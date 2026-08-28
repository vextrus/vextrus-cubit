// AC-1, AC-2 and AC-3, live (V-DB): a self-provisioned, migrated scratch database, the two live
// roles, and the model-call ledger judged exactly as every other cubit table is — shape from
// information_schema, governance from pg_class/pg_policies, scoped reads driven as the app role,
// and the seam's own attribution surface answered through forTenant(ctx).
//
// Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
// rest of the tree. The seam is loaded by absolute path rather than by a literal specifier, so a
// module that does not export modelSpendByProject yet fails as an assertion naming it instead of
// killing collection at transform time.
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb } from "./harness";
import { AUDIT_REASON, GUC_SYSTEM_REASON, GUC_TENANT, ROLE_APP, SEED_REASON, TENANTS_TABLE, TENANT_ALPHA, TENANT_BETA, TENANT_COLUMN } from "./support/fixtures";
import { count, ident, isTrue, lit, psql, run, scalar, seedTenants, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The seam: the only file where a table builder is lawful, and the home of the attribution read. */
const SEAM_MODULE = "src/core/db.ts";

/** The two tables this increment migrates. */
const MODEL_CALLS = "model_calls";
const MODEL_FIXTURES = "model_fixtures";

/** The model id the seeded scenario spends on — any id will do; the ledger stores it as text. */
const SEEDED_MODEL = "claude-sonnet-5";

/* ------------------------------------------------------------------ *
 * The shape the increment contracts, column by column.
 * ------------------------------------------------------------------ */

type ColumnShape = { type: string; nullable: boolean; defaulted?: boolean };

const CALL_SHAPE: Record<string, ColumnShape> = {
  call_id: { type: "uuid", nullable: false },
  tenant_id: { type: "uuid", nullable: false },
  project_id: { type: "uuid", nullable: false },
  model_id: { type: "text", nullable: false },
  request_hash: { type: "text", nullable: false },
  transport: { type: "text", nullable: false },
  outcome: { type: "text", nullable: false },
  refusal_code: { type: "text", nullable: true },
  input_tokens: { type: "integer", nullable: false },
  output_tokens: { type: "integer", nullable: false },
  attributed_cost: { type: "numeric", nullable: false },
  called_at: { type: "timestamp with time zone", nullable: false, defaulted: true },
};

const FIXTURE_SHAPE: Record<string, ColumnShape> = {
  tenant_id: { type: "uuid", nullable: false },
  request_hash: { type: "text", nullable: false },
  fixture_digest: { type: "text", nullable: false },
  recorded_at: { type: "timestamp with time zone", nullable: false, defaulted: true },
};

const CONTRACTED: Record<string, Record<string, ColumnShape>> = { [MODEL_CALLS]: CALL_SHAPE, [MODEL_FIXTURES]: FIXTURE_SHAPE };

/* ------------------------------------------------------------------ *
 * The seam, as its callers see it.
 * ------------------------------------------------------------------ */

type SpendEntry = {
  projectId?: string;
  calls?: number;
  proposed?: number;
  refused?: number;
  inputTokens?: number;
  outputTokens?: number;
  attributedCost?: string;
};

type Seam = {
  forTenant?: (ctx: { tenantId: string }) => unknown;
  modelSpendByProject?: (db: unknown) => Promise<SpendEntry[]>;
};

async function loadSeam(databaseUrl: string): Promise<Seam> {
  process.env["DATABASE_URL"] = databaseUrl;
  const abs = join(REPO_ROOT, SEAM_MODULE);
  expect(existsSync(abs) && statSync(abs).isFile(), `${SEAM_MODULE} is missing from the checkout`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as Seam;
}

async function spendByProject(seam: Seam, tenantId: string): Promise<SpendEntry[]> {
  const forTenant = seam.forTenant;
  const read = seam.modelSpendByProject;
  expect(typeof forTenant, `${SEAM_MODULE} exports no forTenant(ctx) — SEAM-TENANT names it one of the two database handles`).toBe("function");
  expect(typeof read, `${SEAM_MODULE} exports no modelSpendByProject(db) — R-AI-005's per-project spend has to be answerable from the seam`).toBe("function");
  if (typeof forTenant !== "function" || typeof read !== "function") return [];
  return read(forTenant({ tenantId }));
}

/* ------------------------------------------------------------------ *
 * Seeding, through the system channel the harness already speaks.
 * ------------------------------------------------------------------ */

type SeededCall = {
  projectId: string;
  transport: string;
  outcome: string;
  refusalCode: string | null;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
};

/** A model-call row, every contracted column named — call_id included, so no default is assumed. */
function seedCall(url: string, tenantId: string, call: SeededCall): void {
  run(
    url,
    withSession(
      { [GUC_SYSTEM_REASON]: SEED_REASON },
      `insert into ${ident(MODEL_CALLS)} (call_id, tenant_id, project_id, model_id, request_hash, transport, outcome, refusal_code, input_tokens, output_tokens, attributed_cost)
       values (gen_random_uuid(), ${lit(tenantId)}::uuid, ${lit(call.projectId)}::uuid, ${lit(SEEDED_MODEL)}, ${lit(randomUUID())}, ${lit(call.transport)}, ${lit(call.outcome)},
               ${call.refusalCode === null ? "null" : lit(call.refusalCode)}, ${String(call.inputTokens)}, ${String(call.outputTokens)}, ${lit(call.attributedCost)}::numeric);`,
    ),
  );
}

/** A fixture-registry row for this tenant, with a request hash nothing else in the file uses. */
function seedFixture(url: string, tenantId: string): void {
  run(
    url,
    withSession(
      { [GUC_SYSTEM_REASON]: SEED_REASON },
      `insert into ${ident(MODEL_FIXTURES)} (tenant_id, request_hash, fixture_digest)
       values (${lit(tenantId)}::uuid, ${lit(randomUUID())}, ${lit(randomUUID())});`,
    ),
  );
}

/** A decimal string in its minimal spelling, so '3.00' and '3' are compared as the same money. */
function minimal(value: string): string {
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(value)) return value;
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}

/* ------------------------------------------------------------------ *
 * Staging: lazy and memoised, so a failure here fails cases rather than
 * skipping them.
 * ------------------------------------------------------------------ */

type Scratch = { urlMigrate: string; urlApp: string; drop(): Promise<void> };

let scratch: Scratch | undefined;

afterAll(async () => {
  await scratch?.drop();
});

type Stage = {
  url: string;
  urlApp: string;
  seam: Seam;
  alpha: string;
  beta: string;
  projects: { first: string; second: string };
  seeded: SeededCall[];
};

let staging: Promise<Stage> | undefined;

const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantIds = seedTenants(provisioned.urlMigrate);
    const alpha = tenantIds[TENANT_ALPHA] ?? "";
    const beta = tenantIds[TENANT_BETA] ?? "";
    expect(alpha, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    expect(beta, `the scenario seeded no ${TENANT_BETA}`).not.toBe("");

    const projects = { first: randomUUID(), second: randomUUID() };
    const seeded: SeededCall[] = [
      { projectId: projects.first, transport: "live", outcome: "proposed", refusalCode: null, inputTokens: 1200, outputTokens: 340, attributedCost: "2.25" },
      { projectId: projects.first, transport: "fixture", outcome: "refused", refusalCode: "FIXTURE_MISSING", inputTokens: 80, outputTokens: 0, attributedCost: "0.75" },
      { projectId: projects.second, transport: "live", outcome: "proposed", refusalCode: null, inputTokens: 5, outputTokens: 7, attributedCost: "0.0125" },
    ];
    for (const call of seeded) seedCall(provisioned.urlMigrate, alpha, call);
    seedFixture(provisioned.urlMigrate, alpha);

    // Beta owns rows of its own in both tables, so "exactly alpha's rows and none of beta's" can
    // never pass by both sides being empty.
    seedCall(provisioned.urlMigrate, beta, { projectId: randomUUID(), transport: "live", outcome: "proposed", refusalCode: null, inputTokens: 9, outputTokens: 9, attributedCost: "9" });
    seedFixture(provisioned.urlMigrate, beta);

    return { url: provisioned.urlMigrate, urlApp: provisioned.urlApp, seam: await loadSeam(provisioned.urlApp), alpha, beta, projects, seeded };
  })());

/** A table's columns, as the catalogue describes them. */
function columnsOf(url: string, table: string): Map<string, { type: string; nullable: boolean; fallback: string }> {
  const rows = run(
    url,
    `select column_name, data_type, is_nullable, coalesce(column_default, '')
       from information_schema.columns
      where table_schema = 'public' and table_name = ${lit(table)}
      order by ordinal_position;`,
  );
  return new Map(rows.map((row) => [row[0] ?? "", { type: row[1] ?? "", nullable: row[2] === "YES", fallback: row[3] ?? "" }]));
}

/** The columns of a table's primary key. */
function primaryKeyOf(url: string, table: string): string[] {
  return run(
    url,
    `select a.attname
       from pg_index i
       join pg_class c on c.oid = i.indrelid
       join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
      where c.relname = ${lit(table)} and i.indisprimary
      order by 1;`,
  ).map((row) => row[0] ?? "");
}

/* ------------------------------------------------------------------ *
 * AC-1: the migrated shape.
 * ------------------------------------------------------------------ */

describe("AC-1: the migrated shape, exactly as contracted", () => {
  it("AC-1: both ledger tables are base tables of the migrated database", async () => {
    const stage = await staged();
    for (const table of [MODEL_CALLS, MODEL_FIXTURES]) {
      const kind = run(stage.url, `select c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = ${lit(table)};`)[0]?.[0] ?? "";
      expect(kind, `public.${table} is not a base table of the migrated database — the committed migrations have not created it`).toBe("r");
    }
  }, 300_000);

  it("AC-1: every contracted column carries the contracted type and nullability", async () => {
    const stage = await staged();
    for (const [table, shape] of Object.entries(CONTRACTED)) {
      const columns = columnsOf(stage.url, table);
      for (const [name, expected] of Object.entries(shape)) {
        const actual = columns.get(name);
        expect(actual, `${table}.${name} is owed`).toBeDefined();
        expect(actual?.type, `${table}.${name} is ${expected.type}`).toBe(expected.type);
        expect(actual?.nullable, `${table}.${name} is ${expected.nullable ? "nullable" : "NOT NULL"}`).toBe(expected.nullable);
        if (expected.defaulted === true) {
          expect(actual?.fallback, `${table}.${name} is defaulted — a row never has to spell the moment it was written`).not.toBe("");
        }
      }
    }
  }, 300_000);

  it("AC-1: the primary keys are call_id, and (tenant_id, request_hash)", async () => {
    const stage = await staged();
    expect(primaryKeyOf(stage.url, MODEL_CALLS), `${MODEL_CALLS}'s primary key is call_id`).toEqual(["call_id"]);
    expect(primaryKeyOf(stage.url, MODEL_FIXTURES), `${MODEL_FIXTURES} registers one fixture digest per (tenant, request hash)`).toEqual([TENANT_COLUMN, "request_hash"].sort());
  }, 300_000);

  it(`AC-1: each table's ${TENANT_COLUMN} is a foreign key to ${TENANTS_TABLE}`, async () => {
    const stage = await staged();
    for (const table of [MODEL_CALLS, MODEL_FIXTURES]) {
      const keys = run(
        stage.url,
        `select (select string_agg(a.attname, ',' order by k.ord)
                   from unnest(c.conkey) with ordinality k(attnum, ord)
                   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum)
           from pg_constraint c
           join pg_class ch on ch.oid = c.conrelid
           join pg_class parent on parent.oid = c.confrelid
          where c.contype = 'f' and ch.relname = ${lit(table)} and parent.relname = ${lit(TENANTS_TABLE)};`,
      ).map((row) => row[0] ?? "");
      expect(keys, `${table}.${TENANT_COLUMN} must be a foreign key to ${TENANTS_TABLE} — a ledger row belongs to a tenant that exists`).toContain(TENANT_COLUMN);
    }
  }, 300_000);

  it("AC-1: transport is CHECK-closed to 'live' and 'fixture'", async () => {
    const stage = await staged();
    for (const transport of ["live", "fixture"]) {
      const accepted = psql(
        stage.url,
        withSession(
          { [GUC_SYSTEM_REASON]: SEED_REASON },
          `insert into ${ident(MODEL_CALLS)} (call_id, tenant_id, project_id, model_id, request_hash, transport, outcome, input_tokens, output_tokens, attributed_cost)
             values (gen_random_uuid(), ${lit(stage.alpha)}::uuid, ${lit(randomUUID())}::uuid, ${lit(SEEDED_MODEL)}, ${lit(randomUUID())}, ${lit(transport)}, 'proposed', 1, 1, 0);`,
        ),
      );
      expect(accepted.ok, `a call whose transport is '${transport}' is a lawful row — L-AI-01 records every call, live or replayed from a fixture\n${accepted.stderr.slice(-400)}`).toBe(true);
    }
    const refused = psql(
      stage.url,
      withSession(
        { [GUC_SYSTEM_REASON]: SEED_REASON },
        `insert into ${ident(MODEL_CALLS)} (call_id, tenant_id, project_id, model_id, request_hash, transport, outcome, input_tokens, output_tokens, attributed_cost)
           values (gen_random_uuid(), ${lit(stage.alpha)}::uuid, ${lit(randomUUID())}::uuid, ${lit(SEEDED_MODEL)}, ${lit(randomUUID())}, 'streamed', 'proposed', 1, 1, 0);`,
      ),
    );
    expect(refused.ok, "transport must be CHECK-closed — a transport outside 'live' and 'fixture' is not a transport this ledger knows").toBe(false);
    expect(refused.sqlstate, "the refusal is a CHECK violation (23514), not a type or a policy refusal").toBe("23514");
  }, 300_000);

  it("AC-1: outcome is CHECK-closed, and refusal_code is non-null exactly when the outcome is 'refused'", async () => {
    const stage = await staged();
    const insert = (outcome: string, refusalCode: string | null): ReturnType<typeof psql> =>
      psql(
        stage.url,
        withSession(
          { [GUC_SYSTEM_REASON]: SEED_REASON },
          `insert into ${ident(MODEL_CALLS)} (call_id, tenant_id, project_id, model_id, request_hash, transport, outcome, refusal_code, input_tokens, output_tokens, attributed_cost)
             values (gen_random_uuid(), ${lit(stage.alpha)}::uuid, ${lit(randomUUID())}::uuid, ${lit(SEEDED_MODEL)}, ${lit(randomUUID())}, 'live', ${lit(outcome)},
                     ${refusalCode === null ? "null" : lit(refusalCode)}, 1, 1, 0);`,
        ),
      );

    for (const [outcome, refusalCode] of [
      ["proposed", null],
      ["refused", "FIXTURE_MISSING"],
    ] as const) {
      const accepted = insert(outcome, refusalCode);
      expect(accepted.ok, `a ${outcome} call ${refusalCode === null ? "with no refusal code" : `carrying ${refusalCode}`} is a lawful row\n${accepted.stderr.slice(-400)}`).toBe(true);
    }

    for (const [outcome, refusalCode, why] of [
      ["settled", null, "an outcome outside 'proposed' and 'refused' is not an outcome this ledger knows"],
      ["refused", null, "a refused call must say which refusal it was — refusal_code is non-null exactly when outcome is 'refused'"],
      ["proposed", "FIXTURE_MISSING", "a proposed call carries no refusal code — nothing refused it"],
    ] as const) {
      const refused = insert(outcome, refusalCode);
      expect(refused.ok, why).toBe(false);
      expect(refused.sqlstate, `${why} — and the refusal is a CHECK violation (23514)`).toBe("23514");
    }
  }, 300_000);
});

/* ------------------------------------------------------------------ *
 * AC-2: governed like every other cubit table.
 * ------------------------------------------------------------------ */

describe("AC-2: both tables are governed like every other cubit table", () => {
  it("AC-2: the harness's tenant-scoped enumeration reaches both of them", async () => {
    const stage = await staged();
    const enumerated = (await enumerateTenantScopedTables(stage.url)).map((name) => (name.startsWith("public.") ? name.slice("public.".length) : name));
    for (const table of [MODEL_CALLS, MODEL_FIXTURES]) {
      expect(enumerated, `${table} carries ${TENANT_COLUMN}, so the live suite's derived denominator must contain it — that is what puts it under every per-table proof (B-19)`).toContain(table);
    }
  }, 300_000);

  it("AC-2: row security is enabled AND forced, with a tenant-scope and a system-scope policy on each", async () => {
    const stage = await staged();
    for (const table of [MODEL_CALLS, MODEL_FIXTURES]) {
      const row = run(stage.url, `select c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = ${lit(table)};`)[0];
      expect(isTrue(row?.[0] ?? ""), `${table} carries ${TENANT_COLUMN} but has no row-level security`).toBe(true);
      expect(isTrue(row?.[1] ?? ""), `${table} does not declare row level security WITH FORCE — its owner would escape its own policies (SEAM-TENANT)`).toBe(true);

      for (const [guc, what] of [
        [GUC_TENANT, "a tenant-scope policy"],
        [GUC_SYSTEM_REASON, "a system-scope policy"],
      ] as const) {
        const policies = count(
          stage.url,
          `select count(*) from pg_policies
            where schemaname = 'public' and tablename = ${lit(table)}
              and (coalesce(qual, '') like ${lit(`%${guc}%`)} or coalesce(with_check, '') like ${lit(`%${guc}%`)});`,
        );
        expect(policies, `${table} has no policy reading ${guc} — SEAM-TENANT gives every tenant-scoped table ${what}`).toBeGreaterThan(0);
      }
    }
  }, 300_000);

  it(`AC-2: as ${ROLE_APP} under ${TENANT_ALPHA}'s scope, each table answers exactly alpha's rows`, async () => {
    const stage = await staged();
    for (const table of [MODEL_CALLS, MODEL_FIXTURES]) {
      const owned = count(stage.url, withSession({ [GUC_SYSTEM_REASON]: AUDIT_REASON }, `select count(*) from ${ident(table)} where ${ident(TENANT_COLUMN)} = ${lit(stage.alpha)};`));
      const foreign = count(stage.url, withSession({ [GUC_SYSTEM_REASON]: AUDIT_REASON }, `select count(*) from ${ident(table)} where ${ident(TENANT_COLUMN)} = ${lit(stage.beta)};`));
      expect(owned, `${table} holds no row for ${TENANT_ALPHA} — a scoped read that saw nothing would prove nothing`).toBeGreaterThan(0);
      expect(foreign, `${table} holds no row for ${TENANT_BETA} — "and none of beta's" would prove nothing`).toBeGreaterThan(0);

      const visible = run(stage.urlApp, withSession({ [GUC_TENANT]: stage.alpha }, `select ${ident(TENANT_COLUMN)}::text from ${ident(table)};`)).map((row) => row[0] ?? "");
      expect(visible.length, `${table}: ${ROLE_APP} under ${TENANT_ALPHA}'s scope must see all ${owned} of its rows`).toBe(owned);
      expect([...new Set(visible)], `${table}: a scoped read must return alpha's rows and nothing else`).toEqual([stage.alpha]);
    }
  }, 300_000);

  it(`AC-2: with no tenant scope and no system reason, ${ROLE_APP} sees nothing in either table`, async () => {
    const stage = await staged();
    for (const table of [MODEL_CALLS, MODEL_FIXTURES]) {
      expect(count(stage.urlApp, `select count(*) from ${ident(table)};`), `${table}: an unscoped session read rows — RLS must refuse a session that names neither a tenant nor a system reason`).toBe(0);
    }
  }, 300_000);
});

/* ------------------------------------------------------------------ *
 * AC-3: the attribution surface, live.
 * ------------------------------------------------------------------ */

describe("AC-3: modelSpendByProject answers per-project attribution", () => {
  it("AC-3: one entry per project, summing the calls, tokens and cost the tenant's rows carry", async () => {
    const stage = await staged();
    const entries = await spendByProject(stage.seam, stage.alpha);
    expect(Array.isArray(entries), "modelSpendByProject answers a list of per-project entries").toBe(true);

    const byProject = new Map(entries.map((entry) => [String(entry.projectId ?? ""), entry]));
    for (const projectId of [stage.projects.first, stage.projects.second]) {
      const mine = stage.seeded.filter((call) => call.projectId === projectId);
      const entry = byProject.get(projectId);
      expect(entry, `modelSpendByProject answered no entry for the project ${mine.length} of alpha's seeded calls belong to`).toBeDefined();
      if (entry === undefined) continue;

      expect(entry.calls, "calls counts every row of the project, proposed or refused (L-AI-01 records both)").toBe(mine.length);
      expect(entry.proposed, "proposed counts the project's proposed calls").toBe(mine.filter((call) => call.outcome === "proposed").length);
      expect(entry.refused, "refused counts the project's refused calls").toBe(mine.filter((call) => call.outcome === "refused").length);
      expect(entry.inputTokens, "inputTokens sums the project's input tokens").toBe(mine.reduce((total, call) => total + call.inputTokens, 0));
      expect(entry.outputTokens, "outputTokens sums the project's output tokens").toBe(mine.reduce((total, call) => total + call.outputTokens, 0));

      // The money is summed by the database, whose numeric addition is exact — the expectation is
      // read back from the very rows the entry answers for, never from a number typed here.
      const summed = scalar(
        stage.url,
        withSession(
          { [GUC_SYSTEM_REASON]: AUDIT_REASON },
          `select coalesce(sum(attributed_cost), 0)::text from ${ident(MODEL_CALLS)} where ${ident(TENANT_COLUMN)} = ${lit(stage.alpha)} and project_id = ${lit(projectId)}::uuid;`,
        ),
      );
      expect(typeof entry.attributedCost, "attributedCost is a decimal string — numeric money never becomes a float on the way out").toBe("string");
      expect(minimal(String(entry.attributedCost)), `attributedCost is what the project's rows sum to (${summed})`).toBe(minimal(summed));
    }
  }, 300_000);

  it("AC-3: the entries are typed as numbers, and name no project the tenant has no rows for", async () => {
    const stage = await staged();
    const entries = await spendByProject(stage.seam, stage.alpha);
    const projects = run(
      stage.url,
      withSession({ [GUC_SYSTEM_REASON]: AUDIT_REASON }, `select distinct project_id::text from ${ident(MODEL_CALLS)} where ${ident(TENANT_COLUMN)} = ${lit(stage.alpha)};`),
    ).map((row) => row[0] ?? "");
    expect([...entries.map((entry) => String(entry.projectId ?? ""))].sort(), "one entry per project the tenant has calls for — no more, no fewer").toEqual([...projects].sort());
    for (const entry of entries) {
      for (const field of ["calls", "proposed", "refused", "inputTokens", "outputTokens"] as const) {
        expect(typeof entry[field], `${field} is a number — postgres answers a count as text, and the seam is what turns it back into one`).toBe("number");
      }
    }
  }, 300_000);
});

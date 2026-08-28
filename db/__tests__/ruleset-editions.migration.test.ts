// Live acceptance for the rule-set edition store (L-MEA-01, L-REG-07, R-SPINE-012, V-DB): AC-2 —
// the migration, the platform seed and the seam posture it lands under — and AC-3 — the pin that
// forks platform → tenant template → project inside the caller's transaction, and the view that
// answers what it pinned.
//
// Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
// rest of the tree. Product modules are loaded by absolute path (tests/rulesets/support/editions.ts),
// so a module the Builder has not written yet fails as an assertion naming the file rather than
// killing collection at transform time.
//
// B-19: nothing here transcribes a schema. Which tables the store lands is read from the
// increment's own migration file; which of them are tenant-scoped is read from the catalogue; the
// grant posture is read from the ACLs Postgres actually holds. A second table added to the store by
// a later increment is judged by the same cases the moment it lands. The parameter roster is the
// one exception, and is not a snapshot: L-MEA-01 closes it at seventeen values and names each one.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { forTenant } from "../../src/core/db";
import {
  LINEAGE_SCOPES,
  SEED_NAME,
  SEED_PARAMETERS,
  SEED_VERSION,
  loadEditionDigest,
  loadPinRulesetForProject,
  loadProjectRulesetView,
  loadSeedContent,
  loadSeedIdentity,
  parameterNumber,
  type EditionContentLike,
  type PinnedViewLike,
  type RulesetViewLike,
} from "../../tests/rulesets/support/editions";
import { provisionScratchDb } from "./harness";
import { AUDIT_REASON, BOOTSTRAP_URL, GUC_SYSTEM_REASON, GUC_TENANT, HANDWRITTEN_MARKER, ROLE_APP, TENANT_ALPHA, TENANT_COLUMN } from "./support/fixtures";
import { ident, isTrue, lit, run, scalar, seedTenants, withSession } from "./support/live-sql";

const ROOT = join(import.meta.dirname, "..", "..");
const MIGRATIONS = join(ROOT, "db", "migrations");

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
const RULESET_MIGRATION = "ruleset-editions";

/** The privileges that can take a row away — none of them may reach the runtime role (L-MEA-01). */
const WRITE_AWAY = ["UPDATE", "DELETE", "TRUNCATE"];

/** The GUC a tenant policy has to read to be a tenant policy (SEAM-TENANT). */
const GUC_TENANT_FRAGMENT = "cubit.tenant_id";

/* ------------------------------------------------------------------ *
 * The migration, as a file.
 * ------------------------------------------------------------------ */

function migrationFiles(): string[] {
  if (!existsSync(MIGRATIONS)) return [];
  return readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql"));
}

function rulesetMigration(): { name: string; text: string } {
  const matches = migrationFiles().filter((name) => name.includes(RULESET_MIGRATION));
  expect(matches.length, `exactly one db/migrations/*${RULESET_MIGRATION}*.sql is owed; found ${matches.length === 0 ? "none" : matches.join(", ")}`).toBe(1);
  const name = matches[0] ?? "";
  return { name, text: readFileSync(join(MIGRATIONS, name), "utf8") };
}

/**
 * The tables the store lands, read from the migration that lands them — so "every rulesets table"
 * means whatever this increment created, not a list copied into a test that a second table would
 * walk straight past.
 */
function storeTables(): string[] {
  const { name, text } = rulesetMigration();
  const pattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?"?([A-Za-z0-9_]+)"?(?:\s*\.\s*"?([A-Za-z0-9_]+)"?)?/gi;
  const found = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const table = match[2] ?? match[1] ?? "";
    if (table !== "") found.add(table);
  }
  const tables = [...found].sort();
  expect(tables.length, `${name} must create the rule-set edition store's tables`).toBeGreaterThan(0);
  return tables;
}

/* ------------------------------------------------------------------ *
 * The migrated database, read as the cluster's bootstrap user.
 * ------------------------------------------------------------------ */

/**
 * The scratch database addressed as the bootstrap user the harness already provisions with. Rows
 * are read through it rather than through a live role on purpose: what AC-2 asks is what the
 * database HOLDS, and a reading that had to arm a scope to see a row would be grading the policies
 * twice and the seed not at all. The policies get their own cases below, from the catalogue.
 */
function bootstrapUrlFor(databaseUrl: string): string {
  const url = new URL(BOOTSTRAP_URL);
  url.pathname = new URL(databaseUrl).pathname;
  return url.toString();
}

/**
 * Every row of a table, as JSON — so a column the test never named is still in hand. The session's
 * scope GUCs are armed on the way in: harmless where no policy reads them, and the difference
 * between seeing a tenant's rows and seeing none where one does.
 */
function jsonRows(url: string, table: string, gucs: Record<string, string> = {}): Record<string, unknown>[] {
  return run(url, withSession({ [GUC_SYSTEM_REASON]: AUDIT_REASON, ...gucs }, `select to_jsonb(r)::text from public.${ident(table)} r;`)).map(
    (row) => JSON.parse(row[0] ?? "{}") as Record<string, unknown>,
  );
}

/** Does this table carry the tenant column that makes a table tenant-scoped? */
function isTenantScoped(url: string, table: string): boolean {
  return (
    scalar(
      url,
      `select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = ${lit(table)} and column_name = ${lit(TENANT_COLUMN)};`,
    ) !== "0"
  );
}

/** The privileges a role really holds on a table, read from the ACL Postgres stores. */
function privilegesOf(url: string, table: string, role: string): string[] {
  return run(
    url,
    `select distinct a.privilege_type
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       cross join lateral aclexplode(c.relacl) a
       join pg_roles g on g.oid = a.grantee
      where n.nspname = 'public' and c.relname = ${lit(table)} and g.rolname = ${lit(role)}
      order by 1;`,
  ).map((row) => row[0] ?? "");
}

/** Row security as the catalogue records it: enabled, and forced on the owner too. */
function rowSecurityOf(url: string, table: string): { enabled: boolean; forced: boolean } {
  const row = run(
    url,
    `select c.relrowsecurity, c.relforcerowsecurity
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = ${lit(table)};`,
  )[0];
  return { enabled: isTrue(row?.[0] ?? ""), forced: isTrue(row?.[1] ?? "") };
}

/** Every policy on a table, with the expression it is written against. */
function policiesOf(url: string, table: string): { name: string; expression: string }[] {
  return run(
    url,
    `select p.polname, coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
       from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = ${lit(table)}
      order by 1;`,
  ).map((row) => ({ name: row[0] ?? "", expression: row[1] ?? "" }));
}

/* ------------------------------------------------------------------ *
 * Staging: one scratch database, one tenant, the product's own modules.
 * ------------------------------------------------------------------ */

type Scratch = { urlMigrate: string; urlApp: string; drop(): Promise<void> };

let scratch: Scratch | undefined;

afterAll(async () => {
  // Let the seam's pooled connections settle before the database goes away: a drop that races an
  // open connection surfaces as an unhandled CONNECTION_CLOSED the runner counts as an error.
  await new Promise((resolve) => setTimeout(resolve, 250));
  await scratch?.drop();
});

type Stage = {
  bootstrapUrl: string;
  tenantId: string;
  tables: string[];
  seedContent: EditionContentLike;
  digestOf: (content: EditionContentLike) => string;
};

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let staging: Promise<Stage> | undefined;
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantIds = seedTenants(provisioned.urlMigrate);
    const tenantId = tenantIds[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    // The seam and the product modules read DATABASE_URL when they first reach the database, so the
    // scratch deployment is named before any of them is loaded.
    process.env["DATABASE_URL"] = provisioned.urlApp;
    return {
      bootstrapUrl: bootstrapUrlFor(provisioned.urlMigrate),
      tenantId,
      tables: storeTables(),
      seedContent: await loadSeedContent(),
      digestOf: await loadEditionDigest(),
    };
  })());

/** The platform seed edition as the database holds it, found by the name L-MEA-01 gives it. */
async function seedRow(): Promise<Record<string, unknown>> {
  const { bootstrapUrl, tables } = await staged();
  const matches = tables.flatMap((table) => jsonRows(bootstrapUrl, table).filter((row) => row["name"] === SEED_NAME).map((row) => ({ table, row })));
  expect(
    matches.length,
    `the migration must seed exactly one edition named ${SEED_NAME}; the freshly migrated store holds ${matches.length} (searched ${tables.join(", ")})`,
  ).toBe(1);
  return (matches[0] as { row: Record<string, unknown> }).row;
}

/** The field of the seed row that holds its content digest, found by name rather than assumed. */
function digestField(row: Record<string, unknown>): string {
  const key = Object.keys(row).find((name) => name.includes("digest"));
  expect(key, `the stored edition must carry its content digest in a column of its own; columns seen: ${Object.keys(row).join(", ")}`).toBeTruthy();
  const value = row[key as string];
  expect(typeof value, `the stored digest must be text; ${String(key)} holds ${JSON.stringify(value)}`).toBe("string");
  return value as string;
}

/* ------------------------------------------------------------------ *
 * AC-2 — the migration, the seed and the seam posture.
 * ------------------------------------------------------------------ */

describe("AC-2: the rule-set edition store lands append-only, under the seam's posture", () => {
  it("AC-2: the migration keeps its generated DDL pure and its RLS and grants after the marker", () => {
    const { name, text } = rulesetMigration();
    const marker = text.indexOf(HANDWRITTEN_MARKER);
    expect(marker, `${name} must carry the marker line ${JSON.stringify(HANDWRITTEN_MARKER)} — the schema-drift lane's self-proof needs the generated half pure (SEAM-TENANT)`).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(HANDWRITTEN_MARKER, marker + 1), `${name} must carry the marker exactly once`).toBe(-1);
    const generated = text.slice(0, marker);
    for (const construct of [/row\s+level\s+security/i, /create\s+policy/i, /\bgrant\b/i]) {
      expect(generated, `${name} has ${String(construct)} before the marker — hand-written SQL lives after it, and nowhere else`).not.toMatch(construct);
    }
  });

  it("AC-2: every table the migration creates is really in the migrated database", async () => {
    const { bootstrapUrl, tables } = await staged();
    for (const table of tables) {
      const present = scalar(bootstrapUrl, `select count(*)::text from information_schema.tables where table_schema = 'public' and table_name = ${lit(table)};`);
      expect(present, `the migration names a table ${table} the migrated database does not hold`).not.toBe("0");
    }
  });

  it("AC-2: the exported seed content is exactly L-MEA-01's seventeen parameter values", async () => {
    const { seedContent } = await staged();
    const keys = Object.keys(seedContent.parameters);
    expect([...keys].sort(), `L-MEA-01 closes the seed rule set at these parameters — no more, no fewer`).toStrictEqual(SEED_PARAMETERS.map((parameter) => parameter.key).sort());
    for (const parameter of SEED_PARAMETERS) {
      expect(parameterNumber(parameter.key, seedContent.parameters[parameter.key]), `L-MEA-01 fixes ${parameter.key} at ${parameter.value} ${parameter.unit}`).toBe(parameter.value);
    }
    expect(Array.isArray(seedContent.methods), "the seed's content carries the (rule id, version) pairs of the methods in force — empty at M0, since no method is enumerated in the tree yet").toBe(true);
  });

  it("AC-2: the platform seed edition is IS1200_IN @ 2026.08, digested over exactly that content", async () => {
    const { seedContent, digestOf } = await staged();
    const row = await seedRow();
    expect(row["version"], `L-MEA-01 versions the seed rule set ${SEED_VERSION}`).toBe(SEED_VERSION);
    expect(row["scope"], "the seeded edition is the platform edition — the head of every lineage").toBe("platform");
    expect(
      digestField(row),
      `the stored digest must equal editionDigest over the exported seed content: the digest keys CONTENT, so a stored digest that disagrees means the row and src/core/rulesets/seed hold different parameter values (L-MEA-01)`,
    ).toBe(digestOf(seedContent));

    const identity = await loadSeedIdentity();
    expect([identity.scope, identity.name, identity.version], "the exported identity names the same edition the migration seeded").toStrictEqual(["platform", SEED_NAME, SEED_VERSION]);
  });

  it("AC-2: every one of the seventeen parameter keys is really stored, not only digested", async () => {
    const { bootstrapUrl, tables } = await staged();
    const stored = tables.map((table) => jsonRows(bootstrapUrl, table).map((row) => JSON.stringify(row)).join(" ")).join(" ");
    for (const parameter of SEED_PARAMETERS) {
      expect(stored.includes(parameter.key), `the seeded store holds no ${parameter.key} — the digest alone is a fingerprint, not the values a measurement reads`).toBe(true);
    }
  });

  it("AC-2: the runtime role holds no privilege that can take a row away", async () => {
    const { bootstrapUrl, tables } = await staged();
    for (const table of tables) {
      const held = privilegesOf(bootstrapUrl, table, ROLE_APP);
      expect(held, `${ROLE_APP} must be able to read ${table} — a store nothing can read serves nobody`).toContain("SELECT");
      for (const privilege of WRITE_AWAY) {
        expect(held, `${ROLE_APP} holds ${privilege} on ${table} — an edition is immutable: authoring mints a new one, never updates one (L-MEA-01)`).not.toContain(privilege);
      }
      expect(
        held.filter((privilege) => privilege !== "SELECT" && privilege !== "INSERT"),
        `${ROLE_APP}'s grants on ${table} are SELECT and INSERT only`,
      ).toStrictEqual([]);
    }
  });

  it("AC-2: every tenant-scoped table of the store has FORCED row-level security and a tenant policy", async () => {
    const { bootstrapUrl, tables } = await staged();
    const scoped = tables.filter((table) => isTenantScoped(bootstrapUrl, table));
    expect(scoped.length, "the store's tenant and project editions are tenant-scoped rows — at least one table must carry tenant_id (L-REG-07)").toBeGreaterThan(0);
    for (const table of scoped) {
      const security = rowSecurityOf(bootstrapUrl, table);
      expect(security.enabled, `${table} carries ${TENANT_COLUMN} but has no row-level security (SEAM-TENANT)`).toBe(true);
      expect(security.forced, `${table}'s row-level security is not FORCED — an owner that escapes its own policies is not a guarantee`).toBe(true);
      const policies = policiesOf(bootstrapUrl, table);
      expect(
        policies.some((policy) => policy.expression.includes(GUC_TENANT_FRAGMENT)),
        `${table} has no policy reading ${GUC_TENANT_FRAGMENT}; policies found: ${policies.map((policy) => policy.name).join(", ") || "none"}`,
      ).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ *
 * AC-3 — the pin, inside the caller's transaction.
 * ------------------------------------------------------------------ */

/** Pin a fresh project inside one seam transaction, exactly as inc-011's creation will. */
async function pinProject(tenantId: string, projectId: string): Promise<void> {
  const pin = await loadPinRulesetForProject();
  await forTenant({ tenantId }).transaction(async (tx) => {
    await pin(tx, { tenantId, projectId });
  });
}

/** The view's pinned answer, refused as an answer if it reports no pin. */
function asPinned(view: RulesetViewLike, projectId: string): PinnedViewLike {
  expect(view.pinned, `projectRulesetView answered no pin for ${projectId} — one call to pinRulesetForProject must leave the project pinned (L-REG-07: an unpinned project is unrepresentable)`).toBe(true);
  return view as PinnedViewLike;
}

describe("AC-3: pinRulesetForProject forks platform → tenant template → project", () => {
  it("AC-3: one call inside the caller's transaction leaves the project pinned", async () => {
    const { tenantId, seedContent } = await staged();
    const projectId = randomUUID();
    await pinProject(tenantId, projectId);

    const view = await loadProjectRulesetView();
    const pinned = asPinned(await view({ tenantId, projectId }), projectId);
    expect(pinned.identity.scope, "the pin the project reads is the project's own edition").toBe("project");
    expect(typeof pinned.digest, "the view carries the digest as a field of its own, beside identity (L-MEA-01)").toBe("string");
    expect(
      [...Object.keys(pinned.parameters)].sort(),
      "the pinned edition is a verbatim fork of the seed, so it carries the seed's parameters",
    ).toStrictEqual([...Object.keys(seedContent.parameters)].sort());
    for (const parameter of SEED_PARAMETERS) {
      expect(parameterNumber(parameter.key, pinned.parameters[parameter.key]), `the pinned edition holds ${parameter.key} unchanged from the seed`).toBe(parameter.value);
    }
  });

  it("AC-3: the lineage runs platform → tenant → project, every step naming itself and sharing the digest", async () => {
    const { tenantId } = await staged();
    const projectId = randomUUID();
    await pinProject(tenantId, projectId);
    const view = await loadProjectRulesetView();
    const pinned = asPinned(await view({ tenantId, projectId }), projectId);

    expect(pinned.lineage.map((step) => step.scope), "the lineage is ordered platform → tenant → project (R-SPINE-012)").toStrictEqual([...LINEAGE_SCOPES]);
    for (const step of pinned.lineage) {
      expect(step.name.length, `the ${step.scope} step must name its own edition`).toBeGreaterThan(0);
      expect(step.version.length, `the ${step.scope} step must carry its own version`).toBeGreaterThan(0);
      expect(step.digest, `every step of a verbatim fork chain reports the same digest — that sameness is the fork's proof (L-MEA-01)`).toBe(pinned.digest);
    }
    const platform = pinned.lineage[0] as { name: string; version: string };
    expect([platform.name, platform.version], "the chain's head is the platform seed L-MEA-01 names").toStrictEqual([SEED_NAME, SEED_VERSION]);
  });

  it("AC-3: the tenant template is created on first use and reused after", async () => {
    const { tenantId, bootstrapUrl, tables } = await staged();
    const view = await loadProjectRulesetView();

    const first = randomUUID();
    const second = randomUUID();
    await pinProject(tenantId, first);
    await pinProject(tenantId, second);

    const firstChain = asPinned(await view({ tenantId, projectId: first }), first).lineage[1];
    const secondChain = asPinned(await view({ tenantId, projectId: second }), second).lineage[1];
    expect(firstChain, "the lineage must carry a tenant step").toBeTruthy();
    expect(secondChain, "the lineage must carry a tenant step").toBeTruthy();
    expect(
      [secondChain?.name, secondChain?.version, secondChain?.digest],
      "the second project forks the template the first one made — the tenant template is created on first use, not per project",
    ).toStrictEqual([firstChain?.name, firstChain?.version, firstChain?.digest]);

    const templates = tables
      .filter((table) => isTenantScoped(bootstrapUrl, table))
      .flatMap((table) => jsonRows(bootstrapUrl, table, { [GUC_TENANT]: tenantId }).filter((row) => row["scope"] === "tenant" && row[TENANT_COLUMN] === tenantId));
    expect(templates.length, "one workspace holds one tenant template, however many projects fork from it").toBe(1);
  });

  it("AC-3: an address that names no pin is answered, not thrown at", async () => {
    const { tenantId } = await staged();
    const view = await loadProjectRulesetView();
    const answer = await view({ tenantId, projectId: randomUUID() });
    expect(answer.pinned, "a project the store knows nothing about gets the no-pin shape — the screen's honest absence, never a fault").toBe(false);
  });
});

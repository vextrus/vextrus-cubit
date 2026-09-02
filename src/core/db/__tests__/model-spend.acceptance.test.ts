// @vitest-environment node
/**
 * Public acceptance for AC-2 of the model/jobs debt sweep (SEAM-TENANT, R-AI-005, V-DB, B-17):
 * `modelSpendByProject` reads once, refuses a system handle before it reads at all, refuses to
 * narrow a sum a double cannot count, and the ledger's model-id column is closed over MODEL_IDS.
 *
 * The read is judged over a stand-in driver, the way `scoped-client.test.ts` judges the seam's
 * client: a handle is taken from the seam and its client is replaced by `scopedClient` over a
 * driver that records every statement instead of dialling. The handle keeps its identity and its
 * scope, so whatever the seam remembers about which tenant armed it is still there — only the
 * connection is a stand-in. Nothing here imports a driver (SEAM-TENANT).
 *
 * The column is judged live: a scratch database from the db lane's own harness, the constraint's
 * definition read back from the catalogue and compared with MODEL_IDS by reflection (B-19), and an
 * insert per id admitted inside a rolled-back transaction. Staged lazily so a staging failure
 * fails cases rather than skipping them.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { GUC_TENANT, TENANT_ALPHA } from "../../../../db/__tests__/support/fixtures";
import { ident, lit, psql, run, seedTenants, withSession } from "../../../../db/__tests__/support/live-sql";
import { REPO_ROOT, codeOf } from "../../__tests__/support/read-source";
import { closePools, forTenant, modelSpendByProject, runAsSystem, scopedClient, type Scope, type TenantDb } from "../../db";
import { refusalCodeOf } from "../../faults/refusal-marker";
import { MODEL_IDS } from "../../model-ledger.types";

/** The sentinel a promise that resolved is reported as, so a test can say "expected a rejection". */
const RESOLVED: unique symbol = Symbol("resolved");

/** The value a promise rejected with, or RESOLVED — no catch clause, so ARCH-03's lint has nothing to read. */
const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => RESOLVED,
    (reason: unknown) => reason,
  );

const SEAM_MODULE = "src/core/db.ts";
const MIGRATION = "db/migrations/0013_core-model-jobs-debt-sweep.sql";
const JOURNAL = "db/migrations/meta/_journal.json";
const MIGRATION_TAG = "0013_core-model-jobs-debt-sweep";
const CONSTRAINT = "model_calls_model_id_closed";
const MODEL_CALLS = "model_calls";
const CHECK_REFUSAL = "23514";
const SEAM_CLAUSE = "SEAM-TENANT";
const READ_BACK = "current_setting";

/** One past what a double counts exactly, as postgres hands a bigint sum back: text. */
const PAST_EXACT = "9007199254740993";

/** A URL the stand-in handle is taken under. Never dialled: the client is replaced before any query. */
const STAND_IN_URL = "postgres://stand-in:stand-in@127.0.0.1:1/stand_in";

const TENANT_SCOPE: Scope = { tenantId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", systemReason: "" };
const SYSTEM_REASON = "test: read every tenant's spend for comparison";

type Issued = { readonly query: string; readonly params: readonly unknown[] };

/**
 * A driver that records rather than dials. Every row it answers is `PAST_EXACT` in every column —
 * positionally for the tuples drizzle maps fields from, and by any name for the row objects a raw
 * execute hands back — so whichever shape and whichever column order the seam asks in, each
 * count and each token sum comes back one past exact.
 */
function standInDriver(): { sql: unknown; issued: Issued[] } {
  const issued: Issued[] = [];
  const tuple = Array.from({ length: 12 }, () => PAST_EXACT);
  const row = new Proxy({}, { get: (_target, key) => (typeof key === "string" && key !== "then" ? PAST_EXACT : undefined) });
  const pending = (query: string, params: readonly unknown[]): unknown => ({
    values: () => {
      issued.push({ query, params });
      return Promise.resolve([tuple]);
    },
    then: (onRows: (value: unknown) => unknown, onFailure: (reason: unknown) => unknown) => {
      issued.push({ query, params });
      return Promise.resolve([row]).then(onRows, onFailure);
    },
  });
  const connection = (): unknown => ({
    options: { host: ["stand-in"], port: [1] },
    unsafe: (query: string, params: readonly unknown[] = []) => pending(query, params),
    savepoint: (work: (nested: unknown) => Promise<unknown>) => work(connection()),
  });
  const sql = {
    options: { host: ["stand-in"], port: [1] },
    reserve: () => Promise.resolve(connection()),
    begin: async (work: (tx: unknown) => Promise<unknown>) => await work(connection()),
    unsafe: (query: string, params: readonly unknown[] = []) => pending(query, params),
  };
  return { sql, issued };
}

/** The scope-arming statement, recognised by what it writes rather than by its exact text. */
const arms = (issued: Issued): boolean => /set_config/.test(issued.query);

/** The handle as drizzle builds one: the session's client, and the client the handle publishes. */
type Handle = { session: { client: unknown }; $client: unknown };

/** The seam's own handle, its connection swapped for the stand-in — identity and scope untouched. */
function overStandIn(take: () => TenantDb, scope: Scope): { handle: TenantDb; issued: Issued[] } {
  const previous = process.env["DATABASE_URL"];
  process.env["DATABASE_URL"] = STAND_IN_URL;
  const handle = take();
  if (previous === undefined) delete process.env["DATABASE_URL"];
  else process.env["DATABASE_URL"] = previous;
  const driver = standInDriver();
  const client = scopedClient(driver.sql as never, scope);
  const inner = handle as unknown as Handle;
  inner.session.client = client;
  inner.$client = client;
  return { handle, issued: driver.issued };
}

let scratch: ScratchDb | undefined;
let staging: Promise<{ urlMigrate: string; urlApp: string; alpha: string }> | undefined;

const staged = (): Promise<{ urlMigrate: string; urlApp: string; alpha: string }> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const alpha = seedTenants(provisioned.urlMigrate)[TENANT_ALPHA] ?? "";
    expect(alpha, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    return { urlMigrate: provisioned.urlMigrate, urlApp: provisioned.urlApp, alpha };
  })());

afterAll(async () => {
  await closePools();
  await new Promise((settle) => setTimeout(settle, 500));
  await scratch?.drop();
});

/** One ledger row offered as the app role under the tenant's own scope, naming `modelId`. */
function offerCall(stage: { urlApp: string; alpha: string }, modelId: string, wrap: (insert: string) => string): ReturnType<typeof psql> {
  const insert = `insert into ${ident(MODEL_CALLS)} (tenant_id, project_id, model_id, request_hash, transport, outcome, input_tokens, output_tokens, attributed_cost)
       values (${lit(stage.alpha)}::uuid, gen_random_uuid(), ${lit(modelId)}, md5(random()::text), 'fixture', 'proposed', 1, 1, '0'::numeric);`;
  return psql(stage.urlApp, withSession({ [GUC_TENANT]: stage.alpha }, wrap(insert)));
}

/** Every single-quoted literal in a SQL fragment, in order. */
function quotedLiterals(fragment: string): string[] {
  return [...fragment.matchAll(/'((?:[^']|'')*)'/g)].map((match) => (match[1] ?? "").replaceAll("''", "'"));
}

describe("AC-2: model spend reads once through the handle's own scope", () => {
  test("AC-2: a tenant handle issues exactly one statement, with no current_setting read-back, and refuses a sum past exact rather than rounding it", async () => {
    const { handle, issued } = overStandIn(() => forTenant({ tenantId: TENANT_SCOPE.tenantId }), TENANT_SCOPE);

    const outcome = await rejectionOf(modelSpendByProject(handle));

    const statements = issued.filter((entry) => !arms(entry));
    expect(statements.length, `modelSpendByProject issues ONE statement to the driver — the handle knows which tenant armed it; issued: ${statements.map((s) => s.query).join(" | ")}`).toBe(1);
    expect(statements[0]?.query, "the one statement reads no session setting back").not.toContain(READ_BACK);
    expect(outcome, `a count or token sum of ${PAST_EXACT} is past the last whole number a double counts exactly, so the read must reject rather than answer a rounded total`).not.toBe(RESOLVED);
    expect(outcome, "the rejection is a plain Error").toBeInstanceOf(Error);
    expect(refusalCodeOf(outcome), "an overflowing sum is a fault of ours, never a refusal").toBeNull();
  });

  test("AC-2: a system handle is refused naming SEAM-TENANT before any statement is issued", async () => {
    const { handle, issued } = overStandIn(() => runAsSystem(SYSTEM_REASON), { tenantId: "", systemReason: SYSTEM_REASON });

    const outcome = await rejectionOf(Promise.resolve().then(() => modelSpendByProject(handle)));

    expect(outcome, "a system-scoped handle must be refused").not.toBe(RESOLVED);
    expect(outcome, "the refusal is an Error").toBeInstanceOf(Error);
    expect((outcome as Error).message, "the message names the seam clause").toContain(SEAM_CLAUSE);
    expect(issued.map((entry) => entry.query), "nothing at all was issued to the driver — not a read-back, not the read").toEqual([]);
  });
});

describe("AC-2: the model-id column is closed over MODEL_IDS", () => {
  test("AC-2: the generated migration exists, is journaled, and declares the CHECK from MODEL_IDS in the drizzle table", () => {
    const migration = join(REPO_ROOT, MIGRATION);
    expect(existsSync(migration), `${MIGRATION} must exist — one generated migration closes the column`).toBe(true);
    const sql = readFileSync(migration, "utf8");
    expect(sql, `${MIGRATION} adds the CHECK ${CONSTRAINT}`).toContain(CONSTRAINT);
    for (const modelId of MODEL_IDS) expect(sql, `${MIGRATION} admits ${modelId}`).toContain(modelId);

    const journal = JSON.parse(readFileSync(join(REPO_ROOT, JOURNAL), "utf8")) as { entries?: { tag?: string }[] };
    expect((journal.entries ?? []).map((entry) => entry.tag), `${JOURNAL} names ${MIGRATION_TAG}`).toContain(MIGRATION_TAG);

    const code = codeOf(SEAM_MODULE, "the drizzle table is the schema tree the drift lane reads");
    const at = code.indexOf(CONSTRAINT);
    expect(at, `${SEAM_MODULE} declares the CHECK ${CONSTRAINT} in the drizzle table, so db:drift stays green`).toBeGreaterThanOrEqual(0);
    const open = code.lastIndexOf("check(", at);
    const close = code.indexOf(")", code.indexOf("\n", at) === -1 ? at : code.indexOf("\n", at));
    const declaration = code.slice(open, close === -1 ? code.length : close + 1);
    expect(declaration, `the CHECK is spelled from MODEL_IDS, not from a second list: ${declaration}`).toContain("MODEL_IDS");
    for (const modelId of MODEL_IDS) expect(declaration, `the declaration spells no id literal of its own (${modelId})`).not.toContain(modelId);
  });

  test("AC-2: live, the CHECK admits exactly MODEL_IDS — 'not-a-model' is refused with 23514 and each pinned id is admitted", async () => {
    const stage = await staged();

    const definition = run(
      stage.urlMigrate,
      `select pg_get_constraintdef(oid) from pg_constraint where conname = ${lit(CONSTRAINT)} and conrelid = ${lit(MODEL_CALLS)}::regclass;`,
    )[0]?.[0];
    expect(definition, `the migrated database carries the CHECK ${CONSTRAINT} on ${MODEL_CALLS}`).toBeDefined();
    expect([...quotedLiterals(definition ?? "")].sort(), "the constraint admits exactly the MODEL_IDS values, as the catalogue reads it back").toEqual([...MODEL_IDS].sort());

    const refused = offerCall(stage, "not-a-model", (insert) => insert);
    expect(refused.ok, "a model id outside MODEL_IDS is refused").toBe(false);
    expect(refused.sqlstate, `the refusal is the CHECK's (${CHECK_REFUSAL})`).toBe(CHECK_REFUSAL);

    for (const modelId of MODEL_IDS) {
      const admitted = offerCall(stage, modelId, (insert) => `begin;\n${insert}\nrollback;`);
      expect(admitted.ok, `${modelId} is admitted (and rolled back)\n${admitted.stderr.slice(-400)}`).toBe(true);
    }
  });
});

/**
 * `model_call_outcomes` as the store holds it, and the two columns the same migration adds to the
 * ledger (L-AI-01, L-AI-02, SEAM-TENANT, V-DB): the belts the migration installs, judged by what
 * they DO rather than by reading the file.
 *
 * The database every case reads is built by the product's own lane (`scripts/db-migrate.mjs`) over
 * the committed migrations, so no file under db/ is read here. Raw SQL is spoken through psql, never
 * a driver import: SEAM-TENANT's ban binds this file like the rest of the tree.
 *
 * B-19: the immutability belt is derived by COMPARISON against the act log's own, and every refusal
 * is judged by its SQLSTATE and by the row the store does or does not then hold — the pattern
 * `sheet-understanding-dispositions.migration.test.ts` set for the ledger's first sibling.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, GUC_TENANT, ROLE_APP, TENANT_ALPHA, TENANT_BETA, TENANT_COLUMN } from "./support/fixtures";
import { ident, lit, psql, run, seedTenants, withSession } from "./support/live-sql";

/** The table this slice lands, the ledger it is a column of, and the log whose belt it is compared against. */
const TABLE = "model_call_outcomes";
const LEDGER = "model_calls";
const ACT_LOG = "acts";

/** The closed roster the outcome column is checked against, as the product spells it (interfaces). */
const OUTCOMES = ["CONFIRMED", "OVERRULED", "REPUDIATED", "AFFIRMED"];

/** The reason every catalogue read and every seed here is made under — attributable, like any other. */
const REASON = "test: stage the model-call outcomes";

/** One project both workspaces keep their calls and outcomes in, and the person who judged them. */
const PROJECT = randomUUID();
const ACTOR = randomUUID();

/** A judgment, as the ledger's new column carries one. */
const JUDGMENT = `'{"provider":"jev-1.13.0","confidence":0.82,"answers":{"view_type":{"type":"choice","value":"DETAIL","confidence":0.82,"probabilities":{"DETAIL":0.82}}}}'::json`;

type Stage = { bootstrapUrl: string; urlApp: string; tenants: Record<string, string>; calls: Record<string, string> };

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
    const tenants = seedTenants(bootstrapUrl);

    // One proposed call per workspace, carrying the question and the judgment the ledger now
    // records, so an outcome has a call of its own to judge and another workspace's to be refused for.
    const calls: Record<string, string> = {};
    for (const name of [TENANT_ALPHA, TENANT_BETA]) {
      const tenantId = tenants[name] ?? "";
      const [row] = run(
        bootstrapUrl,
        withSession(
          { [GUC_SYSTEM_REASON]: REASON },
          `insert into ${ident(LEDGER)} (tenant_id, project_id, model_id, request_hash, transport, outcome, refusal_code, input_tokens, output_tokens, attributed_cost, question, judgment)
             values (${lit(tenantId)}::uuid, ${lit(PROJECT)}::uuid, 'claude-sonnet-5', ${lit(`hash-${name}`)}, 'fixture', 'proposed', null, 10, 5, 0, 'view-caption', ${JUDGMENT})
             returning call_id;`,
        ),
      );
      calls[name] = row?.[0] ?? "";
    }
    return { bootstrapUrl, urlApp: provisioned.urlApp, tenants, calls };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** What the app role tries, in its own workspace's scope — the posture the runtime writes under. */
async function asApp(tenantName: string, script: string) {
  const { urlApp, tenants } = await staged();
  return psql(urlApp, withSession({ [GUC_TENANT]: tenants[tenantName] ?? "" }, script));
}

/** An INSERT of one outcome, with the parts a case wants to vary spelled by that case. */
function insertion(tenantId: string, callId: string, outcome: string): string {
  return `insert into ${ident(TABLE)} (tenant_id, project_id, call_id, question, outcome, act_id, actor_user_id)
            values (${lit(tenantId)}::uuid, ${lit(PROJECT)}::uuid, ${lit(callId)}::uuid, 'view-caption', ${lit(outcome)}, null, ${lit(ACTOR)}::uuid);`;
}

/** One confirmed outcome of a workspace's own call — the row every later case is judged around. */
async function recordOwn(tenantName: string) {
  const { tenants, calls } = await staged();
  return asApp(tenantName, insertion(tenants[tenantName] ?? "", calls[tenantName] ?? "", "CONFIRMED"));
}

/** The privileges a role holds on the table, as the catalogue reports them. */
async function privilegesOf(role: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct privilege_type
       from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(TABLE)} and grantee = ${lit(role)}
      order by privilege_type;`,
  )
    .map((row) => row[0] ?? "")
    .sort();
}

/** The functions a table's own triggers fire — what "wears the same belt" is compared by. */
async function triggerFunctionsOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct p.proname
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_proc p on p.oid = t.tgfoid
      where not t.tgisinternal and n.nspname = 'public' and c.relname = ${lit(table)}
      order by 1;`,
  )
    .map((row) => row[0] ?? "")
    .sort();
}

describe("the ledger records the question a call put and what the model said of its answer", () => {
  it("both columns are nullable — the ledger predates them, and a generative provider states neither", async () => {
    const { bootstrapUrl } = await staged();
    const columns = run(
      bootstrapUrl,
      `select column_name, data_type, is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = ${lit(LEDGER)} and column_name in ('question', 'judgment') order by column_name;`,
    );
    expect(columns).toEqual([
      ["judgment", "json", "YES"],
      ["question", "text", "YES"],
    ]);
  });

  it("a row written without them still lands, as every row before this migration did", async () => {
    const { tenants } = await staged();
    const older = await asApp(
      TENANT_ALPHA,
      `insert into ${ident(LEDGER)} (tenant_id, project_id, model_id, request_hash, transport, outcome, refusal_code, input_tokens, output_tokens, attributed_cost)
         values (${lit(tenants[TENANT_ALPHA] ?? "")}::uuid, ${lit(PROJECT)}::uuid, 'claude-opus-5', ${lit(randomUUID())}, 'fixture', 'refused', 'FIXTURE_MISSING', 0, 0, 0);`,
    );
    expect(older.ok, `a refusal names no question and judges nothing:\n${older.stderr.slice(-400)}`).toBe(true);
  });
});

describe("the outcomes table records what a person did with a proposal, and never unrecords it", () => {
  it("it is tenant-scoped, so the posture every peer wears binds it too", async () => {
    const { bootstrapUrl } = await staged();
    expect(await enumerateTenantScopedTables(bootstrapUrl), `public.${TABLE} carries ${TENANT_COLUMN} — a workspace's outcomes are its own (R-SPINE-004)`).toContain(`public.${TABLE}`);
  });

  it("the app role reads and appends and takes nothing away", async () => {
    expect(await privilegesOf(ROLE_APP), `${ROLE_APP} reads and adds a ${TABLE} row and holds no privilege that writes one away — a later judgment is a newer record (L-AI-02)`).toEqual([
      "INSERT",
      "SELECT",
    ]);
  });

  it("it wears the act log's own immutability belt, and the belt refuses the owner too", async () => {
    const { bootstrapUrl } = await staged();
    const belt = await triggerFunctionsOf(ACT_LOG);
    expect(belt.length, `public.${ACT_LOG} wears the owner-proof belt this table is compared against — with none there is nothing to compare`).toBeGreaterThan(0);
    expect(await triggerFunctionsOf(TABLE), `public.${TABLE} fires every trigger the act log fires — a record of a person's judgement never wears a weaker belt than the act log (L-ACT-01)`).toEqual(
      expect.arrayContaining(belt),
    );

    expect((await recordOwn(TENANT_ALPHA)).ok, "the workspace records an outcome of its own call").toBe(true);

    // Spoken as the owner, whom row security does not bind: a guarantee the owner escapes is not one.
    const rewritten = psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, `update ${ident(TABLE)} set outcome = 'REPUDIATED';`));
    expect(rewritten.ok, `a recorded outcome is never rewritten, not even by the table's owner:\n${rewritten.stderr.slice(-400)}`).toBe(false);
    const deleted = psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, `delete from ${ident(TABLE)};`));
    expect(deleted.ok, "and never deleted").toBe(false);
    const truncated = psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, `truncate ${ident(TABLE)};`));
    expect(truncated.ok, "and never truncated — a statement-level belt, because TRUNCATE fires no row trigger").toBe(false);

    const held = run(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, `select count(*) from ${ident(TABLE)};`));
    expect(Number(held[0]?.[0] ?? "0"), "the row those three tried to unrecord is still there").toBe(1);
  });

  it("an outcome is one of the four the roster names, and every one of the four lands", async () => {
    const { tenants, calls } = await staged();
    const tenantId = tenants[TENANT_ALPHA] ?? "";
    const callId = calls[TENANT_ALPHA] ?? "";
    for (const outcome of OUTCOMES) {
      const landed = await asApp(TENANT_ALPHA, insertion(tenantId, callId, outcome));
      expect(landed.ok, `${outcome} is one of the roster's:\n${landed.stderr.slice(-400)}`).toBe(true);
    }
    const outside = await asApp(TENANT_ALPHA, insertion(tenantId, callId, "accepted"));
    expect(outside.ok, "a disposition's word is not an outcome's — the column is closed to the ledger's own roster").toBe(false);
    expect(outside.sqlstate, "and refused as the CHECK it broke").toBe("23514");
  });

  it("the call an outcome judges is one this workspace made", async () => {
    const { tenants, calls } = await staged();
    const borrowed = await asApp(TENANT_ALPHA, insertion(tenants[TENANT_ALPHA] ?? "", calls[TENANT_BETA] ?? "", "CONFIRMED"));
    expect(borrowed.ok, "a workspace cannot record an outcome of another workspace's call — the foreign key is composite, because postgres checks it with row security bypassed").toBe(false);
    expect(borrowed.sqlstate, "and the store refuses it as the reference it is").toBe("23503");
  });

  it("a workspace sees its own outcomes and no other's", async () => {
    expect((await recordOwn(TENANT_BETA)).ok, "the second workspace records an outcome of its own call").toBe(true);
    const { tenants } = await staged();

    for (const [name, other] of [
      [TENANT_ALPHA, TENANT_BETA],
      [TENANT_BETA, TENANT_ALPHA],
    ] as const) {
      const seen = await asApp(name, `select distinct ${ident(TENANT_COLUMN)}::text from ${ident(TABLE)};`);
      expect(seen.ok, `${name} reads its own outcomes`).toBe(true);
      const ids = seen.rows.map((row) => row[0] ?? "");
      expect(ids, `${name} sees the rows it recorded`).toContain(tenants[name] ?? "");
      expect(ids, `and none of ${other}'s — row security, forced on the owner too`).not.toContain(tenants[other] ?? "");
    }
  });

  it("the order rows were recorded in is the store's own count, which no writer supplies", async () => {
    const { tenants, calls } = await staged();
    const supplied = await asApp(
      TENANT_ALPHA,
      `insert into ${ident(TABLE)} (tenant_id, project_id, call_id, question, outcome, actor_user_id, recorded_seq)
         values (${lit(tenants[TENANT_ALPHA] ?? "")}::uuid, ${lit(PROJECT)}::uuid, ${lit(calls[TENANT_ALPHA] ?? "")}::uuid, 'view-caption', 'CONFIRMED', ${lit(ACTOR)}::uuid, 1);`,
    );
    expect(supplied.ok, "a writer that could number the history could reorder it: the column is generated always").toBe(false);
  });
});

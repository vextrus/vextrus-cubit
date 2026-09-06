/**
 * `sheet_understanding_dispositions` as the store holds it (R-AI-001, L-AI-01, SEAM-TENANT, V-DB):
 * the belts the migration installs, judged by what they DO rather than by reading the file.
 *
 * The database every case reads is built by the product's own lane (`scripts/db-migrate.mjs`) over
 * the committed migrations, so no file under db/ is read here. Raw SQL is spoken through psql, never
 * a driver import: SEAM-TENANT's ban binds this file like the rest of the tree.
 *
 * B-19: the immutability belt is derived by COMPARISON against the act log's own — the ledger this
 * tree already treats as its most consequential — rather than transcribed, and every refusal is
 * judged by its SQLSTATE and by the row the store does or does not then hold.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, GUC_TENANT, ROLE_APP, TENANT_ALPHA, TENANT_BETA, TENANT_COLUMN } from "./support/fixtures";
import { ident, lit, psql, run, seedTenants, withSession } from "./support/live-sql";

/** The table this increment lands, and the ledger whose belt it is compared against (L-ACT-01). */
const TABLE = "sheet_understanding_dispositions";
const ACT_LOG = "acts";

/** The reason every catalogue read and every seed here is made under — attributable, like any other. */
const REASON = "test: stage the sheet-understanding dispositions";

/** One project both workspaces keep their calls and dispositions in, and the person who made them. */
const PROJECT = randomUUID();
const ACTOR = randomUUID();

/** A reading, as the column carries one. */
const READING = `'{"number":"C-402","title":"SITE GRADING PLAN","discipline":"CIVIL","captions":[]}'::json`;

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

    // One proposed call per workspace, so a disposition has a call of its own to answer and another
    // workspace's call to be refused for.
    const calls: Record<string, string> = {};
    for (const name of [TENANT_ALPHA, TENANT_BETA]) {
      const tenantId = tenants[name] ?? "";
      const [row] = run(
        bootstrapUrl,
        withSession(
          { [GUC_SYSTEM_REASON]: REASON },
          `insert into ${ident("model_calls")} (tenant_id, project_id, model_id, request_hash, transport, outcome, refusal_code, input_tokens, output_tokens, attributed_cost)
             values (${lit(tenantId)}::uuid, ${lit(PROJECT)}::uuid, 'claude-opus-5', ${lit(`hash-${name}`)}, 'fixture', 'proposed', null, 10, 5, 0)
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

/** An INSERT of one disposition, with the parts a case wants to vary spelled by that case. */
function insertion(tenantId: string, callId: string, disposition: string, resolved: string): string {
  return `insert into ${ident(TABLE)} (tenant_id, project_id, call_id, sheet_id, disposition, proposed, resolved, actor_user_id)
            values (${lit(tenantId)}::uuid, ${lit(PROJECT)}::uuid, ${lit(callId)}::uuid, 'ingest:SHEET-01', ${lit(disposition)}, ${READING}, ${resolved}, ${lit(ACTOR)}::uuid);`;
}

/** One accepted disposition of a workspace's own call — the row every later case is judged around. */
async function recordOwn(tenantName: string) {
  const { tenants, calls } = await staged();
  return asApp(tenantName, insertion(tenants[tenantName] ?? "", calls[tenantName] ?? "", "accepted", "null"));
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

describe("the dispositions table records what a person did with a reading, and never unrecords it", () => {
  it("it is tenant-scoped, so the posture every peer wears binds it too", async () => {
    const { bootstrapUrl } = await staged();
    expect(await enumerateTenantScopedTables(bootstrapUrl), `public.${TABLE} carries ${TENANT_COLUMN} — a workspace's dispositions are its own (R-SPINE-004)`).toContain(`public.${TABLE}`);
  });

  it("the app role reads and appends and takes nothing away", async () => {
    expect(
      await privilegesOf(ROLE_APP),
      `${ROLE_APP} reads and adds a ${TABLE} row and holds no privilege that writes one away — a later disposition is a newer record (R-AI-001)`,
    ).toEqual(["INSERT", "SELECT"]);
  });

  it("it wears the act log's own immutability belt, and the belt refuses the owner too", async () => {
    const { bootstrapUrl } = await staged();
    const belt = await triggerFunctionsOf(ACT_LOG);
    expect(belt.length, `public.${ACT_LOG} wears the owner-proof belt this table is compared against — with none there is nothing to compare`).toBeGreaterThan(0);
    expect(
      await triggerFunctionsOf(TABLE),
      `public.${TABLE} fires every trigger the act log fires — a record of a person's judgement never wears a weaker belt than the act log (L-ACT-01)`,
    ).toEqual(expect.arrayContaining(belt));

    expect((await recordOwn(TENANT_ALPHA)).ok, "the workspace records a disposition of its own call").toBe(true);

    // Spoken as the owner, whom row security does not bind: a guarantee the owner escapes is not one.
    const rewritten = psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, `update ${ident(TABLE)} set disposition = 'rejected';`));
    expect(rewritten.ok, `a recorded disposition is never rewritten, not even by the table's owner:\n${rewritten.stderr.slice(-400)}`).toBe(false);
    const deleted = psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, `delete from ${ident(TABLE)};`));
    expect(deleted.ok, "and never deleted").toBe(false);
    const truncated = psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, `truncate ${ident(TABLE)};`));
    expect(truncated.ok, "and never truncated — a statement-level belt, because TRUNCATE fires no row trigger").toBe(false);

    const held = run(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, `select count(*) from ${ident(TABLE)};`));
    expect(Number(held[0]?.[0] ?? "0"), "the row those three tried to unrecord is still there").toBe(1);
  });

  it("a disposition is one of the three the roster names", async () => {
    const { tenants, calls } = await staged();
    const outside = await asApp(TENANT_ALPHA, insertion(tenants[TENANT_ALPHA] ?? "", calls[TENANT_ALPHA] ?? "", "ignored", "null"));
    expect(outside.ok, "a disposition the roster does not name is refused by the column itself").toBe(false);
    expect(outside.sqlstate, "and refused as the CHECK it broke").toBe("23514");
  });

  it("an edit settles on a reading, and the other two settle on nothing — both directions", async () => {
    const { tenants, calls } = await staged();
    const tenantId = tenants[TENANT_ALPHA] ?? "";
    const callId = calls[TENANT_ALPHA] ?? "";

    const editedWithout = await asApp(TENANT_ALPHA, insertion(tenantId, callId, "edited", "null"));
    expect(editedWithout.ok, "an edited disposition that settled on nothing records no edit").toBe(false);
    expect(editedWithout.sqlstate, "and is refused as the CHECK it broke").toBe("23514");

    const acceptedWith = await asApp(TENANT_ALPHA, insertion(tenantId, callId, "accepted", READING));
    expect(acceptedWith.ok, "an accepted disposition settles on no reading of its own — that would be a second answer about the sheet").toBe(false);
    expect(acceptedWith.sqlstate, "and is refused as the CHECK it broke").toBe("23514");

    const edited = await asApp(TENANT_ALPHA, insertion(tenantId, callId, "edited", READING));
    expect(edited.ok, `an edit that names what the person settled on is recorded:\n${edited.stderr.slice(-400)}`).toBe(true);
  });

  it("the call a disposition answers is one this workspace made", async () => {
    const { tenants, calls } = await staged();
    const borrowed = await asApp(TENANT_ALPHA, insertion(tenants[TENANT_ALPHA] ?? "", calls[TENANT_BETA] ?? "", "accepted", "null"));
    expect(
      borrowed.ok,
      "a workspace cannot record a disposition of another workspace's call — the foreign key is composite, because postgres checks it with row security bypassed",
    ).toBe(false);
    expect(borrowed.sqlstate, "and the store refuses it as the reference it is").toBe("23503");
  });

  it("a workspace sees its own dispositions and no other's", async () => {
    expect((await recordOwn(TENANT_BETA)).ok, "the second workspace records a disposition of its own call").toBe(true);
    const { tenants } = await staged();

    for (const [name, other] of [
      [TENANT_ALPHA, TENANT_BETA],
      [TENANT_BETA, TENANT_ALPHA],
    ] as const) {
      const seen = await asApp(name, `select distinct ${ident(TENANT_COLUMN)}::text from ${ident(TABLE)};`);
      expect(seen.ok, `${name} reads its own dispositions`).toBe(true);
      const ids = seen.rows.map((row) => row[0] ?? "");
      expect(ids, `${name} sees the rows it recorded`).toContain(tenants[name] ?? "");
      expect(ids, `and none of ${other}'s — row security, forced on the owner too`).not.toContain(tenants[other] ?? "");
    }
  });

  it("the order rows were recorded in is the store's own count, which no writer supplies", async () => {
    const { bootstrapUrl, tenants, calls } = await staged();
    const tenantId = tenants[TENANT_ALPHA] ?? "";
    const callId = calls[TENANT_ALPHA] ?? "";

    const supplied = await asApp(TENANT_ALPHA, `insert into ${ident(TABLE)} (tenant_id, project_id, call_id, sheet_id, disposition, proposed, actor_user_id, recorded_seq)
        values (${lit(tenantId)}::uuid, ${lit(PROJECT)}::uuid, ${lit(callId)}::uuid, 'ingest:SHEET-01', 'accepted', ${READING}, ${lit(ACTOR)}::uuid, 1);`);
    expect(supplied.ok, "a writer that could number the history could reorder it: the column is generated always").toBe(false);

    // Two rows recorded inside one statement, at one instant the clock cannot tell apart: what makes
    // "newest-first" answerable then is the sequence, not the timestamp.
    const together = await asApp(
      TENANT_ALPHA,
      `insert into ${ident(TABLE)} (tenant_id, project_id, call_id, sheet_id, disposition, proposed, actor_user_id, created_at)
         values (${lit(tenantId)}::uuid, ${lit(PROJECT)}::uuid, ${lit(callId)}::uuid, 'ingest:FIRST', 'accepted', ${READING}, ${lit(ACTOR)}::uuid, '2026-01-01T00:00:00Z'),
                (${lit(tenantId)}::uuid, ${lit(PROJECT)}::uuid, ${lit(callId)}::uuid, 'ingest:SECOND', 'rejected', ${READING}, ${lit(ACTOR)}::uuid, '2026-01-01T00:00:00Z');`,
    );
    expect(together.ok, `two dispositions may share an instant:\n${together.stderr.slice(-400)}`).toBe(true);

    const ordered = run(
      bootstrapUrl,
      withSession(
        { [GUC_SYSTEM_REASON]: REASON },
        `select sheet_id from ${ident(TABLE)} where created_at = '2026-01-01T00:00:00Z' order by created_at desc, recorded_seq desc;`,
      ),
    ).map((row) => row[0] ?? "");
    expect(ordered, "newest-first has an answer even inside one tick of the clock: the second row recorded comes back first").toEqual(["ingest:SECOND", "ingest:FIRST"]);
  });
});

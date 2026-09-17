/**
 * AC-1 (V-DB) — `bar_rows` and the platform edition that puts the rebar shard in force, as the
 * store holds them (SEAM-TENANT, L-REG-04, L-REG-07, L-MEA-04).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane over the committed migrations and their journal, so no file under db/ is read here: a
 * table standing in that database is the migration, observed.
 *
 * It lives beside this leaf's other suites rather than under db/__tests__ so that a vitest include
 * glob of the tree collects it by name; the lane it RUNS in is still the database lane, which
 * derives its own include from the import graph — this file reaches the live-database harness, and
 * the partition (proved in tests/toolchain/test-lane-split.test.ts) moves it there by itself.
 *
 * Two of AC-1's observables are already proved over the WHOLE seam by suites this leaf's table joins
 * the moment it lands, and are not re-run here: `seam-tenant.live.test.ts` drives the tenant and
 * system-reason posture of every table carrying `tenant_id`, and `tenancy-base.migration.test.ts`
 * runs `scripts/db-drift.mjs --scratch` — the schema-drift lane `pnpm db:drift` is — over the
 * committed seam. What is asserted here is what belongs to this table alone: that it stands, how it
 * is keyed, that RLS is armed with both policies, what the app role may do with it, that the kind
 * CHECKs now admit the new kind, and that the new platform edition was MINTED beside the old ones.
 */
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, GUC_TENANT, ROLE_APP } from "../../../../db/__tests__/support/fixtures";
import { isTrue, lit, run } from "../../../../db/__tests__/support/live-sql";

/** The store this leaf lands, the name its key carries, and the index it is read by campaign under. */
const BAR_ROWS = "bar_rows";
const BAR_ROWS_KEY = "bar_rows_key";
const BY_CAMPAIGN = "bar_rows_by_campaign";

/** The columns L-REG-04's bar row key is made of, in the order the key states them. */
const KEY_COLUMNS: readonly string[] = ["tenant_id", "campaign_id", "bar_key"];

/** What the app role may do with a bill of bars: read it, write it, and replace it. Nothing else. */
const APP_PRIVILEGES: readonly string[] = ["DELETE", "INSERT", "SELECT"];

/** The kind this leaf lands, and a kind that already stood — the yardstick for "re-stated". */
const RCC_REBAR = "rcc.rebar";
const RCC_CONCRETE = "rcc.concrete";

/** The platform edition the migration mints, and the five pairs it must put in force (AC-1). */
const SEED_EDITION = { name: "IS1200_IN", version: "2027.01" };
const REBAR_PAIRS: readonly string[] = ["detailing.BNBC2020_BD@2026.07", "rcc.rebar.cutting_length@1", "rcc.rebar.stock@1", "rcc.rebar.synthesis@1", "rcc.rebar.mass@1"];

type Stage = { bootstrapUrl: string; tenantScoped: string[] };

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
    return { bootstrapUrl, tenantScoped: await enumerateTenantScopedTables(bootstrapUrl) };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** One answer from the migrated database, as its catalogue reports it. */
async function ask(script: string): Promise<string[][]> {
  const { bootstrapUrl } = await staged();
  return run(bootstrapUrl, script);
}

describe("AC-1: the bill of bars is migrated, keyed by its content and posture-bound", () => {
  it("AC-1: bar_rows stands in the migrated database, tenant-scoped", async () => {
    const stage = await staged();
    const held = await ask(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = ${lit(BAR_ROWS)};`);
    expect(held.map((row) => row[0]), `the product's migration lane lands public.${BAR_ROWS} — the store this leaf's rows stand in`).toEqual([BAR_ROWS]);
    expect(
      stage.tenantScoped.some((name) => name.endsWith(BAR_ROWS)),
      `${BAR_ROWS} carries tenant_id, so it is one of the tables seam-tenant.live drives the whole posture over (SEAM-TENANT)`,
    ).toBe(true);
  });

  it("AC-1: the primary key is bar_rows_key over (tenant_id, campaign_id, bar_key)", async () => {
    const keyed = await ask(
      `select con.conname, string_agg(att.attname, ',' order by ordinality)
         from pg_constraint con
         join unnest(con.conkey) with ordinality as k(attnum, ordinality) on true
         join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
        where con.conrelid = ${lit(`public.${BAR_ROWS}`)}::regclass and con.contype = 'p'
        group by con.conname;`,
    );
    expect(keyed.map((row) => [row[0], row[1]]), `${BAR_ROWS} is keyed by the content-derived bar key, under the name the interfaces give it (L-REG-04)`).toEqual([
      [BAR_ROWS_KEY, KEY_COLUMNS.join(",")],
    ]);

    const indexes = await ask(`select indexname from pg_indexes where schemaname = 'public' and tablename = ${lit(BAR_ROWS)} order by indexname;`);
    expect(indexes.map((row) => row[0]), `${BY_CAMPAIGN} stands — the bill of one campaign is read whole, by campaign (interfaces)`).toContain(BY_CAMPAIGN);
  });

  it("AC-1: row-level security is armed, with both the tenant policy and the system-reason policy", async () => {
    const posture = await ask(`select relrowsecurity, relforcerowsecurity from pg_class where oid = ${lit(`public.${BAR_ROWS}`)}::regclass;`);
    expect(isTrue(String(posture[0]?.[0])), `${BAR_ROWS} has row-level security enabled (SEAM-TENANT)`).toBe(true);
    expect(isTrue(String(posture[0]?.[1])), `and forced, so even the owning role is scoped`).toBe(true);

    const policies = await ask(`select coalesce(qual, '') || ' ' || coalesce(with_check, '') from pg_policies where schemaname = 'public' and tablename = ${lit(BAR_ROWS)};`);
    const said = policies.map((row) => String(row[0])).join(" | ");
    expect(said, `${BAR_ROWS} is scoped by ${GUC_TENANT} — a row of one workspace is never read in another`).toContain(GUC_TENANT);
    expect(said, `and admits the system reason ${GUC_SYSTEM_REASON}, as every table of the seam does`).toContain(GUC_SYSTEM_REASON);
  });

  it("AC-1: cubit_app holds SELECT, INSERT and DELETE on bar_rows, and nothing else", async () => {
    const granted = await ask(
      `select distinct privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and table_name = ${lit(BAR_ROWS)} and grantee = ${lit(ROLE_APP)} order by privilege_type;`,
    );
    expect(granted.map((row) => String(row[0])).sort(), `${ROLE_APP} writes a campaign's bill and replaces it, and never UPDATEs a content-keyed row (L-REG-04)`).toEqual([...APP_PRIVILEGES].sort());
  });

  it("AC-1: every CHECK that closes a column to the kinds now admits rcc.rebar", async () => {
    const checks = await ask(
      `select conrelid::regclass::text, conname, pg_get_constraintdef(oid)
         from pg_constraint where contype = 'c' and pg_get_constraintdef(oid) like ${lit(`%'${RCC_CONCRETE}'%`)};`,
    );
    expect(checks.length, `the migrated database closes a column to the kind roster somewhere (it is how ${RCC_CONCRETE} is admitted) — with none, this case proves nothing`).toBeGreaterThan(0);
    const stale = checks.filter((row) => !String(row[2]).includes(`'${RCC_REBAR}'`)).map((row) => `${String(row[0])}.${String(row[1])}`);
    expect(stale, `a kind CHECK that admits ${RCC_CONCRETE} and not ${RCC_REBAR} would refuse this leaf's own lines (L-MEA-04, AC-1)`).toEqual([]);
  });

  it("AC-1: the platform edition naming the rebar shard is MINTED beside the editions that stood", async () => {
    // The citation is read newline-free: `methods` is a `json` column, so it leaves the database as
    // the exact text its migration wrote — and a pretty-printed literal (0046 spells nineteen pairs
    // over as many lines) would reach the reader as one output line per line of JSON, splitting one
    // edition into fragments. Stripping the line breaks leaves the stored text otherwise byte for
    // byte, so one row here is one minted edition and the citation still reads as it was written.
    const rows = await ask(`select name, version, replace(methods::text, chr(10), ' ') from ruleset_editions where scope = 'platform' order by name, version;`);
    const minted = rows.filter((row) => String(row[0]) === SEED_EDITION.name && String(row[1]) === SEED_EDITION.version);
    expect(minted.length, `the platform scope holds ${SEED_EDITION.name} @ ${SEED_EDITION.version}, minted by this leaf's own migration (L-REG-07)`).toBe(1);

    const cited = String(minted[0]?.[2] ?? "");
    for (const pair of REBAR_PAIRS) {
      const [ruleId, version] = pair.split("@") as [string, string];
      expect(cited.includes(ruleId) && cited.includes(version), `the minted edition cites ${pair} — a pair no edition cites measures nothing (L-MEA-01)`).toBe(true);
    }

    const earlier = rows.filter((row) => !(String(row[0]) === SEED_EDITION.name && String(row[1]) === SEED_EDITION.version));
    expect(earlier.length, "and the platform editions that stood before it still stand — history is append-only, so the mint joins them rather than editing one").toBeGreaterThan(0);
    const spelled = rows.map((row) => `${String(row[0])}@${String(row[1])}`);
    expect(new Set(spelled).size, `each platform edition stands once: ${spelled.join(", ")}`).toBe(spelled.length);
  });
});

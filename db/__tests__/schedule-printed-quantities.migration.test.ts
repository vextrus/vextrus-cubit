/**
 * 0063 — `schedule_printed_quantities`, the quantity an opening schedule PRINTS for one of its rows,
 * as a cited reading and never a count of members; and `member_type_dimensions`' closed roster
 * re-stated with an opening's sill and a wall type's thickness (s-schedules I-506/f/g; L-MEA-02,
 * L-CAD-08, SEAM-TENANT, V-DB).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane over the committed migrations and their journal, so no file under db/ is read here: a
 * table standing in that database is the migration and its journal entry, observed. Raw SQL is
 * spoken through psql, never a driver import.
 *
 * B-19: no posture is transcribed. The table is one more table of the SAME stored partition as
 * `member_type_variants` — rebuilt per ingest, deleted and written again in one transaction — so its
 * scope and its privileges are derived by COMPARISON against that table.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { lit, psql, run, withSession } from "./support/live-sql";

/** The table 0063 lands, and the table it is compared against. */
const TABLE = "schedule_printed_quantities";
const PEER = "member_type_variants";
const DIMENSIONS = "member_type_dimensions";

/** The reason this suite runs its system-scoped statements under — attributable, like any other. */
const REASON = "test: probe the printed quantities' closed lists";

/** A CHECK violation, as Postgres names one. */
const CHECK_VIOLATION = "23514";

/** The scoping columns every table of the stored partition carries. */
const SCOPE: readonly string[] = [TENANT_COLUMN, "project_id", "drawing_id", "ingest_id"];

/** What a stored printed quantity says, and the grain it stands under. */
const COLUMNS: readonly string[] = [
  ...SCOPE,
  "schedule_key",
  "family",
  "variant_key",
  "text",
  "printed",
  "basis",
  "basis_keys",
  "plan_key",
  "tag_keys",
  "refusal",
  "source_keys",
  "created_at",
];
const KEY: readonly string[] = [TENANT_COLUMN, "ingest_id", "schedule_key", "family", "variant_key"];

let scratch: ScratchDb | undefined;
let staging: Promise<{ bootstrapUrl: string }> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<{ bootstrapUrl: string }> =>
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

async function columnsOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(bootstrapUrl, `select column_name from information_schema.columns where table_schema = 'public' and table_name = ${lit(table)} order by 1;`).map((row) => row[0] ?? "");
}

async function privilegesOf(table: string, role: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(role)} order by 1;`,
  ).map((row) => row[0] ?? "");
}

async function securityOf(table: string): Promise<{ enabled: string; forced: string }> {
  const { bootstrapUrl } = await staged();
  const rows = run(bootstrapUrl, `select relrowsecurity::text, relforcerowsecurity::text from pg_class where oid = ${lit(`public.${table}`)}::regclass;`);
  return { enabled: rows[0]?.[0] ?? "", forced: rows[0]?.[1] ?? "" };
}

/** The policies a table wears, as what they SAY: the command, the rows admitted, the rows accepted. */
async function policiesOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select polcmd::text || ' | ' || coalesce(pg_get_expr(polqual, polrelid), '-') || ' | ' || coalesce(pg_get_expr(polwithcheck, polrelid), '-')
       from pg_policy where polrelid = ${lit(`public.${table}`)}::regclass order by 1;`,
  ).map((row) => (row[0] ?? "").replaceAll(`"${table}".`, "").replaceAll(table, ""));
}

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

const keys = (...handles: string[]): string => `array[${handles.map((handle) => lit(`DXF_HANDLE:${handle}`)).join(", ")}]::text[]`;

/** One lawful row — F-ARCH's typical D-2, declared against the typical plan — with whatever the case probes overridden. */
function insertRow(override: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    schedule_key: lit("DXF_HANDLE:81C"),
    family: lit("D2"),
    variant_key: lit("1ST-6TH"),
    text: lit("08 NOS"),
    printed: "8",
    basis: lit("per-floor"),
    basis_keys: keys("740"),
    plan_key: lit("LAYOUT_PLAN:DXF_HANDLE:81B"),
    tag_keys: keys("523", "529", "52F", "535", "53B", "541", "547", "54D", "553"),
    refusal: lit("OPENING_QUANTITY_DISAGREES"),
    source_keys: keys("6DE"),
    ...override,
  };
  const scope = [randomUUID(), randomUUID(), randomUUID(), randomUUID()].map((id) => `${lit(id)}::uuid`);
  const columns = [...SCOPE, ...Object.keys(values)];
  return `insert into "${TABLE}" (${columns.map((column) => `"${column}"`).join(", ")}) values (${[...scope, ...Object.values(values)].join(", ")});`;
}

async function attempt(override: Record<string, string> = {}): Promise<ReturnType<typeof psql>> {
  const { bootstrapUrl } = await staged();
  return psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, insertRow(override)));
}

/** One dimension row of the roster's own table, probing the re-stated CHECK. */
async function dimension(name: string): Promise<ReturnType<typeof psql>> {
  const { bootstrapUrl } = await staged();
  const scope = [randomUUID(), randomUUID(), randomUUID(), randomUUID()].map((id) => `${lit(id)}::uuid`);
  const columns = [...SCOPE, "schedule_key", "family", "variant_key", "dimension", "text", "value", "unit", "source_keys"];
  const values = [...scope, lit("DXF_HANDLE:83C"), lit("BW250"), lit("SECTION"), lit(name), lit("250 (0'-10\")"), "250", lit("mm"), keys("7B2")];
  return psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, `insert into "${DIMENSIONS}" (${columns.map((column) => `"${column}"`).join(", ")}) values (${values.join(", ")});`));
}

describe("0063: the printed quantities are migrated, scoped and rewritable", () => {
  it("the product's own migration lane lands the table, with what a schedule prints and the check it stands under", async () => {
    expect(await columnsOf(TABLE), `public.${TABLE} says whose it is, which drawing, ingest, schedule, family and variant it was printed for, and what was read there (I-507)`).toEqual([...COLUMNS].sort());
  });

  it("stands under the key its grain names: one printed quantity per variant of one family", async () => {
    expect(await primaryKeyColumnsOf(TABLE), "a rebuilt partition replaces the rows of the ingest it rebuilt rather than standing a second set beside them (L-REG-04)").toEqual([...KEY]);
  });

  it("is scoped exactly as the variants it stands beside", async () => {
    const peer = await securityOf(PEER);
    expect([peer.enabled, peer.forced], `public.${PEER} is the posture compared against`).toEqual(["true", "true"]);
    expect(await securityOf(TABLE), "row-level security, WITH FORCE: a guarantee the owner escapes is not a guarantee (SEAM-TENANT)").toEqual(peer);
    const peerPolicies = await policiesOf(PEER);
    expect(peerPolicies.length, `public.${PEER} wears the policies compared against`).toBeGreaterThan(0);
    expect(await policiesOf(TABLE), "the workspace's own rows, and a system session that has recorded its reason — exactly as the variants (SEAM-TENANT)").toEqual(peerPolicies);
  });

  it("the app role reads, writes and takes away — never an UPDATE, which would edit a derivation in place", async () => {
    const peer = await privilegesOf(PEER, ROLE_APP);
    expect(peer, `${ROLE_APP} on public.${PEER}`).toEqual(["DELETE", "INSERT", "SELECT"]);
    expect(await privilegesOf(TABLE, ROLE_APP), "a partition is REBUILT, so its rows are read, written and taken away in one transaction (R-TO-030)").toEqual(peer);
  });

  it("a declared disagreement, a reading that agrees, one on no stated basis and one checked against no plan are rows the store accepts", async () => {
    for (const [what, override] of [
      ["T-OPENING-NOS, declared against the plan", {}],
      ["a reading that agrees with its plan", { refusal: "null", printed: "9" }],
      ["a reading on no stated basis", { basis: "null", basis_keys: "array[]::text[]", plan_key: "null", tag_keys: "array[]::text[]", refusal: lit("OPENING_QUANTITY_BASIS_UNSTATED") }],
      ["a reading no plan of its floors could check", { plan_key: "null", tag_keys: "array[]::text[]", refusal: "null" }],
    ] as const) {
      const accepted = await attempt(override);
      expect(accepted.ok, `${what} is a row the store accepts:\n${accepted.stderr.slice(-600)}`).toBe(true);
    }
  });

  it("a basis, a code or a count outside the law, a basis citing nothing, a disagreement with no plan and a row citing nothing are refused by CHECK", async () => {
    for (const [what, override] of [
      ["a basis outside the roster", { basis: lit("per-sheet") }],
      ["a basis stated with nothing cited", { basis_keys: "array[]::text[]" }],
      ["a basis cited where none was stated", { basis: "null" }],
      ["another area's code", { refusal: lit("SCHEDULE_NONE_RECONSTRUCTED") }],
      ["a disagreement with no plan", { plan_key: "null" }],
      ["a negative quantity", { printed: "-1" }],
      ["a row citing no entity", { source_keys: "array[]::text[]" }],
    ] as const) {
      const attempted = await attempt(override);
      expect(attempted.ok, `${what} is refused however it reached the insert`).toBe(false);
      expect(attempted.sqlstate, `and it is a CHECK that refused ${what}`).toBe(CHECK_VIOLATION);
    }
  });

  it("the dimension roster is re-stated: an opening's sill and a wall type's thickness are admitted, and a count still is not", async () => {
    for (const admitted of ["thickness", "sill", "dia"]) {
      const accepted = await dimension(admitted);
      expect(accepted.ok, `${admitted} is a dimension the store admits:\n${accepted.stderr.slice(-600)}`).toBe(true);
    }
    const refused = await dimension("nos");
    expect([refused.ok, refused.sqlstate], "a count is no dimension of a member type (L-CAD-08)").toEqual([false, CHECK_VIOLATION]);
  });
});

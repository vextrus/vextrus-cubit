/**
 * 0062 — `conditions` and `manual_measurements`, S-Measure's two tables (docs/design/s-measure.md,
 * I-374, I-378, I-379, I-385; SEAM-TENANT, V-DB).
 *
 * The migration is judged by what it DOES: the database every case reads is built by the product's
 * own lane over the committed migrations and their journal, so a table standing there is the
 * migration and its journal entry, observed. Raw SQL is spoken through psql, never a driver import.
 *
 * B-19: no posture is transcribed. A hand measurement is a record of an act, so it is scoped and
 * privileged exactly as the register's own ledger of readings is (`register_observations`): read and
 * added by the app role, never rewritten, never taken away — and the owner is refused too. A condition
 * is authored data a person edits and retires, so it is updatable and never deleted.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../db/__tests__/harness";
import { BOOTSTRAP_URL, ROLE_APP } from "../../../db/__tests__/support/fixtures";
import { lit, psql, run } from "../../../db/__tests__/support/live-sql";

const BUDGET_MS = 600_000;

const MEASUREMENTS = "manual_measurements";
const CONDITIONS = "conditions";
/** The register's own ledger of readings: the posture a record of an act is compared against. */
const PEER = "register_observations";

/** A CHECK violation, and the error the owner-proof trigger raises, as Postgres names them. */
const CHECK_VIOLATION = "23514";

let scratch: ScratchDb | undefined;
let staging: Promise<{ bootstrapUrl: string; migrateUrl: string }> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<{ bootstrapUrl: string; migrateUrl: string }> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const url = new URL(BOOTSTRAP_URL);
    url.pathname = new URL(provisioned.urlMigrate).pathname;
    return { bootstrapUrl: url.toString(), migrateUrl: provisioned.urlMigrate };
  })());

afterAll(async () => {
  await scratch?.drop();
}, 120_000);

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

async function securityOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  const rows = run(bootstrapUrl, `select relrowsecurity::text, relforcerowsecurity::text from pg_class where oid = ${lit(`public.${table}`)}::regclass;`);
  return [rows[0]?.[0] ?? "", rows[0]?.[1] ?? ""];
}

/** The policies a table wears, as what they SAY — the table's own name taken out so two tables compare. */
async function policiesOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select polcmd::text || ' | ' || coalesce(pg_get_expr(polqual, polrelid), '-') || ' | ' || coalesce(pg_get_expr(polwithcheck, polrelid), '-')
       from pg_policy where polrelid = ${lit(`public.${table}`)}::regclass order by 1;`,
  ).map((row) => (row[0] ?? "").replaceAll(`"${table}".`, "").replaceAll(table, ""));
}

/**
 * One hand measurement row, with whatever the case probes overridden. It is written with the foreign
 * keys asleep (`session_replication_role = replica`): what is judged here is the table's own CHECKs
 * and the belt around it, not the act that writes a whole world behind a real row.
 */
function measurementRow(override: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    tenant_id: `${lit(randomUUID())}::uuid`,
    set_revision_id: `${lit(randomUUID())}::uuid`,
    object_key: lit(`v:LAYOUT_PLAN:DXF_HANDLE:2073|~m.0123456789abcdef|-125.0,-400125.0@${randomUUID()}`),
    project_id: `${lit(randomUUID())}::uuid`,
    act_id: `${lit(randomUUID())}::uuid`,
    drawing_id: `${lit(randomUUID())}::uuid`,
    ingest_id: `${lit(randomUUID())}::uuid`,
    layout_name: lit("model"),
    partition_view_key: lit("LAYOUT_PLAN:DXF_HANDLE:2073"),
    view_key: lit("v:LAYOUT_PLAN:DXF_HANDLE:2073"),
    condition_name: lit("75 CC blinding under SOG"),
    geometry: lit("POLYGON"),
    element_class: lit("slab"),
    kinds: lit(`[{"kind":"pcc.blinding","ruleId":"pcc.blinding.area"}]`),
    readings: lit(`[{"attribute":"t","valueAsWritten":"75","unitAsWritten":"mm","basis":"ENTERED","sourceKey":null}]`),
    level_id: `${lit(randomUUID())}::uuid`,
    level_slot: "null",
    traced: lit(`{"geometry":"POLYGON","outer":[],"cutouts":[]}`),
    figure: lit(`{"measure":"AREA","gross":"1","cutouts":[]}`),
    drawn_unit: lit("mm"),
    figure_unit: lit("mm2"),
    calibration_key: lit("0".repeat(64)),
    supersedes: "null",
    ...override,
  };
  return `insert into ${MEASUREMENTS} (${Object.keys(values).join(", ")}) values (${Object.values(values).join(", ")});`;
}

async function attempt(statement: string): Promise<ReturnType<typeof psql>> {
  const { bootstrapUrl } = await staged();
  return psql(bootstrapUrl, `set session_replication_role = replica;\n${statement}`);
}

describe("0062: the hand measurement's store is migrated, scoped and append-only", () => {
  it("lands both tables: a measurement's register row, recipe, level, exact geometry, figure and scale; a condition's recipe and swatch", async () => {
    expect(await columnsOf(MEASUREMENTS)).toEqual(
      [
        "act_id",
        "calibration_key",
        "condition_id",
        "condition_name",
        "drawing_id",
        "drawn_unit",
        "element_class",
        "figure",
        "figure_unit",
        "geometry",
        "ingest_id",
        "kinds",
        "layout_name",
        "level_id",
        "level_slot",
        "object_key",
        "partition_view_key",
        "project_id",
        "readings",
        "recorded_at",
        "set_revision_id",
        "supersedes",
        "tenant_id",
        "traced",
        "view_key",
      ].sort(),
    );
    expect(await columnsOf(CONDITIONS)).toEqual(
      ["authored_at", "authored_by", "colour", "condition_id", "element_class", "geometry", "hatch", "kinds", "name", "project_id", "readings", "retired_at", "retired_by", "tenant_id"].sort(),
    );
  }, BUDGET_MS);

  it("both are scoped exactly as the register's ledger of readings", async () => {
    const peer = await policiesOf(PEER);
    expect(peer.length, `public.${PEER} wears the policies compared against`).toBeGreaterThan(0);
    for (const table of [MEASUREMENTS, CONDITIONS]) {
      expect(await securityOf(table), `${table}: row-level security, WITH FORCE (SEAM-TENANT)`).toEqual(["true", "true"]);
      expect(await policiesOf(table), `${table}: the workspace's own rows, and a system session that has recorded its reason`).toEqual(peer);
    }
  }, BUDGET_MS);

  it("the app role reads and adds a measurement and never rewrites or takes one away; a condition it may also edit, never delete", async () => {
    expect(await privilegesOf(PEER, ROLE_APP), `${ROLE_APP} on public.${PEER}`).toEqual(["INSERT", "SELECT"]);
    expect(await privilegesOf(MEASUREMENTS, ROLE_APP), "a measurement is a record of an act (L-ACT-01)").toEqual(await privilegesOf(PEER, ROLE_APP));
    expect(await privilegesOf(CONDITIONS, ROLE_APP), "a condition is authored data a person edits and retires (I-374)").toEqual(["INSERT", "SELECT", "UPDATE"]);
  }, BUDGET_MS);

  it("a lawful row stands; a level stated twice, none, or in the UNRESOLVED slot, and a geometry off the roster, are refused by CHECK", async () => {
    const lawful = await attempt(measurementRow());
    expect(lawful.ok, `a hand measurement on a live level is a row the store accepts:\n${lawful.stderr.slice(-600)}`).toBe(true);
    const foundation = await attempt(measurementRow({ level_id: "null", level_slot: lit("FOUNDATION") }));
    expect(foundation.ok, `a foundation class in the lawful-null slot:\n${foundation.stderr.slice(-600)}`).toBe(true);
    for (const [what, override] of [
      ["a level stated twice", { level_slot: lit("FOUNDATION") }],
      ["no level at all", { level_id: "null" }],
      ["the UNRESOLVED slot, which I-368 bars from lines", { level_id: "null", level_slot: lit("UNRESOLVED") }],
      ["a geometry no hand tool traces", { geometry: lit("PRISM_RECT") }],
      ["a class the catalogue does not hold", { element_class: lit("wall") }],
      ["a condition with no name", { condition_name: lit("  ") }],
    ] as const) {
      const refused = await attempt(measurementRow(override));
      expect(refused.ok, `${what} is refused however it reached the insert`).toBe(false);
      expect(refused.sqlstate, `and it is a CHECK that refused ${what}`).toBe(CHECK_VIOLATION);
    }
  }, BUDGET_MS);

  it("the owner itself cannot rewrite or take away a measurement, nor take away a condition — the belt is a trigger, not a grant", async () => {
    const { migrateUrl } = await staged();
    const objectKey = `v:LAYOUT_PLAN:DXF_HANDLE:2073|~m.fedcba9876543210|0.0,0.0@${randomUUID()}`;
    const written = await attempt(measurementRow({ object_key: lit(objectKey) }));
    expect(written.ok, written.stderr.slice(-600)).toBe(true);
    for (const statement of [
      `update ${MEASUREMENTS} set condition_name = 'renamed' where object_key = ${lit(objectKey)};`,
      `delete from ${MEASUREMENTS} where object_key = ${lit(objectKey)};`,
    ]) {
      const tried = psql(migrateUrl, `set cubit.system_reason = 'test: the owner tries to rewrite a hand measurement';\n${statement}`);
      expect(tried.ok, `${statement} — the append-only trigger refuses the owner too`).toBe(false);
      expect(tried.stderr, "and it is the tree's one append-only rule that refused it").toMatch(/append/iu);
    }
    const conditionId = randomUUID();
    const authored = await attempt(
      `insert into ${CONDITIONS} (tenant_id, condition_id, project_id, name, geometry, element_class, kinds, readings, colour, hatch, authored_by)
         values (${lit(randomUUID())}::uuid, ${lit(conditionId)}::uuid, ${lit(randomUUID())}::uuid, '75 CC blinding under SOG', 'POLYGON', 'slab', '[]', '[]', 'slab', 'diagonal', ${lit(randomUUID())}::uuid);`,
    );
    expect(authored.ok, authored.stderr.slice(-600)).toBe(true);
    const removed = psql(migrateUrl, `set cubit.system_reason = 'test: the owner tries to take a condition away';\ndelete from ${CONDITIONS} where condition_id = ${lit(conditionId)}::uuid;`);
    expect(removed.ok, "a condition is retired, never deleted — a measurement cites it").toBe(false);
  }, BUDGET_MS);
});

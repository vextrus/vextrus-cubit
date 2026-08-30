/**
 * Live acceptance for the Quantity Register's admission door (L-REG-03, L-REG-04, V-DB): AC-2 and
 * AC-3, against a self-provisioned, migrated scratch database — the same harness every other live
 * suite runs on.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree. The register and the identity grammar are loaded by absolute path through the
 * shared acceptance loader, so a module the product does not provide yet fails as an assertion
 * naming the file instead of killing collection at transform time.
 *
 * B-19: nothing here transcribes a schema. The two tables' columns, policies, grants and foreign
 * keys are read out of the catalogue of the database the committed migrations actually built, and
 * every key this file expects is re-composed from the tree's own key builders — so a Builder who
 * spells a key differently is judged by the same cases as one who spells it this way.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  UNREGISTERED_PREFIX,
  composedRowKey,
  loadIdentity,
  loadRegister,
  sightingOf,
  stringsIn,
  type IdentityModule,
  type RegisterModule,
  type Scope,
  type Sighting,
} from "../../src/core/identity/__tests__/support/wire";
import { REFUSALS } from "../../src/core/errors";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { provisionScratchDb } from "./harness";
import { AUDIT_REASON, GUC_SYSTEM_REASON, GUC_TENANT, SEED_REASON, TENANT_ALPHA, TENANT_BETA, TENANT_COLUMN } from "./support/fixtures";
import { count, deriveTenantScopedTables, ident, isTrue, lit, probeValue, requiredColumns, run, scalar, seedTenants, withSession, type TableRef } from "./support/live-sql";

/** The two tables this increment's migration lands, named by the increment's interfaces. */
const REGISTER_ROWS = "register_rows";
const DUPLICATE_SIGHTINGS = "duplicate_sightings";

/** The columns of `register_rows` the test contract fixes. */
const ROW_KEY = "row_key";
const SET_REVISION_KEY = "set_revision_key";
const PROJECT_COLUMN = "project_id";
const MARK = "mark";
const ORDINAL_KEY = "ordinal_key";
const SEMANTIC = "semantic";

/** The refusal L-REG-03 names at the door. */
const DUPLICATE_IDENTITY = "DUPLICATE_IDENTITY";

/** Words a column name may not carry on the register table (L-REG-03's "one forgotten WHERE"). */
const FLAG_WORDS = ["duplicate", "status", "flag", "superseded", "refused", "unpriceable"];

const tableRef = (table: string): TableRef => ({ schema: "public", table, sql: `${ident("public")}.${ident(table)}` });

/* ------------------------------------------------------------------ *
 * Reading the migrated database.
 * ------------------------------------------------------------------ */

function columnNames(url: string, table: string): string[] {
  return run(
    url,
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = ${lit(table)} order by ordinal_position;`,
  ).map((row) => row[0] ?? "");
}

/** The columns of a table this increment's migration is required to have created. */
function tableColumns(url: string, table: string): string[] {
  const columns = columnNames(url, table);
  expect(columns.length, `the migrated database has no "${table}" table — this increment's register migration has not created it`).toBeGreaterThan(0);
  return columns;
}

/** One row of a table, whole and as text, keyed by column name. */
function rowsWhere(url: string, table: string, where: string): Record<string, string>[] {
  const columns = tableColumns(url, table);
  return run(
    url,
    withSession(
      { [GUC_SYSTEM_REASON]: AUDIT_REASON },
      `select ${columns.map((name) => `${ident(name)}::text`).join(", ")} from ${ident(table)} where ${where};`,
    ),
  ).map((values) => {
    const record: Record<string, string> = {};
    columns.forEach((name, index) => {
      record[name] = values[index] ?? "";
    });
    return record;
  });
}

/** Every register row of one (tenant, project, set revision), read under system scope. */
function registerRowsOf(url: string, scope: Scope, setRevisionKey: string): Record<string, string>[] {
  return rowsWhere(
    url,
    REGISTER_ROWS,
    `${ident(TENANT_COLUMN)} = ${lit(scope.tenantId)} and ${ident(PROJECT_COLUMN)} = ${lit(scope.projectId)} and ${ident(SET_REVISION_KEY)} = ${lit(setRevisionKey)}`,
  );
}

/** Every refused sighting kept for one (tenant, project), read under system scope. */
function duplicatesOf(url: string, scope: Scope): Record<string, string>[] {
  return rowsWhere(url, DUPLICATE_SIGHTINGS, `${ident(TENANT_COLUMN)} = ${lit(scope.tenantId)} and ${ident(PROJECT_COLUMN)} = ${lit(scope.projectId)}`);
}

/** Insert one row under system scope, filling everything the caller did not name from its own type. */
function seedRow(url: string, table: string, tenantId: string, known: Readonly<Record<string, string>>): Record<string, string> {
  const columns = tableColumns(url, table);
  const present = new Set(columns);
  const chosen = new Map<string, string>([[TENANT_COLUMN, lit(tenantId)]]);
  for (const column of requiredColumns(url, tableRef(table))) {
    if (present.has(column.name)) chosen.set(column.name, known[column.name] ?? probeValue(column));
  }
  for (const [name, value] of Object.entries(known)) {
    if (present.has(name)) chosen.set(name, value);
  }
  const values = run(
    url,
    withSession(
      { [GUC_SYSTEM_REASON]: SEED_REASON },
      `insert into ${ident(table)} (${[...chosen.keys()].map(ident).join(", ")}) values (${[...chosen.values()].join(", ")}) returning ${columns.map((name) => `${ident(name)}::text`).join(", ")};`,
    ),
  )[0];
  expect(values, `seeding a row into ${table} through the system channel returned nothing`).toBeDefined();
  const record: Record<string, string> = {};
  columns.forEach((name, index) => {
    record[name] = values?.[index] ?? "";
  });
  return record;
}

/* ------------------------------------------------------------------ *
 * Refusals, read the one way the tree reads them (ARCH-02).
 * ------------------------------------------------------------------ */

/** Run the work, require it to refuse, and hand back what it threw. */
async function refusalFrom(work: () => unknown, what: string): Promise<unknown> {
  let thrown: unknown;
  let threw = false;
  try {
    await work();
  } catch (error) {
    threw = true;
    thrown = error;
  }
  expect(threw, `${what} — the door answered instead of refusing`).toBe(true);
  return thrown;
}

/** The refusal's code, and the proof that the code is one the closed register holds (B-17, Q-07). */
function refusedWith(thrown: unknown, code: string, what: string): void {
  expect(Object.hasOwn(REFUSALS, code), `${code} must be registered in src/core/errors.ts — the taxonomy is closed (R-SPINE-062, B-17)`).toBe(true);
  expect(refusalCodeOf(thrown), `${what} must be refused ${code}, readable via refusalCodeOf — got ${String(thrown)}`).toBe(code);
}

/* ------------------------------------------------------------------ *
 * Staging.
 * ------------------------------------------------------------------ */

type Scratch = { urlMigrate: string; urlApp: string; drop(): Promise<void> };

let scratch: Scratch | undefined;

afterAll(async () => {
  await scratch?.drop();
});

type Stage = { register: RegisterModule; identity: IdentityModule; url: string; appUrl: string; tenants: Record<string, string> };

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let staging: Promise<Stage> | undefined;
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    // Loaded before a database is provisioned, so a tree that does not carry the register yet fails
    // this file in a second, naming the module — the seam reads DATABASE_URL when it first connects,
    // never at import.
    const register = await loadRegister();
    const identity = await loadIdentity();
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenants = seedTenants(provisioned.urlMigrate);
    process.env["DATABASE_URL"] = provisioned.urlApp;
    return { register, identity, url: provisioned.urlMigrate, appUrl: provisioned.urlApp, tenants };
  })());

/** A fresh scope: a real project of the named tenant, so a foreign key to it is satisfied either way. */
async function scopeIn(tenantName: string): Promise<Scope> {
  const { url, tenants } = await staged();
  const tenantId = tenants[tenantName] ?? "";
  expect(tenantId, `the scenario seeded no ${tenantName}`).not.toBe("");
  const project = seedRow(url, "projects", tenantId, { name: lit(`register acceptance ${randomUUID()}`) });
  const projectId = project[PROJECT_COLUMN] ?? "";
  expect(projectId, "seeding a project produced no project id").not.toBe("");
  return { tenantId, projectId };
}

/* ------------------------------------------------------------------ *
 * AC-2: the first sighting admits; the second is refused at the door.
 * ------------------------------------------------------------------ */

describe("AC-2: DUPLICATE_IDENTITY at the door, into the no-join table", () => {
  it("AC-2: the first measured sighting admits and the second refuses, whole, into duplicate_sightings", async () => {
    const { register, identity, url } = await staged();
    const scope = await scopeIn(TENANT_ALPHA);
    const setRevisionKey = `set-rev-${randomUUID()}`;
    const sighting = sightingOf({
      setRevisionKey,
      mark: "C1",
      captionAnchorSourceKey: `sheet-s101#caption-${randomUUID()}`,
      attributes: { concreteGrade: "C30", cover: "40" },
      evidence: [`sheet-s101#dim-${randomUUID()}`],
    });
    const rowKey = composedRowKey(identity, sighting);

    const admitted = await register.admitSighting(scope, sighting);
    expect(admitted, "admitSighting answers the admitted row (L-REG-01: every stage inherits a register object)").toBeTypeOf("object");
    expect(stringsIn(admitted), "the admitted row names the content-derived key it was admitted under").toContain(rowKey);

    const afterFirst = registerRowsOf(url, scope, setRevisionKey);
    expect(afterFirst.length, `the first measured sighting of an identity admits a row into ${REGISTER_ROWS}`).toBe(1);
    expect(afterFirst[0]?.[ROW_KEY], `the admitted row carries the content-derived key (L-REG-04)`).toBe(rowKey);
    expect(afterFirst[0]?.[MARK], "the admitted row carries its mark").toBe(sighting.mark);
    expect(duplicatesOf(url, scope).length, "an admitted sighting is not a duplicate").toBe(0);

    // A second measured sighting of the same physical scope inside one drawing-set revision.
    const second: Sighting = { ...sighting, attributes: { concreteGrade: "C35" }, evidence: [`sheet-s102#dim-${randomUUID()}`] };
    expect(composedRowKey(identity, second), "the scene is built so the second sighting is the same identity — only correctable content differs").toBe(rowKey);

    const thrown = await refusalFrom(() => register.admitSighting(scope, second), "a second measured sighting of the same identity inside one set revision");
    refusedWith(thrown, DUPLICATE_IDENTITY, "L-REG-03: a second measured sighting of the same physical scope inside one drawing-set revision");

    const afterSecond = registerRowsOf(url, scope, setRevisionKey);
    expect(afterSecond.length, `${REGISTER_ROWS} gains no second row — no matcher merges sightings, and a refused one never lands here`).toBe(1);
    for (const column of [ROW_KEY, MARK, ORDINAL_KEY, SEMANTIC]) {
      expect(afterSecond[0]?.[column], `the admitted row is untouched by the refusal — no matcher merges sightings (L-REG-03), so ${column} cannot move`).toBe(afterFirst[0]?.[column]);
    }

    const kept = duplicatesOf(url, scope);
    expect(kept.length, `L-REG-03: the refused sighting is kept as unpriceable evidence in ${DUPLICATE_SIGHTINGS}`).toBe(1);
    const asText = Object.values(kept[0] ?? {}).join("");
    expect(asText, `the kept row names the row key the refused sighting collided with`).toContain(rowKey);
    expect(kept[0]?.[SET_REVISION_KEY], "the kept row is scoped to the set revision the collision happened in").toBe(setRevisionKey);
    for (const leaf of new Set(stringsIn(second))) {
      expect(asText.includes(leaf), `L-REG-03 keeps the refused sighting WHOLE — "${leaf}" is not in the ${DUPLICATE_SIGHTINGS} row`).toBe(true);
    }
  }, 300_000);

  it("AC-2: the register table carries no duplicate or status flag, and no foreign key reaches the evidence table", async () => {
    const { url } = await staged();

    for (const column of tableColumns(url, REGISTER_ROWS)) {
      for (const word of FLAG_WORDS) {
        expect(
          column.toLowerCase().includes(word),
          `L-REG-03: a status flag on the register table is one forgotten WHERE from over-measurement — ${REGISTER_ROWS}.${column} reads as one`,
        ).toBe(false);
      }
    }

    tableColumns(url, DUPLICATE_SIGHTINGS);
    const referencing = run(
      url,
      `select chn.nspname || '.' || ch.relname || '.' || c.conname
         from pg_constraint c
         join pg_class ch on ch.oid = c.conrelid
         join pg_namespace chn on chn.oid = ch.relnamespace
         join pg_class pa on pa.oid = c.confrelid
         join pg_namespace pan on pan.oid = pa.relnamespace
        where c.contype = 'f' and pan.nspname = 'public' and pa.relname = ${lit(DUPLICATE_SIGHTINGS)}
        order by 1;`,
    ).map((row) => row[0] ?? "");
    expect(referencing, `L-REG-03: the refused sighting is kept in a separate table with no join from any bill — nothing in the migrated database may reference ${DUPLICATE_SIGHTINGS}`).toEqual([]);
  }, 300_000);

  it("AC-2: both new tables are tenant-scoped, FORCE row-level security, and answer only their own tenant", async () => {
    const { url, appUrl } = await staged();
    const scope = await scopeIn(TENANT_ALPHA);
    const setRevisionKey = `set-rev-${randomUUID()}`;
    const { register, identity } = await staged();
    const sighting = sightingOf({ setRevisionKey, captionAnchorSourceKey: `sheet-s101#caption-${randomUUID()}` });
    await register.admitSighting(scope, sighting);
    const rowKey = composedRowKey(identity, sighting);

    const scoped = new Set(deriveTenantScopedTables(url).map((table) => table.table));
    for (const table of [REGISTER_ROWS, DUPLICATE_SIGHTINGS]) {
      expect(scoped.has(table), `V-DB enumerates tenant-scoped tables by their ${TENANT_COLUMN} column — ${table} must carry one`).toBe(true);
      const belts = run(url, `select c.relrowsecurity::text, c.relforcerowsecurity::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = ${lit(table)};`)[0];
      expect(isTrue(belts?.[0] ?? ""), `${table} must have row-level security enabled — the merged seam-tenant suite enumerates it`).toBe(true);
      expect(isTrue(belts?.[1] ?? ""), `${table} must FORCE row-level security, so its owner is bound by the policy too`).toBe(true);
      expect(count(url, `select count(*) from pg_policies where schemaname = 'public' and tablename = ${lit(table)};`), `${table} must carry a tenant policy`).toBeGreaterThan(0);
    }

    const beta = (await staged()).tenants[TENANT_BETA] ?? "";
    expect(beta, `the scenario seeded no ${TENANT_BETA}`).not.toBe("");
    const seenBy = (tenantId: string): number =>
      Number(scalar(appUrl, withSession({ [GUC_TENANT]: tenantId }, `select count(*) from ${ident(REGISTER_ROWS)} where ${ident(ROW_KEY)} = ${lit(rowKey)};`)));
    expect(seenBy(scope.tenantId), "the owning tenant sees the row it admitted").toBe(1);
    expect(seenBy(beta), "another tenant sees none of it — R-SPINE-004").toBe(0);
  }, 300_000);
});

/* ------------------------------------------------------------------ *
 * AC-3: the one-hop level carry.
 * ------------------------------------------------------------------ */

describe("AC-3: authoring a level moves an instance key exactly once", () => {
  it("AC-3: carryLevel rewrites every affected key to the surrogate id, leaves the rest alone, and never moves one twice", async () => {
    const { register, identity, url } = await staged();
    const scope = await scopeIn(TENANT_ALPHA);
    const setRevisionKey = `set-rev-${randomUUID()}`;
    const anchor = `sheet-s101#caption-${randomUUID()}`;
    const label = "2F";
    const otherLabel = "3F";
    const levelId = `level-${randomUUID()}`;

    const carried = ["C1", "C1", "C2"].map((mark, index) =>
      sightingOf({ setRevisionKey, captionAnchorSourceKey: anchor, mark, x: 1.21 + index * 2, levelSlot: identity.unregisteredLevelSlot(label) }),
    );
    const untouched = sightingOf({ setRevisionKey, captionAnchorSourceKey: anchor, mark: "C9", x: 21.21, levelSlot: identity.unregisteredLevelSlot(otherLabel) });
    for (const sighting of [...carried, untouched]) await register.admitSighting(scope, sighting);

    const before = new Map(registerRowsOf(url, scope, setRevisionKey).map((row) => [row[ROW_KEY] ?? "", row]));
    expect(before.size, "every sighting of the scene admits its own row").toBe(carried.length + 1);
    for (const sighting of carried) {
      expect(before.has(composedRowKey(identity, sighting)), `the row admitted under ${UNREGISTERED_PREFIX}${label} must be stored under its unregistered key`).toBe(true);
    }

    const moved = await register.carryLevel(scope, { setRevisionKey, label, levelId });
    expect(moved, `L-REG-04: authoring a level moves an instance key exactly once — carryLevel answers the count of keys it moved`).toBe(carried.length);

    const after = new Map(registerRowsOf(url, scope, setRevisionKey).map((row) => [row[ROW_KEY] ?? "", row]));
    expect(after.size, "the carry rewrites keys; it creates and destroys no rows").toBe(before.size);

    for (const sighting of carried) {
      const wasKey = composedRowKey(identity, sighting);
      const nowKey = composedRowKey(identity, { ...sighting, levelSlot: levelId });
      expect(nowKey, "the scene is built so the carry actually moves the key").not.toBe(wasKey);
      const row = after.get(nowKey);
      expect(row, `the carried row must be stored under instanceRowKey(placement, ${levelId}) — the placeholder is retired, not duplicated`).toBeDefined();
      expect(after.has(wasKey), "the key it moved from is gone — a key never stands in two places").toBe(false);
      for (const column of [MARK, ORDINAL_KEY, SEMANTIC]) {
        expect(row?.[column], `the carry moves the key and nothing else — ${column} is untouched (L-REG-02: the ordinal is frozen at first registration and inherited)`).toBe(before.get(wasKey)?.[column]);
      }
    }

    for (const key of after.keys()) {
      expect(key.includes(`${UNREGISTERED_PREFIX}${label}`), `after the carry no key of this scope may still read ${UNREGISTERED_PREFIX}${label}`).toBe(false);
    }
    expect(after.has(composedRowKey(identity, untouched)), `a placeholder for another label is not this carry's business — ${UNREGISTERED_PREFIX}${otherLabel} stands untouched`).toBe(true);

    // The second hop: inert or refused, but never a second move.
    let secondHop: unknown;
    let refused: unknown;
    try {
      secondHop = await register.carryLevel(scope, { setRevisionKey, label, levelId });
    } catch (error) {
      refused = error;
    }
    if (refused === undefined) {
      expect(secondHop, "L-REG-04's carry is one hop: re-applying it moves nothing").toBe(0);
    } else {
      expect(refusalCodeOf(refused), "a refused second hop must answer a registered refusal, not a bare fault").not.toBeNull();
    }

    const settled = registerRowsOf(url, scope, setRevisionKey).map((row) => row[ROW_KEY] ?? "");
    expect([...settled].sort(), "a key never moves twice — the second hop leaves every stored key exactly where the first put it").toEqual([...after.keys()].sort());
  }, 300_000);
});

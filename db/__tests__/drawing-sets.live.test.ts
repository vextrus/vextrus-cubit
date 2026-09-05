/**
 * The drawing-set tables under live policy (R-TO-005, L-REG-06, SEAM-TENANT, V-DB).
 *
 * A scoped read proves a policy's USING clause and only a write proves its WITH CHECK — so each
 * table is driven as the app role with one workspace's scope armed, offered a row belonging to the
 * other, and must refuse it. An own-workspace control stands beside every refusal, because a
 * refusal that is really "this insert could never have worked" proves nothing about the policy.
 *
 * Beside the policies, the two properties the store itself has to hold: a project names each of its
 * sets once, and a set and its pinned revisions cannot be rewritten or removed by anybody — the
 * owner included — while the membership between pins can, because it is a draft (I-B).
 *
 * The rows are laid down by the shared probe seeder, which builds each table's parents from the
 * catalogue, so nothing here transcribes a schema (B-19). Raw SQL is spoken through psql, never a
 * driver import: SEAM-TENANT's ban binds this file like the rest of the tree.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { GUC_SYSTEM_REASON, GUC_TENANT, ROLE_APP, TENANT_ALPHA, TENANT_BETA, TENANT_COLUMN } from "./support/fixtures";
import { deriveTenantScopedTables, ensureRowsForTenants, ident, lit, psql, qualified, run, seedTenants, withSession, type SqlResult, type TableRef } from "./support/live-sql";

const SETS = "drawing_sets";
const MEMBERS = "drawing_set_members";
const REVISIONS = "drawing_set_revisions";
const OWNED: readonly string[] = [SETS, MEMBERS, REVISIONS];

/** A row-level security refusal, and the key violation that proves a statement reached the table. */
const RLS_REFUSAL = "42501";
const ALREADY_HELD = "23505";

/** What the immutability belt has to say for itself: a belt nobody can read is a belt nobody trusts. */
const SAYS_APPEND_ONLY = /append-only/i;

/** The reason every read and every belt probe this file makes is recorded under. */
const REASON = "test: judge the drawing-set tables under live policy";

let scratch: ScratchDb | undefined;

afterAll(async () => {
  await scratch?.drop();
});

type Row = Record<string, string>;
type Stage = { urlMigrate: string; urlApp: string; alpha: string; beta: string; tables: Map<string, TableRef> };

let staging: Promise<Stage> | undefined;

/** Staged lazily and memoised, so a failure here fails cases rather than skipping them. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantIds = seedTenants(provisioned.urlMigrate);
    const alpha = tenantIds[TENANT_ALPHA] ?? "";
    const beta = tenantIds[TENANT_BETA] ?? "";
    expect(alpha, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    expect(beta, `the scenario seeded no ${TENANT_BETA}`).not.toBe("");

    const scoped = new Map(deriveTenantScopedTables(provisioned.urlMigrate).map((table) => [table.table, table]));
    const mine = OWNED.map((name) => scoped.get(name)).filter((table): table is TableRef => table !== undefined);
    expect(
      mine.map((table) => table.table),
      `the migrated database holds all three drawing-set tables, tenant-scoped: ${OWNED.join(", ")}`,
    ).toEqual([...OWNED]);
    // A probe row per workspace per table, parents and all, so every refusal below has something
    // real to be refused against and every control has something real to collide with.
    ensureRowsForTenants(provisioned.urlMigrate, mine, [alpha, beta]);

    return { urlMigrate: provisioned.urlMigrate, urlApp: provisioned.urlApp, alpha, beta, tables: new Map(mine.map((table) => [table.table, table])) };
  })());

/** One row of a workspace's own, read as the system — the acceptance's own audit read. */
function rowOf(stage: Stage, table: string, tenantId: string, columns: readonly string[]): Row {
  const selected = columns.map((column) => `${ident(column)}::text`).join(", ");
  const rows = run(
    stage.urlMigrate,
    withSession({ [GUC_SYSTEM_REASON]: REASON }, `select ${selected} from ${ident(table)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid limit 1;`),
  );
  expect(rows.length, `${table} holds a row for the workspace this case reads it for`).toBe(1);
  const read: Row = {};
  for (const [at, column] of columns.entries()) read[column] = (rows[0] as string[])[at] ?? "";
  return read;
}

/** One statement, offered as the app role under one workspace's scope. */
function offer(stage: Stage, scope: string, statement: string): SqlResult {
  return psql(stage.urlApp, withSession({ [GUC_TENANT]: scope }, statement));
}

/** One statement, made as the owning role under a recorded system reason. */
function asOwner(stage: Stage, statement: string): SqlResult {
  return psql(stage.urlMigrate, withSession({ [GUC_SYSTEM_REASON]: REASON }, statement));
}

/** A set offered into a workspace, naming a project of it. */
function offerSet(stage: Stage, scope: string, owner: { tenantId: string; projectId: string; createdBy: string; name: string }): SqlResult {
  return offer(
    stage,
    scope,
    `insert into ${ident(SETS)} (${ident(TENANT_COLUMN)}, project_id, name, created_by)
       values (${lit(owner.tenantId)}::uuid, ${lit(owner.projectId)}::uuid, ${lit(owner.name)}, ${lit(owner.createdBy)}::uuid);`,
  );
}

describe("a cross-workspace write is refused by policy on all three tables", () => {
  it(`as ${ROLE_APP} under ${TENANT_ALPHA}'s scope, a set naming ${TENANT_BETA} is refused`, async () => {
    const stage = await staged();
    const seeded = rowOf(stage, SETS, stage.beta, ["project_id", "created_by"]);
    const named = { tenantId: stage.beta, projectId: seeded["project_id"] ?? "", createdBy: seeded["created_by"] ?? "", name: `Tender set ${randomUUID().slice(0, 8)}` };

    // The control first: the same statement, differing only in the scope it is made under.
    const control = offerSet(stage, stage.beta, named);
    expect(control.ok, `a set named in the workspace it is scoped to is a lawful row\n${control.stderr.slice(-400)}`).toBe(true);

    const foreign = offerSet(stage, stage.alpha, { ...named, name: `${named.name} again` });
    expect(foreign.ok, "a workspace cannot name a set in another workspace").toBe(false);
    expect(foreign.sqlstate, `the refusal is the policy's, not a constraint's\n${foreign.stderr.slice(-400)}`).toBe(RLS_REFUSAL);
  });

  it(`as ${ROLE_APP} under ${TENANT_ALPHA}'s scope, a membership naming ${TENANT_BETA} is refused`, async () => {
    const stage = await staged();
    const seeded = rowOf(stage, MEMBERS, stage.beta, ["set_id", "drawing_id", "added_by"]);
    const statement = `insert into ${ident(MEMBERS)} (${ident(TENANT_COLUMN)}, set_id, drawing_id, added_by)
       values (${lit(stage.beta)}::uuid, ${lit(seeded["set_id"] ?? "")}::uuid, ${lit(seeded["drawing_id"] ?? "")}::uuid, ${lit(seeded["added_by"] ?? "")}::uuid);`;

    const foreign = offer(stage, stage.alpha, statement);
    expect(foreign.ok, "a workspace cannot put a drawing into another workspace's set").toBe(false);
    expect(foreign.sqlstate, `the policy refuses before the key does (42501 stands ahead of 23505)\n${foreign.stderr.slice(-400)}`).toBe(RLS_REFUSAL);

    // The control: the very same statement under its own scope reaches the table — it is refused by
    // the membership key, which is what proves the refusal above was the policy's doing.
    const control = offer(stage, stage.beta, statement);
    expect(control.ok, "the same membership, written twice, is one row").toBe(false);
    expect(control.sqlstate, `the statement reaches the table under its own scope\n${control.stderr.slice(-400)}`).toBe(ALREADY_HELD);
  });

  it(`as ${ROLE_APP} under ${TENANT_ALPHA}'s scope, a pinned revision naming ${TENANT_BETA} is refused`, async () => {
    const stage = await staged();
    const seeded = rowOf(stage, REVISIONS, stage.beta, ["set_id", "project_id", "digest", "manifest", "act_id"]);
    const statement = (tenantId: string): string =>
      `insert into ${ident(REVISIONS)} (${ident(TENANT_COLUMN)}, set_id, project_id, digest, manifest, act_id)
         values (${lit(tenantId)}::uuid, ${lit(seeded["set_id"] ?? "")}::uuid, ${lit(seeded["project_id"] ?? "")}::uuid, ${lit(seeded["digest"] ?? "")}, ${lit(seeded["manifest"] ?? "{}")}::json, ${lit(seeded["act_id"] ?? "")}::uuid);`;

    const control = offer(stage, stage.beta, statement(stage.beta));
    expect(control.ok, `pinning a revision of one's own set is a lawful row\n${control.stderr.slice(-400)}`).toBe(true);

    const foreign = offer(stage, stage.alpha, statement(stage.beta));
    expect(foreign.ok, "a workspace cannot pin a revision in another workspace").toBe(false);
    expect(foreign.sqlstate, `the refusal is the policy's\n${foreign.stderr.slice(-400)}`).toBe(RLS_REFUSAL);
  });
});

describe("a project names each of its sets once", () => {
  it("a second set of the same name in the same project is refused as already held", async () => {
    const stage = await staged();
    const seeded = rowOf(stage, SETS, stage.alpha, ["project_id", "created_by", "name"]);
    const twice = {
      tenantId: stage.alpha,
      projectId: seeded["project_id"] ?? "",
      createdBy: seeded["created_by"] ?? "",
      name: seeded["name"] ?? "",
    };

    const again = offerSet(stage, stage.alpha, twice);
    expect(again.ok, "a project's sets are told apart by their names, so a name it already carries names no new set").toBe(false);
    expect(again.sqlstate, `the key is what refuses it\n${again.stderr.slice(-400)}`).toBe(ALREADY_HELD);

    const elsewhere = offerSet(stage, stage.alpha, { ...twice, name: `${twice.name} ${randomUUID().slice(0, 8)}` });
    expect(elsewhere.ok, `another name in the same project is a lawful set\n${elsewhere.stderr.slice(-400)}`).toBe(true);
  });
});

describe("a set and its pinned revisions are immutable, and its membership is not", () => {
  it("an UPDATE or a DELETE by the OWNING role is refused as append-only on both ledgers", async () => {
    const stage = await staged();
    for (const table of [SETS, REVISIONS]) {
      const held = stage.tables.get(table) as TableRef;
      const where = `where ${ident(TENANT_COLUMN)} = ${lit(stage.alpha)}::uuid`;
      const rows = run(stage.urlMigrate, withSession({ [GUC_SYSTEM_REASON]: REASON }, `select count(*)::text from ${held.sql} ${where};`));
      expect(Number((rows[0] as string[])[0] ?? "0"), `${qualified(held)} holds a row of ${TENANT_ALPHA}'s — there is nothing here to try to destroy otherwise`).toBeGreaterThan(0);

      const rewritten = asOwner(stage, `update ${held.sql} set ${ident(TENANT_COLUMN)} = ${ident(TENANT_COLUMN)} ${where};`);
      expect(rewritten.ok, `${qualified(held)} is a record of something that happened, and the owner may not rewrite one (L-REG-06)`).toBe(false);
      expect(rewritten.stderr, `${qualified(held)} says why it refused\n${rewritten.stderr.slice(-400)}`).toMatch(SAYS_APPEND_ONLY);

      const removed = asOwner(stage, `delete from ${held.sql} ${where};`);
      expect(removed.ok, `${qualified(held)} may not be emptied either — what is pinned never changes afterwards`).toBe(false);
      expect(removed.stderr, `${qualified(held)} says why it refused the removal\n${removed.stderr.slice(-400)}`).toMatch(SAYS_APPEND_ONLY);
    }
  });

  it(`${ROLE_APP} may take a drawing back out of a set: membership is a draft`, async () => {
    const stage = await staged();
    const seeded = rowOf(stage, MEMBERS, stage.alpha, ["set_id", "drawing_id"]);
    const where = `where ${ident(TENANT_COLUMN)} = ${lit(stage.alpha)}::uuid and set_id = ${lit(seeded["set_id"] ?? "")}::uuid and drawing_id = ${lit(seeded["drawing_id"] ?? "")}::uuid`;

    const removed = offer(stage, stage.alpha, `delete from ${ident(MEMBERS)} ${where};`);
    expect(removed.ok, `a toggle takes a drawing out of a set at once, and nothing is derived from a draft (I-B)\n${removed.stderr.slice(-400)}`).toBe(true);
    const left = run(stage.urlMigrate, withSession({ [GUC_SYSTEM_REASON]: REASON }, `select count(*)::text from ${ident(MEMBERS)} ${where};`));
    expect(Number((left[0] as string[])[0] ?? "0"), "and the row really went").toBe(0);
  });
});

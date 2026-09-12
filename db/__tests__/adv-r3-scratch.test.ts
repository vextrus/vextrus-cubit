// ADVERSARY r3 — scratch, untracked, deleted after the run. Judges db/__tests__/support/psql-pool.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOOTSTRAP_URL } from "./support/fixtures";
import { closePsqlPool, pooledPsql, spawnPsql } from "./support/psql-pool";

const DATABASE = `adv_r3_${process.pid.toString(36)}_${Date.now().toString(36)}`;
function url(): string {
  const a = new URL(BOOTSTRAP_URL);
  a.pathname = `/${DATABASE}`;
  return a.toString();
}
beforeAll(() => {
  const made = spawnPsql(BOOTSTRAP_URL, `drop database if exists "${DATABASE}" with (force); create database "${DATABASE}";`);
  expect(made.ok, made.stderr).toBe(true);
});
afterAll(() => {
  closePsqlPool();
  spawnPsql(BOOTSTRAP_URL, `drop database if exists "${DATABASE}" with (force);`);
});

describe("A1 psql client state survives `rollback; discard all;`", () => {
  it("A1a \\connect: every later script runs on another database, and says GREEN", () => {
    closePsqlPool();
    const first = pooledPsql(url(), "\\connect postgres\nselect 1;");
    expect(first.ok).toBe(true);
    const after = pooledPsql(url(), "select current_database();");
    expect(after.ok).toBe(true);
    expect(after.rows, "the script after a \\connect must still be on the database its url names").toEqual([[DATABASE]]);
  });

  it("A1b \\o: every later script's rows vanish, and the script says GREEN", () => {
    closePsqlPool();
    expect(pooledPsql(url(), "\\o /dev/null\nselect 1;").ok).toBe(true);
    const after = pooledPsql(url(), "select count(*) from (values (1),(2)) v(x);");
    const spawned = spawnPsql(url(), "select count(*) from (values (1),(2)) v(x);");
    expect(after.ok).toBe(true);
    expect(after.rows, "rows after a \\o must be the rows a fresh process gives").toEqual(spawned.rows);
  });

  it("A1c \\pset/\\f: every later script's columns stop splitting", () => {
    closePsqlPool();
    expect(pooledPsql(url(), "\\pset fieldsep '|'\nselect 1;").ok).toBe(true);
    const after = pooledPsql(url(), "select 1, 2;");
    expect(after.rows).toEqual(spawnPsql(url(), "select 1, 2;").rows);
  });

  it("A1d \\timing: every later script grows a row that is not a row", () => {
    closePsqlPool();
    expect(pooledPsql(url(), "\\timing on\nselect 1;").ok).toBe(true);
    const after = pooledPsql(url(), "select 'only row';");
    expect(after.rows).toEqual([["only row"]]);
  });

  it("A1e \\set: a variable set by one script answers for the next, where a fresh psql refuses", () => {
    closePsqlPool();
    expect(pooledPsql(url(), "\\set leaked 42\nselect :leaked;").rows).toEqual([["42"]]);
    const after = pooledPsql(url(), "select :leaked;");
    const spawned = spawnPsql(url(), "select :leaked;");
    expect({ ok: after.ok, rows: after.rows }, "an unset psql variable is a refusal in a fresh process").toEqual({ ok: spawned.ok, rows: spawned.rows });
  });

  it("A1f \\gset: the same leak through a value the script read from the server", () => {
    closePsqlPool();
    expect(pooledPsql(url(), "select 'secret' as g \\gset\n\\echo :g").ok).toBe(true);
    const after = pooledPsql(url(), "\\echo :g");
    expect(after.rows, "a later script must not be able to read :g").toEqual(spawnPsql(url(), "\\echo :g").rows);
  });
});

describe("A2 closePsqlPool returns before the psql it killed has let the database go", () => {
  it("A2a the template a pool session was closed off can be cloned immediately", () => {
    const clone = `${DATABASE}_c`;
    const failures: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      closePsqlPool();
      expect(pooledPsql(url(), "select 1;").ok).toBe(true);
      closePsqlPool(url());
      const cloned = spawnPsql(BOOTSTRAP_URL, `create database "${clone}" template "${DATABASE}";`);
      if (!cloned.ok) failures.push(`${i}: ${cloned.sqlstate ?? "?"} ${cloned.stderr.split("\n")[0]}`);
      spawnPsql(BOOTSTRAP_URL, `drop database if exists "${clone}" with (force);`);
    }
    expect(failures, "closePsqlPool must have given the database back before it returned").toEqual([]);
  });

  it("A2b no backend of the pool's is left on the database after closePsqlPool", () => {
    closePsqlPool();
    expect(pooledPsql(url(), "select 1;").ok).toBe(true);
    closePsqlPool(url());
    const left = spawnPsql(BOOTSTRAP_URL, `select count(*) from pg_stat_activity where datname = '${DATABASE}' and pid <> pg_backend_pid();`);
    expect(left.rows, "a closed pool session is a backend that is gone").toEqual([["0"]]);
  });
});

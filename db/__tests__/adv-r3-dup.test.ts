// ADVERSARY r3 — scratch, untracked. The fallback re-runs a script that already wrote.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOOTSTRAP_URL } from "./support/fixtures";
import { closePsqlPool, pooledPsql, spawnPsql } from "./support/psql-pool";

const DATABASE = `adv_r3d_${process.pid.toString(36)}_${Date.now().toString(36)}`;
function url(): string {
  const a = new URL(BOOTSTRAP_URL);
  a.pathname = `/${DATABASE}`;
  return a.toString();
}
beforeAll(() => {
  const made = spawnPsql(BOOTSTRAP_URL, `drop database if exists "${DATABASE}" with (force); create database "${DATABASE}"; `);
  expect(made.ok, made.stderr).toBe(true);
  expect(spawnPsql(url(), "create table dup(x int); create table dup2(x int);").ok).toBe(true);
});
afterAll(() => {
  closePsqlPool();
  spawnPsql(BOOTSTRAP_URL, `drop database if exists "${DATABASE}" with (force);`);
});

// Kill the pooled psql AND its wrapper 0.4 s from now — but only when psql's parent really is the
// pool's wrapper (a bash whose command line carries ON_ERROR_STOP). Under the spawned path psql's
// parent is this node process, which is left alone.
const VANISH = [
  "\\! P=$(ps -o ppid= -p $$ | tr -d ' '); W=$(ps -o ppid= -p $P | tr -d ' '); C=$(ps -o comm= -p $W | tr -d ' '); A=$(ps -o args= -p $W);",
  'case "$C" in bash) case "$A" in *ON_ERROR_STOP*) ( sleep 0.4; kill -9 $P $W ) >/dev/null 2>&1 & ;; esac ;; esac',
].join(" ");

describe("C the fallback re-runs a script whose write already committed", () => {
  it("C1 a silent write (psql is -q) is re-run whole: the row is inserted twice", () => {
    closePsqlPool();
    expect(pooledPsql(url(), "select 'warm the session';").ok).toBe(true);
    const answered = pooledPsql(url(), `insert into dup values (1);\n${VANISH}\nselect pg_sleep(3);`);
    const rows = spawnPsql(url(), "select count(*) from dup;").rows;
    expect({ rows, note: /vanished/.test(answered.stderr) ? answered.stderr.trim().split("\n").pop() : "no fallback fired" }, "a script that vanished after committing must not be run again").toEqual({
      rows: [["1"]],
      note: "no fallback fired",
    });
  }, 120_000);

  it("C2 the same when the script had already printed — the pool knows and re-runs anyway", () => {
    closePsqlPool();
    expect(pooledPsql(url(), "select 'warm the session';").ok).toBe(true);
    const answered = pooledPsql(url(), `select 'spoken';\ninsert into dup2 values (1);\n${VANISH}\nselect pg_sleep(3);`);
    const rows = spawnPsql(url(), "select count(*) from dup2;").rows;
    expect({ rows, note: /vanished/.test(answered.stderr) ? answered.stderr.trim().split("\n").pop() : "no fallback fired" }, "a script known to have spoken mid-flight must not be run again").toEqual({
      rows: [["1"]],
      note: "no fallback fired",
    });
  }, 120_000);
});

// The pooled psql, judged against the thing it replaced (P2): one live psql per connection string,
// fed script after script, must answer EXACTLY what a fresh `spawnSync("psql", …)` answered — the
// same rows, the same `ok`, the same SQLSTATE — and must give each script a session that looks
// freshly connected (db/__tests__/support/psql-pool.ts).
//
// Raw SQL is spoken through psql here as everywhere else (SEAM-TENANT): this file drives the pool,
// which drives psql. No harness, no template, no scratch-database provisioning — the one database
// this file needs it makes and takes away itself through the spawned path, so the cases judge the
// pool and nothing else.
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOOTSTRAP_URL } from "./support/fixtures";
import { SEP, closePsqlPool, pooledPsql, psqlPoolStats, spawnPsql } from "./support/psql-pool";

/** A database of this file's own, named by the process that made it. */
const DATABASE = `cubit_psqlpool_${process.pid.toString(36)}_${Date.now().toString(36)}`;

/** Where the cases speak. */
function url(): string {
  const address = new URL(BOOTSTRAP_URL);
  address.pathname = `/${DATABASE}`;
  return address.toString();
}

/** Both paths' answer to one script, for the cases that say "the pool answers what a spawn answered". */
function both(script: string): { pooled: ReturnType<typeof pooledPsql>; spawned: ReturnType<typeof spawnPsql> } {
  return { pooled: pooledPsql(url(), script), spawned: spawnPsql(url(), script) };
}

beforeAll(() => {
  const made = spawnPsql(BOOTSTRAP_URL, `drop database if exists "${DATABASE}" with (force); create database "${DATABASE}";`);
  expect(made.ok, `this file could not make its own database:\n${made.stderr}`).toBe(true);
});

afterAll(() => {
  closePsqlPool();
  spawnPsql(BOOTSTRAP_URL, `drop database if exists "${DATABASE}" with (force);`);
});

describe("the pooled psql answers what a fresh process answered", () => {
  it("returns the same rows, ok and sqlstate for an ordinary read", () => {
    const { pooled, spawned } = both("select 1, 'two', null;");
    expect(pooled.rows).toEqual(spawned.rows);
    expect(pooled.ok).toBe(true);
    expect(spawned.ok).toBe(true);
    expect(pooled.sqlstate).toBe(null);
  });

  it("splits many columns and many rows on the same separator", () => {
    const script = "select g, 'row-' || g, g * 2 from generate_series(1, 5) g order by g;";
    const { pooled, spawned } = both(script);
    expect(pooled.rows).toEqual(spawned.rows);
    expect(pooled.rows).toHaveLength(5);
    expect(pooled.rows[0]).toEqual(["1", "row-1", "2"]);
  });

  it("reads a value that itself contains the separator byte exactly as a fresh process does", () => {
    // The separator is psql's own field separator, so a value carrying it splits in both paths
    // identically — what matters is that the pool's marker scan is not fooled by it, and that the
    // script after it still runs.
    const script = `select 'left${SEP}right'::text, 'after';`;
    const { pooled, spawned } = both(script);
    expect(pooled.rows).toEqual(spawned.rows);
    expect(pooled.rows[0]).toEqual(["left", "right", "after"]);
    expect(pooledPsql(url(), "select 'still here';").rows).toEqual([["still here"]]);
  });

  it("carries psql's own meta-commands, backslashes and dollar-quoted bodies", () => {
    const script = [
      "\\set answer 42",
      "\\echo an echo from the script",
      "select :answer;",
      "select 'a\\\\b'::text;",
      "do $$ begin perform 1; end $$;",
      "\\if false",
      "select 'never';",
      "\\endif",
      "select 'last';",
    ].join("\n");
    const { pooled, spawned } = both(script);
    expect(pooled.rows).toEqual(spawned.rows);
    expect(pooled.ok).toBe(true);
    expect(pooled.rows).toContainEqual(["an echo from the script"]);
    expect(pooled.rows).toContainEqual(["42"]);
    expect(pooled.rows).toContainEqual(["last"]);
    expect(pooled.rows).not.toContainEqual(["never"]);
  });

  it("runs a last statement that carries no semicolon, as EOF used to make it", () => {
    // 62 files write `run(url, "select 1")` with no terminator and were answered by psql's EOF.
    const { pooled, spawned } = both("select 'unterminated'");
    expect(pooled.rows, "a script with no trailing semicolon answered nothing").toEqual([["unterminated"]]);
    expect(pooled.rows).toEqual(spawned.rows);
    const made = pooledPsql(url(), "create table if not exists no_semicolon (n int)");
    expect(made.ok).toBe(true);
    expect(pooledPsql(url(), "select count(*) from no_semicolon").rows, "a statement with no terminator never reached the server").toEqual([["0"]]);
    // And a script that already ends in one is not given a second statement by it.
    expect(pooledPsql(url(), "select 'terminated';").rows).toEqual([["terminated"]]);
  });

  it("keeps a NOTICE on stderr and still calls the script good", () => {
    const script = "do $$ begin raise notice 'a notice from the script'; end $$; select 'done';";
    const { pooled, spawned } = both(script);
    expect(pooled.ok).toBe(true);
    expect(pooled.rows).toEqual(spawned.rows);
    expect(pooled.stderr).toContain("a notice from the script");
    expect(pooled.stderr).not.toContain("-S-");
  });
});

describe("ON_ERROR_STOP holds for each script on its own", () => {
  it("stops at the first error, keeps what ran before it, and runs nothing after it", () => {
    pooledPsql(url(), "drop table if exists stops; create table stops (n int);");
    const refused = pooledPsql(
      url(),
      ["insert into stops values (1);", "select 1 / 0;", "insert into stops values (2);"].join("\n"),
    );
    expect(refused.ok, "a script that divides by zero did not fail").toBe(false);
    expect(refused.sqlstate).toBe("22012");
    expect(refused.stderr).toContain("division by zero");
    // The statement ahead of the error committed; the one behind it never ran — which is what a
    // fresh psql with ON_ERROR_STOP left behind.
    expect(pooledPsql(url(), "select n from stops order by n;").rows).toEqual([["1"]]);
  });

  it("answers a refusal with the same ok and SQLSTATE a fresh process answers", () => {
    for (const script of [
      "select * from a_table_that_is_not_there;",
      "insert into stops values ('not a number');",
      "select 1; select undefined_function_xyz();",
      "\\i /nowhere/at/all.sql",
    ]) {
      const { pooled, spawned } = both(script);
      expect(pooled.ok, `pooled and spawned disagree about whether this failed:\n${script}`).toBe(spawned.ok);
      expect(pooled.sqlstate, `pooled and spawned disagree about the SQLSTATE of:\n${script}`).toBe(spawned.sqlstate);
      expect(pooled.ok).toBe(false);
    }
  });

  it("the script after a refusal runs in a working session", () => {
    expect(pooledPsql(url(), "select 1 / 0;").ok).toBe(false);
    const after = pooledPsql(url(), "select 'alive';");
    expect(after.ok).toBe(true);
    expect(after.rows).toEqual([["alive"]]);
  });

  it("survives a session the server itself ends under it", () => {
    const killed = pooledPsql(url(), "select pg_terminate_backend(pg_backend_pid());");
    expect(killed.ok, "a connection terminated under the script is not a script that succeeded").toBe(false);
    expect(pooledPsql(url(), "select 'alive';").rows).toEqual([["alive"]]);
  });
});

describe("each script gets a session that looks freshly connected", () => {
  it("does not show the next script a GUC the last one set", () => {
    const set = pooledPsql(url(), "set cubit.tenant_id = 'alpha'; select current_setting('cubit.tenant_id', true);");
    expect(set.rows).toEqual([["alpha"]]);
    // How every policy in this tree reads the scope GUCs: `nullif(current_setting(guc, true), '')`.
    // RESET ALL gives a custom GUC back its empty default rather than making the parameter
    // unrecognised again, so an out-of-scope session reads '' where a never-touched one reads NULL —
    // and the tree's own reading cannot tell those two apart, which is why the pool is admissible.
    const next = pooledPsql(url(), "select nullif(current_setting('cubit.tenant_id', true), '') is null, coalesce(nullif(current_setting('cubit.tenant_id', true), ''), '<unscoped>');");
    expect(next.rows, "a GUC set by one script was still on the session the next one ran in").toEqual([["t", "<unscoped>"]]);
  });

  it("leaves a scope GUC no wider than a fresh process does, as the policies read it", () => {
    pooledPsql(url(), "set cubit.system_reason = 'a reason'; select 1;");
    const reading = "select nullif(current_setting('cubit.system_reason', true), '') is not null;";
    const { pooled, spawned } = both(reading);
    expect(pooled.rows, "the next script was in a named system scope it never asked for").toEqual([["f"]]);
    expect(pooled.rows).toEqual(spawned.rows);
  });

  it("holds a GUC for the whole of the script that set it", () => {
    const held = pooledPsql(
      url(),
      "set cubit.system_reason = 'a reason'; select 1; select current_setting('cubit.system_reason', true);",
    );
    expect(held.rows).toEqual([["1"], ["a reason"]]);
  });

  it("does not leave a temp table, a prepared statement or an advisory lock behind", () => {
    pooledPsql(url(), "create temp table leftovers (n int); prepare left_over as select 1; select pg_advisory_lock(4242);");
    const after = pooledPsql(
      url(),
      [
        "select to_regclass('pg_temp.leftovers') is null;",
        "select count(*) = 0 from pg_prepared_statements;",
        "select count(*) = 0 from pg_locks where locktype = 'advisory';",
      ].join("\n"),
    );
    expect(after.rows, "the session the next script ran in still carried the last script's leavings").toEqual([["t"], ["t"], ["t"]]);
  });

  it("rolls back a transaction the script left open", () => {
    pooledPsql(url(), "drop table if exists open_tx; create table open_tx (n int);");
    const left = pooledPsql(url(), "begin; insert into open_tx values (1); select count(*) from open_tx;");
    expect(left.ok).toBe(true);
    expect(pooledPsql(url(), "select count(*) from open_tx;").rows, "an unclosed transaction was committed rather than rolled back").toEqual([["0"]]);
    expect(pooledPsql(url(), "select 'not in a transaction' where (select count(*) from pg_stat_activity where pid = pg_backend_pid() and state = 'idle in transaction') = 0;").rows).toEqual([
      ["not in a transaction"],
    ]);
  });

  it("keeps the session's own role, whatever the last script set it to", () => {
    pooledPsql(url(), "select 1;");
    const before = pooledPsql(url(), "select current_user;").rows[0]?.[0];
    pooledPsql(url(), "create role cubit_pool_probe nologin; set role cubit_pool_probe; select current_user;");
    expect(pooledPsql(url(), "select current_user;").rows[0]?.[0], "a SET ROLE outlived the script that set it").toBe(before);
    pooledPsql(url(), "reset role; drop role if exists cubit_pool_probe;");
  });
});

describe("one process serves the whole file", () => {
  it("runs 500 scripts in sequence through one psql, leaking neither descriptors nor processes", () => {
    // A fixed point to measure from: the sessions this file already opened, and the descriptors this
    // worker already holds.
    pooledPsql(url(), "select 1;");
    const before = psqlPoolStats();
    const descriptorsBefore = countDescriptors();
    const childrenBefore = countChildren();

    for (let n = 1; n <= 500; n += 1) {
      const answered = pooledPsql(url(), `select ${n}, 'script-${n}';`);
      expect(answered.ok, `script ${n} of 500 did not run:\n${answered.stderr}`).toBe(true);
      expect(answered.rows).toEqual([[String(n), `script-${n}`]]);
    }

    const after = psqlPoolStats();
    expect(after.sessions, "500 scripts started more than the one live psql this connection string keeps").toBe(before.sessions);
    expect(after.scripts - before.scripts, "500 scripts were not all served by the pool").toBeGreaterThanOrEqual(500);
    expect(countDescriptors() - descriptorsBefore, "the pool leaked file descriptors across 500 scripts").toBeLessThanOrEqual(2);
    expect(countChildren() - childrenBefore, "the pool left psql processes behind").toBeLessThanOrEqual(0);
  });

  it("keeps a live psql per connection string, and closes it when asked", () => {
    pooledPsql(url(), "select 1;");
    pooledPsql(BOOTSTRAP_URL, "select 1;");
    expect(psqlPoolStats().sessions).toBeGreaterThanOrEqual(2);
    closePsqlPool(BOOTSTRAP_URL);
    expect(psqlPoolStats().sessions).toBeGreaterThanOrEqual(1);
    closePsqlPool();
    expect(psqlPoolStats().sessions, "closePsqlPool() left a session open").toBe(0);
    // And the pool opens again on the next script, as a lane that drops databases between files needs.
    expect(pooledPsql(url(), "select 'reopened';").rows).toEqual([["reopened"]]);
  });

  it("runs every script through a fresh process when the pool is disarmed", () => {
    closePsqlPool();
    process.env["CUBIT_PSQL_POOL"] = "0";
    try {
      expect(pooledPsql(url(), "select 'unpooled';").rows).toEqual([["unpooled"]]);
      expect(psqlPoolStats().sessions, "CUBIT_PSQL_POOL=0 still opened a pooled session").toBe(0);
    } finally {
      delete process.env["CUBIT_PSQL_POOL"];
    }
  });
});

/** How many descriptors this worker holds — the leak a long-lived process would show first. */
function countDescriptors(): number {
  try {
    return readdirSync(`/proc/${process.pid}/fd`).length;
  } catch {
    return 0;
  }
}

/** How many processes this worker is the direct parent of — its pooled psql wrappers and nothing else. */
function countChildren(): number {
  let found = 0;
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      if (fields[1] === String(process.pid)) found += 1;
    } catch {
      /* it went away while we were reading it */
    }
  }
  return found;
}

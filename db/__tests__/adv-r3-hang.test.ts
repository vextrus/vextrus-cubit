// ADVERSARY r3 — scratch, untracked. The marker swallowed by an unterminated construct.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOOTSTRAP_URL } from "./support/fixtures";
import { closePsqlPool, pooledPsql, spawnPsql } from "./support/psql-pool";

const DATABASE = `adv_r3h_${process.pid.toString(36)}_${Date.now().toString(36)}`;
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

/** How long the pool takes to answer a script a fresh process refuses at once. */
function cost(script: string): { ms: number; ok: boolean } {
  closePsqlPool();
  const at = Date.now();
  const result = pooledPsql(url(), script);
  return { ms: Date.now() - at, ok: result.ok };
}

describe("B a construct left open swallows the pool's own marker", () => {
  it("B1 \\if left open: the next script is skipped whole, marker and all", () => {
    closePsqlPool();
    const opener = pooledPsql(url(), "\\if false\nselect 'skipped';");
    const at = Date.now();
    const next = pooledPsql(url(), "select 'the next script';");
    const ms = Date.now() - at;
    expect({ ok: next.ok, rows: next.rows, slow: ms > 30_000 }, `opener ok=${opener.ok}`).toEqual({ ok: true, rows: [["the next script"]], slow: false });
  }, 400_000);

  it("B2 an unterminated block comment: a fresh psql refuses at once, the pool waits out its timeout", () => {
    const spawned = spawnPsql(url(), "select 1 /* never closed");
    const pooled = cost("select 1 /* never closed");
    expect({ ok: pooled.ok, slow: pooled.ms > 30_000 }, `a fresh process answered ok=${spawned.ok} at once`).toEqual({ ok: spawned.ok, slow: false });
  }, 400_000);

  it("B3 copy from stdin without a terminator: the fifo feeds the marker to COPY", () => {
    closePsqlPool();
    expect(spawnPsql(url(), "create table if not exists adv_copy(x text);").ok).toBe(true);
    const at = Date.now();
    const pooled = pooledPsql(url(), "copy adv_copy from stdin;\nalpha\nbeta");
    const ms = Date.now() - at;
    const landed = spawnPsql(url(), "select x from adv_copy order by x;");
    expect({ slow: ms > 30_000, rows: landed.rows }, `pooled ok=${pooled.ok}`).toEqual({ slow: false, rows: [["alpha"], ["beta"]] });
  }, 400_000);
});

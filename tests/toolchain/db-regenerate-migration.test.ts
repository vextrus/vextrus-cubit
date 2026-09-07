// scripts/db-regenerate-migration.mjs — the builder engine's integration door for the migration
// chain (v19 L2): the branch's migration and snapshot are discarded, main's chain restored, one
// migration regenerated on the COMBINED schema, and the numbering checked. Exercised end to end on
// a scratch repository with the real drizzle-kit: two branches that each generated 0001 from one
// fork point, merged, then regenerated — the collision drizzle-orm issue 5774 lets through silently.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const SCRIPT = join(REPO_ROOT, "scripts", "db-regenerate-migration.mjs");
const root = mkdtempSync(join(tmpdir(), "cubit-regen-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const git = (...a: string[]): string => execFileSync("git", a, { cwd: root, encoding: "utf8" });
const schema = (tables: string[]): string =>
  [`import { pgTable, text } from "drizzle-orm/pg-core";`, ...tables.map((t) => `export const ${t} = pgTable("${t}", { id: text("id").primaryKey() });`), ""].join("\n");
const generate = (name: string): void => {
  const r = spawnSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "generate", "--dialect", "postgresql", "--schema", "./db/schema.ts", "--out", "db/migrations", "--name", name], { cwd: root, encoding: "utf8", input: "" });
  expect(r.status, r.stderr).toBe(0);
  expect(r.stderr.trim()).toBe("");
};
const sql = (): string[] => readdirSync(join(root, "db", "migrations")).filter((f) => f.endsWith(".sql")).sort();
const journal = (): { idx: number; tag: string }[] => (JSON.parse(readFileSync(join(root, "db", "migrations", "meta", "_journal.json"), "utf8")) as { entries: { idx: number; tag: string }[] }).entries;

describe("db-regenerate-migration: the branch's migration is regenerated on the combined schema at integration", () => {
  test("two branches that each generated 0001 from one base, merged: the branch's is discarded, main's kept, one 0002 regenerated, the chain consistent and drift-free", () => {
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@t");
    git("config", "user.name", "t");
    symlinkSync(join(REPO_ROOT, "node_modules"), join(root, "node_modules"), "dir");
    mkdirSync(join(root, "db"), { recursive: true });
    writeFileSync(join(root, ".gitignore"), "node_modules\n");
    writeFileSync(join(root, "db", "schema.ts"), schema(["base"]));
    generate("base");
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    expect(sql()).toEqual(["0000_base.sql"]);

    // Branch A: table a, migration 0001_a generated on the base.
    git("checkout", "-q", "-b", "inc/M2/inc-a");
    writeFileSync(join(root, "db", "schema.ts"), schema(["base", "a"]));
    generate("a");
    git("add", "-A");
    git("commit", "-q", "-m", "a");
    expect(sql()).toEqual(["0000_base.sql", "0001_a.sql"]);
    const aSnapshot = readFileSync(join(root, "db", "migrations", "meta", "0001_snapshot.json"), "utf8");

    // main: table b, migration 0001_b generated on the same base — the collision.
    git("checkout", "-q", "main");
    writeFileSync(join(root, "db", "schema.ts"), schema(["base", "b"]));
    generate("b");
    git("add", "-A");
    git("commit", "-q", "-m", "b");
    expect(sql()).toEqual(["0000_base.sql", "0001_b.sql"]);

    // The branch brings main in. The schema, the journal and the 0001 snapshot all conflict; the
    // engine merges the registries by code and the Integrator the schema — here by hand: the
    // combined schema, main's snapshot, both journal entries (the append-merge's answer).
    git("checkout", "-q", "inc/M2/inc-a");
    const merge = spawnSync("git", ["merge", "--no-edit", "--no-ff", "main"], { cwd: root, encoding: "utf8" });
    expect(merge.status).not.toBe(0);
    writeFileSync(join(root, "db", "schema.ts"), schema(["base", "a", "b"]));
    git("checkout", "main", "--", "db/migrations/meta/0001_snapshot.json");
    const ours = JSON.parse(git("show", ":2:db/migrations/meta/_journal.json")) as { entries: { idx: number; tag: string }[] };
    const theirs = JSON.parse(git("show", ":3:db/migrations/meta/_journal.json")) as { entries: { idx: number; tag: string }[] };
    writeFileSync(join(root, "db", "migrations", "meta", "_journal.json"), JSON.stringify({ ...ours, entries: [...ours.entries, ...theirs.entries.slice(ours.entries.length - 1)] }, null, 2));
    git("add", "-A");
    git("commit", "-q", "-m", "merge main");
    expect(sql()).toEqual(["0000_base.sql", "0001_a.sql", "0001_b.sql"]); // the tree drizzle-kit would silently build on
    expect(readFileSync(join(root, "db", "migrations", "meta", "0001_snapshot.json"), "utf8")).not.toBe(aSnapshot);

    // The door.
    const r = spawnSync(process.execPath, [SCRIPT, "--name", "a", "--base", "main", "--root", root], { cwd: root, encoding: "utf8" });
    expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
    // The branch ADDED 0001_a.sql (discarded); its 0001_snapshot.json was a modification of main's, restored to main's.
    expect(r.stdout).toContain("regenerated 0002_a on the combined schema (discarded 0001_a.sql)");
    expect(sql()).toEqual(["0000_base.sql", "0001_b.sql", "0002_a.sql"]);
    expect(journal().map((e) => [e.idx, e.tag])).toEqual([
      [0, "0000_base"],
      [1, "0001_b"],
      [2, "0002_a"],
    ]);
    expect(existsSync(join(root, "db", "migrations", "meta", "0002_snapshot.json"))).toBe(true);
    const ddl = readFileSync(join(root, "db", "migrations", "0002_a.sql"), "utf8");
    expect(ddl).toMatch(/CREATE TABLE "a"/);
    expect(ddl).not.toMatch(/CREATE TABLE "b"/); // main's table is main's migration's
    // No drift: a generate seeded with the tree's chain writes nothing.
    const scratch = mkdtempSync(join(tmpdir(), "cubit-regen-drift-"));
    try {
      mkdirSync(join(scratch, "meta"), { recursive: true });
      for (const f of readdirSync(join(root, "db", "migrations", "meta"))) writeFileSync(join(scratch, "meta", f), readFileSync(join(root, "db", "migrations", "meta", f)));
      const drift = spawnSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "generate", "--dialect", "postgresql", "--schema", "./db/schema.ts", "--out", scratch], { cwd: root, encoding: "utf8", input: "" });
      expect(drift.status).toBe(0);
      expect(readdirSync(scratch).filter((f) => f.endsWith(".sql"))).toEqual([]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
    // Committed, then run again: the same answer — the branch's one migration is discarded and
    // regenerated as the same 0002 on the same combined schema (the caller commits once per door).
    git("add", "-A");
    git("commit", "-q", "-m", "regenerated at the door");
    const again = spawnSync(process.execPath, [SCRIPT, "--name", "a", "--base", "main", "--root", root], { cwd: root, encoding: "utf8" });
    expect(again.status, again.stdout).toBe(0);
    expect(again.stdout).toContain("regenerated 0002_a on the combined schema (discarded 0002_a.sql, meta/0002_snapshot.json)");
    expect(sql()).toEqual(["0000_base.sql", "0001_b.sql", "0002_a.sql"]);
    expect(journal().map((e) => e.tag)).toEqual(["0000_base", "0001_b", "0002_a"]);
    git("checkout", "--", ".");
    git("clean", "-fdq", "--", "db");
  }, 120_000);

  test("a branch that added two migrations is refused: a branch carries at most one, generated on its base", () => {
    // Still on the merged branch from the test above: add a second file by hand.
    writeFileSync(join(root, "db", "migrations", "0003_extra.sql"), "-- extra\n");
    writeFileSync(join(root, "db", "migrations", "0004_extra2.sql"), "-- extra\n");
    git("add", "-A");
    git("commit", "-q", "-m", "two by hand");
    const r = spawnSync(process.execPath, [SCRIPT, "--name", "x", "--base", "main", "--root", root], { cwd: root, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("a branch carries at most ONE migration generated on its base");
  });
});

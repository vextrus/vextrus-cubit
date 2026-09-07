#!/usr/bin/env node
// Regenerate this branch's migration on the combined schema at integration (v19 L2 of the builder
// engine; the endorsed drizzle-kit workflow for cross-branch migrations: discard the branch's
// migration, regenerate one on top). Two lanes that each generated `00NN_<name>.sql` from the same
// fork point collide on NN the moment one merges: drizzle-kit numbers from the journal alone and
// overwrites a same-numbered snapshot without a word (drizzle-orm issue 5774). So, on the branch AFTER
// main has been merged in:
//
//   1. every migration file and snapshot this branch ADDED relative to `--base` (main) is removed;
//   2. `db/migrations/meta/` is restored to main's (the journal and the snapshot chain as landed);
//   3. drizzle-kit generates ONE migration from the combined `db/schema.ts` with `--name <name>`;
//   4. the result is checked: exactly one new .sql, its number is max(disk, journal) + 1, the
//      journal's last entry names it, its snapshot exists — else exit non-zero with the reason.
//
// Nothing is committed; the caller commits. `pnpm db:drift --scratch` and `pnpm test:db` (a
// from-zero migrate on a fresh database) prove the chain afterwards. Read-only on the schema.
//
//   node scripts/db-regenerate-migration.mjs --name <slug> [--base main] [--root <dir>]
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
/** @param {string} k @param {string} d */
const opt = (k, d) => (args.indexOf(k) >= 0 ? (args[args.indexOf(k) + 1] ?? d) : d);
const ROOT = resolve(opt("--root", resolve(fileURLToPath(new URL("../", import.meta.url)))));
const BASE = opt("--base", "main");
const NAME = String(opt("--name", "") ?? "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
const MIGRATIONS = "db/migrations";
const META = `${MIGRATIONS}/meta`;
const JOURNAL = `${META}/_journal.json`;
const SCHEMA = "db/schema.ts";

/** @param {string} msg @returns {never} */
const fail = (msg) => {
  process.stdout.write(`db:regenerate-migration FAIL — ${msg}\n`);
  process.exit(1);
};
/** @param {string[]} a */
const git = (a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" });
/** @param {string} f @returns {number | null} */
const numberOf = (f) => {
  const m = /^(\d{4})_/.exec(f);
  return m ? Number(m[1]) : null;
};
const sqlOnDisk = () => (existsSync(join(ROOT, MIGRATIONS)) ? readdirSync(join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql")) : []);
/** @returns {{ entries: { idx: number; tag: string }[] }} */
const journal = () => JSON.parse(readFileSync(join(ROOT, JOURNAL), "utf8"));

if (!NAME) fail("--name <slug> is required (the migration file name)");
if (!existsSync(join(ROOT, SCHEMA))) fail(`${SCHEMA} is not in the tree`);
if (!existsSync(join(ROOT, JOURNAL))) fail(`${JOURNAL} is not in the tree`);
let baseRef;
try {
  baseRef = git(["rev-parse", "--verify", `${BASE}^{commit}`]).trim();
} catch {
  fail(`--base ${BASE} is not a commit`);
}

// 1. What this branch added under db/migrations relative to the base (files main does not have).
const added = git(["diff", "--name-only", "--diff-filter=A", `${baseRef}...HEAD`, "--", MIGRATIONS])
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);
const addedSql = added.filter((f) => f.endsWith(".sql"));
if (addedSql.length > 1) fail(`this branch added ${addedSql.length} migrations (${addedSql.join(", ")}) — a branch carries at most ONE migration generated on its base`);
const discarded = added.map((f) => f.replace(`${MIGRATIONS}/`, ""));
for (const f of added) rmSync(join(ROOT, f), { force: true });

// 2. main's journal and snapshot chain, as landed.
try {
  git(["checkout", baseRef, "--", META]);
} catch (e) {
  fail(`could not restore ${META} from ${BASE}: ${String(e).slice(0, 200)}`);
}
// Anything under meta/ that main does not have is the branch's (an untracked leftover): gone.
const baseMeta = new Set(
  git(["ls-tree", "-r", "--name-only", baseRef, "--", META])
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((f) => f.replace(`${META}/`, "")),
);
for (const f of readdirSync(join(ROOT, META))) if (!baseMeta.has(f)) rmSync(join(ROOT, META, f), { force: true });

const before = sqlOnDisk();
const diskMax = Math.max(-1, ...before.map(numberOf).filter((n) => n !== null).map(Number));
const journalMax = Math.max(-1, ...journal().entries.map((e) => Number(e.idx)));
const expected = Math.max(diskMax, journalMax) + 1;
if (diskMax !== journalMax) fail(`after restoring ${BASE}'s chain the disk (max ${diskMax}) and the journal (max ${journalMax}) disagree — the base itself is inconsistent; run the migrations lane test on ${BASE}`);

// 3. One migration on the combined schema. CLI mode (--out) never reads drizzle.config.ts, so the
// dialect and the schema are passed beside it (the same reading scripts/db-drift.mjs takes).
const gen = spawnSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "generate", "--dialect", "postgresql", "--schema", `./${SCHEMA}`, "--out", MIGRATIONS, "--name", NAME], { cwd: ROOT, encoding: "utf8", input: "" });
const diagnostics = `${gen.stderr ?? ""}`.trim();
if (gen.status !== 0 || diagnostics) fail(`drizzle-kit generate did not complete (exit ${gen.status}): ${diagnostics || (gen.stdout ?? "").slice(-400)}`);

// 4. Exactly one new file, numbered max(disk, journal) + 1, journalled last, with its snapshot.
const after = sqlOnDisk();
const fresh = after.filter((f) => !before.includes(f));
if (fresh.length === 0) {
  // The combined schema needs no DDL beyond main's: the branch's migration was redundant. Say so; the caller judges.
  process.stdout.write(`db:regenerate-migration — no migration needed on the combined schema (${discarded.length ? `discarded ${discarded.join(", ")}` : "the branch added none"})\n`);
  process.exit(0);
}
const first = fresh[0];
if (fresh.length > 1 || first === undefined) fail(`drizzle-kit wrote ${fresh.length} files (${fresh.join(", ")}); expected one`);
const tag = first.replace(/\.sql$/, "");
const n = numberOf(first);
if (n !== expected) fail(`the new migration is numbered ${n}; max(disk ${diskMax}, journal ${journalMax}) + 1 = ${expected} (a collision or a gap — drizzle-orm issue 5774's class)`);
const last = journal().entries.at(-1);
if (!last || last.tag !== tag || Number(last.idx) !== n) fail(`the journal's last entry is ${last ? `${last.idx} ${last.tag}` : "missing"}, not ${n} ${tag}`);
if (!existsSync(join(ROOT, META, `${String(n).padStart(4, "0")}_snapshot.json`))) fail(`no snapshot for ${tag} under ${META}`);
process.stdout.write(`db:regenerate-migration — regenerated ${tag} on the combined schema${discarded.length ? ` (discarded ${discarded.join(", ")})` : ""}\n`);

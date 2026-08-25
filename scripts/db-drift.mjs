#!/usr/bin/env node
// Schema drift (V-VERIFY). With `--scratch` it generates into a throwaway directory outside the
// tree and fails if drizzle-kit would have written a migration — the schema and the committed
// migrations disagree — leaving the tree untouched. Without it, it checks the committed migration
// set for collisions. Its status is derived from the schema root (ARCH-02); with no schema in the
// tree it records its skip (B-23).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveStage, INPUT_ROOTS } from "./lib/lanes.mjs";
import { announce, run, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const scratchMode = process.argv.slice(2).includes("--scratch");

const startedAt = performance.now();
const stage = deriveStage(ROOT, "db:drift");

// The lane reads the schema and the migration set from the one roster that owns those paths
// (ARCH-02) rather than repeating them here.
const schemaRoot = INPUT_ROOTS["dbSchema"];
const migrationsRoot = INPUT_ROOTS["dbMigrations"];
if (schemaRoot === undefined || migrationsRoot === undefined) {
  throw new Error("INPUT_ROOTS no longer names dbSchema and dbMigrations, which this lane generates against");
}
const laneName = scratchMode ? "schema-drift" : "db:drift";

/**
 * One drizzle-kit generate into `out`, with its output captured rather than inherited: the tool
 * exits 0 over its own failures, so its exit status alone cannot tell "no drift" from "did not
 * run", and what it wrote to stderr is the only place the difference shows. A clean run says
 * nothing there. `--out` puts drizzle-kit in CLI mode, where drizzle.config.ts is never read:
 * dialect and schema must be passed alongside it, and the out path must be relative to `cwd` or the
 * journal is resolved against the wrong root and the run silently compares nothing.
 * @param {string} out a directory, created if it is not there yet
 * @returns {{ failed: boolean; diagnostics: string }}
 */
function generate(out) {
  mkdirSync(out, { recursive: true });
  const result = spawnSync(
    process.execPath,
    ["node_modules/drizzle-kit/bin.cjs", "generate", "--dialect", "postgresql", "--schema", `./${schemaRoot}`, "--out", relative(ROOT, out)],
    { cwd: ROOT, encoding: "utf8", input: "" },
  );
  const diagnostics = `${result.stderr ?? ""}${result.error === undefined ? "" : `\n${String(result.error)}`}`.trim();
  return { failed: result.status !== 0 || result.signal !== null || diagnostics !== "", diagnostics: diagnostics === "" ? "" : `${diagnostics}\n` };
}

// In `--scratch` form this script *is* the verify chain's schema-drift lane, and the chain owns
// that lane's roster line and its wall time — the delegated form prints neither, in either
// direction, so exactly one line per lane exists (C-06's stdout contract). Standalone, without
// `--scratch`, it owns its own line.
if (scratchMode && stage.status === "stub") process.exit(0);

let failed = 0;
if (scratchMode || announce(stage)) {
  if (!scratchMode) {
    failed = run(["node", "node_modules/drizzle-kit/bin.cjs", "check"], { cwd: ROOT });
  } else {
    const scratch = mkdtempSync(join(tmpdir(), "cubit-drift-"));
    try {
      // A control first, into an empty directory: with no journal every table reads as new, so a
      // drizzle-kit that read the schema must write DDL for it. Nothing written here means nothing
      // was compared in the run below either, and "no drift" would be a report about a comparison
      // that never happened (B-05).
      const control = generate(join(scratch, "control"));
      const proof = readdirSync(join(scratch, "control")).filter((entry) => entry.endsWith(".sql"));
      if (control.failed || proof.length === 0) {
        process.stdout.write(`schema drift: drizzle-kit could not generate from ./${schemaRoot} at all, so nothing was compared against the committed migrations\n${control.diagnostics}`);
        failed = 1;
      }

      // The comparison drizzle-kit makes is schema-vs-journal, so this directory carries the
      // committed migration state: without meta/_journal.json every table reads as new and a pure
      // tree reports drift. With no migrations committed yet the unseeded run is the right answer —
      // a schema and no DDL to match it *is* drift.
      const against = join(scratch, "committed");
      mkdirSync(against, { recursive: true });
      const committedMeta = join(ROOT, migrationsRoot, "meta");
      if (existsSync(committedMeta)) cpSync(committedMeta, join(against, "meta"), { recursive: true });
      const compared = generate(against);
      const written = readdirSync(against).filter((entry) => entry.endsWith(".sql"));
      if (compared.failed) {
        // drizzle-kit 0.31.10 exits 0 over its own failures — an unloadable schema, or a rename it
        // wanted to ask about and could not. A run that ended in a diagnostic wrote no .sql for the
        // same reason it wrote no migration: it never got as far as comparing.
        process.stdout.write(`schema drift: drizzle-kit did not complete its comparison against the committed migrations\n${compared.diagnostics}`);
        failed = 1;
      } else if (written.length > 0) {
        process.stdout.write(`schema drift: drizzle-kit would write ${written.join(", ")} — the schema and the committed migrations disagree\n`);
        failed = 1;
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  if (failed !== 0) process.stdout.write(`FAIL ${laneName} exit=${failed}\n`);
}

if (!scratchMode) process.stdout.write(`${laneName} wall-time ${wallTime(startedAt)}\n`);
process.exit(failed);

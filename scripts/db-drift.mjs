#!/usr/bin/env node
// Schema drift (V-VERIFY). With `--scratch` it generates into a throwaway directory outside the
// tree and fails if drizzle-kit would have written a migration — the schema and the committed
// migrations disagree — leaving the tree untouched. Without it, it checks the committed migration
// set for collisions. Its status is derived from the schema root (ARCH-02); with no schema in the
// tree it records its skip (B-23).
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveStage } from "./lib/lanes.mjs";
import { announce, run, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const scratchMode = process.argv.slice(2).includes("--scratch");

const startedAt = performance.now();
const stage = deriveStage(ROOT, "db:drift");
const laneName = scratchMode ? "schema-drift" : "db:drift";

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
      failed = run(["node", "node_modules/drizzle-kit/bin.cjs", "generate", "--out", scratch], { cwd: ROOT });
      const written = readdirSync(scratch).filter((entry) => entry.endsWith(".sql"));
      if (failed === 0 && written.length > 0) {
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

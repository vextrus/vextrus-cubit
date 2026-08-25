// Breaker acceptance for AC-2's second half: "the schema-drift stage inside pnpm verify reports no
// drift". A stage that reports no drift is only worth the name if it can tell no-drift apart from
// did-not-run. `scripts/db-drift.mjs --scratch` decides by reading the scratch directory for a
// written .sql — so every way drizzle-kit can fail without writing one reads to the lane as a pure
// tree, and `pnpm verify` goes green over a schema that does not match the committed migrations.
//
// Two live triggers are proven here, both real drift, both currently green:
//   1. a renamed column — drizzle-kit 0.31.10 resolves renames interactively, and with the piped
//      stdin every runner gives it, its prompt renderer throws and the process still exits 0;
//   2. a schema file drizzle-kit cannot load — it reports a TransformError and exits 0.
//
// B-05: a guardrail that cannot fail is prose, not enforcement. This file asserts only the
// observable AC-2 names, in the negative: on a tree whose schema has drifted, the lane must not
// report success. It says nothing about which drizzle-kit incantation gets there.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const DRIFT_LANE = join(ROOT, "scripts", "db-drift.mjs");

/** The files this file edits and puts back — read once, so a restore is never a re-read of a mutation. */
const SEAM = join(ROOT, "src", "core", "db.ts");
const BARREL = join(ROOT, "db", "schema.ts");
const ORIGINAL = new Map<string, string>([
  [SEAM, readFileSync(SEAM, "utf8")],
  [BARREL, readFileSync(BARREL, "utf8")],
]);

/** Put every touched file back exactly as the tree committed it, whatever happened in between. */
function restore(): void {
  for (const [path, text] of ORIGINAL) {
    if (readFileSync(path, "utf8") !== text) writeFileSync(path, text);
  }
}

afterEach(restore);
process.on("exit", restore);

/** What `pnpm verify`'s schema-drift stage is: the same script, the same flag, the same cwd. */
function schemaDriftStage(): { status: number | null; output: string } {
  const lane = spawnSync(process.execPath, [DRIFT_LANE, "--scratch"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 300_000,
    // Piped, exactly as a runner or CI gives it: nothing can answer an interactive prompt.
    stdio: ["pipe", "pipe", "pipe"],
  });
  // Flattened: the lane's output can carry a foreign stack trace, and a failure message that looks
  // like one sends the runner's source-map reader chasing frames that are not this test's.
  const output = `${lane.stdout ?? ""}${lane.stderr ?? ""}`.replace(/\s+/g, " ").trim();
  return { status: lane.status, output };
}

/** A control: on the tree as committed, the lane passes. Without this, "it fails" proves nothing. */
function laneIsGreenOnAPureTree(): void {
  const pure = schemaDriftStage();
  expect(pure.status, `the schema-drift lane must pass on the committed tree before a drifted one means anything\n${pure.output.slice(-800)}`).toBe(0);
}

describe("AC-2 (breaker): the schema-drift lane must not report a pure tree when it never compared one", () => {
  it("AC-2: a renamed column is drift, and the lane must not exit 0 over it", () => {
    laneIsGreenOnAPureTree();

    const seam = ORIGINAL.get(SEAM) ?? "";
    const renamed = seam.replace('text("name")', 'text("title")');
    expect(renamed, "src/core/db.ts no longer declares tenants.name as text(\"name\") — this probe must be re-aimed at whatever column it declares").not.toBe(seam);
    writeFileSync(SEAM, renamed);

    const drifted = schemaDriftStage();
    expect(
      drifted.status,
      `tenants.name was renamed to tenants.title in the schema and no committed migration renames it — that is drift, and the schema-drift stage inside pnpm verify reported none (AC-2, B-05: a check that cannot fail is not a check)\n${drifted.output.slice(-1200)}`,
    ).not.toBe(0);
  }, 300_000);

  it("AC-2: a schema drizzle-kit cannot load is not a pure tree, and the lane must not exit 0 over it", () => {
    const barrel = ORIGINAL.get(BARREL) ?? "";
    writeFileSync(BARREL, `${barrel}\nthis is not typescript {{{\n`);

    const broken = schemaDriftStage();
    expect(
      broken.status,
      `db/schema.ts could not be loaded, so nothing was compared against the committed migrations — the schema-drift stage must not answer that as "no drift" (AC-2, B-05)\n${broken.output.slice(-1200)}`,
    ).not.toBe(0);
  }, 300_000);
});

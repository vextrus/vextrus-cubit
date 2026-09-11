// The database lane's config (V-DB): every suite in the tree that needs a live cluster, and nothing
// else. Its include is derived from the tree's own import graph — whatever reaches
// db/__tests__/harness.ts, whether it lives under `db/` or beside the module it judges — so the unit
// lane and this one partition the suites between them with no list to keep and no file in both
// (ARCH-02, B-19). It arms the lane the roster already derives from db/__tests__ (scripts/lib/lanes.mjs).
//
// It is wired in by package.json's test:db script: `node scripts/db-test.mjs --config db/__tests__/vitest.config.ts`.
// The runner passes no `--dir`: these globs are the checkout root's, because half of them are.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { laneSplit } from "../../scripts/lib/pg-suites.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const { database } = laneSplit(ROOT);

export default defineConfig({
  // The product spells its own layers through tsconfig's `@/` alias (ARCH-01), so this lane
  // resolves it too — an absolute path, because the lane runs against `--dir db`.
  root: ROOT,
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  // A suite that renders a component is collected here too when it opens a database; tsconfig keeps
  // `jsx: preserve` because Next compiles the app, so this lane is told the runtime like the other.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: database,
    exclude: ["node_modules/**"],
    // Live Postgres work: every file provisions its own scratch database (named by pid, millisecond
    // and a counter) by COPYING the run's one migrated template (db/__tests__/harness.ts), so the
    // files run many at a time; the one shared surface — the seam the schema-drift lane reads and
    // drift-lane-breaker mutates — is serialised by support/drift-lock.ts.
    //
    // Measured 2026-09-05: 135 s in series → about 45 s at four workers. Measured 2026-09-11, with
    // 41 migrations per file replaced by one template copy: 162 s → 87 s at four workers, 71 s at
    // eight, 113 s at twelve. Eight is the measured knee on the 24-core box the gate runs on, and it
    // is deliberately under half of it: at most two product suites share the machine (v22 Wave A).
    fileParallelism: true,
    maxWorkers: 8,
    testTimeout: 120_000,
    hookTimeout: 240_000,
  },
});

// The database lane's config (V-DB): every suite in the tree that needs a live cluster, and nothing
// else. Its include is derived from the tree's own import graph — whatever reaches the live-database
// seeds, whether it lives under `db/` or beside the module it judges — PLUS every suite under
// db/__tests__ unconditionally, because a suite its author put in this lane's own directory is this
// lane's however few imports it has. So the unit lane and this one partition the suites between them
// with no list to keep, no file in both and none in neither (ARCH-02, B-19); the partition is proved
// against the two runners' own collections in tests/toolchain/test-lane-split.test.ts. It arms the lane the roster already derives from db/__tests__ (scripts/lib/lanes.mjs).
//
// It is wired in by package.json's test:db script: `node scripts/db-test.mjs --config db/__tests__/vitest.config.ts`.
// The runner passes no `--dir`: these globs are the checkout root's, because half of them are.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { DB_LANE_KNEE, laneWorkers } from "../../scripts/lib/box.mjs";
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
    // eight, 113 s at twelve. Eight is the measured knee on the 24-core box the gate runs on — and it
    // is the knee for a lane that HAS that box. When the engine says a second product suite is
    // running beside this one (CUBIT_VERIFY_SLOTS=2) the cap halves with it, because half a box is
    // not the box (scripts/lib/box.mjs).
    fileParallelism: true,
    maxWorkers: laneWorkers(DB_LANE_KNEE),
    testTimeout: 120_000,
    hookTimeout: 240_000,
  },
});

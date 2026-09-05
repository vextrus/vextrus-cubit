// The database lane's config (V-DB). `pnpm test:db` runs `vitest run --dir db`, and vitest resolves
// its include globs against `--dir` — so the root config's `tests/**` patterns can never collect a
// suite that lives under `db/`. This config is the one that can: its globs are relative to the same
// `--dir`, and it arms the lane the roster already derives from db/__tests__ (scripts/lib/lanes.mjs).
//
// It is wired in by package.json's test:db script: `node scripts/db-test.mjs --config db/__tests__/vitest.config.ts`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**"],
    // Live Postgres work: every file provisions its own scratch database (named by pid and
    // millisecond), so the files run four at a time; the one shared surface — the seam the
    // schema-drift lane reads and drift-lane-breaker mutates — is serialised by support/drift-lock.ts.
    // Measured 2026-09-05: 135 s in series → about 45 s at four workers.
    fileParallelism: true,
    maxWorkers: 4,
    testTimeout: 120_000,
    hookTimeout: 240_000,
  },
});

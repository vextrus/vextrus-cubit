// The unit lane's config (V-VERIFY). The default environment stays node — the tier under test is a
// server tier; the few suites that render a component ask for jsdom with a `@vitest-environment`
// docblock, so nothing pretends to be a browser that is not one. The lint fixture corpus is
// deliberate payload, not a suite, and the journeys belong to Playwright — both stay out.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
// Which suites need a live cluster is derived from the tree's own import graph, in one home
// (ARCH-02); this lane is the one that must run without one.
import { forksPoolSuites, laneSplit } from "./scripts/lib/pg-suites.mjs";

const { database } = laneSplit(fileURLToPath(new URL("./", import.meta.url)));

// A suite may sit in `src/**/__tests__/` or directly beside the module it judges — R-UI-001 puts the
// generated stylesheet's drift test next to `src/ui/tokens.ts`. Both shapes collect.
const INCLUDE = ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"];
// The unit lane is PURE: it opens no database, so it passes with DATABASE_URL unset and a cluster that
// is not running (v22 Wave A). Every suite that reaches the live-database seeds is collected by the
// database lane instead (derived; the partition is proved in tests/toolchain/test-lane-split.test.ts).
// The golden lane's own suites (tests/golden/vitest.config.ts) run there — in verify's golden lane and the
// gate's `pnpm test:golden` — and not here as well: R0-REC's corpus proof ingests the DXF three times
// (~10 s), and the unit lane had been running every one of them a second time in the same verify.
const GOLDEN_LANE = ["tests/golden/**", "tests/rcc6/**"];
const EXCLUDE = ["node_modules/**", "tests/e2e/**", "tests/lint-fixtures/**", ...GOLDEN_LANE, ...database];

/**
 * The files that run in a process of their own (the `forks` pool) rather than in a VM context.
 *
 * The unit lane runs on `vmForks`: each file still gets a fresh module graph — a VM context of its
 * own — but in a worker that lives across files, so the lane stops paying a process spawn and a
 * cold Node start per file (658 of them). Measured on the 24-thread box (session 9): the lane alone
 * 56 s and ~1,000 CPU-s under `forks`, ~32 s and ~570 CPU-s under `vmForks`; that CPU is what the
 * lanes gating beside it in verify were queued behind (V-VERIFY).
 *
 * A VM worker shares the process and Node's built-ins across the files it runs, so three families
 * run on `forks` instead — DERIVED from the tree's import graph, never listed (scripts/lib/pg-suites.mjs
 * `forksPoolSuites`, beside the database lane's split): every suite that reaches `@playwright/test`
 * (it refuses a second load in one process, and patches the process's `cwd`/`chdir` with wrappers
 * bound to the context that loaded it — measured as intermittent `process is not defined` in other
 * files) or `eslint` (its flat-config loader imports by URL, which a VM context's linker refuses), and
 * every suite that `vi.mock`s a Node built-in (the mock reaches the next file's loads).
 *
 * Vitest runs the two pools one after the other, so the forks project is the lane's tail.
 */
export const FORKS_POOL: readonly string[] = forksPoolSuites(fileURLToPath(new URL("./", import.meta.url)));

// The product spells its own layers through tsconfig's `@/` alias (ARCH-01); tsconfig keeps
// `jsx: preserve` because Next compiles the app, so the test transform is told the runtime here.
const shared = {
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  oxc: { jsx: { runtime: "automatic" as const } },
};
const testShared = { environment: "node", testTimeout: 60_000, hookTimeout: 60_000 };

export default defineConfig({
  ...shared,
  test: {
    ...testShared,
    // The lane's collection is the two projects' together — they partition it by pool, and the refusal
    // register's scan reads it off them (tests/refusal-register/scan.ts). A collection at this level
    // would be a third project running every file again.
    projects: [
      { ...shared, test: { ...testShared, name: "unit", pool: "vmForks", include: INCLUDE, exclude: [...EXCLUDE, ...FORKS_POOL] } },
      { ...shared, test: { ...testShared, name: "unit-forks", pool: "forks", include: [...FORKS_POOL], exclude: EXCLUDE } },
    ],
  },
});

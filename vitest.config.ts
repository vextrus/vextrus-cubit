// The unit lane's config (V-VERIFY). The default environment stays node — the tier under test is a
// server tier; the few suites that render a component ask for jsdom with a `@vitest-environment`
// docblock, so nothing pretends to be a browser that is not one. The lint fixture corpus is
// deliberate payload, not a suite, and the journeys belong to Playwright — both stay out.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
// Which suites need a live cluster is derived from the tree's own import graph, in one home
// (ARCH-02); this lane is the one that must run without one.
import { laneSplit } from "./scripts/lib/pg-suites.mjs";

const { database } = laneSplit(fileURLToPath(new URL("./", import.meta.url)));

export default defineConfig({
  // The product spells its own layers through tsconfig's `@/` alias (ARCH-01); Next, tsx and
  // Playwright read that path mapping natively, and this lane is told it here.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // tsconfig keeps `jsx: preserve` because Next compiles the app; the test transform has no such
  // compiler behind it, so it is told the runtime explicitly here.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    // A suite may sit in `src/**/__tests__/` or directly beside the module it judges — R-UI-001
    // puts the generated stylesheet's drift test next to `src/ui/tokens.ts`. Both shapes collect.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    // The unit lane is PURE: it opens no database, so it passes with DATABASE_URL unset and a
    // cluster that is not running (v22 Wave A). Every suite that reaches the live-database seeds —
    // db/__tests__/harness.ts or support/live-sql.ts, however many modules away, and through a
    // helper-wrapped `productModule("...")` as readily as through a bare import — is collected by
    // the database lane instead, along with everything living under db/__tests__. Derived, so a
    // suite that grows such an import moves lanes by itself rather than failing for want of a
    // cluster; the partition itself is proved in tests/toolchain/test-lane-split.test.ts.
    exclude: ["node_modules/**", "tests/e2e/**", "tests/lint-fixtures/**", ...database],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

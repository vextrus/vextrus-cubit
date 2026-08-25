// The unit lane's config (V-VERIFY). The default environment stays node — the tier under test is a
// server tier; the few suites that render a component ask for jsdom with a `@vitest-environment`
// docblock, so nothing pretends to be a browser that is not one. The lint fixture corpus is
// deliberate payload, not a suite, and the journeys belong to Playwright — both stay out.
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig keeps `jsx: preserve` because Next compiles the app; the test transform has no such
  // compiler behind it, so it is told the runtime explicitly here.
  oxc: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/__tests__/*.test.ts", "src/**/__tests__/*.test.tsx"],
    exclude: ["node_modules/**", "tests/e2e/**", "tests/lint-fixtures/**"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

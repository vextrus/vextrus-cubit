// The unit lane's config (V-VERIFY). The default environment stays node — the tier under test is a
// server tier; the few suites that render a component ask for jsdom with a `@vitest-environment`
// docblock, so nothing pretends to be a browser that is not one. The lint fixture corpus is
// deliberate payload, not a suite, and the journeys belong to Playwright — both stay out.
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig keeps `jsx: preserve` because Next compiles the app; the test transform has no such
  // compiler behind it, so it is told the runtime explicitly here.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    // A suite may sit in `src/**/__tests__/` or directly beside the module it judges — R-UI-001
    // puts the generated stylesheet's drift test next to `src/ui/tokens.ts`. Both shapes collect.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules/**", "tests/e2e/**", "tests/lint-fixtures/**"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

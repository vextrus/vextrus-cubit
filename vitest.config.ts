// The unit lane's config (V-VERIFY). Node environment: nothing renders in this tree yet, so no
// browser-shaped environment is loaded to pretend otherwise. The lint fixture corpus is deliberate
// payload, not a suite, and the journeys belong to Playwright — both stay out.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/__tests__/*.test.ts"],
    exclude: ["node_modules/**", "tests/e2e/**", "tests/lint-fixtures/**"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

// The unit lane of V-VERIFY. Everything runs in the node environment: today no criterion renders a
// component. tests/e2e belongs to Playwright and is excluded here.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,mjs,ts,mts}", "src/**/__tests__/**/*.test.ts"],
    exclude: ["node_modules/**", "tests/e2e/**", "tests/lint-fixtures/**"],
    // The toolchain suite shells out to `pnpm verify` on scratch copies of the tree, so its hooks
    // and cases are minutes-scale by nature.
    testTimeout: 300_000,
    hookTimeout: 900_000,
  },
});

// The unit lane of V-VERIFY. Everything runs in the node environment: today no criterion renders a
// component. tests/e2e belongs to Playwright and is excluded here.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Exactly what the unit lane probes for — any *.test.* under tests/ outside tests/e2e — so a
    // test the roster counts is a test this run executes, and nothing green here went unrun (B-23).
    include: ["tests/**/*.test.?(c|m)[jt]s?(x)"],
    exclude: ["node_modules/**", "tests/e2e/**", "tests/lint-fixtures/**"],
    // The toolchain suite shells out to `pnpm verify` on scratch copies of the tree, so its hooks
    // and cases are minutes-scale by nature.
    testTimeout: 300_000,
    hookTimeout: 900_000,
  },
});

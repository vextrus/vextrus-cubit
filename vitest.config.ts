// The unit lane of V-VERIFY. Everything runs in the node environment: today no criterion renders a
// component. tests/e2e belongs to Playwright and is excluded here.
import { defineConfig } from "vitest/config";
import { UNIT_EXCLUDE, UNIT_INCLUDE } from "./scripts/lanes.mjs";

export default defineConfig({
  test: {
    environment: "node",
    // The corpus comes from the roster's own home, so what the unit lane probes for and what this
    // run executes cannot drift: a test the roster counts is a test this run runs (B-23).
    include: UNIT_INCLUDE,
    exclude: UNIT_EXCLUDE,
    // The toolchain suite shells out to `pnpm verify` on scratch copies of the tree, so its hooks
    // and cases are minutes-scale by nature.
    testTimeout: 300_000,
    hookTimeout: 900_000,
  },
});

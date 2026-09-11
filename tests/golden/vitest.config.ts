// The golden lane's config (V-GOLDEN, AM-01). It collects the suites that judge the fixture
// evidence itself — the committed goldens, their manifests and the pins that name them — and
// nothing that needs a database, a browser or a built app: the lane must be runnable on a bare
// checkout in seconds, because it is the fast regression F-RCC6 was frozen to be.
//
// The product's own proof against the golden (tests/takeoff/rails/rcc6-column-concrete.test.ts)
// is deliberately NOT here: it ingests the corpus through the real cad CLI and measures it through
// live Postgres, so it belongs to the database lane that db/__tests__/vitest.config.ts derives, and
// this repo's law is that a suite sits in exactly one of those two collections. What it reads from
// the golden — the seven column-concrete quantities — is held here instead by
// rcc6-column-rows-frozen.test.ts, which diffs them against the v1.0 rows byte for byte.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/golden/**/*.test.ts", "tests/rcc6/**/*.test.ts"],
    exclude: ["node_modules/**"],
    testTimeout: 60_000,
  },
});

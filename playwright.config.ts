// The journey runner's config (V-E2E). It builds the product once, serves it on the journey port,
// and points it at the journeys' own database — the same grants and policies production runs under.
//
// The database is *named* here and *made* in the global setup, because Playwright starts the web
// server before the global setup runs. Nothing about that ordering is fragile: the server opens no
// connection until a journey asks it to, and by then the schema is applied.
import { defineConfig } from "@playwright/test";
// The port set has one home (ARCH-02); this config reads it rather than restating a number.
import { portFor } from "./scripts/lib/ports.mjs";
import { e2eDatabaseUrl } from "./tests/e2e/support/scratch-db";

const port = portFor("e2e");
const NEXT = "node_modules/next/dist/bin/next";

export default defineConfig({
  testDir: "tests/e2e",
  // The journeys are named for what they walk, not for the runner's default glob.
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/support/global-setup.ts",
  timeout: 120_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    // V-E2E owes a screenshot at every named checkpoint. `tests/e2e/support/checkpoint.ts` attaches
    // the ones it is called at under their own names; this is the floor beneath it, so a declared
    // checkpoint a journey stands on without calling that helper — j-000-home, the smoke's single
    // checkpoint at `/` — is still evidenced by an image of the page rather than by an assertion
    // alone. A run therefore carries one screenshot per journey test at minimum, always.
    screenshot: "on",
  },
  webServer: {
    command: `node ${NEXT} build && node ${NEXT} start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
    env: { DATABASE_URL: e2eDatabaseUrl() },
  },
  // V-E2E: the journeys drive the built product, never a dev server — what CI ships is what they
  // walk. One home for the port (ARCH-02): `portFor("e2e")` above.
  webServer: {
    command: `pnpm exec next build && pnpm exec next start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    // Reuse is opt-in by name, never the default: when the port already answers, Playwright skips
    // the command entirely, so neither `next build` nor `next start` runs and the journey would
    // walk whatever bundle an earlier session left behind. A run that reuses must say so
    // (E2E_REUSE_SERVER=1), and CI never may — what CI ships is what the journeys walk (V-E2E).
    reuseExistingServer: process.env["CI"] === undefined && process.env["E2E_REUSE_SERVER"] === "1",
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});

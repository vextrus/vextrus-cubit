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
});

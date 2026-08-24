// The journey runner's configuration. Today it declares where journeys will live and how they run;
// no journey exists yet and no browser is launched — `pnpm e2e` records that skip until src/app
// exists (B-23). The baseURL and the dev-server hand-off arrive with the app that needs them.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

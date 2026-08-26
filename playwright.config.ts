// The journey runner's config. The journeys themselves arrive with the screens they walk; this
// file states where they will live and on which port they will find the product (C-06).
import { defineConfig } from "@playwright/test";
// The port set has one home (ARCH-02); this config reads it rather than restating a number.
import { portFor } from "./scripts/lib/ports.mjs";

const port = portFor("e2e");

export default defineConfig({
  testDir: "tests/e2e",
  // The journeys are named for what they walk, not for the runner's default glob.
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
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

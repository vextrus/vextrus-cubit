// The journey runner's config. The journeys themselves arrive with the screens they walk; this
// file states where they will live and on which port they will find the product (C-06).
import { defineConfig } from "@playwright/test";
// The port set has one home (ARCH-02); this config reads it rather than restating a number.
import { portFor } from "./scripts/lib/ports.mjs";

const port = portFor("e2e");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
});

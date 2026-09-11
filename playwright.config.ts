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

/**
 * The address the journeys' server answers at, in one place: it is both what the journeys drive
 * (`use.baseURL`) and what that server states about itself, so a mailed link points where the
 * browser already is.
 */
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  // The journeys are named for what they walk, not for the runner's default glob — and the lane
  // carries both spellings a journey has been written in, so neither convention is collected by
  // nothing (V-E2E: a journey the gate does not run is green by omission).
  testMatch: ["**/*.e2e.ts", "**/*.spec.ts"],
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  // `list` for a human, and one `JOURNEY <id> green|red` line per journey the caller asked for, so a
  // run that put several journeys through this one invocation can still be read journey by journey
  // (tests/e2e/support/journey-reporter.ts). It prints nothing when nobody named a journey.
  reporter: [["list"], ["./tests/e2e/support/journey-reporter.ts"]],
  globalSetup: "./tests/e2e/support/global-setup.ts",
  // V-E2E: the visual comparisons stand against baselines committed for Linux, in one directory
  // rather than beside each spec — a journey names its baseline and the lane says where it lives.
  snapshotPathTemplate: "tests/e2e/baselines/design/{arg}{ext}",
  expect: {
    // V-E2E fixes the tolerance for every visual comparison in the lane.
    toHaveScreenshot: { maxDiffPixelRatio: 0.002 },
  },
  timeout: 120_000,
  // The lanes. The light one is the product's baselined ground and is always present; the dark one
  // is registered by name (CUBIT_E2E_DARK=1) rather than always, because a second project doubles
  // every journey in the wall — and until the node that owns those captures has taken them, it
  // compares against nothing.
  projects:
    process.env["CUBIT_E2E_DARK"] === "1"
      ? [
          { name: "light", use: { colorScheme: "light" as const } },
          {
            name: "dark",
            use: { colorScheme: "dark" as const },
            snapshotPathTemplate: "tests/e2e/baselines/design-dark/{arg}{ext}",
            ignoreSnapshots: true,
          },
        ]
      : [{ name: "light", use: { colorScheme: "light" as const } }],
  // 1440x900 at scale 1, reduced motion, a fixed locale and clock, and the three Chromium font
  // flags — so a capture is the same picture on any box, and a designer's browser and the suite's
  // disagree about no glyph (Design Direction 00 §9.3).
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: "en-GB",
    timezoneId: "Asia/Dhaka",
    // The product's served default is dark (R-UI-001). Every baseline committed to
    // tests/e2e/baselines/design was taken light, so this lane states light rather than inheriting
    // it: the resolver settles the root attribute from this preference before first paint.
    colorScheme: "light",
    launchOptions: {
      // Reduced motion is a launch flag rather than a `use` option: the installed @playwright/test
      // publishes no `reducedMotion` in its test options, and a capture that waits on an animation
      // is a flaky capture whichever surface turns the animation off.
      args: [
        "--force-prefers-reduced-motion",
        "--font-render-hinting=none",
        "--disable-lcd-text",
        "--force-color-profile=srgb",
      ],
    },
    // Vextrus Builder v21 L9: the engine turns video and a full trace on for the final, green,
    // pre-merge journey run only (CUBIT_E2E_VIDEO / CUBIT_E2E_TRACE = on) and harvests them into
    // the increment's evidence; every other run keeps the cheap defaults.
    video: process.env["CUBIT_E2E_VIDEO"] === "on" ? "on" : "off",
    trace: process.env["CUBIT_E2E_TRACE"] === "on" ? "on" : "retain-on-failure",
    // V-E2E owes a screenshot at every named checkpoint. `tests/e2e/support/checkpoint.ts` attaches
    // the ones it is called at under their own names; this is the floor beneath it, so a declared
    // checkpoint a journey stands on without calling that helper — j-000-home, the smoke's single
    // checkpoint at `/` — is still evidenced by an image of the page rather than by an assertion
    // alone. A run therefore carries one screenshot per journey test at minimum, always.
    screenshot: "on",
  },
  // V-E2E: the journeys drive the built product, never a dev server — what CI ships is what they
  // walk. One home for the port (ARCH-02): `portFor("e2e")` above, and one home for the database
  // the built server opens: the journeys' own scratch, named here and made in the global setup.
  //
  // It is a deployment, so it states its own address. A mailed reset or magic link is built on
  // `CUBIT_PUBLIC_ORIGIN` and on nothing else (src/server/context.ts) — no property of a request
  // substitutes, because a caller writes those — so a journeys' server that named no address would
  // answer LINK_NOT_SENDABLE and every mailed-link journey would stop walking a link (R-SPINE-001).
  //
  // It is a deployment in the other sense too: it states the key its signed download URLs are minted
  // with. An installation that names none signs nothing — `sign` refuses with DOWNLOAD_NOT_SIGNABLE
  // rather than minting a key that would die at the next restart and leave the box effectively
  // unsigned (Q-12) — so a journeys' server that named no key would serve no sheet card, because a
  // card is drawn from a signed raster URL. The value is this stage's own, not a secret: it is
  // stated here beside the database and the address, and nothing in the repo ships it to an
  // installation.
  webServer: {
    // scripts/e2e-server.mjs builds only when the built output is older than an input — verify's
    // build of the same tree is walked as it stands (a 27 s cold build per journey invocation before).
    command: `node scripts/e2e-server.mjs --next node_modules/next/dist/bin/next build-if-stale start --port ${port}`,
    url: baseURL,
    // The journeys' stage arms the evidence instrument by name: `?__theme=` and `?__state=` are
    // capabilities an installation grants, never ones a URL can take (src/app/theme-resolver.ts).
    env: {
      DATABASE_URL: e2eDatabaseUrl(),
      CUBIT_PUBLIC_ORIGIN: baseURL,
      CUBIT_STORAGE_SIGNING_SECRET: "the-journeys-stage-signing-key",
      CUBIT_UI_INSTRUMENT: "1",
    },
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

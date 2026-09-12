// The journey runner's config (V-E2E). It builds the product once, serves it on the journey port,
// and points it at the journeys' own database — the same grants and policies production runs under.
//
// The database is *named* here and *made* in the global setup, because Playwright starts the web
// server before the global setup runs. Nothing about that ordering is fragile: the server opens no
// connection until a journey asks it to, and by then the schema is applied.
import { defineConfig } from "@playwright/test";
// The port set has one home (ARCH-02); this config reads it rather than restating a number.
import { portFor } from "./scripts/lib/ports.mjs";
import { SNAPSHOT_PATH_TEMPLATE, detectGpu, journeyUse, pictureLane } from "./tests/e2e/support/capture-geometry";
import { e2eDatabaseUrl } from "./tests/e2e/support/scratch-db";

const port = portFor("e2e");

/**
 * The address the journeys' server answers at, in one place: it is both what the journeys drive
 * (`use.baseURL`) and what that server states about itself, so a mailed link points where the
 * browser already is.
 */
const baseURL = `http://127.0.0.1:${port}`;

/** Is the whole of §9.3 in force for this run? U2 flips this one switch (Design Direction 00 §9.3). */
const picture = pictureLane();

/** Is this run being filmed? A showreel needs a film and a trace, so asking for one turns both on. */
const showreel = process.env["CUBIT_SHOWREEL"] === "1";

/**
 * WHAT PAINTS THE VIEWER'S CANVAS, decided once at config load (v22 speed-gpu). Read here rather
 * than inside the `use` block so that `globalSetup` — which runs after this module is evaluated —
 * can name the same choice in the one line it prints, and so a journey with `launchOptions` of its
 * own (`j-011-viewer.spec.ts`) extends THIS list rather than guessing at it.
 */
const gpu = detectGpu();
process.env["CUBIT_E2E_GPU_WHY"] = gpu.why;

export default defineConfig({
  testDir: "tests/e2e",
  // The journeys are named for what they walk, not for the runner's default glob — and the lane
  // carries both spellings a journey has been written in, so neither convention is collected by
  // nothing (V-E2E: a journey the gate does not run is green by omission).
  testMatch: ["**/*.e2e.ts", "**/*.spec.ts"],
  // A journey is serial INSIDE its file — a leg starts from the state the leg before it left — so
  // parallelism is by FILE and never inside one (AM-09 §2).
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  // P9: how many journeys the lane walks at once. One unless the engine asks for more, so a plain
  // `pnpm e2e` is exactly what it was; `CUBIT_E2E_WORKERS=2` is the gate's regression-union lever.
  //
  // What makes two workers lawful here: every journey brings its OWN identity. The accounts are
  // per-run unique (`j000-<run>@cubit.test`), the workspace and the project are made by the journey
  // that walks them, and the outbox is read by address — so two journeys in flight at once meet
  // none of each other's rows. The two things they DO share are read-only or keyed: the picture
  // tenant is a fixture the lane installs before the first journey and no leg writes, and the
  // served build is one process answering both. The database is shared for the same reason it can
  // be: nothing in it is addressed by a name two journeys both hold.
  workers: Math.max(1, Number(process.env["CUBIT_E2E_WORKERS"] ?? "1") || 1),
  // `list` for a human, one `JOURNEY <id> green|red` line per journey the caller asked for, and —
  // only when the run is being filmed — the showreel's table of contents. The reel reporter is
  // registered by name rather than always, because a reporter that writes a file every run writes a
  // file of nothing on nearly every run (tests/e2e/support/showreel-reporter.ts).
  reporter: showreel
    ? [["list"] as const, ["./tests/e2e/support/journey-reporter.ts"] as const, ["./tests/e2e/support/showreel-reporter.ts"] as const]
    : [["list"] as const, ["./tests/e2e/support/journey-reporter.ts"] as const],
  globalSetup: "./tests/e2e/support/global-setup.ts",
  // V-E2E: the visual comparisons stand against baselines committed for Linux, in one directory
  // rather than beside each spec — a journey names its baseline and the lane says where it lives.
  //
  // AM-09 §2 moved the golden path's legs into tests/e2e/journeys/j-000/. The template carries no
  // {testFilePath} and no {testFileDir}, and every J-000 capture names its baseline as an explicit
  // arg array (["j-000", "workspace-named.png"]), so a leg's FILE may move without moving one byte
  // of a committed baseline — the mapping from a capture to its PNG is the arg, not the spec's home.
  // ONE key, two directories (Q-06, and tests/journeys/j-004-gallery-contract.test.ts holds the lane
  // to exactly one): `{projectName}` routes each lane's pictures to its own folder — `design-light/`
  // and `design-dark/` — so a checkpoint's two pictures differ only by their folder, and where a
  // baseline lives is still declared in exactly one place. A per-project override would be two homes
  // for one fact, which is the drift that contract exists to catch.
  snapshotPathTemplate: SNAPSHOT_PATH_TEMPLATE,
  expect: {
    // V-E2E fixes the tolerance for every visual comparison in the lane.
    toHaveScreenshot: { maxDiffPixelRatio: 0.002 },
  },
  timeout: 120_000,
  // ONE LANE BY DEFAULT: DARK (v22 speed, the founder's decision, 2026-09-12).
  //
  // The two lanes stood side by side from the U2 re-baseline lease until now, and the second lane
  // doubled every journey in the wall for a second reading of the same walk: 88 tests, 636 s at two
  // workers, of which exactly half were a light-ground copy of a dark-ground journey. The product's
  // ground is dark (Direction §1's table), so dark is the lane, and it is the ONLY lane a gate runs.
  //
  // THE LIGHT GROUND IS STILL JUDGED, and by a stronger instrument than a second project: the specs
  // that owe a light picture take it INSIDE the dark lane by emulation (`emulateTheme` from
  // tests/e2e/support/lane-theme.ts — shell, palette, j-020-scale, viewer-partition, j-003), and the
  // gallery walks both themes in one lane the same way. Those `-light` pictures live in `design-dark/`
  // with every other picture of this lane, because the lane is where they were taken. A capture named
  // for a ground states its own; everything else belongs to the lane.
  //
  // `CUBIT_E2E_LIGHT=1` adds the light project back — for the gallery and the design contract when
  // somebody wants the whole world walked twice, and for a bisect. It is opted into by name and is
  // in no gate: `tests/e2e/baselines/design-light/` was deleted with this change (22 pictures), so a
  // light project compares against nothing until a lease takes them again.
  projects:
    process.env["CUBIT_E2E_LIGHT"] === "1"
      ? [
          { name: "dark", use: { colorScheme: "dark" as const } },
          { name: "light", use: { colorScheme: "light" as const } },
        ]
      : [{ name: "dark", use: { colorScheme: "dark" as const } }],
  // The lane's `use` block has one home, and it is not this file: `tests/e2e/support/capture-geometry.ts`
  // builds it from the switches below, and a unit test asserts both of its branches — §9.3's capture
  // geometry is the lane's DEFAULT since the lease was spent (`pictureLane()`, B-17); the switch
  // survives inverted, `CUBIT_E2E_PICTURE=0`, as the bisect escape and as nothing a green run uses.
  use: journeyUse({
    baseURL,
    showreel,
    picture,
    video: process.env["CUBIT_E2E_VIDEO"] === "on",
    trace: process.env["CUBIT_E2E_TRACE"] === "on",
    gpu,
  }),
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

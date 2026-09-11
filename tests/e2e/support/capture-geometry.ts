// THE JOURNEY LANE'S `use` BLOCK, AND §9.3'S CAPTURE GEOMETRY — one home (ARCH-02).
//
// It lives here rather than inline in `playwright.config.ts` for one reason: a unit test can read
// it. The config imports the journeys' database module, and any suite that reaches that module is
// collected by the DATABASE lane (scripts/lib/pg-suites.mjs) — so a test that imported the config to
// check its `use` block would need a live cluster to answer a question about two objects. This
// module imports nothing but a type, and `tests/journeys/playwright-capture-geometry.test.ts`
// asserts BOTH branches of it: the flag off is today's block key for key, the flag on is §9.3.
import type { PlaywrightTestConfig } from "@playwright/test";

/**
 * THE §9.3 CAPTURE GEOMETRY, BEHIND ONE SWITCH.
 *
 * Design Direction 00 §9.3 asks this lane for the whole screen at exactly 1440x900, device scale 1,
 * a fixed locale and clock, reduced motion, the three Chromium font flags and no cursor. Every one
 * of those moves every committed picture — the viewport by 160x180 px, the font flags by changing
 * how a glyph is rastered — and re-baselining the world is ONE lease held by ONE node (U2), which
 * is not this one. So the geometry is written here and ARMED BY NAME: `CUBIT_E2E_PICTURE=1` and the
 * whole of §9.3 is in force; with the flag off this function returns an empty object and the `use`
 * block below is what it was, key for key. `tests/journeys/playwright-capture-geometry.test.ts`
 * asserts both branches, so "the flag off changes nothing" is a proved statement, not a claim.
 *
 * The cursor: Chromium does not composite the mouse pointer into a screenshot, and Playwright's
 * capture already hides the text caret by default — so "cursor hidden" is true by construction and
 * needs no flag. It is named here so a reader looking for it finds the answer rather than a gap.
 */
export function captureGeometry(picture: boolean): PlaywrightTestConfig["use"] {
  if (!picture) return {};
  return {
    // The frame every still is laid beside every other still in.
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // A fixed locale and a fixed clock, so a date in a frame is the same date in every frame.
    locale: "en-GB",
    timezoneId: "Asia/Dhaka",
    // Stated twice on purpose: the emulation is what the page's `prefers-reduced-motion` query
    // reads, and the flag is what Chromium's own compositor honours. A still is taken of a screen
    // that has stopped moving, and settled() is the wait that proves it did. `reducedMotion` is a
    // context option in this version's `use` type, so it is spelled where the type puts it.
    contextOptions: { reducedMotion: "reduce" },
    launchOptions: {
      args: [
        "--force-prefers-reduced-motion",
        // The three font flags §9.3 names: hinting, subpixel positioning and LCD filtering are the
        // three things that make the same glyph raster differently on two machines. Off on all
        // three, a baseline taken on Linux is a baseline a reviewer's browser can be held to.
        "--font-render-hinting=none",
        "--disable-font-subpixel-positioning",
        "--disable-lcd-text",
      ],
    },
  };
}

/** The switches the journey lane reads, gathered so the block below is a function of its inputs. */
export interface LaneSwitches {
  /** The address the journeys drive and the served product states about itself. */
  readonly baseURL: string;
  /** Is the run being filmed? A showreel needs a film and a trace to point its chapters at. */
  readonly showreel: boolean;
  /** Is §9.3's capture geometry in force? U2's one switch (CUBIT_E2E_PICTURE=1). */
  readonly picture: boolean;
  /** CUBIT_E2E_VIDEO=on — the engine turns it on for the final, green, pre-merge run only. */
  readonly video: boolean;
  /** CUBIT_E2E_TRACE=on — likewise. */
  readonly trace: boolean;
}

/**
 * What every journey runs under. With `picture` false this is byte-for-byte the block the lane has
 * always had: the base URL, the light scheme the committed baselines were taken in, the cheap video
 * and trace defaults, and a screenshot per test. With `picture` true it gains §9.3's geometry and
 * NOTHING else — which is the property the unit test pins, because "one switch" is only true if the
 * switch off changes nothing.
 */
export function journeyUse(switches: LaneSwitches): PlaywrightTestConfig["use"] {
  return {
    baseURL: switches.baseURL,
    // The product's served default is dark (R-UI-001). Every baseline committed to
    // tests/e2e/baselines/design was taken light, so this lane states light rather than inheriting
    // it: the resolver settles the root attribute from this preference before first paint.
    colorScheme: "light",
    // Vextrus Builder v21 L9: the engine turns video and a full trace on for the final, green,
    // pre-merge journey run only (CUBIT_E2E_VIDEO / CUBIT_E2E_TRACE = on) and harvests them into
    // the increment's evidence; every other run keeps the cheap defaults. Asking for a showreel
    // turns both on, so the chapters the reel reporter writes point at something a reader can open.
    video: switches.showreel || switches.video ? "on" : "off",
    trace: switches.showreel || switches.trace ? "on" : "retain-on-failure",
    // V-E2E owes a screenshot at every named checkpoint. `tests/e2e/support/checkpoint.ts` attaches
    // the ones it is called at under their own names; this is the floor beneath it, so a declared
    // checkpoint a journey stands on without calling that helper — j-000-home, the smoke's single
    // checkpoint at `/` — is still evidenced by an image of the page rather than by an assertion
    // alone. A run therefore carries one screenshot per journey test at minimum, always.
    screenshot: "on",
    ...captureGeometry(switches.picture),
  };
}

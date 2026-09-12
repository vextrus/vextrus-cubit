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
/**
 * IS THIS A PICTURE RUN? The one reading of the switch (B-17).
 *
 * Since the v22 U2 re-baseline lease (2026-09-12) the answer is YES by default: every committed
 * baseline was taken at §9.3's geometry against the picture tenant, so a run that is not a picture
 * run is comparing this world against pictures of another one. `CUBIT_E2E_PICTURE=0` is the bisect
 * escape and nothing a green run uses.
 *
 * It matters that this is ONE function and not three readings of one variable: the geometry
 * (`playwright.config.ts`), the frozen tenant (`picture-tenant.ts`) and the frozen clock must be on
 * together or the picture is of a frame that half-moved.
 */
export const pictureLane = (): boolean => process.env["CUBIT_E2E_PICTURE"] !== "0";

/**
 * The three font flags §9.3 names: hinting, subpixel positioning and LCD filtering are the three
 * things that make the same glyph raster differently on two machines. Off on all three, a baseline
 * taken on Linux is a baseline a reviewer's browser can be held to.
 *
 * Exported because a spec that needs a launch flag of its own must EXTEND this list rather than
 * replace it: `test.use({ launchOptions })` overwrites the lane's whole object, and a journey that
 * silently dropped these three would be taking its pictures — and its heights — through a different
 * rasteriser than every other spec (B-17).
 */
export const FONT_RENDER_FLAGS = ["--font-render-hinting=none", "--disable-font-subpixel-positioning", "--disable-lcd-text"] as const;

/**
 * Chromium's own compositor honouring reduced motion, which is the other half of `reducedMotion:
 * "reduce"` above. A spec that asks for motion BY NAME drops this one flag and keeps the three
 * above — and says in its own file that it is doing so (`j-011-viewer.spec.ts`).
 */
export const REDUCED_MOTION_FLAG = "--force-prefers-reduced-motion";

/** What the lane launches with: reduced motion, and the three font flags. */
export const CAPTURE_BROWSER_FLAGS = [REDUCED_MOTION_FLAG, ...FONT_RENDER_FLAGS] as const;

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
    launchOptions: { args: [...CAPTURE_BROWSER_FLAGS] },
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

/* ------------------------------------------------------------ WHERE A BASELINE LIVES (Q-06) */

/**
 * THE ONE DECLARATION OF WHERE A COMMITTED PICTURE LIVES.
 *
 * `playwright.config.ts` hands this to Playwright as `snapshotPathTemplate`, and everything else
 * that needs a baseline's path — the B-20 re-baseline proofs in the unit lane, the two journeys
 * that read a PNG off disk to show it was regenerated — asks `baselinePath()` for it rather than
 * spelling the directory again. A B-20 proof that NAMES a directory is a second home for the fact
 * this string already states, and two homes for one fact part (Q-06): the lease moved `design/` to
 * `design-light/` and `design-dark/` and eight such spellings went on reading a path that no longer
 * existed. They read this now, so the next move of the directory moves them with it (B-19).
 *
 * `{projectName}` is the lane's project — `dark` (the product's ground, and the lane's default) or
 * `light`; `{arg}` is the name the checkpoint gave its capture, `{ext}` its extension.
 */
export const SNAPSHOT_PATH_TEMPLATE = "tests/e2e/baselines/design-{projectName}/{arg}{ext}";

/** The lane's two projects, named once: a caller asks for a baseline of one of these and no other. */
export type LaneProject = "dark" | "light";

/**
 * The lane a Playwright project name stands for. A journey that reads its own committed picture off
 * disk (the B-20 proofs) asks for the picture of the lane IT is walking, never of the other one:
 * `baselinePath(laneProject(test.info().project.name), …)`.
 */
export const laneProject = (projectName: string): LaneProject => (projectName === "dark" ? "dark" : "light");

/**
 * The directory one lane's pictures live in, derived from the template rather than restated —
 * everything the template says before `{arg}`, with the trailing separator dropped.
 */
export function baselineDir(project: LaneProject): string {
  const head = SNAPSHOT_PATH_TEMPLATE.slice(0, SNAPSHOT_PATH_TEMPLATE.indexOf("{arg}"));
  return head.replace("{projectName}", project).replace(/\/$/, "");
}

/**
 * The repo-relative path of ONE committed baseline: the lane it belongs to, and the name the
 * checkpoint gave it — either whole (`"s-audit/explorer.png"`) or as the arg segments Playwright
 * itself takes (`"j-000", "workspace-named.png"`), which is how a journey spells it.
 */
export function baselinePath(project: LaneProject, ...arg: readonly string[]): string {
  const name = arg.join("/");
  const dot = name.lastIndexOf("/") < name.lastIndexOf(".") ? name.lastIndexOf(".") : -1;
  // A checkpoint named without one gets the lane's only picture format, exactly as Playwright's own
  // `{ext}` does — so "invite-pending" and "invite-pending.png" name the same committed file.
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? ".png" : name.slice(dot);
  return SNAPSHOT_PATH_TEMPLATE.replace("{projectName}", project).replace("{arg}", stem).replace("{ext}", ext);
}

// THE JOURNEY LANE'S `use` BLOCK, AND §9.3'S CAPTURE GEOMETRY — one home (ARCH-02).
//
// It lives here rather than inline in `playwright.config.ts` for one reason: a unit test can read
// it. The config imports the journeys' database module, and any suite that reaches that module is
// collected by the DATABASE lane (scripts/lib/pg-suites.mjs) — so a test that imported the config to
// check its `use` block would need a live cluster to answer a question about two objects. This
// module imports nothing but a type, and `tests/journeys/playwright-capture-geometry.test.ts`
// asserts BOTH branches of it: the flag off is today's block key for key, the flag on is §9.3.
import type { PlaywrightTestConfig } from "@playwright/test";
// The one reading of the world in this module: does the WSL2 GPU device exist? Everything the lane
// decides from it is the pure `gpuChoice()` below, which a unit test drives from a fake.
import { existsSync } from "node:fs";

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


/* ------------------------------------------------------ WHAT PAINTS THE CANVAS (v22 speed-gpu) */

/**
 * THE WSL2 GPU DEVICE. Its presence is the one fact that separates "this box has a card to reach"
 * from "it does not", and `gpuChoice()` below is a function of it — so the choice can be asserted
 * from a fake rather than from whatever machine the unit lane happens to run on.
 */
export const DXG_DEVICE = "/dev/dxg";

/**
 * THE HARDWARE SPELLING, and why each flag is in it.
 *
 * `--ozone-platform=x11` is the load-bearing one. This box has NO /dev/dri render node — WSL2
 * exposes the GPU as /dev/dxg and nothing else — so the surfaceless EGL display that headless
 * Chromium asks for has no device behind it and ANGLE falls back to SwiftShader, whatever GL flags
 * it was given. Mesa's d3d12 Gallium driver DOES reach the card (`eglinfo` answers `D3D12 (NVIDIA
 * GeForce RTX 3060 Ti)`), but only through a winsys with a display: X11 or Wayland, not GBM and not
 * surfaceless. WSLg serves an X server at :0, so naming it is what gives EGL a device.
 *
 * `--use-gl=angle --use-angle=gl` then puts ANGLE on top of that desktop GL rather than on top of
 * its own bundled SwiftShader. The blocklist is ignored because Chromium has no entry for a D3D12
 * adapter seen through Mesa and refuses it by default.
 *
 * And a window: the headless shell has no winsys at all, and `--headless=new` still asks for the
 * surfaceless display — `scripts/gpu-probe.mjs` candidate `h` is that fact, measured. So the
 * hardware lane runs the FULL chromium binary headed, on WSLg's X server.
 */
export const HARDWARE_GL_FLAGS = ["--ozone-platform=x11", "--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] as const;

/**
 * The environment Mesa needs to pick the d3d12 driver and, within it, the discrete adapter. Without
 * it the same window and the same flags land on llvmpipe — a CPU rasteriser wearing a GL renderer
 * string (`scripts/gpu-probe.mjs` candidate `g` is that fact, measured). `LIBGL_ALWAYS_SOFTWARE` is
 * not set here but is DELETED where this is applied: its presence anywhere in the environment
 * forces llvmpipe and would silently undo all of the above.
 */
export const MESA_D3D12_ENV = {
  MESA_D3D12_DEFAULT_ADAPTER_NAME: "NVIDIA",
  GALLIUM_DRIVER: "d3d12",
  MESA_LOADER_DRIVER_OVERRIDE: "d3d12",
} as const;

/**
 * THE SOFTWARE SPELLING — what `j-011-viewer.spec.ts` carried inline until now, moved to the one
 * home every other launch flag already lives in. `--enable-unsafe-swiftshader` is required: since
 * Chromium 119 a WebGL context that would fall back to SwiftShader is refused outright unless the
 * caller says it accepts one, and a refused context is `data-renderer="unavailable"` — the journey
 * failing honestly rather than the lane painting slowly.
 */
export const SOFTWARE_GL_FLAGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] as const;

/** What the lane decided to paint with, and the sentence that says why. */
export interface GpuChoice {
  /** Did it land on silicon? Only this makes the lane headed and the env non-empty. */
  readonly hardware: boolean;
  /** The GL args, appended to the capture flags rather than replacing them (B-17). */
  readonly args: readonly string[];
  /** The environment OVERLAY — merged over `process.env` at launch, never replacing it. */
  readonly env: Readonly<Record<string, string>>;
  /** A headless shell has no winsys, so the hardware path needs a window. */
  readonly headless: boolean;
  /** The line the lane prints, so a reader of a log knows which of the two ran. */
  readonly why: string;
}

/** The inputs the choice is a function of — all three read from the world by `detectGpu()` alone. */
export interface GpuFacts {
  /** Does /dev/dxg exist? No device, no hardware path, whatever else is true. */
  readonly dxg: boolean;
  /** `DISPLAY` — the X server the d3d12 winsys needs. WSLg sets it to `:0`. */
  readonly display: string | undefined;
  /** `CUBIT_E2E_GPU`: `0` forces software (the bisect escape), `1` asks for hardware by name. */
  readonly forced: string | undefined;
}

/**
 * THE ONE READING OF "WHAT SHOULD THIS RUN PAINT WITH". A pure function of three facts, so
 * `tests/journeys/playwright-capture-geometry.test.ts` asserts both branches from a FAKE /dev/dxg
 * rather than from the machine under it — the same shape the picture switch above is tested in.
 *
 * Software is the floor and never an error: a box without the device, or without a display to hang
 * the d3d12 winsys off, gets exactly the flags the lane has always run and says so in one line.
 */
export function gpuChoice(facts: GpuFacts): GpuChoice {
  const software = (why: string): GpuChoice => ({ hardware: false, args: [...SOFTWARE_GL_FLAGS], env: {}, headless: true, why });
  if (facts.forced === "0") return software("software (CUBIT_E2E_GPU=0)");
  if (!facts.dxg) return software(`software (no ${DXG_DEVICE})`);
  if (!facts.display) return software("software (no DISPLAY — the d3d12 winsys needs an X server)");
  return {
    hardware: true,
    args: [...HARDWARE_GL_FLAGS],
    env: { ...MESA_D3D12_ENV },
    headless: false,
    why: `hardware (${DXG_DEVICE} on DISPLAY=${facts.display})`,
  };
}

/**
 * The choice for THIS process, read from the world once at config load. `existsSync` is the whole
 * of the world-reading; everything downstream is the pure function above.
 */
export function detectGpu(): GpuChoice {
  return gpuChoice({
    dxg: existsSync(DXG_DEVICE),
    display: process.env["DISPLAY"],
    forced: process.env["CUBIT_E2E_GPU"],
  });
}

/**
 * The launch environment a hardware run needs: this process's, plus Mesa's overlay, MINUS
 * `LIBGL_ALWAYS_SOFTWARE`. Playwright's `launchOptions.env` REPLACES the browser's environment
 * rather than extending it, so a run that passed the overlay alone would start a browser with no
 * PATH, no HOME and no DISPLAY — and no display is exactly the condition that sends it back to
 * SwiftShader. A software run contributes no `env` key at all, so it inherits as it always has.
 */
export function launchEnvFor(gpu: GpuChoice): Record<string, string> | undefined {
  if (!gpu.hardware) return undefined;
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  delete env["LIBGL_ALWAYS_SOFTWARE"];
  return { ...env, ...gpu.env };
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
  /**
   * What paints the canvas. Passed IN rather than read here for the same reason every other switch
   * is: `journeyUse` stays a function of its inputs, so the unit test asserts both of its GL
   * branches without the answer depending on whether the machine running the unit lane has a card.
   */
  readonly gpu: GpuChoice;
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
    // THE GL CHOICE, LAST — and last on purpose. `captureGeometry` owns `launchOptions` under the
    // picture switch, so the GL args are merged onto whatever it returned rather than beside it:
    // `test.use({ launchOptions })` and a second `launchOptions` key are the same trap, and §9.3's
    // three font flags being dropped by an override nothing documented is a fault this lane has
    // already had once (j-011-viewer.spec.ts). One key, built once, carrying both.
    headless: switches.gpu.headless,
    launchOptions: {
      args: [...(switches.picture ? CAPTURE_BROWSER_FLAGS : []), ...switches.gpu.args],
      ...(launchEnvFor(switches.gpu) ? { env: launchEnvFor(switches.gpu) } : {}),
    },
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

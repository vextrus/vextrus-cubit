// Design Direction 00 §9.3 — the capture geometry is WIRED here and FLIPPED by U2.
//
// §9.3's frame (1440x900 at device scale 1, en-GB, Asia/Dhaka, reduced motion, the three font
// flags) re-baselines every committed picture in the tree. That is one lease, held by one node, and
// it is not this one — so the geometry is written into the lane and armed by name. The whole worth
// of "one switch" rests on a property that is easy to claim and easy to get wrong: WITH THE SWITCH
// OFF, NOTHING CHANGES. This suite is that property, asserted over the real `use` block the config
// ships rather than over a description of it.
//
// The block is read from `tests/e2e/support/capture-geometry.ts`, which is where it lives (ARCH-02).
// It is not read from `playwright.config.ts` because that module reaches the journeys' database and
// every suite that does is collected by the database lane — a question about two plain objects would
// then need a live cluster to answer.
import { describe, expect, test } from "vitest";
import {
  CAPTURE_BROWSER_FLAGS,
  DXG_DEVICE,
  HARDWARE_GL_FLAGS,
  MESA_D3D12_ENV,
  SOFTWARE_GL_FLAGS,
  captureGeometry,
  gpuChoice,
  journeyUse,
  type GpuFacts,
  type LaneSwitches,
} from "../e2e/support/capture-geometry";

/** A box with no card: what every machine that is not this one looks like to `gpuChoice()`. */
const NO_CARD: GpuFacts = { dxg: false, display: ":0", forced: "1" };

/** A box with the WSL2 device and WSLg's X server — this one, faked so the assertion is portable. */
const CARD: GpuFacts = { dxg: true, display: ":0", forced: "1" };

/** The switches a plain run carries: no film, no trace, no pictures. */
const PLAIN: LaneSwitches = {
  baseURL: "http://127.0.0.1:4300",
  showreel: false,
  picture: false,
  video: false,
  trace: false,
  // The GL choice is an INPUT, so every assertion below holds on a machine with a card and on one
  // without: the unit lane must not answer differently because of what is plugged into the box.
  gpu: gpuChoice(NO_CARD),
};

/**
 * The `use` block as it stood before §9.3 was wired in, key for key and value for value. This is the
 * "byte-equivalent in effect" claim written down, so the claim can go red.
 */
const BEFORE = {
  baseURL: "http://127.0.0.1:4300",
  colorScheme: "light",
  video: "off",
  trace: "retain-on-failure",
  screenshot: "on",
  // Since v22's speed-gpu the lane also states WHAT PAINTS: a software run is headless and carries
  // the three SwiftShader flags `j-011-viewer.spec.ts` used to carry inline. These two keys are the
  // whole of what the GL choice adds when it chooses software — no env key, and no other change.
  headless: true,
  launchOptions: { args: [...SOFTWARE_GL_FLAGS] },
};

describe("§9.3: the capture geometry is armed by name", () => {
  test("with the switch off the lane's use block is exactly what it was", () => {
    expect(journeyUse(PLAIN)).toEqual(BEFORE);
  });

  test("with the switch off the geometry contributes no key at all", () => {
    expect(captureGeometry(false)).toEqual({});
    // Not just "no §9.3 key" — no key. A default that leaked in under any name would move a picture.
    expect(Object.keys(captureGeometry(false) ?? {})).toEqual([]);
  });

  test("with the switch on the block gains §9.3's frame and nothing else", () => {
    const picture = journeyUse({ ...PLAIN, picture: true }) ?? {};
    const plain = journeyUse(PLAIN) ?? {};
    const gained = Object.keys(picture).filter((key) => !Object.keys(plain).includes(key));
    expect(gained.sort()).toEqual(["contextOptions", "deviceScaleFactor", "locale", "timezoneId", "viewport"]);
    // Every key the plain block carried is carried through unchanged: the switch ADDS, never edits.
    // `launchOptions` is the one exception and is asserted just below instead — since the GL choice
    // moved into that key there is exactly ONE launch-options object rather than two competing ones,
    // so §9.3 necessarily adds its four flags to a list that already exists. What must still hold is
    // that it only PREPENDS: the GL flags the plain block chose survive, in order, untouched.
    const except = (block: Record<string, unknown>) => Object.fromEntries(Object.entries(block).filter(([key]) => key !== "launchOptions"));
    for (const [key, value] of Object.entries(except(plain))) expect({ [key]: (picture as Record<string, unknown>)[key] }).toEqual({ [key]: value });
    const plainArgs = (plain as { launchOptions?: { args?: string[] } }).launchOptions?.args ?? [];
    const pictureArgs = (picture as { launchOptions?: { args?: string[] } }).launchOptions?.args ?? [];
    expect(pictureArgs.slice(pictureArgs.length - plainArgs.length)).toEqual(plainArgs);
    expect(pictureArgs.slice(0, pictureArgs.length - plainArgs.length)).toEqual([...CAPTURE_BROWSER_FLAGS]);
  });

  test("the frame is the one §9.3 names, to the pixel and to the tag", () => {
    const use = journeyUse({ ...PLAIN, picture: true }) as Record<string, unknown>;
    expect(use["viewport"]).toEqual({ width: 1440, height: 900 });
    expect(use["deviceScaleFactor"]).toBe(1);
    expect(use["locale"]).toBe("en-GB");
    expect(use["timezoneId"]).toBe("Asia/Dhaka");
    expect(use["contextOptions"]).toEqual({ reducedMotion: "reduce" });
  });

  test("the four Chromium flags §9.3 names are the four that are passed", () => {
    const use = journeyUse({ ...PLAIN, picture: true }) as { launchOptions?: { args?: string[] } };
    expect(use.launchOptions?.args).toEqual([
      "--force-prefers-reduced-motion",
      "--font-render-hinting=none",
      "--disable-font-subpixel-positioning",
      "--disable-lcd-text",
      // …and then the GL choice, APPENDED. §9.3's four come first and are never replaced: a journey
      // reading this list is reading one list (B-17).
      ...SOFTWARE_GL_FLAGS,
    ]);
  });

  test("a filmed run turns the film and the trace on, whatever the video switches say", () => {
    const reel = journeyUse({ ...PLAIN, showreel: true }) as Record<string, unknown>;
    expect(reel["video"]).toBe("on");
    expect(reel["trace"]).toBe("on");
    // And asking for a film does not reach for the picture geometry: they are two switches.
    expect(Object.keys(reel).sort()).toEqual(Object.keys(BEFORE).sort());
  });

  test("the video and trace switches still answer on their own", () => {
    expect((journeyUse({ ...PLAIN, video: true }) as Record<string, unknown>)["video"]).toBe("on");
    expect((journeyUse({ ...PLAIN, trace: true }) as Record<string, unknown>)["trace"]).toBe("on");
  });
});

/**
 * WHAT PAINTS THE CANVAS (v22 speed-gpu). The choice is a pure function of three facts, so both of
 * its branches are asserted from a FAKE /dev/dxg — the unit lane must give the same verdict on a
 * build box with no card as on the workstation with the RTX 3060 Ti under it.
 */
describe("the GL choice: a fake /dev/dxg decides it, and nothing else does", () => {
  test("no device means software, named as such", () => {
    const choice = gpuChoice(NO_CARD);
    expect(choice.hardware).toBe(false);
    expect(choice.args).toEqual([...SOFTWARE_GL_FLAGS]);
    expect(choice.headless).toBe(true);
    expect(choice.env).toEqual({});
    expect(choice.why).toBe(`software (no ${DXG_DEVICE})`);
  });

  test("the device and a display together mean hardware, headed, with Mesa's env", () => {
    const choice = gpuChoice(CARD);
    expect(choice.hardware).toBe(true);
    expect(choice.args).toEqual([...HARDWARE_GL_FLAGS]);
    // Headed is not a taste: the headless shell has no winsys and `--headless=new` asks EGL for a
    // surfaceless display, which on a box with no /dev/dri node has no device behind it at all.
    expect(choice.headless).toBe(false);
    expect(choice.env).toEqual({ ...MESA_D3D12_ENV });
    expect(choice.why).toContain("hardware");
  });

  test("the device without a display is still software — the d3d12 winsys needs an X server", () => {
    const choice = gpuChoice({ ...CARD, display: undefined });
    expect(choice.hardware).toBe(false);
    expect(choice.args).toEqual([...SOFTWARE_GL_FLAGS]);
  });

  test("CUBIT_E2E_GPU=0 forces software even where the card is there — the bisect escape", () => {
    const choice = gpuChoice({ ...CARD, forced: "0" });
    expect(choice.hardware).toBe(false);
    expect(choice.why).toBe("software (CUBIT_E2E_GPU=0)");
  });

  test("a card nobody asked for is not used: hardware is opt-in until the headed lane lays out the same", () => {
    const choice = gpuChoice({ ...CARD, forced: undefined });
    expect(choice.hardware).toBe(false);
    expect(choice.args).toEqual([...SOFTWARE_GL_FLAGS]);
    expect(choice.why).toContain("the lane's floor");
  });

  test("the lane's use block carries the hardware choice when the choice is hardware", () => {
    const use = journeyUse({ ...PLAIN, picture: true, gpu: gpuChoice(CARD) }) as {
      headless?: boolean;
      launchOptions?: { args?: string[]; env?: Record<string, string> };
    };
    expect(use.headless).toBe(false);
    // §9.3's four still lead; the hardware flags follow. The picture geometry is not bent for GL.
    expect(use.launchOptions?.args?.slice(0, 4)).toEqual(["--force-prefers-reduced-motion", "--font-render-hinting=none", "--disable-font-subpixel-positioning", "--disable-lcd-text"]);
    expect(use.launchOptions?.args?.slice(4)).toEqual([...HARDWARE_GL_FLAGS]);
    // The env is process.env EXTENDED, never replaced — a browser launched with the overlay alone
    // would have no DISPLAY, and no DISPLAY is the very condition that sends it back to SwiftShader.
    expect(use.launchOptions?.env?.["GALLIUM_DRIVER"]).toBe("d3d12");
    expect(use.launchOptions?.env?.["PATH"]).toBe(process.env["PATH"]);
    expect(use.launchOptions?.env).not.toHaveProperty("LIBGL_ALWAYS_SOFTWARE");
  });
});

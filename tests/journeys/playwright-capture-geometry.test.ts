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
import { captureGeometry, journeyUse, type LaneSwitches } from "../e2e/support/capture-geometry";

/** The switches a plain run carries: no film, no trace, no pictures. */
const PLAIN: LaneSwitches = { baseURL: "http://127.0.0.1:4300", showreel: false, picture: false, video: false, trace: false };

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
    expect(gained.sort()).toEqual(["contextOptions", "deviceScaleFactor", "launchOptions", "locale", "timezoneId", "viewport"]);
    // Every key the plain block carried is carried through unchanged: the switch ADDS, never edits.
    for (const [key, value] of Object.entries(plain)) expect({ [key]: (picture as Record<string, unknown>)[key] }).toEqual({ [key]: value });
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
    expect(use.launchOptions?.args).toEqual(["--force-prefers-reduced-motion", "--font-render-hinting=none", "--disable-font-subpixel-positioning", "--disable-lcd-text"]);
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

/**
 * Every fact row stands at the grid's own 28 (docs/design/s-settings-site-facts.md I-439, I-273,
 * R-UI-083).
 *
 * Session 7's re-look measured every fact row at a 29 px pitch (192 → 221, 481 → 510 → 539 …) while
 * the sticky header, which holds no control, stood at 28. The cell is `--row-h` tall INCLUDING its
 * hairline, and the door's ghost Button is a control at `--control-h`: at the compact density both
 * are 28, so the button plus the hairline was 29 and the row grew to hold it.
 *
 * Geometry is not observable under jsdom, so the proof reads the declarations the browser is handed,
 * through the rubric's own reader (`tests/support/stylesheet.ts`, B-17), and does the row's arithmetic
 * with the token values each density states.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { customProperties, declaredValue, resolvePx } from "../../support/stylesheet";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
// white-box: a row's pitch is layout, which jsdom does not perform: the only reading of it this lane
// can take is the declaration the browser is handed.
const sheet = (path: string): string => readFileSync(join(REPO_ROOT, path), "utf8");

const PANEL = sheet("src/modules/takeoff/site-facts-ui/site-facts.css");
const TOKENS = sheet("src/ui/tokens.css");
const GLOBALS = sheet("src/ui/theme/globals.css");
const RETICLE = sheet("src/ui/primitives/core/reticle.css");

/** The door's cell and the door in it, as the panel names them. */
const DOOR_CELL = ".cx-site-facts-line > td.cx-site-facts-door";
const DOOR = ".cx-site-facts-door .cx-site-facts-enter";

/** The width of the hairline every row is drawn with, read off the token that carries it. */
const HAIRLINE = Number(/^(\d+(?:\.\d+)?)px\s+solid\b/.exec(customProperties(TOKENS, /^:root$/)["--hairline"] ?? "")?.[1] ?? Number.NaN);

/** A density's token table: the root's values, revalued by that density's own block. */
const densityTable = (density: "compact" | "comfortable"): Record<string, string> => ({
  ...customProperties(TOKENS, /^:root$/),
  ...customProperties(GLOBALS, new RegExp(`\\[data-density="${density}"\\]`)),
});

/**
 * The door's height at one density, evaluated from its own declaration: `min(A, calc(B - Npx))` with
 * A and B the tokens that density states. Anything else the declaration says is not a door this
 * arithmetic knows how to read, and fails rather than passes.
 */
function doorHeight(value: string, table: Record<string, string>): number {
  const said = /^min\(\s*(var\(--[a-z0-9-]+\))\s*,\s*calc\(\s*(var\(--[a-z0-9-]+\))\s*-\s*(\d+(?:\.\d+)?)px\s*\)\s*\)$/.exec(value.trim());
  expect(said, `the door states its height as the smaller of a control and the row less its hairline: ${value}`).not.toBeNull();
  const control = resolvePx(said?.[1] ?? "", table);
  const row = resolvePx(said?.[2] ?? "", table);
  expect(control, "the control height resolves through the density's tokens").not.toBeNull();
  expect(row, "the row height resolves through the density's tokens").not.toBeNull();
  return Math.min(control ?? Number.NaN, (row ?? Number.NaN) - Number(said?.[3]));
}

describe("I-439: the door holds its row at the grid's height", () => {
  test("the hairline every row is drawn with is one pixel, read off its own token", () => {
    expect(HAIRLINE).toBe(1);
  });

  test("the door's cell spends no block padding, and the door yields exactly the row's hairline", () => {
    expect(declaredValue(PANEL, DOOR_CELL, "padding-block"), "padding above and below the door is height the row cannot give").toBe("0");
    const value = declaredValue(PANEL, DOOR, "block-size");
    expect(value, "the door states its own height rather than taking a control's").not.toBeNull();
    expect(/-\s*(\d+(?:\.\d+)?)px/.exec(value ?? "")?.[1], "what the door yields is the hairline's own width").toBe(String(HAIRLINE));
  });

  test.each(["compact", "comfortable"] as const)("at the %s density the door, its padding and the row's hairline fit inside `--row-h`", (density) => {
    const table = densityTable(density);
    const row = resolvePx("var(--row-h)", table);
    const control = resolvePx("var(--control-h)", table);
    expect(row, `${density} states a row height`).not.toBeNull();
    const door = doorHeight(declaredValue(PANEL, DOOR, "block-size") ?? "", table);
    // The cell is border-box at `--row-h`: its hairline and its (zero) block padding come out of it.
    expect(door + HAIRLINE, `${density}: the door and the row's hairline fit the row, so the pitch is ${row ?? "?"}`).toBeLessThanOrEqual(row ?? 0);
    expect(door, `${density}: the door is never taller than a control`).toBeLessThanOrEqual(control ?? 0);
    // …and never a sliver: a door a finger cannot hit fails SC 2.5.8, which axe reports as serious.
    expect(door, `${density}: the door stays a 24 px target at least`).toBeGreaterThanOrEqual(24);
  });

  test("the door's cell lets the focus reticle draw whole at both densities (R-UI-012)", () => {
    // The reticle's ticks stand outside the element's box by the overlay's own outset, read off its
    // single home rather than transcribed.
    const inset = declaredValue(RETICLE, ".cx-reticle:focus-visible::after", "inset");
    const outset = -Number(/^(-?\d+(?:\.\d+)?)px$/.exec(inset ?? "")?.[1] ?? Number.NaN);
    expect(outset, `the reticle stands outside the box it marks: inset ${inset ?? "?"}`).toBeGreaterThan(0);
    // With no block padding, the room above and below the door is what the row leaves beside its
    // hairline — less than the outset at every density, so a clipping cell would cut the ticks off.
    for (const density of ["compact", "comfortable"] as const) {
      const table = densityTable(density);
      const row = resolvePx("var(--row-h)", table) ?? Number.NaN;
      const door = doorHeight(declaredValue(PANEL, DOOR, "block-size") ?? "", table);
      expect((row - HAIRLINE - door) / 2, `${density}: the door stands closer to its cell's edge than the reticle's outset`).toBeLessThan(outset);
    }
    expect(declaredValue(PANEL, DOOR_CELL, "overflow"), "so the door's cell does not clip what it holds").toBe("visible");
  });

  test("the door stands at the row's trailing edge, named with the row rule it outranks", () => {
    // The old `.cx-site-facts-door { text-align: end }` lost to `.cx-site-facts-line > td`'s `start`
    // (a class plus an element outranks a class), so the door painted start-aligned in its column.
    expect(declaredValue(PANEL, DOOR_CELL, "text-align")).toBe("end");
  });
});

describe("I-440: the basis chip has a slot of its own", () => {
  test("the Basis column is declared, and the Fact column no longer carries a chip's width", () => {
    expect(declaredValue(PANEL, ".cx-site-facts-col-basis", "inline-size"), "the chip's own column").toBe("108px");
    expect(declaredValue(PANEL, ".cx-site-facts-col-fact", "inline-size"), "the name's column, the chip's 40 px handed on").toBe("220px");
    expect(declaredValue(PANEL, ".cx-site-facts-fact-inner", "display"), "no flex row stands in front of a name any more").toBeNull();
  });
});

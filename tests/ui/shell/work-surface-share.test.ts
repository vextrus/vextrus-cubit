/**
 * THE WORK-SURFACE LAW, PROVED AS ARITHMETIC (R-UI-080; Design Direction 00 §1, §3.1).
 *
 * "On S-Viewer and S-Measure the canvas is ≥ 70 % of a 1440×900 viewport (≥ 906 000 px²)… the
 * canvas is 1440 − 48 − 200 − (320 if selected) = 872–1192 wide × 900 − 40 − 32 − 24 = 804 tall;
 * with no selection 1192×804 = 74 %."
 *
 * The share is computed from THE SHELL'S OWN GRID — the `grid-template-columns` of `.cx-shell` and
 * the `grid-template-rows` of `.cx-shell-body`, resolved through the root layout tokens those
 * templates actually name — and never from a screenshot. A picture can only tell you the law broke
 * after someone drew it; this names the declaration that broke it. The reader is the one the craft
 * rubric's mechanical half already uses (`tests/support/stylesheet.ts`, B-17).
 *
 * It reads the ROOT TOKEN VALUES rather than literals in `shell.css` deliberately: the arithmetic is
 * only worth anything if it is proved against the numbers the shell actually consumes, so a chrome
 * height quietly revalued at the root fails here rather than passing against a stale copy.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { customProperties, declaredValue, gridTracks, resolvePx, withoutComments } from "../../support/stylesheet";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const at = (path: string): string => readFileSync(join(REPO_ROOT, path), "utf8");

const GLOBALS = at("src/ui/theme/globals.css");
const SHELL = at("src/ui/shell/shell.css");

/** The root layout tokens (§4.2): `:root` and the density blocks, which is where they are declared. */
const TOKENS = customProperties(GLOBALS, /^(:root|\[data-density="compact"\]|:root,\s*\[data-density="compact"\])$/m);

/** The Direction's own two viewports (§3.1, §7: "both viewports are measured"). */
const VIEWPORTS = [
  { name: "1440×900", width: 1440, height: 900 },
  { name: "1280×800", width: 1280, height: 800 },
] as const;

/** §1's bar for the viewer's canvas, and §7 C1's own target. */
const CANVAS_SHARE = 0.7;
/** R-UI-081: the primary canvas or grid starts within 240 px of the top of main. */
const FOLD_PX = 240;

function token(name: string): number {
  const declared = TOKENS[name];
  expect(declared, `${name} is declared at the root — the shell's grid names it (Direction §4.2)`).toBeDefined();
  const px = resolvePx(declared as string, TOKENS);
  expect(px, `${name} resolves to a length; "${declared ?? ""}" does not`).not.toBeNull();
  return px as number;
}

/** The tracks `.cx-shell` lays its three columns on, as the sheet states them. */
function shellColumns(selector: string): string[] {
  const value = declaredValue(SHELL, selector, "grid-template-columns");
  expect(value, `${selector} declares grid-template-columns — the frame's columns are its own`).not.toBeNull();
  return gridTracks(value as string);
}

/** A track's width in px; a flexible track (`1fr`, `minmax(0, 1fr)`, `auto`) has none of its own. */
function fixedTrack(track: string): number | null {
  return resolvePx(track, TOKENS);
}

describe("R-UI-080: the work surface, measured from the shell's own grid", () => {
  test("§4.2: the chrome geometry the grid names is declared at the root, at the Direction's numbers", () => {
    expect(token("--rail-w"), "the icon rail is 48 px (R-UI-080: 56 or less)").toBe(48);
    expect(token("--topbar-h"), "the top bar is 40 px (was --space-12 = 48)").toBe(40);
    expect(token("--toolbar-h"), "the tool row is 32 px").toBe(32);
    expect(token("--status-h"), "the readout is 24 px").toBe(24);
    expect(token("--inspector-w"), "the inspector is 320 px").toBe(320);
    expect(token("--inspector-w-min")).toBe(280);
    expect(token("--inspector-w-max")).toBe(480);
    expect(token("--drawer-w"), "the layers drawer is 200 px (§3.1)").toBe(200);
  });

  test("§3.1: with nothing selected the shell's inspector column is ZERO — absent, not a placeholder", () => {
    const columns = shellColumns(".cx-shell");
    expect(columns.length, ".cx-shell lays three columns: rail, body, inspector").toBe(3);
    expect(fixedTrack(columns[0] as string), "the first track is the rail's width token").toBe(token("--rail-w"));
    expect(fixedTrack(columns[1] as string), "the middle track is flexible — the body takes what is left").toBeNull();
    expect(fixedTrack(columns[2] as string), "the inspector track is 0 until something is selected (R-UI-080)").toBe(0);
  });

  test("§3.1: with a selection the inspector column is the remembered width, bounded by the Direction's min and max", () => {
    const columns = shellColumns(".cx-shell:has(.cx-shell-inspector)");
    expect(columns.length, "the selected frame lays the same three columns").toBe(3);
    expect(columns[2], "the third track sizes to the slot, which carries the remembered width").toBe("auto");
    // The bounds are the slot's own, and they are the Direction's: a remembered width outside them
    // is not a width a person can reach (R-UI-005).
    expect(declaredValue(SHELL, ".cx-shell-inspector", "min-width")).toBe("var(--inspector-w-min)");
    expect(declaredValue(SHELL, ".cx-shell-inspector", "max-width")).toBe("var(--inspector-w-max)");
  });

  test("§3.1: the body's four rows are the top bar, the tool row, the field and the readout", () => {
    const rows = gridTracks(declaredValue(SHELL, ".cx-shell-body", "grid-template-rows") as string);
    expect(rows.length, ".cx-shell-body lays four rows").toBe(4);
    expect(fixedTrack(rows[0] as string)).toBe(token("--topbar-h"));
    expect(fixedTrack(rows[1] as string)).toBe(token("--toolbar-h"));
    expect(fixedTrack(rows[2] as string), "the field is the flexible row — it takes what the chrome leaves").toBeNull();
    expect(fixedTrack(rows[3] as string)).toBe(token("--status-h"));
  });

  test.each(VIEWPORTS)(
    "§1: at $name with nothing selected the canvas is ≥ 70 % of the viewport, by the grid's own arithmetic",
    ({ name, width, height }) => {
      const columns = shellColumns(".cx-shell");
      const rail = fixedTrack(columns[0] as string) as number;
      const inspector = fixedTrack(columns[2] as string) as number;
      const rows = gridTracks(declaredValue(SHELL, ".cx-shell-body", "grid-template-rows") as string);
      const chrome = [rows[0], rows[1], rows[3]].map((track) => fixedTrack(track as string) as number);
      const [topbar, toolbar, status] = chrome as [number, number, number];

      // The layers drawer is the viewer screen's own region inside the field, and §3.1 spends it
      // before the canvas: the share is judged against what is left after it, never before.
      const drawer = token("--drawer-w");
      const canvasWidth = width - rail - inspector - drawer;
      const canvasHeight = height - topbar - toolbar - status;
      const share = (canvasWidth * canvasHeight) / (width * height);

      expect(canvasWidth, `${name}: the field is wider than nothing after the rail, the drawer and the (absent) inspector`).toBeGreaterThan(0);
      expect(
        share,
        `${name}: canvas ${canvasWidth}×${canvasHeight} = ${(share * 100).toFixed(1)} % of ${width}×${height}; §1 fixes ≥ 70 % and the chrome the grid declares is rail ${rail} + drawer ${drawer} + inspector ${inspector} wide, top bar ${topbar} + tool row ${toolbar} + readout ${status} tall`,
      ).toBeGreaterThanOrEqual(CANVAS_SHARE);
    },
  );

  test("§3.1's fold rule: at 1440×900 the whole frame is above the fold and the canvas starts within 240 px of the top of main", () => {
    const rows = gridTracks(declaredValue(SHELL, ".cx-shell-body", "grid-template-rows") as string);
    const topbar = fixedTrack(rows[0] as string) as number;
    const toolbar = fixedTrack(rows[1] as string) as number;
    const status = fixedTrack(rows[3] as string) as number;

    // "Above the fold at 1440×900: everything." The rows are fixed-plus-one-flexible over a frame
    // that is exactly the viewport tall, so the chrome and the field sum to the viewport and nothing
    // is pushed below it — there is no scroll to be above or below the fold OF.
    expect(declaredValue(SHELL, ".cx-shell-body", "height"), "the frame is exactly the viewport tall, so the readout sits on the fold, never under it").toBe("100dvh");
    expect(topbar + toolbar + status, "the chrome leaves 804 px of field at 900 (§3.1)").toBe(900 - 804);

    // R-UI-081: the canvas begins where the tool row ends — 0 px into main, and 72 into the page.
    expect(topbar + toolbar).toBeLessThanOrEqual(FOLD_PX);
  });

  test("R-UI-086: the shell's sheet declares no [data-density] selector — density switches at the root", () => {
    expect(withoutComments(SHELL).includes("[data-density"), "a per-screen density twin is the drift R-UI-086 closes").toBe(false);
    expect(/var\(\s*--(?:graphite|beam)-[0-9]+\s*\)/.test(withoutComments(SHELL)), "the frame consumes semantic aliases only").toBe(false);
  });
});

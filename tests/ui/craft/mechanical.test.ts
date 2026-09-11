/**
 * The craft rubric's mechanical half, at the source (Design Direction 00 §7).
 *
 * The rubric scores twelve criteria per screen and eight of them can only be read from a rendered
 * DOM after `settled()` — those belong to the node that rebuilds the screens and takes the pictures.
 * Four can be read from the stylesheets a screen is drawn by, and those are the foundation's own:
 * C8 (tokens-only colour, the 4-pt grid, the type scale) and the half of C4/C5 that is a geometry
 * a stylesheet states outright. They are checked here, where a failure names the declaration that
 * caused it rather than a pixel in a picture.
 *
 * The scores are printed per screen, always — a number nobody sees is a number nobody improves —
 * and the two properties the foundation has just made true are asserted, so they cannot quietly
 * stop being true: no screen spells a colour, and no screen spells a primitive ramp position.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
// The one reader of "what does this stylesheet declare" (B-17): the shell's work-surface arithmetic
// reads the same way, and a second spelling of it would be the drift this suite exists to catch.
import { pixelsIn } from "../../support/stylesheet";
// The declaration reader is a real tokenizer (comments, strings, nested parens, multi-line values,
// one-line rules), not a line regex. Every check below reads DECLARATIONS; the reader it replaced
// read LINES, and a value that wrapped, a rule written on one line and a `;` inside a `url()` each
// walked straight past it — see tests/ui/craft/css-tokenizer.test.ts, which keeps the old reader as
// a payload and asserts what it missed.
import { readDeclarations } from "../../support/css-tokens";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

/** Every stylesheet a screen is drawn by: the app routes' own, one file per screen. */
function screenSheets(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) screenSheets(path, out);
    else if (entry.endsWith(".css")) out.push(path);
  }
  return out;
}

const SPACING = /^(padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left)(-|$)/;
/** R-UI-003's scale. A size off it is a size nobody chose. */
const TYPE_SCALE = new Set([12, 13, 14, 16, 20, 24, 32]);
/** R-UI-001's two row heights and §4.2's four control heights (§1, §4.2). */
const HEIGHTS = new Set([24, 28, 32, 36, 40, 48]);

/**
 * The heights that are lawfully off the C4 set, each with the reason it is not a control, a row or a
 * chrome — which is what C4 is about. A declaration is excused by the SELECTOR it stands under, not
 * by its file, so the same class moved to another sheet keeps its excuse and a different class in
 * the same sheet gets none. The roster is asserted from both sides below: an unexcused height fails,
 * and an excuse that no longer fires is dead wood and fails too.
 */
const NOT_A_CONTROL: Readonly<Record<string, string>> = {
  ".cx-gallery-scroll": "a gallery demo box — the viewport a scroll area is DEMONSTRATED in, not a control anybody operates",
  ".cx-gallery-resizable": "the same, for the resizable pane: the box exists so a reader can see the handle move",
  ".cx-gallery-table": "the same, for the table: a fixed demo viewport is what makes the sticky header visible at all",
  ".cx-home-pause": "the visually-hidden idiom (1 px clipped) — a live-region pause a reader hears and nobody sees",
  ".cx-viewer-hidden": "the visually-hidden idiom again, in the viewer's own sheet",
  ".cx-viewer-layer-swatch": "a colour swatch glyph beside a layer name — a mark, not a control height",
};

/** 5 with nothing to say, one point off per finding, floored at 0 — the rubric's own anchors (§7). */
const scoreOf = (findings: number): number => Math.max(0, 5 - findings);

interface Screen {
  name: string;
  c8Grid: string[];
  c8Type: string[];
  /** Heights off the C4 set that NO exception excuses — the findings the score is taken from. */
  c4Heights: string[];
  /** Which exceptions this sheet actually used, so a dead one can be found. */
  excused: string[];
  colour: string[];
}

function measure(file: string): Screen {
  const css = readFileSync(file, "utf8");
  const name = relative(join(REPO_ROOT, "src/app"), file);
  const screen: Screen = { name, c8Grid: [], c8Type: [], c4Heights: [], excused: [], colour: [] };
  for (const decl of readDeclarations(css)) {
    const under = decl.scope.at(-1) ?? "";
    const where = `${name}:${decl.line} ${under} { ${decl.prop}: ${decl.value} }`;
    if (SPACING.test(decl.prop)) {
      for (const px of pixelsIn(decl.value)) if (Math.abs(px) % 4 !== 0) screen.c8Grid.push(where);
    }
    if (decl.prop === "font-size") {
      for (const px of pixelsIn(decl.value)) if (!TYPE_SCALE.has(px)) screen.c8Type.push(where);
    }
    if (decl.prop === "height" || decl.prop === "min-height") {
      for (const px of pixelsIn(decl.value)) {
        if (HEIGHTS.has(px)) continue;
        if (NOT_A_CONTROL[under] !== undefined) screen.excused.push(under);
        else screen.c4Heights.push(where);
      }
    }
    // C8's first half is already a lint (cubit/no-colour-literal, cubit/no-primitive-token); this
    // reads the same property from the file so the score prints beside the others.
    if (/#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/.test(decl.value)) screen.colour.push(where);
    if (/var\(\s*--(?:graphite|beam)-[0-9]+\s*\)/.test(decl.value)) screen.colour.push(where);
  }
  return screen;
}

describe("Design Direction 00 §7: the rubric's mechanical checks, at the source", () => {
  const screens = screenSheets(join(REPO_ROOT, "src/app")).map(measure);

  test("§7: the per-screen mechanical scores", () => {
    expect(screens.length, "the app draws its screens from stylesheets this check can read").toBeGreaterThan(8);
    const rows = screens
      .map((s) => {
        const c8 = scoreOf(s.c8Grid.length + s.c8Type.length + s.colour.length);
        const c4 = scoreOf(s.c4Heights.length);
        return { name: s.name, C8: c8, "C4 (geometry)": c4, mean: Number(((c8 + c4) / 2).toFixed(1)) };
      })
      .sort((a, b) => a.mean - b.mean);
    // Printed, always: the rubric's numbers are the screen's next three fixes, and a number nobody
    // sees is a number nobody improves (§7). The full twelve are the Surveyor's, from the DOM.
    console.table(rows);
  });

  test("C4: every height a screen states outright is a control, row or chrome height", () => {
    // This is the assertion this suite did not make. `c4Heights` was computed, fed to console.table
    // and asserted against NOTHING: the column printed a score nobody could fail, which is worse
    // than printing nothing, because it looked like a check. §1 and §4.2 fix the six heights the
    // product is drawn at; a seventh is a height nobody chose, and it fails here by name.
    const offences = screens.flatMap((s) => s.c4Heights);
    expect(offences, `a height off the C4 set {${[...HEIGHTS].join(", ")}} — add the control to the scale, or name it in NOT_A_CONTROL with its reason (§1, §4.2)`).toEqual([]);
  });

  test("C4: every declared exception is still earning its place", () => {
    const used = new Set(screens.flatMap((s) => s.excused));
    const dead = Object.keys(NOT_A_CONTROL).filter((selector) => !used.has(selector));
    expect(dead, "an exception that no longer fires is a licence nobody needs — delete it (B-19)").toEqual([]);
  });

  test("C8: no screen spells a colour, and no screen spells a position on a primitive ramp", () => {
    const offences = screens.flatMap((s) => s.colour);
    expect(offences, "colour lives in the token source; a screen reads a semantic alias (R-UI-001, §4)").toEqual([]);
  });

  test("C8: every spacing a screen states outright is on the 4-pt grid", () => {
    const offences = screens.flatMap((s) => s.c8Grid);
    expect(offences, "the grid is 4 pt; a padding off it is a padding nobody chose (§4.2)").toEqual([]);
  });

  test("C8: every font size a screen states outright is on R-UI-003's scale", () => {
    const offences = screens.flatMap((s) => s.c8Type);
    expect(offences, "a size off the scale is a size nobody chose (R-UI-003)").toEqual([]);
  });
});

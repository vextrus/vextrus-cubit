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

type Decl = { prop: string; value: string; line: number };

function declarations(css: string): Decl[] {
  const out: Decl[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  for (const [index, line] of text.split("\n").entries()) {
    const match = /^\s*([-a-z]+)\s*:\s*([^;]+);/.exec(line);
    if (match !== null) out.push({ prop: match[1] as string, value: (match[2] as string).trim(), line: index + 1 });
  }
  return out;
}

/** A length a declaration states outright, in px; a `var()` states no number and is not one. */
const pixelsIn = (value: string): number[] =>
  [...value.matchAll(/(?<![\w-])(-?\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));

const SPACING = /^(padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left)(-|$)/;
/** R-UI-003's scale. A size off it is a size nobody chose. */
const TYPE_SCALE = new Set([12, 13, 14, 16, 20, 24, 32]);
/** R-UI-001's two row heights and §4.2's four control heights. */
const HEIGHTS = new Set([24, 28, 32, 36, 40, 48]);

/** 5 with nothing to say, one point off per finding, floored at 0 — the rubric's own anchors (§7). */
const scoreOf = (findings: number): number => Math.max(0, 5 - findings);

interface Screen {
  name: string;
  c8Grid: string[];
  c8Type: string[];
  c4Heights: string[];
  colour: string[];
}

function measure(file: string): Screen {
  const css = readFileSync(file, "utf8");
  const name = relative(join(REPO_ROOT, "src/app"), file);
  const screen: Screen = { name, c8Grid: [], c8Type: [], c4Heights: [], colour: [] };
  for (const decl of declarations(css)) {
    const where = `${name}:${decl.line} ${decl.prop}: ${decl.value}`;
    if (SPACING.test(decl.prop)) {
      for (const px of pixelsIn(decl.value)) if (Math.abs(px) % 4 !== 0) screen.c8Grid.push(where);
    }
    if (decl.prop === "font-size") {
      for (const px of pixelsIn(decl.value)) if (!TYPE_SCALE.has(px)) screen.c8Type.push(where);
    }
    if (decl.prop === "height" || decl.prop === "min-height") {
      for (const px of pixelsIn(decl.value)) if (!HEIGHTS.has(px)) screen.c4Heights.push(where);
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

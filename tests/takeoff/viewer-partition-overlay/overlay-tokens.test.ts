/**
 * AC-3's last clause and AC-5's stylesheet clause: no colour literal stands in the overlay's module,
 * and the panel's stylesheet carries no `[data-theme]` selector and no colour literal — every
 * light/dark difference arrives through token values (R-UI-001), and every colour the overlay paints
 * is resolved from a token by the screen (Decision I-115).
 *
 * Both are properties OF THE TEXT: a stylesheet that reaches the same colour by a second route is
 * exactly what R-UI-001 forbids, and no rendering of the surface can tell the two apart. The files
 * are found rather than listed, so a module that grows a file is scanned too (B-19).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { OVERLAY_SERVER_MODULE } from "./support/overlay-stage";

/** The checkout the acceptance drives — a mounted set states it, a lane run stands in it. */
const ROOT = process.env["BUILDER_REPO_ROOT"]?.trim() || process.cwd();

/** The module the overlay lives in: the directory its server door stands in (increment interfaces). */
const MODULE_DIR = OVERLAY_SERVER_MODULE.slice(0, OVERLAY_SERVER_MODULE.lastIndexOf("/"));

/** What a colour written by hand looks like, in CSS and in TypeScript alike. */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/;

/** What a theme written as a selector looks like (R-UI-001: never in authored CSS). */
const THEME_SELECTOR = /\[data-theme/;

/** Every file under one directory of the checkout, in code-point order. */
// white-box: AC-3, AC-5 — both criteria are stated about the source's own text ("no colour literal
// appears in the module", "viewer-partition.css carries no [data-theme] selector and no colour
// literal"), and no rendering can tell a tokenised colour from a hand-written one: in each theme
// they paint identical pixels. The files are walked rather than listed so a module that grows a
// file is scanned too (B-19).
function filesUnder(relative: string): string[] {
  const home = join(ROOT, relative);
  expect(existsSync(home), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const walk = (at: string): string[] =>
    readdirSync(at)
      .sort()
      .flatMap((entry) => {
        const path = join(at, entry);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
  return walk(home);
}

/** One file's text, and the first line of it that breaks a rule. */
// white-box: AC-3, AC-5 — the same two criteria: the line is named so the answer says WHERE the
// literal stands, which is the only useful form of a finding about text.
function offending(path: string, pattern: RegExp): string | null {
  const lines = readFileSync(path, "utf8").split("\n");
  const at = lines.findIndex((line) => pattern.test(line));
  return at === -1 ? null : `${path.slice(ROOT.length + 1)}:${at + 1}: ${lines[at]?.trim()}`;
}

describe("AC-3, AC-5: colour is a token's, and a theme is never a selector", () => {
  test("AC-3: no colour literal stands anywhere in the overlay's module", () => {
    // white-box: AC-3 — "no colour literal appears in the module" is a property of the module's own
    // text: a hex reached at run time paints the same pixels as a token does, so no rendering can
    // tell them apart, and the criterion is about which of the two the source spells.
    const files = filesUnder(MODULE_DIR).filter((path) => /\.(ts|tsx|css)$/.test(path));
    expect(files.length, `${MODULE_DIR} holds the overlay's own files`).toBeGreaterThan(0);
    expect(
      files.map((path) => offending(path, COLOUR_LITERAL)).filter((hit) => hit !== null),
      "every colour the overlay paints is resolved from a token by the screen and handed in (Decision I-115)",
    ).toEqual([]);
  });

  test("AC-5: the panel's stylesheet carries no [data-theme] selector and no colour literal", () => {
    // white-box: AC-5 — the criterion is stated about the stylesheet's text, and both halves are
    // invisible to a rendering: a `[data-theme]` branch and a token whose value differs by theme
    // paint identically in each theme, and only the source says which one was written.
    const sheets = filesUnder(MODULE_DIR).filter((path) => path.endsWith("viewer-partition.css"));
    expect(sheets.length, `${MODULE_DIR} holds the panel's stylesheet, beside the panel it dresses`).toBe(1);
    const sheet = sheets[0] as string;
    expect(offending(sheet, THEME_SELECTOR), "every light/dark difference arrives through token values (R-UI-001)").toBeNull();
    expect(offending(sheet, COLOUR_LITERAL), "and every colour is a token's own value").toBeNull();
  });
});

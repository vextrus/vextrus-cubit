/**
 * I-289 — S-BBS's own name is a size the Decision places, and it paints nothing.
 *
 * `.cx-bbs-name` is the visually-hidden `<h1>` the screen carries for a reader who arrives without
 * the crumb beside them (R-UI-012, Decision §5). An `h1` whose size nobody states wears the user
 * agent's 2em — 28 px against the 14 px body — and 28 is not on R-UI-003's scale, so the craft
 * rubric's C11 (`scripts/probe/lib/craft.mjs`, "off-scale sizes 28") reads an off-scale size on a
 * screen that never drew one. The fix is one declaration, and the two things that make it safe are
 * asserted here together: the size is ON the scale, and the rule is still the clipped 1 px idiom,
 * so stating it moves no pixel.
 *
 * The scale is read from the rubric's own source rather than re-typed, so a scale the Direction
 * revalues is the scale this judges against (B-17). The stylesheet reader is the one the rubric's
 * mechanical half already uses (`tests/support/stylesheet.ts`); `tests/ui/craft/mechanical.test.ts`
 * grades every sheet's font sizes as a set, and what it cannot see is a size a sheet never STATES —
 * which is exactly the defect this screen carried. Nothing here opens a database and nothing here
 * measures time (AM-10 §3).
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { customPropertyValues, declaredValue, pixelsIn, ruleBody } from "../../support/stylesheet";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const at = (path: string): string => readFileSync(join(REPO_ROOT, path), "utf8");

/** The screen's own sheet, and the heading rule inside it. */
const SHEET = "src/app/(app)/t/[tenant]/p/[project]/takeoff/bbs/bbs.css";
const BBS = at(SHEET);
const NAME = ".cx-bbs-name";

/** The token table every `var()` in a shipped sheet resolves through — both densities, both real. */
const VARS = customPropertyValues(at("src/ui/tokens.css"), at("src/ui/theme/globals.css"));

/** R-UI-003's type scale, as the rubric's mechanical half spells it (AM-08 Part 2, C11). */
function rubricScale(): number[] {
  const craft = at("scripts/probe/lib/craft.mjs");
  const found = /const SCALE = new Set\(\[([^\]]+)\]\)/.exec(craft);
  expect(found, "the rubric states C11's type scale as `const SCALE = new Set([…])` — read it, never re-type it").not.toBeNull();
  return (found as RegExpExecArray)[1]!.split(",").map((part) => Number(part.trim()));
}

describe("I-289: the visually-hidden screen name states a size, and it is on the scale", () => {
  it("the sheet states a font-size for the heading — it is not left to the user agent", () => {
    const value = declaredValue(BBS, NAME, "font-size");
    expect(value, `${NAME} states its own font-size; unstated, an h1 is the UA's 2em — 28 px off a 14 px body (I-289)`).not.toBeNull();
    // Stated through the alias layer, like every other size on this screen (Decision §5, R-UI-086).
    expect(value as string, "the size is read from the semantic token layer, never spelled as a literal").toMatch(/^var\(--text-[a-z0-9-]+\)$/);
  });

  it("every size that declaration resolves to is on R-UI-003's scale, under both densities", () => {
    const scale = rubricScale();
    expect(scale, "the scale the rubric judges C11 against holds the body sizes this screen is drawn at").toEqual(expect.arrayContaining([13, 14]));
    const sizes = pixelsIn(declaredValue(BBS, NAME, "font-size") as string, VARS);
    expect(sizes.length, "the declaration resolves to a length — a size that resolves to nothing is not a size").toBeGreaterThan(0);
    expect(
      sizes.filter((px) => !scale.includes(px)),
      `a size off the scale {${scale.join(", ")}} is a size nobody chose (R-UI-003); C11 reads it as "off-scale sizes"`,
    ).toEqual([]);
  });

  it("the rule is still the clipped 1 px idiom, so the size it now states paints nothing", () => {
    const body = ruleBody(BBS, NAME);
    expect(body, `${NAME} is declared in ${SHEET}`).not.toBeNull();
    const stated = new Map((body as { prop: string; value: string }[]).map((decl) => [decl.prop, decl.value]));
    expect(stated.get("position"), "the heading is out of flow, so nothing beside it moves").toBe("absolute");
    expect(stated.get("width"), "one pixel wide").toBe("1px");
    expect(stated.get("clip-path"), "and clipped away — read, never shown (R-UI-012)").toBe("inset(50%)");
  });

  it("the heading the sheet is talking about is the screen's one h1", () => {
    // Read, not rendered: the workspace mounts this heading unconditionally, so the class it wears
    // is what decides whether the declaration above lands on the element C11 measures.
    const workspace = at("src/modules/takeoff/bbs-ui/workspace.tsx");
    expect(workspace, "the screen's name is an h1 wearing cx-bbs-name (Decision §1, R-UI-012)").toMatch(/<h1\s+className="cx-bbs-name"/);
  });
});

/**
 * AC-4(a) and AC-4(b) — S-Auth's stylesheet, beside the sheet.
 *
 * The auth column is glued to the top of a tall empty viewport: the page is a flex row that centres
 * on the inline axis only, so on a 1400 px screen the card sits under the padding floor with the
 * rest of the page empty beneath it. The cure is a block-axis centring that cannot lift the column
 * above the floor the Decision fixes — `safe center` — and the Decision's §1 is amended to rule it.
 *
 * The second criterion is the theme's: this sheet holds exactly one `[data-theme]` rule (the I-10
 * mark swap, which cannot travel through token values because the brand colours are founder-fixed
 * inside the vendored assets), and every colour it names is a token read, so dark differs from
 * light through values alone.
 *
 * The CSS is parsed rather than grepped (the `design-gallery-stylesheet` precedent). jsdom lays
 * nothing out and applies no author stylesheet, so a declaration in a shipped sheet has no runtime
 * observable a screen could be asked for — the reads below carry the white-box marker that says so.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const REPO_ROOT = process.cwd();
const SHEET = join(REPO_ROOT, "src/app/(auth)/s-auth.css");
const DECISION = join(REPO_ROOT, "docs/design/s-auth.md");

/** One rule of the sheet: the selector it matches on, and the declarations it carries. */
interface Rule {
  readonly selector: string;
  readonly declarations: ReadonlyMap<string, string>;
  /** The `@media` condition it stands under, or the empty string when it stands unconditionally. */
  readonly condition: string;
}

/** The sheet with its comments gone — a comment is prose, and prose declares nothing. */
function sheetText(): string {
  // white-box: AC-4(a), AC-4(b) — a stylesheet's declarations are its whole subject here, and jsdom
  // applies no author sheet, so there is no rendered observable to ask instead.
  return readFileSync(SHEET, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** Every rule the sheet declares, with the media condition each stands under. */
function rules(): readonly Rule[] {
  const text = sheetText();
  const found: Rule[] = [];
  const collect = (body: string, condition: string): void => {
    for (const match of body.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const selector = (match[1] ?? "").trim();
      if (selector === "") continue;
      const declarations = new Map<string, string>();
      for (const line of (match[2] ?? "").split(";")) {
        const colon = line.indexOf(":");
        if (colon < 0) continue;
        declarations.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
      }
      found.push({ selector, declarations, condition });
    }
  };
  // The at-rule blocks first, then the sheet with them removed, so a rule is collected once.
  let unconditional = text;
  for (const media of text.matchAll(/@media([^{]*)\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
    collect(media[2] ?? "", (media[1] ?? "").trim());
    unconditional = unconditional.replace(media[0], " ");
  }
  collect(unconditional, "");
  return found;
}

/** Every rule whose selector matches a class, whatever else the selector says. */
const rulesFor = (className: string): readonly Rule[] => rules().filter((rule) => rule.selector.split(",").some((part) => part.trim().includes(className)));

/** The whitespace-collapsed form every comparison is made in. */
const norm = (value: string): string => value.replace(/\s+/g, " ").trim();

const decision = (): string => {
  // white-box: AC-4(a) — the Design Decision IS the contract this criterion amends (C-13); there is
  // nothing to render that would answer whether §1 rules the centring.
  return readFileSync(DECISION, "utf8");
};

test("AC-4(a): the auth page centres its column on the block axis, safely", () => {
  const page = rulesFor(".cx-auth-page").filter((rule) => rule.condition === "");
  expect(page.length, "the page ground is declared unconditionally").toBeGreaterThan(0);

  const declared = new Map<string, string>();
  for (const rule of page) for (const [property, value] of rule.declarations) declared.set(property, norm(value));

  expect(declared.get("align-items"), "`safe center` centres the column in the spare height and refuses to lift it out of view on a short viewport").toBe("safe center");
  expect(declared.get("display"), "centring on the block axis needs the flex context the page already is").toBe("flex");
  expect(declared.get("justify-content"), "the inline-axis centring the column already had stands").toBe("center");
});

test("AC-4(a): the spare height it centres in is the viewport's, and the padding floor stands", () => {
  const page = rulesFor(".cx-auth-page").filter((rule) => rule.condition === "");
  const declared = new Map<string, string>();
  for (const rule of page) for (const [property, value] of rule.declarations) declared.set(property, norm(value));

  expect(declared.get("min-height"), "there is spare height to centre in only because the page is at least the viewport tall").toBe("100vh");
  expect(declared.get("padding"), "the padding the Decision fixes is unchanged — the column never rises above it").toBe("var(--space-8) var(--space-4)");

  const further = rulesFor(".cx-auth-page").filter((rule) => rule.condition !== "");
  expect(further.length, "the wider viewport's floor is still a rule of its own").toBeGreaterThan(0);
  const floors = further.flatMap((rule) => [...rule.declarations].filter(([property]) => property === "padding-block-start").map(([, value]) => norm(value)));
  expect(floors, "the ≥ sm floor is the doubled space-12 the Decision fixes").toContain("calc(var(--space-12) * 2)");
  for (const rule of further) {
    expect(rule.condition, "the floor is the wider-viewport rule, keyed on a min-width").toContain("min-width");
  }
});

test("AC-4(a): the Decision's §1 rules the centring it is built against", () => {
  const text = decision();
  const from = text.indexOf("## 1.");
  const to = text.indexOf("## 2.");
  expect(from >= 0 && to > from, "the Decision lays the frame out in a section of its own (C-13)").toBe(true);
  const section = norm(text.slice(from, to));

  expect(section, "§1 rules the block-axis centring the stylesheet is built against — the Decision is the contract, not the commit message").toContain("safe center");
  expect(section, "and it still fixes the padding as the floor the column never rises above").toContain("var(--space-8)");
});

test("AC-4(b): the sheet holds exactly one [data-theme] rule", () => {
  const themed = rules().filter((rule) => rule.selector.includes("[data-theme"));
  expect(themed.length, `dark differs from light through token values alone; the one exception is the I-10 mark swap (found: ${themed.map((rule) => rule.selector).join(" | ")})`).toBe(1);
  expect(themed[0]?.selector, "and the exception is the mark, whose brand colours are founder-fixed inside the vendored assets").toContain(".cx-auth-mark");
});

test("AC-4(b): every colour the sheet names is a token read", () => {
  // The properties whose values are colours — the CSS language's own list, not this sheet's roster,
  // so a colour spelled on a property the sheet does not use today is caught the day it appears.
  const COLOUR_PROPERTIES = new Set([
    "color",
    "background",
    "background-color",
    "border-color",
    "border-block-color",
    "border-inline-color",
    "outline-color",
    "text-decoration-color",
    "caret-color",
    "accent-color",
    "fill",
    "stroke",
    "column-rule-color",
  ]);
  /** Colour as a literal may be written: hex, or one of the notation functions. */
  const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/;

  const offences: string[] = [];
  for (const rule of rules()) {
    for (const [property, value] of rule.declarations) {
      if (LITERAL.test(value)) offences.push(`${rule.selector} { ${property}: ${value} }`);
      if (!COLOUR_PROPERTIES.has(property)) continue;
      if (!value.includes("var(--")) offences.push(`${rule.selector} { ${property}: ${value} } names a colour that is not a token read`);
    }
  }
  expect(offences, "R-UI-001: every colour value is a token read, so dark flips values and never consumer code").toEqual([]);
});

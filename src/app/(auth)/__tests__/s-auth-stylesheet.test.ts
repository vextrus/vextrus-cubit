/**
 * AC-4(a) and AC-4(b) — S-Auth's stylesheet, beside the sheet.
 *
 * AC-4(a), re-baselined to Design Direction 00 §3.7 (B-20; §3 outranks a screen Decision's geometry
 * and this Decision is amended in place). The criterion was written against a block-axis centring —
 * `align-items: safe center` — which cured a column glued to the top of a tall empty viewport by
 * putting it in the middle of the spare height. §3.7 rules the auth column onto a DATUM instead:
 * the mark on the padding floor, the card 48 px under it, the readout at the foot, the same three
 * lines on every auth route at every viewport, which is what makes the stills of the set lay side
 * by side as one instrument (§9.3) and what keeps the card above the fold C2 measures. The fault
 * the old rule repaired cannot return under the new one from the other side either: a column that
 * never rises above the padding cannot be lifted out of reach on a short viewport, and the page
 * scrolls under it.
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

test("AC-4(a): the auth page stands its column on the datum, on the block axis", () => {
  const page = rulesFor(".cx-auth-page").filter((rule) => rule.condition === "");
  expect(page.length, "the page ground is declared unconditionally").toBeGreaterThan(0);

  const declared = new Map<string, string>();
  for (const rule of page) for (const [property, value] of rule.declarations) declared.set(property, norm(value));

  expect(declared.get("display"), "the column is laid on the block axis, so the page is a flex context").toBe("flex");
  expect(declared.get("flex-direction"), "mark over card over readout: one column, in that order (§3.7)").toBe("column");
  expect(declared.get("align-items"), "and it is centred on the inline axis, which is what `centred` means here").toBe("center");
  expect(declared.get("justify-content"), "the block axis is the datum's: the column starts at the padding and stays there").toBeUndefined();
});

test("AC-4(a): the datum is the padding, and the page is at least the viewport tall", () => {
  const page = rulesFor(".cx-auth-page").filter((rule) => rule.condition === "");
  const declared = new Map<string, string>();
  for (const rule of page) for (const [property, value] of rule.declarations) declared.set(property, norm(value));

  expect(declared.get("min-height"), "the ground fills the viewport, whatever the column's height").toBe("100vh");
  expect(
    declared.get("padding"),
    "the block padding IS the resting place under §3.7: 24 above the mark puts the card's top at 112 px, inside C2's 120 px fold at both viewports",
  ).toBe("var(--space-6) var(--space-4)");

  const conditional = rulesFor(".cx-auth-page").filter((rule) => rule.condition !== "");
  expect(
    conditional,
    "the datum does not move with the viewport — a wider-viewport floor would drop the card below the fold it is fixed above",
  ).toEqual([]);
});

test("AC-4(a): the card and the mark are the geometry §3.7 rules", () => {
  const card = new Map<string, string>();
  for (const rule of rulesFor(".cx-auth-card")) for (const [property, value] of rule.declarations) card.set(property, norm(value));
  expect(card.get("background-color"), "the card stands on the panel surface, not on the page ground (§3.7)").toBe("var(--surface-panel)");
  expect(card.get("border"), "with the instrument's own hairline").toBe("var(--hairline)");
  expect(card.get("border-radius"), "and radius 8").toBe("var(--radius-8)");

  const column = new Map<string, string>();
  for (const rule of rulesFor(".cx-auth-column").filter((rule) => !rule.selector.includes("data-width"))) {
    for (const [property, value] of rule.declarations) column.set(property, norm(value));
  }
  expect(column.get("width"), "360 wide, and never wider than the viewport less its gutters").toBe("min(360px, calc(100vw - var(--space-8)))");

  const mark = new Map<string, string>();
  for (const rule of rulesFor(".cx-auth-mark img")) for (const [property, value] of rule.declarations) mark.set(property, norm(value));
  expect(mark.get("height"), "the full spark mark at 40 px — above R-UI-070's 32 px floor for the spark").toBe("40px");

  const wrapper = new Map<string, string>();
  for (const rule of rulesFor(".cx-auth-mark").filter((rule) => rule.selector.trim() === ".cx-auth-mark")) {
    for (const [property, value] of rule.declarations) wrapper.set(property, norm(value));
  }
  expect(wrapper.get("align-self"), "centred over the card").toBe("center");
  expect(wrapper.get("margin-block-end"), "48 px above the card (§3.7's region table)").toBe("var(--space-12)");
});

test("AC-4(a): the Decision's §1 rules the datum it is built against", () => {
  const text = decision();
  const from = text.indexOf("## 1.");
  const to = text.indexOf("## 2.");
  expect(from >= 0 && to > from, "the Decision lays the frame out in a section of its own (C-13)").toBe(true);
  const section = norm(text.slice(from, to));

  expect(section, "§1 rules the datum the stylesheet is built against — the Decision is the contract, not the commit message").toContain("datum");
  expect(section, "and it fixes the card's measure at §3.7's 360").toContain("360px");
  expect(section, "and the padding that is the datum itself").toContain("var(--space-6)");
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

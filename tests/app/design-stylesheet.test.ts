/**
 * AC-4(c)(d): the design gallery's stylesheet tells the truth about itself, and its Dropzone samples
 * share one size.
 *
 * R-UI-001 admits px in this file only as I-19's demo geometry constants and I-20's one media
 * condition, and the file states how many of each it holds. A comment that says "four" over five
 * declarations is a comment that has stopped being read — the count is DERIVED here from the
 * declarations themselves and compared with whatever the comment claims, so the check survives a
 * later increment adding or removing a sample (B-19).
 *
 * Both criteria are properties of the stylesheet's text; each read is marked below.
 */
import { describe, expect, test } from "vitest";
// white-box: AC-4(c)(d) — the criterion is an agreement between a comment and the declarations
// beside it, and a rule in a stylesheet jsdom never applies (the unit lane stubs the CSS import and
// computes no layout). Neither half has a runtime observable here.
import { lexed, sourceOf } from "./support/sources";

const DESIGN_CSS = "src/app/(app)/design/design.css";

/** A px length as CSS writes one. */
const PX_VALUE = /\b\d+(?:\.\d+)?px\b/g;

/** How a count is written in prose here: as a numeral, or as one of the words a comment would use. */
const NUMBER_WORDS: Readonly<Record<string, number>> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/** The code channel with every `@media` condition blanked: what is left is declarations only. */
function declarationsOf(code: string): string {
  let masked = code;
  for (const match of code.matchAll(/@media[^{]*\{/g)) {
    masked = masked.slice(0, match.index) + " ".repeat(match[0].length) + masked.slice(match.index + match[0].length);
  }
  return masked;
}

/** How far from the word "constant" a number has to be to still be a count OF the constants. */
const CLAIM_WINDOW = 40;

/**
 * The counts a comment claims about its px constants — the numbers standing beside the word itself,
 * so a sentence elsewhere in the same comment that counts something else ("the one media condition")
 * is not read as a claim about these. Bible and Interpretation ids, section marks and px lengths are
 * numbers a comment lawfully carries that are not counts, so they are removed first — otherwise
 * "R-UI-001" would be a claim of one.
 */
function claimsIn(comment: string): number[] {
  const prose = comment
    .replace(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g, " ")
    .replace(/§\s*\d+/g, " ")
    .replace(PX_VALUE, " ");
  const claims: number[] = [];
  for (const anchor of prose.matchAll(/\bconstants?\b/gi)) {
    const window = prose.slice(Math.max(0, anchor.index - CLAIM_WINDOW), anchor.index + anchor[0].length + CLAIM_WINDOW);
    for (const match of window.matchAll(/\b\d+\b/g)) claims.push(Number(match[0]));
    for (const [word, value] of Object.entries(NUMBER_WORDS)) {
      if (new RegExp(`\\b${word}\\b`, "i").test(window)) claims.push(value);
    }
  }
  return claims;
}

describe("AC-4: the gallery stylesheet states its own px honestly", () => {
  test("AC-4: every count the px-constants comment claims is the count the file actually holds", () => {
    // white-box: AC-4(c) — the criterion IS the agreement between a comment and the declarations
    // beside it; a rendered gallery cannot observe what its stylesheet says about itself.
    const { code, comments } = lexed(DESIGN_CSS);
    const constants = [...declarationsOf(code).matchAll(PX_VALUE)].map((match) => match[0]);

    const stating = comments.filter((comment) => /px/.test(comment) && /\bconstants?\b/i.test(comment));
    expect(stating.length, `${DESIGN_CSS} must state its px constants in a comment — R-UI-001 admits them only as I-19's demo geometry`).toBeGreaterThan(0);

    for (const comment of stating) {
      const claims = claimsIn(comment);
      expect(claims.length, `a px-constants comment that names no count says nothing: "${comment}"`).toBeGreaterThan(0);
      for (const claim of claims) {
        expect(claim, `the file declares ${constants.length} px constants (${JSON.stringify(constants)}) and this comment claims ${claim}: "${comment}"`).toBe(constants.length);
      }
    }
  });

  test("AC-4: the one further px — the media condition — is stated too", () => {
    // white-box: AC-4(c) — same criterion, its second half.
    const { code, comments } = lexed(DESIGN_CSS);
    const conditions = [...code.matchAll(/@media([^{]*)\{/g)].flatMap((match) => [...String(match[1]).matchAll(PX_VALUE)].map((px) => px[0]));
    expect(conditions.length, `${DESIGN_CSS} states a media condition in px (I-20) — a media query is evaluated before the cascade and cannot read the token`).toBeGreaterThan(0);

    for (const px of conditions) {
      expect(
        comments.some((comment) => comment.includes(px)),
        `the media condition ${px} is a px this file holds and no comment names it — I-20 asks the file to say which token's value it is spelling`,
      ).toBe(true);
    }
  });

  test("AC-4: the Dropzone samples are laid out at one width, read from a token", () => {
    // white-box: AC-4(d) — the criterion names a selector and the declarations inside it; the
    // gallery renders no layout under jsdom, so the rule is read where it is written.
    const source = sourceOf(DESIGN_CSS);
    const rule = /\[data-entry\$=(["'])\/Dropzone\1\][^{}]*\{([^}]*)\}/.exec(source);
    expect(rule, `${DESIGN_CSS} must lay the Dropzone samples out at one size — a rule selecting [data-entry$="/Dropzone"]`).not.toBeNull();

    const declarations = String(rule?.[2] ?? "");
    const width = /(?:^|;)\s*width\s*:\s*([^;]+)/.exec(declarations);
    expect(width, `the Dropzone rule must declare a width — it declares: ${JSON.stringify(declarations.trim())}`).not.toBeNull();
    expect(/var\(\s*--[\w-]+/.test(String(width?.[1] ?? "")), `R-UI-001: the sample width is a token read, not a number — it is ${JSON.stringify(String(width?.[1] ?? "").trim())}`).toBe(true);
    expect(/(?:^|;)\s*max-width\s*:\s*100%/.test(declarations), "and it never outgrows its card: max-width: 100%").toBe(true);
  });
});

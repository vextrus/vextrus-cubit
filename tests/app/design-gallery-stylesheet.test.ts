// The gallery's stylesheet (src/app/(app)/design/design.css). Its comments make a claim about
// itself — how many px constants I-19 admits — and a claim a reader cannot check is worse than no
// claim; and the one rule that kept the Dropzone samples a single size has to be a rule, not a
// side effect of another entry's width.
import { expect, test } from "vitest";
import { commentsOf, withoutComments } from "./support/source-facts";

const DESIGN_CSS = "src/app/(app)/design/design.css";

/** Numbers as a comment may write them: a word, or the digits themselves. */
const WORDS: Readonly<Record<string, number>> = {
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
const NUMBER = `(?:\\d+|${Object.keys(WORDS).join("|")})`;

function valueOf(token: string): number {
  return WORDS[token.toLowerCase()] ?? Number(token);
}

/** The stylesheet with its comments gone: declarations and selectors, as the browser reads them. */
function declarations(): string {
  return withoutComments(DESIGN_CSS);
}

/** The `@media` preludes, which are conditions rather than declarations. */
function mediaConditions(): string[] {
  return [...declarations().matchAll(/@media([^{]*)\{/g)].map((match) => match[1] ?? "");
}

test("AC-4(c): the px count the comments claim is the px count the stylesheet holds", () => {
  // white-box: AC-4(c) — the criterion IS the agreement between a comment and the code beside it;
  // a self-description has no runtime observable.
  const withoutMedia = declarations().replace(/@media[^{]*\{/g, " ");
  const constants = [...withoutMedia.matchAll(/\b\d+(?:\.\d+)?px\b/g)].map((match) => match[0]);
  expect(constants.length, "a stylesheet with no px constant makes no claim worth checking").toBeGreaterThan(0);

  const claims: { comment: string; claimed: number }[] = [];
  for (const comment of commentsOf(DESIGN_CSS)) {
    const patterns = [new RegExp(`\\b(${NUMBER})\\b(?:\\s+\\S+){0,3}\\s+constants?\\b`, "gi"), new RegExp(`\\bconstants?\\b(?:\\s+\\S+){0,4}?\\s+(${NUMBER})\\b`, "gi")];
    for (const pattern of patterns) {
      for (const match of comment.matchAll(pattern)) claims.push({ comment, claimed: valueOf(match[1] ?? "") });
    }
  }
  expect(claims.length, "no comment states how many px constants this file holds").toBeGreaterThan(0);
  for (const claim of claims) {
    expect(claim.claimed, `a comment claims ${claim.claimed} px constants where the file declares ${constants.length} (${constants.join(", ")}): ${claim.comment}`).toBe(
      constants.length,
    );
  }
});

test("AC-4(c): the one media condition's px is stated as the further px it is", () => {
  const conditions = mediaConditions();
  expect(conditions.length, "the file states exactly one media condition (I-20)").toBe(1);
  const further = [...(conditions[0] ?? "").matchAll(/\b\d+px\b/g)].map((match) => match[0]);
  expect(further.length, "the condition is spelled in px, because a media query cannot read a token").toBe(1);

  const px = further[0] as string;
  const said = commentsOf(DESIGN_CSS).some((comment) => comment.includes(px) && /media|condition|breakpoint/i.test(comment));
  expect(said, `no comment accounts for ${px}, the one px outside the constants`).toBe(true);
});

test("AC-4(d): one rule of its own keeps the Dropzone samples a single size", () => {
  // white-box: AC-4(d) — "the samples share a size because a rule says so, not because another
  // entry's rule happens to reach them" is a fact about which selector carries the width.
  const rules = [...declarations().matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const dropzone = rules.filter((rule) => /\[data-entry\$=\s*["']\/Dropzone["']\s*\]/.test(rule[1] ?? ""));
  expect(dropzone.length, `${DESIGN_CSS} holds no rule selecting the Dropzone entry`).toBeGreaterThan(0);

  const body = dropzone.map((rule) => rule[2] ?? "").join("\n");
  expect(/(^|[;\s])width:\s*var\(--[^)]+\)/.test(body), "the sample width is a token read (R-UI-001), never a fresh px constant").toBe(true);
  expect(/(^|[;\s])max-width:\s*100%/.test(body), "and it still fits a narrow gallery").toBe(true);
});

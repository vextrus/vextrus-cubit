/**
 * AC-4(c) and AC-4(d) — the two design-system rows whose subjects live at opposite ends of the app
 * tree, judged in one file because one of them is a rule about a stylesheet and the other is a rule
 * about a rationale.
 *
 * AC-4(c): a project card's quick stats are its figures. A count set smaller and fainter than the
 * word beside it reads as the label's footnote, and a card of four zeros reads as a card with
 * nothing on it. The rule is comparative — the count is never the smallest or faintest text on the
 * card — so both sides are read off the sheet and compared, never transcribed (B-19).
 *
 * AC-4(d): the theme resolver's `catch` is empty on purpose, and an empty catch nobody explains is
 * indistinguishable from one somebody forgot. The Decision's theme-resolution section states the
 * reason and the source cites it; `THEME_RESOLVER`'s own text does not move, which is what the
 * merged theme-resolver suite already holds (Q-17: no second test of the same path).
 *
 * The stylesheet is parsed rather than grepped (the `design-gallery-stylesheet` precedent). jsdom
 * applies no author stylesheet and a comment has no runtime observable at all, so both reads carry
 * the white-box marker that says why there is nothing to render instead.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const REPO_ROOT = process.cwd();
const HOME_CSS = join(REPO_ROOT, "src/app/(app)/t/[tenant]/home/home.css");
const RESOLVER = join(REPO_ROOT, "src/app/theme-resolver.ts");
const DECISION = join(REPO_ROOT, "docs/design/root-document.md");

/** The whitespace-collapsed form every comparison is made in. */
const norm = (value: string): string => value.replace(/\s+/g, " ").trim();

/** One class's declarations, gathered from every rule of the sheet whose selector names it. */
function declarationsFor(sheet: string, className: string): Map<string, string> {
  // white-box: AC-4(c) — the criterion compares two declarations of a shipped stylesheet; jsdom
  // applies no author sheet, so there is no computed style a rendered card could be asked for.
  const text = readFileSync(sheet, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
  const declared = new Map<string, string>();
  for (const rule of text.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const selector = (rule[1] ?? "").trim();
    if (!selector.split(",").some((part) => part.trim().includes(className))) continue;
    for (const line of (rule[2] ?? "").split(";")) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      declared.set(line.slice(0, colon).trim(), norm(line.slice(colon + 1)));
    }
  }
  expect(declared.size, `${className} is declared in ${sheet}`).toBeGreaterThan(0);
  return declared;
}

/** The step of the type scale a declaration is set in — `var(--text-13)` is 13. */
function typeStep(value: string | undefined, what: string): number {
  const step = /var\(--text-(\d+)\)/.exec(value ?? "");
  expect(step, `${what} is set in a --text-N token of the scale, never a raw size (got ${String(value)})`).not.toBeNull();
  return Number(step?.[1]);
}

/** Every comment the resolver's source carries, with the resolver's own payload taken out first. */
function resolverComments(resolverText: string, payload: string): string {
  // white-box: AC-4(d) — a rationale for an empty `catch` has no runtime observable: the whole of
  // what the criterion grades is what the file says beside the code. The payload is removed first,
  // because the resolver's own source text names `matchMedia` and `catch` and would otherwise
  // answer the question in place of the comment that owes the answer.
  const withoutPayload = resolverText.split(payload).join(" ");
  const comments = [...withoutPayload.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)].map((match) => match[0]);
  return norm(comments.join(" "));
}

/**
 * The Decision's theme-resolution section, which is where the mechanism is required to be recorded
 * — with the resolver's own source, which the section quotes verbatim, taken out first. The quoted
 * code names `matchMedia` and spells the `catch` itself, and a section that only quotes the code
 * has not explained it.
 */
function themeResolutionSection(payload: string): string {
  const text = readFileSync(DECISION, "utf8");
  const from = text.indexOf("### Theme resolution");
  expect(from >= 0, "docs/design/root-document.md records the theme-resolution mechanism in a section of its own (C-13)").toBe(true);
  const rest = text.slice(from + 1);
  const to = rest.indexOf("\n### ");
  return norm((to < 0 ? rest : rest.slice(0, to)).split(payload).join(" "));
}

/** A word said in prose, not a syllable inside another one — "default" is not a fault. */
const says = (text: string, word: string): boolean => new RegExp(`\\b${word}\\b`, "i").test(text);

test("AC-4(c): the quick-stat count is never set smaller than the label beside it", () => {
  const count = declarationsFor(HOME_CSS, ".cx-home-stat-count");
  const label = declarationsFor(HOME_CSS, ".cx-home-stat-label");

  const countStep = typeStep(count.get("font-size"), "the quick-stat count");
  const labelStep = typeStep(label.get("font-size"), "the quick-stat label");

  expect(countStep, `the figure is the card's data and the word beside it is its caption: ${countStep} may not be smaller than ${labelStep}`).toBeGreaterThanOrEqual(labelStep);
});

test("AC-4(c): the quick-stat count is never the faintest text on the card", () => {
  const count = declarationsFor(HOME_CSS, ".cx-home-stat-count");

  expect(count.get("color"), "the count carries the strongest graphite the card uses for text, so a row of zeros is not the palest thing on it").toBe("var(--graphite-900)");
});

test("AC-4(d): the Decision states why the resolver's catch is empty", async () => {
  const { THEME_RESOLVER } = (await import("../theme-resolver")) as { THEME_RESOLVER: string };
  const section = themeResolutionSection(THEME_RESOLVER);

  expect(says(section, "catch"), "the section says what the empty `catch` is for — an empty catch nobody explains is one somebody forgot").toBe(true);
  expect(says(section, "matchMedia"), "and it names the call that can be absent or throw").toBe(true);
  expect(says(section, "light"), "and the answer to it: the server's light attribute stands").toBe(true);
  expect(says(section, "fault"), "and why nothing more can be done — there is no seam to record a fault at before first paint").toBe(true);
});

test("AC-4(d): the resolver cites the same reason beside the code", async () => {
  const { THEME_RESOLVER } = (await import("../theme-resolver")) as { THEME_RESOLVER: string };
  // white-box: AC-4(d) — the criterion is the agreement between a comment and the code beside it.
  const source = readFileSync(RESOLVER, "utf8");
  const comments = resolverComments(source, THEME_RESOLVER);

  expect(says(comments, "catch"), "the file says why its `catch` is empty, in its own comments").toBe(true);
  expect(says(comments, "matchMedia"), "naming the call that can be absent or throw").toBe(true);
  expect(says(comments, "fault"), "and why there is nothing to record: no fault seam exists before first paint").toBe(true);
});

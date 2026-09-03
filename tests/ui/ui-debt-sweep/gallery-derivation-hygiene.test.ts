/**
 * AC-2(a)(b)(c): the derivation module's hygiene — what its comments may say (Q-17), where the
 * barrel rule may be spelled (B-17), and which names its barrel publishes.
 *
 * The comment scan reads ONLY comments and the roster scan reads only code, because the two facts
 * are opposites: prose explaining a rule is not a second implementation of it, and a rule spelled
 * in code is not excused by a comment. Both come from `src/core/__tests__/support/read-source.ts`,
 * this tree's one home for that split.
 */
import { describe, expect, test } from "vitest";
import { codeOf, commentsOf } from "../../../src/core/__tests__/support/read-source";
import { filesUnder, productModule } from "./support/sources";

const BARREL_SCAN = "src/ui/gallery-derivation/barrel-scan.ts";
const DERIVATION_SUITE = "src/ui/gallery-derivation/gallery-derivation.test.ts";
const DERIVATION_BARREL = "src/ui/gallery-derivation/index.ts";
const CHROME_MODULE = "src/ui/gallery-derivation/chrome.ts";

/** Q-17's forbidden shapes: build narration and the forward look that dates a comment. */
const PROCESS_NARRATION = /increment|today|later|not yet|for now/i;

/** A Bible id as this tree cites them: R-UI-011, R-SPINE-062, B-17, Q-17, ARCH-01, C-05, L-ACT-02. */
const BIBLE_ID = /\b(?:[A-Z]-[A-Z]+-\d+|ARCH-\d+|[A-Z]-\d+)\b/;

/** The group roster as a string list: a file that spells both group names is spelling the rule. */
const spellsTheGroupRoster = (code: string): boolean => /(["'])primitives\1/.test(code) && /(["'])patterns\1/.test(code);

describe("AC-2a: the barrel scan's comments cite law and narrate no process", () => {
  test("AC-2a: barrel-scan.ts's comments carry no build narration", () => {
    const comments = commentsOf(BARREL_SCAN, "AC-2(a) judges what its comments say");
    const offenders = comments
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => PROCESS_NARRATION.test(line));
    expect(offenders, "Q-17: a src comment cites Bible ids, and never narrates build organisation or the passage of time").toEqual([]);
  });

  test("AC-2a: those comments cite the law they answer to", () => {
    const comments = commentsOf(BARREL_SCAN, "AC-2(a) judges what its comments say");
    expect(BIBLE_ID.test(comments), "Q-17: comments cite Bible ids — the rule this module implements is named").toBe(true);
  });
});

describe("AC-2b: what a barrel is, is spelled once in src/ui", () => {
  test("AC-2b: only barrel-scan.ts spells the barrel-group roster", () => {
    const spelling = filesUnder("src/ui", [".ts", ".tsx"]).filter((file) =>
      spellsTheGroupRoster(codeOf(file, "AC-2(b) scans every module of src/ui, tests included")),
    );
    expect(spelling, "B-17: the groups a barrel may live under are named in barrel-scan.ts and nowhere else in src/ui").toEqual([BARREL_SCAN]);
  });

  test("AC-2b: the derivation's own suite calls the scan rather than restating it", () => {
    const code = codeOf(DERIVATION_SUITE, "AC-2(b) requires the suite beside the derivation to import the scan");
    expect(code, "the suite that binds the roster to the tree reads barrelIdsOnDisk from ./barrel-scan").toMatch(
      /import\s*\{[^}]*\bbarrelIdsOnDisk\b[^}]*\}\s*from\s*["']\.\/barrel-scan["']/,
    );
  });
});

describe("AC-2c: the derivation barrel publishes one door per name", () => {
  test("AC-2c: index.ts does not re-export galleryChrome, and chrome.ts still publishes it", async () => {
    const barrel = await productModule<Record<string, unknown>>(DERIVATION_BARREL, "the gallery derivation's barrel");
    const chrome = await productModule<Record<string, unknown>>(CHROME_MODULE, "the gallery's own two strings live there");

    expect(Object.keys(barrel), "a second door onto galleryChrome is a door the settled reading does not use").not.toContain("galleryChrome");
    expect(Object.keys(chrome), "the design page reads galleryChrome from chrome.ts").toContain("galleryChrome");
  });
});

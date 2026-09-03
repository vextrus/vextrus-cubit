/**
 * AC-5(d) — Q-17 on the sweep's own ground: a comment in `src/` cites Bible ids and states the rule
 * the code enforces; it never narrates the build (an increment id, "not built yet") and never
 * describes a state of affairs that has since moved on ("used to close over", "as before").
 *
 * Comments are read as comments: the source is scanned with quote, template and regex state tracked
 * (`./support/source-text`), so a string-table key, a CSS `url(https://…)` or a glob holding `/*`
 * can never be mistaken for one — and a class name or an identifier in the code can never be
 * mistaken for narration.
 */
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT } from "../../server/support/wire";
import { sourceFilesUnder } from "./support/files";
import { dialectOf, lex, normalise } from "./support/source-text";

/** The ground this sweep owns, exactly as AC-5(d) names it. */
const SWEPT = ["src/ui/shell", "src/ui/screen-states", "src/ui/tokens.ts", "src/ui/theme"];

/** Every dialect a comment can live in here. */
const EXTENSIONS = [".ts", ".tsx", ".css"];

/** The process artifact Q-17 names as a class: an increment id, in any comment. */
const INCREMENT_ID = /inc-\d+/i;

/** The narration the debt rows found, quoted from their own evidence. */
const NARRATION = ["not built yet", "used to close over", "this sentence broke", "as before", "belongs to the primitives"];

interface Offence {
  file: string;
  comment: string;
  reason: string;
}

describe("AC-5(d): the swept ground's comments state rules, not build history (Q-17)", () => {
  test("no comment carries an increment id or the rows' narration", () => {
    const files = SWEPT.flatMap((root) => sourceFilesUnder(join(REPO_ROOT, root), EXTENSIONS));
    expect(files.length, "the swept ground holds files to read").toBeGreaterThan(0);

    const offences: Offence[] = [];
    let seen = 0;
    for (const file of files) {
      const { comments } = lex(readFileSync(file, "utf8"), dialectOf(file));
      seen += comments.length;
      for (const comment of comments) {
        const text = normalise(comment).toLowerCase();
        if (INCREMENT_ID.test(text)) offences.push({ file: relative(REPO_ROOT, file), comment, reason: "names an increment id" });
        for (const phrase of NARRATION) {
          if (text.includes(phrase)) offences.push({ file: relative(REPO_ROOT, file), comment, reason: `narrates: "${phrase}"` });
        }
      }
    }

    // The scan is only worth its verdict if it read comments at all.
    expect(seen, "the swept ground is commented, and the scan reads those comments").toBeGreaterThan(0);
    expect(
      offences.map((offence) => `${offence.file}: ${offence.reason}`),
      "every one of these comments states build history instead of the rule (Q-17)",
    ).toEqual([]);
  });
});

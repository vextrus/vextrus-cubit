/**
 * AC-5(d) — Q-17 on the sweep's own ground: a comment in `src/` cites Bible ids and states the rule
 * the code enforces; it never narrates the build (an increment id, "not built yet") and never
 * describes a state of affairs that has since moved on ("used to close over", "as before").
 *
 * Comments are read as comments by the one shared scanner (`tests/support/source-lex.ts`, reached
 * through `./support/source-text`), so a string-table key, a CSS `url(https://…)` or a glob holding
 * `/*` can never be mistaken for one — and a class name or an identifier in the code can never be
 * mistaken for narration.
 *
 * A scan of this shape passes when it looks and finds nothing, and it also passes when it never
 * looked — so the looking itself is asserted (B-19): the dialect follows the extension so a quote in
 * JSX copy cannot open a phantom literal that blanks a span, a scan that cannot decide throws naming
 * the file and the line, every file that visibly carries comments must have yielded one, and the
 * instrument is exercised against a fixture whose narration it must surface.
 */
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT } from "../../server/support/wire";
import { sourceFilesUnder } from "./support/files";
import { lex, lexFile, normalise } from "./support/source-text";

/** The ground this sweep owns, exactly as AC-5(d) names it. */
const SWEPT = ["src/ui/shell", "src/ui/screen-states", "src/ui/tokens.ts", "src/ui/theme"];

/** Every dialect a comment can live in here. */
const EXTENSIONS = [".ts", ".tsx", ".css"];

/** The process artifact Q-17 names as a class: an increment id, in any comment. */
const INCREMENT_ID = /inc-\d+/i;

/** The narration the debt rows found, quoted from their own evidence. */
const NARRATION = ["not built yet", "used to close over", "this sentence broke", "as before", "belongs to the primitives"];

/**
 * The one fixture this file asserts against, declared once (B-19): a JSX text node holding an
 * apostrophe, followed by a comment that narrates the build. A reader that folds `.tsx` into `.ts`
 * opens a literal at the apostrophe and never sees the comment; the scan must still surface it.
 */
const JSX_COPY_FIXTURE = {
  file: "<fixture>/jsx-copy.tsx",
  narration: "inc-000",
  source: [
    "export function Card(): unknown {",
    "  return (",
    "    <section>",
    "      <p>It's the workspace name</p>",
    "      {/* inc-000: not built yet — the narration this scan must still see */}",
    "    </section>",
    "  );",
    "}",
    "",
  ].join("\n"),
};

interface Offence {
  file: string;
  comment: string;
  reason: string;
}

/** The one reading of "this comment narrates the build" — the tree and the fixture share it. */
function offencesIn(file: string, comments: readonly string[]): Offence[] {
  const offences: Offence[] = [];
  for (const comment of comments) {
    const text = normalise(comment).toLowerCase();
    if (INCREMENT_ID.test(text)) offences.push({ file, comment, reason: "names an increment id" });
    for (const phrase of NARRATION) {
      if (text.includes(phrase)) offences.push({ file, comment, reason: `narrates: "${phrase}"` });
    }
  }
  return offences;
}

/**
 * A line that BEGINS with a comment opener is a comment in every dialect read here — nothing can
 * precede it on its line to make it anything else — unless it sits inside the one literal that may
 * span lines, a template, which an odd count of backticks above it marks. Read off the raw text and
 * never off the scanner being graded: an instrument cannot be its own witness.
 */
function plainCommentOpeners(source: string, file: string): number {
  const openers = file.endsWith(".css") ? ["/*"] : ["//", "/*"];
  const templatesPossible = !file.endsWith(".css");
  let backticks = 0;
  let found = 0;
  for (const line of source.split("\n")) {
    const insideATemplate = templatesPossible && backticks % 2 === 1;
    if (!insideATemplate && openers.some((opener) => line.trim().startsWith(opener))) found += 1;
    backticks += (line.match(/`/g) ?? []).length;
  }
  return found;
}

describe("AC-5(d): the swept ground's comments state rules, not build history (Q-17)", () => {
  test("no comment carries an increment id or the rows' narration", () => {
    const files = SWEPT.flatMap((root) => sourceFilesUnder(join(REPO_ROOT, root), EXTENSIONS));
    expect(files.length, "the swept ground holds files to read").toBeGreaterThan(0);

    const offences: Offence[] = [];
    for (const file of files) {
      const name = relative(REPO_ROOT, file);
      const source = readFileSync(file, "utf8");
      // A file the scanner cannot decide how to read throws here naming itself and the line: a scan
      // that blanks a span it did not understand would report green over ground it never read.
      const { comments } = lexFile(name, source);

      // Per file, not across the pile: a blinded file cannot hide behind its neighbours' counts.
      const openers = plainCommentOpeners(source, name);
      if (openers > 0) {
        expect(comments.length, `${name} opens ${openers} comment(s) on their own lines, and the scan must read them`).toBeGreaterThan(0);
      }

      offences.push(...offencesIn(name, comments));
    }

    expect(
      offences.map((offence) => `${offence.file}: ${offence.reason}`),
      "every one of these comments states build history instead of the rule (Q-17)",
    ).toEqual([]);
  });

  test("the scan reads a comment that follows an apostrophe in JSX copy", () => {
    const { comments } = lexFile(JSX_COPY_FIXTURE.file, JSX_COPY_FIXTURE.source);
    const narrating = comments.filter((comment) => comment.includes(JSX_COPY_FIXTURE.narration));
    expect(narrating.length, "the comment after the apostrophe is surfaced, not swallowed by a phantom literal").toBe(1);
    expect(offencesIn(JSX_COPY_FIXTURE.file, comments).map((offence) => offence.reason)).toEqual([
      "names an increment id",
      'narrates: "not built yet"',
    ]);
  });

  test("the same copy read in the wrong dialect goes loud, never quietly green", () => {
    // TypeScript admits no JSX in a `.ts` file, so this source is not decidable as one: the reading
    // that cannot be trusted says so through a diagnostic (which `lexFile` throws on) rather than
    // blanking the span and reporting a clean scan.
    const asPlainTs = lex(JSX_COPY_FIXTURE.source, "ts");
    expect(asPlainTs.diagnostics.length, "a scan that cannot decide records it").toBeGreaterThan(0);
  });
});

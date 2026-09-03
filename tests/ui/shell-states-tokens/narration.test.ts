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
 * the file and the line, every file must yield AT LEAST as many comment runs as its raw text opens
 * on their own lines — an extent bound, both sides computed per file at run time, never a frozen
 * count — and the instrument is exercised against fixtures whose narration it must surface and whose
 * shortfall the bound must catch.
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

/**
 * The second fixture, declared once beside the first (B-19): rendered copy followed by several
 * comments in three shapes. It grades the EXTENT bound — a scan that reads one of them and stops is
 * the "passes by not looking" failure, and the bound must say so with both numbers.
 */
const SEVERAL_COMMENTS_FIXTURE = {
  file: "<fixture>/several-comments.tsx",
  source: [
    "export function Card(): unknown {",
    "  return (",
    "    <section>",
    "      <p>It's the workspace name</p>",
    "    </section>",
    "  );",
    "}",
    "",
    "/** What the card is for (R-UI-050). */",
    "",
    "// One rule, stated on its own line.",
    "",
    "/* And a third run. */",
    "const bones = 3;",
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
 * How many comment RUNS the raw text opens on their own lines. Read off the raw text and never off
 * the scanner being graded: an instrument cannot be its own witness.
 *
 * This is a LOWER BOUND on what a sound scan must yield for the file, by construction:
 *  - a comment that begins mid-line (a trailing `// …` after code) is yielded by the scanner and is
 *    invisible to a line-initial counter, so the true number can only be higher;
 *  - a line inside a block comment already open, or inside a template literal, opens nothing — a
 *    `//` line or a decorative `/*` line inside a docblock belongs to the run above it;
 *  - `//` lines that continue a run just above open nothing either, so a line-initial `//` counts
 *    only where the line before it held no `//` at all.
 * Where the raw text is ambiguous the reading below prefers to believe a span is open or a run
 * continues, which only lowers the bound and never raises it.
 */
function plainCommentOpeners(source: string, file: string): number {
  const ts = !file.endsWith(".css");
  let inBlock = false;
  let backticks = 0;
  let found = 0;
  let previousLineHeldSlashes = false;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    const insideATemplate = ts && backticks % 2 === 1;
    const opensLine = ts && line.startsWith("//");
    const opensBlock = line.startsWith("/*");
    if (!inBlock && !insideATemplate && (opensLine || opensBlock) && !(opensLine && previousLineHeldSlashes)) {
      found += 1;
    }

    // Carry the block-comment span across lines, so a one-line `/* … */` counts once and the lines
    // of a docblock under it count for nothing.
    let at = 0;
    while (!insideATemplate && at < raw.length) {
      if (inBlock) {
        const close = raw.indexOf("*/", at);
        if (close === -1) break;
        inBlock = false;
        at = close + 2;
        continue;
      }
      const open = raw.indexOf("/*", at);
      const slashes = ts ? raw.indexOf("//", at) : -1;
      if (open === -1 || (slashes !== -1 && slashes < open)) break;
      inBlock = true;
      at = open + 2;
    }

    previousLineHeldSlashes = ts && raw.includes("//");
    backticks += (raw.match(/`/g) ?? []).length;
  }
  return found;
}

/**
 * The extent the scan owes a file: at least as many comment runs as its raw text opens. `>=` and not
 * `===` is deliberate — the witness above is a lower bound by construction. Answers the shortfall as
 * a sentence naming the file and both numbers, or null where the file was read to its extent.
 */
function underRead(file: string, openers: number, comments: readonly string[]): string | null {
  // A comment's opening delimiter is yielded as a run of its own, so a run holding no text is an
  // artefact of the reading rather than a comment; the bound counts what a reader would count.
  const read = comments.filter((comment) => comment !== "").length;
  if (openers === 0 || read >= openers) return null;
  return `${file} opens ${openers} comment(s) on their own lines; the scan read ${read}`;
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

      // Per file and to its extent, not across the pile and not merely armed: a file whose comments
      // were mostly classified as something else cannot hide behind the one it did yield.
      const shortfall = underRead(name, plainCommentOpeners(source, name), comments);
      expect(shortfall, "the scan must read every comment run the file opens, not merely one").toBeNull();

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

  test("the extent bound surfaces a scan that reads some of a file's comments and stops", () => {
    const { file, source } = SEVERAL_COMMENTS_FIXTURE;
    const openers = plainCommentOpeners(source, file);
    const { comments } = lexFile(file, source);

    expect(openers, "the fixture opens several comment runs after its rendered copy").toBeGreaterThan(1);
    expect(underRead(file, openers, comments), "the real scan reads the fixture to its extent").toBeNull();
    // The same arithmetic over a scan that lost every run but the first: the bound must name the
    // file and both sides rather than pass on the one run it was handed.
    const truncated = comments.filter((comment) => comment !== "").slice(0, 1);
    const short = underRead(file, openers, truncated);
    expect(short, "a scan that stops after one run is a red, not a green").toContain(file);
    expect(short, "the shortfall names what was opened and what was read").toContain(`${openers}`);
  });

  test("the same copy read in the wrong dialect goes loud, never quietly green", () => {
    // TypeScript admits no JSX in a `.ts` file, so this source is not decidable as one: the reading
    // that cannot be trusted says so through a diagnostic (which `lexFile` throws on) rather than
    // blanking the span and reporting a clean scan.
    const asPlainTs = lex(JSX_COPY_FIXTURE.source, "ts");
    expect(asPlainTs.diagnostics.length, "a scan that cannot decide records it").toBeGreaterThan(0);
  });
});

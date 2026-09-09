/**
 * L-FRM-06's ban has ONE home, and the tree says so (the ban, as a scan).
 *
 * "One factor per unit (`toCanonical`); every pair derives as a quotient. … a conversion literal
 * outside the canon is a lint failure." No M2 node is toolchain-tagged and `scripts/eslint/**` is
 * locked, so the ban is this committed test rather than an ESLint rule — the same mechanism
 * L-CAD-06's view-type spellings are banned by (B-17: one way of banning a spelling, not two).
 *
 * It is the shipped scanner's own consumer: `scanConversionLiterals` reads through the tree's one
 * lexer (`tests/support/source-lex`), so a factor named in prose or written into a template is never
 * a hit and a factor really spelled as code always is. The needles are the canon's own factors, less
 * the ones that are 1 or an integer power of ten — `CONVERSION_LITERALS` derives them, so a unit the
 * canon gains tomorrow is banned everywhere else with no edit here (B-19).
 *
 * What is judged is the VALUE a literal states, not its four usual characters: `0.30480` is the
 * foot's metres as surely as `0.3048` is, so the ban has to see both, and the finding names the canon
 * member the value equals.
 *
 * Three files are exempt, by name and for a stated reason, and the canon declares which
 * (`CONVERSION_SCAN_EXEMPT`): `src/core/units/canon.ts`, which IS the one home the factors live in;
 * `src/core/format.ts`, the document seam, where a figure is rendered rather than converted; and the
 * scanner beside this file, which cannot look for a factor without holding one. Every other file
 * under `src/**` that spells one is a second home for the law, and this is where that is refused.
 *
 * The declared corpus `tests/lint-fixtures/conversion-literals` proves the ban on the payload the
 * spec names — this is the test that corpus is excused by (ARCH-01, Q-07). Two sources this test
 * writes itself, under a throwaway directory no fixture declares, prove the judgement is about the
 * text a file holds rather than the path it arrived by: a scan that only fired on the fixture it was
 * proved on would ban nothing at all.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { describe, expect, test } from "vitest";
import { CONVERSION_LITERALS, CONVERSION_SCAN_EXEMPT } from "../canon";
import { scanConversionLiterals } from "./literal-scan";

/** The layered tree this ban governs — every `.ts` and `.tsx` under it. */
const SOURCE_ROOT = join(import.meta.dirname, "..", "..", "..", "..", "src");

/** The repo root, so a finding names a file the way the rest of the tree spells one. */
const REPO_ROOT = join(SOURCE_ROOT, "..");

/** The declared corpus this scan is proved on, repo-relative and spelled whole. */
const BAD_FIXTURE = "tests/lint-fixtures/conversion-literals/bad.ts";
const GOOD_FIXTURE = "tests/lint-fixtures/conversion-literals/good.ts";

/** Every `.ts`/`.tsx` file under a directory, in a stable code-point order. */
function sourcesUnder(directory: string): string[] {
  // white-box: L-FRM-06 — the criterion IS a property of the tree's text ("a conversion literal
  // outside the canon is a lint failure"), and a ban has no runtime observable: a module that spells
  // the factor a second time answers every call identically to one that reads it from the canon.
  // Only the file LIST is gathered here — enumerated rather than pinned, so a module added tomorrow
  // is governed with no edit (B-19) — and the judgement itself is the shipped scanner's.
  return readdirSync(directory)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap((entry) => {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) return sourcesUnder(path);
      return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
    });
}

/** A path as this test names one: repo-relative, forward slashes on every platform. */
function named(path: string): string {
  return relative(REPO_ROOT, path).split(sep).join("/");
}

/** Sorted by code point — `localeCompare` is not available to this tree (L-REG-05). */
function byCodePoint(values: readonly string[]): string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** One finding, as the scanner reports one. */
type Hit = { file: string; line: number; literal: string };

/** The scan's answer, named at this end too, so a finding is read the same way everywhere. */
function scan(files: readonly string[]): Hit[] {
  return [...scanConversionLiterals(files)];
}

/** The needles as plain strings, read off the canon — never a list this file carries (B-19). */
const NEEDLES: string[] = [...CONVERSION_LITERALS];

/**
 * A source this test writes itself, under a throwaway directory: a path no fixture declares and no
 * committed test names, so what the scan does with it can only be what it does with any file.
 */
function wroteSource(name: string, source: string): { path: string; source: string } {
  const path = join(mkdtempSync(join(tmpdir(), "conversion-literal-scan-")), name);
  writeFileSync(path, source, "utf8");
  return { path, source };
}

describe("L-FRM-06: a conversion factor is spelled in exactly one module", () => {
  test("the canon declares needles to hunt — a scan with none bans nothing", () => {
    expect(NEEDLES.length, "CONVERSION_LITERALS is the canon's own factors less 1 and the powers of ten; with none there is no ban").toBeGreaterThan(0);
  });

  test("no file under src/** outside the canon's own exemptions spells a conversion factor", () => {
    const exempt = new Set(CONVERSION_SCAN_EXEMPT);
    const files = sourcesUnder(SOURCE_ROOT).filter((path) => !exempt.has(named(path)));
    expect(files.length, "src/** holds files to scan — an empty scan judges nothing").toBeGreaterThan(0);

    const hits = scan(files).map((hit) => `${named(hit.file)}:${hit.line} spells ${JSON.stringify(hit.literal)}`);
    expect(
      hits,
      "L-FRM-06 gives every unit one factor, in the canon and nowhere else; a factor spelled anywhere else in src/** is a second home for the law. Read it through toCanonical/convert.",
    ).toEqual([]);
  });

  test("every exempted file is really in the tree — an exemption for a file that moved exempts nothing", () => {
    const missing = CONVERSION_SCAN_EXEMPT.filter((path) => !existsSync(join(REPO_ROOT, path)));
    expect(missing, "an exempted path names a file that is not in the tree — the ban would be silent about wherever it went").toEqual([]);
  });

  test("the scan fires on the declared bad fixture, and reports every factor it really spells", () => {
    const bad = join(REPO_ROOT, BAD_FIXTURE);
    expect(existsSync(bad), `${BAD_FIXTURE} is the declared payload this scan is proved on`).toBe(true);

    // white-box: L-FRM-06 — the declared payload's own TEXT is what the scan is proved against, and
    // the expectation is derived from it rather than transcribed: whatever factors the fixture
    // spells are the factors the scan owes, so a fixture that grows a shape grows the expectation
    // with it (B-19). The fixture is the increment's declared corpus under tests/, never product
    // source.
    const source = readFileSync(bad, "utf8");
    const code = source
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
    const spelled = NEEDLES.filter((needle) => code.includes(needle));
    expect(spelled.length, "the declared bad fixture spells factors of the canon — with none there is nothing to fire on").toBeGreaterThan(0);

    const found = scan([bad]);
    expect(
      byCodePoint([...new Set(found.map((hit) => hit.literal))]),
      "every factor the payload spells is reported, and nothing the payload does not say",
    ).toEqual(byCodePoint(spelled));
    for (const hit of found) {
      expect(named(hit.file), "a finding names the file it was found in").toBe(BAD_FIXTURE);
      const line = source.split("\n")[hit.line - 1] ?? "";
      expect(line, `the finding at line ${hit.line} points at a line that really says ${JSON.stringify(hit.literal)}`).toContain(hit.literal);
    }
  });

  test("the scan reports nothing in the declared good fixture — prose, templates and a power of ten state no law", () => {
    const good = join(REPO_ROOT, GOOD_FIXTURE);
    expect(existsSync(good), `${GOOD_FIXTURE} is the declared lawful half of the corpus`).toBe(true);
    expect(
      scan([good]),
      "the lawful fixture writes the factors in prose and in a template and spells the tonne's thousand, which is a grouping constant everywhere — none of those is a spelling of the law",
    ).toEqual([]);
  });

  test("the scan fires on a file it has never been shown, for every factor of the canon, as a number and as a string", () => {
    // Every needle gets one line as a number and one as a string, so the count is exact and the
    // expectation is the CANON rather than a list: a factor the canon gains tomorrow is demanded of
    // the scan here with no edit (B-19). The two ways a factor really creeps back in are these two.
    const { path, source } = wroteSource(
      "elsewhere-in-the-tree.ts",
      [
        "// A source no fixture declares and no test names, written where nothing can recognise it.",
        ...NEEDLES.flatMap((needle, index) => [
          `export const asNumber${index} = ${needle};`,
          `export const asString${index} = ${index % 2 === 0 ? `"${needle}"` : `'${needle}'`};`,
        ]),
        "",
      ].join("\n"),
    );

    const found = scan([path]);
    expect(
      byCodePoint(found.map((hit) => hit.literal)),
      "every factor of the canon spelled as code is reported, in whatever file says it — a ban that only fires on the file it was proved on bans nothing",
    ).toEqual(byCodePoint([...NEEDLES, ...NEEDLES]));

    for (const hit of found) {
      expect(hit.file, "a finding names the file it was found in").toBe(path);
      const line = source.split("\n")[hit.line - 1] ?? "";
      expect(line, `the finding at line ${hit.line} points at a line that really says ${JSON.stringify(hit.literal)}`).toContain(hit.literal);
    }
  });

  test("a factor spelled by a different route is the same factor — the scan compares values, not characters", () => {
    // A trailing zero changes nothing about the number and everything about the text, so a ban that
    // matched characters would forgive it. The rewriting is derived from each needle rather than
    // written out, so it holds for a factor the canon gains tomorrow too (B-19).
    const restated = (needle: string): string => (needle.includes(".") ? `${needle}0` : `${needle}.0`);
    for (const needle of NEEDLES) {
      expect(restated(needle), `${needle} restated must be a different spelling, or the case proves nothing`).not.toBe(needle);
    }

    const { path, source } = wroteSource(
      "restated-elsewhere.ts",
      [
        "// The same numbers, typed the other way round — still the canon's factors.",
        ...NEEDLES.flatMap((needle, index) => [
          `export const asNumber${index} = ${restated(needle)};`,
          `export const asString${index} = "${restated(needle)}";`,
        ]),
        "",
      ].join("\n"),
    );

    for (const needle of NEEDLES) {
      expect(source.includes(restated(needle)), `the payload really states ${needle} the other way round`).toBe(true);
    }

    expect(
      byCodePoint(scan([path]).map((hit) => hit.literal)),
      "a value equal to a canon factor is that factor however it is typed, and the finding names the canon member it equals",
    ).toEqual(byCodePoint([...NEEDLES, ...NEEDLES]));
  });

  test("the scan is silent about a file it has never been shown that only names the factors without spelling one", () => {
    const { path } = wroteSource(
      "lawful-elsewhere.ts",
      [
        `// prose, which is not code (Q-17): ${NEEDLES.join(", ")}`,
        `/* the same numbers in a block comment: ${NEEDLES.join(" ")} */`,
        ...NEEDLES.map((needle, index) => `export const said${index} = \`${needle}\`;`),
        ...NEEDLES.map((needle, index) => `export const longer${index} = 1${needle}1;`),
        "",
      ].join("\n"),
    );

    expect(
      scan([path]),
      "a factor named in prose, written into a template or sitting inside a longer number is not a spelling of the law, wherever the file sits",
    ).toEqual([]);
  });
});

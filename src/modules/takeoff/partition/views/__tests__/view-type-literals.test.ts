/**
 * AC-1 — L-CAD-06's vocabulary has ONE home, and the tree says so (the ban, as a scan).
 *
 * No M2 node is toolchain-tagged and `scripts/eslint/**` is locked, so the ban on spelling a view
 * type as a string literal is this committed test rather than an ESLint rule. It is the shipped
 * scanner's own consumer: `scanViewTypeLiterals` reads through the tree's one lexer
 * (`tests/support/source-lex`), so a member named in prose or addressed by a module specifier is
 * never a hit, and a member really spelled as a literal always is.
 *
 * Three files are exempt, by name and for a stated reason:
 *  - `law.ts` DECLARES the vocabulary, so it is the one file that must spell every member;
 *  - `src/core/errors/transport-vocabulary.ts` declares the six underscore-bearing spellings as a
 *    foreign vocabulary, because Q-07's register would otherwise read them as orphan refusal codes;
 *  - the two scan files themselves — this one and the scanner beside it — because a scanner that
 *    could not name what it looks for could not look for it.
 *
 * Any other file in `src/**` that says one of these words as a string is a second home for the law,
 * and this test is where that is refused.
 *
 * The declared corpus proves the ban on the payload the spec names; two sources this test writes
 * itself, under a throwaway directory no fixture declares, prove that the judgement is about the
 * text a file holds rather than about the path it arrived by — a scan that only fired on the fixture
 * it was proved on would ban nothing at all.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { describe, expect, test } from "vitest";
import { VIEW_TYPES } from "../law";
import { scanViewTypeLiterals } from "./literal-scan";

/** The layered tree this ban governs — every `.ts` and `.tsx` under it. */
const SOURCE_ROOT = join(import.meta.dirname, "..", "..", "..", "..", "..", "..", "src");

/** The repo root, so a finding names a file the way the rest of the tree spells one. */
const REPO_ROOT = join(SOURCE_ROOT, "..");

/** The declared corpus AC-1 proves the scan on. */
const CORPUS = join(REPO_ROOT, "tests", "lint-fixtures", "view-type-literals");

/** The files the criterion exempts, repo-relative and POSIX-spelled. */
const EXEMPT = [
  "src/modules/takeoff/partition/views/law.ts",
  "src/core/errors/transport-vocabulary.ts",
  "src/modules/takeoff/partition/views/__tests__/literal-scan.ts",
  "src/modules/takeoff/partition/views/__tests__/view-type-literals.test.ts",
];

/** Every `.ts`/`.tsx` file under a directory, in a stable code-point order. */
function sourcesUnder(directory: string): string[] {
  // white-box: AC-1 — the criterion IS a property of the tree's text ("no other file under src/**
  // spells a member as a string literal"), and a ban has no runtime observable: a product that says
  // the word in a second module answers every call identically to one that does not. Only the file
  // LIST is gathered here — it is enumerated rather than pinned, so a module added tomorrow is
  // governed with no edit (B-19) — and the judgement itself is the shipped scanner's, not this file's.
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
  return [...scanViewTypeLiterals(files)];
}

/** The vocabulary as plain strings — the members are branded, and a scan reads text. */
const MEMBERS: string[] = [...VIEW_TYPES];

/**
 * A source this test writes itself, under a throwaway directory: a path no fixture declares and no
 * committed test names, so what the scan does with it can only be what it does with any file. The
 * two declared fixtures prove the ban on the corpus the spec names; these prove the scanner is a
 * scanner — a judgement about the text it is handed rather than about the path it arrived by.
 */
function wroteSource(name: string, source: string): { path: string; source: string } {
  const path = join(mkdtempSync(join(tmpdir(), "view-type-literal-scan-")), name);
  writeFileSync(path, source, "utf8");
  return { path, source };
}

describe("AC-1: a view type is spelled as a string literal in exactly one module", () => {
  test("AC-1: no file under src/** outside the vocabulary's own home spells a member as a string literal", () => {
    const files = sourcesUnder(SOURCE_ROOT).filter((path) => !EXEMPT.includes(named(path)));
    expect(files.length, "src/** holds files to scan — an empty scan judges nothing").toBeGreaterThan(0);

    const hits = scan(files).map((hit) => `${named(hit.file)}:${hit.line} spells ${JSON.stringify(hit.literal)}`);
    expect(
      hits,
      "L-CAD-06 gives the view-type vocabulary one home beside its sole predicate; a member spelled as a string anywhere else is a second home for the law. Read it through the module that declares it.",
    ).toEqual([]);
  });

  test("AC-1: every exempted file is really in the tree — an exemption for a file that moved exempts nothing", () => {
    const missing = EXEMPT.filter((path) => !existsSync(join(REPO_ROOT, path)));
    expect(missing, "an exempted path names a file that is not in the tree — the ban would be silent about wherever it went").toEqual([]);
  });

  test("AC-1: the scan fires on the declared bad fixture, and reports every member it really spells", () => {
    const bad = join(CORPUS, "bad.ts");
    expect(existsSync(bad), "tests/lint-fixtures/view-type-literals/bad.ts is the declared payload this scan is proved on").toBe(true);

    // white-box: AC-1 — the declared payload's own TEXT is what the scan is proved against, and the
    // expectation is derived from it rather than transcribed: whatever members the fixture quotes
    // are the members the scan owes, so a fixture that grows a shape grows the expectation with it
    // (B-19). The fixture is this acceptance's own file under tests/, never product source.
    const source = readFileSync(bad, "utf8");
    const quoted = MEMBERS.filter((member) => new RegExp(`["']${member}["']`).test(source));
    expect(quoted.length, "the declared bad fixture quotes members of the vocabulary — with none there is nothing to fire on").toBeGreaterThan(0);

    const found = scan([bad]);
    expect(byCodePoint([...new Set(found.map((hit) => hit.literal))]), "every member the payload quotes is reported, and nothing the payload does not say").toEqual(byCodePoint(quoted));
    for (const hit of found) {
      expect(named(hit.file), "a finding names the file it was found in").toBe("tests/lint-fixtures/view-type-literals/bad.ts");
      const line = source.split("\n")[hit.line - 1] ?? "";
      expect(line, `the finding at line ${hit.line} points at a line that really says ${JSON.stringify(hit.literal)}`).toContain(hit.literal);
    }
  });

  test("AC-1: the scan fires on a file it has never been shown, for every member of the vocabulary", () => {
    // Every member gets one line and one occurrence, in both quote styles, so the count is exact and
    // the expectation is the VOCABULARY rather than a list: a member added to the law tomorrow is
    // demanded of the scan here with no edit (B-19).
    const { path, source } = wroteSource(
      "elsewhere-in-the-tree.ts",
      [
        "// A source no fixture declares and no test names, written where nothing can recognise it.",
        ...MEMBERS.map((member, index) => `export const spelled${index} = ${index % 2 === 0 ? `"${member}"` : `'${member}'`};`),
        "",
      ].join("\n"),
    );

    const found = scan([path]);
    expect(
      byCodePoint(found.map((hit) => hit.literal)),
      "every member of the vocabulary spelled as a string literal is reported, in whatever file says it — a ban that only fires on the file it was proved on bans nothing",
    ).toEqual(byCodePoint(MEMBERS));

    for (const hit of found) {
      expect(hit.file, "a finding names the file it was found in").toBe(path);
      const line = source.split("\n")[hit.line - 1] ?? "";
      expect(line, `the finding at line ${hit.line} points at a line that really says ${JSON.stringify(hit.literal)}`).toContain(hit.literal);
    }
  });

  test("AC-1: the scan is silent about a file it has never been shown that only names the members without spelling one", () => {
    const { path } = wroteSource(
      "lawful-elsewhere.ts",
      [
        `// prose, which is not code (Q-17): ${MEMBERS.join(", ")}`,
        `/* the same words in a block comment: ${MEMBERS.join(" ")} */`,
        ...MEMBERS.map((member) => `import "${member}";`),
        ...MEMBERS.map((member, index) => `import { thing${index} } from "${member}";`),
        `export const keyed = { ${MEMBERS.map((member) => `${member}: 1`).join(", ")} };`,
        "",
      ].join("\n"),
    );

    expect(
      scan([path]),
      "a member named in prose, addressed by a module specifier or written as a bare property key is not a string literal stating the law, wherever the file sits",
    ).toEqual([]);
  });

  test("AC-1: the scan reports nothing in the declared good fixture — prose and module specifiers are not spellings of the law", () => {
    const good = join(CORPUS, "good.ts");
    expect(existsSync(good), "tests/lint-fixtures/view-type-literals/good.ts is the declared lawful half of the corpus").toBe(true);
    expect(
      scan([good]),
      "the lawful fixture names the vocabulary in prose, in a module specifier and through the module that declares it — none of those is a spelling of the law",
    ).toEqual([]);
  });
});

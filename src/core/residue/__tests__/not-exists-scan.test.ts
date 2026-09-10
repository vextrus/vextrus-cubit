/**
 * AC-2 — L-QTY-05's `NOT EXISTS` has ONE home, and the tree says so (the ban, as a committed scan).
 *
 * "`NOT EXISTS` is lint-banned inside the channel module and appears once, in the residue query." A
 * channel reader answers what it SAW — its return type is `Sighting[]` and no `absent()` constructor
 * exists — so the one judgement "this is absent" is made in one place, and a second spelling of it
 * anywhere under `src/core/residue/**` is the defect the clause exists to prevent.
 *
 * No M2 node is toolchain-tagged and `scripts/eslint/**` is locked, so the ban is this committed test
 * over the shipped scanner rather than an ESLint rule — the mechanism L-CAD-06's view-type spellings,
 * L-FRM-06's conversion factors and SEAM-GATE's import ban are already banned by (B-17: one way of
 * banning a spelling, not four).
 *
 * This is the test the declared corpus `tests/lint-fixtures/residue-not-exists` is excused by in
 * `tests/toolchain/lint-law.test.ts` (ARCH-01, Q-07). The corpus carries both halves: `bad.ts` writes
 * the phrase in every shape it creeps back in — upper case, lower case, mixed case, inside a larger
 * statement, and drizzle's `notExists` operator — and `good.ts` writes the phrase in its PROSE and
 * nowhere in its code, so a scan that grepped the text rather than reading it through the tree's one
 * lexer would refuse a file for explaining the ban it obeys.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { scanNotExists, type NotExistsHit } from "./not-exists-scan";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The tree the ban governs: the residue and its channels, whole. */
const GOVERNED = "src/core/residue";

/** The one file L-QTY-05 allows the phrase in. */
const THE_ONE_HOME = "src/core/residue/residue.ts";

/** The channel module, where the clause names the ban explicitly. */
const CHANNELS = "src/core/residue/channels";

/** The declared corpus, and its two halves. */
const CORPUS = "tests/lint-fixtures/residue-not-exists";
const BAD = `${CORPUS}/bad.ts`;
const GOOD = `${CORPUS}/good.ts`;

/**
 * The scanner and this test sit beside the query they govern, so the governed tree excludes them:
 * a prover has to spell the phrase it hunts for, and a scan that reported its own pattern would be
 * measuring itself rather than the product.
 */
const isProver = (path: string): boolean => path.split(/[/\\]/).includes("__tests__");

const posix = (path: string): string => relative(REPO_ROOT, path).split(sep).join("/");

/** Every TypeScript source under a root, in a stable order — or the root itself where it is a file. */
function sourcesUnder(root: string, accept: (path: string) => boolean = () => true): string[] {
  if (statSync(resolve(root), { throwIfNoEntry: false })?.isFile() === true) return [resolve(root)];
  const found: string[] = [];
  const walk = (directory: string): void => {
    // white-box: AC-2 — the criterion is a claim about the tree's TEXT ("zero occurrences under src/core/residue/channels/**, exactly one in residue.ts"), which nothing executing can observe; the governed corpus is discovered by walking rather than transcribed, so a fourth channel reader landed later is judged by the same scan with no edit here (L-QTY-05, B-19).
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && path.endsWith(".ts") && accept(path)) found.push(path);
    }
  };
  walk(resolve(root));
  return found;
}

const scanOf = (root: string, accept?: (path: string) => boolean): readonly NotExistsHit[] =>
  scanNotExists(sourcesUnder(join(REPO_ROOT, root), accept));

const at = (hits: readonly NotExistsHit[]): string[] => hits.map((hit) => `${posix(hit.file)}:${hit.line}`);

describe("AC-2: L-QTY-05's one NOT EXISTS", () => {
  test("the channel module spells it nowhere — a reader says what it SAW", () => {
    expect(at(scanOf(CHANNELS)), "a channel reader spells an absence — its answer is a Sighting[], and an empty list is the only way it says nothing (L-QTY-05)").toEqual([]);
  });

  test("the residue query spells it exactly once, and nothing else in the tree spells it at all", () => {
    const hits = scanOf(GOVERNED, (path) => !isProver(path));
    expect(hits.map((hit) => posix(hit.file)), `${GOVERNED} holds one spelling of the ban and it stands in ${THE_ONE_HOME} (L-QTY-05)`).toEqual([THE_ONE_HOME]);
    // white-box: AC-2 — the criterion IS a claim about the text of the query, so the reported line is
    // read back and shown to really state the phrase: a scan that counted files rather than reading
    // them would answer "one" just as happily.
    const source = readFileSync(join(REPO_ROOT, THE_ONE_HOME), "utf8").split("\n");
    for (const hit of hits) {
      expect((source[hit.line - 1] ?? "").toLowerCase(), `the finding at ${THE_ONE_HOME}:${hit.line} really spells the phrase`).toContain("not exists");
    }
  });

  test("the ban fires on the declared corpus, in every shape the phrase creeps back in", () => {
    const hits = scanOf(BAD);
    expect(hits.length, `${BAD} is the payload committed to prove the ban fires — a silent scan proves nothing`).toBeGreaterThan(0);

    const spelled = hits.map((hit) => hit.spelling);
    expect(spelled, "the straight SQL spelling").toContain("NOT EXISTS");
    expect(spelled, "the lower-case spelling a driver reads just as happily").toContain("not exists");
    expect(spelled, "a mixed-case spelling").toContain("Not Exists");
    expect(spelled, "drizzle's own operator, which asks the same question in TypeScript").toContain("notExists");

    // white-box: AC-2 — each finding is checked against the fixture line it points at, which is the
    // only way to tell a scan that read the source from one that counted matches in a blob. The text
    // read is this increment's own declared corpus, never product source.
    const lines = readFileSync(join(REPO_ROOT, BAD), "utf8").split("\n");
    for (const hit of hits) {
      expect(lines[hit.line - 1] ?? "", `the finding at ${BAD}:${hit.line} points at a line that really spells ${JSON.stringify(hit.spelling)}`).toContain(hit.spelling);
    }
  });

  test("the ban is clean on the lawful half, whose PROSE spells the very phrase", () => {
    const source = readFileSync(join(REPO_ROOT, GOOD), "utf8");
    // The silence below is only worth anything if the file really carries the trap: a corpus whose
    // lawful half never mentions the phrase would pass a plain grep too (B-19).
    expect(source.toUpperCase(), `${GOOD} carries the phrase in its prose — that is what the lawful half is for`).toContain("NOT EXISTS");
    expect(at(scanOf(GOOD)), `${GOOD} states the union of EXISTS and explains the ban in prose; a scan that read text rather than code would refuse it (L-QTY-05)`).toEqual([]);
  });

  test("the corpus is a corpus — both halves are files the scan was pointed at", () => {
    for (const half of [BAD, GOOD]) {
      expect(statSync(join(REPO_ROOT, half), { throwIfNoEntry: false })?.isFile() ?? false, `${half} is a file of the declared corpus`).toBe(true);
    }
  });
});

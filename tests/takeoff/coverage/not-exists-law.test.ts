/**
 * AC-2 — the tree's ONE `NOT EXISTS` (L-QTY-05).
 *
 * "`NOT EXISTS` is lint-banned inside the channel module and appears once, in the residue query" is
 * a claim about the SOURCE, not about a run: an absence spelled in a reader that nothing calls is
 * exactly the second home the law bans, and it has no runtime observable at all. So this suite reads
 * the text — through the tree's one source lexer, so that what is judged is code and the strings code
 * states, never a comment that explains the ban — and counts.
 *
 * The count is derived per file rather than declared: every file under the channels directory is
 * found by walking it, so a fourth reader landed later is judged the same way with no edit here
 * (B-19). Whether the committed scan the criterion names FIRES is asserted where the criterion places
 * it — in `src/core/residue/__tests__/not-exists-scan.test.ts`, which `SCAN_CORPORA` of
 * tests/toolchain/lint-law.test.ts requires to exist, to name this corpus and to sit in an armed lane.
 * What this file adds is the rule itself, read independently of that scan, so a scan that agrees with
 * a wrong tree cannot agree itself into a pass.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { dialectOf, scanned } from "../../support/source-lex";
import { REPO_ROOT } from "../../server/support/wire";
import { CHANNELS_DIR, RESIDUE_QUERY_MODULE } from "./support/coverage-stage";

/** The declared corpus this ban's payload lives in (AC-2, SCAN_CORPORA's `residue-not-exists`). */
const CORPUS = "tests/lint-fixtures/residue-not-exists";
const BAD = `${CORPUS}/bad.ts`;
const GOOD = `${CORPUS}/good.ts`;

/** The phrase, in SQL, however a driver would accept it — and drizzle's operator for the same thing. */
const IN_SQL = /not\s+exists/giu;
const IN_DRIZZLE = /\bnotExists\b/gu;

/** The modes a source states a string in: the three ways a SQL fragment is written down. */
const LITERAL_MODES = new Set(["single", "double", "template"]);

/**
 * How many times one file says `NOT EXISTS` — in a SQL string it states, or as drizzle's operator in
 * its code. Comments are not counted: a file that explains the ban it obeys has not broken it.
 */
function occurrences(file: string): number {
  // white-box: AC-2 — the criterion IS a property of the source text ("zero occurrences under
  // channels/**, exactly one in residue.ts"). A banned spelling that never executes has nothing to
  // observe at run time, so the text is the only place the claim can be settled.
  const source = readFileSync(join(REPO_ROOT, file), "utf8");
  let code = "";
  let literals = "";
  for (const { char, mode } of scanned(source, dialectOf(file))) {
    if (mode === "code") code += char;
    else if (LITERAL_MODES.has(mode)) literals += char;
    else literals += " ";
  }
  return (literals.match(IN_SQL)?.length ?? 0) + (code.match(IN_DRIZZLE)?.length ?? 0);
}

/** Every source file under the channels directory, found rather than listed (B-19). */
function channelFiles(): string[] {
  const root = join(REPO_ROOT, CHANNELS_DIR);
  expect(statSync(root, { throwIfNoEntry: false })?.isDirectory() ?? false, `${CHANNELS_DIR} is the home of the three channel readers (the increment's interfaces)`).toBe(true);
  const held: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at)) {
      const path = join(at, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(?:ts|tsx|mts)$/u.test(entry)) held.push(path.slice(REPO_ROOT.length + 1));
    }
  };
  walk(root);
  return held;
}

describe("AC-2 — the residue holds one NOT EXISTS, and the channel readers hold none", () => {
  test("AC-2: no file under the channels directory says NOT EXISTS, in SQL or as drizzle's operator", () => {
    const files = channelFiles();
    expect(files.length, "the channels directory holds the readers this ban governs").toBeGreaterThanOrEqual(3);

    const guilty = files.filter((file) => occurrences(file) > 0);
    expect(guilty, "a channel reader answers what it SAW; an absence spelled inside one is a second home for the judgement the residue query alone makes (L-QTY-05)").toEqual([]);
  });

  test("AC-2: the residue query says it exactly once", () => {
    const said = occurrences(RESIDUE_QUERY_MODULE);
    expect(said, `${RESIDUE_QUERY_MODULE} holds the tree's ONE \`NOT EXISTS\` — not none, which would mean the judgement moved somewhere else, and not two, which would mean it has two homes`).toBe(1);
  });
});

describe("AC-2 — the declared corpus is a corpus: the payload says it, the lawful half does not", () => {
  test("AC-2: the bad fixture states the ban's every shape, and the good one states none of them in code", () => {
    expect(occurrences(BAD), `${BAD} carries the payload this ban is proved on — the SQL spellings and drizzle's operator (Q-08)`).toBeGreaterThan(3);
    expect(occurrences(GOOD), `${GOOD} is the lawful counterpart: it states the union of EXISTS, and names the banned phrase only in prose a reader of code never sees`).toBe(0);
    expect(readFileSync(join(REPO_ROOT, GOOD), "utf8").toUpperCase().includes("NOT EXISTS"), "and it does name it in prose — a scan that greps text rather than reading code fires here, which is what this half is for").toBe(true);
  });
});

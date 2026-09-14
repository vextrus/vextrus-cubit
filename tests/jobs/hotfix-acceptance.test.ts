/**
 * Public acceptance for inc-hotfix-20260914-0052 — the jobs-seam hotfix: AC-2 and AC-3.
 *
 * AC-1 is next door, in tests/jobs/jobs-seam-staging.test.ts: a state, not a sighting. Its premise
 * that the red reproduces on main by running the suite was struck by the arbitration of 2026-09-14
 * (TEST_AMENDED, B-20) and replaced by the deterministic fixture on the staging path — a template
 * whose migrations never finished is never answered as this run's template. The rest of AC-1 — that
 * tests/jobs/jobs-seam.test.ts exits 0 on the branch, run alone and at lane concurrency — is the
 * database lane's own contract, which the gate runs; the one half of it no lane inspects is the
 * run's OUTPUT (its `[psql-pool]` fallback line, its `worker: failed to start` line), read once at
 * gate time in the held-out set on exactly the command P-GREEN names.
 *
 * AC-4 is held out.
 *
 * WHAT THIS FILE DOES NOT ASSERT, AND WHY. AC-2's history clause (the regression is committed
 * alone, before any non-test change) and AC-3's `git diff main` framing are CONTAINMENT: they are
 * the structural gate's question about the branch's commits, never a test's — a suite that shells
 * out to git, reads a diff or reads the merge base is not acceptance. What a test can judge is the
 * state of the tree the gate checks out, and that is what is judged below: the regression exists,
 * opens with the docblock AC-2 spells, names a cause at a real place in a real file, is collected
 * by the database lane and by no other, and none of main's assertions, titles, slack constants or
 * timeouts has left the two files AC-3 freezes.
 *
 * HOW "UNCHANGED" IS JUDGED WITHOUT A DIFF: main's own bytes are committed beside the suite, at
 * tests/jobs/support/hotfix-baseline/ (FORK_POINT.txt names the commit they were taken at). Only
 * REMOVALS are judged against them — every expect-bearing line, every test title, every named
 * constant, every trailing timeout and every multi-digit literal of the baseline must still be
 * there, as often as it was — so an addition to either file passes, exactly as AC-3 allows. A
 * later increment that lawfully re-baselines the seam suite owns this baseline with it (B-20).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { laneSplit } from "../../scripts/lib/pg-suites.mjs";

/** The checkout this suite judges. `tests/jobs/` is two levels below it. */
const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** The regression the hotfix owes, as the increment's interface list names it. */
const REGRESSION = "tests/jobs/jobs-seam-hotfix.test.ts";

/** The two files AC-3 freezes, each with the copy of main's bytes it is judged against. */
const FROZEN = [
  { file: "tests/jobs/jobs-seam.test.ts", baseline: "tests/jobs/support/hotfix-baseline/jobs-seam.main.txt" },
  { file: "tests/jobs/support/jobs-acceptance.ts", baseline: "tests/jobs/support/hotfix-baseline/jobs-acceptance.main.txt" },
] as const;

/** The exact text AC-2 requires the regression's leading docblock to open with. */
const DOCBLOCK_OPENING = "HOTFIX inc-hotfix-20260914-0052:";

/** The cause, as AC-2 spells it: a repo-relative file and a line range within it. */
const NAMED_CAUSE = /^([\w@./-]+\.\w+):(\d+)-(\d+)\b/;

/** The constants AC-3 names, each with the value main holds it at. */
const FROZEN_CONSTANTS: ReadonlyArray<readonly [string, number]> = [
  ["FLOOR_SLACK_MS", 100],
  ["ORDER_SLACK_MS", 500],
  ["SLOW_STEP_MS", 1200],
  ["AC3_HOLD_STEPS", 50],
  ["UNREACHABLE_MS", 4000],
  ["HOLD_STEP_MS", 2000],
];

/** The trailing timeout arguments AC-3 names: the five tests' and the `afterAll`'s. */
const FROZEN_TIMEOUTS = [120_000, 180_000, 300_000, 300_000, 300_000, 900_000];

/** The spellings that turn a test into no test at all. */
const DISABLED = ["test.skip", "test.fixme", "test.todo", "describe.skip", ".only("];

/**
 * One file of the checkout, as text. Its callers are the two criteria whose subject IS text: AC-2's
 * docblock, and AC-3's two frozen test files against the copy of main's bytes. The one call that can
 * land under src/ or db/ is AC-2's cause file, and it reads only how many lines that file has — the
 * range the docblock names must be a real place in it — never a line of its content.
 */
function read(file: string): string {
  // white-box: AC-2/AC-3 — both criteria are properties of TEXT (a docblock's opening, and that no
  // assertion, title, constant or timeout has left two test files), which no behaviour of the
  // product can show; the only path that reaches src/ or db/ takes the file's length, not its text.
  return readFileSync(join(ROOT, file), "utf8");
}

/** Every line, trimmed and with its inner whitespace collapsed — so indentation is not a removal. */
function lines(text: string): string[] {
  return text.split("\n").map((line) => line.trim().replace(/\s+/g, " "));
}

/** How many times each member of a list occurs in it. */
function tally(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

/**
 * The file's leading comment, as prose: a `/** … *\/` block or a run of `//` lines at the top, with
 * the comment marks taken off. Either spelling is a docblock for AC-2's purpose — what the criterion
 * asks is what the FIRST thing the file says is.
 */
function leadingComment(text: string): string | null {
  // A byte-order mark before the comment is still the comment's own place, so it is stepped over.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const block = /^\s*\/\*+([\s\S]*?)\*\//.exec(source);
  if (block !== null) {
    return (block[1] ?? "")
      .split("\n")
      .map((line) => line.replace(/^\s*\*+ ?/, "").trim())
      .join("\n")
      .trim();
  }
  const said: string[] = [];
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      if (said.length > 0) break;
      continue;
    }
    if (!trimmed.startsWith("//")) break;
    said.push(trimmed.replace(/^\/+ ?/, ""));
  }
  return said.length > 0 ? said.join("\n").trim() : null;
}

describe("inc-hotfix-20260914-0052: the jobs-seam red is reproduced, then fixed, and nothing it guards is weakened", () => {
  test("AC-2: the breakage is reproduced as a regression whose docblock names the cause it reproduces", () => {
    expect(
      existsSync(join(ROOT, REGRESSION)),
      `${REGRESSION} is missing — the hotfix owes the defect as a failing test of its own before anything under src/** or db/** moves`,
    ).toBe(true);

    // white-box: AC-2 — the criterion is a property of the regression file's OWN TEXT (its leading
    // docblock must open with a fixed marker and name the cause as <file>:<line>-<line>); there is
    // no behaviour to drive for it, and the file is a test of this increment's own, not product source.
    const opening = (leadingComment(read(REGRESSION)) ?? "").split("\n")[0] ?? "";
    expect(opening.startsWith(DOCBLOCK_OPENING), `${REGRESSION} must open with ${JSON.stringify(DOCBLOCK_OPENING)}; it opens with ${JSON.stringify(opening.slice(0, 120))}`).toBe(true);

    const rest = opening.slice(DOCBLOCK_OPENING.length).trim();
    const named = NAMED_CAUSE.exec(rest);
    expect(named, `${REGRESSION}'s docblock must name the cause as <repo-relative file>:<line>-<line> after the marker; it said ${JSON.stringify(rest.slice(0, 160))}`).not.toBeNull();

    const [matched, causeFile, from, to] = named as RegExpExecArray;
    expect(existsSync(join(ROOT, causeFile ?? "")), `the docblock names ${String(causeFile)} as the cause, and the checkout carries no such file`).toBe(true);
    // white-box: AC-2 — only the named file's LENGTH is read, to prove the line range is a real
    // place in it; nothing of its content is asserted on.
    const causeLines = read(causeFile ?? "").split("\n").length;
    expect(Number(from) >= 1 && Number(from) <= Number(to), `the cause's line range ${String(from)}-${String(to)} is not a range`).toBe(true);
    expect(Number(to), `the docblock names lines up to ${String(to)} of ${String(causeFile)}, which has ${causeLines} lines`).toBeLessThanOrEqual(causeLines);

    const sentence = rest.slice(matched?.length ?? 0).replace(/^[\s—–:-]+/u, "");
    expect(sentence.length, `after the cause, the docblock owes one sentence of what was wrong; it said ${JSON.stringify(sentence)}`).toBeGreaterThanOrEqual(20);
    expect(sentence.includes(" "), `${JSON.stringify(sentence)} is not a sentence`).toBe(true);
  });

  test("AC-2: the regression is collected by the database lane, beside the suite it guards, and by no other lane", () => {
    // Asked of the partition the two configs are built from, not of two `vitest list` runs: the
    // database lane's include IS this list and the unit lane's exclude IS this list, so membership
    // here is collection there — and the same question at the runners costs the V-VERIFY budget two
    // cold vitest processes on every run (AM-10(1)). That the runners agree with this derivation is
    // tests/toolchain/test-lane-split.test.ts's own subject, which AC-2 names as its proof.
    const { database, databaseOutsideDb } = laneSplit(ROOT);

    expect(database, `the database lane does not collect ${REGRESSION} — a regression that reaches no harness runs in the wrong lane, or in none`).toContain(REGRESSION);
    expect(database, "the database lane must still collect the suite the hotfix is about").toContain(FROZEN[0].file);
    expect(
      databaseOutsideDb,
      `${REGRESSION} does not live under db/__tests__, so it is the derived list that must carry it out of the unit lane — that lane opens no database, and the regression would prove nothing there`,
    ).toContain(REGRESSION);
  });

  test("AC-3: the acceptance is extended, and none of main's assertions, titles, constants or timeouts is weakened", () => {
    let titlesSeen = 0;
    for (const { file, baseline } of FROZEN) {
      // white-box: AC-3 — the criterion is about the TEXT of two test files (no assertion removed,
      // no title retitled, no margin widened), judged against the copy of main's bytes committed at
      // tests/jobs/support/hotfix-baseline/. Neither file is product source.
      const now = read(file);
      const was = read(baseline);
      const nowLines = tally(lines(now));
      const wasLines = lines(was);

      for (const [line, owed] of tally(wasLines.filter((line) => line.includes("expect(")))) {
        expect(nowLines.get(line) ?? 0, `${file} no longer carries this assertion line from main (${owed}x): ${line}`).toBeGreaterThanOrEqual(owed);
      }

      for (const title of [...was.matchAll(/\btest\(\s*"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1] ?? "")) {
        titlesSeen += 1;
        expect(now, `${file} no longer carries main's test title ${JSON.stringify(title)} — a retitled test is a removed one`).toContain(`test("${title}"`);
      }

      for (const [name, value] of FROZEN_CONSTANTS) {
        const declaration = new RegExp(`^(?:export )?const ${name} = (\\d[\\d_]*);$`, "m").exec(was);
        if (declaration === null) continue;
        expect(Number((declaration[1] ?? "").replace(/_/g, "")), `main declares ${name} at ${declaration[1]}, and AC-3 names it ${value} — the baseline is not main's`).toBe(value);
        expect(now, `${file} no longer declares ${JSON.stringify(declaration[0])} — widening a margin is not a fix`).toContain(declaration[0]);
      }

      const trailing = (text: string): number[] =>
        lines(text)
          .map((line) => /^\},\s*(\d[\d_]*)\);$/.exec(line)?.[1])
          .filter((found): found is string => found !== undefined)
          .map((found) => Number(found.replace(/_/g, "")))
          .sort((a, b) => a - b);
      const wasTimeouts = trailing(was);
      if (wasTimeouts.length > 0) {
        expect(wasTimeouts, "the baseline's trailing timeouts are not the ones AC-3 names — the baseline is not main's").toEqual(FROZEN_TIMEOUTS);
        const nowTimeouts = tally(trailing(now).map(String));
        for (const [timeout, owed] of tally(wasTimeouts.map(String))) {
          expect(nowTimeouts.get(timeout) ?? 0, `${file} no longer gives ${owed} of its blocks a ${timeout} ms budget — a red cleared by raising a timeout is not this hotfix`).toBeGreaterThanOrEqual(owed);
        }
      }

      const literals = (text: string): Map<string, number> => tally([...text.matchAll(/\b\d[\d_]{2,}\b/g)].map((match) => match[0]));
      const nowLiterals = literals(now);
      for (const [literal, owed] of literals(was)) {
        expect(nowLiterals.get(literal) ?? 0, `${file} no longer carries the literal ${literal} ${owed} time(s) — every slack, budget and hold length of main stands`).toBeGreaterThanOrEqual(owed);
      }

      for (const spelling of DISABLED) {
        expect(now.includes(spelling), `${file} carries ${JSON.stringify(spelling)} — a test that does not run judges nothing`).toBe(false);
      }
    }

    expect(titlesSeen, "main's five tests are what AC-3 freezes; the baseline yielded a different number of titles").toBe(5);

    // Last, so that everything above is exercised against the tree as it stands: the criterion is
    // that the acceptance is EXTENDED and not weakened, and the extension is the regression that
    // reproduces the red beside it (AC-2). Until that file exists there is nothing extended here.
    expect(
      existsSync(join(ROOT, REGRESSION)),
      `nothing in the two frozen files has been weakened, but ${REGRESSION} is missing — the acceptance is not yet EXTENDED by the regression that reproduces the red`,
    ).toBe(true);
  });
});

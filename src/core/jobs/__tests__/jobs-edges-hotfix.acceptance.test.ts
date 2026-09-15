/**
 * Public acceptance for inc-hotfix-20260914-1914 — the jobs-edges hotfix: AC-2 and AC-3.
 *
 * AC-1: verified by src/core/jobs/__tests__/jobs-edges.acceptance.test.ts — the criterion IS that
 * file's own exit code in the database lane, on the command it names
 * (`pnpm vitest run --config db/__tests__/vitest.config.ts src/core/jobs/__tests__/jobs-edges.acceptance.test.ts`),
 * which the gate runs as part of `pnpm test:db`. A public test for it could only spawn a second
 * vitest over the same file — a re-run of a suite is not acceptance, it is the same run twice, and it
 * would buy the V-VERIFY budget a cold process on every unit-lane run (AM-10(1)). What a static
 * reading CAN add to that run is asserted below under AC-3: that the seven tests are still seven, and
 * that none of them has been skipped, fixmed, todoed or `.only`'d into a green that judges nothing.
 *
 * AC-4 is held out.
 *
 * WHAT THIS FILE DOES NOT ASSERT, AND WHY. AC-2's ordering clause (the regression is committed alone,
 * before anything under src/** or db/** moves) is CONTAINMENT: it is the structural gate's question
 * about the branch's commits, never a test's — a suite that shells out to git, reads a diff or reads
 * the merge base is not acceptance. What a test can judge is the state of the tree the gate checks
 * out, and that is what is judged below: the regression exists, opens with the docblock AC-2 spells,
 * names a cause at a real place in a real file, stages that cause through the database lane's own
 * harness, spawns no process of its own, is collected by the database lane and by no other — and
 * nothing of main's assertions, titles, constants, slack or timeouts has left the acceptance file.
 *
 * HOW "NEVER WEAKENED" IS JUDGED WITHOUT A DIFF: main's own bytes are committed beside the suite, at
 * src/core/jobs/__tests__/support/hotfix-baseline/ (FORK_POINT.txt names the commit they were taken
 * at). Only REMOVALS are judged against them — every expect-bearing line, every test title, every
 * named constant, the `afterAll` trailing timeout and every literal of three or more digits must
 * still be there, as often as it was — so an addition to the file passes, exactly as AC-3 allows. A
 * later increment that lawfully re-baselines this acceptance owns the baseline with it (B-20).
 *
 * The unit lane's: node:fs and the lane partition, no database (scripts/lib/pg-suites.mjs reaches
 * neither live-database seed, so this file stays where `pnpm test` collects it).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { laneSplit } from "../../../../scripts/lib/pg-suites.mjs";

/** The checkout this suite judges. `src/core/jobs/__tests__/` is four levels below it. */
const ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

/** The regression the hotfix owes, as the increment's interface list names it. */
const REGRESSION = "src/core/jobs/__tests__/jobs-edges-hotfix.test.ts";

/** The file AC-3 freezes, and the copy of main's bytes it is judged against. */
const ACCEPTANCE = "src/core/jobs/__tests__/jobs-edges.acceptance.test.ts";
const BASELINE = "src/core/jobs/__tests__/support/hotfix-baseline/jobs-edges.main.txt";

/** The commit the baseline was taken at, and the file that must name it. */
const FORK_POINT_FILE = "src/core/jobs/__tests__/support/hotfix-baseline/FORK_POINT.txt";
const FORK_POINT = "7f1da3e9f93a395dc7846b63a1d48fd191252bb4";

/** The exact text AC-2 requires the regression's leading docblock to open with. */
const DOCBLOCK_OPENING = "HOTFIX inc-hotfix-20260914-1914:";

/** The cause, as AC-2 spells it: a repo-relative file and a line range within it. */
const NAMED_CAUSE = /^([\w@./-]+\.\w+):(\d+)-(\d+)\b/;

/** The harness AC-2 requires the regression to stage its state through, and where it lives. */
const HARNESS_EXPORT = "provisionScratchDb";
const HARNESS_MODULE = /\bfrom\s+["'][^"']*db\/__tests__\/harness(?:\.ts)?["']/;

/**
 * A regression that reproduces a seam's own misbehaviour stages STATE and calls the seam; it never
 * starts a process. These are the spellings of starting one — the two AC-2 forbids by name (running
 * jobs-edges.acceptance.test.ts again, and reading git) both need one, and so does every other.
 */
const SPAWNS = ["child_process", "execSync", "execFileSync", "spawnSync", "spawn(", "vitest/node", "startVitest"];

/** The constants AC-3 names, each with the value main holds it at. */
const FROZEN_CONSTANTS: ReadonlyArray<readonly [string, number]> = [
  ["TERMINAL_BUDGET_MS", 90_000],
  ["NOBODY_CONSUMES_MS", 2_000],
  ["BACKENDS_GONE_MS", 5_000],
  ["SLOW_STEP_MS", 1_500],
  ["DEAD_LETTER_LIMIT_VALUE", 200],
];

/** The trailing timeout arguments AC-3 names: the `afterAll`'s. */
const FROZEN_TIMEOUTS = [120_000];

/** How many tests AC-3 freezes — main's seven, which AC-1 requires to pass and none to be skipped. */
const FROZEN_TITLES = 7;

/** The spellings that turn a test into no test at all. */
const DISABLED = ["test.skip", "test.fixme", "test.todo", "describe.skip", ".only("];

/**
 * One file of the checkout, as text. Its callers are the two criteria whose subject IS text: AC-2's
 * docblock, and AC-3's frozen acceptance file against the copy of main's bytes. The one call that can
 * land on product source is AC-2's cause file, and it reads only how many lines that file has — the
 * range the docblock names must be a real place in it — never a line of its content.
 */
function read(file: string): string {
  // white-box: AC-2/AC-3 — both criteria are properties of TEXT (a docblock's opening, and that no
  // assertion, title, constant or timeout has left the acceptance file), which no behaviour of the
  // product can show; the only path that reaches a product module takes the file's length, not its text.
  return readFileSync(join(ROOT, file), "utf8");
}

/** A file the checkout must carry, named in the failure so a missing one says what is missing. */
function present(file: string, why: string): void {
  expect(existsSync(join(ROOT, file)), `${file} is missing from the checkout — ${why}`).toBe(true);
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
 * asks is what the FIRST thing the file says is. A `// @vitest-environment` pragma is a line of the
 * comment like any other, so a file that opens with one still answers with its first said line.
 */
function leadingComment(text: string): string | null {
  // A byte-order mark before the comment is still the comment's own place, so it is stepped over.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const block = /^(?:\s*\/\/[^\n]*\n)*\s*\/\*+([\s\S]*?)\*\//.exec(source);
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

/** The trailing timeout argument of every block that carries one, smallest first. */
function trailingTimeouts(text: string): number[] {
  return lines(text)
    .map((line) => /^\},\s*(\d[\d_]*)\);$/.exec(line)?.[1])
    .filter((found): found is string => found !== undefined)
    .map((found) => Number(found.replace(/_/g, "")))
    .sort((a, b) => a - b);
}

describe("inc-hotfix-20260914-1914: the jobs-edges red is reproduced, then fixed, and nothing it guards is weakened", () => {
  test("AC-2: the breakage is reproduced as a regression whose docblock names the cause it reproduces", () => {
    present(REGRESSION, "the hotfix owes the defect as a deterministic regression of its own before anything under src/** or db/** moves");

    // white-box: AC-2 — the criterion is a property of the regression file's OWN TEXT (its leading
    // docblock must open with a fixed marker and name the cause as <file>:<line>-<line>); there is no
    // behaviour to drive for it, and the file is a test of this increment's own, not product source.
    const opening = (leadingComment(read(REGRESSION)) ?? "").split("\n")[0] ?? "";
    expect(opening.startsWith(DOCBLOCK_OPENING), `${REGRESSION} must open with ${JSON.stringify(DOCBLOCK_OPENING)}; it opens with ${JSON.stringify(opening.slice(0, 120))}`).toBe(true);

    const rest = opening.slice(DOCBLOCK_OPENING.length).trim();
    const named = NAMED_CAUSE.exec(rest);
    expect(named, `${REGRESSION}'s docblock must name the cause as <repo-relative file>:<from>-<to> after the marker; it said ${JSON.stringify(rest.slice(0, 160))}`).not.toBeNull();

    const [matched, causeFile, from, to] = named as RegExpExecArray;
    expect(existsSync(join(ROOT, causeFile ?? "")), `the docblock names ${String(causeFile)} as the cause, and the checkout carries no such file`).toBe(true);
    expect(causeFile, "the docblock must name the SITE of the cause, not the regression that reproduces it").not.toBe(REGRESSION);
    // white-box: AC-2 — only the named file's LENGTH is read, to prove the line range is a real place
    // in it; nothing of its content is asserted on, which is the whole of the criterion's licence here.
    const causeLines = read(causeFile ?? "").split("\n").length;
    expect(Number(from) >= 1 && Number(from) <= Number(to), `the cause's line range ${String(from)}-${String(to)} is not a range`).toBe(true);
    expect(Number(to), `the docblock names lines up to ${String(to)} of ${String(causeFile)}, which has ${causeLines} lines`).toBeLessThanOrEqual(causeLines);

    const sentence = rest.slice(matched?.length ?? 0).replace(/^[\s—–:-]+/u, "");
    expect(sentence.length, `after the cause, the docblock owes one sentence of what was wrong; it said ${JSON.stringify(sentence)}`).toBeGreaterThanOrEqual(20);
    expect(sentence.includes(" "), `${JSON.stringify(sentence)} is not a sentence`).toBe(true);
  });

  test("AC-2: the regression stages its cause as a state through the database lane's own harness, and starts no process", () => {
    present(REGRESSION, "there is no regression to read");
    // white-box: AC-2 — that the cause is STAGED (a state the harness provisions) rather than
    // re-observed (the acceptance suite run a second time, or git asked what changed) is a property
    // of how the regression is written; no run of it can tell the two apart from the outside.
    const source = read(REGRESSION);

    expect(HARNESS_MODULE.test(source), `${REGRESSION} must reach the database lane's own harness (db/__tests__/harness) — a regression that provisions nothing stages nothing`).toBe(true);
    expect(source, `${REGRESSION} must stage its state on a scratch database from ${HARNESS_EXPORT}`).toContain(HARNESS_EXPORT);
    expect(new RegExp(`\\b${HARNESS_EXPORT}\\s*\\(`).test(source), `${REGRESSION} names ${HARNESS_EXPORT} but never calls it`).toBe(true);

    for (const spelling of SPAWNS) {
      expect(
        source.includes(spelling),
        `${REGRESSION} carries ${JSON.stringify(spelling)} — the regression stages the cause and asks the seam; re-running ${ACCEPTANCE} or reading git is not a reproduction`,
      ).toBe(false);
    }
  });

  test("AC-2: the regression is collected by the database lane, beside the acceptance it guards, and by no other lane", () => {
    // Asked of the partition the two configs are built from, not of two `vitest list` runs: the
    // database lane's include IS this list and the unit lane's exclude IS this list, so membership
    // here is collection there — and the same question at the runners costs the V-VERIFY budget two
    // cold vitest processes on every run (AM-10(1)). That the runners agree with this derivation is
    // tests/toolchain/test-lane-split.test.ts's own subject, which this increment leaves alone.
    const { database, databaseOutsideDb } = laneSplit(ROOT);

    expect(database, `the database lane does not collect ${REGRESSION} — a regression that reaches no harness runs in the wrong lane, or in none`).toContain(REGRESSION);
    expect(database, "the database lane must still collect the acceptance file the hotfix is about").toContain(ACCEPTANCE);
    expect(
      databaseOutsideDb,
      `${REGRESSION} does not live under db/__tests__, so it is the derived list that must carry it out of the unit lane — that lane opens no database, and the regression would prove nothing there`,
    ).toContain(REGRESSION);
  });

  test("AC-3: the baseline is main's acceptance file at the fork point this hotfix was cut from", () => {
    present(FORK_POINT_FILE, "AC-3 judges removals against main's bytes, and the commit they were taken at is named beside them");
    present(BASELINE, "AC-3 judges the acceptance file against the copy of main's bytes committed with the regression");

    // white-box: AC-3 — the fixture's own identity is text: one line naming the commit the baseline
    // was taken at, so a baseline taken from somewhere else can be told from main's.
    const said = read(FORK_POINT_FILE);
    expect(said.trim(), `${FORK_POINT_FILE} names the commit the baseline was copied at`).toBe(FORK_POINT);
    expect(said.split("\n").filter((line) => line.trim() !== "").length, `${FORK_POINT_FILE} is one line`).toBe(1);

    const was = read(BASELINE);
    expect([...was.matchAll(/\btest\(\s*"((?:[^"\\]|\\.)*)"/g)].length, "main's acceptance file carries seven tests; the baseline yielded a different number — the baseline is not main's").toBe(FROZEN_TITLES);
    expect(trailingTimeouts(was), "main's acceptance file gives its `afterAll` a 120_000 ms budget and nothing else a trailing one — the baseline is not main's").toEqual(FROZEN_TIMEOUTS);
    for (const [name, value] of FROZEN_CONSTANTS) {
      expect(was, `AC-3 names ${name} = ${value}, and the baseline does not declare it — the baseline is not main's`).toContain(`const ${name} = `);
    }
  });

  test("AC-3: the acceptance is extended, and none of main's assertions, titles, constants, slack or timeouts is weakened", () => {
    present(BASELINE, "AC-3 judges the acceptance file against the copy of main's bytes committed with the regression");
    // white-box: AC-3 — the criterion is about the TEXT of the acceptance file (no assertion removed,
    // no test retitled, no margin widened, nothing skipped), judged against the copy of main's bytes
    // at src/core/jobs/__tests__/support/hotfix-baseline/. Neither file is product source.
    const now = read(ACCEPTANCE);
    const was = read(BASELINE);
    const nowLines = tally(lines(now));
    const wasLines = lines(was);

    for (const [line, owed] of tally(wasLines.filter((line) => line.includes("expect(")))) {
      expect(nowLines.get(line) ?? 0, `${ACCEPTANCE} no longer carries this assertion line from main (${owed}x): ${line}`).toBeGreaterThanOrEqual(owed);
    }

    let titlesSeen = 0;
    for (const title of [...was.matchAll(/\btest\(\s*"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1] ?? "")) {
      titlesSeen += 1;
      expect(now, `${ACCEPTANCE} no longer carries main's test title ${JSON.stringify(title)} — a retitled test is a removed one`).toContain(`test("${title}"`);
    }
    expect(titlesSeen, "main's seven tests are what AC-3 freezes; the baseline yielded a different number of titles").toBe(FROZEN_TITLES);

    for (const [name, value] of FROZEN_CONSTANTS) {
      const declaration = new RegExp(`^(?:export )?const ${name} = (\\d[\\d_]*);$`, "m").exec(was);
      expect(declaration, `main declares ${name}, and the baseline does not — the baseline is not main's`).not.toBeNull();
      const [spelled, digits] = declaration as RegExpExecArray;
      expect(Number((digits ?? "").replace(/_/g, "")), `main declares ${name} at ${String(digits)}, and AC-3 names it ${value} — the baseline is not main's`).toBe(value);
      expect(now, `${ACCEPTANCE} no longer declares ${JSON.stringify(spelled)} — widening a bound or a slack is not a fix`).toContain(spelled);
    }

    const nowTimeouts = tally(trailingTimeouts(now).map(String));
    for (const [timeout, owed] of tally(trailingTimeouts(was).map(String))) {
      expect(nowTimeouts.get(timeout) ?? 0, `${ACCEPTANCE} no longer gives ${owed} of its blocks a ${timeout} ms budget — a red cleared by raising a timeout is not this hotfix`).toBeGreaterThanOrEqual(owed);
    }

    const literals = (text: string): Map<string, number> => tally([...text.matchAll(/\b\d[\d_]{2,}\b/g)].map((match) => match[0]));
    const nowLiterals = literals(now);
    for (const [literal, owed] of literals(was)) {
      expect(nowLiterals.get(literal) ?? 0, `${ACCEPTANCE} no longer carries the literal ${literal} ${owed} time(s) — every budget, slack and poll of main stands`).toBeGreaterThanOrEqual(owed);
    }

    for (const spelling of DISABLED) {
      expect(now.includes(spelling), `${ACCEPTANCE} carries ${JSON.stringify(spelling)} — a test that does not run judges nothing, and AC-1 owes seven that run`).toBe(false);
    }

    // Last, so that everything above is exercised against the tree as it stands: the criterion is that
    // the acceptance is EXTENDED and not weakened, and the extension is the regression that reproduces
    // the red beside it (AC-2). Until that file exists there is nothing extended here.
    expect(
      existsSync(join(ROOT, REGRESSION)),
      `nothing in ${ACCEPTANCE} has been weakened, but ${REGRESSION} is missing — the acceptance is not yet EXTENDED by the regression that reproduces the red`,
    ).toBe(true);
  });
});

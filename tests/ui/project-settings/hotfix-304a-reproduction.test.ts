/**
 * PUBLIC ACCEPTANCE for inc-304a-ruleset-authoring-ui-hotfix-a1 — AC-1, AC-2 and AC-4.
 *
 * AC-3 is next door in hotfix-304a-settings-contract.test.tsx, where the two surfaces 304a shipped
 * are mounted and walked. AC-5 and AC-6 are held out.
 *
 * WHAT THIS FILE JUDGES. The hotfix's own first deliverable is a REPRODUCTION —
 * tests/rulesets/hotfix-304a-golden-path.test.tsx — and everything below hangs off it: that it
 * exists at the path the increment owns, that its header names a real J-000 leg and quotes the
 * assertion that failed, that the leg it names is one that actually RUNS (not one of the four
 * admitted stubs, which would reproduce nothing), and that it runs in the lane `pnpm test` is —
 * the lane that opens no database. Until the Builder writes that file every test here is red, which
 * is the point: the reproduction lands before the fix.
 *
 * WHAT THIS FILE DOES NOT ASSERT, AND WHY — stated, never left to silence:
 *
 *   · AC-1's commit-subject clause (`git log --reverse … opens with a subject beginning `repro:`,
 *     and that commit precedes the first `fix:`) and AC-2's and AC-4's `git diff main` framing are
 *     CONTAINMENT: they are the structural gate's question about the branch's commits, never a
 *     test's. A suite that shells out to git, reads a diff or reads the merge base is not
 *     acceptance (the precedent set by tests/jobs/hotfix-acceptance.test.ts).
 *   · AC-1's "`pnpm vitest run tests/rulesets/hotfix-304a-golden-path.test.tsx` is green" is that
 *     file's own verdict in the unit lane the gate runs; what is judged here is that the lane
 *     partition puts it there at all.
 *   · AC-2's "`pnpm e2e --journey J-000` exits 0 and prints `JOURNEY J-000 green`" is the gate's
 *     J-000 journey stage — eleven browser legs, a build and two seeded tenants, which no unit test
 *     may stand in for. Its leg roster is governed by tests/journeys/j-000-roster.test.ts and its
 *     stubs by tests/journeys/fixme-roster.test.ts, both of which this increment leaves alone.
 *   · AC-4's "`pnpm test` and `pnpm typecheck` are green" is the gate's unit and types lanes.
 *
 * HOW "NOTHING CHANGED" IS JUDGED WITHOUT A DIFF. Main's own bytes are recorded beside this suite
 * as SHA-256, at support/hotfix-304a-fork-point.ts, taken at the commit this branch forked from. A
 * frozen tree is judged whole — same files, same digests, nothing added and nothing deleted — so
 * this reads the three trees AC-2 freezes rather than a list of four names that a later leg would
 * make stale (B-19).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { laneSplit } from "../../../scripts/lib/pg-suites.mjs";
import { FORK_POINT, FORK_POINT_DIGESTS } from "./support/hotfix-304a-fork-point";

/** The checkout this suite judges. `tests/ui/project-settings/` is three levels below it. */
const ROOT = resolve(import.meta.dirname, "..", "..", "..");

/** This increment's id, as a design doc's changelog line must name it (AC-4, B-20). */
const INCREMENT = "inc-304a-ruleset-authoring-ui-hotfix-a1";

/** The reproduction the hotfix owes, at the one path its ownership grants (AC-1). */
const REPRODUCTION = "tests/rulesets/hotfix-304a-golden-path.test.tsx";

/** The exact text AC-1 requires the reproduction's first comment line to open with. */
const HEADER_OPENING = "HOTFIX inc-304a (J-000):";

/** The Golden Path's own directory — the legs AM-09 §2 makes a directory of. */
const J000 = "tests/e2e/journeys/j-000";

/**
 * What must follow the marker: the leg file, then the failing assertion message in quotes. The leg
 * is matched by SHAPE (`<cp>-<leg>.spec.ts` under the golden path) and then looked for in the tree —
 * the evidence pack names which one, and the tree says whether it is real.
 */
const HEADER_REST = /^(tests\/e2e\/journeys\/j-000\/[A-Za-z0-9._-]+\.spec\.ts)\s*[—–:-]\s*["“'](.+)["”']\s*$/u;

/** Every spelling that takes a leg out of the run — a stub reproduces nothing (AM-09, fixme-roster). */
const STUBBED = [/\btest\.fixme\(/, /\btest\.skip\(/, /\btest\.todo\(/, /\btest\.describe\.skip\(/, /(?<!test\.)\bdescribe\.skip\(/];

/** The three trees AC-2 freezes: the Golden Path, its pictures, and the journey lane's support. */
const FROZEN_TREES = [J000, "tests/e2e/baselines/design-dark/j-000", "tests/e2e/support"] as const;

/** The Design Decisions this increment may amend, and the pictures that move with them (AC-4, B-20). */
const SCREEN_DOCS = ["docs/design/s-settings-ruleset-author.md", "docs/design/s-settings.md", "docs/design/s-settings-project-sub-navigation.md"] as const;
const SCREEN_PICTURES = "tests/e2e/baselines/design-dark/s-settings-ruleset-author";

/**
 * One file of the checkout, as text. Every caller here has TEXT for its subject — a header line the
 * criterion spells out, whether a leg file declares a stub, whether a Design Decision carries a
 * changelog line — and none of them reads product source: the reproduction and the legs are tests,
 * the Decisions are documents the increment owns.
 */
function read(file: string): string {
  // white-box: AC-1/AC-2/AC-4 — the subjects are the reproduction's own header, the golden path's
  // leg files and this increment's Design Decisions; none is src/, scripts/ or db/, and no behaviour
  // of the product can show whether a comment line names the leg the evidence pack blamed.
  return readFileSync(join(ROOT, file), "utf8");
}

/**
 * Every file under a directory of the checkout, repo-relative, in a stable order. It NAMES files;
 * it opens none. Its three callers are AC-2's frozen trees (tests/e2e/journeys/j-000/,
 * tests/e2e/baselines/design-dark/j-000/, tests/e2e/support/), AC-2's leg roster and AC-4's
 * pictures (tests/e2e/baselines/design-dark/s-settings-ruleset-author/) — the Golden Path, the
 * journey lane's support and two directories of PNGs. None of them is src/, scripts/ or db/.
 */
// white-box: AC-2/AC-4 — both criteria are about a SET OF FILES and its bytes ("nothing under
// <these three trees> changes on the branch"; "a Decision and its pictures move together"). A
// directory listing is the only way to ask whether a file was added or deleted, and a PNG has no
// behaviour to drive. This walks test and baseline directories only; nothing under src/ is listed.
function filesUnder(tree: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else out.push(relative(ROOT, path).split("\\").join("/"));
    }
  };
  if (existsSync(join(ROOT, tree))) walk(join(ROOT, tree));
  return out;
}

/** The SHA-256 of a file's bytes as the fork-point manifest records them. */
function digestOf(file: string): string {
  // white-box: AC-2/AC-4 — "byte-identical to main" is a property of BYTES and of nothing else, and
  // the criteria ask it of test files, Design Decisions and PNG baselines. Nothing of the content is
  // asserted on, or even decoded: a digest is taken and compared with the one main left. The callers
  // pass paths under tests/e2e/ and docs/design/ only — never src/, scripts/ or db/.
  return createHash("sha256").update(readFileSync(join(ROOT, file))).digest("hex");
}

/**
 * The file's leading comment as a list of lines, with the comment marks taken off and vitest's
 * environment pragma stepped over: `// @vitest-environment jsdom` must stand at the top of a file
 * that asks for a DOM, so it cannot be what "the first comment line" means (AC-1 asks for jsdom in
 * the same breath). Both spellings of a comment are read — a `/** … *\/` block and a run of `//`.
 */
function leadingCommentLines(text: string): string[] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const said: string[] = [];
  let rest = source;
  for (;;) {
    const before = rest.length;
    rest = rest.replace(/^\s+/, "");
    const block = /^\/\*+([\s\S]*?)\*\//.exec(rest);
    if (block !== null) {
      said.push(...(block[1] ?? "").split("\n").map((line) => line.replace(/^\s*\*+ ?/, "").trim()));
      rest = rest.slice(block[0].length);
      continue;
    }
    const line = /^\/\/ ?(.*)(?:\n|$)/.exec(rest);
    if (line !== null) {
      said.push((line[1] ?? "").trim());
      rest = rest.slice(line[0].length);
      continue;
    }
    if (rest.length === before) break;
  }
  return said.filter((line) => line !== "" && !line.startsWith("@vitest"));
}

/** The reproduction's header, parsed: the leg it blames and the message it quotes. */
function header(): { line: string; leg: string; message: string } {
  const line = leadingCommentLines(read(REPRODUCTION))[0] ?? "";
  expect(
    line.startsWith(HEADER_OPENING),
    `${REPRODUCTION} must open with a comment line beginning ${JSON.stringify(HEADER_OPENING)} (the vitest environment pragma may precede it); it opens with ${JSON.stringify(line.slice(0, 140))}`,
  ).toBe(true);
  const rest = line.slice(HEADER_OPENING.length).trim();
  const named = HEADER_REST.exec(rest);
  expect(
    named,
    `after ${JSON.stringify(HEADER_OPENING)} the header owes the failing leg file and the assertion message verbatim in quotes — ${JSON.stringify(`${J000}/<cp>-<leg>.spec.ts — "<message>"`)}; it said ${JSON.stringify(rest.slice(0, 200))}`,
  ).not.toBeNull();
  const [, leg, message] = named as RegExpExecArray;
  return { line, leg: leg ?? "", message: message ?? "" };
}

describe("inc-304a-ruleset-authoring-ui-hotfix-a1: the J-000 red is reproduced first, and the Golden Path is left alone", () => {
  test("AC-1: the reproduction exists, and its first comment line names the failing leg and quotes its assertion", () => {
    expect(
      existsSync(join(ROOT, REPRODUCTION)),
      `${REPRODUCTION} is missing — the hotfix owes the breakage as a failing test of its own, committed under a \`repro:\` subject, before anything under src/** moves`,
    ).toBe(true);

    const { leg, message } = header();

    expect(existsSync(join(ROOT, leg)), `the header blames ${leg}, and the checkout carries no such leg — the evidence pack names a file of the golden path`).toBe(true);
    expect(
      message.trim().length,
      `the header must quote the failing assertion message VERBATIM from the evidence pack, so a reader can find the run it came from; it quoted ${JSON.stringify(message)}`,
    ).toBeGreaterThanOrEqual(12);
    expect(message.includes(" "), `${JSON.stringify(message)} is not an assertion message`).toBe(true);
  });

  test("AC-2: the leg the reproduction blames is one the golden path EXECUTES, not one of its admitted stubs", () => {
    expect(existsSync(join(ROOT, REPRODUCTION)), `${REPRODUCTION} is missing — there is no reproduction to bind to a leg yet`).toBe(true);
    const { leg } = header();

    // The partition is read off the legs themselves, never off a list of seven names here: a leg
    // this milestone restores stops being a stub by itself, and a leg a later milestone adds is
    // judged the same way without this file moving (B-19, AM-09 §2).
    // white-box: AC-2 — the golden path IS a directory (AM-09 §2), so its leg roster is read by
    // listing that directory; this names the leg files under tests/e2e/journeys/j-000/ and opens
    // none of them here.
    const legs = filesUnder(J000).filter((file) => file.endsWith(".spec.ts"));
    expect(legs, `${leg} is not collected by the golden path's own directory`).toContain(leg);

    const source = read(leg);
    const stubbed = STUBBED.filter((spelling) => spelling.test(source));
    expect(
      stubbed.map((spelling) => spelling.source),
      `${leg} declares a stub, so it never ran and nothing it "asserts" could have failed — the reproduction must blame one of the legs the run EXECUTES (m2-column-lines, m2-coverage-grid, m3-bill-and-schedules and m4-sheet-and-manual-measure are the four admitted stubs, each its own milestone's increment)`,
    ).toEqual([]);
    expect(/\btest(?:\.describe)?\(/.test(source), `${leg} declares no executed test at all`).toBe(true);
  });

  test("AC-2: the golden path, its pictures and the journey lane's support stand byte-for-byte as main left them", () => {
    const frozen = Object.keys(FORK_POINT_DIGESTS).filter((path) => FROZEN_TREES.some((tree) => path.startsWith(`${tree}/`)));
    expect(frozen.length, `the fork-point manifest taken at ${FORK_POINT} recorded none of the frozen trees`).toBeGreaterThan(0);

    // white-box: AC-2 — "nothing under these three trees changes" is answered by listing them and
    // comparing each file's digest with main's; a file ADDED or DELETED is invisible to any other
    // question. The three trees are the Golden Path, its pictures and the journey lane's support.
    const now = new Set(FROZEN_TREES.flatMap((tree) => filesUnder(tree)));
    for (const path of frozen) {
      expect(now.has(path), `${path} has been deleted or moved — the Golden Path and its lane support are the gate's shared surface, not this leaf's`).toBe(true);
      expect(
        digestOf(path),
        `${path} has changed on this branch. No J-000 leg, baseline, budget or support file moves for this hotfix: a budget that must move is named in the Handoff, not edited`,
      ).toBe(FORK_POINT_DIGESTS[path]);
    }
    const added = [...now].filter((path) => FORK_POINT_DIGESTS[path] === undefined);
    expect(added, "a file has been ADDED to the Golden Path or its lane support — this leaf adds no leg and edits none").toEqual([]);
  });

  test("AC-4: the reproduction runs in the lane `pnpm test` is, and that lane opens no database", () => {
    expect(
      existsSync(join(ROOT, REPRODUCTION)),
      `${REPRODUCTION} is missing — the fix is bounded to the paths this increment owns, and this is the one test path among them that must come into being`,
    ).toBe(true);

    // Asked of the partition both configs are built from (ARCH-02, scripts/lib/pg-suites.mjs), not
    // of two cold `vitest list` runs: the database lane's include IS this list and the unit lane's
    // exclude IS this list, so absence here is collection by `pnpm test`. A reproduction that grew
    // an import reaching the live seeds would move lanes by itself and stop being jsdom-and-no-
    // database, which is exactly what AC-1 forbids it to be.
    const { database } = laneSplit(ROOT);
    expect(
      database,
      `${REPRODUCTION} reaches a live-database seam, so the database lane claims it — AC-1 owes a unit-lane, jsdom reproduction that opens no database`,
    ).not.toContain(REPRODUCTION);
  });

  test("AC-4: a Decision and its pictures move together, or neither moves (B-20)", () => {
    const docsMoved: string[] = [];
    for (const doc of SCREEN_DOCS) {
      expect(existsSync(join(ROOT, doc)), `${doc} has been deleted — a screen's Decision is amended in place, never replaced`).toBe(true);
      if (digestOf(doc) !== FORK_POINT_DIGESTS[doc]) docsMoved.push(doc);
    }

    // white-box: AC-4 — the pictures the criterion makes move with the Decision are PNG baselines:
    // they have no behaviour to drive, and whether one was re-taken, added or dropped is a question
    // about the directory and its bytes. Nothing under src/ is listed or read.
    const picturesNow = filesUnder(SCREEN_PICTURES);
    const picturesMoved = picturesNow.filter((picture) => digestOf(picture) !== FORK_POINT_DIGESTS[picture]);
    for (const path of Object.keys(FORK_POINT_DIGESTS).filter((path) => path.startsWith(`${SCREEN_PICTURES}/`))) {
      expect(picturesNow, `${path} has been deleted — a picture is re-taken, never dropped`).toContain(path);
    }

    // A fix that moves no screen owes nothing, and that is the leg this hotfix expects to walk: the
    // clause is not vacuous, because the moment either side moves the other is owed by name.
    if (docsMoved.length === 0 && picturesMoved.length === 0) return;

    for (const doc of docsMoved) {
      expect(
        read(doc).includes(INCREMENT),
        `${doc} has been amended, and no changelog line in it names ${INCREMENT} — a Decision that changed without saying so is a deviation, not an amendment (B-20)`,
      ).toBe(true);
    }
    if (picturesMoved.length > 0) {
      expect(
        docsMoved,
        `${picturesMoved.join(", ")} was re-taken, so this fix MOVED a rendered screen: its Design Decision is amended in place in the same breath, with a changelog line naming ${INCREMENT} (B-20)`,
      ).not.toEqual([]);
    }
  });
});

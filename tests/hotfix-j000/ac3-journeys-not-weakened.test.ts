/**
 * AC-3 — J-001 and J-002 stay green honestly.
 *
 * The two journeys inc-010b landed are this increment's to own, which is exactly why they are worth
 * guarding: the cheapest way to make a journey exit 0 is to stop it asking. So this file compares
 * each spec against its pre-fix self and refuses a net loss — assertions, visual comparisons and
 * named checkpoints are a floor that may rise and may not fall — and it holds any regenerated
 * baseline to B-20's discipline: its own commit, subject starting `baseline:`, naming the proof.
 *
 * Whether the two journeys exit 0 is the journey lane's own reading, made by the gate against the
 * built product on one `--journey` invocation each; nothing here re-runs them.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRE_FIX,
  REPO_ROOT,
  blobAt,
  branchCommits,
  callCount,
  changedSincePreFix,
  commitsTouching,
  gitLines,
  literalArgumentsOf,
  objectIdAt,
  objectIdInTree,
  withoutComments,
} from "./support/history";

/** The two journeys this increment owns, by the spec paths the ownership list names. */
const OWNED_JOURNEYS = ["tests/e2e/journeys/j-001-auth.spec.ts", "tests/e2e/journeys/j-002-tenant-admin.spec.ts"] as const;

/** The journey ids those specs walk — what a `baseline:` subject has to name to name its proof. */
const OWNED_JOURNEY_IDS = ["J-001", "J-002"] as const;

/** The working-tree text of a repo-relative path, or null where the tree has not got it. */
function currentText(path: string): string | null {
  const absolute = join(REPO_ROOT, path);
  // white-box: AC-3 — the criterion is a property of the two journey SPECS' own text: that each
  // still makes at least as many assertions, declares at least as many cases and names every
  // screenshot and checkpoint it named at the pre-fix merge. What the journeys DO is the journey
  // lane's reading, made against the built product; "they have not been weakened to get there" can
  // only be read off the text, compared with the same text at `PRE_FIX`.
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
}

/** Is this a baseline image belonging to one of the two journeys this increment owns? */
function isOwnedBaseline(path: string): boolean {
  return isBaselineImage(path) && (path.includes("j-001") || path.includes("j-002"));
}

/**
 * Is this a journey baseline image at all, whichever journey it grades? B-20 grants every
 * law-changing increment the ownership to re-baseline what its change froze, so a re-baseline is
 * read the way B-20 means it — any journey's image — and not "a baseline this increment happens to
 * own".
 */
function isBaselineImage(path: string): boolean {
  return path.startsWith("tests/e2e/") && /\.(?:png|jpg|jpeg)$/i.test(path);
}

/**
 * The frozen expectations a lane grades against, which B-20 re-baselines beside the pictures: it
 * says "the tests and visual baselines that assert them" — two kinds, and the first is not an
 * image. A regenerated comparison artifact (the cad lane's entity graphs) and a frozen expectation
 * a plan has DECLARED re-baselined both land under the same discipline, so the stray reading below
 * has to admit them; reading `baseline` as pictures alone makes a lawful `baseline:` commit a red
 * no actor may clear.
 */
function isRegeneratedBaseline(path: string): boolean {
  return isBaselineImage(path) || /^cad\/tests\/fixtures\/.*\.entitygraph\.json$/.test(path) || DECLARED_REBASELINED.includes(path);
}

/**
 * The frozen expectations this branch's plan names as re-baselined — no wider a licence than the
 * criteria spell, so every undeclared file is still a stray.
 *
 * `src/core/errors/aggregate.test.ts` is the third: inc-301's AC-2 (iii) declares it re-baselined for
 * the three EXPORT_* entries and asks for it "in its own `baseline:` commit naming the three
 * entries", which is B-20's own discipline. The frozen expectation happens to live beside the
 * register it freezes rather than under `tests/`, and where a declared re-baseline lives is not what
 * makes it one.
 *
 * That third entry and this note are the ARBITRATION's, not a Builder's: the ruling on inc-301
 * (DECLARED_REBASELINED) ratifies them as an arbiter-ordered amendment, so no reviewer reads them as
 * scope drift. The same ruling's wider cure — scoping the stray reading to STATE, by reading the
 * declaration out of the increment specs on the branch and deleting this list — waits on a source a
 * test can read: no increment spec is committed to this tree (`docs/specs/` holds the Bible, the
 * perf specs and the design decisions, and nothing increment-shaped), so a read of it today would
 * admit nothing and turn a lawful `baseline:` commit into a red no actor may clear. Until a spec
 * lands in the tree, the ruling's second limb governs and the list stands.
 *
 * `tests/jobs/support/hotfix-baseline/jobs-seam.main.txt` is the fourth: main's jobs-seam suite
 * frozen at FORK_POINT da94c0d3 for inc-hotfix-20260914-0052's AC-3, re-taken past the SEAM-JOBS
 * AC-2 arbitration (437041d8). The pre-ruling copy demanded of `tests/jobs/jobs-seam.test.ts` a
 * measured gap compared against another measured gap — a wall-clock budget AM-10 §3 forbids a gate
 * lane to assert — so keeping the frozen copy would oblige the lane to keep an assertion the
 * arbitration struck out, which is exactly the frozen expectation B-20 lets an increment re-take.
 * It rode its own commit, `baseline: the frozen jobs-seam copy is re-taken past the arbitration
 * (B-20, SEAM-JOBS AC-2)`, which names its proof; the stray reading below is what would otherwise
 * make that lawful commit a red no actor may clear. This entry, like the third, is the
 * ARBITRATION's and not a Builder's, so no reviewer reads it as scope drift.
 *
 * The fifth, sixth, seventh and eighth are inc-306-rails-frame's, and they too are the ARBITRATION's
 * and not a Builder's — ordered in the manner of the third and fourth, so no reviewer reads them as
 * scope drift. AC-1 of that increment declares its re-emissions by path: "`db/catalogue/work-items.json`,
 * `bears.json` and `digest.txt` are re-emitted from the consts (catalogue-drift green, a `baseline:`
 * commit)" — the shipped emitter writes all three from the consts and catalogue-drift grades them, so
 * a kind landing in `KINDS` moves them mechanically. The same criterion declares "`KINDS_BEFORE` in
 * src/modules/takeoff/rails/aggregate.test.ts re-baselined to that pair" (`["rcc.concrete",
 * "rcc.formwork"]`), which is the frozen roster that increment's split proof compares the enumerated
 * whole against. `src/core/errors/aggregate.test.ts` stays its own named entry above — inc-301's three
 * EXPORT_* codes, and AC-4's three frame codes — and is not folded into any pattern; a roster that
 * moves mechanically takes a NAMED entry backed by a quoted criterion, never a class-wide rule, since
 * a pattern over every file called `aggregate.test.ts` would admit an arbitrary edit to any roster for
 * all time and defeat the checkpoint below. The licence widens by exactly these declared paths and not
 * in kind: every undeclared file is still a stray.
 *
 * The ninth is inc-300a-doc-seam's, declared by its AC-2 in the same manner as the third and fourth:
 * the golden PDF is "byte-identical to the committed golden tests/docs/proof/golden.pdf (sha256
 * compared, the golden byte-frozen and committed in its own `baseline:` commit naming this proof)".
 * A golden PDF is a frozen expectation a lane grades against — the same kind of thing as the cad
 * lane's entity graphs, and not an image — so B-20's discipline is exactly what it lands under, and
 * without a named entry the very commit that criterion demands is the red no actor may clear that
 * this reading exists to avoid. Its own commit names the proof (`baseline: the proof document's
 * golden PDF, minted by the pinned renderer`). One path, backed by a quoted criterion, as the note
 * above requires; the licence does not widen in kind, and `tests/docs/**` at large is still stray.
 *
 * That ninth entry is the ARBITRATION's, not a Builder's, in the manner of the third through eighth:
 * the ruling on inc-300a's AC-2 (TEST_AMENDED) orders it kept and ratifies commit b30e9530, which
 * added it, as lawful — so no reviewer reads either as scope drift. Its footing is the stronger one
 * of the nine, because the declaration is a PUBLIC acceptance criterion of the increment under test,
 * quoted verbatim above and not inferred: AC-2 requires "the golden byte-frozen and committed in its
 * own `baseline:` commit naming this proof", so read as it stood the stray reading red the very
 * commit AC-2 commands, and two lawful instructions contradicted. The cure is the state-scoped form
 * this list serves: the stray reading is disarmed for a path a committed increment criterion declares
 * frozen, and for no other. The ruling's wider cure — reading that declaration out of the increment
 * spec on the branch and deleting this list — still waits on a spec committed to the tree, so the
 * second limb governs here too and the list stands. What the ruling does NOT clear is inc-300a's own
 * owned work: the Builder must still mint the golden under the AM-08 pin and commit it byte-frozen.
 */
const DECLARED_REBASELINED: readonly string[] = [
  "tests/rulesets/support/editions.ts",
  "db/__tests__/ruleset-editions.migration.test.ts",
  "src/core/errors/aggregate.test.ts",
  "tests/jobs/support/hotfix-baseline/jobs-seam.main.txt",
  "db/catalogue/work-items.json",
  "db/catalogue/bears.json",
  "db/catalogue/digest.txt",
  "src/modules/takeoff/rails/aggregate.test.ts",
  "tests/docs/proof/golden.pdf",
];

describe("AC-3: J-001 and J-002 keep asking what they asked, and any re-baseline says so", () => {
  for (const path of OWNED_JOURNEYS) {
    it(`AC-3: ${basename(path)} asks at least as much as it did at the pre-fix merge`, () => {
      const before = blobAt(PRE_FIX, path);
      expect(before, `${path} is not tracked at ${PRE_FIX}, so there is no pre-fix reading to compare against`).not.toBeNull();
      const after = currentText(path);
      expect(after, `${path} has been deleted; AC-3 keeps both journeys walking`).not.toBeNull();

      const old = before ?? "";
      const now = after ?? "";

      // Floors, not counts (B-19): a repair may lawfully add a case, a checkpoint or a comparison.
      // What it may not do is arrive at green by asking less than the pre-fix spec asked.
      expect(callCount(now, "expect"), `${path} makes fewer assertions than it did at ${PRE_FIX} — AC-3 deletes and weakens nothing`).toBeGreaterThanOrEqual(
        callCount(old, "expect"),
      );
      expect(callCount(now, "test"), `${path} declares fewer cases than it did at ${PRE_FIX}`).toBeGreaterThanOrEqual(callCount(old, "test"));

      // Every visual comparison the pre-fix spec made is still made, by name. Re-baselining changes
      // the IMAGE; dropping the `toHaveScreenshot` call changes what is graded.
      const shotsAfter = new Set(literalArgumentsOf(now, "toHaveScreenshot"));
      const droppedShots = literalArgumentsOf(old, "toHaveScreenshot").filter((name) => !shotsAfter.has(name));
      expect(droppedShots, `${path} no longer compares these baselines it compared at ${PRE_FIX}: ${droppedShots.join(", ")}`).toEqual([]);

      // The same reading for the named checkpoints V-E2E owes a screenshot at.
      const checksAfter = new Set(literalArgumentsOf(now, "checkpoint"));
      const droppedChecks = literalArgumentsOf(old, "checkpoint").filter((name) => !checksAfter.has(name));
      expect(droppedChecks, `${path} no longer stands on these checkpoints: ${droppedChecks.join(", ")}`).toEqual([]);

      // Silencing is the other way to stop asking.
      const bare = withoutComments(now);
      expect(/\b(?:test|it|describe)\s*\.\s*(?:skip|fixme|todo)\b/.test(bare), `${path} skips a case rather than answering it`).toBe(false);
      expect(/\btest\s*\.\s*setTimeout\s*\(\s*0\s*\)/.test(bare), `${path} disarms its own timeout`).toBe(false);
    });
  }

  it("AC-3: every regenerated baseline of these journeys landed in its own `baseline:` commit naming the proof", () => {
    for (const image of changedSincePreFix().filter(isOwnedBaseline)) {
      // An image the working tree holds differently from HEAD has not landed anywhere yet: B-20 asks
      // for a commit, and a commit is what the discipline is read out of.
      expect(
        objectIdInTree(image),
        `${image} differs from the pre-fix baseline but is not committed — B-20 wants it in its own commit whose subject starts \`baseline:\``,
      ).toBe(objectIdAt("HEAD", image));

      const subjects = commitsTouching(image);
      expect(subjects.length, `${image} changed since ${PRE_FIX} but no commit on this branch names it`).toBeGreaterThan(0);

      for (const subject of subjects) {
        expect(subject.startsWith("baseline:"), `the commit that moved ${image} is titled "${subject}" — B-20 wants a subject starting \`baseline:\``).toBe(true);
        const namesProof = OWNED_JOURNEY_IDS.some((id) => subject.includes(id)) || subject.includes(basename(image).replace(/\.[^.]+$/, ""));
        expect(namesProof, `"${subject}" re-baselines ${image} without naming the proof it stands on (its journey id or the baseline's own name)`).toBe(true);
      }
    }
  });

  it("AC-3: a `baseline:` commit carries baselines and nothing else", () => {
    // B-20's discipline is "its own commit". A repair smuggled into a re-baseline is a repair that
    // was reviewed as a picture. The stray reading is journey-agnostic on purpose: a later
    // increment's lawful re-baseline of a journey this increment never owned is still a `baseline:`
    // commit carrying only baselines, and reading it as all-strays would be a red no actor can clear.
    for (const { sha, subject } of branchCommits()) {
      if (!subject.startsWith("baseline:")) continue;
      const strays = gitLines("show", "--name-only", "--format=", sha).filter((path) => !isRegeneratedBaseline(path));
      expect(strays, `the baseline commit "${subject}" also carries files that are not baselines:\n  ${strays.join("\n  ")}`).toEqual([]);
    }
  });
});

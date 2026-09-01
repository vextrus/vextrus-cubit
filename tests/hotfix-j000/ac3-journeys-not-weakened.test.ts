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
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
}

/** Is this a baseline image belonging to one of the two journeys this increment owns? */
function isOwnedBaseline(path: string): boolean {
  return isBaselineImage(path) && (path.includes("j-001") || path.includes("j-002"));
}

/**
 * Is this a journey baseline image at all, whichever journey it grades? B-20 grants every
 * law-changing increment the ownership to re-baseline what its change froze, so "a `baseline:`
 * commit carries baselines and nothing else" has to read `baseline` the way B-20 means it — any
 * journey's image — and not "a baseline this increment happens to own".
 */
function isBaselineImage(path: string): boolean {
  return path.startsWith("tests/e2e/") && /\.(?:png|jpg|jpeg)$/i.test(path);
}

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
      const strays = gitLines("show", "--name-only", "--format=", sha).filter((path) => !isBaselineImage(path));
      expect(strays, `the baseline commit "${subject}" also carries files that are not baselines:\n  ${strays.join("\n  ")}`).toEqual([]);
    }
  });
});

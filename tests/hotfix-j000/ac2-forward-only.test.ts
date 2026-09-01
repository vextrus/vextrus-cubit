/**
 * AC-2 — the fix is forward-only, and J-000 is still J-000.
 *
 * Greening a journey by editing what grades the journey is not a fix. J-000's specs, its
 * `.e2e.ts` leg, its baselines and the shared page objects and e2e support every journey stands on
 * are another node's grading surface: byte-frozen at the pre-fix merge. This file reads the branch's
 * own history and working tree and refuses any move onto that ground.
 *
 * The roster of frozen assets is DERIVED from what the pre-fix merge actually tracked, not listed
 * here — a J-000 asset the Bible's "extended per milestone" adds later is carried by the same rule
 * without an edit. The three tests the interfaces line names are asserted as a floor on top of it:
 * they must still exist and must still be reachable by the runner's `--journey J-000` grep, because
 * a journey the gate cannot collect is green by omission (V-E2E).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIX_END, PRE_FIX, REPO_ROOT, changedSincePreFix, filesAt, objectIdAt, withoutComments } from "./support/history";

/**
 * The three J-000 tests `pnpm e2e --journey J-000` runs, as this increment's interfaces line spells
 * them. A floor on the derived freeze below, never a ceiling on what J-000 may hold.
 */
const NAMED_J000_TESTS = [
  "tests/e2e/journeys/j-000-golden-path.spec.ts",
  "tests/e2e/journeys/j-000-smoke.spec.ts",
  "tests/e2e/j-000-golden-path.e2e.ts",
] as const;

/** How the journey runner selects a journey: Playwright's title grep, on the journey's own id. */
const JOURNEY_ID = "J-000";

/**
 * Ground this increment may not move onto: anything under `tests/` that names J-000 (its specs, its
 * `.e2e.ts` leg, every snapshot and baseline whose path carries the id) and the two shared homes
 * every journey leans on. A defect found in the shared homes is an objection back to the plan.
 */
function isFrozenGround(path: string): boolean {
  if (path.startsWith("tests/e2e/pages/")) return true;
  if (path.startsWith("tests/e2e/support/")) return true;
  return path.startsWith("tests/") && path.includes("j-000");
}

describe("AC-2: J-000 is repaired forward, never by editing what grades J-000", () => {
  it("AC-2: the branch changes no J-000 asset and no shared page object or e2e support file", () => {
    const trespass = changedSincePreFix().filter(isFrozenGround);
    expect(
      trespass,
      `these paths are J-000's grading surface or the shared homes every journey stands on, frozen at ${PRE_FIX} — the repair lives inside inc-010b's merged src footprint instead:\n  ${trespass.join("\n  ")}`,
    ).toEqual([]);
  });

  it("AC-2: every J-000 asset the pre-fix merge tracked is byte-identical at the end of this fix", () => {
    // Derived, so the freeze covers whatever J-000 was made of at the pin rather than a list that
    // would age. `changedSincePreFix` reads names; this reads content, and catches a same-name
    // rewrite the name reading alone would let through.
    //
    // Both ends of the reading are the interval's own: the pin and `FIX_END`. J-000 is "extended per
    // milestone", so a later milestone may lawfully rewrite these files — what this increment claims
    // is that IT did not, and that claim is settled once the hotfix lands.
    const frozen = filesAt(PRE_FIX, "tests/").filter(isFrozenGround);
    expect(frozen.length, `no frozen J-000 or shared-journey asset was found at ${PRE_FIX} — the reading below would prove nothing`).toBeGreaterThan(0);

    const moved = frozen.filter((path) => objectIdAt(FIX_END, path) !== objectIdAt(PRE_FIX, path));
    expect(moved, `these are byte-frozen at ${PRE_FIX} and ${FIX_END} holds a different content (or has deleted them):\n  ${moved.join("\n  ")}`).toEqual([]);
  });

  it("AC-2: the three J-000 tests the interfaces line names are still present and still collected", () => {
    for (const path of NAMED_J000_TESTS) {
      const absolute = join(REPO_ROOT, path);
      expect(existsSync(absolute), `${path} is one of the three tests \`pnpm e2e --journey ${JOURNEY_ID}\` runs, and the checkout has not got it`).toBe(true);

      // The runner turns `--journey J-000` into Playwright's `--grep J-000`, which matches a test's
      // full title. A file whose titles stopped naming the journey would still be committed and
      // still be green — by never running.
      const bare = withoutComments(readFileSync(absolute, "utf8"));
      const titles = [...bare.matchAll(/\b(?:test|it)\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)].map((match) => match[2] ?? "");
      const describes = [...bare.matchAll(/\bdescribe\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)].map((match) => match[2] ?? "");
      const reachable = [...titles, ...describes].some((title) => title.includes(JOURNEY_ID));
      expect(reachable, `no test title in ${path} names ${JOURNEY_ID}, so the runner's grep cannot reach it and the journey is green by omission`).toBe(true);
    }
  });

  it("AC-2: the journey runner still takes exactly one journey, so the criterion's invocations are the lawful ones", () => {
    // AC-2 and AC-3 are each stated as a single `--journey` invocation. That is a property of the
    // runner, and the acceptance would be describing a command that does not exist if it changed.
    const runner = readFileSync(join(REPO_ROOT, "scripts", "e2e.mjs"), "utf8");
    const bare = withoutComments(runner);
    expect(bare.includes("--journey"), "scripts/e2e.mjs no longer reads a --journey flag").toBe(true);
    expect(bare.includes("--grep"), "scripts/e2e.mjs no longer turns the journey into Playwright's title grep").toBe(true);
  });
});

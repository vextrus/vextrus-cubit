/**
 * AC-1 — reproduce before repair.
 *
 * The increment's first deliverable is not the fix: it is the pin. Before anything in inc-010b's
 * merged footprint moves, the branch must add
 * `src/modules/spine/tenancy/__tests__/j000-hotfix-regression.test.ts` — a scoped-runnable file that
 * names the mechanism the evidence pack's failing J-000 output names.
 *
 * What THIS file grades is the half a regression file cannot grade about itself: that it exists at
 * the path the criterion names, that the branch is what added it, that the product's own unit lane
 * actually collects it (a file outside every include glob is run by nothing and proves nothing), and
 * that it carries assertions rather than an empty shell. Whether it passes here is answered by the
 * lane running it beside this one; whether it FAILS against the pre-fix tree — the discrimination
 * that makes it a regression rather than a tautology — is graded held-out (AC-5).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRE_FIX, REPO_ROOT, matchesGlob, objectIdAt, resolves, withoutComments } from "./support/history";

/** The path AC-1 names, verbatim. It is the criterion's own literal, not a discovery. */
const REGRESSION = "src/modules/spine/tenancy/__tests__/j000-hotfix-regression.test.ts";

/** The unit lane's config — the one home of what this product collects (ARCH-02). */
async function unitLaneIncludes(): Promise<string[]> {
  const loaded = (await import("../../vitest.config")) as { default?: unknown };
  const config = loaded.default as { test?: { include?: unknown; exclude?: unknown } } | undefined;
  const include = config?.test?.include;
  expect(Array.isArray(include), "vitest.config.ts states an include roster the unit lane collects by").toBe(true);
  return (include as string[]).map(String);
}

async function unitLaneExcludes(): Promise<string[]> {
  const loaded = (await import("../../vitest.config")) as { default?: unknown };
  const config = loaded.default as { test?: { exclude?: unknown } } | undefined;
  const exclude = config?.test?.exclude;
  return Array.isArray(exclude) ? (exclude as string[]).map(String) : [];
}

describe("AC-1: the branch pins the J-000 breakage with a regression file before it repairs it", () => {
  it("AC-1: the pre-fix pin the criterion names resolves to a commit", () => {
    // Everything downstream compares against this revision. A pin git cannot answer would make the
    // whole reproduce-before-repair reading vacuous rather than false.
    expect(resolves(PRE_FIX), `the criteria pin the pre-fix state at ${PRE_FIX}, which this checkout's history does not hold`).toBe(true);
  });

  it("AC-1: the regression file exists at the path the criterion names", () => {
    expect(
      existsSync(join(REPO_ROOT, REGRESSION)),
      `AC-1 asks the branch to add ${REGRESSION} — the file that pins the breakage before the repair. It is not in the checkout.`,
    ).toBe(true);
  });

  it("AC-1: the branch is what added it — it is not inherited from the pre-fix merge", () => {
    // "Reproduce before repair" is only a claim if the reproduction is this increment's work. A file
    // already present at the pre-fix merge would be describing ground that was already green.
    expect(
      objectIdAt(PRE_FIX, REGRESSION),
      `${REGRESSION} already exists at ${PRE_FIX}; AC-1 asks this branch to ADD the regression that pins the breakage`,
    ).toBeNull();
  });

  it("AC-1: the product's own unit lane collects it, so `vitest run <that file>` runs something", () => {
    // A test file matched by no include glob is collected by nothing: the runner reports no tests,
    // which is not a red, and the pin grades nothing. The rosters are read from the config rather
    // than restated here, so a lane that lawfully widens its reach carries this check with it.
    return Promise.all([unitLaneIncludes(), unitLaneExcludes()]).then(([include, exclude]) => {
      const collected = include.some((glob) => matchesGlob(REGRESSION, glob));
      expect(collected, `${REGRESSION} matches none of the unit lane's include globs (${include.join(", ")}), so nothing collects it`).toBe(true);
      const barred = exclude.filter((glob) => matchesGlob(REGRESSION, glob));
      expect(barred, `${REGRESSION} is excluded from the unit lane by ${barred.join(", ")}`).toEqual([]);
    });
  });

  it("AC-1: it makes assertions — a structure with nothing in it cannot pin a mechanism", () => {
    const absolute = join(REPO_ROOT, REGRESSION);
    expect(existsSync(absolute), `${REGRESSION} is missing, so there is nothing to read assertions out of`).toBe(true);
    const bare = withoutComments(readFileSync(absolute, "utf8"));
    // A floor, never a count: the pin may grow, and a later reading of the same mechanism is welcome.
    // What is refused is the shell — a file whose describe/it structure asserts nothing at all.
    expect(/\b(?:expect|assert)\s*\(/.test(bare), `${REGRESSION} contains no assertion call, so it would pass against any tree — including the broken one`).toBe(true);
    expect(/\b(?:it|test)\s*\(/.test(bare), `${REGRESSION} declares no test case`).toBe(true);
    // A pinned regression that is skipped is a pin nobody is holding.
    expect(/\.(?:skip|todo|fixme)\s*\(/.test(bare), `${REGRESSION} skips its own cases, so the pin never runs`).toBe(false);
  });
});

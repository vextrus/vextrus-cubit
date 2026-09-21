/**
 * ONE BUILD FOR THE LIVE ACCEPTANCE SUITES (V-DB, B-19).
 *
 * WHY. Three suites of the database lane — tests/members/members-live.test.ts,
 * tests/invitations/invitations-live.test.ts and tests/takeoff/sheets/route-render.test.ts — each
 * ran its own `next build` of the same tree into a dist directory of its own, at the same time,
 * beside up to eight other files' worth of database work. Three builds rewrite one shared shim
 * (`next-env.d.ts`, "This file should not be edited") and one shared config (`tsconfig.json`'s
 * include list) while each other's type-check reads them, and each one is a full compile of the
 * product: the lane paid three compiles for one tree and, under load, one of them came back red
 * ("next build failed: expected 1 to be +0", session-2 handoff, 2026-09-21).
 *
 * So the suites share ONE build of the tree, made by whichever process asks first and reused by the
 * others — the journeys' server's own `build-if-stale` discipline (scripts/lib/build-currency.mjs),
 * guarded by a cross-process lock so two askers cannot compile at once. This suite proves the lock
 * and the reuse with an injected build step; the three live suites are the lane's own proof.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ACCEPTANCE_DIST, ensureAcceptanceBuild, lockPathOf } from "./acceptance-build";

const made: string[] = [];

function scratchRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "cubit-acceptance-build-"));
  made.push(root);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
  writeFileSync(join(root, "package.json"), "{}\n");
  return root;
}

afterEach(() => {
  for (const root of made.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A build step that records how often it ran and lays down what a real build leaves behind. */
function recordingBuild(root: string): { build: () => number; runs: () => number } {
  let runs = 0;
  return {
    build: () => {
      runs += 1;
      mkdirSync(join(root, ACCEPTANCE_DIST), { recursive: true });
      writeFileSync(join(root, ACCEPTANCE_DIST, "BUILD_ID"), `build-${runs}\n`);
      return 0;
    },
    runs: () => runs,
  };
}

describe("ensureAcceptanceBuild: one build per tree, however many suites ask", () => {
  it("builds when nothing is built, and reuses that build for the next asker", () => {
    const root = scratchRoot();
    const step = recordingBuild(root);
    const first = ensureAcceptanceBuild({ root, build: step.build });
    expect(first.built, "the first asker builds").toBe(true);
    expect(first.distDir).toBe(ACCEPTANCE_DIST);
    const second = ensureAcceptanceBuild({ root, build: step.build });
    expect(second.built, "the second asker reuses the build the first made").toBe(false);
    expect(second.why).toMatch(/every input is older/);
    expect(step.runs(), "one build for two askers").toBe(1);
  });

  it("rebuilds when an input is newer than the build's start", () => {
    const root = scratchRoot();
    const step = recordingBuild(root);
    ensureAcceptanceBuild({ root, build: step.build });
    const later = Date.now() + 5_000;
    utimesSync(join(root, "src", "a.ts"), later / 1000, later / 1000);
    const again = ensureAcceptanceBuild({ root, build: step.build });
    expect(again.built, "an edit after the build is a stale build").toBe(true);
    expect(step.runs()).toBe(2);
  });

  it("refuses a build that failed, and leaves no stamp behind for the next asker to trust", () => {
    const root = scratchRoot();
    const failing = () => 1;
    expect(() => ensureAcceptanceBuild({ root, build: failing })).toThrow(/next build failed/);
    expect(existsSync(join(root, ACCEPTANCE_DIST, "E2E_BUILD_START")), "a failed build stamps nothing").toBe(false);
    expect(existsSync(lockPathOf(root)), "the lock is released on failure too").toBe(false);
  });

  it("takes over a lock a dead process left behind, and waits on one a live process holds", () => {
    const root = scratchRoot();
    const step = recordingBuild(root);
    // A lock naming a pid nobody runs under is a leaving, not a holder.
    mkdirSync(lockPathOf(root), { recursive: true });
    writeFileSync(join(lockPathOf(root), "pid"), "999999999\n");
    const taken = ensureAcceptanceBuild({ root, build: step.build });
    expect(taken.built).toBe(true);
    expect(existsSync(lockPathOf(root)), "the lock is given back").toBe(false);

    // A lock THIS process holds is a live holder: the asker waits, and the wait is bounded.
    mkdirSync(lockPathOf(root), { recursive: true });
    writeFileSync(join(lockPathOf(root), "pid"), `${process.pid}\n`);
    expect(() => ensureAcceptanceBuild({ root, build: step.build, waitMs: 300 })).toThrow(/another process has held the acceptance build lock/);
    rmSync(lockPathOf(root), { recursive: true, force: true });
  });
});

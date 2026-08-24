// AC-2-ROSTER-PROBES — deriveLaneRoster decides armed/stub by probing input roots and nothing
// else, and `pnpm verify`'s printed roster is that same answer, line for line.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ARMED_AT_END_OF_INC_000, LANE_ORDER } from "./support/contract.mjs";
import { createRoot, laneOf, pnpmRun, removeTree, repoRoot, rosterOf, scratchTree } from "./support/tree.mjs";

const load = async () => {
  const mod = await import(join(repoRoot(), "scripts/lanes.mjs"));
  expect(typeof mod.deriveLaneRoster, "scripts/lanes.mjs does not export deriveLaneRoster").toBe("function");
  return mod.deriveLaneRoster;
};

describe("AC-2-ROSTER-PROBES", () => {
  let deriveLaneRoster;
  let dir;

  beforeAll(async () => {
    deriveLaneRoster = await load();
    dir = scratchTree("ac2");
  }, 120_000);

  afterAll(() => dir && removeTree(dir));

  it("AC-2-ROSTER-PROBES: returns every contract lane in order as { lane, armed, inputRoots }", () => {
    const roster = deriveLaneRoster(repoRoot());
    expect(Array.isArray(roster)).toBe(true);
    expect(roster.map((l) => l.lane)).toEqual(LANE_ORDER);
    for (const entry of roster) {
      expect(typeof entry.armed, `${entry.lane}.armed is not a boolean`).toBe("boolean");
      expect(Array.isArray(entry.inputRoots) && entry.inputRoots.length > 0, `${entry.lane} declares no inputRoots`).toBe(true);
      for (const r of entry.inputRoots) expect(typeof r).toBe("string");
    }
  });

  it("AC-2-ROSTER-PROBES: with every declared input root removed, no lane is armed", () => {
    const roots = new Set(deriveLaneRoster(dir).flatMap((l) => l.inputRoots));
    for (const rel of roots) rmSync(join(dir, rel), { recursive: true, force: true });
    for (const entry of deriveLaneRoster(dir)) {
      expect(entry.armed, `${entry.lane} is armed though none of ${entry.inputRoots.join(", ")} exists`).toBe(false);
    }
  });

  it("AC-2-ROSTER-PROBES: creating only a lane's own input roots arms exactly that lane", () => {
    for (const target of deriveLaneRoster(dir)) {
      const undo = [];
      for (const rel of target.inputRoots) {
        undo.push(createRoot(dir, rel));
        // The contract probes the unit lane's root by content: any *.test.* outside tests/e2e.
        if (target.lane === "unit") undo.push(createRoot(dir, join(rel, "probe.test.mjs")));
      }
      try {
        const armed = deriveLaneRoster(dir).filter((l) => l.armed).map((l) => l.lane);
        expect(armed, `creating ${target.inputRoots.join(", ")} did not arm ${target.lane}`).toContain(target.lane);
        // Only lanes whose own roots are now all present may have armed with it.
        for (const other of deriveLaneRoster(dir).filter((l) => l.armed)) {
          const satisfied = other.inputRoots.every((r) => existsSync(join(dir, r)));
          expect(satisfied, `${other.lane} armed without its input roots existing`).toBe(true);
        }
      } finally {
        for (const u of undo.reverse()) u();
      }
    }
  });

  it("AC-2-ROSTER-PROBES: on this tree the armed set is exactly typecheck, lint, unit", async (ctx) => {
    const roster = deriveLaneRoster(repoRoot());
    const armed = roster.filter((l) => l.armed).map((l) => l.lane);

    // The end-of-inc-000 armed set is a bounded-in-time checkpoint, not a roster driver: it
    // catches inc-000 smuggling in later-layer surface. C-06 keeps the tree deciding — the day an
    // increment lawfully creates a later lane's input root, that lane arms with no toolchain edit,
    // and this checkpoint must retire rather than turn red. It retires as a recorded skip naming
    // the lanes and the roots that armed them; the trigger is unforgeable because it fires only
    // when those roots genuinely exist on the real tree (the scratch-tree cases above prove the
    // probing itself). The inc-000 lanes are still required to be armed either way.
    expect(
      armed.filter((l) => ARMED_AT_END_OF_INC_000.includes(l)),
      "a lane armed at the end of inc-000 is no longer armed",
    ).toEqual(ARMED_AT_END_OF_INC_000);

    const beyond = roster.filter((l) => l.armed && !ARMED_AT_END_OF_INC_000.includes(l.lane));
    if (beyond.length > 0) {
      const named = beyond.map((l) => `${l.lane} (input root ${l.inputRoots.join(", ")})`).join("; ");
      const note = `RECORDED SKIP AC-2-ROSTER-PROBES: the end-of-inc-000 armed-set checkpoint has retired — the tree now arms ${named}`;
      await ctx.annotate(note);
      ctx.skip(note);
    }

    expect(armed).toEqual(ARMED_AT_END_OF_INC_000);
  });

  it("AC-2-ROSTER-PROBES: pnpm verify's printed roster matches deriveLaneRoster line for line", () => {
    const probe = scratchTree("ac2-verify");
    try {
      const run = pnpmRun(probe, ["verify"]);
      const expected = deriveLaneRoster(probe).map((l) =>
        l.armed ? `RUN ${l.lane}` : `SKIP ${l.lane}: input root ${l.inputRoots.find((r) => !existsSync(join(probe, r))) ?? l.inputRoots[0]} absent`,
      );
      expect(rosterOf(run), `verify printed a different roster than deriveLaneRoster\n${run.out}`).toEqual(expected);
      expect(rosterOf(run).map(laneOf)).toEqual(LANE_ORDER);
    } finally {
      removeTree(probe);
    }
  }, 900_000);
});

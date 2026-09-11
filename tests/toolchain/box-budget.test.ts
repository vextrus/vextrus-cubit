// How much of the box one gate may take (v22 Wave A, P2b finding 4).
//
// One `pnpm verify` peaked at load 18 on a 24-core box: the unit lane forks six workers and six
// other lanes gate beside it. The engine runs at most two product suites at once, and two gates like
// that would be ~36 on 24 cores — every lane slower than it would have been in series, and the
// timings the lanes are tuned against meaningless.
//
// So the engine says how many gates share the box (CUBIT_VERIFY_SLOTS) and every cap is derived from
// it: a gate uses at most `cores / SLOTS - 2` workers in total, and each lane's measured knee is
// divided by the number of gates sharing the machine.
import { describe, expect, test } from "vitest";
import { DB_LANE_KNEE, UNIT_LANE_KNEE, VERIFY_WAVE_SIBLINGS, gateBudget, laneWorkers, verifySlots, waveParallelism } from "../../scripts/lib/box.mjs";

const BOX = 24;

describe("CUBIT_VERIFY_SLOTS sizes every cap the gate sets", () => {
  test("one gate is told it may have the box, two are each told half of it", () => {
    expect(gateBudget(BOX, 1), "a lone gate gets the box less a couple of cores for the parent and the box itself").toBe(22);
    expect(gateBudget(BOX, 2), "two gates sharing the box each get half of it, less the same reserve").toBe(10);
    // Never nothing, however small the box or however many gates are on it.
    expect(gateBudget(2, 4)).toBe(1);
  });

  test("with CUBIT_VERIFY_SLOTS=2 the computed caps halve", () => {
    const unitAlone = laneWorkers(UNIT_LANE_KNEE, { siblings: VERIFY_WAVE_SIBLINGS, cores: BOX, slots: 1 });
    const unitShared = laneWorkers(UNIT_LANE_KNEE, { siblings: VERIFY_WAVE_SIBLINGS, cores: BOX, slots: 2 });
    const dbAlone = laneWorkers(DB_LANE_KNEE, { cores: BOX, slots: 1 });
    const dbShared = laneWorkers(DB_LANE_KNEE, { cores: BOX, slots: 2 });

    process.stdout.write(`box-budget unit ${unitAlone}->${unitShared} db ${dbAlone}->${dbShared} budget ${gateBudget(BOX, 1)}->${gateBudget(BOX, 2)}\n`);

    expect(unitAlone, "the unit lane's measured cap moved when nothing else shares the box").toBe(6);
    expect(unitShared, "a second gate on the box did not halve the unit lane's workers").toBe(3);
    expect(dbAlone, "the database lane's measured knee moved when nothing else shares the box").toBe(8);
    expect(dbShared, "a second gate on the box did not halve the database lane's workers").toBe(4);
  });

  test("a gate never asks for more of the box than it was given", () => {
    for (const slots of [1, 2, 3]) {
      const unit = laneWorkers(UNIT_LANE_KNEE, { siblings: VERIFY_WAVE_SIBLINGS, cores: BOX, slots });
      const lanes = waveParallelism(VERIFY_WAVE_SIBLINGS + 1, { cores: BOX, slots });
      expect(unit + (lanes - 1), `${slots} gate(s): the wave asks for more than the budget`).toBeLessThanOrEqual(gateBudget(BOX, slots));
    }
    // A small box binds the wave itself, not just the workers inside one lane.
    expect(waveParallelism(7, { cores: 4, slots: 1 }), "seven lanes at once on a four-core box").toBe(2);
  });

  test("the slot count is the engine's to set, and one is the answer when it says nothing", () => {
    const named = process.env["CUBIT_VERIFY_SLOTS"];
    try {
      delete process.env["CUBIT_VERIFY_SLOTS"];
      expect(verifySlots()).toBe(1);
      process.env["CUBIT_VERIFY_SLOTS"] = "2";
      expect(verifySlots()).toBe(2);
      process.env["CUBIT_VERIFY_SLOTS"] = "nonsense";
      expect(verifySlots(), "an unreadable slot count is one gate, never none").toBe(1);
    } finally {
      if (named === undefined) delete process.env["CUBIT_VERIFY_SLOTS"];
      else process.env["CUBIT_VERIFY_SLOTS"] = named;
    }
  });
});

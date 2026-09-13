/**
 * AC-5 — F-RCC6's beam concrete, measured end to end and reconciled with the golden takeoff
 * (R-TO-032's M3, L-MEA-09, L-QTY-06).
 *
 * Nothing is simulated: the corpus is ingested by the real `cad/` CLI, the set is pinned by the pin
 * act, the partition runs placements, runs, member types and expansion, the level stack and its
 * storey heights are authored by acts, every layout-plan view carrying beams is ranged and
 * scale-affirmed exactly as for columns, and the campaign is measured once by `runMeasureJob` over
 * the shipped `RAILS` roster and the gate.
 *
 * What is graded is L-QTY-06's band, per level, against the fixture's own golden rows: "±3% under,
 * +0% over against a competent manual takeoff, per class". The band is computed from the golden
 * quantity in the canon's exact decimals — never a number typed here — and the sum is the exact sum
 * of the lines the gate published, grouped by the level of the register object each line provenances
 * to (B-07, B-19).
 *
 * The last case is the regression the leaf owes M2: the column rows of this same campaign still
 * stand inside their own band. It is proved, not asserted — the figures are the golden's.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  BEAM_CLASS,
  BEAM_CONCRETE_RULE_ID,
  COLUMN_CLASS,
  COMPLETE,
  FRAME_VERSION,
  GOLDEN_BEAM,
  GOLDEN_CONCRETE,
  RCC_CONCRETE,
  UNDER_TOLERANCE,
  canon,
  goldenFrameByLevel,
  inputsBeamLevels,
} from "./support/frame-rail-stage";
import { goldenColumnConcreteByLevel } from "./support/column-rail-stage";
import { closeStage, linesOfClassAndKind, publishedByLevelOf, said, stageRcc6, type Rcc6Stage } from "./support/rcc6-stage";

let measured: Rcc6Stage;
let summed: Map<string, string>;

beforeAll(async () => {
  measured = await stageRcc6("rcc6-beam");
  summed = await publishedByLevelOf(measured, { class: BEAM_CLASS, kind: RCC_CONCRETE });
}, 1_800_000);

afterAll(async () => {
  await closeStage();
});

describe("AC-5: F-RCC6's beam concrete, measured end to end", () => {
  test("AC-5: the campaign published beam concrete under the rule and the version in force", () => {
    const lines = linesOfClassAndKind(measured, { class: BEAM_CLASS, kind: RCC_CONCRETE });
    expect(lines.length, `the measured campaign published beam-concrete lines (its verdict was ${JSON.stringify(measured.verdict)})`).toBeGreaterThan(0);
    for (const line of lines) {
      expect(said(line, "ruleId", "rule_id"), "every one of them was derived by the rule the beam rail offers under (L-QTY-03)").toBe(BEAM_CONCRETE_RULE_ID);
      expect(said(line, "ruleVersion", "rule_version"), "at the version the campaign's pinned edition puts in force (L-MEA-01)").toBe(FRAME_VERSION);
      expect(said(line, "coverage", "coverage"), "and with every component of its description measured: F-RCC6 states a thickness for every slab adjoining a beam (L-QTY-02)").toBe(COMPLETE);
    }
  });

  test("AC-5: every framed level's published sum stands inside L-QTY-06's band, and the M2 column rows still stand in theirs", async () => {
    const { exact } = await canon();
    const golden = goldenFrameByLevel(GOLDEN_BEAM, GOLDEN_CONCRETE);

    // The roster of levels is the yardstick's own, and the yardstick states beam concrete at exactly
    // the levels the fixture draws beams on — never a list of labels typed here (B-19).
    const drawn = new Set([...inputsBeamLevels().values()].flat());
    expect([...golden.keys()].sort(), "the golden records beam concrete at exactly the levels the fixture draws beams on").toEqual([...drawn].sort());

    for (const [label, owed] of golden) {
      const stated = exact(owed);
      const measuredAt = summed.get(label);
      expect(
        measuredAt,
        `the campaign published beam concrete on ${label} (it published ${JSON.stringify([...summed])} against the golden ${JSON.stringify([...golden])})`,
      ).toBeTruthy();

      const sum = exact(String(measuredAt));
      expect(
        stated.mul(exact(UNDER_TOLERANCE)).lte(sum),
        `${label}: ${String(measuredAt)} m3 is no more than three per cent under the golden ${owed} m3 (L-QTY-06)`,
      ).toBe(true);
      expect(sum.lte(stated), `${label}: ${String(measuredAt)} m3 is not over the golden ${owed} m3 — L-QTY-06 allows +0% over, and an over-measured figure is never a disclosure`).toBe(true);
    }

    // And the M2 rows do not move: the same campaign still reconciles its columns, level by level.
    const columns = await publishedByLevelOf(measured, { class: COLUMN_CLASS, kind: RCC_CONCRETE });
    for (const [label, owed] of goldenColumnConcreteByLevel()) {
      const stated = exact(owed);
      const at = columns.get(label);
      expect(at, `the campaign still publishes column concrete on ${label} (it published ${JSON.stringify([...columns])})`).toBeTruthy();
      const sum = exact(String(at));
      expect(stated.mul(exact(UNDER_TOLERANCE)).lte(sum) && sum.lte(stated), `${label}: the column rows stand where M2 left them — ${String(at)} m3 against the golden ${owed} m3`).toBe(true);
    }
  });
});

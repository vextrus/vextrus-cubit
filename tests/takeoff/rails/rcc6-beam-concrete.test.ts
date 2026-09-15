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
 * The last case is the regression the leaf owes M2, and AC-5 puts it in identity words: the column
 * rows of this campaign are "byte-identical to what tests/takeoff/rails/rcc6-column-concrete.test.ts
 * asserted before this leaf (the M2 rows do not move, proved not asserted)". So they are compared
 * string for string against the M2 campaign's own published map — staged under that test's stage key
 * and read by its own helper, never typed here — and not merely re-run through L-QTY-06's band, which
 * would let three per cent of movement in the rows this leaf's expansion and ranging touch pass
 * unseen. The band is kept beside the identity, never instead of it.
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
import { closeStage, linesOfClassAndKind, publishedByLevel, publishedByLevelOf, said, stackLabels, stageRcc6, type Rcc6Stage } from "./support/rcc6-stage";

let measured: Rcc6Stage;
let summed: Map<string, string>;
/**
 * What the M2 campaign publishes for its columns, staged under rcc6-column-concrete's own key
 * (`stageRcc6("rcc6")`) and summed by the helper that test sums with — the comparand the identity
 * below is proved against, derived and never typed (AC-5).
 */
let m2Columns: Map<string, string>;

/** One published map as a stable list of pairs — order is not what identity is read off. */
function sortedEntries(published: Map<string, string>): [string, string][] {
  return [...published].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
}

beforeAll(async () => {
  measured = await stageRcc6("rcc6-beam");
  summed = await publishedByLevelOf(measured, { class: BEAM_CLASS, kind: RCC_CONCRETE });
  m2Columns = await publishedByLevel(await stageRcc6("rcc6"));
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

  test("AC-5: every framed level's published sum stands inside L-QTY-06's band, and the M2 column rows do not move", async () => {
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

    // And the M2 rows do not move — identity, not a band: this leaf edits the expansion and the
    // ranging act, which act on column rows as well as beam rows, and any movement of a column sum
    // inside the three per cent L-QTY-06 allows would be invisible to a band. The comparand is the
    // M2 campaign's own published map (`publishedByLevel(stageRcc6("rcc6"))`), so no figure of it is
    // typed here.
    const columns = await publishedByLevelOf(measured, { class: COLUMN_CLASS, kind: RCC_CONCRETE });
    const roster = [...stackLabels()].sort();
    expect([...columns.keys()].sort(), `this campaign publishes column concrete on exactly the levels of the M2 stack (it published ${JSON.stringify([...columns])})`).toEqual(roster);
    expect([...m2Columns.keys()].sort(), `so does the M2 campaign it is held against (it published ${JSON.stringify([...m2Columns])})`).toEqual(roster);
    expect(
      sortedEntries(columns),
      "the M2 column rows stand where M2 left them, level for level and string for string — AC-5 asks for byte-identical, and a beam leaf that moved a column figure has moved it",
    ).toEqual(sortedEntries(m2Columns));

    // The band is kept beside that identity, never instead of it: the columns still reconcile with
    // the golden takeoff, each arm of L-QTY-06 said on its own so a failure names which one broke.
    const goldenColumns = goldenColumnConcreteByLevel();
    for (const label of roster) {
      const owed = goldenColumns.get(label);
      expect(owed, `the golden takeoff records column concrete at ${label} — the M2 reconciliation covers every level of the stack`).toBeTruthy();
      const stated = exact(String(owed));
      const sum = exact(String(columns.get(label)));
      expect(
        stated.mul(exact(UNDER_TOLERANCE)).lte(sum),
        `${label}: the column sum ${String(columns.get(label))} m3 is no more than three per cent under the golden ${String(owed)} m3 (L-QTY-06)`,
      ).toBe(true);
      expect(sum.lte(stated), `${label}: the column sum ${String(columns.get(label))} m3 is not over the golden ${String(owed)} m3 — L-QTY-06 allows +0% over`).toBe(true);
    }
  });
});

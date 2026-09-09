/**
 * AC-2 — F-RCC6's column concrete, measured end to end through the shipped doors and reconciled with
 * the golden takeoff (R-TO-031's M2 exit, L-QTY-06).
 *
 * Nothing is simulated: the corpus is ingested by the real `cad/` CLI, the set is pinned by the pin
 * act, the partition runs placements, member types and expansion, the level stack and its storey
 * heights are authored by acts, every layout-plan view carrying columns is scale-affirmed, and the
 * campaign is measured by `runMeasureJob` over the shipped `RAILS` roster and the gate.
 *
 * What is graded is L-QTY-06's band, per level, against the fixture's own golden rows: "±3% under,
 * +0% over against a competent manual takeoff, per class". The band is computed from the golden
 * quantity in the canon's exact decimals — never a number typed here — and the sum is the exact sum
 * of the lines the gate published, grouped by the level of the register object each line provenances
 * to (B-07, B-19).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  COLUMN_CONCRETE_RULE_ID,
  COLUMN_CONCRETE_VERSION,
  RCC_CONCRETE,
  closeStage,
  columnLinesOf,
  goldenColumnConcreteByLevel,
  productModule,
  railsRoster,
  said,
} from "./support/column-rail-stage";
import { publishedByLevel, stackLabels, stageRcc6, type Rcc6Stage } from "./support/rcc6-stage";

/** L-QTY-06's band: three per cent under a competent manual takeoff, and never a unit over. */
const UNDER_TOLERANCE = "0.97";

/** The canon a band and a sum are figured in — arbitrary precision from the drawing to the page. */
const UNITS_MODULE = "src/core/units/canon.ts";

/** The whole corpus, measured once: every case below reads the same measured campaign. */
let measured: Rcc6Stage;
let summed: Map<string, string>;

beforeAll(async () => {
  measured = await stageRcc6("rcc6");
  summed = await publishedByLevel(measured);
}, 1_800_000);

afterAll(async () => {
  await closeStage();
});

describe("AC-2: F-RCC6's column concrete, measured end to end", () => {
  test("AC-2: the shipped roster measures this kind, and the partitioned corpus carries columns to measure", async () => {
    const rails = await railsRoster();
    expect(rails[RCC_CONCRETE], `\`RAILS\` answers ${RCC_CONCRETE} — the measure job runs whatever stands in the roster (L-MEA-08)`).toBeTruthy();
    expect(
      measured.partition.columnViews.length,
      `the partition run over fixtures/rcc6 stored column placements to measure (R-TO-031); it stored ${measured.partition.placements} placements in all and reported ${JSON.stringify(measured.partition.steps)}`,
    ).toBeGreaterThan(0);
  });

  test("AC-2: the campaign published column concrete lines under the rule and the version in force", () => {
    const lines = columnLinesOf(measured.tenantId, measured.campaignId);
    expect(lines.length, `the measured campaign published column concrete lines (its verdict was ${JSON.stringify(measured.verdict)})`).toBeGreaterThan(0);
    for (const line of lines) {
      expect(said(line, "kind", "kind"), "every one of them is a quantity of the kind this rail measures (L-MEA-08)").toBe(RCC_CONCRETE);
      expect(said(line, "ruleId", "rule_id"), "derived by the rule the rail offered under").toBe(COLUMN_CONCRETE_RULE_ID);
      expect(said(line, "ruleVersion", "rule_version"), "at the version the campaign's pinned edition puts in force (L-MEA-08)").toBe(COLUMN_CONCRETE_VERSION);
    }
  });

  test("AC-2: every level's published sum stands inside L-QTY-06's band against the golden takeoff", async () => {
    const canon = await productModule<{ exact: (value: string | number) => { mul: (other: unknown) => { lte: (other: unknown) => boolean }; lte: (other: unknown) => boolean } }>(UNITS_MODULE);
    const golden = goldenColumnConcreteByLevel();

    for (const label of stackLabels()) {
      const owed = golden.get(label);
      expect(owed, `the golden takeoff records column concrete at ${label} — AC-2 reconciles every level of the stack`).toBeTruthy();
      const stated = canon.exact(String(owed));
      const measuredAt = summed.get(label);
      expect(
        measuredAt,
        `the campaign published column concrete on ${label} (it published ${JSON.stringify([...summed])} against the golden ${JSON.stringify([...golden])})`,
      ).toBeTruthy();

      const sum = canon.exact(String(measuredAt));
      expect(
        (stated.mul(canon.exact(UNDER_TOLERANCE)) as { lte: (other: unknown) => boolean }).lte(sum),
        `${label}: ${String(measuredAt)} m3 is no more than three per cent under the golden ${String(owed)} m3 (L-QTY-06)`,
      ).toBe(true);
      expect(sum.lte(stated), `${label}: ${String(measuredAt)} m3 is not over the golden ${String(owed)} m3 — L-QTY-06 allows +0% over`).toBe(true);
    }
  });
});

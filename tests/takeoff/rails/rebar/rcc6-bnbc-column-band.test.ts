/**
 * AC-8 — F-RCC6-BNBC's column main bars, measured through the shipped doors and reconciled with the
 * golden takeoff per (level, diameter, component) (AM-01, L-QTY-06, L-QTY-02, L-FRM-05).
 *
 * The campaign is real: every COLUMN of the fixture's own model registered on a pinned revision,
 * the storey heights of the model's own `storeys` authored by acts, each member's section and its
 * `main` zone stated as its variant, and the whole measured by `runMeasureJob` through
 * `RAILS["rcc.rebar"]` and the real gate.
 *
 * What is graded is L-QTY-06's band per cell: three per cent under the competent manual takeoff, and
 * NEVER over it. The cells are the golden's own — derived from the file, never a list typed here —
 * and the comparand is the golden's figure read as the PRINTED figure it is (a file that writes
 * 1.012 measured something in [1.0115, 1.0125]).
 *
 * Two absences are named rather than measured, and the criterion asserts they are exactly the
 * absences: no reader of a typical detail ships at this leaf, so the tie zone states a spacing and no
 * LENGTH and every column line declares `ties` omitted under REBAR_TIE_ZONE_UNSTATED (an under, and
 * lawful); and a column standing in the FOUNDATION slot has no storey run, which it reports by name.
 * An over-measured figure would never be a disclosure — that is why the band's upper arm is zero.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  BNBC_FIXTURE_ID,
  BNBC_MODEL,
  DETAILING_ROW_NOT_IN_EDITION,
  FOUNDATION_SLOT,
  GOLDEN_COLUMN,
  GOLDEN_REBAR,
  LAP,
  NET,
  PARTIAL_DECLARED,
  REBAR_STOREY_RUN_UNSTATED,
  REBAR_TIE_ZONE_UNSTATED,
  UNDER_TOLERANCE,
  barRowsOf,
  canon,
  closeStage,
  columnMembersOf,
  detailingStating,
  goldenRows,
  linesOf,
  measure,
  modelStoreys,
  observationsOf,
  omittedOf,
  said,
  stageRebarCampaign,
  type BarRowShape,
  type DecimalLike,
  type GoldenRow,
  type MeasuredCampaign,
  type RebarStage,
} from "./support/rebar-stage";

const BUDGET_MS = 1_800_000;

/** The levels this criterion reconciles — the stack above the foundation (AC-8). */
const MEASURED_LEVELS: readonly string[] = ["GF", "1F", "2F", "3F", "4F", "5F", "6F", "ROOF"];

/** The main-bar diameters the fixture's columns are detailed in (AC-8). */
const MAIN_DIAMETERS: readonly number[] = [16, 20, 25];

/** The detailing the fixture's own general notes state, as the campaign applies it (AC-8). */
const APPLIED = detailingStating({ lapMultiplier: 50, fyMPa: 500, fcPsi: 3500, hook: { multiplier: 10, minimumMm: 75 } });

/** The role a column's vertical bars stand in (interfaces: `BarSpec.role`). */
const MAIN = "MAIN";

type Ground = { stage: RebarStage; measured: MeasuredCampaign; rows: BarRowShape[] };

let ground: Promise<Ground> | undefined;

/**
 * The fixture's columns, staged and measured once.
 *
 * Lazy rather than a hook on purpose: a module the Builder has not written yet must fail the CASE
 * that needed it, by name — a throwing hook leaves every case skipped, and judges nothing.
 */
const staged = (): Promise<Ground> =>
  (ground ??= (async () => {
    const members = columnMembersOf(BNBC_MODEL);
    expect(members.length, `${BNBC_MODEL} carries the columns this leaf measures`).toBeGreaterThan(0);
    const stage = await stageRebarCampaign("bnbc-col", members, { levels: modelStoreys(BNBC_MODEL).filter((level) => MEASURED_LEVELS.includes(level.label)), detailing: APPLIED });
    const measured = await measure(stage);
    return { stage, measured, rows: await barRowsOf(measured.input) };
  })());

afterAll(async () => {
  await closeStage();
});

/** Every cell of the golden this criterion reconciles: COLUMN × REBAR, on the measured levels. */
function goldenCells(): GoldenRow[] {
  return goldenRows(BNBC_FIXTURE_ID).filter(
    (row) =>
      row.class === GOLDEN_COLUMN &&
      row.kind === GOLDEN_REBAR &&
      MEASURED_LEVELS.includes(row.level) &&
      MAIN_DIAMETERS.includes(Number(row.diameter_mm)) &&
      (row.component === NET || row.component === LAP),
  );
}

/** How far a golden figure printed to three places may lie from the number it was printed from. */
function halfUlp(exact: (value: string) => DecimalLike, printed: string): DecimalLike {
  const places = printed.includes(".") ? printed.split(".")[1]?.length ?? 0 : 0;
  return exact(`5e-${places + 1}`);
}

describe("AC-8: F-RCC6-BNBC's column main bars stand inside L-QTY-06's band", () => {
  test(
    "AC-8: the campaign measured every column the model carries, and the gate refused nothing",
    async () => {
      const { stage, measured } = await staged();
      expect(measured.verdict.refused, `every offer published (the gate refused ${JSON.stringify(measured.verdict.refusals)})`).toBe(0);
      expect(linesOf(stage).length, "one rebar line per column member (riskNotes (1))").toBe(stage.members.length);
      expect(goldenCells().length, `${BNBC_FIXTURE_ID}'s golden carries column rebar cells to reconcile`).toBeGreaterThan(0);
    },
    BUDGET_MS,
  );

  test(
    "AC-8: every (level, diameter, component) cell reconciles — three per cent under, never over",
    async () => {
      const { rows } = await staged();
      const { exact } = await canon();

      const summed = new Map<string, DecimalLike>();
      for (const row of rows) {
        if (row.role !== MAIN || row.level === null || !MEASURED_LEVELS.includes(row.level)) continue;
        for (const [component, kilos] of [
          [NET, row.kgNet],
          [LAP, row.kgLap],
        ] as const) {
          const key = `${row.level}|${row.diameterMm}|${component}`;
          summed.set(key, (summed.get(key) ?? exact("0")).add(exact(String(kilos))));
        }
      }

      for (const cell of goldenCells()) {
        const key = `${cell.level}|${Number(cell.diameter_mm)}|${String(cell.component)}`;
        const measured = summed.get(key) ?? exact("0");
        const printed = exact(cell.quantity);
        expect(
          printed.mul(exact(UNDER_TOLERANCE)).lte(measured),
          `${key}: ${measured.toString()} kg is no more than three per cent under the golden's ${cell.quantity} kg (L-QTY-06)`,
        ).toBe(true);
        expect(
          measured.lte(printed.add(halfUlp(exact as (value: string) => DecimalLike, cell.quantity))),
          `${key}: ${measured.toString()} kg is not over the golden's ${cell.quantity} kg — L-QTY-06 allows +0 % over, and an over-measured figure is never a disclosure`,
        ).toBe(true);
      }
    },
    BUDGET_MS,
  );

  test(
    "AC-8: the bar rows the bill carries are the model's own verticals, lapped at the note's 50d",
    async () => {
      const { rows } = await staged();
      const mains = rows.filter((row) => row.role === MAIN && row.level !== null && MEASURED_LEVELS.includes(row.level));
      expect(mains.length, "the bill carries a vertical group for every column of the measured stack").toBeGreaterThan(0);
      for (const row of mains) {
        expect(MAIN_DIAMETERS, `${row.barMark} is detailed in a diameter the fixture's columns use (it answered ${row.diameterMm})`).toContain(row.diameterMm);
        expect(Number(row.lapMm), `${row.barMark} laps at 50 × ${row.diameterMm} mm — the note's multiplier, verbatim (AM-03(h))`).toBeCloseTo(50 * row.diameterMm, 3);
        expect(row.lapsPerBar, `${row.barMark} carries one storey lap (L-FRM-05)`).toBe(1);
        expect(row.shape, `${row.barMark} is cut straight — a vertical is a shape 00 bar of the storey run`).toBe("00");
      }
      expect(new Set(mains.map((row) => row.barKey)).size, "and every bar row is content-keyed, so no two of them collide (L-REG-04)").toBe(mains.length);
    },
    BUDGET_MS,
  );

  test(
    "AC-8: the ties and the foundation columns are exactly the named deferrals",
    async () => {
      const { stage } = await staged();
      const lines = linesOf(stage);
      expect(lines.length, "every column kept its line, whatever it could not measure (L-QTY-02)").toBe(stage.members.length);

      for (const line of lines) {
        expect(said(line, "coverage", "coverage"), "a column whose tie zone states no length is PARTIAL_DECLARED").toBe(PARTIAL_DECLARED);
        const omitted = omittedOf(line);
        expect(
          omitted.filter((one) => one.variable === "ties").map((one) => one.code),
          `the tie zone's LENGTH is a typical detail nobody has read, so \`ties\` is omitted under ${REBAR_TIE_ZONE_UNSTATED} rather than derived from BNBC's confinement rule (scope)`,
        ).toEqual([REBAR_TIE_ZONE_UNSTATED]);
        const codes = [...new Set(omitted.map((one) => one.code))].sort();
        expect(codes.filter((code) => code === DETAILING_ROW_NOT_IN_EDITION), "and the applied fy 500 HAS a row in the edition, so nothing defers for want of one (AM-03(f))").toEqual([]);
      }

      // The columns of the foundation slot stand on no level, so nobody stated a run for them.
      const unstated = observationsOf(stage).filter((row) => said(row, "code", "code") === REBAR_STOREY_RUN_UNSTATED);
      const founded = stage.members.filter((member) => member.level === FOUNDATION_SLOT);
      expect(founded.length, `${BNBC_MODEL} carries columns in the foundation slot — the case is only a case if it does`).toBeGreaterThan(0);
      expect(unstated.length, `a column standing in the FOUNDATION slot has no storey run, and reports ${REBAR_STOREY_RUN_UNSTATED} for it (L-QTY-02)`).toBe(founded.length);

      const { rows } = await staged();
      expect(
        rows.filter((row) => row.level === null || !MEASURED_LEVELS.includes(String(row.level))).map((row) => row.barMark),
        "and no bar is billed for a member whose run nobody stated — an unmeasured column bills nothing, rather than a length the machine invented (L-QTY-01)",
      ).toEqual([]);
    },
    BUDGET_MS,
  );
});

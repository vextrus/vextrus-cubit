/**
 * R1 — the storey run a column's verticals are cut to is read through the canon (L-MEA-09, L-FRM-06,
 * AM-01, I-307).
 *
 * A drawing states a storey in the unit it states it in: F-RCC6-BNBC's section reads its storeys off
 * `EL` marks written in METRES (3.353 m, 3.048 m), and the levels law holds that reading AGREED and
 * cited, in the unit the drawing wrote. The rail used to refuse every height not written in `mm` —
 * a second spelling of `heightOf` with a unit check of its own — so every column of the journey stood
 * PARTIAL_DECLARED with no bar rows at all. What is graded here is that the run is `heightOf`'s
 * reading carried to millimetres by the canon's own `convert`: exact, never rounded, and every
 * refusal (no height, a standing other than AGREED, no citation, a unit the canon names nothing for,
 * a unit that is no length) answered as REBAR_STOREY_RUN_UNSTATED and never thrown.
 *
 * Every case drives the published door (`rebarRail` / `barRowsOf`) over the contract's own setup.
 * The one numeric roster is F-RCC6-BNBC's `bbs.golden.json`, row `COL:A1@1F` · `C1-v`.
 */
import { describe, expect, test } from "vitest";
import {
  BNBC_FIXTURE_ID,
  BNBC_MODEL,
  MAIN,
  REBAR_STOREY_RUN_UNSTATED,
  bbsGoldenDocument,
  detailingUnread,
  levelStanding,
  placement,
  railInput,
  rebarRailDoor,
  registerRow,
  variant,
  zone,
  type BarRowShape,
  type BbsGoldenRow,
  type DetailingSetupShape,
  type LevelSetupShape,
  type OfferShape,
  type RailBatchShape,
  type RailInputShape,
  type RailShape,
} from "./support/rebar-contract";

/** The member every case is about: one C1 column, on 1F, at one placement. */
const PLACEMENT_KEY = "PLAN:S-102:t:4|C1|0.0|0.0";
const FAMILY = "C1";
const LEVEL_ID = "66666666-6666-4666-8666-666666666666";
const LEVEL_LABEL = "1F";
const OBJECT_KEY = `${PLACEMENT_KEY}@${LEVEL_ID}`;

/** F-RCC6-BNBC's C1 over GF–2F, as `model.json` states it: 400 × 400, eight 16 mm verticals. */
const C1 = { width: 400, depth: 400, n: 8, diameterMm: 16 };

/** The lap the fixture's general note states, in bar diameters (AM-03(h)). */
const LAP_MULTIPLIER = 50;

/** The golden row the C1 case is graded against: the verticals of the column at stack A1 on 1F. */
const GOLDEN_MEMBER = "COL:A1@1F";
const GOLDEN_BAR_MARK = "C1-v";

/** How far a computed mass may stand from the golden's printed 3-dp figure and still be it. */
const HALF_ULP = 0.0005;

/** One C1 on 1F, whose storey height stands as `level` states it. */
function c1On(level: LevelSetupShape, detailing: DetailingSetupShape = detailingUnread()): RailInputShape {
  return railInput({
    objects: [registerRow({ placementKey: PLACEMENT_KEY, levelId: LEVEL_ID, levelLabel: LEVEL_LABEL, mark: FAMILY })],
    placements: { [PLACEMENT_KEY]: placement({ placementKey: PLACEMENT_KEY, memberFamily: FAMILY }) },
    memberTypes: {
      [FAMILY]: [variant({ variantKey: `${FAMILY}:GF-2F`, width: C1.width, depth: C1.depth, rebar: [zone({ zone: "main", bars: [{ n: C1.n, diameterMm: C1.diameterMm }] })] })],
    },
    levels: [level],
    detailing,
  });
}

/** 1F standing AGREED at `value` written in `unit`, cited to the section's EL marks. */
function storey(value: string, unit: string): LevelSetupShape {
  return levelStanding({ levelId: LEVEL_ID, label: LEVEL_LABEL, ordinal: 1, value, unit, sourceKey: `${BNBC_MODEL}#storeys` });
}

/** The rail and the bar-row reader, off the one published door. */
async function door(): Promise<{ rail: RailShape; barRowsOf: (input: RailInputShape) => readonly BarRowShape[] }> {
  const published = await rebarRailDoor();
  return { rail: published["rebarRail"] as RailShape, barRowsOf: published["barRowsOf"] as (input: RailInputShape) => readonly BarRowShape[] };
}

/** The member's one line out of a batch. */
function lineOf(batch: RailBatchShape): OfferShape {
  const offer = batch.offers.find((one) => one.register.objectKey === OBJECT_KEY);
  expect(offer, `the rail keeps a line for ${OBJECT_KEY} — "a row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02)`).toBeDefined();
  return offer as OfferShape;
}

/** The member's MAIN rows. */
function mainsOf(rows: readonly BarRowShape[]): readonly BarRowShape[] {
  return rows.filter((row) => row.objectKey === OBJECT_KEY && row.role === MAIN);
}

describe("the storey run is the canon's reading of the storey height (I-307)", () => {
  test.each([
    { value: "3.048", unit: "m", mm: "3048", said: "3.048 m (F-RCC6-BNBC's 1F–6F)" },
    { value: "3.048", unit: "M", mm: "3048", said: "3.048 M, as the drawing spells the metre" },
    { value: "3.353", unit: "M", mm: "3353", said: "3.353 M (F-RCC6-BNBC's GF, off its EL marks)" },
    { value: "10", unit: "ft", mm: "3048", said: "10 ft" },
    { value: "11", unit: "FT", mm: "3352.8", said: "11 FT — a run with fractional millimetres, carried whole" },
    { value: "3048", unit: "mm", mm: "3048", said: "3048 mm, as before" },
  ])("$said carries to a raw run of $mm mm, exact and unrounded", async ({ value, unit, mm }) => {
    const { rail, barRowsOf } = await door();
    const input = c1On(storey(value, unit));

    const mains = mainsOf(barRowsOf(input));
    expect(mains, `a C1 on a storey stated ${value} ${unit} holds its one group of verticals (L-MEA-09)`).toHaveLength(1);
    const main = mains[0] as BarRowShape;
    // The leg IS the run, and the raw cutting length of a straight bar is its leg: both are the canon's
    // exact carry of the reading, and neither is rounded — the one rounded surface is its own field
    // (AM-01, AM-03(c)).
    expect(main.dimsMm["A"], `the vertical's leg is the storey run, ${value} ${unit} carried to ${mm} mm by the canon's convert`).toBe(mm);
    expect(main.cuttingRawMm, "and the raw cutting length is that run, never rounded (AM-01)").toBe(mm);

    const line = lineOf(rail(input));
    const codes = line.omitted.map((one) => one.code);
    expect(codes, `a storey stated ${value} ${unit} is a run, so nothing is omitted as REBAR_STOREY_RUN_UNSTATED`).not.toContain(REBAR_STOREY_RUN_UNSTATED);
    expect(line.bindings["net"], "and the net is bound").toBeDefined();
  });

  test.each([
    { height: { standing: "AGREED", value: "3.048", unit: "furlong", basis: "TRANSCRIBED", sourceKey: `${BNBC_MODEL}#storeys` }, said: "a unit the canon names nothing for" },
    { height: { standing: "AGREED", value: "3.048", unit: "kg", basis: "TRANSCRIBED", sourceKey: `${BNBC_MODEL}#storeys` }, said: "a unit that is no length" },
    { height: { standing: "AGREED", value: "3", unit: "bag", basis: "TRANSCRIBED", sourceKey: `${BNBC_MODEL}#storeys` }, said: "a packaging unit" },
    { height: { standing: "AGREED", value: "3.048", unit: "m", basis: "TRANSCRIBED", sourceKey: null }, said: "an agreed height citing no drawing entity" },
    { height: { standing: "SUSPENDED", value: null, unit: null, basis: null, sourceKey: null }, said: "a height whose readings disagree" },
    { height: { standing: "NONE", value: null, unit: null, basis: null, sourceKey: null }, said: "a height nobody read" },
  ])("$said is no run: net and lap omitted as REBAR_STOREY_RUN_UNSTATED, never thrown", async ({ height }) => {
    const { rail, barRowsOf } = await door();
    const input = c1On({ levelId: LEVEL_ID, label: LEVEL_LABEL, ordinal: 1, height });

    let batch: RailBatchShape | undefined;
    // The measure job asks a rail with no guard around it: a throw is the whole campaign lost, every
    // other kind's lines with it (L-QTY-02, L-MEA-08) — the canon throws on a unit it does not know,
    // so the rail asks its recogniser first.
    expect(() => {
      batch = rail(input);
    }, "the rail answers a storey it cannot cut a bar to rather than throwing out of the measure job").not.toThrow();
    const line = lineOf(batch as RailBatchShape);

    for (const variable of ["net", "lap"]) {
      expect(line.omitted, `${variable} is declared missing under this leaf's own code — what is missing is the LENGTH OF BAR (L-MEA-07)`).toContainEqual({ variable, code: REBAR_STOREY_RUN_UNSTATED });
      expect(line.bindings[variable], `and ${variable} is bound by nothing`).toBeUndefined();
    }
    expect(
      (batch as RailBatchShape).observations.filter((one) => one.objectKey === OBJECT_KEY).map((one) => one.code),
      "and the member is observed under the same code, for a reader to go and read",
    ).toContain(REBAR_STOREY_RUN_UNSTATED);
    expect(line.coverage, "a row kept with no quantity is PARTIAL_DECLARED, never COMPLETE (L-QTY-02)").toBe("PARTIAL_DECLARED");
    expect(mainsOf(barRowsOf(input)), "and no vertical is cut to a run nobody read").toHaveLength(0);
  });

  test("F-RCC6-BNBC's C1 on a storey stated 3.048 m yields the golden's MAIN bar (roster: bbs.golden.json COL:A1@1F · C1-v)", async () => {
    const golden = bbsGoldenDocument(BNBC_FIXTURE_ID).rows.find((row) => row.member === GOLDEN_MEMBER && row.bar_mark === GOLDEN_BAR_MARK);
    expect(golden, `fixtures/${BNBC_FIXTURE_ID}/bbs.golden.json records ${GOLDEN_MEMBER} · ${GOLDEN_BAR_MARK}`).toBeDefined();
    const want = golden as BbsGoldenRow;

    const { rail, barRowsOf } = await door();
    const noted: DetailingSetupShape = { ...detailingUnread(), lapMultiplier: LAP_MULTIPLIER, sourceKeys: [`${BNBC_MODEL}#notes`] };
    const input = c1On(storey("3.048", "M"), noted);

    const mains = mainsOf(barRowsOf(input));
    expect(mains, "the column holds one group of verticals").toHaveLength(1);
    const main = mains[0] as BarRowShape;
    expect(
      { barsPerUnit: main.barsPerUnit, diameterMm: main.diameterMm, shape: main.shape, cuttingRoundedMm: main.cuttingRoundedMm, lapsPerBar: main.lapsPerBar, piecesPerBar: main.piecesPerBar },
      "the bar is the golden's: count, diameter, shape, the one rounded surface, one lap, one piece",
    ).toEqual({ barsPerUnit: want.bars_per_unit, diameterMm: want.dia_mm, shape: want.shape, cuttingRoundedMm: want.cutting_rounded_mm, lapsPerBar: want.laps_per_bar, piecesPerBar: want.pieces_per_bar });
    for (const [field, answered, printed] of [
      ["cutting_raw_mm", main.cuttingRawMm, want.cutting_raw_mm],
      ["lap_mm", main.lapMm, want.lap_mm],
      ["kg_net", main.kgNet, want.kg_net],
      ["kg_lap", main.kgLap, want.kg_lap],
      ["kg", main.kg, want.kg],
    ] as const) {
      expect(Math.abs(Number(answered) - Number(printed)), `${field}: the product answers ${answered} where the golden prints ${printed}`).toBeLessThan(HALF_ULP);
    }

    const line = lineOf(rail(input));
    const omitted = line.omitted.map((one) => one.variable);
    expect(omitted, "the net and the lap are both bound — the run was read and the lap was stated").not.toContain("net");
    expect(omitted).not.toContain("lap");
  });
});

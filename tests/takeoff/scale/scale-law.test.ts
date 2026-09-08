/**
 * AC-1, AC-2, AC-3 — the scale law itself: the precedence four ranks stand in, the 12-place factor
 * pair a scale is spoken in, the content address a calibration is named by, and what a QS two-point
 * observation has to say before it is one (L-MEA-05, L-CAD-02, L-MEA-01).
 *
 * Pure: this suite opens no database and reads no artifact. The core is a law, and a law that needs
 * a store to answer is not one.
 */
import { describe, expect, test } from "vitest";
import {
  DIMENSION_RATIO,
  ENTERED,
  FILE_UNITS,
  GRID_SPACING,
  MM,
  QS_TWO_POINT,
  SCALE_OBSERVATION_OBLIQUE,
  SCALE_OBSERVATION_UNCITED,
  UNITLESS,
  attempt,
  citedPoint,
  metresPerString,
  observation,
  ratio12,
  refusalCodeOf,
  scaleCore,
  type CitedPointInput,
  type ObservationInput,
} from "./support/scale-stage";

/** The precedence L-MEA-05 fixes, strongest first (the increment's interfaces spell this list). */
const PRECEDENCE = [QS_TWO_POINT, GRID_SPACING, DIMENSION_RATIO, FILE_UNITS] as const;

/** Two factor strings and two view keys, so a change in any one input can be told from the others. */
const ONE_MM = "0.001000000000";
const TWO_MM = "0.002000000000";
const VIEW_A = "LAYOUT_PLAN:DXF_HANDLE:1A";
const VIEW_B = "LAYOUT_PLAN:DXF_HANDLE:1B";

/** A sha-256 as this engine hands one out (AC-1). */
const HEX_64 = /^[0-9a-f]{64}$/;

/** Two keys of the DXF-handle scheme, which is what a cited point cites (L-CAD-02). */
const KEY_ONE = "DXF_HANDLE:1A";
const KEY_TWO = "DXF_HANDLE:1B";

/** One lawful x observation: 20 drawing units apart, 20 mm entered — a metre per thousand units. */
function alongX(): ObservationInput {
  return observation(citedPoint(KEY_ONE, "0.0", "-30.0"), citedPoint(KEY_TWO, "20.0", "-30.0"), { value: "20", unit: MM });
}

/** One lawful y observation: 15 apart, 15 mm entered. */
function alongY(): ObservationInput {
  return observation(citedPoint(KEY_ONE, "10.0", "-10.0"), citedPoint(KEY_TWO, "10.0", "-25.0"), { value: "15", unit: MM });
}

/** The same observation with one point replaced — every other thing about it left lawful. */
function withPoint(base: ObservationInput, index: 0 | 1, point: CitedPointInput): ObservationInput {
  const points: [CitedPointInput, CitedPointInput] = [base.points[0], base.points[1]];
  points[index] = point;
  return { ...base, points };
}

describe("AC-1: four ranks in one precedence, and a calibration named by what it says", () => {
  test("AC-1: SCALE_RANKS reads the four ranks in the order L-MEA-05 ranks them", async () => {
    const core = await scaleCore();
    expect([...core.SCALE_RANKS], "QS two-point outranks a grid match, which outranks a dimension ratio, which outranks the file's own header (L-MEA-05)").toEqual([
      ...PRECEDENCE,
    ]);
    for (const [index, rank] of core.SCALE_RANKS.entries()) {
      expect(core.precedenceOf(rank), `${rank} stands at precedence ${index + 1} — the roster's order IS the precedence, not a second list beside it`).toBe(index + 1);
    }
  });

  test("AC-1: strongestOf answers the candidate of the earliest-listed rank present, and nothing for none", async () => {
    const core = await scaleCore();
    const weakest = { rank: FILE_UNITS, id: "units" };
    const middle = { rank: DIMENSION_RATIO, id: "ratio" };
    const strongest = { rank: GRID_SPACING, id: "grid" };

    expect(core.strongestOf([weakest, middle, strongest]), "a grid match beats a dimension ratio and a header, whatever order they were offered in").toBe(strongest);
    expect(core.strongestOf([strongest, middle, weakest]), "and the answer is the rank's, never the list's order").toBe(strongest);
    expect(core.strongestOf([weakest]), "one candidate is the strongest candidate").toBe(weakest);
    expect(core.strongestOf([]), "no candidate is no scale — L-MEA-05's membership is positive, never residual").toBeNull();
  });

  test("AC-1: calibrationKey is a content address over the view and both factors", async () => {
    const core = await scaleCore();
    const key = core.calibrationKey(VIEW_A, ONE_MM, ONE_MM);
    expect(key, "a calibration is named by a sha-256 in lowercase hex (L-CAD-02's content addressing)").toMatch(HEX_64);
    expect(core.calibrationKey(VIEW_A, ONE_MM, ONE_MM), "the same view at the same factors is the same calibration, every time it is asked").toBe(key);

    expect(core.calibrationKey(VIEW_B, ONE_MM, ONE_MM), "a different view is a different calibration").not.toBe(key);
    expect(core.calibrationKey(VIEW_A, TWO_MM, ONE_MM), "a different factor along x is a different calibration").not.toBe(key);
    expect(core.calibrationKey(VIEW_A, ONE_MM, TWO_MM), "a different factor along y is a different calibration").not.toBe(key);
  });

  test("AC-1: a factor that is not a 12-place decimal string is a mistake in the caller, not a refusal", async () => {
    const core = await scaleCore();
    const { failure } = await attempt(async () => core.calibrationKey(VIEW_A, "0.001", ONE_MM));
    expect(failure, `"0.001" is not the 12-place rendering a factor is spoken in, so no calibration can be named over it`).toBeInstanceOf(Error);
    expect(
      await refusalCodeOf(failure),
      "and it is a plain Error, not a refusal: a refusal is something the product says to a person, and nobody typed this (ARCH-03)",
    ).toBeNull();
  });
});

describe("AC-2: a factor pair is 12 half-even places of metres per drawing unit", () => {
  test("AC-2: factorPair renders both factors to 12 places, rounding half to even", async () => {
    const core = await scaleCore();
    const rounded = core.factorPair("0.0005000000005", "0.0005000000015");
    expect(
      { factorX: rounded.factorX, factorY: rounded.factorY },
      "a half at the 13th place goes to the even neighbour — down from ...0005, up from ...0015 (the increment's ROUND_HALF_EVEN)",
    ).toStrictEqual({ factorX: "0.000500000000", factorY: "0.000500000002" });

    const whole = core.factorPair("1", "1");
    expect({ factorX: whole.factorX, factorY: whole.factorY }, "and a whole number is rendered to the same 12 places rather than left short").toStrictEqual({
      factorX: "1.000000000000",
      factorY: "1.000000000000",
    });
    expect(core.isFactorString(whole.factorX), "what factorPair renders is what isFactorString admits — one rendering, one reading").toBe(true);
    expect(core.isFactorString("0.001"), "a factor short of 12 places is not a factor string").toBe(false);
  });

  test("AC-2: unitFactor answers metres per drawing unit for each mapped header spelling", async () => {
    const core = await scaleCore();
    const mapped: readonly [string, string][] = [
      [MM, "0.001000000000"],
      ["cm", "0.010000000000"],
      ["m", "1.000000000000"],
      ["inch", "0.025400000000"],
      ["foot", "0.304800000000"],
    ];

    for (const [unit, metres] of mapped) {
      const pair = core.unitFactor(unit);
      expect(pair, `${unit} is a spelling L-CAD-02's closed map names, so the header alone yields a factor pair`).toBeTruthy();
      expect({ factorX: pair?.factorX, factorY: pair?.factorY }, `a drawing unit of one ${unit} is ${metres} metres, along both axes`).toStrictEqual({
        factorX: metres,
        factorY: metres,
      });
      expect(typeof pair?.factorX, "a factor is carried as a decimal string — a double would lose the twelfth place it is rendered to").toBe("string");
      expect([...core.SCALE_UNITS], "and the mapped spellings are the roster the observation lane draws its units from").toContain(unit);
    }
  });

  test("AC-2: an unknown, unitless or absent header yields no factor at all", async () => {
    const core = await scaleCore();
    for (const spelling of [null, UNITLESS, "parsec", ""]) {
      expect(
        core.unitFactor(spelling),
        `${JSON.stringify(spelling)} names no length, so the strict unit lane answers nothing rather than guessing a scale (L-MEA-05)`,
      ).toBeNull();
    }
    expect([...core.SCALE_UNITS], "and `unitless` is a header code, never a unit an observation may be entered in").not.toContain(UNITLESS);
  });
});

describe("AC-3: a QS observation is two cited points, on the lattice, at an entered distance", () => {
  test("AC-3: a lawful observation answers its axis, what it spans and the factor that follows", async () => {
    const core = await scaleCore();

    const x = core.citeObservation(alongX());
    expect(x.axis, "two points differing only along x observe the x axis").toBe("x");
    expect(Number(x.drawn), "and they span what the drawing puts between them").toBe(20);
    expect(x.factor, "20 mm entered over 20 drawing units is a millimetre of the world per unit, rendered to 12 places").toBe(ratio12(20n, 20n * 1000n));

    const y = core.citeObservation(alongY());
    expect(y.axis, "two points differing only along y observe the y axis").toBe("y");
    expect(Number(y.drawn), "spanning what stands between them there").toBe(15);
    expect(y.factor, "15 mm over 15 units is the same millimetre per unit — the axes are read independently, never averaged (L-MEA-05)").toBe(ratio12(15n, 15n * 1000n));
    expect(x.factor, "and the mapped header's own metre-per-unit rendering is what a factor is spoken in").toBe(metresPerString(MM));
  });

  test("AC-3: a point that cites nothing, a coordinate off the lattice and an unentered distance are all refused as uncited", async () => {
    const core = await scaleCore();
    const cases: readonly { said: string; raw: unknown }[] = [
      { said: "a point citing no source key at all", raw: withPoint(alongX(), 1, { x: "20.0", y: "-30.0" } as unknown as CitedPointInput) },
      { said: "a point whose citation is blank", raw: withPoint(alongX(), 0, citedPoint("", "0.0", "-30.0")) },
      { said: "a coordinate off the 0.1 lattice", raw: withPoint(alongX(), 0, citedPoint(KEY_ONE, "12.34", "-30.0")) },
      { said: "a distance that was not entered", raw: { ...alongX(), distanceBasis: "MEASURED" } },
    ];

    for (const { said, raw } of cases) {
      const { failure } = await attempt(async () => core.citeObservation(raw));
      expect(failure, `${said} is not an observation, so citing it fails rather than answering a factor`).toBeTruthy();
      expect(
        await refusalCodeOf(failure),
        `${said}: L-MEA-05 asks each point for a source key and a quantised coordinate, and the distance to be the one a person entered`,
      ).toBe(SCALE_OBSERVATION_UNCITED);
    }
    expect(ENTERED, "the basis a lawful observation states, spelled once (test contract)").toBe("ENTERED");
  });

  test("AC-3: two points that differ along both axes, or along neither, observe nothing", async () => {
    const core = await scaleCore();
    const oblique = withPoint(alongX(), 1, citedPoint(KEY_TWO, "20.0", "-10.0"));
    const still = withPoint(alongX(), 1, citedPoint(KEY_TWO, "0.0", "-30.0"));

    for (const [said, raw] of [
      ["a segment running across both axes", oblique],
      ["two points standing in the same place", still],
    ] as const) {
      const { failure } = await attempt(async () => core.citeObservation(raw));
      expect(failure, `${said} calibrates neither axis, so it is refused rather than resolved into one`).toBeTruthy();
      expect(await refusalCodeOf(failure), `${said}: X and Y are derived independently, and an oblique pair says nothing about either (L-MEA-05)`).toBe(
        SCALE_OBSERVATION_OBLIQUE,
      );
    }
  });
});

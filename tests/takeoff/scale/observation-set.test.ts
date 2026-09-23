/**
 * I-419 — an axis's two-point observations are judged as a SET, so two agreeing measurements
 * across different points scale a view the drawing offers no scale for (L-MEA-05, session 8's walk-0).
 *
 * Walk-0 took two 4,572 mm observations on S-10's grid, found both "Not verified" and the two-point
 * door shut for good: the panel judged each observation alone against the machine's proposals, and a
 * sheet with none could never be scaled. Core already verified a factor "by every further observation
 * along the same axis"; what it could not tell was a second MEASUREMENT from the same span clicked
 * twice. These cases pin the one judgement the act refuses by and the panel's door reads:
 *
 * - two agreeing observations per axis across different points verify, with nothing machine-made;
 * - one disagreeing beyond the edition's ±1 % refuses SCALE_OBSERVATION_UNVERIFIED by name;
 * - the same span taken twice is one measurement and vouches for nothing;
 * - a repeat of a span that disagrees is the refusal, never set aside;
 * - the panel's rows and doors read the same judgement (`standingOf`, `corroboratedRows`).
 *
 * Pure: the observations are cited by core's own `citeObservation` from lattice points and entered
 * distances, and every factor below is core's answer, never a number typed here (B-19).
 */
import { describe, expect, test } from "vitest";
import {
  axisStandingOf,
  citeObservation,
  sameSpan,
  verifyAxis,
  verifyObservations,
  type CitedObservation,
  type CitedPoint,
} from "@/core/scale";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { corroboratedRows, standingOf, type TakenObservation } from "@/modules/takeoff/scale-ui/two-point";

/** The seed edition's verification tolerance: ±1 % (L-MEA-05). */
const TOLERANCE = "0.01";

/** One bay of S-10's grid as walk-0 measured it: 45.7 drawing units, entered as 4,572 mm. */
const BAY = "45.7";
const BAY_MM = "4572";

/** A bay mistyped as walk-0's automation once typed it: a dropped digit, a tenfold error. */
const DROPPED_DIGIT_MM = "452";

/** Within ±1 % of a bay (0.61 % over) — a second reading that agrees; and 2.36 % over, one that does not. */
const CLOSE_MM = "4600";
const FAR_MM = "4680";

/** The two cited entities a pick stands on — any key of the DXF-handle scheme cites (L-CAD-02). */
const GRID_1 = "DXF_HANDLE:20AC";
const GRID_2 = "DXF_HANDLE:20AD";

function point(sourceKey: string, x: string, y: string): CitedPoint {
  return { sourceKey, x, y };
}

/** One observation, cited by core itself. */
function observed(from: CitedPoint, to: CitedPoint, millimetres: string): CitedObservation {
  return citeObservation({ points: [from, to], distance: { value: millimetres, unit: "mm" }, distanceBasis: "ENTERED" });
}

/** Along x: the bay from grid 1 to grid 2 on line E, and the next bay along line D. */
const X_FIRST = observed(point(GRID_1, "0.0", "0.0"), point(GRID_2, BAY, "0.0"), BAY_MM);
const X_SECOND = observed(point(GRID_1, "0.0", "-30.0"), point(GRID_2, BAY, "-30.0"), BAY_MM);
/** Along y: one bay down grid 2, and one bay down grid 1. */
const Y_FIRST = observed(point(GRID_2, BAY, "0.0"), point(GRID_2, BAY, `-${BAY}`), BAY_MM);
const Y_SECOND = observed(point(GRID_1, "0.0", "0.0"), point(GRID_1, "0.0", `-${BAY}`), BAY_MM);

/** The code a thrown refusal carries, or a failure of this test where nothing was thrown. */
function refusedBy(body: () => unknown): { code: string | null; facts: Record<string, unknown> } {
  try {
    body();
  } catch (thrown) {
    return { code: refusalCodeOf(thrown), facts: thrown as Record<string, unknown> };
  }
  throw new Error("expected a refusal, and the judgement answered");
}

describe("I-419: two agreeing observations per axis scale a view with no machine proposal", () => {
  test("I-419: two observations across different points, agreeing, verify each other with nothing machine-made under them", () => {
    expect(X_FIRST.axis, "the first pair stands along x, as core reads the two points").toBe("x");
    expect(Y_FIRST.axis, "and the down-grid pair along y").toBe("y");
    for (const [axis, first, second] of [["x", X_FIRST, X_SECOND], ["y", Y_FIRST, Y_SECOND]] as const) {
      expect(sameSpan(first.points, second.points), `the two ${axis} observations span different points`).toBe(false);
      expect(verifyObservations(axis, [first, second], [], TOLERANCE), `${axis} stands at the FIRST observation's factor, vouched for by the second (L-MEA-05: never an average)`).toEqual({
        axis,
        factor: first.factor,
        verifiedBy: [second.factor],
      });
    }
  });

  test("I-419: the set holds both axes at once — each axis is judged over its own observations only", () => {
    const set = [X_FIRST, Y_FIRST, X_SECOND, Y_SECOND];
    expect(verifyObservations("x", set, [], TOLERANCE).verifiedBy, "x is vouched for by the second x, never by a y").toEqual([X_SECOND.factor]);
    expect(verifyObservations("y", set, [], TOLERANCE).verifiedBy, "and y by the second y").toEqual([Y_SECOND.factor]);
  });

  test("I-419: a second reading within ±1 % of the first verifies it; the axis still stands at the first", () => {
    const close = observed(point(GRID_1, "0.0", "-60.0"), point(GRID_2, BAY, "-60.0"), CLOSE_MM);
    expect(verifyObservations("x", [X_FIRST, close], [], TOLERANCE)).toEqual({ axis: "x", factor: X_FIRST.factor, verifiedBy: [close.factor] });
  });

  test("I-419: an observation disagreeing beyond ±1 % refuses SCALE_OBSERVATION_UNVERIFIED by name, naming the reading", () => {
    const far = observed(point(GRID_1, "0.0", "-60.0"), point(GRID_2, BAY, "-60.0"), FAR_MM);
    const refused = refusedBy(() => verifyObservations("x", [X_FIRST, X_SECOND, far], [], TOLERANCE));
    expect(refused.code, "a disagreeing axis is a named refusal, never an average and never a dropped outlier").toBe("SCALE_OBSERVATION_UNVERIFIED");
    expect(refused.facts["against"], "and it names the reading that disagreed").toEqual([far.factor]);
    expect(refused.facts["factor"], "against the first observation's factor").toBe(X_FIRST.factor);
  });

  test("I-419: an axis nobody observed is SCALE_NO_EVIDENCE, whatever the other axis holds", () => {
    expect(refusedBy(() => verifyObservations("y", [X_FIRST, X_SECOND], [], TOLERANCE)).code).toBe("SCALE_NO_EVIDENCE");
  });
});

describe("I-419: the same span taken twice is one measurement", () => {
  test("I-419: the same two points taken again — in the other order, spelled another way — vouch for nothing", () => {
    const again = observed(point(GRID_2, `${BAY}0`, "0"), point(GRID_1, "0", "0.00"), BAY_MM);
    expect(sameSpan(X_FIRST.points, again.points), "a span is its two lattice points as values, whichever end was picked first").toBe(true);
    const refused = refusedBy(() => verifyObservations("x", [X_FIRST, again], [], TOLERANCE));
    expect(refused.code, "a measurement repeated is not a measurement verified (L-MEA-05: a single-observation scale is verified or rejected)").toBe("SCALE_OBSERVATION_UNVERIFIED");
  });

  test("I-419: a single measurement still stands where the drawing's own reading agrees with it", () => {
    const again = observed(point(GRID_2, BAY, "0.0"), point(GRID_1, "0.0", "0.0"), BAY_MM);
    expect(verifyObservations("x", [X_FIRST, again], [X_FIRST.factor], TOLERANCE), "the machine's reading vouches, the repeat does not").toEqual({
      axis: "x",
      factor: X_FIRST.factor,
      verifiedBy: [X_FIRST.factor],
    });
  });

  test("I-419: a repeat of a span that disagrees is the refusal, never set aside", () => {
    const mistyped = observed(point(GRID_1, "0.0", "0.0"), point(GRID_2, BAY, "0.0"), DROPPED_DIGIT_MM);
    const refused = refusedBy(() => verifyObservations("x", [X_FIRST, mistyped, X_SECOND], [], TOLERANCE));
    expect(refused.code, "two figures entered for one span disagree, and a second span agreeing with the first does not paper over it").toBe("SCALE_OBSERVATION_UNVERIFIED");
    expect(refused.facts["against"], "the mistyped reading is named").toEqual([mistyped.factor]);
  });

  test("the bare-factor judgement is unchanged: each further factor is a measurement of its own", () => {
    expect(verifyAxis("x", [X_FIRST.factor, X_SECOND.factor], [], TOLERANCE)).toEqual({ axis: "x", factor: X_FIRST.factor, verifiedBy: [X_SECOND.factor] });
    expect(refusedBy(() => verifyAxis("x", [X_FIRST.factor], [], TOLERANCE)).code, "and one factor alone, uncorroborated, is refused").toBe("SCALE_OBSERVATION_UNVERIFIED");
  });
});

describe("I-420: where an axis stands, as a reading the door can put into words", () => {
  test("I-420: axisStandingOf answers absent, single, disagreeing or verified — never a fault", () => {
    const far = observed(point(GRID_1, "0.0", "-60.0"), point(GRID_2, BAY, "-60.0"), FAR_MM);
    expect(axisStandingOf("x", [], [], TOLERANCE), "nobody observed x").toEqual({ axis: "x", state: "absent" });
    expect(axisStandingOf("x", [X_FIRST], [], TOLERANCE), "one span, and nothing agrees with it").toEqual({ axis: "x", state: "single", factor: X_FIRST.factor, against: [] });
    expect(axisStandingOf("x", [X_FIRST, far], [], TOLERANCE), "two spans that disagree").toEqual({ axis: "x", state: "disagreeing", factor: X_FIRST.factor, against: [far.factor] });
    expect(axisStandingOf("x", [X_FIRST, X_SECOND], [], TOLERANCE)).toEqual({ axis: "x", state: "verified", factor: X_FIRST.factor, verifiedBy: [X_SECOND.factor] });
  });
});

/** An observation as the panel holds one: core's reading of it, and the view its picks stood in. */
function taken(held: CitedObservation, viewKey: string | null): TakenObservation {
  return { axis: held.axis, factor: held.factor, viewKey, observation: held };
}

describe("I-419: the panel reads the act's judgement — rows and doors alike", () => {
  const PLAN = "LAYOUT_PLAN:DXF_HANDLE:20AC";
  const DETAIL = "DETAIL:DXF_HANDLE:30AC";

  test("I-419: the two-point door's standing is core's, over the rows the affirmation would carry", () => {
    const carried = [taken(X_FIRST, PLAN), taken(X_SECOND, PLAN)];
    expect(standingOf("x", carried, [], TOLERANCE), "two agreeing x spans open the x half of the door").toEqual(axisStandingOf("x", [X_FIRST, X_SECOND], [], TOLERANCE));
    expect(standingOf("x", carried, [], TOLERANCE).state).toBe("verified");
    expect(standingOf("y", carried, [], TOLERANCE).state, "and y, unobserved, keeps it shut").toBe("absent");
  });

  test("I-419: a reading the law cannot speak verifies nothing and faults nothing", () => {
    expect(standingOf("x", [taken(X_FIRST, PLAN)], ["", "1:100"], TOLERANCE).state, "a stray string among the drawing's readings is not a factor").toBe("single");
  });

  test("I-155 (amended): rows in one scope across different points vouch for each other; the odd one out reads Not verified", () => {
    const far = observed(point(GRID_1, "0.0", "-60.0"), point(GRID_2, BAY, "-60.0"), FAR_MM);
    const rows = [taken(X_FIRST, PLAN), taken(X_SECOND, PLAN), taken(far, PLAN)];
    expect(corroboratedRows(rows, () => ({ key: "chosen", corroborating: [] }), TOLERANCE)).toEqual([true, true, false]);
  });

  test("I-155 (amended): the same span taken twice reads Not verified on both rows", () => {
    const again = observed(point(GRID_2, BAY, "0.0"), point(GRID_1, "0.0", "0.0"), BAY_MM);
    expect(corroboratedRows([taken(X_FIRST, PLAN), taken(again, PLAN)], () => ({ key: "chosen", corroborating: [] }), TOLERANCE)).toEqual([false, false]);
  });

  test("I-155 (amended): rows of different scopes do not vouch for each other, and a row's own scope's reading does", () => {
    const rows = [taken(X_FIRST, PLAN), taken(X_SECOND, DETAIL)];
    const apart = (row: TakenObservation) => ({ key: `view:${row.viewKey ?? ""}`, corroborating: [] });
    expect(corroboratedRows(rows, apart, TOLERANCE), "a plan's bay and a detail's bay are not one scale group until both are chosen").toEqual([false, false]);
    const read = (row: TakenObservation) => ({ key: `view:${row.viewKey ?? ""}`, corroborating: row.viewKey === PLAN ? [X_FIRST.factor] : [] });
    expect(corroboratedRows(rows, read, TOLERANCE), "the plan's own reading vouches for the plan's row alone").toEqual([true, false]);
  });
});

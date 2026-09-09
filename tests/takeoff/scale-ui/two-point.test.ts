// @vitest-environment jsdom
/**
 * AC-2's arithmetic — the two-point tool's pure half (`observationOf`, `judgeObservation`), judged by
 * core's own `citeObservation` and `verifyAxis` (L-MEA-05, R-TO-020).
 *
 * Nothing here transcribes a factor: every expected axis, span and 12-place string is derived by
 * handing the SAME two cited points and the SAME entered distance to the engine the door judges by,
 * so a change in the law moves both sides of each judgement at once (B-19). The picks are inc-206's
 * own `SnapPick` shape — this tool builds no second pick model (I-158).
 */
import { describe, expect, test } from "vitest";
import { OBSERVED_METRES, OBSERVED_UNIT, TOLERANCES, scaleCore, twoPointModule, type PickLike } from "./support/scale-support";

/**
 * The viewer seam this module's home sits beside reads a record before it builds, so its module graph
 * reaches the store. Nothing here opens a connection; the address is stated so the pool is
 * constructed rather than refused as unconfigured.
 */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

/** One pick, as inc-206's snap region hands one over: a cited point on the register's 0.1 lattice. */
function citedPick(index: 1 | 2, x: string, y: string, sourceKey: string): PickLike {
  return { index, point: [Number(x), Number(y)], sourceKeys: [sourceKey], keyPoint: [x, y] };
}

/** The two picks of the horizontal calibration line: 100 drawing units apart along x, same y. */
const ALONG_X: readonly PickLike[] = [citedPick(1, "0.0", "0.0", "SNAP:H"), citedPick(2, "100.0", "0.0", "SNAP:H")];

/** The same gesture along the other axis: 100 units apart along y, same x. */
const ALONG_Y: readonly PickLike[] = [citedPick(1, "50.0", "-40.0", "SNAP:V"), citedPick(2, "50.0", "60.0", "SNAP:V")];

/** The distance a person entered between them, in a unit of the closed lane. */
const ENTERED = { value: OBSERVED_METRES, unit: OBSERVED_UNIT };

/** What core answers for the same two cited points and the same entered distance — the one reading. */
async function citedBy(picks: readonly PickLike[]): Promise<{ axis: string; drawn: string; factor: string }> {
  const core = await scaleCore();
  return core.citeObservation({
    points: picks.map((held) => ({ sourceKey: held.sourceKeys[0], x: held.keyPoint[0], y: held.keyPoint[1] })),
    distance: { ...ENTERED },
    distanceBasis: core.DISTANCE_BASIS_ENTERED,
  });
}

describe("AC-2: two cited picks and an entered distance are one observation, judged by core's own law", () => {
  test("AC-2: two picks standing on one x carry the axis, the lattice span and the 12-place factor core renders", async () => {
    const { observationOf, judgeObservation } = await twoPointModule();
    const owed = await citedBy(ALONG_X);

    const answered = observationOf(ALONG_X, ENTERED);
    expect(answered.refusal, "two picks that each cite a source key at a quantised coordinate are an observation, not a refusal").toBeUndefined();
    expect(answered.observation, "and `observationOf` answers the observation itself").toBeTruthy();

    const judged = judgeObservation(answered.observation, [owed.factor], TOLERANCES.verification);
    expect(judged.refusal, "an observation whose axis is corroborated is judged, not refused").toBeUndefined();
    expect(judged.axis, "the observation speaks for the axis the two points differ along — X and Y derive independently (L-MEA-05)").toBe(owed.axis);
    expect(judged.drawn, "and it spans what the lattice says it spans, in drawing units").toBe(owed.drawn);
    expect(judged.factor, "and its factor is the entered distance in metres over that span, as `citeObservation` renders it to 12 places").toBe(owed.factor);
    expect(judged.verified, "a single observation the drawing's own evidence agrees with within the edition's tolerance is verified (L-MEA-05)").toBe(true);
  });

  test("AC-2: two picks standing on one y observe the other axis, by the same reading", async () => {
    const { observationOf, judgeObservation } = await twoPointModule();
    const owed = await citedBy(ALONG_Y);

    const answered = observationOf(ALONG_Y, ENTERED);
    expect(answered.refusal, "the gesture is the same one along the other axis").toBeUndefined();

    const judged = judgeObservation(answered.observation, [owed.factor], TOLERANCES.verification);
    expect([judged.axis, judged.drawn, judged.factor], "the axis, the span and the factor are core's own, whichever axis the picks stand on").toEqual([owed.axis, owed.drawn, owed.factor]);
    expect(judged.verified, "and it is verified by the factor that agrees with it").toBe(true);
  });

  test("AC-2: an observation nothing corroborates within the tolerance stands unverified — a row, never a refusal", async () => {
    const core = await scaleCore();
    const { observationOf, judgeObservation } = await twoPointModule();
    const owed = await citedBy(ALONG_X);
    // A factor a whole order of magnitude away from the one observed: no tolerance of the edition's
    // shape admits it, and it is derived from the observation rather than transcribed beside it.
    const disagreeing = core.renderFactor(String(Number(owed.factor) * 10));

    const answered = observationOf(ALONG_X, ENTERED);
    const judged = judgeObservation(answered.observation, [disagreeing], TOLERANCES.verification);

    expect(judged.refusal, "the observation was taken, and its span and factor are facts — an unverified reading is shown, not refused (Decision I-155)").toBeUndefined();
    expect(judged.verified, "and it says it is not verified").toBe(false);
    expect([judged.axis, judged.drawn, judged.factor], "while the axis, span and factor still read as core renders them").toEqual([owed.axis, owed.drawn, owed.factor]);
  });
});

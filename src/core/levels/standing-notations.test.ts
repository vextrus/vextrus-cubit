/**
 * D-001: one storey height printed in two notations stands at ONE height.
 *
 * F-RCC6-BNBC's building section (S-25) states the ground storey twice: `1F EL +3.353` over
 * `GF EL +0.000`, and `EL +11'-0"` over `P.L= +0'-0"`. The metric figure is the imperial design
 * converted and rounded to three places, so L-MEA-07's equality on canonical metres would suspend a
 * height the Bible's own trap register (T-NOT-LEVEL) says resolves to one stack. This file drives the
 * departure and every edge of it: two prints in two notations agree where the exact one, rounded half
 * to even to the places the decimal one PRINTS, is that print; the height is carried at the exact one;
 * and everything outside that — a real disagreement, two prints in one notation, a figure a person
 * typed — suspends exactly as `./standing.test.ts` holds it.
 *
 * Every metre below is the canon's (`carryToMetres`) and every key the key grammar's (`readingKey`):
 * nothing here types a figure in metres beside the rule that computes it (B-19).
 */
import { describe, expect, test } from "vitest";
import { STOREY_HEIGHT_BASES } from "./law";
import { readingKey } from "./keys";
import { carryToMetres } from "./reading";
import { storeyHeightStanding, type ReadingOfHeight } from "./standing";

const [TRANSCRIBED, , ENTERED] = STOREY_HEIGHT_BASES;
const LEVEL = "00000000-0000-4000-8000-000000000001";
const ACTOR = "00000000-0000-4000-8000-000000000900";

/** One reading as the store holds one: keyed, kept as written, and carried to metres by the canon. */
function read(value: string, unit: string, sourceKey: string | null, basis: string = TRANSCRIBED as string): Required<ReadingOfHeight> {
  const carried = carryToMetres(value, unit);
  return {
    readingKey: readingKey({ levelId: LEVEL, actorId: ACTOR, basis, sourceKey }),
    basis,
    sourceKey,
    valueAsWritten: carried.valueAsWritten,
    unitAsWritten: carried.unitAsWritten,
    canonicalMetres: carried.canonicalMetres,
  };
}

/** S-25's own marks: the metric storey mark above GF, and the two imperial marks either side of it. */
const METRIC_1F = "DXF_HANDLE:1D4C";
const PLINTH = "DXF_HANDLE:1D90";
const IMPERIAL_1F = "DXF_HANDLE:1D92";

describe("D-001: a storey the section states in two notations stands at one height", () => {
  test("the metric print and the imperial design it was rounded from agree, and the height is carried at the exact one", () => {
    const metric = read("3.353", "m", METRIC_1F);
    const imperial = read("132", "in", PLINTH);
    expect(imperial.canonicalMetres, "11'-0\" is 132 inches, exactly 3.3528 m (L-FRM-06)").toBe("3.3528");

    for (const order of [
      [metric, imperial],
      [imperial, metric],
    ]) {
      const standing = storeyHeightStanding(order);
      expect(standing.standing, "3.3528 printed to the three places `+3.353` states is 3.353 — one height, two prints").toBe("AGREED");
      expect(standing.canonicalMetres, "carried at the exact figure, whichever was read first").toBe("3.3528");
      expect(standing.reading?.sourceKey, "and the reading it stands at is the one that states that figure").toBe(PLINTH);
      expect(standing.refusal).toBeNull();
      expect(standing.current.map((reading) => reading.sourceKey), "both readings stand, each under its own evidence").toEqual(order.map((reading) => reading.sourceKey));
    }
  });

  test("the places are the ones PRINTED: a millimetre print states three of the metre, a trailing zero is a place", () => {
    const imperial = read("11", "ft", IMPERIAL_1F);
    expect(storeyHeightStanding([read("3353", "mm", METRIC_1F), imperial]).standing, "3353 mm is printed to the millimetre, as +3.353 m is").toBe("AGREED");
    expect(
      storeyHeightStanding([read("3.350", "m", METRIC_1F), imperial]).standing,
      "3.350 states three places, and 3.3528 at three places is 3.353 — the canon's normal form `3.35` would have judged it at two and let it agree",
    ).toBe("SUSPENDED");
    expect(
      storeyHeightStanding([read("3.0482", "m", METRIC_1F), read("10", "ft", IMPERIAL_1F)]).standing,
      "10'-0\" is exactly 3.048, which at the four places 3.0482 prints is 3.0480 — the exact print is rounded, never the decimal one",
    ).toBe("SUSPENDED");
  });

  test("a real disagreement still suspends, in one notation or across two", () => {
    for (const [one, other, why] of [
      [read("3.048", "m", METRIC_1F), read("3.2", "m", IMPERIAL_1F), "3.048 against 3.2, as ./standing.test.ts holds it"],
      [read("3.2", "m", METRIC_1F), read("10", "ft", IMPERIAL_1F), "10'-0\" at one place is 3.0, never 3.2"],
      [read("3.353", "m", METRIC_1F), read("3.3528", "m", IMPERIAL_1F), "two prints in ONE notation: nothing converted one into the other, so nothing rounded it"],
    ] as const) {
      const standing = storeyHeightStanding([one, other]);
      expect(standing.standing, why).toBe("SUSPENDED");
      expect(standing.canonicalMetres, "a suspended height has no height").toBeNull();
      expect(standing.reading, "and stands at no reading").toBeNull();
      expect(standing.refusal).toBe("STOREY_HEIGHT_CONTESTED");
    }
  });

  test("only a print is judged at its places: a figure a person entered is judged by equality", () => {
    expect(
      storeyHeightStanding([read("3.353", "m", null, ENTERED), read("11", "ft", IMPERIAL_1F)]).standing,
      "an entered 3.353 cites no print, so nothing says it was rounded from anything",
    ).toBe("SUSPENDED");
    expect(storeyHeightStanding([read("3", "m", null, ENTERED), read("10", "ft", IMPERIAL_1F)]).standing, "a storey typed as 3 is three metres, never 'somewhere between 2.5 and 3.5'").toBe(
      "SUSPENDED",
    );
    const bare = storeyHeightStanding([
      { readingKey: "k:metric", canonicalMetres: "3.353" },
      { readingKey: "k:imperial", canonicalMetres: "3.3528" },
    ]);
    expect(bare.standing, "a reading that says nothing of how it was written is judged by the Bible's equality alone").toBe("SUSPENDED");
  });

  test("three readings: every pair must agree, so a third can corroborate but never clear a contest", () => {
    const corroborated = storeyHeightStanding([read("3.353", "m", METRIC_1F), read("132", "in", PLINTH), read("11", "ft", IMPERIAL_1F)]);
    expect(corroborated.standing, "two exact prints equal to each other, each agreeing with the metric one").toBe("AGREED");
    expect(corroborated.canonicalMetres).toBe("3.3528");
    expect(corroborated.reading?.sourceKey, "the first exact print the level acquired is the one it stands at").toBe(PLINTH);

    const contested = storeyHeightStanding([read("3.353", "m", METRIC_1F), read("132", "in", PLINTH), read("3.3528", "m", IMPERIAL_1F)]);
    expect(
      contested.standing,
      "3.353 m and 3.3528 m each agree with 11'-0\" and not with each other: agreement at a print's places is not transitive, and the pair that disagrees suspends the height",
    ).toBe("SUSPENDED");
    expect(contested.current, "every key still says what it says").toHaveLength(3);
  });
});

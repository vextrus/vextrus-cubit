// @vitest-environment node
/**
 * The caller's policy over one corroboration proposal (L-AI-02: abstention is the caller's decision;
 * L-AI-01: the seam routes on nothing).
 *
 * The band is the whole of what this file decides: which of three sentences a reader is shown, and
 * which way a person's act files the proposal they judged. A probability inside it is the model's
 * own statement that it could not tell, and an outcome filed from it would poison the calibration
 * line the thresholds are set from — so the band writes nothing, and this suite says so at the
 * edges, where a threshold moved by a hand would show.
 */
import { describe, expect, test } from "vitest";
import { CORROBORATION_NO, CORROBORATION_YES, corroborationOutcomeOf, corroborationReadingOf } from "./law";

describe("what the model said, in words", () => {
  test("the two thresholds stand where the corpus was read at, and leave a band between them", () => {
    expect(CORROBORATION_YES).toBe(0.7);
    expect(CORROBORATION_NO).toBe(0.3);
    expect(CORROBORATION_NO).toBeLessThan(CORROBORATION_YES);
  });

  test("at or above the upper threshold it said yes; at or below the lower it said no; between them it could not tell", () => {
    expect(corroborationReadingOf(1)).toBe("YES");
    expect(corroborationReadingOf(CORROBORATION_YES)).toBe("YES");
    expect(corroborationReadingOf(CORROBORATION_YES - 0.0001)).toBe("UNSURE");
    expect(corroborationReadingOf(0.5)).toBe("UNSURE");
    expect(corroborationReadingOf(CORROBORATION_NO + 0.0001)).toBe("UNSURE");
    expect(corroborationReadingOf(CORROBORATION_NO)).toBe("NO");
    expect(corroborationReadingOf(0)).toBe("NO");
  });

  test("a figure that is no probability is no reading — nothing is supplied where the model supplied nothing", () => {
    expect(corroborationReadingOf(null)).toBeNull();
    expect(corroborationReadingOf(Number.NaN)).toBeNull();
  });
});

describe("how a person's act judges what stood beside it", () => {
  test("where the model said yes, corroborating affirms it and repudiating repudiates it", () => {
    expect(corroborationOutcomeOf("YES", "CORROBORATE")).toBe("AFFIRMED");
    expect(corroborationOutcomeOf("YES", "REPUDIATE")).toBe("REPUDIATED");
  });

  test("where the model said no, repudiating confirms the reading it pointed to and corroborating overrules it", () => {
    expect(corroborationOutcomeOf("NO", "REPUDIATE")).toBe("CONFIRMED");
    expect(corroborationOutcomeOf("NO", "CORROBORATE")).toBe("OVERRULED");
  });

  test("an uncertain proposal, and an absent one, are filed neither right nor wrong", () => {
    for (const act of ["CORROBORATE", "REPUDIATE"] as const) {
      expect(corroborationOutcomeOf("UNSURE", act)).toBeNull();
      expect(corroborationOutcomeOf(null, act)).toBeNull();
    }
  });
});

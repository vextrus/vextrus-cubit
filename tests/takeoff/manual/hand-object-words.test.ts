/**
 * A hand measurement in the register's words (s-measure I-662, I-666; walk-2 BD-2): its
 * object is named for its condition, sheet and level — never its `~m.` mark — and the Variables cell
 * reads the traced area in m² at three places, never `A=328838371.2443629162090408955 mm2`. A line a
 * rail published keeps its own readings.
 */
import { describe, expect, test } from "vitest";
import { variablesOf } from "@/modules/takeoff/register-ui/index";
import { handObjectWords } from "@/modules/takeoff/trace";
import { variableReading } from "@/modules/takeoff/viewer-measure/words";

const HAND = { conditionName: "75 CC blinding under SOG", ring: [] };

describe("I-666: a hand object is named for its condition, sheet and level", () => {
  test("condition · sheet · level", () => {
    expect(handObjectWords(HAND, "S-08", "GF")).toBe("75 CC blinding under SOG · S-08 · GF");
  });

  test("each part only where it is known", () => {
    expect(handObjectWords(HAND, null, "GF")).toBe("75 CC blinding under SOG · GF");
    expect(handObjectWords(HAND, "S-08", "")).toBe("75 CC blinding under SOG · S-08");
  });
});

describe("I-662: the Variables cell reads a traced area in m²", () => {
  test("an area in mm² is square metres at three places", () => {
    expect(variableReading("328838371.2443629162090408955", "mm2")).toEqual({ value: "328.838", unit: "m2" });
    expect(
      variablesOf({
        variables: {
          A: { value: "328838371.2443629162090408955", unit: "mm2", source: "act:d30", basis: "MEASURED" },
          t: { value: "75", unit: "mm", source: "DXF_HANDLE:1A4", basis: "TRANSCRIBED" },
        } as never,
      }),
    ).toBe("A=328.838 m2 t=75 mm");
  });

  test("a rail's readings are its own, verbatim — what the register journey asserts", () => {
    expect(variablesOf({ variables: { b: { value: "450", unit: "mm" }, h: { value: "3.0500", unit: "m" } } as never })).toBe("b=450 mm h=3.0500 m");
  });
});

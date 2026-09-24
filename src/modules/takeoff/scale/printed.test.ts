// A caption's printed scale is read as data for the reader (I-565), and fails closed where the
// caption does not say one ratio.
import { describe, expect, test } from "vitest";
import { printedScaleOf } from "./printed";

describe("printedScaleOf", () => {
  test("reads the ratio a detail's caption prints", () => {
    expect(printedScaleOf("STIRRUP HOOK DETAIL SCALE 1:20")).toBe("1:20");
    expect(printedScaleOf("COLUMN LAYOUT PLAN  SCALE 1:100")).toBe("1:100");
  });

  test("reads the spellings a draughtsman uses", () => {
    expect(printedScaleOf("SECTION A-A (SCALE = 1 : 50)")).toBe("1:50");
    expect(printedScaleOf("Typical detail, scale-1:25")).toBe("1:25");
    expect(printedScaleOf("PILE CAP DETAIL SCL 1:10")).toBe("1:10");
  });

  test("answers null where the caption prints no scale", () => {
    expect(printedScaleOf("GROUND FLOOR BEAM LAYOUT")).toBeNull();
    expect(printedScaleOf("")).toBeNull();
    expect(printedScaleOf("GRID 1:2 SPACING")).toBeNull();
  });

  test("answers null where two printed ratios disagree, and one ratio where they repeat", () => {
    expect(printedScaleOf("DETAIL SCALE 1:20 / SCALE 1:50")).toBeNull();
    expect(printedScaleOf("DETAIL SCALE 1:20 (SCALE 1:20)")).toBe("1:20");
  });

  test("never reads a zero or a longer ratio as a scale", () => {
    expect(printedScaleOf("SCALE 1:0")).toBeNull();
    expect(printedScaleOf("SCALE 1:20:5")).toBeNull();
  });
});

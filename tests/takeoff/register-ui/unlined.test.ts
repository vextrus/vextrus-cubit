/**
 * Every registered object a run published no line for is named by the register (I-668;
 * R-UI-020 "every refusal carries a named reason"; walk-2 BD-3).
 *
 * The deferred-and-refused region named the run's view and storey deferrals, the queue items and the
 * refused sightings. A member the rails reported under any other code — an uncovered band, a unit
 * nobody stated, an unknown member type — published nothing and was named nowhere a QS looks. This is
 * the pure reading the region now appends: each such object, once per code its standing reports give.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { unlinedRefusalsOf, type UnlinedInput } from "@/modules/takeoff/register-ui/unlined";

const BAND = REFUSALS.SECTION_BAND_UNCOVERED.code;
const UNIT = REFUSALS.SECTION_UNIT_UNSTATED.code;
const SCALE = REFUSALS.VIEW_SCALE_UNAFFIRMED.code;
const RANGE = REFUSALS.TYPICAL_RANGE_UNSTATED.code;

function input(over: Partial<UnlinedInput> = {}): UnlinedInput {
  return {
    objects: [{ objectKey: "c1@GF" }, { objectKey: "c2@GF" }, { objectKey: "c3@GF" }],
    lined: new Set<string>(),
    named: new Set<string>(),
    observations: [],
    ...over,
  };
}

describe("I-668: an object that published no line is never silent", () => {
  test("an object reported under a code no deferral names is named by that code, with the kind that carried it", () => {
    expect(
      unlinedRefusalsOf(
        input({
          objects: [{ objectKey: "c1@GF" }],
          observations: [
            { code: BAND, kind: "rcc.concrete", objectKey: "c1@GF" },
            { code: BAND, kind: "rcc.formwork", objectKey: "c1@GF" },
            { code: UNIT, kind: "rcc.concrete", objectKey: "c1@GF" },
          ],
        }),
      ),
      "one row per reason; the kind is named only where one kind carried the reason",
    ).toEqual([
      { code: BAND, objectKey: "c1@GF", kind: null },
      { code: UNIT, objectKey: "c1@GF", kind: "rcc.concrete" },
    ]);
  });

  test("an object with a line, or one a queue item or refused sighting already names, is left to what names it", () => {
    const observations = [
      { code: BAND, kind: "rcc.concrete", objectKey: "c1@GF" },
      { code: BAND, kind: "rcc.concrete", objectKey: "c2@GF" },
      { code: BAND, kind: "rcc.concrete", objectKey: "c3@GF" },
    ];
    expect(unlinedRefusalsOf(input({ observations, lined: new Set(["c1@GF"]), named: new Set(["c2@GF"]) }))).toEqual([{ code: BAND, objectKey: "c3@GF", kind: "rcc.concrete" }]);
  });

  test("an object a view deferral names is left to the view's one row — the QS acts on the view, not on each member", () => {
    expect(
      unlinedRefusalsOf(
        input({
          observations: [
            { code: SCALE, kind: "rcc.concrete", objectKey: "c1@GF" },
            { code: RANGE, kind: "rcc.concrete", objectKey: "c2@GF" },
            { code: BAND, kind: "rcc.formwork", objectKey: "c2@GF" },
          ],
        }),
      ),
    ).toEqual([]);
  });

  test("the rows follow the register's object order, and a report naming no object is no reason for one", () => {
    expect(
      unlinedRefusalsOf(
        input({
          objects: [{ objectKey: "c3@GF" }, { objectKey: "c1@GF" }],
          observations: [
            { code: UNIT, kind: "rcc.concrete", objectKey: "c1@GF" },
            { code: BAND, kind: "rcc.concrete", objectKey: "c3@GF" },
            { code: BAND, kind: "rcc.concrete", objectKey: null },
            { code: null, kind: "rcc.concrete", objectKey: "c1@GF" },
          ],
        }),
      ).map((row) => row.objectKey),
    ).toEqual(["c3@GF", "c1@GF"]);
  });
});

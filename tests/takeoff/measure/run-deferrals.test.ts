/**
 * A measure run never answers with silence (MEASURE-REFUSE; L-MEA-05 "declared, never silent",
 * L-MEA-07; s-coverage I-484; walk-0 fresh-flow B03).
 *
 * On a fresh, unscaled upload of F-RCC6-BNBC the run published nothing and said nothing: "Done 0 s",
 * an empty deferred-and-refused region. What it could not measure for want of what a QS sets up
 * first is now named — each view the members were placed in that no affirmation names, grouped from
 * the rails' own reports, and each storey the verticals stand on whose height stands at none. This is
 * the pure reading (`runDeferralsOf`) the run's verdict and the register's region both read.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { runDeferralsOf, type RunDeferralInput } from "@/core/residue/deferrals";

const SCALE = REFUSALS.VIEW_SCALE_UNAFFIRMED.code;

/** The fresh project's shape: three plans nobody affirmed, a stack with one storey height stated. */
const FRESH: RunDeferralInput = {
  observations: [
    { class: "column", code: SCALE, objectKey: "c1@GF", sourceEntity: "v:LAYOUT_PLAN:S10", view: "COLUMN LAYOUT PLAN  SCALE 1:100" },
    { class: "column", code: SCALE, objectKey: "c1@1F", sourceEntity: "v:LAYOUT_PLAN:S10", view: "COLUMN LAYOUT PLAN  SCALE 1:100" },
    { class: "column", code: SCALE, objectKey: "c2@1F", sourceEntity: "v:LAYOUT_PLAN:S10", view: "COLUMN LAYOUT PLAN  SCALE 1:100" },
    { class: "pile", code: SCALE, objectKey: "p1", sourceEntity: "v:LAYOUT_PLAN:S04", view: null },
    { class: "pile", code: SCALE, objectKey: "p1", sourceEntity: "v:LAYOUT_PLAN:S04", view: null },
    { class: "beam", code: SCALE, objectKey: "b1@1F", sourceEntity: "v:LAYOUT_PLAN:S13", view: "1ST FLOOR BEAM LAYOUT  SCALE 1:100" },
    { class: "column", code: "MEMBER_TYPE_UNKNOWN", objectKey: "c9@GF", sourceEntity: "c9", view: null },
  ],
  levels: [
    { levelId: "gf", label: "GF", ordinal: 0, standing: "AGREED" },
    { levelId: "1f", label: "1F", ordinal: 1, standing: "NONE" },
    { levelId: "2f", label: "2F", ordinal: 2, standing: "SUSPENDED" },
    { levelId: "roof", label: "ROOF", ordinal: 7, standing: "NONE" },
  ],
  objects: [
    { objectKey: "c1@GF", levelId: "gf", elementType: "column" },
    { objectKey: "c1@1F", levelId: "1f", elementType: "column" },
    { objectKey: "c2@1F", levelId: "1f", elementType: "column" },
    { objectKey: "c1@2F", levelId: "2f", elementType: "column" },
    { objectKey: "b1@ROOF", levelId: "roof", elementType: "beam" },
    { objectKey: "p1", levelId: null, elementType: "pile" },
  ],
  captions: new Map([["v:LAYOUT_PLAN:S04", "PILE LAYOUT PLAN  SCALE 1:100"]]),
};

describe("MEASURE-REFUSE: the run names what it could not measure, per view and per storey", () => {
  test("every view no affirmation names, once, with the classes placed in it and how many members", () => {
    const scale = runDeferralsOf(FRESH).filter((deferral) => deferral.code === SCALE);
    expect(scale).toEqual([
      { code: SCALE, view: "v:LAYOUT_PLAN:S13", caption: "1ST FLOOR BEAM LAYOUT  SCALE 1:100", classes: ["beam"], members: 1 },
      { code: SCALE, view: "v:LAYOUT_PLAN:S10", caption: "COLUMN LAYOUT PLAN  SCALE 1:100", classes: ["column"], members: 3 },
      // The caption the report did not carry is read off the reader's map of the manifest's views.
      { code: SCALE, view: "v:LAYOUT_PLAN:S04", caption: "PILE LAYOUT PLAN  SCALE 1:100", classes: ["pile"], members: 1 },
    ]);
  });

  test("every storey a vertical stands on whose height stands at none, bottom-up, under its own code", () => {
    const heights = runDeferralsOf(FRESH).filter((deferral) => deferral.code !== SCALE);
    expect(heights).toEqual([
      { code: REFUSALS.STOREY_HEIGHT_UNSTATED.code, levelId: "1f", label: "1F", classes: ["column"], members: 2 },
      { code: REFUSALS.STOREY_HEIGHT_CONTESTED.code, levelId: "2f", label: "2F", classes: ["column"], members: 1 },
    ]);
  });

  test("a storey only beams stand on owes no height, and an agreed storey defers nothing", () => {
    const labels = runDeferralsOf(FRESH).flatMap((deferral) => ("label" in deferral ? [deferral.label] : []));
    expect(labels, "ROOF carries beams only; GF's height is agreed").not.toContain("ROOF");
    expect(labels).not.toContain("GF");
  });

  test("a storey whose verticals the run measured with a height was not deferred for want of one; one whose lines left the height out was", () => {
    const measured = runDeferralsOf({
      ...FRESH,
      lines: [
        // 1F's columns were measured and wanted no height — the run had one to measure by.
        { objectKey: "c1@1F", omitted: [] },
        // 2F's column was offered with its height left out, by the levels law's own code.
        { objectKey: "c1@2F", omitted: [REFUSALS.STOREY_HEIGHT_CONTESTED.code] },
      ],
    });
    const labels = measured.flatMap((deferral) => ("label" in deferral ? [deferral.label] : []));
    expect(labels).toEqual(["2F"]);
  });

  test("a vertical's bars left without their storey run are the same height, wanted", () => {
    const deferred = runDeferralsOf({ ...FRESH, lines: [{ objectKey: "c1@1F", omitted: [REFUSALS.REBAR_STOREY_RUN_UNSTATED.code] }] });
    expect(deferred.flatMap((deferral) => ("label" in deferral ? [deferral.label] : []))).toEqual(["1F", "2F"]);
  });

  test("a run whose every view is affirmed and every vertical's storey stated defers nothing", () => {
    expect(runDeferralsOf({ observations: [], levels: [{ levelId: "gf", label: "GF", ordinal: 0, standing: "AGREED" }], objects: [{ objectKey: "c", levelId: "gf", elementType: "column" }] })).toEqual([]);
  });
});

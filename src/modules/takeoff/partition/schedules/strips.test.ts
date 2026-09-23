// Interpretation I-343's reader, on sheets drawn here: a long-section strip's label — a beam's mark
// and, on its baseline, the section beside it — is a member type, banded by the floors the sheet
// states. The sheet is drawn here, so what is graded is the reading and not the extraction (B-19).
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { ConventionProfile } from "@/core/rulesets/methods/conventions/resolve";
import type { PartitionedView } from "../views/assign";
import { VIEW_TYPE } from "../views/law";
import { readSectionStrips } from "./strips";

/** One text of the drawing: what it says, and where the draughtsman put it. */
function text(key: string, said: string, x: number, y: number, height = 260): Record<string, unknown> {
  return { key, type: "TEXT", space: "Model", layer: "Text-1", colour: { rgb: [0, 0, 0], source: "explicit" }, text: said, height, points: [[x, y]] };
}

/** A drawing declaring its millimetres in its general notes (I-302). */
const DECLARED = { dimensionUnit: { unit: "mm", sourceKey: "n:1" } } as unknown as ConventionProfile;

/** The strips one view of the given class and caption reads to, over the given texts. */
function stripsOf(entities: readonly Record<string, unknown>[], type: PartitionedView["type"] = VIEW_TYPE.UNTYPED, caption = "BEAM DETAILS  SCALE 1:50") {
  const view = { viewKey: `${type}:v`, type, reason: null, caption, anchorKey: "v" } as PartitionedView;
  return readSectionStrips(
    { graph: { entities } as unknown as EntityGraph, views: [view], assignments: new Map(entities.map((entity) => [entity["key"] as string, view.viewKey])) },
    DECLARED,
  );
}

const TITLE = text("t", "TYPICAL FLOOR BEAM LONG SECTIONS (2ND TO 6TH FLOOR)", 0, 1000, 300);
const B1 = [text("m1", "B1", 0, 0), text("s1", "300x600", 1500, 0, 220)];
const CB2 = [text("m2", "CB2", 5800, 0), text("s2", "250x450", 7300, 0, 220)];

describe("I-343: a strip label is a member type", () => {
  test("the mark and the section on its baseline, over the floors the sheet's title states, in the declared unit — cited to all three", () => {
    const { families, deferrals } = stripsOf([TITLE, ...B1, ...CB2]);
    expect(deferrals).toEqual([]);
    expect(families.map((family) => [family.family, family.markText, family.rowIndex, family.scheduleKey, family.sourceKeys])).toEqual([
      ["B1", "B1", 1, "v", ["m1"]],
      ["CB2", "CB2", 2, "v", ["m2"]],
    ]);
    expect(families[0]?.variants).toEqual([
      {
        variantKey: "2ND-6TH",
        bandText: "TYPICAL FLOOR BEAM LONG SECTIONS (2ND TO 6TH FLOOR)",
        bandFrom: "2ND",
        bandTo: "6TH",
        sectionText: "300x600",
        sectionWidth: 300,
        sectionDepth: 600,
        sectionUnit: "mm",
        sourceKeys: ["s1", "t", "n:1"],
        zones: [],
      },
    ]);
  });

  test("a sheet stating no floors stands unbanded, as a schedule with no band column does; one stating it only in its caption is banded by the caption", () => {
    expect(stripsOf(B1).families[0]?.variants.map((variant) => [variant.variantKey, variant.bandFrom, variant.bandTo, variant.bandText])).toEqual([["SECTION", null, null, ""]]);
    expect(stripsOf(B1, VIEW_TYPE.UNTYPED, "1ST FLOOR BEAM DETAILS").families[0]?.variants.map((variant) => [variant.variantKey, variant.bandFrom, variant.bandTo, variant.sourceKeys])).toEqual([
      ["1ST-1ST", "1ST", "1ST", ["s1", "v", "n:1"]],
    ]);
  });

  test("a sheet naming two different bands has not said which its strips are drawn for: it contributes nothing, and says so", () => {
    const { families, deferrals } = stripsOf([TITLE, text("t2", "1ST FLOOR ONLY", 0, 800, 200), ...B1]);
    expect(families).toEqual([]);
    expect(deferrals).toEqual([{ viewKey: "UNTYPED:v", reason: "SCHEDULE_VIEW_CONTRIBUTED_NOTHING" }]);
  });

  test("the text standing NEAREST to the right on the mark's baseline must be the section — the next strip's mark is no section, and a text off the baseline is no label", () => {
    expect(stripsOf([TITLE, text("m1", "B1", 0, 0), ...CB2]).families.map((family) => family.family), "B1's nearest right is CB2's mark").toEqual(["CB2"]);
    expect(stripsOf([TITLE, text("m1", "B1", 0, 0), text("s1", "300x600", 1500, -400, 220)]).families, "400 below a 260-high mark is another line").toEqual([]);
    expect(stripsOf([TITLE, text("m1", "B1", 0, 0), text("s1", "3-16Ø TOP", 1500, 0, 220)]).families, "bars beside a mark are no section").toEqual([]);
  });

  test("a mark labelled twice is one member type (T-SCHED-CONTD), read from the first strip that labels it", () => {
    const again = [text("m3", "B1", 0, -2600), text("s3", "250x450", 1500, -2600, 220)];
    const { families } = stripsOf([TITLE, ...B1, ...again]);
    expect(families.map((family) => [family.family, family.variants[0]?.sectionText])).toEqual([["B1", "300x600"]]);
  });

  test("only a framed mark labels a strip, and only a sheet that is neither a schedule nor a layout plan is read", () => {
    expect(stripsOf([TITLE, text("m1", "C1", 0, 0), text("s1", "300x300", 1500, 0, 220)]).families, "a column mark and its size are a schedule row's business").toEqual([]);
    expect(stripsOf([TITLE, ...B1], VIEW_TYPE.SCHEDULE).families, "a schedule's rows are the reconstructor's").toEqual([]);
    expect(stripsOf([TITLE, ...B1], VIEW_TYPE.LAYOUT_PLAN).families, "a plan's marks name the members it places").toEqual([]);
    expect(stripsOf([TITLE, ...B1], VIEW_TYPE.LONG_SECTION_STRIP).families.map((family) => family.family), "a sheet typed as a strip is read like any other").toEqual(["B1"]);
  });

  test("the labels are read row by row down the sheet, left to right along each row, a row being one label's height deep", () => {
    const rows = [text("m3", "B3", 0, -150), text("s3", "250x450", 1500, -150, 220), text("m4", "B4", 0, -2600), text("s4", "250x450", 1500, -2600, 220)];
    // B3 stands 150 below B1 — within a label's height, so on B1's row, at B1's x; B4 is the next row.
    expect(stripsOf([TITLE, ...rows, ...B1, ...CB2]).families.map((family) => [family.family, family.rowIndex])).toEqual([
      ["B1", 1],
      ["B3", 2],
      ["CB2", 3],
      ["B4", 4],
    ]);
  });
});

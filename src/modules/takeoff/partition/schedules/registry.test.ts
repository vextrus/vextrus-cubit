// Which column a schedule states its SECTIONS in, and what a row that states none still owes
// (R-TO-031, L-QTY-01, L-QTY-02).
//
// The tables are built here at the shape the reconstruction answers, so each case varies one thing:
// what the unbanded columns are headed, and whether the row drew a cell under the chosen one (B-19).
import { describe, expect, test } from "vitest";
import type { ScheduleCell, ScheduleTable } from "./reconstruct";
import { registerMemberTypes, type MemberFamily } from "./registry";

const VIEW_KEY = "SCHEDULE:1";

/** One table of a schedule: its header row, and the rows beneath it (`null` draws no cell). */
function tableOf(headers: readonly string[], rows: readonly (readonly (string | null)[])[]): ScheduleTable {
  const cells: ScheduleCell[] = headers.map((header, columnIndex) => ({ rowIndex: 0, columnIndex, text: header, sourceKeys: [`h:${columnIndex}`] }));
  rows.forEach((row, index) => {
    row.forEach((said, columnIndex) => {
      if (said === null) return;
      cells.push({ rowIndex: index + 1, columnIndex, text: said, sourceKeys: [`r:${index}:${columnIndex}`] });
    });
  });
  return { viewKey: VIEW_KEY, scheduleKey: "e:1", title: "BEAM SCHEDULE", pitch: 10, columns: headers.map((_header, index) => index * 100), cells, unplaced: [] };
}

/** The one family a table minted for a mark. */
function familyOf(table: ScheduleTable, mark: string): MemberFamily {
  const held = registerMemberTypes([table]).families.filter((family) => family.family === mark);
  expect(held.length, `one family stands for ${mark}`).toBe(1);
  return held[0] as MemberFamily;
}

const REMARK = "SEE ARCH DETAIL";
const MAIN = "8-16Ø";

describe("R-TO-031: the unbanded column a schedule states its sections in", () => {
  test("a column no cell of which ever reads as a section is not the section column", () => {
    const family = familyOf(tableOf(["MARK", "NOS", "REMARKS", "MAIN BARS"], [["B1", "4 NOS", REMARK, MAIN]]), "B1");
    const variant = family.variants[0];

    expect(family.variants.length, "the row still registers one variant").toBe(1);
    expect(
      { width: variant?.sectionWidth, depth: variant?.sectionDepth, unit: variant?.sectionUnit, text: variant?.sectionText },
      "neither a count nor a remark states a section, so the schedule states none — taking the leftmost unbanded column regardless would read `SEE ARCH DETAIL` as a member's dimensions (L-QTY-01)",
    ).toEqual({ width: null, depth: null, unit: null, text: "" });
    expect(variant?.zones.map((zone) => zone.text), "and the rebar the row states stands beneath it").toEqual([MAIN]);
  });

  test("a column one cell of which reads as a section IS the section column, whatever stands right of it", () => {
    const variant = familyOf(tableOf(["MARK", "SIZE", "REMARKS", "MAIN BARS"], [["B1", "300x450", REMARK, MAIN]]), "B1").variants[0];
    expect({ width: variant?.sectionWidth, depth: variant?.sectionDepth }, "the leftmost unbanded column a section really reads in").toEqual({ width: 300, depth: 450 });
  });
});

describe("R-TO-031: a stacked cell states the band's section AND the band's rebar", () => {
  /** F-RCC6-BNBC S-11: the whole of a mark's band is written in one cell, three lines of text deep,
   * and the schedule holds no rebar column at all. */
  const STACKED = "400x400+8-16Ø+10Ø@100/150 (TIES)";

  test("the section is the part of the cell that reads as a pair of sides, and the cell is kept verbatim", () => {
    const variant = familyOf(tableOf(["MARK", "GF TO 2ND"], [["C1", STACKED]]), "C1").variants[0];

    expect(
      { text: variant?.sectionText, width: variant?.sectionWidth, depth: variant?.sectionDepth },
      "a cell says as many things as the draughtsman stacked in it; reading the whole join as one pair answers nothing and leaves the column sectionless (L-CAD-08)",
    ).toEqual({ text: STACKED, width: 400, depth: 400 });
  });

  test("the bars and the two tie zones of that band stand beneath it, zones per BAND", () => {
    const variant = familyOf(tableOf(["MARK", "GF TO 2ND"], [["C1", STACKED]]), "C1").variants[0];

    expect(
      variant?.zones.map((zone) => ({ zone: zone.zone, spacing: zone.spacing, bar: zone.spacingBar })),
      "L-CAD-08 puts the rebar zones under the band, and a ties cell stating two centres states the end zones' and the middle's — folding them into one would bill the whole column at one of the two (L-FRM-05)",
    ).toEqual([
      { zone: "main", spacing: null, bar: null },
      { zone: "ties-end", spacing: 100, bar: 10 },
      { zone: "ties-mid", spacing: 150, bar: 10 },
    ]);
    expect(variant?.zones[0]?.bars, "and the main zone carries the groups the cell named").toEqual([{ n: 8, diameterMm: 16 }]);
  });

  test("a band written as a list of two consecutive floors, and one whose upper end names a label no roster places", () => {
    const family = familyOf(tableOf(["MARK", "3RD & 4TH", "ROOF-SRR"], [["C1", "350x350+8-16Ø", "300x300+8-16Ø"]]), "C1");

    expect(
      family.variants.map((variant) => ({ key: variant.variantKey, from: variant.bandFrom, to: variant.bandTo, width: variant.sectionWidth })),
      "S-11 heads two of its four bands this way; refusing either would lose the sections those columns carry, and where SRR stands on the ladder is the expansion's question and not this reader's (L-CAD-07)",
    ).toEqual([
      { key: "3RD-4TH", from: "3RD", to: "4TH", width: 350 },
      { key: "ROOF-SRR", from: "ROOF", to: "SRR", width: 300 },
    ]);
  });

  test("a zone the cell states and a zone only a column states both reach the variant", () => {
    const variant = familyOf(tableOf(["MARK", "GF TO 2ND", "MAIN BARS"], [["C1", "400x400+10Ø@100/150 (TIES)", MAIN]]), "C1").variants[0];

    expect(
      variant?.zones.map((zone) => `${zone.zone}=${zone.text}`),
      "the band's own statement stands first and the row's column fills the zone the cell never named — a schedule that says a thing in two places says it once (R-TO-031)",
    ).toEqual(["ties-end=10Ø@100/150 (TIES)", "ties-mid=10Ø@100/150 (TIES)", `main=${MAIN}`]);
  });
});

describe("L-QTY-02: a row that states no section still states its rebar", () => {
  test("a row with no cell in the section column registers one section-less variant, zones intact", () => {
    const table = tableOf(["MARK", "SIZE", "MAIN BARS"], [["B1", "300x450", MAIN], ["B2", null, "6-20Ø"]]);

    expect(familyOf(table, "B1").variants[0]?.sectionWidth, "the row that states a section carries it").toBe(300);

    const blank = familyOf(table, "B2");
    expect(blank.variants.length, "the row whose section cell was never drawn registers ONE variant — registering none drops the row's rebar with the section nobody wrote (R-TO-031)").toBe(1);
    expect(
      { width: blank.variants[0]?.sectionWidth, depth: blank.variants[0]?.sectionDepth, unit: blank.variants[0]?.sectionUnit },
      "whose section is null in all three parts: a null is what an unread figure is (L-QTY-01)",
    ).toEqual({ width: null, depth: null, unit: null });
    expect(blank.variants[0]?.zones.map((zone) => zone.text), "and the row's own bars stand beneath it").toEqual(["6-20Ø"]);
  });

  test("a family whose schedule holds no section column at all still carries its rebar", () => {
    const family = familyOf(tableOf(["MARK", "MAIN BARS"], [["B1", MAIN]]), "B1");
    expect(family.variants.length, "one variant, under no column").toBe(1);
    expect(family.variants[0]?.zones.map((zone) => zone.text), "carrying what the drawing states about the member's steel").toEqual([MAIN]);
  });
});

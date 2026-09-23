// Which column a schedule states its SECTIONS in, and what a row that states none still owes
// (R-TO-031, L-QTY-01, L-QTY-02).
//
// The tables are built here at the shape the reconstruction answers, so each case varies one thing:
// what the unbanded columns are headed, and whether the row drew a cell under the chosen one (B-19).
import { describe, expect, test } from "vitest";
import type { ConventionProfile } from "@/core/rulesets/methods/conventions/resolve";
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

/** The one family a table minted for a mark, under the conventions the drawing resolved (if any). */
function familyOf(table: ScheduleTable, mark: string, conventions?: ConventionProfile | null): MemberFamily {
  const held = registerMemberTypes([table], conventions).families.filter((family) => family.family === mark);
  expect(held.length, `one family stands for ${mark}`).toBe(1);
  return held[0] as MemberFamily;
}

/** A drawing whose general notes declare a unit, as the conventions stage resolves it (I-302). */
function declaring(unit: "in" | "mm", sourceKey: string): ConventionProfile {
  return { roles: { linework: [], outlines: [], text: [], dimensions: [] }, captionGrammars: [], deferrals: [], dimensionUnit: { unit, sourceKey } };
}

/** The entity F-RCC6-BNBC declares its unit on: S-01's general-notes MTEXT, clause 4 (I-302). */
const NOTES_KEY = "DXF_HANDLE:1F3E";

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

describe("I-302: the unit a drawing declares is the LAST word on a section that states none", () => {
  /** F-RCC6-BNBC S-11: a banded column schedule, no unit over the column and none in the cell. */
  const STACKED = "400x400+8-16Ø+10Ø@100/150 (TIES)";

  test("a unitless pair under a unitless header takes the unit the drawing declares, and cites the note", () => {
    const table = tableOf(["MARK", "GF TO 2ND"], [["C1", STACKED]]);
    const variant = familyOf(table, "C1", declaring("mm", NOTES_KEY)).variants[0];

    expect(
      { width: variant?.sectionWidth, depth: variant?.sectionDepth, unit: variant?.sectionUnit },
      "S-11 heads its columns with bands and writes bare numbers under them; the drawing said `ALL DIMENSIONS ARE IN MILLIMETRES` once, on S-01, and that is a reading rather than a guess (L-MEA-05)",
    ).toEqual({ width: 400, depth: 400, unit: "mm" });
    expect(
      variant?.sourceKeys,
      "and the row cites the note beside its own cell: a unit read off S-01 is evidence from S-01, and a row that cited only its cell could not show a reader where its unit came from (L-QTY-03)",
    ).toEqual(["r:0:1", NOTES_KEY]);
  });

  test("the same table with no declaration keeps the numbers and no unit at all — never a millimetre nobody said", () => {
    const variant = familyOf(tableOf(["MARK", "GF TO 2ND"], [["C1", STACKED]]), "C1").variants[0];

    expect({ width: variant?.sectionWidth, unit: variant?.sectionUnit }, "a number nobody gave a unit to is not a millimetre (L-MEA-01)").toEqual({ width: 400, unit: null });
    expect(variant?.sourceKeys, "and it cites its own cell and nothing else — there was no note to cite").toEqual(["r:0:1"]);
  });

  test("a pair that states its OWN unit keeps it, and cites no note", () => {
    const variant = familyOf(tableOf(["MARK", "SIZE"], [["B1", '12"x24"']]), "B1", declaring("mm", NOTES_KEY)).variants[0];

    expect(
      { width: variant?.sectionWidth, depth: variant?.sectionDepth, unit: variant?.sectionUnit },
      "T-NOT-SIZE-IN: a size figured in inches is figured in inches wherever it stands, and the drawing's own `FIGURED DIMENSIONS GOVERN` says so — the general note states the convention, never an override of a figure",
    ).toEqual({ width: 12, depth: 24, unit: "in" });
    expect(variant?.sourceKeys, "the note took no part in this reading, so citing it would put evidence under a figure it never touched").toEqual(["r:0:1"]);
  });

  test("a column HEADED with a unit outranks the declaration, and cites no note", () => {
    const variant = familyOf(tableOf(["MARK", "SIZE (B X D) MM"], [["F1", "1500x1500"]]), "F1", declaring("in", NOTES_KEY)).variants[0];

    expect(
      { width: variant?.sectionWidth, unit: variant?.sectionUnit },
      "the nearer statement wins: a schedule states its unit once over the column and writes bare numbers under it, and the drawing's note is the whole drawing's word rather than that column's (R-TO-031)",
    ).toEqual({ width: 1500, unit: "mm" });
    expect(variant?.sourceKeys, "and the note is not cited, because the column head is what answered").toEqual(["r:0:1"]);
  });

  test("a row that states no section at all takes no unit from the declaration", () => {
    const blank = familyOf(tableOf(["MARK", "SIZE", "MAIN BARS"], [["B1", "300x450", MAIN], ["B2", null, "6-20Ø"]]), "B2", declaring("mm", NOTES_KEY));

    expect(
      { width: blank.variants[0]?.sectionWidth, unit: blank.variants[0]?.sectionUnit },
      "there is no figure for the declared unit to be the unit OF — a unit standing over no number states nothing (L-QTY-01)",
    ).toEqual({ width: null, unit: null });
    expect(blank.variants[0]?.sourceKeys, "and the row cites what it was really read from").not.toContain(NOTES_KEY);
  });
});

/* ------------------------------------------------------------------ I-321, I-322: the pile schedule */

/** F-RCC6-BNBC's PILE SCHEDULE at its own words: one row, a bare prefix, a diameter and a length. */
const PILE_HEADERS = ["MARK", "DIA (mm)", "LENGTH (mm)", "MAIN BARS", "SPIRAL", "NOS"];
const PILE_ROW = ["P", "500", "21336", "4-20%%C + 3-20%%C", "10%%C @ 75/150", "89"];

describe("I-321: a bare class prefix in the mark column is a family", () => {
  test("`P` mints the family P, with the NOS cell kept beside it as corroboration", () => {
    const family = familyOf(tableOf(PILE_HEADERS, [PILE_ROW]), "P");
    expect(family.markText, "the mark cell verbatim").toBe("P");
    expect(family.corroboration, "the row's own NOS, cited to its cell — what placement checks the plans against, never a count (T-SCHED-NORULES)").toEqual({ placed: 89, text: "89", sourceKeys: ["r:0:5"] });
  });

  test("a numbered family carries no corroboration, and a prefix naming no class is no family", () => {
    const families = registerMemberTypes([tableOf(PILE_HEADERS, [["P1", "500", "21336", MAIN, "-", "4"], ["S", "500", "21336", MAIN, "-", "4"], ["Q", "500", "21336", MAIN, "-", "4"]])]).families;
    expect(families.map((family) => family.family), "`S` and `Q` name no class the placement law maps, so they stand for no member (L-QTY-04)").toEqual(["P1"]);
    expect(families[0]?.corroboration, "a numbered mark IS its member's identity; its row's count corroborates nothing here").toBeUndefined();
  });
});

describe("I-322: the dimensions a schedule states beside a section", () => {
  test("a pile's DIA and LENGTH are read in the unit the column head states, each cited to its cell", () => {
    const variant = familyOf(tableOf(PILE_HEADERS, [PILE_ROW]), "P").variants[0];
    expect(variant?.dimensions, "the diameter and the length the pile is bored to (AM-06 §2)").toEqual([
      { dimension: "dia", text: "500", value: 500, unit: "mm", sourceKeys: ["r:0:1"] },
      { dimension: "length", text: "21336", value: 21336, unit: "mm", sourceKeys: ["r:0:2"] },
    ]);
  });

  test("a head that states no unit takes the drawing's declaration, and cites it; with none, no dimension is read", () => {
    const headers = ["MARK", "DIA", "LENGTH", "NOS"];
    const declared = familyOf(tableOf(headers, [["P", "500", "21336", "89"]]), "P", declaring("mm", NOTES_KEY)).variants[0]?.dimensions;
    expect(declared?.map((one) => [one.dimension, one.unit, one.sourceKeys]), "the unit the drawing declares is the last word on a bare figure (I-302), and it is evidence").toEqual([
      ["dia", "mm", ["r:0:1", NOTES_KEY]],
      ["length", "mm", ["r:0:2", NOTES_KEY]],
    ]);
    const silent = familyOf(tableOf(headers, [["P", "500", "21336", "89"]]), "P").variants[0];
    expect(silent?.dimensions, "a figure nobody gave a unit to is no dimension: the rail keeps its row and names what is missing (L-MEA-01, L-QTY-02)").toBeUndefined();
  });

  test("dimensions are read for the classes whose methods bind them, and a bar's DIA under a pile cap is none of them", () => {
    // F-RCC6-BNBC's BAR BENDING SCHEDULE files bars under `PC3`: its DIA is a BAR's diameter.
    const cap = familyOf(tableOf(["MEMBER", "BAR MARK", "DIA", "CUT LENGTH"], [["PC3", "PC3-B1", "16", "2100"]]), "PC3", declaring("mm", NOTES_KEY)).variants[0];
    expect(cap?.dimensions, "no method of a pile cap binds a diameter, and `CUT LENGTH` is a bar's").toBeUndefined();
    const footing = familyOf(tableOf(["MARK", "L x B (mm)", "DEPTH (mm)"], [["F1", "1500x1500", "450"]]), "F1").variants[0];
    expect(footing?.dimensions, "a footing's DEPTH waits for its plan to be the outline's (FND-2): read now, a byte-frozen fixture's footings would start billing").toBeUndefined();
  });

  test("a cell that states no figure is no dimension, and the head is read whole", () => {
    const variant = familyOf(tableOf(["MARK", "DIA (mm)", "PILE LENGTH (mm)", "NOS"], [["P", "SEE DETAIL", "21336", "89"]]), "P").variants[0];
    expect(variant?.dimensions, "`SEE DETAIL` is no diameter, and a head naming a length AND something else names neither (L-QTY-01)").toBeUndefined();
  });
});

// @vitest-environment node
/**
 * Every registry row cites the cells it was read from (R-TO-031, L-QTY-03) — including the variant of
 * a row whose section cell the drawing left BLANK. F-RCC6-BNBC's pile-cap schedule does exactly that
 * for PC3 and S3: a mark, a rebar zone, and nothing under SECTION. The registry used to answer such a
 * row with a variant citing nothing, and the store's belt (`member_type_variants_cited`) then refused
 * the whole partition write, so the drawing stood with no partition at all — no views, no placements,
 * no proposed stack, and a campaign that measured nothing (the J-000 M3 leg's finding, session 4).
 *
 * The rule the fix states: a variant that states no section and no band cites the mark cell that
 * names the member, because that is the row it was read from.
 */
import { describe, expect, test } from "vitest";
import { registerMemberTypes } from "@/modules/takeoff/partition/schedules/registry";
import type { ScheduleCell, ScheduleTable } from "@/modules/takeoff/partition/schedules/reconstruct";

/** One cell of a hand-built table, cited by the key of the text it was read from. */
function cell(rowIndex: number, columnIndex: number, text: string, key: string): ScheduleCell {
  return { rowIndex, columnIndex, text, sourceKeys: [key] };
}

/** A pile-cap schedule as F-RCC6-BNBC draws it: PC3's SECTION cell is blank, S3's too. */
function pileCapSchedule(): ScheduleTable {
  return {
    viewKey: "SCHEDULE:DXF_HANDLE:1E3D",
    scheduleKey: "DXF_HANDLE:1E3D",
    title: "PILE CAP SCHEDULE",
    pitch: 10,
    columns: [0, 100, 200],
    cells: [
      cell(0, 0, "MARK", "DXF_HANDLE:1E40"),
      cell(0, 1, "SECTION", "DXF_HANDLE:1E41"),
      cell(0, 2, "MAIN BAR", "DXF_HANDLE:1E42"),
      cell(1, 0, "PC1", "DXF_HANDLE:1E50"),
      cell(1, 1, "1500x1500", "DXF_HANDLE:1E51"),
      cell(1, 2, "12-16Ø", "DXF_HANDLE:1E52"),
      cell(2, 0, "PC3", "DXF_HANDLE:1E60"),
      cell(2, 2, "8-16Ø", "DXF_HANDLE:1E62"),
      cell(3, 0, "S3", "DXF_HANDLE:1E70"),
      cell(3, 2, "6-12Ø", "DXF_HANDLE:1E72"),
    ],
    unplaced: [],
  } as unknown as ScheduleTable;
}

describe("a registry row whose section cell is blank still cites where it was read from", () => {
  test("the sectionless variant cites the mark cell, and every variant of the table cites at least one text", () => {
    const registered = registerMemberTypes([pileCapSchedule()]);
    const families = new Map(registered.families.map((family) => [family.family, family]));
    expect([...families.keys()].sort(), "three marks, three families — a blank section costs no row its family").toEqual(["PC1", "PC3", "S3"]);

    const pc3 = families.get("PC3");
    expect(pc3?.variants.length, "the sectionless row still stands for its member").toBe(1);
    expect(pc3?.variants[0]?.sectionText, "and states no section").toBe("");
    expect(pc3?.variants[0]?.sourceKeys, "citing the mark cell it was read from — a registry row citing nothing is unsourced (L-QTY-03)").toEqual(["DXF_HANDLE:1E60"]);
    expect(pc3?.variants[0]?.zones.map((zone) => zone.text), "and keeps the rebar drawn beside the mark").toEqual(["8-16Ø"]);

    for (const family of registered.families) {
      for (const variant of family.variants) {
        expect(variant.sourceKeys.length, `${family.family} ${variant.variantKey} cites at least one text — the store's belt refuses less`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

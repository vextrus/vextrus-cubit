/**
 * A listed floor set is never read as a range (Interpretation I-409; L-CAD-07, L-QTY-04).
 *
 * A structural set captions a typical plan for the storeys it serves, and it does so both ways. It
 * runs a range (`1ST TO 6TH`) and it lists storeys (`2ND, 4TH & 6TH FLOOR BEAM LAYOUT`). The
 * professional sets the product is benchmarked against list them this way: slab and beam sheets for
 * alternate floors, most of them underlined MTEXT. Before this, the resolver read ANY two level words
 * as a range from the first to the last. So the listed plan stood its members on 3RD and 5TH as well,
 * where no drawing put them: over-measurement, which is a hard block and never a disclosure.
 *
 * The same caption, drawn the way those sets draw it (`{\L…}`), lost its first storey entirely: the
 * underline code glued onto the first level word (I-410). A range to `TOP FLOOR` read as its
 * first storey alone (I-411).
 *
 * Every caption here is written for this file. None is copied from a drawing outside the repository
 * (L-CAD-09). The last block reads F-RCC6-BNBC's own captions, which must read exactly as they did:
 * the J-000 read-back does not move.
 *
 * Pure: the resolver reads no store, so the evidence is handed in whole.
 */
import { describe, expect, test } from "vitest";
import { viewKey, type ViewRef } from "@/core/identity";
import { captionLevelsOf, resolveExpansion, type ExpansionDeferral, type StackedLevel } from "@/modules/takeoff/partition/expansion/resolve";
import { levelRunsOf, levelWordsOf, TOP_FLOOR } from "@/modules/takeoff/partition/placement/law";
import type { PlacementRow } from "@/modules/takeoff/partition/placement/rows";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";

/** The one plan every caption here captions. */
const PLAN: ViewRef = { viewClass: VIEW_TYPE.LAYOUT_PLAN, captionAnchorSourceKey: "DXF_HANDLE:CAP1" };

/** A stack spelled the way a building section proposes one: the ground, six counted floors, the roof. */
function stackOf(...labels: readonly string[]): StackedLevel[] {
  return labels.map((label, ordinal) => ({ levelId: `level-${label}`, label, ordinal }));
}

const STACK = stackOf("GF", "1F", "2F", "3F", "4F", "5F", "6F", "ROOF");

/** One member placed on the plan, as the placement stage leaves one: no schedule band, no note. */
function member(mark: string, elementType: PlacementRow["elementType"], x: number): PlacementRow {
  return {
    viewKey: viewKey(PLAN),
    view: PLAN,
    placementKey: `${viewKey(PLAN)}|${mark}|${x}.0,0.0`,
    mark,
    markText: mark,
    elementType,
    x,
    y: 0,
    gridLetter: "A",
    gridNumeral: String(x),
    outlineKey: `DXF_HANDLE:${mark}O`,
    markKey: `DXF_HANDLE:${mark}M`,
    memberFamily: null,
    note: null,
  };
}

/** A column and a beam: one vertical, one member that stands on a level without being one. */
const MEMBERS: readonly PlacementRow[] = [member("C1", "column", 1), member("B1", "beam", 2)];

/** What one caption resolves to over a stack: `<mark>@<storey>:<standing>` per row, and the deferrals. */
function resolved(caption: string, levels: readonly StackedLevel[] = STACK, placements: readonly PlacementRow[] = MEMBERS): { rows: string[]; deferrals: readonly ExpansionDeferral[] } {
  const labelOf = new Map(levels.map((level) => [level.levelId, level.label]));
  const answer = resolveExpansion({ placements, views: [{ caption, view: PLAN }], levels, ranges: [] });
  return {
    rows: answer.rows.map((row) => {
      const at = "levelId" in row.level ? (labelOf.get(row.level.levelId) ?? row.level.levelId) : "unregistered" in row.level ? `@${row.level.unregistered}` : `@${row.level.slot}`;
      return `${row.placement.mark}@${at}:${row.standing}`;
    }),
    deferrals: answer.deferrals,
  };
}

/** The storeys one mark stands on, in the stack's order. */
function storeysOf(caption: string, mark = "C1", levels: readonly StackedLevel[] = STACK): string[] {
  const order = new Map(levels.map((level) => [level.label, level.ordinal]));
  return resolved(caption, levels)
    .rows.filter((row) => row.startsWith(`${mark}@`))
    .map((row) => row.slice(mark.length + 1, row.indexOf(":")))
    .sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}

describe("I-409: a typical plan captioned for alternate floors is never billed on the floors between", () => {
  test("`2ND, 4TH & 6TH` stands its members on those three storeys, drawn at the first, and on no storey between", () => {
    const { rows, deferrals } = resolved("2ND, 4TH & 6TH FLOOR BEAM LAYOUT");
    expect(rows.sort(), "three storeys each, for the column and the beam alike").toEqual(
      ["B1@2F:MEASURED", "B1@4F:DERIVED", "B1@6F:DERIVED", "C1@2F:MEASURED", "C1@4F:DERIVED", "C1@6F:DERIVED"].sort(),
    );
    expect(rows.filter((row) => row.includes("@3F") || row.includes("@5F")), "3F and 5F: no drawing put a member there").toEqual([]);
    expect(deferrals, "every storey the caption lists is one the stack carries").toEqual([]);
  });

  test("a range stays a range: `1ST TO 6TH` covers every storey between, drawn at the first", () => {
    expect(storeysOf("TYPICAL FLOOR PLAN (1ST TO 6TH)")).toEqual(["1F", "2F", "3F", "4F", "5F", "6F"]);
    expect(resolved("TYPICAL FLOOR PLAN (1ST TO 6TH)").rows.filter((row) => row.endsWith(":MEASURED")).sort()).toEqual(["B1@1F:MEASURED", "C1@1F:MEASURED"]);
    expect(storeysOf("TYPICAL FLOOR BEAM LAYOUT (2ND TO 6TH FLOOR)"), "F-RCC6-BNBC's S-14 title, word for word").toEqual(["2F", "3F", "4F", "5F", "6F"]);
  });

  test("a mix of ranges and lists states their union, and nothing else", () => {
    expect(storeysOf("GF, 2ND TO 4TH & 6TH FLOOR PLAN")).toEqual(["GF", "2F", "3F", "4F", "6F"]);
    expect(storeysOf("1ST-2ND & 5TH-6TH FLOOR BEAM LAYOUT")).toEqual(["1F", "2F", "5F", "6F"]);
  });

  test.each([
    ["3RD-5TH FLOOR SLAB", ["3F", "4F", "5F"]],
    ["GF~2ND FLOOR COLUMN LAYOUT", ["GF", "1F", "2F"]],
    ["1ST THRU 3RD FLOOR PLAN", ["1F", "2F", "3F"]],
    ["1ST FLOOR - 3RD FLOOR BEAM LAYOUT", ["1F", "2F", "3F"]],
  ])("a range sign runs a range: %s", (caption, storeys) => {
    expect(storeysOf(caption)).toEqual(storeys);
  });

  test.each([
    ["1ST AND 3RD FLOOR BEAM LAYOUT", ["1F", "3F"]],
    ["1ST, 3RD, & 5TH FLOOR SLAB", ["1F", "3F", "5F"]],
    ["2ND + 4TH FLOOR PLAN", ["2F", "4F"]],
    ["GF & 2ND FLOOR BEAM LAYOUT", ["GF", "2F"]],
  ])("a list sign lists, and never the storeys between: %s", (caption, storeys) => {
    expect(storeysOf(caption)).toEqual(storeys);
  });

  test("two consecutive storeys listed are the band they are, as the grammar reads a schedule's `3RD & 4TH`", () => {
    expect(storeysOf("3RD & 4TH FLOOR BEAM LAYOUT")).toEqual(["3F", "4F"]);
    expect(levelRunsOf("3RD & 4TH FLOOR BEAM LAYOUT")).toEqual([{ from: "3RD", to: "4TH" }]);
  });

  test("a set one of whose storeys the stack does not carry defers whole, naming that storey", () => {
    const { rows, deferrals } = resolved("1ST, 3RD & 5TH FLOOR BEAM LAYOUT", stackOf("GF", "1F", "2F", "3F", "ROOF"));
    expect(rows, "never the storeys the stack carries alone: that would drop 5TH with no word said").toEqual([]);
    expect(deferrals.map((deferral) => [deferral.reason, deferral.fromLabel, deferral.toLabel])).toEqual([["LEVEL_RANGE_ENDPOINT_UNMAPPED", "5TH", "5TH"]]);
  });

  test("one caption, one answer, however the stack and the members were handed in (AC-8)", () => {
    const caption = "GF, 2ND TO 3RD & 5TH FLOOR PLAN";
    const forward = resolveExpansion({ placements: MEMBERS, views: [{ caption, view: PLAN }], levels: STACK, ranges: [] });
    const backward = resolveExpansion({ placements: [...MEMBERS].reverse(), views: [{ caption, view: PLAN }], levels: [...STACK].reverse(), ranges: [] });
    expect(backward).toEqual(forward);
  });
});

describe("I-410: the codes that only say how a caption is drawn are taken away before its level words are read", () => {
  test("an underlined MTEXT caption reads its first storey, which the code used to swallow", () => {
    expect(levelWordsOf("{\\L3RD & 5TH FLOOR BEAM LAYOUT}")).toEqual(["3RD", "5TH"]);
    expect(storeysOf("{\\L3RD & 5TH FLOOR BEAM LAYOUT}")).toEqual(["3F", "5F"]);
    expect(storeysOf("{\\L1ST FLOOR BEAM LAYOUT PLAN.}"), "a single-storey plan states its storey, not nothing").toEqual(["1F"]);
  });

  test("a font run, a paragraph break and a `%%` underline toggle say nothing about the storeys", () => {
    expect(storeysOf("{\\fArial|b1|i0|c0|p34;2ND, 4TH & 6TH FLOOR}\\PBEAM LAYOUT")).toEqual(["2F", "4F", "6F"]);
    expect(storeysOf("%%U2ND & 4TH FLOOR BEAM LAYOUT")).toEqual(["2F", "4F"]);
  });
});

describe("I-411: a range to `TOP` runs to the storey beneath the roof, or defers naming TOP", () => {
  test("`1ST TO TOP FLOOR` stands a column plan's members on every counted floor up to the roof, and not on it", () => {
    expect(storeysOf("COLUMN LAYOUT - 1ST TO TOP FLOOR")).toEqual(["1F", "2F", "3F", "4F", "5F", "6F"]);
    expect(storeysOf("(1ST TO TOP) COLUMN LAYOUT")).toEqual(["1F", "2F", "3F", "4F", "5F", "6F"]);
    expect(levelRunsOf("COLUMN LAYOUT - 1ST TO TOP FLOOR")).toEqual([{ from: "1ST", to: TOP_FLOOR }]);
  });

  test("a stack that carries no roof cannot say which level is the top floor: the view defers, naming TOP", () => {
    const { rows, deferrals } = resolved("COLUMN LAYOUT - 1ST TO TOP FLOOR", stackOf("GF", "1F", "2F", "3F", "TERRACE"));
    expect(rows, "the highest level may be the roof by another name, so nothing stands there by guess").toEqual([]);
    expect(deferrals.map((deferral) => [deferral.reason, deferral.fromLabel, deferral.toLabel])).toEqual([["LEVEL_RANGE_ENDPOINT_UNMAPPED", "1ST", TOP_FLOOR]]);
  });

  test.each([
    ["2ND FLOOR - TOP BARS", ["2F"]],
    ["1ST FLOOR SLAB REINFORCEMENT (TOP LAYER)", ["1F"]],
    ["1ST FLOOR BEAM LONG SECTIONS - TOP, BOTTOM AND EXTRA BARS", ["1F"]],
    // The reinforcement idiom names the two faces with a list mark, `TOP & BOTTOM` or `TOP, BOTTOM`. A list
    // mark therefore never ends a range at TOP, even with no other word between the level and the dash.
    ["BEAM LAYOUT - 1ST FLOOR - TOP & BOTTOM BARS", ["1F"]],
    ["1ST FLOOR - TOP & BOTTOM BEAM LAYOUT PLAN", ["1F"]],
    ["COLUMN LAYOUT PLAN - GF - TOP, BOTTOM DOWELS", ["GF"]],
    ["ROOF LEVEL - TOP & BOTTOM", ["ROOF"]],
    // A dash or a tilde is a caption's title separator as often as it is a range sign. A bare TOP after one
    // names a face or a layer, not a floor, however the statement ends.
    ["SLAB REINFORCEMENT - 1ST FLOOR - TOP", ["1F"]],
    ["(1ST FLOOR - TOP) SLAB REINFORCEMENT", ["1F"]],
    ["1ST FLOOR - TOP; BOTTOM AS SHOWN", ["1F"]],
    ["GF~TOP: DOWEL BARS", ["GF"]],
  ])("TOP that ends no range is no floor: %s", (caption, storeys) => {
    expect(storeysOf(caption)).toEqual(storeys);
  });

  test.each([
    ["COLUMN LAYOUT (GF TO TOP)", ["GF", "1F", "2F", "3F", "4F", "5F", "6F"]],
    ["COLUMN LAYOUT 1ST THRU TOP", ["1F", "2F", "3F", "4F", "5F", "6F"]],
    ["1ST-TOP FLOOR COLUMN LAYOUT", ["1F", "2F", "3F", "4F", "5F", "6F"]],
    ["3RD FLOOR - TOP FLOOR COLUMN LAYOUT", ["3F", "4F", "5F", "6F"]],
  ])("TOP is a floor where the range is written in words, or where a storey word follows it: %s", (caption, storeys) => {
    expect(storeysOf(caption)).toEqual(storeys);
  });

  test("the price of reading a list mark as no end: `1ST TO TOP & ROOF` reads 1ST and ROOF, a known UNDER and never an over", () => {
    expect(levelRunsOf("1ST TO TOP & ROOF COLUMN LAYOUT")).toEqual([
      { from: "1ST", to: "1ST" },
      { from: "ROOF", to: "ROOF" },
    ]);
    expect(storeysOf("1ST TO TOP & ROOF COLUMN LAYOUT")).toEqual(["1F", "ROOF"]);
  });

  test("a range to TOP that starts at the roof names a top floor beneath its own start: the view defers, and 6F carries nothing", () => {
    const { rows, deferrals } = resolved("ROOF TO TOP FLOOR COLUMN LAYOUT");
    expect(rows, "the storey beneath the roof is not what a range running UP from the roof states").toEqual([]);
    expect(deferrals.map((deferral) => [deferral.reason, deferral.fromLabel, deferral.toLabel])).toEqual([["LEVEL_RANGE_ENDPOINT_UNMAPPED", "ROOF", TOP_FLOOR]]);
  });

  test("a caption whose only TOP names a part of the building states no storey at all", () => {
    expect(captionLevelsOf("WATER TANK & LIFT TOP BEAM LAYOUT")).toEqual({ kind: "unstated" });
  });
});

describe("F-RCC6-BNBC's and F-RCC6's own captions read exactly as they did, so the J-000 read-back does not move", () => {
  test.each([
    ["TYPICAL FLOOR BEAM LAYOUT", ["@UNRESOLVED"]],
    ["COLUMN LAYOUT PLAN  SCALE 1:100", ["@UNRESOLVED"]],
    ["1ST FLOOR BEAM LAYOUT  SCALE 1:100", ["1F"]],
    ["GRADE BEAM LAYOUT & GF SLAB ON GRADE  SCALE 1:100", ["GF"]],
    ["STAIR ROOF BEAM LAYOUT  SCALE 1:100", ["ROOF"]],
    ["ROOF BEAM LAYOUT (AT ROOF LEVEL)", ["ROOF"]],
    ["ROOF & STAIR ROOF PLAN  SCALE 1:100", ["ROOF"]],
    ["STAIR PLAN AT 1ST FLOOR (TYPICAL)  SCALE 1:50", ["1F"]],
    ["TYPICAL FLOOR PLAN", ["@UNRESOLVED"]],
    ["ROOF PLAN", ["ROOF"]],
  ])("%s", (caption, storeys) => {
    expect(storeysOf(caption)).toEqual(storeys);
  });

  test("a caption naming the roof twice, over a stack with no roof yet, defers as a range to the roof did: no placeholder", () => {
    const { rows, deferrals } = resolved("ROOF BEAM LAYOUT (AT ROOF LEVEL)", []);
    expect(rows).toEqual([]);
    expect(deferrals.map((deferral) => [deferral.reason, deferral.fromLabel, deferral.toLabel])).toEqual([["LEVEL_RANGE_ENDPOINT_UNMAPPED", "ROOF", "ROOF"]]);
  });

  test("and a single-storey caption over an empty stack still waits under its own word (L-REG-04's placeholder)", () => {
    expect(resolved("1ST FLOOR BEAM LAYOUT  SCALE 1:100", []).rows.sort()).toEqual(["B1@@1ST:MEASURED", "C1@@1ST:MEASURED"]);
  });
});

// @vitest-environment node
/**
 * VD-1 — which SHEET a key stands on, and what a line's Trace selects there, over the drawing the
 * demo is walked on (R-UI-022, R-TO-011, X-2, L-CAD-05; I-421).
 *
 * WHAT IS READ AND NOTHING IS STAGED: F-RCC6-BNBC read by the SHIPPED `cad/` CLI and put through the
 * partition's pure stages (`../partition/support/bnbc-stages`) — the artifact the product stores, and
 * the placements the rebuild writes, each with the outline and the mark it was read off. The resolver
 * is core's one pure reading (`@/core/sheets/frames`); the database lane proves the doors that read
 * the record it is asked over (tests/takeoff/trace/doors.test.ts), and J-000's register leg follows a
 * real column-concrete link to S-10.
 *
 * WHY THIS DRAWING: the Trace was built and proved on staged lines that cite raw handles (J-021), and
 * missed on every real line (walk-0, BLOCKS_DEMO): the rails cite view keys, placement keys, a
 * member's `#bars` and an edition's `edition:` clauses, and the layout fell back to a model space
 * spelled `Model` that the artifact spells `model`. Two of the three beam views are captioned IN model
 * space (10C1, F31) and reach their sheets only through a window — the case a text-on-paper reading of
 * captions gets wrong.
 *
 * The handles named below are the committed fixture's own (the extractor identity pins them); every
 * placement-level expectation is derived from what the stages placed, never transcribed (B-19).
 */
import { beforeAll, describe, expect, test } from "vitest";
import { barsSourceOf, editionSourceOf, actSourceOf, placementKeyOf, readCitedKey, viewRefOf } from "@/core/identity";
import {
  framesOfGraph,
  sheetLabelOf,
  sheetOfKey,
  sheetsOfGraph,
  spacesOfGraph,
  standingOfGraph,
  standsOn,
  traceCitations,
  type MemberKeys,
  type RecordStanding,
} from "@/core/sheets/frames";
import { BNBC_DXF, stagesOver, type StagesRead } from "../partition/support/bnbc-stages";

/** How long the shipped CLI may take to read the drawing cold (the cad lane's own budget). */
const READ_MS = 300_000;

/** A source key of the committed fixture, by its handle. */
const handle = (hex: string): string => `DXF_HANDLE:${hex}`;

/**
 * The seven view captions the rails read members off, and the sheet NUMBER each stands on. 20B6, 2116,
 * 1FEB and 202C are captioned on their sheets' paper; 10C1, F31 and 2157 in model space, framed by a
 * window. TEST_AMENDED (R0 Rev C, W-49): the stair-roof layout 2157 on S-15 is gridded in Rev C and
 * places its two C4 stubs and SB-R1..SB-R4.
 */
const VIEW_SHEETS: readonly (readonly [string, string])[] = [
  ["20B6", "S-10"],
  ["10C1", "S-15"],
  ["2157", "S-15"],
  ["F31", "S-14"],
  ["2116", "S-13"],
  ["1FEB", "S-04"],
  ["202C", "S-06"],
];

/**
 * Where a column concrete line's VARIABLES were read: C2's section cell in S-11's COLUMN SCHEDULE,
 * and the roof level note in S-25's building section (walk-0's read of the stored line). Both sit in
 * model space, each framed by its own sheet — neither on S-10, where the column is.
 */
const SECTION_CELL = handle("A0E");
const ROOF_LEVEL = handle("1D58");

/** The digest the pinned edition's clauses are cited under — any digest; an edition key is no entity. */
const EDITION_DIGEST = "b43500d12e5ec01b68d2139aa35089d385323c616f2979aaabd3df91d8c61a35";

let read: StagesRead;
let standing: RecordStanding;

beforeAll(async () => {
  read = await stagesOver(BNBC_DXF);
  const members = new Map<string, MemberKeys>(read.placed.placements.map((placement) => [placement.placementKey, { outlineKey: placement.outlineKey, markKey: placement.markKey }]));
  standing = standingOfGraph(read.graph, members);
}, READ_MS);

/** The sheet number a key stands on, as a reader names it. */
function numberOf(key: string | null): string | null {
  const layout = sheetOfKey(key, standing.spaces, standing.sheets, standing.frames);
  return layout === null ? null : sheetLabelOf(read.graph, layout);
}

/** The placements the stages placed in one view, by the caption handle that anchors it — of one class where one is named. */
function placedIn(caption: string, elementType?: string) {
  return read.placed.placements.filter(
    (placement) => viewRefOf(placement.viewKey)?.captionAnchorSourceKey === handle(caption) && (elementType === undefined || placement.elementType === elementType),
  );
}

describe("VD-1: the sheet a view stands on — the one resolver, over F-RCC6-BNBC", () => {
  test.each(VIEW_SHEETS)("VD-1: the view captioned at %s stands on %s", (caption, sheet) => {
    expect(numberOf(handle(caption)), `the view anchored at ${caption} stands on ${sheet} — on its paper, or framed by exactly one sheet's window (L-CAD-05)`).toBe(sheet);
  });

  test("VD-1: model space is named by the artifact's own layout kind — `model`, never `Model`", () => {
    const model = standing.sheets.find((sheet) => sheet.kind === "model");
    expect(model?.layoutName, "the artifact spells its model space").toBe("model");
    expect(sheetOfKey(null, standing.spaces, standing.sheets, standing.frames), "and a key on no sheet stands in it, as the artifact spells it").toBe(model?.layoutName);
    expect(sheetLabelOf(read.graph, model?.layoutName ?? ""), "model space carries no sheet number — the screen says it in words").toBeNull();
  });

  test("VD-1: a sheet the inventory does not list is still named by its number — only model space goes without one", () => {
    const layoutName = sheetOfKey(handle("20B6"), standing.spaces, standing.sheets, standing.frames) as string;
    const unlisted = { ...read.graph, layouts: read.graph.layouts.filter((layout) => layout.name !== layoutName) };
    expect(sheetLabelOf(unlisted, layoutName), "a space its entities were drawn in is a sheet, and its title block still says S-10 — never `Model space`").toBe("S-10");
  });

  test("VD-1: a variable read on ANOTHER sheet resolves to that sheet", () => {
    expect(numberOf(SECTION_CELL), "C2's section was read in S-11's column schedule").toBe("S-11");
    expect(numberOf(ROOF_LEVEL), "and the roof level in S-25's building section").toBe("S-25");
  });
});

describe("VD-1: a line's Trace opens its member's sheet and selects the member", () => {
  test("VD-1: every placement the rails can cite flies to its own outline and mark, on its view's sheet", () => {
    const bySheet = new Map<string, number>();
    for (const placement of read.placed.placements) {
      const traced = traceCitations({ viewKey: placement.viewKey, sources: [placement.placementKey] }, standing);
      const viewSheet = sheetOfKey(viewRefOf(placement.viewKey)?.captionAnchorSourceKey ?? null, standing.spaces, standing.sheets, standing.frames);
      expect(traced.layoutName, `${placement.placementKey}: the Trace opens the sheet its view stands on`).toBe(viewSheet);
      expect(traced.flyTo, `${placement.placementKey}: and selects exactly the outline and the mark it was placed by (L-CAD-03)`).toEqual([placement.outlineKey, placement.markKey]);
      const label = sheetLabelOf(read.graph, traced.layoutName ?? "") ?? "model";
      bySheet.set(`${placement.elementType}@${label}`, (bySheet.get(`${placement.elementType}@${label}`) ?? 0) + 1);
    }
    // TEST_AMENDED (R0 Rev C): S-06 places F1 in ring 638 beside the 26 caps (W-44), and S-15's
    // stair-roof layout its two C4 stubs and four SB-R beams beside the roof layout's (W-49).
    // TEST_AMENDED (GB-READ, s-schedules I-673): S-08 places the grade beams it letters.
    expect(Object.fromEntries(bySheet), "27 columns on S-10, 89 piles on S-04, 26 caps and F1 on S-06, 43 grade beams on S-08, the beams on the three beam layouts, and the stair roof's stubs and beams on S-15").toEqual({
      "column@S-10": placedIn("20B6").length,
      "column@S-15": placedIn("2157", "column").length,
      "pile@S-04": placedIn("1FEB").length,
      "pile_cap@S-06": placedIn("202C", "pile_cap").length,
      "footing@S-06": placedIn("202C", "footing").length,
      "tie_beam@S-08": placedIn("2073", "tie_beam").length,
      "beam@S-13": placedIn("2116").length,
      "beam@S-14": placedIn("F31").length,
      "beam@S-15": placedIn("10C1").length + placedIn("2157", "beam").length,
    });
    expect([placedIn("20B6").length, placedIn("1FEB").length, placedIn("202C", "pile_cap").length], "the members the read-back stands on").toEqual([27, 89, 26]);
    expect([placedIn("202C", "footing").length, placedIn("2157", "column").length, placedIn("2157", "beam").length], "Rev C's: F1, the two C4 stubs, SB-R1..SB-R4").toEqual([1, 2, 4]);
  });

  test("VD-1: a column concrete line — placement, section cell, level note — selects the column alone on S-10", () => {
    const column = placedIn("20B6")[0];
    expect(column, "the column layout plan placed a column").toBeDefined();
    const placed = column as (typeof read.placed.placements)[number];
    const viewKey = placed.viewKey;
    const traced = traceCitations({ viewKey, sources: [placed.placementKey, SECTION_CELL, SECTION_CELL, ROOF_LEVEL] }, standing);

    expect(sheetLabelOf(read.graph, traced.layoutName ?? ""), "the Trace opens S-10, where the column stands").toBe("S-10");
    expect(traced.flyTo, "and selects the column's outline and mark — nothing on S-10 is left out, and nothing off it is asked for").toEqual([placed.outlineKey, placed.markKey]);
    for (const key of traced.flyTo) expect(standsOn(key, traced.layoutName as string, standing.spaces, standing.sheets, standing.frames), `${key} is on the sheet the viewer opens, so the missing list is empty`).toBe(true);
    expect(traced.sheets[SECTION_CELL], "the section is answered its own sheet, for the reader to follow").toBe(sheetOfKey(SECTION_CELL, standing.spaces, standing.sheets, standing.frames));
    expect(traced.sheets[ROOF_LEVEL], "and so is the level it was read against").toBe(sheetOfKey(ROOF_LEVEL, standing.spaces, standing.sheets, standing.frames));
    expect(traced.sheets[viewKey], "the view stands on S-10 and is never flown to").toBe(traced.layoutName);
    expect(traced.entities, "the other direction meets the column and both variables' entities").toEqual([placed.outlineKey, placed.markKey, SECTION_CELL, ROOF_LEVEL]);
  });

  test("VD-1: a rebar line's `<instanceKey>#bars` names the member, and flies to it", () => {
    const column = placedIn("20B6")[1] as (typeof read.placed.placements)[number];
    const bars = barsSourceOf(`${column.placementKey}@34f04e73-687a-4006-8fa5-12f7352f0ed9`);
    const traced = traceCitations({ viewKey: column.viewKey, sources: [bars] }, standing);
    expect(sheetLabelOf(read.graph, traced.layoutName ?? ""), "the bar set stands where its member does").toBe("S-10");
    expect(traced.flyTo, "and selects the member it reinforces").toEqual([column.outlineKey, column.markKey]);
  });

  test("VD-1: an `edition:` clause and an `act:` stand on no sheet and are never flown to", () => {
    const cap = placedIn("202C")[0] as (typeof read.placed.placements)[number];
    const clause = editionSourceOf(EDITION_DIGEST, "blindingThickness");
    const entered = actSourceOf("3d02536e-637f-406d-801a-ff047d121a5a");
    const traced = traceCitations({ viewKey: cap.viewKey, sources: [cap.placementKey, clause, entered] }, standing);
    expect(sheetLabelOf(read.graph, traced.layoutName ?? ""), "the cap's excavation opens S-06, its cap's sheet").toBe("S-06");
    expect(traced.flyTo, "and selects the cap alone").toEqual([cap.outlineKey, cap.markKey]);
    expect([traced.sheets[clause], traced.sheets[entered]], "a clause and an act are on no sheet").toEqual([null, null]);
    expect(traced.entities, "and are no entity the other direction could meet").toEqual([cap.outlineKey, cap.markKey]);
  });

  test("VD-1: where no placement resolves, the Trace opens the view's sheet and flies to what the line cites THERE", () => {
    const traced = traceCitations({ viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:20B6", sources: ["v:LAYOUT_PLAN:DXF_HANDLE:20B6|C99|0.0,0.0", SECTION_CELL, handle("99C")] }, standing);
    expect(sheetLabelOf(read.graph, traced.layoutName ?? ""), "a member the record never placed leaves the line on its view's sheet").toBe("S-10");
    expect(traced.flyTo, "and the Trace selects only what the line cites on that sheet — the section cell is on S-11, not here").toEqual([handle("99C")]);
  });

  test("VD-1: a record nobody can read names no sheet and selects nothing", () => {
    const traced = traceCitations({ viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:20B6", sources: [SECTION_CELL] }, null);
    expect(traced.layoutName, "no record, no sheet — the register offers no Trace rather than a dead one (I-181)").toBeNull();
    expect(traced.flyTo).toEqual([]);
    expect(traced.entities, "what it cites is still what it cites").toEqual([SECTION_CELL]);
  });
});

describe("VD-1: the key grammar, read back (L-REG-04)", () => {
  const view = "v:LAYOUT_PLAN:DXF_HANDLE:20B6";
  const placement = `${view}|C2|1215849.6,-384150.4`;

  test("VD-1: each cited scheme is read by the grammar that minted it", () => {
    expect(readCitedKey(view).scheme, "a view key").toBe("view");
    expect(readCitedKey(placement).scheme, "a placement key").toBe("placement");
    expect(readCitedKey(`${placement}@FOUNDATION`).scheme, "an instance key names its placement").toBe("placement");
    expect(readCitedKey(`${placement}@unregistered:3F`).scheme, "under a placeholder level too").toBe("placement");
    expect(readCitedKey(barsSourceOf(`${placement}@deda3aaa-e0ae-450e-a143-f6585e971ced`)).scheme, "a member's bar set").toBe("bars");
    expect(readCitedKey(handle("99C")).scheme, "a source key").toBe("source");
    expect(readCitedKey(editionSourceOf(EDITION_DIGEST, "a")).scheme, "an edition clause").toBe("edition");
    expect(readCitedKey(actSourceOf("x")).scheme, "an act").toBe("act");
    expect(readCitedKey("S-101:t:12").scheme, "and a key of no grammar is read as none").toBe("unread");
    expect(readCitedKey("v:PLAN:S-101:t:12").scheme, "a view whose anchor is no source key is no view key (L-CAD-02)").toBe("unread");
  });

  test("VD-1: a placement, instance or bar-set key names its placement; anything else names none", () => {
    for (const key of [placement, `${placement}@FOUNDATION`, `${placement}@deda3aaa-e0ae-450e-a143-f6585e971ced#bars`]) {
      expect(placementKeyOf(key), `${key} names the placement it was derived from`).toBe(placement);
    }
    for (const key of [view, `${view}|C2`, `${view}|C2|1215849.6`, `${view}||1.0,2.0`, `${placement}X`, handle("99C")]) {
      expect(placementKeyOf(key), `${key} is not taken apart on a guess`).toBeNull();
    }
  });

  test("VD-1: a view key's inverse is the view it was derived from", () => {
    expect(viewRefOf(placement), "the view a placement key opens with").toEqual({ viewClass: "LAYOUT_PLAN", captionAnchorSourceKey: handle("20B6") });
    expect(viewRefOf(handle("20B6")), "a source key is no view key").toBeNull();
  });
});

describe("VD-1: the frames are read once per record", () => {
  test("VD-1: asking twice answers the same reading", () => {
    expect(framesOfGraph(read.graph), "the windows and standings of one artifact are kept beside it").toBe(framesOfGraph(read.graph));
    expect(spacesOfGraph(read.graph)).toBe(spacesOfGraph(read.graph));
    expect(sheetsOfGraph(read.graph).map((sheet) => sheet.layoutName)[0], "the inventory's own order, model space first").toBe("model");
  });
});

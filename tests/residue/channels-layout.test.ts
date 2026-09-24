// @vitest-environment node
/**
 * RES-1 — the residue sees the sheets its sightings stand on (L-QTY-05, L-REG-04, L-CAD-05; I-548,
 * I-549).
 *
 * Two defects, one cause — a residue channel reading a sheet its own way:
 * - the layout channel met a placement's view by comparing `placements.view_key`
 *   (`v:LAYOUT_PLAN:DXF_HANDLE:20B6`, L-REG-04's identity key) with `partition_views.view_key`
 *   (`LAYOUT_PLAN:DXF_HANDLE:20B6`, the partition's own), so none of F-RCC6-BNBC's placements
 *   joined its view and the channel saw nothing;
 * - every sighting took its sheet from the manifest's name for the DRAWING (`rcc6-bnbc.dxf`), so a
 *   column on S-10 and a pile on S-04 were said to stand on the same "sheet", a file name.
 *
 * WHAT IS READ AND NOTHING IS STAGED: F-RCC6-BNBC read by the SHIPPED `cad/` CLI and put through the
 * partition's pure stages (`../takeoff/partition/support/bnbc-stages`) — the views the rebuild stores
 * and the placements it writes, each with the outline and the mark it was read off. The join and the
 * sheet are the channels' own pure readings (`membershipOf`, `sheetOf`); the database lane drives the
 * channels themselves over the same record written through the product's stores
 * (`./channels-layout.db.test.ts`).
 *
 * The handles named below are the committed fixture's own (the extractor identity pins them); every
 * count is derived from what the stages placed, never transcribed (B-19).
 */
import { beforeAll, describe, expect, test } from "vitest";
import { viewRefOf } from "@/core/identity";
import { membershipOf, type StoredMember, type StoredView } from "@/core/residue/channels/layout";
import { sheetOf, type SightingScope } from "@/core/residue/channels/scope";
import { sheetLabelOf, standingOfGraph, traceCitations, type MemberKeys, type RecordStanding } from "@/core/sheets/frames";
import { viewAddressOf } from "@/core/views";
import { BNBC_DXF, stagesOver, type StagesRead } from "../takeoff/partition/support/bnbc-stages";

/** How long the shipped CLI may take to read the drawing cold (the cad lane's own budget). */
const READ_MS = 300_000;

/** The ids a store would give the drawing and its one record; any ids — the reading keys on neither. */
const DRAWING = "3f0c1a52-8d5e-4b7a-9c61-2a4e8f0b7d13";
const INGEST = "b4d2e6f8-1a3c-4e5b-8d7f-9a0b1c2d3e4f";

/** The name the pin records the drawing under: a FILE, which no sighting may be said to stand on. */
const FILE_NAME = "rcc6-bnbc.dxf";

/** A source key of the committed fixture, by its handle. */
const handle = (hex: string): string => `DXF_HANDLE:${hex}`;

/**
 * The six views the plans place members in, by their caption's handle, the class each places and the
 * sheet NUMBER it stands on (tests/takeoff/sheets/sheet-of-key.test.ts reads the same six).
 */
const VIEWS: readonly (readonly [string, string, string])[] = [
  ["20B6", "column", "S-10"],
  ["1FEB", "pile", "S-04"],
  ["202C", "pile_cap", "S-06"],
  ["2116", "beam", "S-13"],
  ["F31", "beam", "S-14"],
  ["10C1", "beam", "S-15"],
];

let read: StagesRead;
let standing: RecordStanding;
let views: StoredView[];
let members: (StoredMember & { placementKey: string })[];
let scope: SightingScope;

beforeAll(async () => {
  read = await stagesOver(BNBC_DXF);
  const keys = new Map<string, MemberKeys>(read.placed.placements.map((placement) => [placement.placementKey, { outlineKey: placement.outlineKey, markKey: placement.markKey }]));
  standing = standingOfGraph(read.graph, keys);
  // The rows exactly as the rebuild stores them: `partition_views` from the views stage, `placements`
  // from the placement stage — one record of one drawing.
  views = read.evidence.views.map((view) => ({ drawingId: DRAWING, ingestId: INGEST, viewKey: view.viewKey, type: view.type, anchorKey: view.anchorKey }));
  members = read.placed.placements.map((placement) => ({ ingestId: INGEST, viewKey: placement.viewKey, class: placement.elementType, placementKey: placement.placementKey }));
  // The manifest names the drawing by its file — and names a second drawing FIRST, so a reading that
  // took a drawing's sheet from the manifest's first entry would say that drawing's name here.
  scope = {
    tenantId: "tenant",
    projectId: "project",
    setRevisionId: "revision",
    sheets: [
      { drawingId: "0a9e7c5b-3d1f-4e2a-8b6c-4d0e2f1a3b5c", layoutName: "architectural.dxf" },
      { drawingId: DRAWING, layoutName: FILE_NAME },
    ],
    records: new Map([[DRAWING, standing]]),
  };
}, READ_MS);

/** The sheet number a layout stands for, as a reader names it. */
function numberOf(layoutName: string): string | null {
  return sheetLabelOf(read.graph, layoutName);
}

describe("RES-1: the layout channel meets every placement in its view (I-549)", () => {
  test("RES-1: all of F-RCC6-BNBC's placements join the view they were read in, through the key grammar", () => {
    const met = membershipOf(views, members);
    const byClass = (klass: string): number => members.filter((member) => member.class === klass).length;
    expect([byClass("column"), byClass("pile"), byClass("pile_cap")], "the plans place the 27 columns, 89 piles and 26 caps the read-back stands on").toEqual([27, 89, 26]);
    expect(byClass("beam"), "and the beams of the three beam layouts").toBeGreaterThan(0);
    expect(members.length, "nothing else is placed: every member is one of the four classes").toBe(27 + 89 + 26 + byClass("beam"));
    expect(met.length, "and every one of them stands in a view the partition stored — none is lost at the join").toBe(members.length);
    for (const held of met) {
      expect(held.viewKey, `${held.member.placementKey} is met in the view its own key names, spelled as L-REG-04 spells it`).toBe(held.member.viewKey);
      expect(held.drawingId, "on the drawing the view was cut from").toBe(DRAWING);
    }
  });

  test("RES-1: the views the members stand in are the six the plans place them in, each once per class", () => {
    const pairs = new Set(membershipOf(views, members).map((held) => `${held.member.class}@${viewRefOf(held.viewKey)?.captionAnchorSourceKey ?? ""}`));
    expect([...pairs].sort(), "column on 20B6, piles on 1FEB, caps on 202C, beams on 2116, F31 and 10C1").toEqual(VIEWS.map(([caption, klass]) => `${klass}@${handle(caption)}`).sort());
  });

  test("RES-1: a member meets its view only on its own record, and a view no caption anchors holds nobody", () => {
    const other = members.map((member) => ({ ...member, ingestId: "another-record" }));
    expect(membershipOf(views, other), "the same keys on another record stand in none of this record's views").toEqual([]);
    const uncaptioned = views.map((view) => ({ ...view, anchorKey: null }));
    expect(membershipOf(uncaptioned, members), "a view with no anchor is addressed by the partition's own name for it, which no placement names").toEqual([]);
    const emptied = views.map((view) => ({ ...view, anchorKey: "" }));
    expect(membershipOf(emptied, members), "and an anchor stored empty addresses nothing — passed over, never thrown on").toEqual([]);
  });

  test("RES-1: the channel names each view by the address core's views door gives it — one address, however many readers (B-17)", () => {
    const addressed = new Map(views.map((view) => [viewAddressOf(view), view]));
    const met = membershipOf(views, members);
    const held = new Set(met.map((one) => one.viewKey));
    expect(held.size, "the six views the plans place members in").toBe(VIEWS.length);
    for (const address of held) {
      const view = addressed.get(address);
      expect(view, `${address} is the address viewAddressOf gives a stored view — the one measure/setup and the levels screen name it by`).toBeDefined();
      expect(address, "and it is never the partition's own key for the view, which no placement names").not.toBe((view as StoredView).viewKey);
    }
    // A view the partition stored and no caption anchors is addressed by its own name (`viewAddressOf`):
    // a member naming exactly that address is met there, so the channel follows the door, not a rule of its own.
    const unanchored: StoredView = { drawingId: DRAWING, ingestId: INGEST, viewKey: "LAYOUT_PLAN:#uncaptioned", type: (views[0] as StoredView).type, anchorKey: null };
    const named = { ingestId: INGEST, viewKey: viewAddressOf(unanchored), class: "column", placementKey: "staged" };
    expect(membershipOf([unanchored], [named]).map((one) => one.viewKey), "the address the door gives it is the one the channel meets a member at").toEqual([viewAddressOf(unanchored)]);
  });
});

describe("RES-1: a sighting names the sheet its key stands on (I-548)", () => {
  test.each(VIEWS)("RES-1: the layout sighting of the view captioned at %s (%s) names %s", (caption, _klass, sheet) => {
    const view = membershipOf(views, members).find((held) => viewRefOf(held.viewKey)?.captionAnchorSourceKey === handle(caption));
    expect(view, `a member stands in the view anchored at ${caption}`).toBeDefined();
    const layoutName = sheetOf(scope, DRAWING, (view as { viewKey: string }).viewKey);
    expect(numberOf(layoutName), `the view anchored at ${caption} stands on ${sheet} — never on the drawing's file name`).toBe(sheet);
    expect(layoutName, "a sheet the drawing holds, as its own inventory spells it").not.toBe(FILE_NAME);
  });

  test("RES-1: every placement's sighting names the sheet its Trace opens — the one resolver, asked the same way", () => {
    const bySheet = new Map<string, number>();
    for (const member of members) {
      const layoutName = sheetOf(scope, DRAWING, member.placementKey);
      const traced = traceCitations({ viewKey: member.viewKey, sources: [member.placementKey] }, standing);
      expect(layoutName, `${member.placementKey} names the sheet the Trace opens it on (I-421)`).toBe(traced.layoutName);
      const tally = `${member.class}@${numberOf(layoutName) ?? "model"}`;
      bySheet.set(tally, (bySheet.get(tally) ?? 0) + 1);
    }
    const expected = new Map<string, number>();
    for (const [caption, klass, sheet] of VIEWS) {
      const placed = members.filter((member) => viewRefOf(member.viewKey)?.captionAnchorSourceKey === handle(caption)).length;
      expected.set(`${klass}@${sheet}`, (expected.get(`${klass}@${sheet}`) ?? 0) + placed);
    }
    expect(Object.fromEntries(bySheet), "27 columns on S-10, 89 piles on S-04, 26 caps on S-06, and the beams on S-13, S-14 and S-15").toEqual(Object.fromEntries(expected));
  });

  test("RES-1: a register row keyed at an instance of a placement stands where the placement does", () => {
    const column = members.find((member) => member.class === "column") as (typeof members)[number];
    const onPlan = sheetOf(scope, DRAWING, column.placementKey);
    expect(sheetOf(scope, DRAWING, `${column.placementKey}@FOUNDATION`), "an instance key names its placement, whatever level it stands on (L-REG-04)").toBe(onPlan);
    expect(numberOf(onPlan)).toBe("S-10");
  });

  test.each(VIEWS)("RES-1: a caption's declaration, read at its anchor %s (%s), names the sheet the caption stands on, %s", (caption, _klass, sheet) => {
    const layoutName = sheetOf(scope, DRAWING, handle(caption));
    expect(numberOf(layoutName), `the caption at ${caption} is drawn on ${sheet}`).toBe(sheet);
  });

  test("RES-1: a drawing whose pinned record nobody read places its sightings on no sheet — never the manifest's name", () => {
    const column = members.find((member) => member.class === "column") as (typeof members)[number];
    const unread: SightingScope = { ...scope, records: new Map() };
    expect(sheetOf(unread, DRAWING, column.placementKey), "no record, no sheet: an empty name, never a guessed one (I-181)").toBe("");
    expect(sheetOf(unread, DRAWING, column.viewKey)).toBe("");
  });
});

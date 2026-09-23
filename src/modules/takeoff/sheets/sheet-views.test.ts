// A multi-layout record's views belong to the sheets they were drawn on (R-TO-021, L-CAD-05). Which
// sheet a KEY stands on is core's one reading (`sheetOfKey`); a view stands where its caption anchor
// does, so the view's cases are asked of it by the view's anchor.
import { describe, expect, it } from "vitest";
import { NO_FRAMES, sheetOfKey, type RecordFrames } from "@/core/sheets/frames";
import { viewsOnSheet } from "./sheet-views";
import type { ScaleStateView } from "./scale-state";

/** One view of the record, as the scale door answers one. */
function view(viewKey: string, anchorKey: string | null): ScaleStateView {
  return { viewKey, anchorKey, affirmed: null };
}

/** The sheet one view stands on: its caption anchor's. */
function sheetOfView(held: ScaleStateView, spaces: ReadonlyMap<string, string>, sheets: readonly { layoutName: string; kind: string }[], frames: RecordFrames): string | null {
  return sheetOfKey(held.anchorKey, spaces, sheets, frames);
}

const SHEETS = [
  { layoutName: "Model", kind: "model" },
  { layoutName: "S-102", kind: "paper" },
  { layoutName: "S-103", kind: "paper" },
];

/** Where each caption entity of the record was drawn. */
const SPACES = new Map([
  ["S-102:e:7", "S-102"],
  ["S-103:e:4", "S-103"],
  // Two captions the draughtsman wrote in MODEL space, which two of the sheets' windows show.
  ["m:e:1", "Model"],
  ["m:e:2", "Model"],
  ["m:e:3", "Model"],
]);

/**
 * The record's windows: S-102 frames the left half of model space, S-103 the right. The third model
 * caption stands beyond both — nothing frames it.
 */
const FRAMES: RecordFrames = {
  windows: [
    { layoutName: "S-102", model: [0, 0, 100, 100] },
    { layoutName: "S-103", model: [200, 0, 300, 100] },
  ],
  standing: new Map<string, readonly [number, number]>([
    ["m:e:1", [50, 50]],
    ["m:e:2", [250, 50]],
    ["m:e:3", [900, 900]],
  ]),
};

const ON_102 = view("v:PLAN:S-102:e:7", "S-102:e:7");
const ON_103 = view("v:SECTION:S-103:e:4", "S-103:e:4");
const UNANCHORED = view("v:UNASSIGNED:1", null);
const FRAMED_BY_102 = view("v:PLAN:m:e:1", "m:e:1");
const FRAMED_BY_103 = view("v:SECTION:m:e:2", "m:e:2");
const FRAMED_BY_NOBODY = view("v:PLAN:m:e:3", "m:e:3");

describe("sheetOfKey, asked by a view's anchor", () => {
  it("names the sheet the view's caption was drawn on", () => {
    expect(sheetOfView(ON_102, SPACES, SHEETS, NO_FRAMES), "the plan captioned on S-102 stands on S-102").toBe("S-102");
    expect(sheetOfView(ON_103, SPACES, SHEETS, NO_FRAMES), "and the section captioned on S-103 stands on S-103").toBe("S-103");
  });

  it("puts a view no caption anchors in the space it was found in", () => {
    expect(sheetOfView(UNANCHORED, SPACES, SHEETS, NO_FRAMES), "a view with no caption is the whole of the model space it was read in").toBe("Model");
    expect(sheetOfView(view("v:PLAN:gone", "S-104:e:1"), SPACES, SHEETS, NO_FRAMES), "and a key the artifact does not name is the same absence").toBe("Model");
    expect(sheetOfView(UNANCHORED, SPACES, [{ layoutName: "S-102", kind: "paper" }], NO_FRAMES), "a record with no model sheet at all answers none").toBeNull();
  });

  it("puts a view captioned in model space on the sheet whose window shows it", () => {
    expect(sheetOfView(FRAMED_BY_102, SPACES, SHEETS, FRAMES), "the model caption S-102's window frames stands on S-102 — the frame is what shows it").toBe("S-102");
    expect(sheetOfView(FRAMED_BY_103, SPACES, SHEETS, FRAMES), "and the one S-103's window frames stands on S-103").toBe("S-103");
    expect(sheetOfView(FRAMED_BY_NOBODY, SPACES, SHEETS, FRAMES), "a model caption no window shows stands on the model sheet, which is where it was found").toBe("Model");
    expect(sheetOfView(FRAMED_BY_102, SPACES, SHEETS, NO_FRAMES), "a record whose frames nobody read is read as before — the model sheet").toBe("Model");
  });

  it("leaves a view on the model sheet where windows of two sheets show its caption", () => {
    const overlapping: RecordFrames = {
      windows: [...FRAMES.windows, { layoutName: "S-103", model: [0, 0, 100, 100] }],
      standing: FRAMES.standing,
    };
    expect(sheetOfView(FRAMED_BY_102, SPACES, SHEETS, overlapping), "two sheets show the same caption, so the record does not say which one the view is drawn on").toBe("Model");
  });

  it("keeps a view on its sheet where two windows of that ONE sheet show its caption", () => {
    const twice: RecordFrames = {
      windows: [...FRAMES.windows, { layoutName: "S-102", model: [25, 25, 75, 75] }],
      standing: FRAMES.standing,
    };
    expect(sheetOfView(FRAMED_BY_102, SPACES, SHEETS, twice), "an enlarged detail window on S-102 still shows it on S-102 — one sheet says which sheet").toBe("S-102");
  });

  it("keeps a PAPER anchor on its own sheet whatever the windows frame", () => {
    expect(sheetOfView(ON_102, SPACES, SHEETS, FRAMES), "a caption drawn on the paper is on that paper, and no window moves it").toBe("S-102");
  });
});

describe("viewsOnSheet", () => {
  it("gives each sheet its own views, never the whole record's", () => {
    const held = [ON_102, ON_103, UNANCHORED];
    expect(viewsOnSheet(held, SHEETS[1] as { layoutName: string; kind: string }, SPACES, SHEETS, NO_FRAMES).map((one) => one.viewKey), "S-102 holds one view").toEqual([ON_102.viewKey]);
    expect(viewsOnSheet(held, SHEETS[2] as { layoutName: string; kind: string }, SPACES, SHEETS, NO_FRAMES).map((one) => one.viewKey), "and so does S-103").toEqual([ON_103.viewKey]);
    expect(viewsOnSheet(held, SHEETS[0] as { layoutName: string; kind: string }, SPACES, SHEETS, NO_FRAMES).map((one) => one.viewKey), "the model sheet holds the view no caption anchors").toEqual([
      UNANCHORED.viewKey,
    ]);
  });

  it("counts a framed model-space view on the sheet that frames it", () => {
    const held = [ON_102, FRAMED_BY_102, FRAMED_BY_103, FRAMED_BY_NOBODY, UNANCHORED];
    expect(viewsOnSheet(held, SHEETS[1] as { layoutName: string; kind: string }, SPACES, SHEETS, FRAMES).map((one) => one.viewKey), "S-102 holds its paper caption and the view its window frames").toEqual([
      ON_102.viewKey,
      FRAMED_BY_102.viewKey,
    ]);
    expect(viewsOnSheet(held, SHEETS[2] as { layoutName: string; kind: string }, SPACES, SHEETS, FRAMES).map((one) => one.viewKey), "S-103 holds the view its own window frames").toEqual([FRAMED_BY_103.viewKey]);
    expect(viewsOnSheet(held, SHEETS[0] as { layoutName: string; kind: string }, SPACES, SHEETS, FRAMES).map((one) => one.viewKey), "and the model sheet keeps what no window shows").toEqual([
      FRAMED_BY_NOBODY.viewKey,
      UNANCHORED.viewKey,
    ]);
  });
});

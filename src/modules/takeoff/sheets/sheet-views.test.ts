// A multi-layout record's views belong to the sheets they were drawn on (R-TO-021, L-CAD-05).
import { describe, expect, it } from "vitest";
import { sheetOfView, viewsOnSheet } from "./sheet-views";
import type { ScaleStateView } from "./scale-state";

/** One view of the record, as the scale door answers one. */
function view(viewKey: string, anchorKey: string | null): ScaleStateView {
  return { viewKey, anchorKey, affirmed: null };
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
]);

const ON_102 = view("v:PLAN:S-102:e:7", "S-102:e:7");
const ON_103 = view("v:SECTION:S-103:e:4", "S-103:e:4");
const UNANCHORED = view("v:UNASSIGNED:1", null);

describe("sheetOfView", () => {
  it("names the sheet the view's caption was drawn on", () => {
    expect(sheetOfView(ON_102, SPACES, SHEETS), "the plan captioned on S-102 stands on S-102").toBe("S-102");
    expect(sheetOfView(ON_103, SPACES, SHEETS), "and the section captioned on S-103 stands on S-103").toBe("S-103");
  });

  it("puts a view no caption anchors in the space it was found in", () => {
    expect(sheetOfView(UNANCHORED, SPACES, SHEETS), "a view with no caption is the whole of the model space it was read in").toBe("Model");
    expect(sheetOfView(view("v:PLAN:gone", "S-104:e:1"), SPACES, SHEETS), "and a key the artifact does not name is the same absence").toBe("Model");
    expect(sheetOfView(UNANCHORED, SPACES, [{ layoutName: "S-102", kind: "paper" }]), "a record with no model sheet at all answers none").toBeNull();
  });
});

describe("viewsOnSheet", () => {
  it("gives each sheet its own views, never the whole record's", () => {
    const held = [ON_102, ON_103, UNANCHORED];
    expect(viewsOnSheet(held, SHEETS[1] as { layoutName: string; kind: string }, SPACES, SHEETS).map((one) => one.viewKey), "S-102 holds one view").toEqual([ON_102.viewKey]);
    expect(viewsOnSheet(held, SHEETS[2] as { layoutName: string; kind: string }, SPACES, SHEETS).map((one) => one.viewKey), "and so does S-103").toEqual([ON_103.viewKey]);
    expect(viewsOnSheet(held, SHEETS[0] as { layoutName: string; kind: string }, SPACES, SHEETS).map((one) => one.viewKey), "the model sheet holds the view no caption anchors").toEqual([
      UNANCHORED.viewKey,
    ]);
  });
});

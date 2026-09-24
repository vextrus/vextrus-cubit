/**
 * What the card offers beside the act's preview (docs/design/s-measure.md § 2.5, I-377, I-616,
 * I-617): the level the view's caption states, matched to the stack as a storey, and the notes of the
 * view that state a reading of the recipe's kind — S-08's 828, "75 THK BLINDING UNDER", for a blinding's
 * t, and never a slab's own thickness note for it. Pure; the store read around them is `measureCardOf`.
 */
import { describe, expect, test } from "vitest";
import { captionLevelOf, notesStating, spaceOf } from "@/modules/takeoff/measure/card";

const STACK = [
  { levelId: "fdn", label: "FDN", ordinal: -1 },
  { levelId: "gf", label: "GF", ordinal: 0 },
  { levelId: "1f", label: "1F", ordinal: 1 },
];

describe("I-377: the level a view's caption states is the card's default", () => {
  test("S-08's caption states GF, and the stack's GF is chosen", () => {
    expect(captionLevelOf("GRADE BEAM LAYOUT & GF SLAB ON GRADE", STACK)).toBe("gf");
  });

  test("a caption stating no level, or a set of them, offers no default: the QS picks", () => {
    expect(captionLevelOf("TYPICAL FLOOR PLAN", STACK)).toBeNull();
    expect(captionLevelOf("TYPICAL FLOOR PLAN (1ST TO 5TH)", STACK)).toBeNull();
  });

  test("a storey the stack does not carry offers no default", () => {
    expect(captionLevelOf("7TH FLOOR BEAM LAYOUT", STACK)).toBeNull();
  });
});

describe("I-616: a note states a reading of a kind only where it names that kind's material", () => {
  const texts = [
    { sourceKey: "DXF_HANDLE:828", text: "75 THK BLINDING UNDER (EXPLODED OUTLINE)" },
    { sourceKey: "DXF_HANDLE:900", text: "SLAB 125 THK" },
    { sourceKey: "DXF_HANDLE:901", text: "GRADE BEAM LAYOUT & GF SLAB ON GRADE" },
  ];

  test("828 states the blinding's t: 75 mm, TRANSCRIBED from its source key", () => {
    expect(notesStating(texts, { attributes: ["t"], kinds: ["pcc.blinding"] })).toEqual([
      { attribute: "t", sourceKey: "DXF_HANDLE:828", text: "75 THK BLINDING UNDER (EXPLODED OUTLINE)", valueAsWritten: "75", unitAsWritten: "mm" },
    ]);
  });

  test("a slab's own thickness is never offered as a blinding's", () => {
    expect(notesStating([{ sourceKey: "DXF_HANDLE:900", text: "SLAB 125 THK" }], { attributes: ["t"], kinds: ["pcc.blinding"] })).toEqual([]);
  });

  test("an MTEXT's codes are read through the one notation reading, and 75MM THK reads 75 mm", () => {
    expect(notesStating([{ sourceKey: "DXF_HANDLE:A1", text: "\\A1;75MM THK CC BLINDING" }], { attributes: ["t"], kinds: ["pcc.blinding"] }).map((note) => [note.valueAsWritten, note.unitAsWritten])).toEqual([["75", "mm"]]);
  });

  test("a kind with no words and an attribute with no reader are offered nothing", () => {
    expect(notesStating(texts, { attributes: ["t"], kinds: ["rcc.concrete"] })).toEqual([]);
    expect(notesStating(texts, { attributes: ["d"], kinds: ["pcc.blinding"] })).toEqual([]);
  });
});

describe("I-620: the space a sheet's points are stated in", () => {
  const model = { name: "model", kind: "model", bbox: null, strays_rejected: 0, viewports: [] };
  const paper = { name: "S-08", kind: "paper", bbox: null, strays_rejected: 0, viewports: [{ handle: "2077", on: true, centre: [400, 300], size: [600, 400], view_centre: [10000, -392000], view_height: 40000, twist: 0, clipped: false }] };

  test("a paper sheet showing model space through a window states model space, with the window", () => {
    const stated = spaceOf({ layouts: [model, paper] } as never, "S-08");
    expect(stated.space).toBe("model");
    expect(stated.windows.map((window) => [window.via, window.scale, window.viewCentre])).toEqual([["2077", 0.01, [10000, -392000]]]);
  });

  test("model space, and a sheet with no window, state themselves", () => {
    expect(spaceOf({ layouts: [model, paper] } as never, "model")).toEqual({ space: "model", windows: [] });
    expect(spaceOf({ layouts: [model, { ...paper, viewports: [] }] } as never, "S-08")).toEqual({ space: "S-08", windows: [] });
  });
});

/**
 * What one sheet's coordinates are units OF, as the calibration door answers it (s-measure I-501):
 * the windows a paper sheet shows model space through, read off the layout's inventory by the viewer's
 * own `windowsOf`, and the space each rank's factor is per unit of.
 *
 * S-08's layout is the committed fixture's own: VIEWPORT 2077 read from the DXF's group codes
 * (`../viewer-measure/support/s08.ts`), never transcribed.
 */
import { describe, expect, test } from "vitest";
import { SCALE_RANKS } from "@/core/scale/law";
import { factorSpaceOf, sheetWindowsOf } from "@/modules/takeoff/viewer-snap/sheet-space";
import { s08PaperLayout } from "../viewer-measure/support/s08";

describe("sheetWindowsOf: the windows a paper sheet shows model space through", () => {
  test("S-08 opens one window, 2077, at 1:100: its frame on the paper and its view height over its frame's height", () => {
    const [only, ...rest] = sheetWindowsOf(s08PaperLayout());
    expect(rest).toEqual([]);
    expect(only, "centre (220, 300), a 340 × 340 frame, a 34 000-unit view height — the DXF's own spellings").toEqual({
      via: "2077",
      frame: { min: [50, 130], max: [390, 470] },
      viewHeight: "34000",
      frameHeight: "340",
    });
  });

  test("model space, a window switched off and a twisted window open none — the viewer paints through none of them either", () => {
    const layout = s08PaperLayout();
    const viewport = (layout.viewports ?? [])[0];
    if (viewport === undefined) throw new Error("S-08 carries its viewport");
    expect(sheetWindowsOf({ ...layout, kind: "model" })).toEqual([]);
    expect(sheetWindowsOf({ ...layout, viewports: [{ ...viewport, on: false }] })).toEqual([]);
    expect(sheetWindowsOf({ ...layout, viewports: [{ ...viewport, twist: 0.5 }] })).toEqual([]);
    expect(sheetWindowsOf(undefined)).toEqual([]);
  });
});

describe("factorSpaceOf: the space a rank's factor is per unit of", () => {
  test("every machine rank is per MODEL unit; a QS two-point is per unit of a sheet the store does not record", () => {
    expect(Object.fromEntries(SCALE_RANKS.map((rank) => [rank, factorSpaceOf(rank)]))).toEqual({
      QS_TWO_POINT: "unrecorded",
      GRID_SPACING: "model",
      DIMENSION_RATIO: "model",
      FILE_UNITS: "model",
    });
  });
});

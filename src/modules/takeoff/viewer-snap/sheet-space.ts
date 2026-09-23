// What one sheet's coordinates are units OF, as the calibration door answers it (s-measure I-501):
// the windows a paper sheet shows model space through, and the space a view's factor was read in.
// Pure — an artifact's layout and a rank in, the answer's facts out — so the door reads the store and
// this reads the drawing, and a suite can ask it without either.
//
// A paper sheet's coordinates are the PAPER's: the viewer projects each model record onto the paper
// through its window, moved and scaled (`viewer/projection.ts`). A machine-read scale of record is per
// MODEL unit. So a figure on paper is carried into metres through the one window it stands in, by that
// window's own ratio of model units to sheet units — never by the model factor on paper coordinates,
// which on BNBC's 1:100 sheets states an area ten thousand times under.
import type { EntityGraph } from "@/core/entitygraph/schema";
import { QS_TWO_POINT, type ScaleRank } from "@/core/scale/law";
import { windowsOf } from "@/modules/takeoff/viewer/projection";
import type { SnapFactorSpace, SnapWindow } from "./types";

/**
 * The space a rank's factor is per unit of. The machine ranks are read off the view's own members —
 * model-space entities (L-CAD-06) — or off the header, which states model space's unit. A QS's two
 * points are per unit of whichever sheet they were picked on, and the affirmation records no sheet,
 * so that factor's space is unrecorded and no window carries it into metres.
 */
export function factorSpaceOf(rank: ScaleRank): SnapFactorSpace {
  return rank === QS_TWO_POINT ? "unrecorded" : "model";
}

/**
 * The windows one layout shows model space through: each window's frame on the paper, and the
 * viewport's view height over its frame's height, in the drawing's own spellings. The windows are the
 * viewer's own reading (`windowsOf`: switched on, untwisted, framed), the one its projection paints
 * through, so a figure is carried through exactly the windows the sheet is drawn through (B-17). Model
 * space, and a paper layout with no projectable window, answer none (as `thumbnails/raster.ts` reads it).
 */
export function sheetWindowsOf(layout: EntityGraph["layouts"][number] | undefined): SnapWindow[] {
  if (layout?.kind !== "paper") return [];
  const viewports = new Map((layout.viewports ?? []).map((viewport) => [viewport.handle, viewport]));
  return windowsOf(layout).flatMap((window) => {
    const viewport = viewports.get(window.via);
    if (viewport === undefined) return [];
    return [
      {
        via: window.via,
        frame: { min: [window.paper[0], window.paper[1]], max: [window.paper[2], window.paper[3]] },
        viewHeight: String(viewport.view_height),
        frameHeight: String(viewport.size[1]),
      },
    ];
  });
}

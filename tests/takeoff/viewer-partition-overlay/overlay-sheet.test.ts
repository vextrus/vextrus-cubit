/**
 * I-318 — the overlay draws what THIS sheet shows, in this sheet's own coordinates.
 *
 * The staged partition of the other overlay suites is read on model space, where a view's box, its
 * axes' stored positions and its rings are all one coordinate space. A paper sheet is not: F-RCC6-BNBC's
 * S-10 COLUMN LAYOUT PLAN shows ONE of its drawing's 54 views through a window, and its partition holds
 * 77 axes — 66 of them of views on other sheets, every stored position a model coordinate
 * (1,200,000 …; -400,000 …; 0 …). Drawn across the camera's visible box, those were the dash-dot lines
 * the owner would have opened S-10 to. The shapes below are that sheet's, taken from its own feed:
 * the paper extents, the on-sheet view's paper box, two of its rings as the window shows them, and
 * the stored positions beside them.
 *
 * Pure: `overlayScene` needs no canvas and no store, so this suite stands in the unit lane. Every
 * screen quantity is judged through the viewer's own `worldAt`, never a transcribed pixel (B-17).
 */
import { describe, expect, test } from "vitest";
import { fitCamera, worldAt } from "../../../src/modules/takeoff/viewer/client";
import { overlayScene, sceneCounts } from "../../../src/modules/takeoff/viewer-partition-overlay/scene";
import type { PartitionOverlay, PartitionOverlayAxis, PartitionOverlayView } from "../../../src/modules/takeoff/viewer-partition-overlay/types";

/** S-10's drawn extents on its A1 paper, and the stage it is fitted into at 1440 × 900. */
const S10_EXTENTS = { min: [10, 10] as const, max: [831, 584] as const };
const STAGE = { width: 1080, height: 756 };

/** How closely a world quantity mapped to the screen and back must agree. */
const PLACES = 6;

/** One view, in the feed's shape. */
function view(viewKey: string, type: string, box: PartitionOverlayView["box"]): PartitionOverlayView {
  return { viewKey, type, reason: null, caption: "", anchorKey: null, proposed: null, confirmed: null, entityCount: 1, box } as unknown as PartitionOverlayView;
}

/** One stored axis, in the feed's shape: the grid row and the ring the sheet shows, or none. */
function axis(viewKey: string, label: string, along: "x" | "y", position: number, bubble: PartitionOverlayAxis["bubble"]): PartitionOverlayAxis {
  return {
    viewKey,
    label,
    family: along === "x" ? "numeral" : "letter",
    axis: along,
    position,
    bubbleKey: `DXF_HANDLE:${viewKey}-${label}`,
    labelKey: `DXF_HANDLE:${viewKey}-${label}-t`,
    minSpacing: 1,
    bubble,
  } as unknown as PartitionOverlayAxis;
}

/** The on-sheet view S-10 shows, with its paper box as the feed answered it. */
const PLAN = "LAYOUT_PLAN:DXF_HANDLE:20B6";
const PLAN_BOX = { min: [133.892, 180.752] as const, max: [402.108, 420.788] as const };

/** A view of the same drawing that stands on another sheet: no box here. */
const ELSEWHERE = "DETAIL:DXF_HANDLE:1B04";

/** S-10's overlay, cut to what the rule is about: one view here, one elsewhere, two axes of each. */
function s10(): PartitionOverlay {
  return {
    ingestId: "11111111-1111-4111-8111-111111111111",
    views: [view(PLAN, "LAYOUT_PLAN", PLAN_BOX), view(ELSEWHERE, "DETAIL", null)],
    axes: [
      // Stored in model millimetres; the window shows their rings on the paper.
      axis(PLAN, "1", "x", 1_200_000.000000001, { centre: [175.892, 408.248], radius: 5.0006 }),
      axis(PLAN, "A", "y", -400_000.00000000006, { centre: [148.892, 222.752], radius: 5.0006 }),
      // Of a view this sheet does not show: model coordinates the paper does not have.
      axis(ELSEWHERE, "1", "x", 0, null),
      axis(ELSEWHERE, "A", "y", 4_876.8, null),
    ],
    deferrals: [],
  } as unknown as PartitionOverlay;
}

const ON = { views: true, grid: true };
const camera = fitCamera(S10_EXTENTS, STAGE);

/** A drawn segment's two ends, back in the sheet's own coordinates. */
function worldEnds(drawn: { from: readonly [number, number]; to: readonly [number, number] }): [[number, number], [number, number]] {
  return [worldAt(camera, { x: drawn.from[0], y: drawn.from[1] }), worldAt(camera, { x: drawn.to[0], y: drawn.to[1] })];
}

describe("I-318: the overlay's axes stand where this sheet shows them", () => {
  test("I-318: an axis of a view that stands on no box of this sheet is not drawn at all", () => {
    const scene = overlayScene(s10(), ON, camera);
    expect(scene.axes.map((drawn) => drawn.viewKey), "only the axes of the view this sheet shows are drawn").toEqual([PLAN, PLAN]);
    expect(sceneCounts(scene).axes, "and the canvas counts what it drew, not what the drawing stores").toBe(2);
  });

  test("I-318: an axis whose ring this sheet shows runs through that ring's centre, across its view's box", () => {
    const scene = overlayScene(s10(), ON, camera);
    const stored = s10().axes.filter((row) => row.viewKey === PLAN);
    for (const [at, row] of stored.entries()) {
      const drawn = scene.axes[at] as (typeof scene.axes)[number];
      const [from, to] = worldEnds(drawn);
      const along = row.axis === "x" ? 0 : 1;
      const across = row.axis === "x" ? 1 : 0;
      const ring = (row.bubble as { centre: readonly [number, number] }).centre;
      expect(from[along], `${row.label} stands at its ring's centre as the window shows it — not at the model position ${row.position}`).toBeCloseTo(ring[along], PLACES);
      expect(to[along], `${row.label} stays there along its whole length`).toBeCloseTo(ring[along], PLACES);
      expect(Math.min(from[across], to[across]), `${row.label} runs through its view's box`).toBeLessThanOrEqual(PLAN_BOX.min[across]);
      expect(Math.max(from[across], to[across]), `${row.label} runs through its view's box`).toBeGreaterThanOrEqual(PLAN_BOX.max[across]);
    }
  });

  test("I-318: nothing the overlay draws on S-10 falls outside the sheet — no stray centre line crosses the canvas", () => {
    const scene = overlayScene(s10(), ON, camera);
    for (const drawn of scene.axes) {
      for (const end of worldEnds(drawn)) {
        expect(end[0], `${drawn.viewKey} ${drawn.label} stays on the paper in x`).toBeGreaterThanOrEqual(S10_EXTENTS.min[0]);
        expect(end[0], `${drawn.viewKey} ${drawn.label} stays on the paper in x`).toBeLessThanOrEqual(S10_EXTENTS.max[0]);
        expect(end[1], `${drawn.viewKey} ${drawn.label} stays on the paper in y`).toBeGreaterThanOrEqual(S10_EXTENTS.min[1]);
        expect(end[1], `${drawn.viewKey} ${drawn.label} stays on the paper in y`).toBeLessThanOrEqual(S10_EXTENTS.max[1]);
      }
    }
  });

  test("I-318: where this sheet shows no ring of an axis, the stored position is all there is, and stands", () => {
    const plan = view("plan-1", "LAYOUT_PLAN", { min: [0, -100], max: [200, 0] });
    const unringed = axis("plan-1", "B", "x", 60, null);
    const scene = overlayScene({ ingestId: "i", views: [plan], axes: [unringed], deferrals: [] } as unknown as PartitionOverlay, ON, fitCamera({ min: [-100, -200], max: [900, 100] }, STAGE));
    const drawn = scene.axes[0] as (typeof scene.axes)[number];
    const back = worldAt(fitCamera({ min: [-100, -200], max: [900, 100] }, STAGE), { x: drawn.from[0], y: drawn.from[1] });
    expect(back[0], "the axis is drawn at the position the store holds").toBeCloseTo(60, PLACES);
  });
});

describe("R-UI-082: the chip at a view's corner says its type in a reader's words", () => {
  test("R-UI-082: a label the screen hands in is the chip's words; the stored spelling stays the outline's type", () => {
    const words = new Map([["LAYOUT_PLAN", "Layout plan"]]);
    const [outline] = overlayScene(s10(), ON, camera, undefined, words).outlines;
    expect(outline?.label, "the chip says the words the screen's one rule gave").toBe("Layout plan");
    expect(outline?.type, "while the outline keeps the stored spelling its counts and hatch are judged by").toBe("LAYOUT_PLAN");
  });

  test("R-UI-082: with no words handed in, the chip says the stored spelling rather than nothing", () => {
    const [outline] = overlayScene(s10(), ON, camera).outlines;
    expect(outline?.label, "a mount with no screen around it says the stored spelling").toBe("LAYOUT_PLAN");
  });
});

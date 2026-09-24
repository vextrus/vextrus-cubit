// @vitest-environment jsdom
/**
 * Walk 2 BD-1 (I-661) — the drawing and the views/grid overlay are one camera.
 *
 * On S-10 opened by ⌘K "C2", the drawing was projected through the camera's box while the overlay
 * swapped in its own canvas's box: the two layers answered one centre and one scale in two boxes, and
 * the overlay's bubbles stood between the drawn grid lines. The overlay now projects the camera it is
 * handed, box and all — the camera the drawing and the pointer read — and sizes only its backing
 * store by its own canvas.
 *
 * The paint is judged on a recording 2D context: where it was asked to ring each bubble.
 */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { useOverlayPaint } from "../../../src/modules/takeoff/viewer-partition-overlay/use-partition-overlay";
import { screenAt } from "../../../src/modules/takeoff/viewer-partition-overlay/scene";
import type { PartitionOverlay, PartitionOverlayAxis, PartitionOverlayView } from "../../../src/modules/takeoff/viewer-partition-overlay/types";
import type { Camera } from "../../../src/modules/takeoff/viewer/types";

/** S-10's plan view and two of its bubbles, as the feed answers them (overlay-craft's shapes). */
const PLAN = "LAYOUT_PLAN:DXF_HANDLE:20B6";
const PLAN_BOX = { min: [133.892, 180.752] as const, max: [402.108, 420.788] as const };
const RING = 5.0006;

function axis(label: string, along: "x" | "y", centre: readonly [number, number]): PartitionOverlayAxis {
  return { viewKey: PLAN, label, family: along === "x" ? "numeral" : "letter", axis: along, position: 0, bubbleKey: `B-${label}`, labelKey: `L-${label}`, minSpacing: 2743.2, bubble: { centre, radius: RING } } as unknown as PartitionOverlayAxis;
}

const OVERLAY = {
  ingestId: "11111111-1111-4111-8111-111111111111",
  views: [{ viewKey: PLAN, type: "LAYOUT_PLAN", reason: null, caption: "COLUMN LAYOUT PLAN", anchorKey: null, proposed: null, confirmed: null, entityCount: 93, box: PLAN_BOX } as unknown as PartitionOverlayView],
  axes: [axis("1", "x", [175.892, 408.248]), axis("A", "y", [148.892, 222.752])],
  deferrals: [],
} as unknown as PartitionOverlay;

/** The camera the drawing is drawn at: S-10 zoomed on its plan, in the 864 × 804 the inspector leaves. */
const CAMERA: Camera = { centre: [268, 300], scale: 2.4, viewport: { width: 864, height: 804 } };

type Call = { readonly name: string; readonly args: readonly unknown[] };

/** A 2D context that records every call it is asked to make. */
function recordingContext(): { context: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const state: Record<string, unknown> = { font: "12px mono" };
  const target = { measureText: (text: string) => ({ width: text.length * 7 }) };
  const context = new Proxy(target, {
    get(held, key: string) {
      if (key in held) return (held as Record<string, unknown>)[key];
      if (key in state) return state[key];
      return (...args: unknown[]) => calls.push({ name: key, args });
    },
    set(_held, key: string, value: unknown) {
      state[key] = value;
      return true;
    },
  });
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

/** A canvas laid out at this box, painting into a recording context. */
function canvasAt(box: { width: number; height: number }, context: CanvasRenderingContext2D): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "clientWidth", { value: box.width });
  Object.defineProperty(canvas, "clientHeight", { value: box.height });
  canvas.getContext = (() => context) as unknown as HTMLCanvasElement["getContext"];
  return canvas;
}

afterEach(() => cleanup());

describe("BD-1: the overlay projects the camera the drawing is drawn at", () => {
  test("a canvas whose own box differs from the camera's still rings each bubble where the camera puts it", () => {
    const { context, calls } = recordingContext();
    // The box the overlay's canvas last measured is not the camera's: the frame the walk caught, where
    // the canvas had narrowed and the drawing's camera was the one every other layer read.
    const canvas = canvasAt({ width: 1184, height: 804 }, context);
    const stage = document.createElement("div");
    const { result } = renderHook(() => useOverlayPaint({ canvasRef: { current: canvas }, stageRef: { current: stage }, cameraRef: { current: null }, overlay: OVERLAY, toggles: { views: false, grid: true } }));

    result.current.paintOverlay(CAMERA);

    const rings = calls.filter((call) => call.name === "arc").map((call) => [call.args[0], call.args[1]]);
    expect(rings, "each bubble is ringed where the camera the drawing is drawn at puts its drawn ring").toEqual(OVERLAY.axes.map((row) => screenAt(CAMERA, row.bubble?.centre ?? [0, 0])));
  });
});

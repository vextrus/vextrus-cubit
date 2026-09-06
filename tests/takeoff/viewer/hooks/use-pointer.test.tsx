// @vitest-environment jsdom
/**
 * The pointer over the sheet (Decision § 5): a drag pans live, a still pointer reads what is under it
 * one question at a time, a Shift rectangle takes what it covers, a click of no travel takes the
 * topmost hit, and a click on bare paper lets go — while a click on ink a reader may see and may not
 * select does not punish them for pressing it (I-87).
 *
 * Where a pan takes the camera is `panCamera`'s own answer, never a camera transcribed here (B-19).
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { panCamera } from "../../../../src/modules/takeoff/viewer/client";
import type { Camera } from "../../../../src/modules/takeoff/viewer/types";
import { createSheetFacts, learn } from "../../../../src/modules/takeoff/viewer/hooks/facts";
import { usePointer } from "../../../../src/modules/takeoff/viewer/hooks/use-pointer";
import { layerOf, sheetHead, sourceKey } from "./hook-support";

const HELD_KEY = sourceKey("1A");
const CAMERA: Camera = { centre: [200, 100], scale: 1, viewport: { width: 800, height: 600 } };
const head = sheetHead([layerOf("GRID")]);

/** Far enough to be a pan or a rectangle rather than a click (Decision § 5's travel). */
const TRAVEL_PX = 40;

let facts: ReturnType<typeof createSheetFacts>;
let keysUnder: ReturnType<typeof vi.fn>;
let ask: ReturnType<typeof vi.fn>;
let hold: ReturnType<typeof vi.fn>;
let toggleKey: ReturnType<typeof vi.fn>;
let moveCamera: ReturnType<typeof vi.fn>;
let captured: number[];

/** The canvas as a gesture meets it: the box it occupies, and the capture calls a pointer makes. */
function canvas() {
  return {
    getBoundingClientRect: () => ({ width: 800, height: 600, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 600, toJSON: () => ({}) }),
    setPointerCapture: (id: number) => void captured.push(id),
    hasPointerCapture: () => true,
    releasePointerCapture: (id: number) => void captured.splice(captured.indexOf(id), 1),
  };
}

/** One pointer event as React hands it over, carrying only what the hook reads of it. */
function at(x: number, y: number, shiftKey = false): ReactPointerEvent<HTMLCanvasElement> {
  const event = { clientX: x, clientY: y, pointerId: 1, shiftKey, currentTarget: canvas() };
  return event as unknown as ReactPointerEvent<HTMLCanvasElement>;
}

function mount() {
  return renderHook(() =>
    usePointer({
      head,
      cameraRef: { current: CAMERA },
      facts,
      keysUnder,
      ask,
      openLayers: () => ["GRID"],
      hold,
      toggleKey,
      moveCamera,
    }),
  );
}

beforeEach(() => {
  facts = createSheetFacts();
  learn(facts, layerOf("GRID", [{ key: HELD_KEY, type: "LINE", rgb: [1, 2, 3], points: [[0, 0] as [number, number], [10, 10] as [number, number]] }]));
  keysUnder = vi.fn(async () => []);
  ask = vi.fn(async () => []);
  hold = vi.fn();
  toggleKey = vi.fn();
  moveCamera = vi.fn();
  captured = [];
});

afterEach(() => {
  cleanup();
});

describe("usePointer: a gesture is not a render", () => {
  test("a drag pans the camera live, by the seam's own arithmetic", () => {
    const { result } = mount();

    result.current.onPointerDown(at(100, 100));
    result.current.onPointerMove(at(100 + TRAVEL_PX, 100));

    expect(captured, "the gesture holds the pointer until it is over").toEqual([1]);
    const move = moveCamera.mock.calls.at(-1)?.[0] as (held: Camera) => Camera;
    expect(move(CAMERA), "the sheet travels under the pointer, not away from it").toEqual(panCamera(CAMERA, -TRAVEL_PX, 0));
    expect(moveCamera.mock.calls.at(-1)?.[1], "a pan in flight draws every frame and writes no address (PB-3)").toBe(true);
  });

  test("a still pointer reads what is under it, one question at a time", async () => {
    keysUnder.mockResolvedValue([HELD_KEY]);
    const { result } = mount();

    await act(async () => {
      result.current.onPointerMove(at(300, 200));
    });

    expect(keysUnder, "what is under the pointer is asked of the index").toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.hovered?.key, "and what it found is what the inspector shows").toBe(HELD_KEY));
    expect(result.current.hovered?.layer, "with the layer the sheet learned it on").toBe("GRID");

    act(() => result.current.clearHover());
    expect(result.current.hovered, "a pointer that left the sheet reads nothing").toBeNull();
  });

  test("a Shift rectangle takes what it covers, and holds only keys this sheet knows", async () => {
    ask.mockResolvedValue([HELD_KEY, sourceKey("FFFF")]);
    const { result } = mount();

    act(() => result.current.onPointerDown(at(100, 100, true)));
    expect(result.current.marqueeOn, "the rectangle is on screen while it is being drawn").toBe(true);

    // The rectangle is written straight onto its element rather than rendered: sixty renders a
    // second of the panel and the readout is what a marquee must not cost (PB-3).
    const element = document.createElement("div");
    result.current.marqueeRef.current = element;
    result.current.onPointerMove(at(100 + TRAVEL_PX, 100 + TRAVEL_PX, true));
    expect(
      [element.style.left, element.style.top, element.style.width, element.style.height],
      "and it is the box the pointer swept, in stage pixels",
    ).toEqual(["100px", "100px", `${TRAVEL_PX}px`, `${TRAVEL_PX}px`]);

    await act(async () => {
      result.current.onPointerUp(at(100 + TRAVEL_PX, 100 + TRAVEL_PX, true));
    });

    expect(ask.mock.calls.at(-1)?.[0], "a rectangle asks the index for a world box, over the layers a reader can take from").toMatchObject({
      kind: "rect",
      layers: ["GRID"],
    });
    expect(hold, "and holds only the keys this sheet has met").toHaveBeenCalledWith([HELD_KEY]);
    expect(result.current.marqueeOn, "and the rectangle is gone once the gesture is over").toBe(false);
  });

  test("a click takes the topmost hit; bare paper clears, and ink a reader may not take does not", async () => {
    keysUnder.mockResolvedValue([HELD_KEY]);
    const { result } = mount();

    result.current.onPointerDown(at(100, 100));
    await act(async () => {
      result.current.onPointerUp(at(100, 100));
    });
    expect(hold, "a click of no travel takes what is under it").toHaveBeenCalledWith([HELD_KEY]);

    // Nothing may be taken here — but a locked layer is painted, so asking again without the
    // reader's own posture says whether they pressed on ink or on bare paper (I-87).
    hold.mockClear();
    keysUnder.mockImplementation(async (_world: [number, number], takeable = true) => (takeable ? [] : [HELD_KEY]));
    result.current.onPointerDown(at(200, 200));
    await act(async () => {
      result.current.onPointerUp(at(200, 200));
    });
    expect(hold, "a press on geometry a reader can see does not punish them by letting go").not.toHaveBeenCalled();

    keysUnder.mockResolvedValue([]);
    result.current.onPointerDown(at(300, 300));
    await act(async () => {
      result.current.onPointerUp(at(300, 300));
    });
    expect(hold, "only bare paper clears").toHaveBeenCalledWith([]);
  });
});

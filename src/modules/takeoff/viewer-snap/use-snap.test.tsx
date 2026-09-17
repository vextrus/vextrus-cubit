// @vitest-environment jsdom
// What a gesture wrote between renders survives the next render (I-145, I-147, PB-3).
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSnap } from "./use-snap";

describe("useSnap", () => {
  it("keeps the live point a hover left in the ref when a render arrives with nothing new to say", () => {
    // A hover over bare paper changes nothing a reader can read, so it sets no state: the point it
    // met lives in the ref alone until the next gesture. A render that copied the rendered state back
    // over the ref would take that point away, and the pick below would be taken nowhere.
    const { result, rerender } = renderHook((props: { camera: null; calibrationUnread: boolean }) => useSnap(props), {
      initialProps: { camera: null, calibrationUnread: false },
    });

    act(() => {
      result.current.onHover([5, 7]);
    });
    rerender({ camera: null, calibrationUnread: true });

    act(() => {
      result.current.takePick();
    });
    expect(result.current.picks.map((pick) => pick.point), "the pick stands where the pointer stood, not where the last render left it").toEqual([[5, 7]]);
  });

  it("carries a field the render itself moved", () => {
    const { result } = renderHook(() => useSnap({ camera: null }));
    expect(result.current.enabled, "snapping is on until a reader turns it off").toBe(true);

    act(() => {
      result.current.toggleSnapping();
    });
    expect(result.current.enabled, "and the toggle is a state the render publishes").toBe(false);

    act(() => {
      result.current.onHover([1, 1]);
      result.current.takePick();
      result.current.clearPicks();
    });
    expect(result.current.picks, "what the gestures did is published too — the ref and the render say one thing").toEqual([]);
  });
});

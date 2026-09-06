// @vitest-environment jsdom
/**
 * The one object a hook reads a handed ref through. Two things have to be true of it at once: what
 * it reads and writes is always the caller's own ref — one sheet has one camera, one stage, one
 * painter (B-17) — and its own identity never changes, because a caller may spell the ref inline in
 * its render, and an effect keyed on a new object every render is an effect that never stops.
 */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { useHandedRef } from "../../../../src/modules/takeoff/viewer/hooks/use-handed-ref";

afterEach(() => {
  cleanup();
});

describe("useHandedRef: one stable object over the ref a caller handed in", () => {
  test("the handed ref stays the one home: reads come from it, and writes land on it", () => {
    const handed = { current: "opened at" };
    const { result } = renderHook(() => useHandedRef(handed, "nowhere"));

    expect(result.current.current, "what the caller holds is what the hook reads").toBe("opened at");

    handed.current = "moved to";
    expect(result.current.current, "including a value the caller wrote after the mount").toBe("moved to");

    result.current.current = "written by the hook";
    expect(handed.current, "and a value the hook writes is the caller's own, not a copy of it").toBe("written by the hook");
  });

  test("a ref spelled fresh on every render is held behind one object that never changes identity", () => {
    const stage = { current: "the stage" };
    const held: unknown[] = [];
    const { result, rerender } = renderHook(() => {
      // Exactly what a caller writing `stageRef: { current: stage }` in its render hands over.
      const ref = useHandedRef({ current: stage.current }, "");
      held.push(ref);
      return ref;
    });

    rerender();
    rerender();

    expect(held.length, "the mount rendered more than once, so there is an identity to compare").toBeGreaterThan(1);
    expect(new Set(held).size, "a dependency keyed on this object is keyed on one object").toBe(1);

    stage.current = "the stage, resized";
    rerender();
    expect(result.current.current, "while what it reads is always the newest ref it was handed").toBe("the stage, resized");
  });

  test("handed nothing, it keeps its own value from the initial it was given", () => {
    const { result } = renderHook(() => useHandedRef<string | null>(undefined, null));

    expect(result.current.current, "a mount that hands no ref in starts at the initial").toBeNull();

    result.current.current = "its own";
    expect(result.current.current, "and what it writes it keeps").toBe("its own");
  });
});

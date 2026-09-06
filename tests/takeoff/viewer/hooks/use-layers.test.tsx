// @vitest-environment jsdom
/**
 * The layer posture as a hook: one row per layer of the roster, what each toggle does to what is
 * drawn, which layers a hit-test may take from, and a failure that survives the head being rebuilt
 * around it (I-81).
 *
 * Nothing here transcribes a posture: every expectation is derived from this file's own roster, so a
 * sheet with another layer in it grows the expectation with it (B-19).
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { useLayers } from "../../../../src/modules/takeoff/viewer/hooks/use-layers";
import type { ViewerHead } from "../../../../src/modules/takeoff/viewer/types";
import { layerOf, sheetHead } from "./hook-support";

/** The sheet these mounts are made of: three layers, so isolation has something to leave out. */
const ROSTER = ["GRID", "WALLS", "TEXT"] as const;

const head = sheetHead(ROSTER.map((name) => layerOf(name)));

/** The names of the rows a reading of the posture says are painted right now. */
function drawn(rows: readonly { name: string; drawn: boolean }[]): string[] {
  return rows.filter((row) => row.drawn).map((row) => row.name);
}

afterEach(() => {
  cleanup();
});

describe("useLayers: the posture the panel shows and the painter obeys", () => {
  test("a mounted roster is one row per layer, all of them drawn and none of them failed", () => {
    const { result } = renderHook(() => useLayers({ head }));

    expect(result.current.rows.map((row) => row.name), "the panel's rows are the roster, in the manifest's own order").toEqual([...ROSTER]);
    expect(drawn(result.current.rows), "a sheet opens with every layer painted").toEqual([...ROSTER]);
    expect(result.current.drawnLayers, "the one value an effect can be keyed on is those names").toBe(ROSTER.join("\n"));
    expect(result.current.failedCount, "nothing failed on the way in").toBe(0);
    expect(result.current.openLayers(), "and every layer may answer a hit-test").toEqual([...ROSTER]);
  });

  test("hiding a layer takes it out of what is drawn; isolating leaves only one, and again leaves all", () => {
    const [first] = ROSTER;
    const { result } = renderHook(() => useLayers({ head }));

    act(() => result.current.setVisible(first, false));
    expect(drawn(result.current.rows), "a hidden layer is not painted").toEqual(ROSTER.filter((name) => name !== first));

    act(() => result.current.setVisible(first, true));
    act(() => result.current.isolate(first));
    expect(drawn(result.current.rows), "an isolated layer is the only one painted").toEqual([first]);

    act(() => result.current.isolate(first));
    expect(drawn(result.current.rows), "isolating the isolated layer lets the sheet back").toEqual([...ROSTER]);
  });

  test("a locked layer stays painted and stops answering a hit-test (Decision § 1, I-87)", () => {
    const [, second] = ROSTER;
    const { result } = renderHook(() => useLayers({ head }));

    act(() => result.current.setLocked(second, true));

    expect(drawn(result.current.rows), "locking is not hiding: the ink stays on the paper").toEqual([...ROSTER]);
    expect(result.current.openLayers(), "but nothing may be taken from it").toEqual(ROSTER.filter((name) => name !== second));
    expect(result.current.rows.find((row) => row.name === second)?.locked, "and the row says so").toBe(true);
  });

  test("a layer that did not arrive keeps saying so through a head rebuilt around it (I-81)", () => {
    const [, , third] = ROSTER;
    const { result, rerender } = renderHook((props: { head: ViewerHead }) => useLayers(props), { initialProps: { head } });

    act(() => result.current.markFailed(third, true));
    expect(result.current.failedCount, "the failure is counted").toBe(1);
    expect(result.current.rows.find((row) => row.name === third)?.failed, "and it is the row's own news").toBe(true);

    // The posture is remade whenever the head changes; what the feed learned is held outside it.
    rerender({ head: { ...head, cache: "hit" } });
    expect(result.current.rows.find((row) => row.name === third)?.failed, "a rebuilt posture does not forget it").toBe(true);

    act(() => result.current.markFailed(third, false));
    expect(result.current.failedCount, "and a layer that arrived after all stops being missing").toBe(0);
  });
});

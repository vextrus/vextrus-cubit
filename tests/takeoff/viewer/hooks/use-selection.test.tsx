// @vitest-environment jsdom
/**
 * The address's own reading of what is held (R-UI-031, R-UI-050's partial cell): nothing is read back
 * from `s` until the sheet has settled, a key this sheet does not hold is a fact rather than a
 * refusal (I-88), a link that named keys and no camera is flown to, and a gesture is a fresh answer
 * that stops the partial cell reporting on an address the reader has left behind.
 *
 * A roster's last layer can *fail* rather than arrive, so "settled" is counted from both (I-88).
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSheetFacts, learn } from "../../../../src/modules/takeoff/viewer/hooks/facts";
import { useSelection } from "../../../../src/modules/takeoff/viewer/hooks/use-selection";
import { boxOf, layerOf, sheetHead, sourceKey } from "./hook-support";

/** A key this sheet holds, and one an address may name that it does not. */
const HELD_KEY = sourceKey("1A");
const ABSENT_KEY = sourceKey("2B");
/** A value of no key shape at all — the other half of the partial cell (I-88). */
const NONSENSE = "not-a-key";

/** Two layers, so a roster that is one layer short has one still to come. */
const head = sheetHead([layerOf("GRID"), layerOf("WALLS")]);

let facts: ReturnType<typeof createSheetFacts>;
let reveal: ReturnType<typeof vi.fn>;

/** The sheet as it stands once the layer holding the key has arrived. */
function learned() {
  const made = createSheetFacts();
  learn(made, layerOf("GRID", [{ key: HELD_KEY, type: "LINE", rgb: [1, 2, 3], points: [boxOf(10).min, boxOf(10).max] }]));
  return made;
}

/** The mount AC-6's reading is made from: an address naming both keys, one layer still outstanding. */
function mount(initialSelection: string) {
  return renderHook((props: { loadedLayers: number; failedCount: number }) => useSelection({ facts, head, initialSelection, initialViewport: null, reveal, ...props }), {
    initialProps: { loadedLayers: 1, failedCount: 0 },
  });
}

beforeEach(() => {
  facts = learned();
  reveal = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("useSelection: the address is read once the sheet has settled", () => {
  test("a sheet still arriving reads nothing back, and the layer that failed rather than arrived settles it", () => {
    const { result, rerender } = mount([HELD_KEY, ABSENT_KEY].join(","));

    expect(result.current.selection, "a link copied while the sheet was arriving would carry a half-read selection").toEqual([]);
    expect(reveal, "and nothing is flown to before the reading is settled").not.toHaveBeenCalled();

    // The last layer failed rather than arrived: `loadedLayers` never moves again, and the reading
    // would otherwise be met with silence instead of the partial cell (I-88).
    rerender({ loadedLayers: 1, failedCount: 1 });

    expect(result.current.selection, "every key the sheet does hold is held").toEqual([HELD_KEY]);
    expect(result.current.missing, "and the one it does not is news, never a refusal").toEqual([ABSENT_KEY]);
    expect(reveal.mock.calls, "a link that named keys and no camera is flown to, once").toEqual([[[HELD_KEY]]]);
  });

  test("a value that is no key at all lands in the same cell as a key this sheet does not hold", () => {
    const { result, rerender } = mount([NONSENSE, ABSENT_KEY].join(","));
    rerender({ loadedLayers: 2, failedCount: 0 });

    expect(result.current.missing, "both halves of a link that named nothing are reported (I-88)").toEqual([NONSENSE, ABSENT_KEY]);
    expect(result.current.selection, "and nothing is held, because nothing was found").toEqual([]);
    expect(reveal, "a reveal of nothing does not pretend to travel").not.toHaveBeenCalled();
  });

  test("a gesture is a fresh answer: what it holds replaces the reading, and the partial cell empties", () => {
    const { result, rerender } = mount([HELD_KEY, ABSENT_KEY].join(","));
    rerender({ loadedLayers: 1, failedCount: 1 });
    expect(result.current.missing, "the address's reading stands until a reader answers for themselves").toEqual([ABSENT_KEY]);

    act(() => result.current.hold([HELD_KEY]));
    expect(result.current.selection, "what the reader picked is what is held").toEqual([HELD_KEY]);
    expect(result.current.missing, "and the partial cell reported on an address this no longer is").toEqual([]);

    act(() => result.current.toggleKey(HELD_KEY));
    expect(result.current.selection, "Shift on a held key takes it out again").toEqual([]);

    act(() => result.current.toggleKey(HELD_KEY));
    expect(result.current.selection, "and Shift on one that is not held adds it").toEqual([HELD_KEY]);
  });

  test("an address that named no keys reads as no selection and no news", () => {
    const { result } = mount("");

    expect(result.current.selection, "an address without `s` holds nothing").toEqual([]);
    expect(result.current.missing, "and has nothing to report about it").toEqual([]);
    expect(reveal, "nor anywhere to fly").not.toHaveBeenCalled();
  });
});

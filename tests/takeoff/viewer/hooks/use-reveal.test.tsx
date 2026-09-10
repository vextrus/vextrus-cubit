// @vitest-environment jsdom
/**
 * The Trace's target (R-UI-022, Decision § 4): the camera travels to the frame that holds everything
 * named and is struck once on arrival, a reveal of keys this sheet does not hold has nowhere to go,
 * and a second reveal cancels the first rather than fighting it for the camera.
 *
 * Where the travel lands is `revealCamera`'s own answer for the union of the boxes, never a camera
 * transcribed here (B-17, B-19).
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { revealCamera } from "../../../../src/modules/takeoff/viewer-inspector/flyto";
import { unionBox } from "../../../../src/modules/takeoff/viewer-inspector/selection";
import { createSheetFacts, learn } from "../../../../src/modules/takeoff/viewer/hooks/facts";
import { useReveal } from "../../../../src/modules/takeoff/viewer/hooks/use-reveal";
import { layerOf, sheetHead, sourceKey } from "./hook-support";

const HELD_KEY = sourceKey("1A");
const ABSENT_KEY = sourceKey("2B");
const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
/** The world box the held key paints over — what the travel is framed on. */
const PAINTED = { min: [10, 20] as [number, number], max: [110, 90] as [number, number] };

const head = sheetHead([layerOf("GRID")]);

let facts: ReturnType<typeof createSheetFacts>;
let jumpTo: ReturnType<typeof vi.fn>;
let pulse: ReturnType<typeof vi.fn>;
let stage: HTMLDivElement;

function mount() {
  return renderHook(() => useReveal({ head, stageRef: { current: stage }, facts, jumpTo, pulse }));
}

/** Where a reveal of the held key must land — the seam's own answer for this box and this stage. */
function landing() {
  return revealCamera(unionBox([PAINTED]) ?? PAINTED, { width: STAGE_WIDTH, height: STAGE_HEIGHT });
}

beforeEach(() => {
  facts = createSheetFacts();
  learn(facts, layerOf("GRID", [{ key: HELD_KEY, type: "LINE", rgb: [1, 2, 3], points: [PAINTED.min, PAINTED.max] }]));
  jumpTo = vi.fn();
  pulse = vi.fn();
  stage = document.createElement("div");
  document.body.append(stage);
  // jsdom lays nothing out, so the box the travel is framed into is stated here.
  stage.getBoundingClientRect = () =>
    ({ width: STAGE_WIDTH, height: STAGE_HEIGHT, x: 0, y: 0, top: 0, left: 0, right: STAGE_WIDTH, bottom: STAGE_HEIGHT, toJSON: () => ({}) }) as DOMRect;
});

afterEach(() => {
  cleanup();
  stage.remove();
});

describe("useReveal: one travel, to the frame that holds what was named", () => {
  test("a reveal travels, lands on the seam's own camera for that frame, and is struck once", async () => {
    const { result } = mount();

    act(() => result.current.reveal([HELD_KEY]));
    expect(result.current.flyto, "the travel is announced while it is in flight (I-85)").toBe("flying");

    await waitFor(() => expect(result.current.flyto, "and settles when it arrives").toBe("settled"));
    expect(jumpTo, "the camera lands where the frame that holds the key is").toHaveBeenCalledWith(landing());
    expect(pulse, "and the arrival is struck once, over the travel's own duration").toHaveBeenCalledTimes(1);
    expect(pulse.mock.calls[0]?.[0], "which is a duration, not a guess").toBeGreaterThan(0);
  });

  test("a reveal of keys this sheet does not hold has nowhere to go and does not pretend to travel", () => {
    const { result } = mount();

    result.current.reveal([ABSENT_KEY]);
    result.current.reveal([]);

    expect(result.current.flyto, "nothing selected is not a journey, so `data-flyto` is never written").toBeNull();
    expect(jumpTo, "and no camera is moved on its behalf").not.toHaveBeenCalled();
  });

  test("a sheet with no manifest under it reveals nothing", () => {
    const { result } = renderHook(() => useReveal({ head: { kind: "absent", reason: "not-ingested" }, stageRef: { current: stage }, facts, jumpTo, pulse }));

    result.current.reveal([HELD_KEY]);

    expect(jumpTo, "a drawing nobody has read has no frame to travel to").not.toHaveBeenCalled();
    expect(result.current.flyto, "and says nothing about a travel it did not make").toBeNull();
  });
});

/**
 * AC-4 (inc-215-trace) — the Trace strikes the arrival in the basis of the number that was traced.
 *
 * The pulse's colour is a token, read from the stage exactly as the travel's duration already is
 * (B-17: one home for token reads, never a hex in a hook). `reveal` is therefore told WHICH basis,
 * not which colour: `reveal(keys, basis)`, and the hook spends `var(--basis-<basis lowercased>)`.
 *
 * `reveal` is cast at the call site because today's signature takes keys alone — the widening is the
 * missing feature this reports, and a second argument written bare would be a type error of this
 * file's own rather than a red of the product's.
 */
type Reveals = (keys: readonly string[], basis: string) => void;

/**
 * What `--basis-measured` is set to for this mount. It is deliberately NOT a colour literal — the
 * lane forbids one outside `src/ui/tokens.ts` (R-UI-001), and a colour is not what is being judged:
 * what is judged is that the hook hands `pulse` whatever the token computes to, verbatim.
 */
const BASIS_MEASURED = "the-computed-value-of-basis-measured";

describe("AC-4: the pulse is struck in the traced line's basis colour", () => {
  test("AC-4: pulse(durationMs, colour) takes `--motion-flyto` and `var(--basis-measured)`", async () => {
    stage.style.setProperty("--motion-flyto", "320ms");
    stage.style.setProperty("--basis-measured", BASIS_MEASURED);
    const { result } = mount();

    act(() => (result.current.reveal as Reveals)([HELD_KEY], "MEASURED"));
    await waitFor(() => expect(result.current.flyto, "the travel settles").toBe("settled"));

    expect(pulse, "the arrival is struck once").toHaveBeenCalledTimes(1);
    expect(pulse.mock.calls[0], "with the travel's own duration and the basis colour, computed from the stage's tokens (AC-4)").toEqual([320, BASIS_MEASURED]);
  });

  test("AC-4: reduced motion zeroes the token at source, and the strike carries the same colour", async () => {
    stage.style.setProperty("--motion-flyto", "0ms");
    stage.style.setProperty("--basis-measured", BASIS_MEASURED);
    const { result } = mount();

    act(() => (result.current.reveal as Reveals)([HELD_KEY], "MEASURED"));
    await waitFor(() => expect(result.current.flyto, "the arrival is instant, not absent").toBe("settled"));

    expect(pulse.mock.calls[0], "zero duration is the token's answer, not a branch in the hook (Decision §4)").toEqual([0, BASIS_MEASURED]);
  });
});

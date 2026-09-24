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
import { READING_TEXT_PX, readingScaleOf, revealCamera } from "../../../../src/modules/takeoff/viewer-inspector/flyto";
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
    expect(result.current.flight, "and the screen can say a fly-to RAN, after the fact and whatever the motion setting").toBe(1);
  });

  test("a reveal of keys this sheet does not hold has nowhere to go and does not pretend to travel", () => {
    const { result } = mount();

    result.current.reveal([ABSENT_KEY]);
    result.current.reveal([]);

    expect(result.current.flyto, "nothing selected is not a journey, so `data-flyto` is never written").toBeNull();
    expect(result.current.flight, "and nothing flew, so the ordinal stands at none").toBe(0);
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

/**
 * B08 (walk 0) — the Trace from S-01's `3000 psi` reading landed at 596.5 px per drawing unit on an
 * empty canvas: the note's box was the one point it was set at, and a point is opened to a 1-unit
 * frame. A text is framed by its lettering, and no closer than its reading size (I-464).
 */
describe("B08: a traced note is framed as a note on its sheet, at a size a reader reads", () => {
  const NOTE_KEY = sourceKey("1F42");
  const NOTE = { key: NOTE_KEY, type: "TEXT", rgb: [255, 255, 255] as [number, number, number], text: "f'c = 3000 psi (BORED PILES)", height: 3.2, anchor: [16, 208] as [number, number] };

  test("the note lands READING_TEXT_PX tall, whole, with its sheet around it", async () => {
    learn(facts, layerOf("Text-1", [NOTE]));
    const { result } = mount();

    act(() => result.current.reveal([NOTE_KEY]));
    await waitFor(() => expect(result.current.flyto, "the travel settles").toBe("settled"));

    const landed = jumpTo.mock.calls[0]?.[0] as { centre: [number, number]; scale: number };
    expect(landed.scale * NOTE.height, "its capitals stand at the reading size — not 596 px per unit").toBeCloseTo(READING_TEXT_PX, 9);
    const box = facts.get(NOTE_KEY)?.box as { min: [number, number]; max: [number, number] };
    const halfWidth = STAGE_WIDTH / 2 / landed.scale;
    const halfHeight = STAGE_HEIGHT / 2 / landed.scale;
    expect(box.min[0], "the whole note is on the stage").toBeGreaterThanOrEqual(landed.centre[0] - halfWidth);
    expect(box.max[0]).toBeLessThanOrEqual(landed.centre[0] + halfWidth);
    expect(box.min[1]).toBeGreaterThanOrEqual(landed.centre[1] - halfHeight);
    expect(box.max[1]).toBeLessThanOrEqual(landed.centre[1] + halfHeight);
    expect((halfWidth * 2) / (box.max[0] - box.min[0]), "and it is found among its sheet: the stage shows well past it").toBeGreaterThan(2);
  });

  test("a selection of geometry alone is framed as before — the reading size stops text, nothing else", async () => {
    const { result } = mount();
    act(() => result.current.reveal([HELD_KEY]));
    await waitFor(() => expect(result.current.flyto).toBe("settled"));
    expect(jumpTo).toHaveBeenCalledWith(landing());
    expect(readingScaleOf(facts.get(HELD_KEY)?.records ?? []), "a line holds no text to read").toBeNull();
  });

  /**
   * The Trace from a member's figure selects the member's outline AND its mark (I-421; J-021 asserts
   * `[outlineKey, markKey]`), and the mark is a TEXT. S-10's column DXF_HANDLE:984 with its mark C1
   * is shaped here: a 4-unit column, its 2-unit mark beside it. Were the mark's reading size to stop
   * the frame, the column would land 24 px wide at 6 px per unit instead of filling the stage.
   */
  test("a member traced with its mark is framed by the pair, as ever — the reading size stops words alone", async () => {
    const COLUMN_KEY = sourceKey("984");
    const MARK_KEY = sourceKey("99E");
    const column = { key: COLUMN_KEY, type: "LWPOLYLINE", rgb: [1, 2, 3] as [number, number, number], closed: true, points: [[300, 400], [304, 400], [304, 404], [300, 404]] as [number, number][] };
    const mark = { key: MARK_KEY, type: "TEXT", rgb: [1, 2, 3] as [number, number, number], text: "C1", height: 2, anchor: [305, 405] as [number, number] };
    learn(facts, layerOf("COLUMN", [column]));
    learn(facts, layerOf("Text-1", [mark]));
    const { result } = mount();

    act(() => result.current.reveal([COLUMN_KEY, MARK_KEY], "MEASURED"));
    await waitFor(() => expect(result.current.flyto).toBe("settled"));

    const boxes = [facts.get(COLUMN_KEY)?.box, facts.get(MARK_KEY)?.box].filter((box) => box !== undefined);
    const framed = revealCamera(unionBox(boxes) ?? PAINTED, { width: STAGE_WIDTH, height: STAGE_HEIGHT });
    expect(jumpTo, "the pair's own frame, with no reading size applied").toHaveBeenCalledWith(framed);
    const readingScale = READING_TEXT_PX / mark.height;
    expect(framed.scale, "which stands far closer than the mark's reading size would have let it").toBeGreaterThan(readingScale * 4);
    expect(readingScaleOf([...(facts.get(COLUMN_KEY)?.records ?? []), ...(facts.get(MARK_KEY)?.records ?? [])]), "geometry among the records: no cap").toBeNull();
    expect(readingScaleOf(facts.get(MARK_KEY)?.records ?? []), "the mark alone is still a note to read").toBeCloseTo(readingScale, 9);
  });
});

/**
 * Walk 2 BD-1 (I-661): ⌘K "C2" opens S-10 with the eight C2 columns held, and the held
 * selection opens the inspector, which takes 320 px of the canvas WHILE the travel is in flight. A
 * landing framed in the box the travel was asked in (1184 wide) was drawn into the 864 the canvas
 * then had: the sheet squeezed sideways, its grid circles tall ovals. The landing is framed in the
 * box the stage stands at when it lands.
 */
describe("BD-1: a travel lands framed in the box the stage has when it lands", () => {
  test("the inspector opening mid-flight: the landing is the frame for the narrower stage, not the wider one", async () => {
    const WIDE = { width: 1184, height: 804 };
    const NARROW = { width: 864, height: 804 };
    const standAt = (box: { width: number; height: number }): void => {
      stage.getBoundingClientRect = () => ({ ...box, x: 0, y: 0, top: 0, left: 0, right: box.width, bottom: box.height, toJSON: () => ({}) }) as DOMRect;
    };
    standAt(WIDE);
    stage.style.setProperty("--motion-flyto", "60ms");
    const { result } = mount();

    act(() => result.current.reveal([HELD_KEY]));
    expect(result.current.flyto, "the travel is in flight").toBe("flying");
    standAt(NARROW);
    await waitFor(() => expect(result.current.flyto, "and lands").toBe("settled"));

    const union = unionBox([PAINTED]) ?? PAINTED;
    expect(jumpTo, "the frame the canvas now has").toHaveBeenCalledWith(revealCamera(union, NARROW));
    expect(jumpTo, "never the one it had when the Trace was asked").not.toHaveBeenCalledWith(revealCamera(union, WIDE));
  });
});

// @vitest-environment jsdom
/**
 * AC-4 — the camera and the settle it publishes on: a sheet opens fitted to the box it is drawn
 * into, a live gesture draws every frame and writes the address once it goes quiet, a discrete move
 * writes it at once, and a flush inside the settle window writes what is held now rather than losing
 * it to a timer that may never fire.
 *
 * The fitted camera is not transcribed: it is `fitCamera`'s own answer for the extents and the box
 * this mount measures (B-17), so a change to the fit is a change to both sides at once.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { VIEWER_CLIENT_MODULE, productModule } from "../support/viewer-support";

/** The module AC-2 names for this concern, and the settle AC-4 names on it. */
const USE_CAMERA_MODULE = "src/modules/takeoff/viewer/hooks/use-camera.ts";

/** The settle AC-4 states, in milliseconds — the figure the hook publishes is judged against it. */
const SETTLE_MS = 150;

/** The box the stage measures in this mount, and the sheet the head carries. */
const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
const EXTENTS = { min: [0, 0], max: [400, 200] };

/** How far a move takes the camera, in drawing units — far enough that no two cameras compare equal. */
const MOVE_WORLD = 25;

type Camera = { centre: [number, number]; scale: number; viewport: { width: number; height: number } };
type CameraHook = {
  ADDRESS_SETTLE_MS: number;
  MIN_FIT_STAGE_PX: number;
  useCamera: (options: {
    head: unknown;
    initialViewport: string | null;
    stageRef: { current: HTMLElement | null };
    draw: (camera: Camera) => void;
    publish: (camera: Camera) => void;
  }) => {
    camera: Camera | null;
    moveCamera: (move: (held: Camera) => Camera, live: boolean) => void;
    jumpTo: (at: Camera) => void;
    fitSheet: () => void;
    flushAddress: () => void;
  };
};

let useCamera: CameraHook["useCamera"];
let ADDRESS_SETTLE_MS: number;
let MIN_FIT_STAGE_PX: number;
let fitCamera: (extents: unknown, viewportPx: { width: number; height: number }) => Camera;
let cameraFromViewport: (viewport: { x: number; y: number; scale: number }, viewportPx: { width: number; height: number }) => Camera;
let parseViewport: (value: string) => { x: number; y: number; scale: number } | null;
let draw: ReturnType<typeof vi.fn>;
let publish: ReturnType<typeof vi.fn>;
let stage: HTMLDivElement;

/** The head a sheet with these extents is opened from: a manifest, which is all a camera reads of one. */
function headOf(extents: { min: number[]; max: number[] }) {
  return {
    kind: "manifest",
    cache: "miss",
    facts: {},
    manifest: {
      version: 1,
      layoutName: "SHEET ONE",
      extents,
      insunits: { code: 0, unit: null, unmapped: true },
      digest: "sheet-one",
      layers: [],
    },
  };
}

/** The head this sheet is opened from. */
const head = headOf(EXTENTS);

/**
 * F-RCC6-BNBC's S-10 COLUMN LAYOUT PLAN as the diagnosis measured it (I-317): an A1 paper sheet whose
 * drawn extents run 10..831 by 10..584, a stage measured at 60 × 788 while the frame's resizable
 * panels had not laid out, and the 1080 × 756 it stood at 32 ms later. Pressing F there gave 1.2097
 * pixels per unit; the open gave 0.0674 and wrote it to the address.
 */
const S10_EXTENTS = { min: [10, 10], max: [831, 584] };
const UNLAID_STAGE = { width: 60, height: 788 };
const LAID_STAGE = { width: 1080, height: 756 };
const S10_FITTED_SCALE = 1.21;

/** The stage's measured box, stated — jsdom lays nothing out. */
function measure(box: { width: number; height: number }): void {
  stage.getBoundingClientRect = () =>
    ({ width: box.width, height: box.height, x: 0, y: 0, top: 0, left: 0, right: box.width, bottom: box.height, toJSON: () => ({}) }) as DOMRect;
}

/**
 * jsdom ships no ResizeObserver, so the one the hook makes is this: it keeps the callback and the
 * element it watches, and `resize` is the frame laying the stage out — the box changes, then the
 * observer is told, exactly the order a browser keeps.
 */
let observed: { callback: () => void; element: Element }[] = [];
class StageObserver {
  constructor(private readonly callback: () => void) {}
  observe(element: Element): void {
    observed.push({ callback: this.callback, element });
  }
  disconnect(): void {
    observed = observed.filter((entry) => entry.callback !== this.callback);
  }
  unobserve(): void {}
}
function resize(box: { width: number; height: number }): void {
  measure(box);
  act(() => {
    for (const entry of observed) if (entry.element === stage) entry.callback();
  });
}

/** A move a reader could make: the view travels east, so no moved camera equals the one before it. */
const eastward = (held: Camera): Camera => ({ ...held, centre: [held.centre[0] + MOVE_WORLD, held.centre[1]] });

/** The camera the sheet opens at — `fitCamera`'s own answer, never a copy of one (B-17). */
function fitted(): Camera {
  return fitCamera(EXTENTS, { width: STAGE_WIDTH, height: STAGE_HEIGHT });
}

/**
 * The hook mounted over this stage. The modules are loaded here rather than in a hook, so a module
 * the split has not written yet fails the test that needed it instead of leaving it reported as one
 * nobody ran.
 */
async function mount(options: { head?: unknown; initialViewport?: string | null } = {}) {
  const module = await productModule<CameraHook>(USE_CAMERA_MODULE);
  useCamera = module.useCamera;
  ADDRESS_SETTLE_MS = module.ADDRESS_SETTLE_MS;
  MIN_FIT_STAGE_PX = module.MIN_FIT_STAGE_PX;
  ({ fitCamera, cameraFromViewport, parseViewport } = await productModule<{
    fitCamera: typeof fitCamera;
    cameraFromViewport: typeof cameraFromViewport;
    parseViewport: typeof parseViewport;
  }>(VIEWER_CLIENT_MODULE));
  const opened = options.head ?? head;
  const asked = options.initialViewport ?? null;
  return renderHook(() => useCamera({ head: opened, initialViewport: asked, stageRef: { current: stage }, draw, publish }));
}

/** The last camera a spy was handed. */
function lastCamera(spy: ReturnType<typeof vi.fn>): unknown {
  return spy.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  stage = document.createElement("div");
  document.body.append(stage);
  // jsdom lays nothing out, so the box the camera is fitted into is stated here.
  measure({ width: STAGE_WIDTH, height: STAGE_HEIGHT });
  observed = [];
  vi.stubGlobal("ResizeObserver", StageObserver);

  draw = vi.fn();
  publish = vi.fn();
  // Only the clock the settle runs on is taken over: the frame ledger and the fly-to keep theirs.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  stage.remove();
});

describe("AC-4: the camera opens fitted and the address settles behind it", () => {
  test("AC-4: the sheet opens at the camera that fits its extents into the stage", async () => {
    const { result } = await mount();
    expect(result.current.camera, "an address that names no viewport opens the whole sheet, fitted").toEqual(fitted());
  });

  test("AC-4: a live move draws at once and publishes once the settle has run out", async () => {
    const { result } = await mount();
    const moved = eastward(fitted());
    const published = publish.mock.calls.length;

    expect(ADDRESS_SETTLE_MS, "the settle a gesture's last frame is published on").toBe(SETTLE_MS);

    result.current.moveCamera(eastward, true);
    expect(lastCamera(draw), "the frame is drawn where the gesture left it, on the spot").toEqual(moved);
    expect(publish.mock.calls.length, "a gesture in flight writes no address").toBe(published);
    expect(result.current.camera, "and no render of the panel or the readout is paid for either").toEqual(fitted());

    act(() => {
      vi.advanceTimersByTime(ADDRESS_SETTLE_MS - 1);
    });
    expect(publish.mock.calls.length, "the address is written when the gesture goes quiet, not before").toBe(published);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(publish.mock.calls.length, "and then exactly once").toBe(published + 1);
    expect(lastCamera(publish), "the address carries where the gesture ended").toEqual(moved);
  });

  test("AC-4: a discrete move publishes at once", async () => {
    const { result } = await mount();
    const moved = eastward(fitted());
    const published = publish.mock.calls.length;

    act(() => {
      result.current.moveCamera(eastward, false);
    });

    expect(publish.mock.calls.length, "a control, a key or a fit is one camera write, published now").toBe(published + 1);
    expect(lastCamera(publish), "and it carries the camera the move made").toEqual(moved);
    expect(lastCamera(draw), "which is also what was drawn").toEqual(moved);
  });

  test("AC-4: a flush inside the settle window publishes now, and the settle then publishes nothing", async () => {
    const { result } = await mount();
    const moved = eastward(fitted());
    const published = publish.mock.calls.length;

    result.current.moveCamera(eastward, true);
    expect(publish.mock.calls.length, "still inside the settle window").toBe(published);

    act(() => {
      result.current.flushAddress();
    });
    expect(publish.mock.calls.length, "a reader who copies the address inside the window carries where they are").toBeGreaterThan(published);
    expect(lastCamera(publish), "which is the camera the gesture left").toEqual(moved);

    const flushed = publish.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(ADDRESS_SETTLE_MS * 2);
    });
    expect(publish.mock.calls.length, "the settle that was cleared writes nothing after it").toBe(flushed);
  });
});

describe("I-317: an address that names no camera is a fitted sheet, and stays one until the reader moves it", () => {
  test("I-317: the open's own fit is written nowhere — the absence of `v` is how a fitted sheet is spelled", async () => {
    const { result } = await mount();
    expect(result.current.camera, "the sheet opens fitted").toEqual(fitted());
    expect(publish, "and no camera the reader never chose reaches the address").not.toHaveBeenCalled();

    resize({ width: STAGE_WIDTH + 200, height: STAGE_HEIGHT });
    expect(publish, "nor does the fit a resize takes while the sheet stands at it").not.toHaveBeenCalled();
  });

  test("I-317: a stage measured before the frame laid it out is fitted again once it is laid out (F-RCC6-BNBC S-10)", async () => {
    measure(UNLAID_STAGE);
    const { result } = await mount({ head: headOf(S10_EXTENTS) });
    expect(UNLAID_STAGE.width, "the stage the open measured is narrower than any a fit settles against").toBeLessThan(MIN_FIT_STAGE_PX);
    expect(result.current.camera, "the sheet still has a camera to paint and read out while the frame lays out").not.toBeNull();

    resize(LAID_STAGE);
    expect(result.current.camera, "the laid-out stage is fitted afresh: the whole sheet, not the speck a 60 px fit left").toEqual(fitCamera(S10_EXTENTS, LAID_STAGE));
    expect(result.current.camera?.scale, "which is the scale pressing F gave on the running sheet").toBeCloseTo(S10_FITTED_SCALE, 2);
    expect(lastCamera(draw), "and that is the frame drawn").toEqual(fitCamera(S10_EXTENTS, LAID_STAGE));
    expect(publish, "and none of it was written to the address, so a reload or Back opens fitted again").not.toHaveBeenCalled();
  });

  test("I-317: a stage that collapses below the floor while fitted keeps the fit it had, and the next laid-out size fits again", async () => {
    measure(LAID_STAGE);
    const { result } = await mount({ head: headOf(S10_EXTENTS) });
    const settled = result.current.camera as Camera;

    resize(UNLAID_STAGE);
    expect(result.current.camera?.scale, "a box the frame has not laid out never settles a fit").toBe(settled.scale);
    expect(result.current.camera?.viewport, "though the camera still follows the box it is drawn into").toEqual(UNLAID_STAGE);

    const wider = { width: LAID_STAGE.width + 240, height: LAID_STAGE.height };
    resize(wider);
    expect(result.current.camera, "the next laid-out size is fitted afresh").toEqual(fitCamera(S10_EXTENTS, wider));
  });

  test("I-317: after a pan, a resize keeps the reader's scale and centre, and writes them", async () => {
    measure(UNLAID_STAGE);
    const { result } = await mount({ head: headOf(S10_EXTENTS) });
    resize(LAID_STAGE);

    act(() => {
      result.current.moveCamera(eastward, false);
    });
    const panned = result.current.camera as Camera;
    expect(publish, "the pan is the reader's, so it is written").toHaveBeenCalledTimes(1);

    const narrower = { width: LAID_STAGE.width - 300, height: LAID_STAGE.height };
    resize(narrower);
    expect(result.current.camera?.scale, "the camera is the reader's now: a resize keeps its scale").toBe(panned.scale);
    expect(result.current.camera?.centre, "and its centre").toEqual(panned.centre);
    expect(result.current.camera?.viewport, "in the box it is now drawn into").toEqual(narrower);
    expect(lastCamera(publish), "and the address follows the camera, as it did before I-317").toEqual({ ...panned, viewport: narrower });
  });

  test("I-317: a jump — a reveal's landing — ends the re-fitting as a gesture does", async () => {
    const { result } = await mount();
    const landed = eastward(fitted());
    act(() => {
      result.current.jumpTo(landed);
    });
    resize({ width: STAGE_WIDTH + 200, height: STAGE_HEIGHT + 100 });
    expect(result.current.camera?.scale, "the camera a reveal landed at is not fitted away by the next resize").toBe(landed.scale);
    expect(result.current.camera?.centre, "nor moved").toEqual(landed.centre);
  });

  test("I-317: Fit is a reader's move — it is written, and a resize after it keeps its scale", async () => {
    const { result } = await mount();
    act(() => {
      result.current.fitSheet();
    });
    expect(lastCamera(publish), "the Fit control writes the camera it framed (R-UI-031)").toEqual(fitted());

    resize({ width: STAGE_WIDTH + 200, height: STAGE_HEIGHT });
    expect(result.current.camera?.scale, "and the camera it framed is the reader's").toBe(fitted().scale);
  });

  /**
   * Walk 2 BD-1 (I-661): a Trace's travel was composed in the 1184 px the stage had before the
   * inspector opened, and landed after the inspector had taken 320 px of it. Its camera carried the
   * old box, so the drawing was projected 1184 wide into 864 (squeezed, grid circles tall ovals) while
   * the grid overlay projected the same centre and scale into its own 864 — and every zoom after it
   * kept the stale box. A camera is drawn in the box the stage stands at.
   */
  test("BD-1: a camera composed in a box the stage no longer has is drawn in the stage's box, with its centre and scale", async () => {
    const WIDE = { width: 1184, height: 804 };
    const NARROW = { width: 864, height: 804 };
    measure(WIDE);
    const { result } = await mount({ head: headOf(S10_EXTENTS) });
    const composed = { ...fitCamera(S10_EXTENTS, WIDE), centre: [300, 250] as [number, number] };

    measure(NARROW);
    act(() => {
      result.current.jumpTo(composed);
    });
    expect(lastCamera(draw), "the landing is drawn in the canvas it now stands in").toEqual({ ...composed, viewport: NARROW });
    expect(result.current.camera?.viewport, "and that is the camera held").toEqual(NARROW);

    act(() => {
      result.current.moveCamera((held) => ({ ...held, scale: held.scale * 1.25 }), false);
    });
    expect((lastCamera(draw) as Camera).viewport, "a zoom after it keeps the stage's box, never the stale one").toEqual(NARROW);

    result.current.moveCamera(() => composed, true);
    expect((lastCamera(draw) as Camera).viewport, "and so does a frame of a gesture in flight").toEqual(NARROW);
  });

  test("R-UI-031 / I-85: an address that names a camera opens at exactly that camera, as it always did, and keeps it across a resize", async () => {
    const stated = "420.5,297,0.5";
    const { result } = await mount({ head: headOf(S10_EXTENTS), initialViewport: stated });
    const asked = parseViewport(stated) as { x: number; y: number; scale: number };
    const expected = cameraFromViewport(asked, { width: STAGE_WIDTH, height: STAGE_HEIGHT });

    expect(result.current.camera, "the stated camera is the camera the reader gets — never a fit").toEqual(expected);
    expect(lastCamera(publish), "and it is written back in the seam's own spelling, as before").toEqual(expected);

    resize(LAID_STAGE);
    expect(result.current.camera?.scale, "a stated camera is never fitted away by a resize").toBe(expected.scale);
    expect(result.current.camera?.centre, "nor moved").toEqual(expected.centre);
  });
});

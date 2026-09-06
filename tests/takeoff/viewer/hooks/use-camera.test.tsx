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
  useCamera: (options: {
    head: unknown;
    initialViewport: string | null;
    stageRef: { current: HTMLElement | null };
    draw: (camera: Camera) => void;
    publish: (camera: Camera) => void;
  }) => {
    camera: Camera | null;
    moveCamera: (move: (held: Camera) => Camera, live: boolean) => void;
    flushAddress: () => void;
  };
};

let useCamera: CameraHook["useCamera"];
let ADDRESS_SETTLE_MS: number;
let fitCamera: (extents: unknown, viewportPx: { width: number; height: number }) => Camera;
let draw: ReturnType<typeof vi.fn>;
let publish: ReturnType<typeof vi.fn>;
let stage: HTMLDivElement;

/** The head this sheet is opened from: a manifest with extents, which is all a camera reads of one. */
const head = {
  kind: "manifest",
  cache: "miss",
  facts: {},
  manifest: {
    version: 1,
    layoutName: "SHEET ONE",
    extents: EXTENTS,
    insunits: { code: 0, unit: null, unmapped: true },
    digest: "sheet-one",
    layers: [],
  },
};

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
async function mount() {
  const module = await productModule<CameraHook>(USE_CAMERA_MODULE);
  useCamera = module.useCamera;
  ADDRESS_SETTLE_MS = module.ADDRESS_SETTLE_MS;
  ({ fitCamera } = await productModule<{ fitCamera: typeof fitCamera }>(VIEWER_CLIENT_MODULE));
  return renderHook(() => useCamera({ head, initialViewport: null, stageRef: { current: stage }, draw, publish }));
}

/** The last camera a spy was handed. */
function lastCamera(spy: ReturnType<typeof vi.fn>): unknown {
  return spy.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  stage = document.createElement("div");
  document.body.append(stage);
  // jsdom lays nothing out, so the box the camera is fitted into is stated here.
  stage.getBoundingClientRect = () =>
    ({ width: STAGE_WIDTH, height: STAGE_HEIGHT, x: 0, y: 0, top: 0, left: 0, right: STAGE_WIDTH, bottom: STAGE_HEIGHT, toJSON: () => ({}) }) as DOMRect;

  draw = vi.fn();
  publish = vi.fn();
  // Only the clock the settle runs on is taken over: the frame ledger and the fly-to keep theirs.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

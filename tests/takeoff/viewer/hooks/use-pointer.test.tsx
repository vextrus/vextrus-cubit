// @vitest-environment jsdom
/**
 * The sheet under the pointer (Decision § 1, § 5, I-87, PB-3): a drag pans, a still pointer reads
 * what is under it one question at a time, a click of no travel takes the topmost hit, a click on
 * the sheet's own ink does not punish the reader by letting go, and Shift draws a rectangle.
 *
 * Where a pan lands is `panCamera`'s own answer and where a point is in the drawing is `worldAt`'s,
 * for the camera this file states (B-17, B-19).
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { VIEWER_CLIENT_MODULE, productModule } from "../support/viewer-support";

/** The module AC-2 names for this concern. */
const USE_POINTER_MODULE = "src/modules/takeoff/viewer/hooks/use-pointer.ts";

/** The camera the sheet is seen through, and the box the canvas stands in. */
const CAMERA = { centre: [10, 20], scale: 2, viewport: { width: 800, height: 600 } };
const CANVAS_LEFT = 40;
const CANVAS_TOP = 24;

/** Where a gesture starts, and how far a drag travels — well past the click threshold. */
const START = { x: 200, y: 160 };
const TRAVEL = { dx: 60, dy: -30 };

/** The key the index answers with, and what this sheet knows of it. */
const KEY = "DXF_HANDLE:1A";
const OTHER = "DXF_HANDLE:2B";
const OPEN_LAYERS = ["GRID"];

type Camera = typeof CAMERA;
type PointerHook = {
  usePointer: (options: Record<string, unknown>) => {
    hovered: { key: string; type: string; layer: string } | null;
    marqueeOn: boolean;
    onPointerDown: (event: unknown) => void;
    onPointerMove: (event: unknown) => void;
    onPointerUp: (event: unknown) => void;
    onPointerLeave: () => void;
  };
};

let worldAt: (camera: Camera, atPx: { x: number; y: number }) => [number, number];
let panCamera: (camera: Camera, dxPx: number, dyPx: number) => Camera;
let canvas: HTMLCanvasElement;
let moveCamera: ReturnType<typeof vi.fn>;
let ask: ReturnType<typeof vi.fn>;
let keysUnder: ReturnType<typeof vi.fn>;
let hold: ReturnType<typeof vi.fn>;
let toggleKey: ReturnType<typeof vi.fn>;
/** What the index answers each question with, in order — one entry per call. */
let answers: string[][];

/** What this sheet knows about its keys: one of them, and only that one. */
const facts = {
  get: (key: string) => (key === KEY ? { type: "LINE", layer: "GRID", box: { min: [0, 0], max: [1, 1] }, records: [{ key }] } : undefined),
  has: (key: string) => key === KEY,
  learn: () => undefined,
};

/** A pointer event as the canvas hands one over. */
function at(x: number, y: number, shiftKey = false): unknown {
  return { currentTarget: canvas, clientX: x, clientY: y, shiftKey, pointerId: 1 };
}

/** Where a client point stands on the canvas. */
function onCanvas(x: number, y: number): { x: number; y: number } {
  return { x: x - CANVAS_LEFT, y: y - CANVAS_TOP };
}

async function mount() {
  const { usePointer } = await productModule<PointerHook>(USE_POINTER_MODULE);
  ({ worldAt, panCamera } = await productModule<{ worldAt: typeof worldAt; panCamera: typeof panCamera }>(VIEWER_CLIENT_MODULE));
  return renderHook(() =>
    usePointer({
      head: null,
      canvasRef: { current: canvas },
      cameraRef: { current: CAMERA },
      painterRef: { current: null },
      facts,
      moveCamera,
      draw: () => undefined,
      ask,
      keysUnder,
      openLayers: () => OPEN_LAYERS,
      hold,
      toggleKey,
    }),
  );
}

/** Where the last live move left the camera. */
function lastMove(): { camera: Camera; live: boolean } {
  const call = moveCamera.mock.calls.at(-1) as [(held: Camera) => Camera, boolean];
  return { camera: call[0](CAMERA), live: call[1] };
}

beforeEach(() => {
  canvas = document.createElement("canvas");
  document.body.append(canvas);
  canvas.getBoundingClientRect = () =>
    ({ width: 800, height: 600, x: CANVAS_LEFT, y: CANVAS_TOP, top: CANVAS_TOP, left: CANVAS_LEFT, right: 840, bottom: 624, toJSON: () => ({}) }) as DOMRect;
  canvas.setPointerCapture = () => undefined;
  canvas.hasPointerCapture = () => false;
  canvas.releasePointerCapture = () => undefined;

  answers = [];
  moveCamera = vi.fn();
  hold = vi.fn();
  toggleKey = vi.fn();
  ask = vi.fn(() => Promise.resolve(answers.shift() ?? []));
  keysUnder = vi.fn(() => Promise.resolve(answers.shift() ?? []));
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("the sheet under the pointer", () => {
  test("a drag pans the camera as the sheet's own pan does, and every frame of it is live", async () => {
    const { result } = await mount();

    act(() => result.current.onPointerDown(at(START.x, START.y)));
    act(() => result.current.onPointerMove(at(START.x + TRAVEL.dx, START.y + TRAVEL.dy)));

    const { camera, live } = lastMove();
    expect(camera, "the sheet follows the pointer").toEqual(panCamera(CAMERA, -TRAVEL.dx, -TRAVEL.dy));
    expect(live, "a gesture in flight draws and writes no address (PB-3, R-UI-031)").toBe(true);
    expect(keysUnder, "and a dragging pointer is not a reading one").not.toHaveBeenCalled();
  });

  test("a still pointer reads what is under it, one question at a time", async () => {
    const { result } = await mount();
    answers = [[KEY]];

    await act(async () => {
      result.current.onPointerMove(at(START.x, START.y));
      // A second move while the first question is still in flight must not queue another.
      result.current.onPointerMove(at(START.x + 1, START.y + 1));
      await Promise.resolve();
    });

    expect(keysUnder, "one pointer, one question").toHaveBeenCalledTimes(1);
    expect(keysUnder.mock.calls[0]?.[0], "asked about where the pointer is in the drawing").toEqual(worldAt(CAMERA, onCanvas(START.x, START.y)));
    expect(result.current.hovered, "and what is under it is what this sheet knows of that key").toEqual({ key: KEY, type: "LINE", layer: "GRID" });

    act(() => result.current.onPointerLeave());
    expect(result.current.hovered, "a pointer that left the sheet is over nothing").toBeNull();
  });

  test("a click of no travel takes the topmost hit", async () => {
    const { result } = await mount();
    answers = [[KEY, OTHER]];

    await act(async () => {
      result.current.onPointerDown(at(START.x, START.y));
      result.current.onPointerUp(at(START.x, START.y));
      await Promise.resolve();
    });

    expect(hold, "the nearest key is what a click takes").toHaveBeenCalledWith([KEY]);
    expect(moveCamera, "and a click that never travelled moved no camera").not.toHaveBeenCalled();
  });

  test("only bare paper lets go: a press on ink a reader may not take holds on to what they had", async () => {
    const { result } = await mount();
    // Nothing takeable is under the point, but the sheet is painted there — a locked layer (I-87).
    answers = [[], [KEY]];

    await act(async () => {
      result.current.onPointerDown(at(START.x, START.y));
      result.current.onPointerUp(at(START.x, START.y));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(keysUnder.mock.calls[1]?.[1], "the second question is the one that takes nothing").toBe(false);
    expect(hold, "a press on geometry a reader can see does not punish them by clearing").not.toHaveBeenCalled();

    answers = [[], []];
    await act(async () => {
      result.current.onPointerDown(at(START.x, START.y));
      result.current.onPointerUp(at(START.x, START.y));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(hold, "and a press on paper with nothing under it at all does let go").toHaveBeenCalledWith([]);
  });

  test("Shift draws a rectangle, and what it takes comes from the layers a reader can see", async () => {
    const { result } = await mount();
    answers = [[KEY, OTHER]];

    act(() => result.current.onPointerDown(at(START.x, START.y, true)));
    expect(result.current.marqueeOn, "the rectangle is on screen while it is being drawn").toBe(true);

    act(() => result.current.onPointerMove(at(START.x + TRAVEL.dx, START.y + TRAVEL.dy, true)));
    expect(moveCamera, "a rectangle is not a pan").not.toHaveBeenCalled();

    await act(async () => {
      result.current.onPointerUp(at(START.x + TRAVEL.dx, START.y + TRAVEL.dy, true));
      await Promise.resolve();
    });

    expect(result.current.marqueeOn, "and it is gone once the reader lets go").toBe(false);
    expect(ask.mock.calls[0]?.[0], "the rectangle asks the index for a world box, over the drawn and unlocked layers").toMatchObject({
      kind: "rect",
      layers: OPEN_LAYERS,
    });
    expect(hold, "and only the keys this sheet actually holds are taken").toHaveBeenCalledWith([KEY]);
  });

  test("a Shift press that never travelled is a toggle, not a rectangle of no extent", async () => {
    const { result } = await mount();
    answers = [[KEY]];

    await act(async () => {
      result.current.onPointerDown(at(START.x, START.y, true));
      result.current.onPointerUp(at(START.x, START.y, true));
      await Promise.resolve();
    });

    expect(ask, "no rectangle was ever asked for").not.toHaveBeenCalled();
    expect(toggleKey, "the key under the press is added to, or taken out of, what is held (I-87)").toHaveBeenCalledWith(KEY);
  });
});

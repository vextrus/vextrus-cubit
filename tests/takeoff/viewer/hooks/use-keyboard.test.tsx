// @vitest-environment jsdom
/**
 * The sheet from the keyboard (R-TO-010, A-11Y, Decision § 1): every key a reader drives a sheet
 * with, and the discrete move each one makes.
 *
 * No distance and no factor is written out here: a pan is compared against `panCamera`'s own answer
 * for the hook's own `KEYBOARD_PAN_PX`, and a zoom against the hook's own `ZOOM_STEP`, so a change to
 * either moves both sides at once (B-19).
 */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { VIEWER_CLIENT_MODULE, productModule } from "../support/viewer-support";

/** The modules AC-2 names for this concern, and the one the zoom step is published by. */
const USE_KEYBOARD_MODULE = "src/modules/takeoff/viewer/hooks/use-keyboard.ts";
const USE_CAMERA_MODULE = "src/modules/takeoff/viewer/hooks/use-camera.ts";

/** The camera every key is judged against — off centre and off scale, so no two answers coincide. */
const CAMERA = { centre: [10, 20], scale: 2, viewport: { width: 800, height: 600 } };

type Camera = typeof CAMERA;
type KeyboardHook = {
  KEYBOARD_PAN_PX: number;
  useKeyboard: (options: {
    moveCamera: (move: (held: Camera) => Camera, live: boolean) => void;
    zoomBy: (factor: number) => void;
    fitSheet: () => void;
    hold: (keys: string[]) => void;
  }) => { onKeyDown: (event: unknown) => void };
};

let KEYBOARD_PAN_PX: number;
let ZOOM_STEP: number;
let panCamera: (camera: Camera, dxPx: number, dyPx: number) => Camera;
let moveCamera: ReturnType<typeof vi.fn>;
let zoomBy: ReturnType<typeof vi.fn>;
let fitSheet: ReturnType<typeof vi.fn>;
let hold: ReturnType<typeof vi.fn>;
let prevented: ReturnType<typeof vi.fn>;

async function mount() {
  const keyboard = await productModule<KeyboardHook>(USE_KEYBOARD_MODULE);
  KEYBOARD_PAN_PX = keyboard.KEYBOARD_PAN_PX;
  ({ ZOOM_STEP } = await productModule<{ ZOOM_STEP: number }>(USE_CAMERA_MODULE));
  ({ panCamera } = await productModule<{ panCamera: typeof panCamera }>(VIEWER_CLIENT_MODULE));
  return renderHook(() => keyboard.useKeyboard({ moveCamera, zoomBy, fitSheet, hold }));
}

/** The key pressed with the sheet focused, and what the hook did with the camera it was handed. */
function press(onKeyDown: (event: unknown) => void, key: string): void {
  onKeyDown({ key, preventDefault: prevented });
}

/** Where the last discrete move left the camera. */
function moved(): { camera: Camera; live: boolean } {
  const call = moveCamera.mock.calls.at(-1) as [(held: Camera) => Camera, boolean];
  return { camera: call[0](CAMERA), live: call[1] };
}

beforeEach(() => {
  moveCamera = vi.fn();
  zoomBy = vi.fn();
  fitSheet = vi.fn();
  hold = vi.fn();
  prevented = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("the sheet from the keyboard", () => {
  test("the arrows pan by the stated step, in the direction pressed, and keep the page still", async () => {
    const { result } = await mount();
    const cardinals = [
      ["ArrowLeft", -KEYBOARD_PAN_PX, 0],
      ["ArrowRight", KEYBOARD_PAN_PX, 0],
      ["ArrowUp", 0, -KEYBOARD_PAN_PX],
      ["ArrowDown", 0, KEYBOARD_PAN_PX],
    ] as const;

    for (const [key, dx, dy] of cardinals) {
      press(result.current.onKeyDown, key);
      const { camera, live } = moved();
      expect(camera, `${key} pans the camera the way the sheet's own pan does`).toEqual(panCamera(CAMERA, dx, dy));
      expect(live, "a key is one camera write, published now and not on a settle").toBe(false);
    }

    expect(prevented, "an arrow drives the sheet rather than scrolling the page under it").toHaveBeenCalledTimes(cardinals.length);
  });

  test("the zoom keys step by the sheet's own factor, and each way is the other's inverse", async () => {
    const { result } = await mount();

    press(result.current.onKeyDown, "+");
    press(result.current.onKeyDown, "=");
    press(result.current.onKeyDown, "-");

    expect(
      zoomBy.mock.calls.map((call) => call[0]),
      "both spellings of nearer are the step, and further is its reciprocal",
    ).toEqual([ZOOM_STEP, ZOOM_STEP, 1 / ZOOM_STEP]);
    expect(moveCamera, "a zoom key moves the camera through the zoom, not around it").not.toHaveBeenCalled();
  });

  test("F fits the sheet and Escape lets go of what is held", async () => {
    const { result } = await mount();

    press(result.current.onKeyDown, "f");
    press(result.current.onKeyDown, "F");
    expect(fitSheet, "either case of the fit key fits the sheet").toHaveBeenCalledTimes(2);

    press(result.current.onKeyDown, "Escape");
    expect(hold, "Escape with the sheet focused holds nothing").toHaveBeenCalledWith([]);
  });

  test("a key the sheet does not answer is left to the page", async () => {
    const { result } = await mount();

    press(result.current.onKeyDown, "Tab");

    expect(prevented, "moving on from the sheet is the browser's to do, not the sheet's to swallow").not.toHaveBeenCalled();
    expect(moveCamera, "and nothing moved").not.toHaveBeenCalled();
    expect(hold, "and nothing was let go of").not.toHaveBeenCalled();
  });
});

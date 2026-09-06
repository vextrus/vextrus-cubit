// @vitest-environment jsdom
/**
 * The sheet from the keyboard (R-TO-010): every key that moves the camera moves it discretely, so a
 * reader driving by keyboard shares the link they are looking at rather than one a settle is still
 * holding. What each key means is derived from the seam it delegates to — `panCamera` and the hook's
 * own `ZOOM_STEP` — never from a camera transcribed here (B-19).
 */
import { cleanup, renderHook } from "@testing-library/react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { panCamera } from "../../../../src/modules/takeoff/viewer/client";
import type { Camera } from "../../../../src/modules/takeoff/viewer/types";
import { ZOOM_STEP } from "../../../../src/modules/takeoff/viewer/hooks/use-camera";
import { KEYBOARD_PAN_PX, useKeyboard } from "../../../../src/modules/takeoff/viewer/hooks/use-keyboard";

/** Where the camera stands when a key is pressed — every expectation is a move away from here. */
const HELD: Camera = { centre: [100, 50], scale: 2, viewport: { width: 800, height: 600 } };

let moveCamera: ReturnType<typeof vi.fn>;
let zoomBy: ReturnType<typeof vi.fn>;
let fitSheet: ReturnType<typeof vi.fn>;
let hold: ReturnType<typeof vi.fn>;
let prevented: number;

/** A key press as React hands one over, carrying only what the hook reads of it. */
function press(key: string): ReactKeyboardEvent<HTMLCanvasElement> {
  const event = {
    key,
    preventDefault: () => {
      prevented += 1;
    },
  };
  return event as ReactKeyboardEvent<HTMLCanvasElement>;
}

function mount() {
  return renderHook(() => useKeyboard({ moveCamera, zoomBy, fitSheet, hold })).result;
}

/** Where the last move the hook asked for would take the camera held above. */
function moved(): Camera {
  const move = moveCamera.mock.calls.at(-1)?.[0] as (held: Camera) => Camera;
  return move(HELD);
}

beforeEach(() => {
  moveCamera = vi.fn();
  zoomBy = vi.fn();
  fitSheet = vi.fn();
  hold = vi.fn();
  prevented = 0;
});

afterEach(() => {
  cleanup();
});

describe("useKeyboard: the sheet answers the keys named beside it", () => {
  test("the zoom keys step by the hook's own step, and F fits the sheet", () => {
    const keys = mount();

    keys.current.onKeyDown(press("+"));
    keys.current.onKeyDown(press("="));
    keys.current.onKeyDown(press("-"));
    keys.current.onKeyDown(press("F"));
    keys.current.onKeyDown(press("f"));

    expect(zoomBy.mock.calls.map((call) => call[0]), "both spellings of zoom in step in, and the minus steps out").toEqual([
      ZOOM_STEP,
      ZOOM_STEP,
      1 / ZOOM_STEP,
    ]);
    expect(fitSheet, "either case of F fits the sheet").toHaveBeenCalledTimes(2);
  });

  test("each arrow pans by the stated number of pixels, and refuses the page its own scroll", () => {
    const keys = mount();
    const arrows: readonly (readonly [string, number, number])[] = [
      ["ArrowLeft", -KEYBOARD_PAN_PX, 0],
      ["ArrowRight", KEYBOARD_PAN_PX, 0],
      ["ArrowUp", 0, -KEYBOARD_PAN_PX],
      ["ArrowDown", 0, KEYBOARD_PAN_PX],
    ];

    for (const [key, dx, dy] of arrows) {
      keys.current.onKeyDown(press(key));
      expect(moved(), `${key} pans the camera as the seam pans one`).toEqual(panCamera(HELD, dx, dy));
      expect(moveCamera.mock.calls.at(-1)?.[1], "a key is a discrete move: the address is written now").toBe(false);
    }

    expect(prevented, "every arrow is the sheet's, not the page's").toBe(arrows.length);
  });

  test("Escape lets go of what is held, and an unspoken key does nothing at all", () => {
    const keys = mount();

    keys.current.onKeyDown(press("Escape"));
    expect(hold, "Escape with the sheet focused clears the selection").toHaveBeenCalledWith([]);

    keys.current.onKeyDown(press("q"));
    expect(hold, "a key the sheet does not answer is left to the page").toHaveBeenCalledTimes(1);
    expect(moveCamera, "and moves nothing").not.toHaveBeenCalled();
  });
});

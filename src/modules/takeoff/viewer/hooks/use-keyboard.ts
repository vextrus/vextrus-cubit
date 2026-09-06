/**
 * The sheet from the keyboard (R-TO-010, A-11Y): pan, zoom, fit and letting go, all of them the same
 * discrete moves the controls make — a key is one camera write, published now (Decision § 1).
 */
import { useCallback } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { panCamera } from "../client";
import type { Camera } from "../types";
import { ZOOM_STEP } from "./use-camera";

/** How far the arrow keys pan, in device-independent pixels (Decision § 1's closed px set). */
export const KEYBOARD_PAN_PX = 48;

export interface KeyboardOptions {
  moveCamera: (move: (held: Camera) => Camera, live: boolean) => void;
  zoomBy: (factor: number) => void;
  fitSheet: () => void;
  hold: (keys: string[]) => void;
}

export interface KeyboardGestures {
  onKeyDown: (event: ReactKeyboardEvent<HTMLCanvasElement>) => void;
}

export function useKeyboard({ moveCamera, zoomBy, fitSheet, hold }: KeyboardOptions): KeyboardGestures {
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLCanvasElement>): void => {
      const pan = (dx: number, dy: number): void => {
        event.preventDefault();
        moveCamera((held) => panCamera(held, dx, dy), false);
      };
      if (event.key === "+" || event.key === "=") zoomBy(ZOOM_STEP);
      else if (event.key === "-") zoomBy(1 / ZOOM_STEP);
      else if (event.key === "f" || event.key === "F") fitSheet();
      else if (event.key === "ArrowLeft") pan(-KEYBOARD_PAN_PX, 0);
      else if (event.key === "ArrowRight") pan(KEYBOARD_PAN_PX, 0);
      else if (event.key === "ArrowUp") pan(0, -KEYBOARD_PAN_PX);
      else if (event.key === "ArrowDown") pan(0, KEYBOARD_PAN_PX);
      // Escape with the sheet focused lets go of what is held (Decision § 1).
      else if (event.key === "Escape") hold([]);
    },
    [fitSheet, hold, moveCamera, zoomBy],
  );

  return { onKeyDown };
}

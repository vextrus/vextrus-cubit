/**
 * The sheet from the keyboard (R-TO-010, Decision § 1): zoom, fit, pan by the arrows, and Escape to
 * let go of what is held. Every key here moves the camera discretely, so each one is a frame and one
 * address write — a reader driving the sheet by keyboard shares the link they are looking at.
 */
import { useCallback } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { panCamera } from "../client";
import type { Camera } from "../types";
import { ZOOM_STEP } from "./use-camera";

/** How far the arrow keys pan, in device-independent pixels (Decision § 1's closed px set). */
export const KEYBOARD_PAN_PX = 48;

export type UseKeyboardOptions = {
  moveCamera?: (move: (held: Camera) => Camera, live: boolean) => void;
  zoomBy?: (factor: number) => void;
  fitSheet?: () => void;
  /** What is held, as Escape leaves it. */
  hold?: (keys: string[]) => void;
  /**
   * Whether this press is the binding R-UI-032 gives snapping. The reading is handed DOWN from the
   * screen, which is where the one roster may be read: ARCH-01 forbids this module importing
   * `src/ui`, and a second spelling of the key here would be a second roster (B-17).
   */
  isSnapKey?: (event: ReactKeyboardEvent<HTMLCanvasElement>) => boolean;
  /** Snapping turned on or off by that key. */
  toggleSnapping?: () => void;
  /** A pick taken where the snap stands — Enter is Alt+click's accessible equal (R-UI-060, I-145). */
  takePick?: () => void;
  /** The picks let go of, which Escape does before it lets go of the selection (I-145). */
  clearPicks?: () => void;
};

export type UseKeyboard = {
  onKeyDown: (event: ReactKeyboardEvent<HTMLCanvasElement>) => void;
};

export function useKeyboard({ moveCamera, zoomBy, fitSheet, hold, isSnapKey, toggleSnapping, takePick, clearPicks }: UseKeyboardOptions): UseKeyboard {
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLCanvasElement>): void => {
      const pan = (dx: number, dy: number): void => {
        event.preventDefault();
        moveCamera?.((held) => panCamera(held, dx, dy), false);
      };
      // The roster's own reading of its own step, made where the roster lives and asked here (B-17).
      if (isSnapKey?.(event) === true) {
        toggleSnapping?.();
        return;
      }
      // Enter takes a pick: the keyboard's equal of Alt+click, so the readout is reachable with no
      // pointer at all (R-UI-060, I-145).
      if (event.key === "Enter") {
        takePick?.();
        return;
      }
      if (event.key === "+" || event.key === "=") zoomBy?.(ZOOM_STEP);
      else if (event.key === "-") zoomBy?.(1 / ZOOM_STEP);
      else if (event.key === "f" || event.key === "F") fitSheet?.();
      else if (event.key === "ArrowLeft") pan(-KEYBOARD_PAN_PX, 0);
      else if (event.key === "ArrowRight") pan(KEYBOARD_PAN_PX, 0);
      else if (event.key === "ArrowUp") pan(0, -KEYBOARD_PAN_PX);
      else if (event.key === "ArrowDown") pan(0, KEYBOARD_PAN_PX);
      // Escape with the sheet focused is ONE press doing two things in order: it lets go of the picks,
      // then of what is held (I-145). A reader who presses Escape wants the canvas quiet, and making
      // them press twice to reach a behaviour that already existed would be a regression.
      else if (event.key === "Escape") {
        clearPicks?.();
        hold?.([]);
      }
    },
    [clearPicks, fitSheet, hold, isSnapKey, moveCamera, takePick, toggleSnapping, zoomBy],
  );

  return { onKeyDown };
}

/**
 * The sheet from the keyboard (R-TO-010, Decision § 1): zoom, fit, pan by the arrows, and Escape to
 * let go of what is held. An armed measure tool's keys are the measure region's, asked first
 * (s-measure § 2.2): this module may not read the roster they are matched against (ARCH-01). Every key here moves the camera discretely, so each one is a frame and one
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
  /** Toggle viewer tool: V for select, H for pan (R-UI-032). */
  setTool?: (tool: "select" | "pan") => void;
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
  /**
   * The measure tools' keys (s-measure §2.2), asked FIRST and answered by the region that matches them
   * against the one roster — this module may not import it (ARCH-01). True means the key was the
   * region's: the camera's keys below do not also answer it, so while a tool is armed the arrows move
   * the keyboard cursor rather than the sheet, and Enter finishes a shape rather than taking a pick.
   */
  measureKey?: (event: ReactKeyboardEvent<HTMLCanvasElement>) => boolean;
};

export type UseKeyboard = {
  onKeyDown: (event: ReactKeyboardEvent<HTMLCanvasElement>) => void;
};

export function useKeyboard({ moveCamera, zoomBy, fitSheet, hold, setTool, isSnapKey, toggleSnapping, takePick, clearPicks, measureKey }: UseKeyboardOptions): UseKeyboard {
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLCanvasElement>): void => {
      const pan = (dx: number, dy: number): void => {
        event.preventDefault();
        moveCamera?.((held) => panCamera(held, dx, dy), false);
      };
      if (measureKey?.(event) === true) return;
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
      else if (event.key === "v" || event.key === "V") setTool?.("select");
      else if (event.key === "h" || event.key === "H") setTool?.("pan");
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
    [clearPicks, fitSheet, hold, isSnapKey, measureKey, moveCamera, setTool, takePick, toggleSnapping, zoomBy],
  );

  return { onKeyDown };
}

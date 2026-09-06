/**
 * The Trace's target (R-UI-022, Decision § 4): the camera eases from where it stands to the frame
 * that holds everything selected, and the arrival is struck once in the pulse colour.
 *
 * It is one code path — the Reveal door and a deep link that names keys and no camera both come
 * through here (I-85). Reduced motion zeroes `--motion-flyto` at source, so a reader who asked for
 * less motion is answered with a duration of zero and no branch anywhere: the same arrival, without
 * the travel.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fitCamera, type IndexBox } from "../client";
import type { Camera, ViewerHead } from "../types";
import { flyTo, revealCamera, type EaseControls } from "../../viewer-inspector/flyto";
import { unionBox } from "../../viewer-inspector/selection";
import type { SheetFacts } from "./use-selection";

/** The fly-to's duration when the token cannot be read at all — the token's own value (§ 4). */
const FLYTO_FALLBACK_MS = 320;

/** How many numbers a cubic-bezier token carries. */
const EASE_CONTROLS = 4;

/**
 * The duration a fly-to travels over, as the screen's own tokens state it. A token that cannot be
 * read at all is not a reason to teleport: the travel keeps its own stated length, and a curve that
 * cannot be parsed eases linearly over it (§ 4).
 */
export function flytoMotion(element: Element): { durationMs: number; ease: EaseControls | null } {
  const style = getComputedStyle(element);
  const spelled = style.getPropertyValue("--motion-flyto").trim();
  const seconds = spelled.endsWith("ms") ? Number(spelled.slice(0, -2)) / 1000 : spelled.endsWith("s") ? Number(spelled.slice(0, -1)) : Number.NaN;
  const numbers = (style.getPropertyValue("--ease-flyto").match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  return {
    durationMs: Number.isFinite(seconds) ? Math.max(seconds * 1000, 0) : FLYTO_FALLBACK_MS,
    ease: numbers.length === EASE_CONTROLS ? ([numbers[0], numbers[1], numbers[2], numbers[3]] as EaseControls) : null,
  };
}

export interface RevealOptions {
  head: ViewerHead | null;
  stageRef: { current: HTMLElement | null };
  cameraRef: { current: Camera | null };
  facts: SheetFacts;
  /** What is held, for a reveal asked for with no keys of its own — the Reveal door. */
  heldRef: { current: readonly string[] };
  moveCamera: (move: (held: Camera) => Camera, live: boolean) => void;
  jumpTo: (to: Camera) => void;
  pulse: (durationMs: number) => void;
  /** The keys an address asked to be flown to, or null where it asked for no travel (I-85). */
  request: readonly string[] | null;
}

export interface RevealControl {
  /** Travel to the frame that holds these keys, or the ones held where none are named. */
  reveal: (keys?: readonly string[]) => void;
  /** Absent until the first fly-to ever runs, and never written when the address states `v` (I-85). */
  flyto: "flying" | "settled" | null;
}

export function useReveal({ head, stageRef, cameraRef, facts, heldRef, moveCamera, jumpTo, pulse, request }: RevealOptions): RevealControl {
  const [flyto, setFlyto] = useState<"flying" | "settled" | null>(null);
  /** The fly-to in flight, so a second reveal or a leaving screen cancels the first. */
  const flightRef = useRef(0);
  /** The address request already flown, so a re-render is not a second journey. */
  const flownRef = useRef<readonly string[] | null>(null);

  const reveal = useCallback(
    (keys?: readonly string[]): void => {
      const stage = stageRef.current;
      if (stage === null || head?.kind !== "manifest") return;
      // The keys are taken as an argument where the caller has just chosen them: a deep link selects
      // and reveals in one pass, and the ref holding what is selected is a render behind it.
      const held = keys ?? heldRef.current;
      const boxes = held.map((key) => facts.get(key)?.box).filter((box): box is IndexBox => box !== undefined);
      const union = unionBox(boxes);
      // Nothing selected has no box, so a reveal has nowhere to go and does not pretend to travel.
      if (union === null) return;

      const rect = stage.getBoundingClientRect();
      const viewportPx = { width: rect.width, height: rect.height };
      const to = revealCamera(union, viewportPx);
      const from = cameraRef.current ?? fitCamera(head.manifest.extents, viewportPx);
      const { durationMs, ease } = flytoMotion(stage);
      const flight = flightRef.current + 1;
      flightRef.current = flight;

      const land = (): void => {
        jumpTo(to);
        setFlyto("settled");
        pulse(durationMs);
      };

      // Reduced motion zeroes the token at source, so this is one frame and no pulse — the same
      // arrival, without the travel (Decision § 4).
      if (durationMs <= 0 || typeof requestAnimationFrame === "undefined") {
        land();
        return;
      }

      setFlyto("flying");
      const began = performance.now();
      const step = (): void => {
        if (flightRef.current !== flight) return;
        const elapsed = performance.now() - began;
        if (elapsed >= durationMs) {
          land();
          return;
        }
        moveCamera(() => flyTo(from, to, elapsed, durationMs, ease), true);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [cameraRef, facts, head, heldRef, jumpTo, moveCamera, pulse, stageRef],
  );

  useEffect(() => {
    if (request === null || flownRef.current === request) return;
    flownRef.current = request;
    reveal(request);
  }, [request, reveal]);

  return { reveal, flyto };
}

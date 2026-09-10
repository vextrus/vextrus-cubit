/**
 * The Trace's target (R-UI-022, Decision § 4): the camera eases from where it stands to the frame
 * that holds everything named, and the arrival is struck once in the pulse colour.
 *
 * It is one code path — the Reveal door and a deep link that names keys and no camera both come
 * through here (I-85). Reduced motion zeroes `--motion-flyto` at source, so a reader who asked for
 * less motion is answered with a duration of zero and no branch anywhere.
 */
import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import { flyTo, revealCamera, type EaseControls } from "../../viewer-inspector/flyto";
import { unionBox } from "../../viewer-inspector/selection";
import { fitCamera, type IndexBox } from "../client";
import type { Camera, ViewerHead } from "../types";
import type { SheetFacts } from "./facts";
import { useHandedRef } from "./use-handed-ref";

/** The fly-to's duration when the token cannot be read at all — the token's own value (§ 4). */
const FLYTO_FALLBACK_MS = 320;

/** How many numbers a cubic-bezier token carries. */
const EASE_CONTROLS = 4;

/**
 * The duration a fly-to travels over, as the screen's own tokens state it. A token that cannot be
 * read at all is not a reason to teleport: the travel keeps its own stated length, and a curve that
 * cannot be parsed eases linearly over it (§ 4).
 */
/**
 * The namespace R-UI-001 emits the basis palette under. Only the property's NAME is composed here:
 * the value stays where the token source alone holds it, so this module maps a basis to a token to
 * ask the document for, never to a colour of its own (B-17, R-UI-002).
 */
const BASIS_TOKEN_NS = "basis";

/**
 * The colour a basis is painted in, as the screen's own tokens state it — the same read the duration
 * above is, at the same element, so no hook anywhere holds a hex (R-UI-002, R-UI-001, B-17). A basis
 * nobody names, or a token this stage does not carry, answers the empty string and the strike keeps
 * the canvas's own pulse colour.
 */
function basisColour(element: Element, basis: string | undefined): string {
  if (basis === undefined || basis.length === 0) return "";
  return getComputedStyle(element)
    .getPropertyValue(`--${BASIS_TOKEN_NS}-${basis.toLowerCase()}`)
    .trim();
}

function flytoMotion(element: Element): { durationMs: number; ease: EaseControls | null } {
  const style = getComputedStyle(element);
  const spelled = style.getPropertyValue("--motion-flyto").trim();
  const seconds = spelled.endsWith("ms") ? Number(spelled.slice(0, -2)) / 1000 : spelled.endsWith("s") ? Number(spelled.slice(0, -1)) : Number.NaN;
  const numbers = (style.getPropertyValue("--ease-flyto").match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  return {
    durationMs: Number.isFinite(seconds) ? Math.max(seconds * 1000, 0) : FLYTO_FALLBACK_MS,
    ease: numbers.length === EASE_CONTROLS ? ([numbers[0], numbers[1], numbers[2], numbers[3]] as EaseControls) : null,
  };
}

export type UseRevealOptions = {
  head: ViewerHead | null;
  /** The box the sheet is drawn into: where the travel is framed, and where the tokens are read. */
  stageRef?: RefObject<HTMLElement | null>;
  /** What each key is — the boxes the frame is the union of (I-86). */
  facts: SheetFacts;
  cameraRef?: RefObject<Camera | null>;
  moveCamera?: (move: (held: Camera) => Camera, live: boolean) => void;
  /** Where the travel lands, whether or not a camera is held yet. */
  jumpTo?: (at: Camera) => void;
  /** The arrival, struck once over this many milliseconds — in the basis colour where one is named. */
  pulse?: (durationMs: number, colour?: string) => void;
};

export type UseReveal = {
  /**
   * Travel to what these keys name and strike the arrival. A Trace names the basis the traced number
   * was measured on, and the strike carries that basis's colour (R-UI-022, X-2); the Reveal door
   * names none and the canvas's own pulse colour stands.
   */
  reveal: (keys: readonly string[], basis?: string) => void;
  /** Absent until the first fly-to ever runs, and never written when the address states `v` (I-85). */
  flyto: "flying" | "settled" | null;
};

export function useReveal({ head, stageRef, facts, cameraRef, moveCamera, jumpTo, pulse }: UseRevealOptions): UseReveal {
  const [flyto, setFlyto] = useState<"flying" | "settled" | null>(null);
  /** The fly-to in flight, so a second reveal or a leaving screen cancels the first. */
  const flightRef = useRef(0);
  const stageOf = useHandedRef(stageRef, null);
  const cameraAt = useHandedRef(cameraRef, null);

  const reveal = useCallback(
    (keys: readonly string[], basis?: string): void => {
      const stage = stageOf.current;
      if (stage === null || head?.kind !== "manifest") return;
      const boxes = keys.map((key) => facts.get(key)?.box).filter((box): box is IndexBox => box !== undefined);
      const union = unionBox(boxes);
      // Nothing selected has no box, so a reveal has nowhere to go and does not pretend to travel.
      if (union === null) return;

      const rect = stage.getBoundingClientRect();
      const viewportPx = { width: rect.width, height: rect.height };
      const to = revealCamera(union, viewportPx);
      const from = cameraAt.current ?? fitCamera(head.manifest.extents, viewportPx);
      const { durationMs, ease } = flytoMotion(stage);
      const colour = basisColour(stage, basis);
      const flight = flightRef.current + 1;
      flightRef.current = flight;

      const land = (): void => {
        if (cameraAt.current === null) jumpTo?.(to);
        else moveCamera?.(() => to, false);
        setFlyto("settled");
        pulse?.(durationMs, colour.length > 0 ? colour : undefined);
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
        moveCamera?.(() => flyTo(from, to, elapsed, durationMs, ease), true);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [cameraAt, facts, head, jumpTo, moveCamera, pulse, stageOf],
  );

  return { reveal, flyto };
}

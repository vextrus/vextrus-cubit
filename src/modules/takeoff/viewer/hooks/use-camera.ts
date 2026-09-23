/**
 * The camera, and the settle the address is written on (Decision § 4, R-UI-031).
 *
 * A gesture in flight moves the camera on a ref the painter draws from and publishes nothing: sixty
 * pointer events a second are otherwise sixty React renders of the panel and the readout on the
 * painter's own thread, and sixty history writes, which a browser throttles into a SecurityError.
 * The gesture's last camera is published once it settles; every discrete move — a control, a key, a
 * fit — publishes at once (PB-3, R-UI-031).
 *
 * Where the camera is written is the screen's decision to carry out, not this hook's to make: the
 * address module is the one home for that (B-17), and `publish` is how it is reached from here.
 *
 * AN ADDRESS THAT NAMES NO CAMERA IS A FITTED SHEET, and it stays one (Decision I-317). The fit is
 * not taken once and kept: the stage is measured before the frame's panels have laid out (60 px wide
 * on F-RCC6-BNBC's S-10, 32 ms before it stood at 1080), so a fit taken then and held is a sheet
 * shrunk to a speck. Until the reader moves the camera, every size the stage takes is fitted again;
 * and nothing about that fit is written to the address, because a camera the reader never chose is
 * not the reader's state — the absence of `v` already says "fitted", in whatever box the reader has.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { GESTURE_SETTLE_MS, cameraFromViewport, fitCamera, parseViewport, zoomCameraAt } from "../client";
import type { Camera, ViewerHead } from "../types";
import { useHandedRef } from "./use-handed-ref";

/**
 * How long after the last gesture event the address is rewritten (Decision § 4's settle). The
 * settle has one home, beside the camera: the painter draws the sheet in full on the same one (I-345).
 */
export const ADDRESS_SETTLE_MS = GESTURE_SETTLE_MS;

/** How far one press of a zoom control moves the camera. */
export const ZOOM_STEP = 1.25;

/**
 * The smallest stage, on either side, a fit is SETTLED against (I-317). Below it the box is one the
 * frame has not laid out yet — a resizable panel still at `flex: 1 1 0px` measures a few dozen
 * pixels — rather than a canvas anybody reads a sheet in; the narrowest real canvas the frame leaves
 * (a 1024 px window, the drawer at its widest, the inspector pinned) is well over twice this.
 */
export const MIN_FIT_STAGE_PX = 120;

/** Whether a measured stage is one a fit may settle against. */
function laidOut(box: { width: number; height: number }): boolean {
  return box.width >= MIN_FIT_STAGE_PX && box.height >= MIN_FIT_STAGE_PX;
}

export type UseCameraOptions = {
  head: ViewerHead | null;
  /** The `v` parameter as the address carries it, or null where it carries none. */
  initialViewport: string | null;
  /** The box the sheet is drawn into — the camera is fitted to it and follows it. */
  stageRef: RefObject<HTMLElement | null>;
  /** Where the camera stands right now, off the render loop: the painter and the gestures read it. */
  cameraRef?: RefObject<Camera | null>;
  /** Paint this camera now. A frame is not a render (PB-3). */
  draw: (at: Camera) => void;
  /** Write this camera to the address. What that means is the address module's (B-17). */
  publish: (at: Camera) => void;
  /** The address the sheet on screen is being shown at — what `publish` writes to (R-UI-031). */
  ownPathname?: RefObject<string>;
  /** Which sheet is on screen: a move to another one is a move to another address. */
  sheetKey?: string;
};

export type UseCamera = {
  camera: Camera | null;
  /** Move the camera. A live move draws now and settles the address; a discrete one writes it now. */
  moveCamera: (move: (held: Camera) => Camera, live: boolean) => void;
  /** Put the camera somewhere outright, whether or not one is held yet. */
  jumpTo: (at: Camera) => void;
  /** Write the camera the gesture is holding now rather than when its settle fires. */
  flushAddress: () => void;
  fitSheet: () => void;
  zoomBy: (factor: number) => void;
};

export function useCamera({ head, initialViewport, stageRef, cameraRef, draw, publish, ownPathname, sheetKey }: UseCameraOptions): UseCamera {
  const [camera, setCamera] = useState<Camera | null>(null);
  const stage = useHandedRef(stageRef, null);
  const heldRef = useHandedRef(cameraRef, null);
  const ownPath = useHandedRef(ownPathname, "");
  /** The settle a gesture's last frame is published on. */
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Whether the sheet stands at the fit the address asked for by naming no camera (I-317). True from
   * an open with no `v` until the reader first moves the camera — a gesture, a control, a key, a
   * reveal — and while it is true every size the stage takes is fitted again and nothing is written.
   */
  const autoFit = useRef(false);

  /**
   * Every camera this sheet takes comes through here: one frame now, and — unless the camera is the
   * open's own fit, which is no reader's state — one address write, once.
   */
  const apply = useCallback(
    (at: Camera, live: boolean, published = true): void => {
      heldRef.current = at;
      draw(at);
      if (settleRef.current !== null) clearTimeout(settleRef.current);
      settleRef.current = null;
      if (!live) {
        setCamera(at);
        if (published) publish(at);
        return;
      }
      settleRef.current = setTimeout(() => {
        settleRef.current = null;
        const last = heldRef.current;
        if (last === null) return;
        setCamera(last);
        publish(last);
      }, ADDRESS_SETTLE_MS);
    },
    [draw, heldRef, publish],
  );

  // A move is the reader's (or a reveal travelling for them): the sheet stops re-fitting from here on.
  const moveCamera = useCallback(
    (move: (held: Camera) => Camera, live: boolean): void => {
      const held = heldRef.current;
      if (held === null) return;
      autoFit.current = false;
      apply(move(held), live);
    },
    [apply, heldRef],
  );

  const jumpTo = useCallback(
    (at: Camera): void => {
      autoFit.current = false;
      apply(at, false);
    },
    [apply],
  );

  /**
   * The gesture's last camera written to the address now rather than when its settle fires. A reader
   * who copies the address, follows a link or closes the tab inside the settle window would
   * otherwise carry the viewport the gesture started from — the throttle may delay the write, but it
   * may not lose it (R-UI-031).
   */
  const flushAddress = useCallback((): void => {
    if (settleRef.current === null) return;
    clearTimeout(settleRef.current);
    settleRef.current = null;
    const at = heldRef.current;
    if (at === null) return;
    publish(at);
    setCamera(at);
  }, [heldRef, publish]);

  // The address the sheet on screen is being shown at, read again whenever the sheet changes: an
  // instance the framework keeps across a move to another drawing or layout must publish to the
  // address it is now on, never go on stamping the one it opened at (R-UI-031).
  useEffect(() => {
    if (typeof window === "undefined") return;
    ownPath.current = window.location.pathname;
  }, [ownPath, sheetKey]);

  // An address that names no viewport opens the whole sheet, fitted to the box it is drawn into, and
  // writes nothing — the absence of `v` is how a fitted sheet is spelled (I-317). One that names a
  // viewport is the camera the reader gets, exactly as it always was (R-UI-031, I-85).
  useEffect(() => {
    if (head?.kind !== "manifest") return;
    const box = stage.current?.getBoundingClientRect();
    const viewportPx = { width: box?.width ?? 0, height: box?.height ?? 0 };
    const asked = initialViewport === null ? null : parseViewport(initialViewport);
    autoFit.current = asked === null;
    if (asked !== null) {
      apply(cameraFromViewport(asked, viewportPx), false);
      return;
    }
    // A stage the frame has not laid out yet is fitted only where there is no camera at all — so a
    // sheet always has one to paint and read out — and never over a camera already held: the next
    // size the stage takes is fitted again, and that is the fit that stands.
    if (heldRef.current === null || laidOut(viewportPx)) apply(fitCamera(head.manifest.extents, viewportPx), false, false);
  }, [apply, head, heldRef, initialViewport, stage]);

  // The camera follows the box it is drawn into, so a resized panel keeps the same sheet in view.
  // While the sheet stands at the open's own fit, "the same sheet" is the whole sheet: every size a
  // laid-out stage takes is fitted again, and nothing is written (I-317). Once the reader has moved
  // the camera it is theirs, and a resize keeps its centre and its scale.
  useEffect(() => {
    const element = stage.current;
    if (element === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      const box = { width: rect.width, height: rect.height };
      const held = heldRef.current;
      if (held === null) return;
      if (autoFit.current) {
        if (head?.kind === "manifest" && laidOut(box)) apply(fitCamera(head.manifest.extents, box), false, false);
        else apply({ ...held, viewport: box }, false, false);
        return;
      }
      // Off the camera the gesture holds, never the one React last published: a panel resized while
      // a drag or a wheel is in flight would otherwise write the pre-gesture camera back and throw
      // the pan away.
      apply({ ...held, viewport: box }, false);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [apply, head, heldRef, stage]);

  // A reader who leaves inside the settle window carries where they are, not where they started.
  useEffect(() => {
    const onLeaving = (): void => flushAddress();
    document.addEventListener("visibilitychange", onLeaving);
    window.addEventListener("pagehide", onLeaving);
    return () => {
      document.removeEventListener("visibilitychange", onLeaving);
      window.removeEventListener("pagehide", onLeaving);
      flushAddress();
    };
  }, [flushAddress]);

  const zoomBy = useCallback(
    (factor: number): void => {
      moveCamera((held) => zoomCameraAt(held, factor, { x: held.viewport.width / 2, y: held.viewport.height / 2 }), false);
    },
    [moveCamera],
  );

  // The Fit control is a reader's move like any other: it is written to the address (the camera a
  // reader framed is the camera their link carries) and it ends the open's own re-fitting.
  const fitSheet = useCallback((): void => {
    if (head?.kind !== "manifest") return;
    const box = stage.current?.getBoundingClientRect();
    autoFit.current = false;
    apply(fitCamera(head.manifest.extents, { width: box?.width ?? 0, height: box?.height ?? 0 }), false);
  }, [apply, head, stage]);

  return { camera, moveCamera, jumpTo, flushAddress, fitSheet, zoomBy };
}

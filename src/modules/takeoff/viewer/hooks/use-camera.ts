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
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { cameraFromViewport, fitCamera, parseViewport, zoomCameraAt } from "../client";
import type { Camera, ViewerHead } from "../types";
import { useHandedRef } from "./refs";

/** How long after the last gesture event the address is rewritten (Decision § 4's settle). */
export const ADDRESS_SETTLE_MS = 150;

/** How far one press of a zoom control moves the camera. */
export const ZOOM_STEP = 1.25;

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

export function useCamera({ head, initialViewport, stageRef, cameraRef, draw, publish }: UseCameraOptions): UseCamera {
  const [camera, setCamera] = useState<Camera | null>(null);
  const stage = useHandedRef(stageRef, null);
  const heldRef = useHandedRef(cameraRef, null);
  /** The settle a gesture's last frame is published on. */
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Every camera this sheet takes comes through here: one frame now, one address write, once. */
  const apply = useCallback(
    (at: Camera, live: boolean): void => {
      heldRef.current = at;
      draw(at);
      if (settleRef.current !== null) clearTimeout(settleRef.current);
      settleRef.current = null;
      if (!live) {
        setCamera(at);
        publish(at);
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

  const moveCamera = useCallback(
    (move: (held: Camera) => Camera, live: boolean): void => {
      const held = heldRef.current;
      if (held === null) return;
      apply(move(held), live);
    },
    [apply, heldRef],
  );

  const jumpTo = useCallback((at: Camera): void => apply(at, false), [apply]);

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

  // An address that names no viewport opens the whole sheet, fitted to the box it is drawn into; one
  // that names a viewport is the camera the reader gets (R-UI-031).
  useEffect(() => {
    if (head?.kind !== "manifest") return;
    const box = stage.current?.getBoundingClientRect();
    const viewportPx = { width: box?.width ?? 0, height: box?.height ?? 0 };
    const asked = initialViewport === null ? null : parseViewport(initialViewport);
    apply(asked === null ? fitCamera(head.manifest.extents, viewportPx) : cameraFromViewport(asked, viewportPx), false);
  }, [apply, head, initialViewport, stage]);

  // The camera follows the box it is drawn into, so a resized panel keeps the same sheet in view.
  useEffect(() => {
    const element = stage.current;
    if (element === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const box = element.getBoundingClientRect();
      // Off the camera the gesture holds, never the one React last published: a panel resized while
      // a drag or a wheel is in flight would otherwise write the pre-gesture camera back and throw
      // the pan away.
      moveCamera((held) => ({ ...held, viewport: { width: box.width, height: box.height } }), false);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [head, moveCamera, stage]);

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

  const fitSheet = useCallback((): void => {
    if (head?.kind !== "manifest") return;
    const box = stage.current?.getBoundingClientRect();
    apply(fitCamera(head.manifest.extents, { width: box?.width ?? 0, height: box?.height ?? 0 }), false);
  }, [apply, head, stage]);

  return { camera, moveCamera, jumpTo, flushAddress, fitSheet, zoomBy };
}

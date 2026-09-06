/**
 * The camera a sheet is seen through, and the settle the address is written on (R-UI-031, PB-3).
 *
 * A gesture in flight moves the camera on the ref the painter draws from and publishes nothing:
 * sixty pointer events a second are otherwise sixty React renders of the panel and the readout on
 * the painter's own thread, and sixty history writes, which a browser throttles into a SecurityError.
 * The gesture's last camera is published once it settles; every discrete move — a control, a key, a
 * fit — publishes at once, and a reader who leaves inside the settle window carries where they are
 * rather than where they started.
 *
 * Where the address is written is not decided here (ARCH-01, B-17): `publish` is handed in by the
 * screen that owns the route, and this module only decides when it is called.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cameraFromViewport, fitCamera, parseViewport, zoomCameraAt } from "../client";
import type { Camera, ViewerHead } from "../types";

/** How long after the last gesture event the address is rewritten (Decision § 4's settle). */
export const ADDRESS_SETTLE_MS = 150;

/** How far one press of a zoom control moves the camera. */
export const ZOOM_STEP = 1.25;

export interface CameraOptions {
  head: ViewerHead | null;
  /** The `v` parameter as the address carries it, or null where it carries none. */
  initialViewport: string | null;
  /** The box the sheet is drawn into — what a camera is fitted to and resized with. */
  stageRef: { current: HTMLElement | null };
  /** A frame at this camera, now. */
  draw: (camera: Camera) => void;
  /** The camera written to the address, by whoever owns the address (R-UI-031). */
  publish: (camera: Camera) => void;
  /** The camera the painter and the gestures read, where the screen shares one with them. */
  cameraRef?: { current: Camera | null };
}

export interface CameraControl {
  /** The camera as React holds it — a gesture in flight is ahead of this on purpose. */
  camera: Camera | null;
  /** The camera as it stands this instant, gesture included. */
  cameraRef: { current: Camera | null };
  moveCamera: (move: (held: Camera) => Camera, live: boolean) => void;
  /** The gesture's last camera written to the address now rather than when its settle fires. */
  flushAddress: () => void;
  /** Straight to this camera, whether or not one is held yet. */
  jumpTo: (to: Camera) => void;
  fitSheet: () => void;
  zoomBy: (factor: number) => void;
  /** The address written again with the camera as it stands — what is held changed, not the view. */
  republish: () => void;
}

export function useCamera({ head, initialViewport, stageRef, draw, publish, cameraRef: shared }: CameraOptions): CameraControl {
  const [camera, setCamera] = useState<Camera | null>(null);
  const ownCamera = useRef<Camera | null>(null);
  const cameraRef = shared ?? ownCamera;
  /** The settle a gesture's last frame is published on. */
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (head?.kind !== "manifest") return;
    const box = stageRef.current?.getBoundingClientRect();
    const viewportPx = { width: box?.width ?? 0, height: box?.height ?? 0 };
    const asked = initialViewport === null ? null : parseViewport(initialViewport);
    setCamera(asked === null ? fitCamera(head.manifest.extents, viewportPx) : cameraFromViewport(asked, viewportPx));
    // A ref handed in is a box, not a value: it is read when the effect runs and is never a
    // dependency of one. A re-fit keyed on the box's identity would throw away every pan a reader
    // ever made, the first time the screen around it re-rendered for any other reason.
  }, [head, initialViewport]);

  useEffect(() => {
    cameraRef.current = camera;
    if (camera === null) return;
    draw(camera);
    publish(camera);
  }, [camera, draw, publish]);

  const moveCamera = useCallback(
    (move: (held: Camera) => Camera, live: boolean): void => {
      const held = cameraRef.current;
      if (held === null) return;
      const next = move(held);
      cameraRef.current = next;
      draw(next);
      if (settleRef.current !== null) clearTimeout(settleRef.current);
      settleRef.current = null;
      if (!live) {
        setCamera(next);
        return;
      }
      settleRef.current = setTimeout(() => {
        settleRef.current = null;
        setCamera(cameraRef.current);
      }, ADDRESS_SETTLE_MS);
    },
    [cameraRef, draw],
  );

  /**
   * A reader who copies the address, follows a link or closes the tab inside the settle window would
   * otherwise carry the viewport the gesture started from — the throttle may delay the write, but it
   * may not lose it (R-UI-031).
   */
  const flushAddress = useCallback((): void => {
    if (settleRef.current === null) return;
    clearTimeout(settleRef.current);
    settleRef.current = null;
    const at = cameraRef.current;
    if (at === null) return;
    publish(at);
    setCamera(at);
  }, [publish]);

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

  // The camera follows the box it is drawn into, so a resized panel keeps the same sheet in view.
  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const box = stage.getBoundingClientRect();
      // Off the camera the gesture holds, never the one React last published: a panel resized while
      // a drag or a wheel is in flight would otherwise write the pre-gesture camera back and throw
      // the pan away.
      moveCamera((held) => ({ ...held, viewport: { width: box.width, height: box.height } }), false);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [head, moveCamera]);

  const jumpTo = useCallback(
    (to: Camera): void => {
      if (cameraRef.current === null) setCamera(to);
      else moveCamera(() => to, false);
    },
    [cameraRef, moveCamera],
  );

  const fitSheet = useCallback((): void => {
    if (head?.kind !== "manifest") return;
    const box = stageRef.current?.getBoundingClientRect();
    jumpTo(fitCamera(head.manifest.extents, { width: box?.width ?? 0, height: box?.height ?? 0 }));
  }, [head, jumpTo]);

  const zoomBy = useCallback(
    (factor: number): void => {
      moveCamera(
        (held) =>
          zoomCameraAt(held, factor, {
            x: held.viewport.width / 2,
            y: held.viewport.height / 2,
          }),
        false,
      );
    },
    [moveCamera],
  );

  const republish = useCallback((): void => {
    const at = cameraRef.current;
    if (at !== null) publish(at);
  }, [publish]);

  return { camera, cameraRef, moveCamera, flushAddress, jumpTo, fitSheet, zoomBy, republish };
}

"use client";
/**
 * S-Viewer's client screen (Decision § 1): the layers panel beside the sheet, the sheet itself on a
 * WebGL canvas, and the readout under both.
 *
 * Every concern of the sheet is a hook of its own under `modules/takeoff/viewer/hooks/`, and this
 * file composes them: it owns the elements they are drawn on, the address they are asked at, the
 * address they are published to, and the words the three unhappy answers are said in. Nothing here
 * runs an effect — the feed, the painter, the camera, the index, the selection, the fly-to and the
 * gestures each hold their own, one concern to a module (B-17, ARCH-01).
 *
 * The three unhappy answers stay apart (ARCH-03): a reading nothing can be drawn from is the
 * registered refusal with its facts, an ended session and a workspace this reader does not hold are
 * the register's own codes through the same one renderer, and a drawing nobody has read yet is an
 * absence that teaches rather than an error.
 */
import "./viewer.css";

import { useCallback, useMemo, useRef } from "react";
import { REFUSALS } from "../../../../../../../../../core/errors";
import { useCamera, ZOOM_STEP } from "../../../../../../../../../modules/takeoff/viewer/hooks/use-camera";
import { useHitTesting } from "../../../../../../../../../modules/takeoff/viewer/hooks/use-hit-testing";
import { useKeyboard } from "../../../../../../../../../modules/takeoff/viewer/hooks/use-keyboard";
import { useLayers } from "../../../../../../../../../modules/takeoff/viewer/hooks/use-layers";
import { useManifest } from "../../../../../../../../../modules/takeoff/viewer/hooks/use-manifest";
import { usePainter } from "../../../../../../../../../modules/takeoff/viewer/hooks/use-painter";
import { usePointer } from "../../../../../../../../../modules/takeoff/viewer/hooks/use-pointer";
import { useReveal } from "../../../../../../../../../modules/takeoff/viewer/hooks/use-reveal";
import { useSelection } from "../../../../../../../../../modules/takeoff/viewer/hooks/use-selection";
import type { Camera, RenderLayer, ViewerHead } from "../../../../../../../../../modules/takeoff/viewer";
import type { RefusalEvidence } from "../../../../../../../../../ui/patterns/refusal-state";
import { shellHref } from "../../../../../../../../../ui/shell";
import { fill, strings } from "../../../../../../../../../ui/strings";
import { publishViewport } from "./address";
import { layoutNameOf } from "./route-address";
import { StatusLine } from "./status-line";
import { WorkArea } from "./work-area";

/** What the route hands the screen. `head` is supplied only where a mount is judged without a server. */
export type ViewerScreenProps = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  layoutName: string;
  /** The `v` parameter as the address carries it, or null where it carries none. */
  initialViewport: string | null;
  /** The `s` parameter as the address carries it, or null where it carries none. */
  initialSelection: string | null;
  head?: ViewerHead;
};

export function ViewerScreen({ tenantId, projectId, drawingId, layoutName, initialViewport, initialSelection, head: supplied }: ViewerScreenProps) {
  /**
   * The sheet this address names. `layoutName` is the path segment the route was opened at, which
   * Next hands a page exactly as the path spells it — `FOUNDATION%20PLAN` for a sheet whose name
   * carries a space — so the segment is read once, here, and the sheet's own name is what is shown
   * to a reader and asked of the feed (B-17, R-UI-031).
   */
  const sheetName = layoutNameOf(layoutName);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  /** The camera as it stands this instant, shared by the painter, the index and every gesture. */
  const cameraRef = useRef<Camera | null>(null);
  /** The keys held, off the render loop: a gesture publishes the address without a stale closure. */
  const heldRef = useRef<readonly string[]>([]);

  /**
   * The one place an arrived layer fans out to everything that reads one, bound below once they have
   * all been composed. The feed hands a layer over exactly once and knows nothing of who wants it.
   */
  const arrival = useRef<{ layer: (layer: RenderLayer) => void; failed: (name: string, failed: boolean) => void }>({
    layer: () => undefined,
    failed: () => undefined,
  });
  const onLayer = useCallback((layer: RenderLayer): void => arrival.current.layer(layer), []);
  const onLayerFailed = useCallback((name: string, failed: boolean): void => arrival.current.failed(name, failed), []);

  const feed = useCallback(
    (query: string) => `/api/viewer/${drawingId}/${encodeURIComponent(sheetName)}?tenant=${encodeURIComponent(tenantId)}&${query}`,
    [drawingId, sheetName, tenantId],
  );

  const manifest = useManifest({ supplied, feed, onLayer, onLayerFailed });
  const head = manifest.head;
  const layers = useLayers({ head });
  const painter = usePainter({ head, canvasRef, stageRef, statusRef, stateRef: layers.stateRef, cameraRef, refused: manifest.denied !== null });

  /**
   * The address this sheet was opened at, captured before anything can navigate away from it: a
   * flush that settles after the reader has left must be able to tell that it has. It is read again
   * whenever the sheet changes, so an instance the framework keeps across a move to another drawing
   * or layout goes on publishing to the address it is now showing (R-UI-031).
   */
  const ownPathname = useMemo(() => (typeof window === "undefined" ? "" : window.location.pathname), [drawingId, layoutName]);
  /** R-UI-031: the address is the camera and the selection, written by the one module that decides
   *  that (B-17). What is held is read off its ref, so a camera published from a settling gesture
   *  carries whatever is held at that moment rather than what was held when it started. */
  const publish = useCallback(
    (at: Camera): void => {
      if (typeof window === "undefined") return;
      publishViewport(window, ownPathname, at, heldRef.current);
    },
    [ownPathname],
  );

  const camera = useCamera({ head, initialViewport, stageRef, cameraRef, draw: painter.draw, publish });
  const hits = useHitTesting({ head, cameraRef, statusRef, stateRef: layers.stateRef });
  const held = useSelection({
    head, drawingId, layoutName, initialSelection, initialViewport, cameraRef, draw: painter.draw, republish: camera.republish,
    loadedLayers: manifest.loadedLayers, failedCount: layers.failedCount, revision: layers.revision,
    drawnLayers: layers.drawnLayers, painterRef: painter.painterRef,
  });
  heldRef.current = held.selection;

  const flight = useReveal({
    head, stageRef, cameraRef, heldRef, facts: held.facts, request: held.reveal,
    moveCamera: camera.moveCamera, jumpTo: camera.jumpTo, pulse: painter.pulse,
  });
  const pointer = usePointer({
    head, canvasRef, cameraRef, painterRef: painter.painterRef, facts: held.facts, draw: painter.draw,
    moveCamera: camera.moveCamera, ask: hits.ask, keysUnder: hits.keysUnder,
    openLayers: layers.openLayers, hold: held.hold, toggleKey: held.toggleKey,
  });
  const keyboard = useKeyboard({ moveCamera: camera.moveCamera, zoomBy: camera.zoomBy, fitSheet: camera.fitSheet, hold: held.hold });

  arrival.current = {
    layer: (layer) => {
      held.learn(layer);
      painter.take(layer);
      hits.take(layer);
    },
    failed: layers.markFailed,
  };

  const evidence: RefusalEvidence = useMemo(
    () => ({ href: shellHref(tenantId, "projects"), label: strings.viewer_evidence_project }),
    [tenantId],
  );

  /**
   * A feed that refused, named from the register with the evidence a reader can act on (ARCH-03).
   * The evidence a denied reader can act on is their own workspace, not the signed-out home the
   * label does not promise — a refusal's link lands on the address it names (R-UI-020).
   */
  const refusal = useMemo(() => {
    if (manifest.denied === 401) {
      return { refusal: REFUSALS.SIGNED_OUT, evidence: { href: "/sign-in", label: strings.shell_evidence_sign_in } };
    }
    if (manifest.denied === 403) {
      return { refusal: REFUSALS.WORKSPACE_PERMISSION_NOT_HELD, evidence: { href: shellHref(tenantId, "projects"), label: strings.shell_denied_evidence } };
    }
    return null;
  }, [manifest.denied, tenantId]);

  // A head that could not be read at all is raised into the render, where the root error boundary —
  // the tree's one home for a fault — takes it (ARCH-03, I-81).
  if (manifest.failure !== null) throw manifest.failure;

  const canvasLabel = fill(strings.viewer_canvas_label, { layout: sheetName });

  return (
    <div className="cx-viewer" data-testid="viewer-screen" data-project={projectId} data-flyto={flight.flyto ?? undefined}>
      {/* The sheet names itself once, as the house style has every screen do: heading navigation
          lands on the sheet a reader opened rather than nowhere (R-UI-050's siblings, axe). */}
      <h1 className="cx-viewer-hidden">{canvasLabel}</h1>
      <div className="cx-viewer-work">
        <WorkArea
          tenantId={tenantId}
          canvasLabel={canvasLabel}
          head={head}
          refusal={refusal}
          evidence={evidence}
          layers={{
            rows: layers.rows,
            setVisible: layers.setVisible,
            isolate: layers.isolate,
            lock: layers.lock,
            retry: (name) => manifest.retryLayer(layers.rows.findIndex((row) => row.name === name), name),
            // A whole layer taken, in the order the index answers it — the keyboard path to a
            // selection; the keys this sheet never met are not rows and are not held.
            selectLayer: (name) => void hits.ask({ kind: "layer", layer: name }).then((keys) => held.hold(keys.filter((key) => held.facts.has(key)))),
          }}
          stage={{
            stageRef, canvasRef, pointer, probed: painter.probed, renderer: painter.renderer,
            onKeyDown: keyboard.onKeyDown, fitSheet: camera.fitSheet,
            zoomIn: () => camera.zoomBy(ZOOM_STEP), zoomOut: () => camera.zoomBy(1 / ZOOM_STEP),
          }}
          inspector={{
            hover: pointer.hovered,
            selection: held.selected,
            missing: held.missing,
            // The source key on the clipboard, exactly as it stands — nothing stripped, nothing
            // trimmed (R-TO-011). A browser that refuses the write refuses this promise, and the row
            // goes on offering the copy rather than claiming to have made one.
            onCopy: (key) => navigator.clipboard.writeText(key),
            onReveal: () => flight.reveal(),
            onClear: () => held.hold([]),
          }}
        />
      </div>
      <StatusLine
        statusRef={statusRef}
        layoutName={sheetName}
        sheet={camera.camera !== null && head?.kind === "manifest"}
        scale={camera.camera?.scale ?? 0}
        loadedLayers={manifest.loadedLayers}
        totalLayers={head?.kind === "manifest" ? head.manifest.layers.length : 0}
        drawnEntities={layers.state.drawnEntityCount()}
        entityCount={layers.state.entityCount()}
        selectionCount={held.selected.length}
        firstPaint={painter.firstPaint}
        renderer={painter.renderer}
        partial={layers.rows.some((row) => row.failed)}
      />
    </div>
  );
}

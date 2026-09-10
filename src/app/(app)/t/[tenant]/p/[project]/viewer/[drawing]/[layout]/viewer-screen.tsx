"use client";
/**
 * S-Viewer's client screen (Decision § 1): the layers panel beside the sheet, the sheet itself on a
 * WebGL canvas, and the readout under both.
 *
 * The screen is composition and nothing else. Every effect the sheet runs — the feed, the layer
 * posture, the painter, the camera and its settle, the index in its worker, what is held, the
 * reveal, the pointer and the keyboard — is one hook of its own under
 * `src/modules/takeoff/viewer/hooks/`; what is left here is the wiring, the markup, and the two
 * things a module may not reach (ARCH-01): the address, whose one home is `./address.ts` (B-17),
 * and the string table.
 *
 * The three unhappy answers stay apart (ARCH-03): a reading nothing can be drawn from is the
 * registered refusal with its facts, an ended session and a workspace this reader does not hold
 * are the register's own codes through the same one renderer, and a drawing nobody has read yet
 * is an absence that teaches rather than an error.
 */
import "./viewer.css";

import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { REFUSALS } from "@/core/errors";
import { useCitedBy, useLineEvidence } from "@/modules/takeoff/trace/use-trace";
import type { Camera, RenderLayer, ViewerHead } from "@/modules/takeoff/viewer";
import type { Painter } from "@/modules/takeoff/viewer/painter";
import { createSheetFacts, learn } from "@/modules/takeoff/viewer/hooks/facts";
import { useCamera } from "@/modules/takeoff/viewer/hooks/use-camera";
import { useHitTesting } from "@/modules/takeoff/viewer/hooks/use-hit-testing";
import { useKeyboard } from "@/modules/takeoff/viewer/hooks/use-keyboard";
import { useLayers } from "@/modules/takeoff/viewer/hooks/use-layers";
import { useManifest } from "@/modules/takeoff/viewer/hooks/use-manifest";
import { usePainter } from "@/modules/takeoff/viewer/hooks/use-painter";
import { usePointer } from "@/modules/takeoff/viewer/hooks/use-pointer";
import { useReveal } from "@/modules/takeoff/viewer/hooks/use-reveal";
import { useSelection } from "@/modules/takeoff/viewer/hooks/use-selection";
import type { SnapCalibration } from "@/modules/takeoff/viewer-snap/snap";
import { fill, strings } from "@/ui/strings";
import { publishViewport } from "./address";
import { readLineEvidence, readLinesCiting } from "./trace-actions";
import { useScaleRegion, type ScaleDoors } from "./scale-region";
import { useSnapRegion } from "./snap-region";
import { usePartitionRegion } from "./partition-region";
import { SheetAbsence } from "./viewer-bones";
import { layoutNameOf } from "./route-address";
import { StatusLine } from "./status-line";
import { AbsentSheetInspector, ViewerStage } from "./viewer-stage";

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
  /** The `line` parameter: the register row a Trace was followed from (R-UI-022). */
  initialLine?: string | null;

  head?: ViewerHead;
  /** The scale of record over this sheet. Supplied only where a mount is judged without a server. */
  calibration?: SnapCalibration | null;
  /** The scale region's three doors. Supplied only where a mount is judged without a server. */
  scale?: ScaleDoors;
};

export function ViewerScreen({ tenantId, projectId, drawingId, layoutName, initialViewport, initialSelection, initialLine = null, head: supplied, calibration: suppliedCalibration, scale: suppliedScale }: ViewerScreenProps) {
  /** The status a door refused this reader with, if one did — the code it maps to is decided below. */
  const [denied, setDenied] = useState<number | null>(null);
  /** This screen's own root element, once it stands: the scale region's act dialog is portalled into
      it rather than to the document's body, so an act raised inside this screen is shown inside it
      (consequence-dialog I-167). It is state and not a ref because the dialog must re-render with the
      element once the first paint has made it. */
  const [screenRoot, setScreenRoot] = useState<HTMLElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const painterRef = useRef<Painter | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  /** The keys held, off the render loop: a gesture publishes the address without a stale closure. */
  const selectionRef = useRef<string[]>([]);
  /** Every layer whose geometry has arrived, and what each source key of it is — one home each. */
  const arrived = useRef<Map<string, RenderLayer>>(new Map());
  const facts = useRef(createSheetFacts()).current;

  /**
   * The sheet this address names. Next hands a page its `[layout]` segment exactly as the path
   * spells it — `FOUNDATION%20PLAN` for a sheet whose name carries a space — so the segment is read
   * once, here, and the sheet's own name is shown to a reader and asked of the feed (B-17).
   */
  const sheetName = layoutNameOf(layoutName);
  const feed = useCallback((query: string) => `/api/viewer/${drawingId}/${encodeURIComponent(sheetName)}?tenant=${encodeURIComponent(tenantId)}&${query}`, [drawingId, sheetName, tenantId]);

  /**
   * The address this sheet was opened at, captured as this ref is first made rather than in an
   * effect, so a camera published before the effects have run is written rather than dropped. Read
   * again whenever the sheet changes — that reading is an effect, and every effect of this screen is
   * a hook's, so `useCamera` runs it over this ref (R-UI-031).
   */
  const ownPathname = useRef(typeof window === "undefined" ? "" : window.location.pathname);

  /**
   * R-UI-031: the address is the camera and the selection, written by the one module that decides
   * that (B-17). The selection is read off its ref, so a camera published from a settling gesture
   * carries whatever is held at that moment rather than what was held when it started.
   */
  const publish = useCallback((at: Camera): void => {
    if (typeof window === "undefined") return;
    publishViewport(window, ownPathname.current, at, selectionRef.current);
  }, []);

  /** One arrived layer, filed where the painter and the index read it, and read for what it holds. */
  const onLayer = useCallback(
    (layer: RenderLayer): void => {
      arrived.current.set(layer.name, layer);
      learn(facts, layer);
    },
    [facts],
  );

  // The row a failed layer stands on is the posture's to keep (I-81), and the posture is made from
  // the head the feed answers with — so the feed reaches it through what this render last wired.
  const failedSink = useRef<(name: string, failed: boolean) => void>(() => undefined);
  const onLayerFailed = useCallback((name: string, failed: boolean): void => failedSink.current(name, failed), []);

  const sheet = useManifest({ supplied, feed, onLayer, onLayerFailed, onDenied: setDenied });
  const layers = useLayers({ head: sheet.head });
  failedSink.current = layers.markFailed;

  /** Where the views/grid region files its paint, so every sheet frame paints the overlay again at
      the camera the sheet was drawn at (I-112, § 4). The region is composed below, off the camera
      this draw publishes, so the frame reaches it through a ref and not a dependency (PB-3). */
  const overlayPaint = useRef<((at: Camera) => void) | null>(null);
  const draw = useCallback((at: Camera): void => { painterRef.current?.draw(at, layers.stateRef.current); overlayPaint.current?.(at); }, [layers.stateRef]);
  const pulse = useCallback((durationMs: number, colour?: string): void => void painterRef.current?.pulse(durationMs, colour), []);
  // The Trace, both ways (R-UI-022, X-2). A refusal of either read is answered as a status where the sheet's own feed's are (ARCH-03).
  const line = useLineEvidence({ tenantId, projectId, lineId: initialLine, read: readLineEvidence, onRefused: (refusal) => setDenied(refusal === REFUSALS.SIGNED_OUT.code ? 401 : 403) });
  const camera = useCamera({ head: sheet.head, initialViewport, stageRef, cameraRef, draw, publish, ownPathname, sheetKey: `${drawingId}/${layoutName}` });
  const trace = useReveal({ head: sheet.head, stageRef, facts, cameraRef, moveCamera: camera.moveCamera, jumpTo: camera.jumpTo, pulse });
  // The travel waits for the answer naming the basis it is struck in; an address naming no line waits for nothing (I-85).
  const held = useSelection({ facts, head: sheet.head, initialSelection, initialViewport, loadedLayers: sheet.loadedLayers, failedCount: layers.failedCount, revision: layers.revision, reveal: trace.reveal, ...(initialLine === null ? {} : { revealReady: line.ready, revealBasis: line.basis }), selectionRef, cameraRef, publish, drawingId, layoutName });
  const cited = useCitedBy({ tenantId, projectId, drawingId, selection: held.selection, read: readLinesCiting, onRefused: (refusal) => setDenied(refusal === REFUSALS.SIGNED_OUT.code ? 401 : 403) });
  const index = useHitTesting({ head: sheet.head, layers: arrived, loadedLayers: sheet.loadedLayers, stateRef: layers.stateRef, statusRef, cameraRef });
  /** The views/grid region — the partition stored for this sheet, the paint it files above, and the one act
      door behind them — asked for only once the head is a manifest (R-UI-043). A door that refuses the
      PARTITION refuses the region, not the sheet: it renders in that panel's body (R-UI-050's partial).
      It stands ahead of the snapping region because it holds the stored grid the pointer snaps to. */
  /** The scale region — the second tab of the right inspector, and the one door onto every view's
      scale (R-TO-020). It is composed AHEAD of the views/grid region because the absence it reads is
      what that region hatches by: one answer, read once, and no second reading of the scale store
      (I-160, B-17). It is asked at mount rather than when the tab is opened, so a sheet whose views
      no act names is hatched before anyone presses anything. */
  const scale = useScaleRegion({ tenantId, projectId, drawingId, sheetName, enabled: sheet.head?.kind === "manifest", container: screenRoot, supplied: suppliedScale });
  const partition = usePartitionRegion({ tenantId, projectId, drawingId, sheetName, feed, enabled: sheet.head?.kind === "manifest", camera: camera.camera, stageRef, cameraRef, paintRef: overlayPaint, scaleAbsence: scale.absence });
  /** The snapping region: what the pointer meets on the sheet, the scale of record behind the metres
      beside a distance, and the key the roster binds here (R-TO-012, R-UI-041). Its `axes` are the
      stored grid the views/grid region already holds, so the grid store is never read twice (I-149).
      A door that refuses THIS read refuses the sheet's own session, so it renders where the layer
      feed's refusal renders — one door, one session (I-150). */
  const snapping = useSnapRegion({ feed, enabled: sheet.head?.kind === "manifest", supplied: suppliedCalibration, onDenied: setDenied, layers: arrived, stateRef: layers.stateRef, cameraRef, camera: camera.camera, axes: partition.axes });
  const snap = snapping.snap;

  const pointer = usePointer({ head: sheet.head, canvasRef, cameraRef, facts, keysUnder: index.keysUnder, ask: index.ask, openLayers: layers.openLayers, hold: held.hold, toggleKey: held.toggleKey, moveCamera: camera.moveCamera, onHoverWorld: snap.onHover, onLeaveWorld: snap.onLeave, onPick: snap.takePick });
  const keyboard = useKeyboard({
    moveCamera: camera.moveCamera,
    zoomBy: camera.zoomBy,
    fitSheet: camera.fitSheet,
    hold: held.hold,
    isSnapKey: snapping.isSnapKey,
    toggleSnapping: snap.toggleSnapping,
    takePick: snap.takePick,
    clearPicks: snap.clearPicks,
  });
  const paint = usePainter({ head: sheet.head, refused: denied !== null, canvasRef, stageRef, statusRef, painterRef, stateRef: layers.stateRef, cameraRef, layers: arrived, facts, loadedLayers: sheet.loadedLayers, drawnLayers: layers.drawnLayers, selection: held.selection, hovered: pointer.hovered });

  // A head that cannot be read at all is the error state and nothing else: it is raised into the
  // render, where the root error boundary — the tree's one home for a fault — takes it (I-81).
  if (sheet.failure !== null) throw sheet.failure;

  const head = sheet.head;
  // The three answers that are not a drawing — a door's refusal, a reading nothing can be drawn
  // from, and a sheet nobody has read — are one sibling's body, kept apart there (ARCH-03).
  const workArea = (): ReactNode => {
    if (denied !== null || head === null || head.kind !== "manifest") {
      const absence = <SheetAbsence head={head} denied={denied} tenantId={tenantId} projectId={projectId} />;
      // A Trace address names a line as well as a sheet. Where the sheet cannot be drawn the line
      // still can be read, so the inspector stands beside the absence holding the Trace block —
      // missing, failed or ready — rather than leaving the reader with a page about the drawing and
      // nothing about what their address asked for (AC-4). An address naming no line asks nothing,
      // and nothing is placed for it.
      if (initialLine === null || line.block === null) return absence;
      return (
        <div className="cx-viewer-absence-work">
          {absence}
          <AbsentSheetInspector trace={line.block} />
        </div>
      );
    }

    return (
      <ViewerStage
        partition={partition}
        scale={scale}
        panel={{
          rows: layers.rows,
          onVisible: layers.setVisible,
          onIsolate: layers.isolate,
          onLock: layers.setLocked,
          onRetry: (name) => sheet.retryLayer(layers.rows.findIndex((row) => row.name === name), name),
          // A whole layer taken, in the order the index answers it — the keyboard path to a selection.
          onSelectLayer: (name) => void index.ask({ kind: "layer", layer: name }).then((keys) => held.hold(keys.filter((key) => facts.has(key)))),
        }}
        pointer={pointer}
        snap={snap}
        // The source key goes to the clipboard exactly as it stands — nothing stripped, nothing
        // trimmed (R-TO-011). A browser that refuses the write refuses that promise, and the row
        // goes on offering the copy rather than claiming to have made one.
        inspector={{ hover: pointer.hovered, selection: held.selected, missing: held.missing, trace: line.block, cited, onCopy: (key) => navigator.clipboard.writeText(key), onReveal: () => trace.reveal(held.selection), onClear: () => held.hold([]) }}
        onKeyDown={keyboard.onKeyDown}
        stageRef={stageRef}
        canvasRef={canvasRef}
        sheetName={sheetName}
        probed={paint.probed}
        renderer={paint.renderer}
        onFit={camera.fitSheet}
        onZoom={camera.zoomBy}
      />
    );
  };

  return (
    <div className="cx-viewer" ref={setScreenRoot} data-testid="viewer-screen" data-project={projectId} data-flyto={trace.flyto ?? undefined} data-trace-basis={line.basis}>
      {/* The sheet names itself once, as the house style has every screen do: heading navigation
          lands on the sheet a reader opened rather than nowhere (R-UI-050's siblings, axe). */}
      <h1 className="cx-viewer-hidden">{fill(strings.viewer_canvas_label, { layout: sheetName })}</h1>
      <div className="cx-viewer-work">{workArea()}</div>
      <StatusLine
        statusRef={statusRef}
        layoutName={sheetName}
        sheet={camera.camera !== null && head?.kind === "manifest"}
        scale={camera.camera?.scale ?? 0}
        loadedLayers={sheet.loadedLayers}
        totalLayers={head?.kind === "manifest" ? head.manifest.layers.length : 0}
        drawnEntities={layers.state.drawnEntityCount()}
        entityCount={layers.state.entityCount()}
        selectionCount={held.selected.length}
        firstPaint={paint.firstPaint}
        renderer={paint.renderer}
        partial={layers.rows.some((row) => row.failed)}
        snap={snap}
      />
      {partition.dialog}
      {scale.dialog}
    </div>
  );
}

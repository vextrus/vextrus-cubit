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
import { useMeasureRegion, type CardDoors } from "./measure-region";
import type { ChestDoors } from "./measure-chest";
import { useChest, useChestKeys } from "./use-chest-arming";
import { useFramePaint } from "./use-frame-paint";
import { usePartitionRegion } from "./partition-region";
import { SheetAbsence } from "./viewer-bones";
import { useViewerSlots, type ViewerTool } from "./viewer-slots";
import { layoutNameOf } from "./route-address";
import { AbsentSheetWork, ViewerStage } from "./viewer-stage";
import { TESTIDS } from "@/ui/testids";

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
  /** The scale region's, the condition chest's and the card's three doors each. Supplied only where a mount is judged without a server. */
  scale?: ScaleDoors;
  chest?: ChestDoors; card?: CardDoors;
};

export function ViewerScreen({ tenantId, projectId, drawingId, layoutName, initialViewport, initialSelection, initialLine = null, head: supplied, calibration: suppliedCalibration, scale: suppliedScale, chest: suppliedChest, card: suppliedCard }: ViewerScreenProps) {
  /** The status a door refused this reader with, if one did — the code it maps to is decided below. */
  const [denied, setDenied] = useState<number | null>(null);
  /** This screen's own root element, once it stands: the scale region's act dialog is portalled into
      it rather than to the document's body, so an act raised inside this screen is shown inside it
      (consequence-dialog I-167). It is state and not a ref because the dialog must re-render with the
      element once the first paint has made it. */
  const [screenRoot, setScreenRoot] = useState<HTMLElement | null>(null);
  /** The two panel toggles the tool row carries (§3.1's `L≡ V≡`), and the pointer's mode. Posture,
      not data: it belongs to the screen, which is the one thing that knows both regions stand. */
  const [layersOpen, setLayersOpen] = useState(true);
  const [inspectorPinned, setInspectorPinned] = useState(false);
  // The sheet opens in the PAN tool: every gesture sentence of the Decision reads "plain drag pans"
  // and "Shift+drag draws the marquee" (viewer.md §5, the inspector leaf's canvas gestures), and
  // J-011 walks a plain drag that selects nothing. V takes the select tool, where a plain drag is
  // the marquee, and H returns (R-UI-032). Until 2026-09-21 this opened in `select`, so a plain drag
  // on a fresh sheet drew a marquee — J-011's "a plain drag is a pan" passed only while the drawn
  // rectangle happened to hold nothing, and failed the moment the compact density re-fitted the sheet.
  const [tool, setTool] = useState<ViewerTool>("pan");

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

  const { draw, overlayPaint, measurePaint } = useFramePaint(painterRef, layers.stateRef); // the frame paints every region (I-112)
  const pulse = useCallback((durationMs: number, colour?: string): void => void painterRef.current?.pulse(durationMs, colour), []);
  // The Trace, both ways (R-UI-022, X-2). A refusal of either read is answered as a status where the sheet's own feed's are (ARCH-03).
  const line = useLineEvidence({ tenantId, projectId, lineId: initialLine, read: readLineEvidence, onRefused: (refusal) => setDenied(refusal === REFUSALS.SIGNED_OUT.code ? 401 : 403) });
  const camera = useCamera({ head: sheet.head, initialViewport, stageRef, cameraRef, draw, publish, ownPathname, sheetKey: `${drawingId}/${layoutName}` });
  const trace = useReveal({ head: sheet.head, stageRef, facts, cameraRef, moveCamera: camera.moveCamera, jumpTo: camera.jumpTo, pulse });
  // The travel waits for the answer naming the basis it is struck in; an address naming no line waits for nothing (I-85).
  const held = useSelection({ facts, head: sheet.head, initialSelection, initialViewport, loadedLayers: sheet.loadedLayers, failedCount: layers.failedCount, revision: layers.revision, reveal: trace.reveal, ...(initialLine === null ? {} : { revealReady: line.ready, revealBasis: line.basis }), selectionRef, cameraRef, publish, drawingId, layoutName });
  const cited = useCitedBy({ tenantId, projectId, drawingId, selection: held.selection, read: readLinesCiting, onRefused: (refusal) => setDenied(refusal === REFUSALS.SIGNED_OUT.code ? 401 : 403) });
  const index = useHitTesting({ head: sheet.head, layers: arrived, loadedLayers: sheet.loadedLayers, stateRef: layers.stateRef, statusRef, cameraRef });
  /** The scale region — the inspector's second tab, the one door onto every view's scale (R-TO-020) —
      composed AHEAD of the views/grid region, which hatches by the absence it reads: one answer, read
      once, at mount, so an unscaled view is hatched before anyone presses anything (I-160, B-17). The
      views/grid region — the stored partition, its paint and its one act door — is asked only once the
      head is a manifest (R-UI-043); a door that refuses the PARTITION refuses that panel, not the sheet. */
  const scale = useScaleRegion({ tenantId, projectId, drawingId, sheetName, enabled: sheet.head?.kind === "manifest", container: screenRoot, supplied: suppliedScale });
  const partition = usePartitionRegion({ tenantId, projectId, drawingId, sheetName, feed, enabled: sheet.head?.kind === "manifest", camera: camera.camera, stageRef, cameraRef, paintRef: overlayPaint, scaleAbsence: scale.absence });
  /** The snapping region: what the pointer meets, the scale of record behind the metres, and the key the roster binds
      (R-TO-012, R-UI-041), on the grid the views/grid region already holds (I-149); its door's refusal is the sheet's (I-150). */
  const snapping = useSnapRegion({ feed, enabled: sheet.head?.kind === "manifest", supplied: suppliedCalibration, onDenied: setDenied, layers: arrived, stateRef: layers.stateRef, cameraRef, camera: camera.camera, axes: partition.axes });
  const snap = snapping.snap;
  const chested = useChest({ projectId, enabled: sheet.head?.kind === "manifest", tool, doors: suppliedChest }); // ahead of the region (I-374)
  /** The measure region (s-measure § 2): the armed tools on the snapping region's live point, over the views the scale door says are scaled. */
  const measuring = useMeasureRegion({ tool, setTool, snap, cameraRef, stageRef, moveCamera: camera.moveCamera, views: partition.views, unscaled: scale.absence, permitted: scale.state !== "denied", paintRef: measurePaint, picked: chested.chest.picked, sheet: { tenantId, projectId, drawingId, sheetName, recordable: sheet.head?.kind === "manifest" }, container: screenRoot, ...(suppliedCard === undefined ? {} : { cardDoors: suppliedCard }) });
  const measureKey = useChestKeys(chested, measuring);

  const pointer = usePointer({ head: sheet.head, canvasRef, cameraRef, facts, tool, keysUnder: index.keysUnder, ask: index.ask, openLayers: layers.openLayers, hold: held.hold, toggleKey: held.toggleKey, moveCamera: camera.moveCamera, onHoverWorld: snap.onHover, onLeaveWorld: snap.onLeave, onPick: snap.takePick, onMeasureClick: measuring.measure.click, onMeasureAlt: measuring.measure.alt });
  const keyboard = useKeyboard({
    moveCamera: camera.moveCamera, zoomBy: camera.zoomBy, fitSheet: camera.fitSheet, hold: held.hold, setTool, measureKey,
    isSnapKey: snapping.isSnapKey, toggleSnapping: snap.toggleSnapping, takePick: snap.takePick, clearPicks: snap.clearPicks,
  });
  const paint = usePainter({ head: sheet.head, refused: denied !== null, canvasRef, stageRef, statusRef, painterRef, stateRef: layers.stateRef, cameraRef, layers: arrived, facts, loadedLayers: sheet.loadedLayers, drawnLayers: layers.drawnLayers, selection: held.selection, hovered: pointer.hovered });

  /**
   * THE FRAME'S THREE SLOTS (Direction §1, §3.1; R-UI-080). The tool row, the readout and the ONE
   * inspector are the shell's regions and this screen fills them — one hook of its own, like every
   * other effect the sheet runs (`./viewer-slots.tsx`). It answers what to render where no frame
   * claimed a region, which is a jsdom mount of this screen and the gallery's evidence renderer.
   */
  const slots = useViewerSlots({
    denied, head: sheet.head, tool, snap, camera, layersOpen, setLayersOpen, inspectorPinned, setInspectorPinned,
    sheetName, loadedLayers: sheet.loadedLayers, layers, held, paint, statusRef, initialLine, pointer, line, cited, trace, scale, partition, measure: measuring,
  });

  // A head that cannot be read at all is the error state and nothing else: it is raised into the
  // render, where the root error boundary — the tree's one home for a fault — takes it (I-81).
  if (sheet.failure !== null) throw sheet.failure;

  const head = sheet.head;
  // The three answers that are not a drawing — a door's refusal, a reading nothing can be drawn
  // from, and a sheet nobody has read — are one sibling's body, kept apart there (ARCH-03).
  const workArea = (): ReactNode => {
    if (denied !== null || head === null || head.kind !== "manifest")
      return <AbsentSheetWork trace={initialLine === null ? null : line.block} absence={<SheetAbsence head={head} denied={denied} tenantId={tenantId} projectId={projectId} />} />;

    return (
      <ViewerStage
        partition={partition}
        layersOpen={layersOpen}
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
        tool={tool}
        snap={snap}
        measure={{ layer: measuring.layer, refusal: measuring.measure.refusal, onKeyUp: measuring.onKeyUp }}
        chest={chested.chest.panel}
        onKeyDown={keyboard.onKeyDown}
        stageRef={stageRef}
        canvasRef={canvasRef}
        sheetName={sheetName}
        probed={paint.probed}
        renderer={paint.renderer}
      />
    );
  };

  return (
    <div className="cx-viewer" ref={setScreenRoot} data-testid={TESTIDS.viewer.screen} data-screen-root="" data-state={paint.probed ? "ready" : "loading"} data-project={projectId} data-flyto={trace.flyto ?? undefined} data-flyto-flight={trace.flight === 0 ? undefined : String(trace.flight)} data-trace-basis={line.basis}>
      {/* The sheet names itself once, as the house style has every screen do: heading navigation
          lands on the sheet a reader opened rather than nowhere (R-UI-050's siblings, axe). */}
      <h1 className="cx-viewer-hidden">{fill(strings.viewer_canvas_label, { layout: sheetName })}</h1>
      {/* The frame's tool row and readout are the frame's WHERE THERE IS A FRAME. Mounted without
          one — a jsdom mount of this screen, the gallery's evidence renderer — the two regions stand
          here, where they would stand anyway, rather than vanishing into a no-op (`slots.tsx`). */}
      {slots.framedToolbar ? null : slots.toolbar}
      <div className="cx-viewer-work">{workArea()}</div>
      {slots.framedStatus ? null : slots.readout}
      {slots.framedInspector ? null : slots.inspector}
      {partition.dialog}
      {scale.dialog}
    </div>
  );
}

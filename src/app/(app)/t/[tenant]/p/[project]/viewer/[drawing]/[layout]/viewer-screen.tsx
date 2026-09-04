"use client";
/**
 * S-Viewer's client screen (Decision § 1): the layers panel beside the sheet, the sheet itself on a
 * WebGL canvas, and the readout under both.
 *
 * The manifest is never handed down as a server prop. The head — the layer roster, the extents, the
 * digest and the facts the reading recorded — is fetched first, and each layer's geometry after it,
 * one request per layer in roster order, so first paint is the first layer of a heavy sheet rather
 * than the whole of it (R-UI-043, PB-2). A mount that is handed a `head` fetches nothing, which is
 * how a sheet is judged without a server.
 *
 * The three unhappy answers stay apart (ARCH-03): a reading nothing can be drawn from is the
 * registered refusal with its facts, an ended session and a workspace this reader does not hold are
 * the register's own codes through the same one renderer, and a drawing nobody has read yet is an
 * absence that teaches rather than an error.
 */
import "./viewer.css";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { RefusalEntry } from "../../../../../../../../../core/errors";
import { REFUSALS } from "../../../../../../../../../core/errors";
import {
  cameraFromViewport,
  createViewerState,
  fitCamera,
  panCamera,
  parseViewport,
  serialiseViewport,
  worldAt,
  zoomCameraAt,
} from "../../../../../../../../../modules/takeoff/viewer/client";
import type { Camera, RenderLayer, RenderManifest, ViewerHead } from "../../../../../../../../../modules/takeoff/viewer";
import { createPainter, type CanvasPalette, type Painter } from "../../../../../../../../../modules/takeoff/viewer/painter";
import { Button, Skeleton } from "../../../../../../../../../ui/primitives/core";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../../../../../../../../ui/primitives/data";
import { RefusalState, type RefusalEvidence } from "../../../../../../../../../ui/patterns/refusal-state";
import { shellHref } from "../../../../../../../../../ui/shell";
import { fill, strings } from "../../../../../../../../../ui/strings";
import { FidelityFacts } from "./fidelity-facts";
import { LayersPanel } from "./layers-panel";
import { StatusLine } from "./status-line";

/** What the route hands the screen. `head` is supplied only where a mount is judged without a server. */
export type ViewerScreenProps = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  layoutName: string;
  /** The `v` parameter as the address carries it, or null where it carries none. */
  initialViewport: string | null;
  head?: ViewerHead;
};

/** How far one press of a zoom control moves the camera. */
const ZOOM_STEP = 1.25;

/** How far the arrow keys pan, in device-independent pixels (Decision § 1's closed px set). */
const KEYBOARD_PAN_PX = 48;

/** The wheel's own units into a zoom factor — one notch is a small step, a trackpad flick a large one. */
const WHEEL_ZOOM_RATE = 0.0015;

/** How near the pointer a record counts as under it, in pixels, when the index is asked. */
const HIT_TOLERANCE_PX = 4;

/** The rows the panel's bones stand for while the roster is in flight (Decision § 2). */
const LOADING_ROWS = 6;

/** The panel's share of the width, and the band a reader may drag it to (Decision § 1). */
const PANEL_SIZE = 22;
const PANEL_MIN = 14;
const PANEL_MAX = 40;

/** The facts an ingest record carries, as they arrive over the feed. */
type ViewerHeadFacts = Extract<ViewerHead, { kind: "refusal" }>["facts"];

/** One layer as the head publishes it: the swatch and the count, without the geometry. */
type LayerRoster = { name: string; rgb: [number, number, number]; entityCount: number };

/** The head as the feed answers it: the roster without the records, which are asked for one by one. */
type HeadAnswer =
  | {
      kind: "manifest";
      cache: "hit" | "miss";
      facts: ViewerHeadFacts;
      version: 1;
      layoutName: string;
      extents: RenderManifest["extents"];
      insunits: RenderManifest["insunits"];
      digest: string;
      layers: LayerRoster[];
    }
  | { kind: "refusal"; refusal: RefusalEntry; facts: ViewerHeadFacts }
  | { kind: "absent"; reason: "not-ingested" | "layout-unknown" };

/** The three canvas colours and the face text is lettered in, resolved from the tokens (Decision § 5). */
function paletteOf(element: Element): CanvasPalette {
  const style = getComputedStyle(element);
  return {
    paper: style.getPropertyValue("--canvas-paper").trim(),
    ink: style.getPropertyValue("--canvas-ink").trim(),
    grid: style.getPropertyValue("--canvas-grid").trim(),
    mono: style.getPropertyValue("--font-mono").trim(),
  };
}

export function ViewerScreen({ tenantId, projectId, drawingId, layoutName, initialViewport, head: supplied }: ViewerScreenProps) {
  const [head, setHead] = useState<ViewerHead | null>(supplied ?? null);
  const [feedRefusal, setFeedRefusal] = useState<{ refusal: RefusalEntry; evidence: RefusalEvidence } | null>(null);
  /** A head that could not be read at all — raised into the render so the error boundary takes it. */
  const [headFailure, setHeadFailure] = useState<Error | null>(null);
  const [loadedLayers, setLoadedLayers] = useState(supplied?.kind === "manifest" ? supplied.manifest.layers.length : 0);
  const [renderer, setRenderer] = useState<"webgl" | "unavailable">("unavailable");
  /** Whether the browser has been asked for a context yet — before that, nothing is claimed (I-82). */
  const [probed, setProbed] = useState(false);
  const [firstPaint, setFirstPaint] = useState(false);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [, bump] = useReducer((count: number) => count + 1, 0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const painterRef = useRef<Painter | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  /** Every layer whose geometry has arrived, by name — the painter's and the index's shared source. */
  const arrivedRef = useRef<Map<string, RenderLayer>>(new Map());
  const uploadedRef = useRef<Set<string>>(new Set());

  const evidence: RefusalEvidence = useMemo(() => ({ href: shellHref(tenantId, "projects"), label: strings.viewer_evidence_project }), [tenantId]);
  const state = useMemo(() => createViewerState(head ?? { kind: "absent", reason: "not-ingested" }), [head]);
  const rows = state.layerRows();
  const feed = useMemo(() => `/api/viewer/${drawingId}/${encodeURIComponent(layoutName)}`, [drawingId, layoutName]);

  /* --------------------------------------------------------------------- the sheet, layer by layer */

  // The posture the painter and the layer feed read, held on a ref: they run outside React's render
  // and must never be a reason to fetch the sheet again.
  const stateRef = useRef(state);
  stateRef.current = state;

  const flush = useCallback(() => {
    const painter = painterRef.current;
    if (painter === null) return;
    for (const [name, layer] of arrivedRef.current) {
      if (uploadedRef.current.has(name)) continue;
      painter.upload(layer);
      uploadedRef.current.add(name);
    }
    const at = cameraRef.current;
    if (at !== null) painter.draw(at, stateRef.current);
  }, []);

  const takeLayer = useCallback(
    async (index: number, signal?: AbortSignal): Promise<boolean> => {
      const answer = await fetch(`${feed}?part=layer&index=${index}`, signal === undefined ? {} : { signal });
      if (!answer.ok) return false;
      const body = (await answer.json()) as { name: string; rgb: [number, number, number]; entityCount: number; records: RenderLayer["records"] };
      arrivedRef.current.set(body.name, { name: body.name, rgb: body.rgb, entityCount: body.entityCount, records: body.records });
      flush();
      return true;
    },
    [feed, flush],
  );

  useEffect(() => {
    if (supplied !== undefined) {
      for (const layer of supplied.kind === "manifest" ? supplied.manifest.layers : []) arrivedRef.current.set(layer.name, layer);
      return;
    }

    const controller = new AbortController();
    const open = async (): Promise<void> => {
      const answer = await fetch(`${feed}?part=head`, { signal: controller.signal });
      if (answer.status === 401) {
        setFeedRefusal({ refusal: REFUSALS.SIGNED_OUT, evidence: { href: "/sign-in", label: strings.shell_evidence_sign_in } });
        return;
      }
      if (answer.status === 403) {
        setFeedRefusal({ refusal: REFUSALS.WORKSPACE_PERMISSION_NOT_HELD, evidence: { href: "/", label: strings.shell_denied_evidence } });
        return;
      }
      const body = (await answer.json()) as HeadAnswer;
      if (body.kind !== "manifest") {
        setHead(body);
        return;
      }
      setHead({
        kind: "manifest",
        cache: body.cache,
        facts: body.facts,
        manifest: {
          version: body.version,
          layoutName: body.layoutName,
          extents: body.extents,
          insunits: body.insunits,
          digest: body.digest,
          layers: body.layers.map((layer) => ({ ...layer, records: [] })),
        },
      });

      // Layer by layer, in the roster's order: the first one painted is what a heavy sheet shows
      // first, and a layer that does not arrive leaves its row standing (R-UI-043, I-81).
      for (const [index, layer] of body.layers.entries()) {
        if (controller.signal.aborted) return;
        const took = await takeLayer(index, controller.signal);
        if (took) setLoadedLayers((held) => held + 1);
        else stateRef.current.markLayerFailed(layer.name, true);
        bump();
      }
    };

    // A head that cannot be read at all is the error state and nothing else (I-81): it is raised
    // into the render below, where the root error boundary — the tree's one home for a fault — takes
    // it. A fetch cut short by this screen leaving is not a failure anybody must be told about.
    void open().catch((failure: unknown) => {
      if (controller.signal.aborted) return;
      setHeadFailure(failure instanceof Error ? failure : new Error(String(failure)));
    });

    return () => controller.abort();
  }, [feed, supplied, takeLayer]);

  /* ----------------------------------------------------------------------------- the painted sheet */

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (canvas === null || stage === null) return;

    const painter = createPainter(canvas, paletteOf(stage));
    painterRef.current = painter;
    setRenderer(painter === null ? "unavailable" : "webgl");
    setProbed(true);
    if (painter === null) return;

    painter.setFrameListener(() => {
      const status = statusRef.current;
      const stats = painter.frameStats();
      status?.setAttribute("data-frame-median-ms", String(stats.medianMs));
      status?.setAttribute("data-frame-p95-ms", String(stats.p95Ms));
      // First paint is the first geometry on the paper, never the paper alone: a blank sheet drawn
      // before any layer arrived would answer PB-2 with a picture of nothing.
      if (uploadedRef.current.size > 0) setFirstPaint(true);
    });
    flush();

    return () => {
      painter.dispose();
      painterRef.current = null;
      uploadedRef.current.clear();
    };
  }, [flush, head]);

  useEffect(() => {
    const painter = painterRef.current;
    if (painter === null || head?.kind !== "manifest") return;
    painter.setExtents(head.manifest.extents);
  }, [head, renderer]);

  // Nothing to paint is painted at once: a refusal, an absence and a browser with no WebGL are all
  // on screen the moment the head answers, and first paint is what a reader can see (PB-2).
  useEffect(() => {
    if (feedRefusal !== null || (head !== null && head.kind !== "manifest")) setFirstPaint(true);
    // A browser that offers no context, and a sheet whose roster is empty, have both shown
    // everything they have the moment they are asked — but only once they have been asked (I-82).
    if (probed && head?.kind === "manifest" && (renderer === "unavailable" || head.manifest.layers.length === 0)) setFirstPaint(true);
  }, [head, probed, renderer, feedRefusal]);

  /* ------------------------------------------------------------------------------------ the camera */

  useEffect(() => {
    if (head?.kind !== "manifest") return;
    const box = stageRef.current?.getBoundingClientRect();
    const viewportPx = { width: box?.width ?? 0, height: box?.height ?? 0 };
    const asked = initialViewport === null ? null : parseViewport(initialViewport);
    setCamera(asked === null ? fitCamera(head.manifest.extents, viewportPx) : cameraFromViewport(asked, viewportPx));
  }, [head, initialViewport]);

  useEffect(() => {
    cameraRef.current = camera;
    if (camera === null) return;
    painterRef.current?.draw(camera, state);
    // R-UI-031: the address is the camera. It is replaced rather than pushed, so going back leaves
    // the sheet instead of unwinding a pan.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("v", serialiseViewport(camera));
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }, [camera, state]);

  // The camera follows the box it is drawn into, so a resized panel keeps the same sheet in view.
  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const box = stage.getBoundingClientRect();
      setCamera((held) => (held === null ? held : { ...held, viewport: { width: box.width, height: box.height } }));
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [head]);

  // Decision § 6: the canvas cannot inherit a variable, so the three values are read again whenever
  // the document's theme changes and the same sheet is repainted — no refetch, no camera change.
  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      painterRef.current?.setPalette(paletteOf(stage));
      const at = cameraRef.current;
      if (at !== null) painterRef.current?.draw(at, state);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [state]);

  /* ------------------------------------------------------------------------- the index, in a worker */

  useEffect(() => {
    if (head?.kind !== "manifest" || loadedLayers < head.manifest.layers.length || typeof Worker === "undefined") return;
    const worker = new Worker(new URL("../../../../../../../../../modules/takeoff/viewer/spatial.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.postMessage({ id: 0, kind: "index", layers: [...arrivedRef.current.values()] });
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [head, loadedLayers]);

  /* ----------------------------------------------------------------------------------- the gestures */

  const zoomBy = useCallback((factor: number) => {
    setCamera((held) => (held === null ? held : zoomCameraAt(held, factor, { x: held.viewport.width / 2, y: held.viewport.height / 2 })));
  }, []);

  const fit = useCallback(() => {
    if (head?.kind !== "manifest") return;
    const box = stageRef.current?.getBoundingClientRect();
    setCamera(fitCamera(head.manifest.extents, { width: box?.width ?? 0, height: box?.height ?? 0 }));
  }, [head]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const box = canvas.getBoundingClientRect();
      setCamera((held) =>
        held === null ? held : zoomCameraAt(held, Math.exp(-event.deltaY * WHEEL_ZOOM_RATE), { x: event.clientX - box.left, y: event.clientY - box.top }),
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [head]);

  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    // What lies under the pointer is answered by the index in its worker, off this thread (PB-3).
    const at = cameraRef.current;
    const worker = workerRef.current;
    if (at !== null && worker !== null) {
      const box = event.currentTarget.getBoundingClientRect();
      const point = worldAt(at, { x: event.clientX - box.left, y: event.clientY - box.top });
      worker.postMessage({ id: 1, kind: "hit", point, tolerance: HIT_TOLERANCE_PX / at.scale });
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const from = dragRef.current;
    if (from === null) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setCamera((held) => (held === null ? held : panCamera(held, -dx, -dy)));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>): void => {
    const pan = (dx: number, dy: number): void => {
      event.preventDefault();
      setCamera((held) => (held === null ? held : panCamera(held, dx, dy)));
    };
    if (event.key === "+" || event.key === "=") zoomBy(ZOOM_STEP);
    else if (event.key === "-") zoomBy(1 / ZOOM_STEP);
    else if (event.key === "f" || event.key === "F") fit();
    else if (event.key === "ArrowLeft") pan(-KEYBOARD_PAN_PX, 0);
    else if (event.key === "ArrowRight") pan(KEYBOARD_PAN_PX, 0);
    else if (event.key === "ArrowUp") pan(0, -KEYBOARD_PAN_PX);
    else if (event.key === "ArrowDown") pan(0, KEYBOARD_PAN_PX);
  };

  /* ------------------------------------------------------------------------------- what is on screen */

  const retryLayer = (name: string): void => {
    const index = rows.findIndex((row) => row.name === name);
    if (index < 0) return;
    state.markLayerFailed(name, false);
    bump();
    void takeLayer(index).then((took) => {
      if (took) setLoadedLayers((held) => held + 1);
      else state.markLayerFailed(name, true);
      bump();
    });
  };

  const failed = rows.some((row) => row.failed);
  if (headFailure !== null) throw headFailure;

  const workArea = (): ReactNode => {
    if (feedRefusal !== null) return <RefusalState refusal={feedRefusal.refusal} evidence={feedRefusal.evidence} />;
    if (head === null) {
      return (
        <div className="cx-viewer-loading" data-testid="viewer-loading">
          <span className="cx-viewer-hidden">{strings.viewer_loading_label}</span>
          <div className="cx-viewer-bones-panel">
            <Skeleton style={{ height: "16px", width: "96px" }} />
            {Array.from({ length: LOADING_ROWS }, (_, row) => (
              <Skeleton key={row} style={{ height: "var(--row-comfortable)", width: "100%" }} />
            ))}
          </div>
          <Skeleton style={{ height: "100%", width: "100%" }} />
        </div>
      );
    }
    if (head.kind === "refusal") {
      return (
        <div className="cx-viewer-refusal">
          <RefusalState refusal={head.refusal} evidence={evidence} />
          <FidelityFacts facts={head.facts} />
        </div>
      );
    }
    if (head.kind === "absent") {
      const unread = head.reason === "not-ingested";
      return (
        <div className="cx-viewer-empty" data-testid="viewer-empty">
          <h2 className="cx-viewer-empty-heading">{unread ? strings.viewer_empty_unread_heading : strings.viewer_empty_sheet_heading}</h2>
          <p className="cx-viewer-empty-body">{unread ? strings.viewer_empty_unread_body : strings.viewer_empty_sheet_body}</p>
          <a className="cx-btn cx-reticle cx-viewer-empty-action" data-variant="secondary" href={shellHref(tenantId, "projects")}>
            <span className="cx-btn-label">{strings.viewer_evidence_project}</span>
          </a>
        </div>
      );
    }

    return (
      <ResizablePanelGroup direction="horizontal" autoSaveId="cubit-viewer-split">
        <ResizablePanel defaultSize={PANEL_SIZE} minSize={PANEL_MIN} maxSize={PANEL_MAX}>
          <LayersPanel
            rows={rows}
            onVisible={(name, visible) => {
              state.setLayerVisible(name, visible);
              bump();
            }}
            onIsolate={(name) => {
              state.isolateLayer(state.isolatedLayer() === name ? null : name);
              bump();
            }}
            onLock={(name, locked) => {
              state.lockLayer(name, locked);
              bump();
            }}
            onRetry={retryLayer}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>
          <div className="cx-viewer-stage" ref={stageRef}>
            {probed && renderer === "unavailable" ? (
              <div className="cx-viewer-empty">
                <h2 className="cx-viewer-empty-heading">{strings.viewer_no_webgl_heading}</h2>
                <p className="cx-viewer-empty-body">{strings.viewer_no_webgl_body}</p>
              </div>
            ) : null}
            <canvas
              className="cx-viewer-canvas cx-reticle"
              data-testid="viewer-canvas"
              ref={canvasRef}
              role="img"
              tabIndex={0}
              aria-label={fill(strings.viewer_canvas_label, { layout: layoutName })}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
            />
            <div className="cx-viewer-controls">
              <Button variant="secondary" data-testid="viewer-fit" onClick={fit}>
                {strings.viewer_fit}
              </Button>
              <Button variant="secondary" data-testid="viewer-zoom-in" onClick={() => zoomBy(ZOOM_STEP)}>
                {strings.viewer_zoom_in}
              </Button>
              <Button variant="secondary" data-testid="viewer-zoom-out" onClick={() => zoomBy(1 / ZOOM_STEP)}>
                {strings.viewer_zoom_out}
              </Button>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  };

  return (
    <div className="cx-viewer" data-testid="viewer-screen" data-project={projectId}>
      <div className="cx-viewer-work">{workArea()}</div>
      <StatusLine
        statusRef={statusRef}
        layoutName={layoutName}
        scale={camera?.scale ?? 0}
        loadedLayers={loadedLayers}
        totalLayers={head?.kind === "manifest" ? head.manifest.layers.length : 0}
        drawnEntities={state.drawnEntityCount()}
        entityCount={state.entityCount()}
        firstPaint={firstPaint}
        renderer={renderer}
        partial={failed}
      />
    </div>
  );
}

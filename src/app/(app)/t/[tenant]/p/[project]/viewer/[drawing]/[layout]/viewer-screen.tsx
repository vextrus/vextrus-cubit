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
  recordBox,
  recordKey,
  worldAt,
  zoomCameraAt,
  type IndexBox,
} from "../../../../../../../../../modules/takeoff/viewer/client";
import type { Camera, RenderLayer, RenderManifest, RenderRecord, ViewerHead } from "../../../../../../../../../modules/takeoff/viewer";
import type { SpatialAnswer, SpatialAsk, SpatialRequest } from "../../../../../../../../../modules/takeoff/viewer/spatial.worker";
import { createPainter, type CanvasPalette, type Painter } from "../../../../../../../../../modules/takeoff/viewer/painter";
import { flyTo, revealCamera, type EaseControls } from "../../../../../../../../../modules/takeoff/viewer-inspector/flyto";
import { InspectorPanel, type HoverFact, type SelectedEntity } from "../../../../../../../../../modules/takeoff/viewer-inspector/inspector-panel";
import { parseSelection, unionBox } from "../../../../../../../../../modules/takeoff/viewer-inspector/selection";
import { Button, Skeleton } from "../../../../../../../../../ui/primitives/core";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../../../../../../../../ui/primitives/data";
import { RefusalState, type RefusalEvidence } from "../../../../../../../../../ui/patterns/refusal-state";
import { shellHref } from "../../../../../../../../../ui/shell";
import { fill, strings } from "../../../../../../../../../ui/strings";
import { publishViewport } from "./address";
import { layoutNameOf } from "./route-address";
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
  /** The `s` parameter as the address carries it, or null where it carries none. */
  initialSelection: string | null;
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

/** How long after the last gesture event the address is rewritten (Decision § 4's settle). */
const ADDRESS_SETTLE_MS = 150;

/** How far a pointer may travel and still be a click rather than a pan (Decision § 5's px set). */
const CLICK_TRAVEL_PX = 3;

/** The fly-to's duration when the token cannot be read at all — the token's own value (§ 4). */
const FLYTO_FALLBACK_MS = 320;

/** How many numbers a cubic-bezier token carries. */
const EASE_CONTROLS = 4;

/** The rows the panel's bones stand for while the roster is in flight (Decision § 2). */
const LOADING_ROWS = 6;

/** The cells the inspector's own bones stand for while the head is in flight (Decision § 2). */
const LOADING_CELLS = 2;

/** The panel's share of the width, and the band a reader may drag it to (Decision § 1). */
const PANEL_SIZE = 22;
const PANEL_MIN = 14;
const PANEL_MAX = 40;

/** The facts an ingest record carries, as they arrive over the feed. */
type ViewerHeadFacts = Extract<ViewerHead, { kind: "refusal" }>["facts"];

/** One layer as the head publishes it: the swatch and the count, without the geometry. */
type LayerRoster = {
  name: string;
  rgb: [number, number, number];
  entityCount: number;
};

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

/** The canvas colours and the face text is lettered in, resolved from the tokens (Decision § 5). */
function paletteOf(element: Element): CanvasPalette {
  const style = getComputedStyle(element);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  return {
    paper: token("--canvas-paper"),
    ink: token("--canvas-ink"),
    grid: token("--canvas-grid"),
    mono: token("--font-mono"),
    selection: token("--canvas-selection"),
    hover: token("--canvas-hover"),
    pulse: token("--canvas-pulse"),
  };
}

/**
 * The duration a fly-to travels over, as the screen's own tokens state it. Reduced motion zeroes
 * `--motion-flyto` at source, so a reader who asked for less motion is answered with a duration of
 * zero here and no branch anywhere (Decision § 4).
 */
function flytoMotion(element: Element): { durationMs: number; ease: EaseControls | null } {
  const style = getComputedStyle(element);
  const spelled = style.getPropertyValue("--motion-flyto").trim();
  const seconds = spelled.endsWith("ms") ? Number(spelled.slice(0, -2)) / 1000 : spelled.endsWith("s") ? Number(spelled.slice(0, -1)) : Number.NaN;
  const numbers = (style.getPropertyValue("--ease-flyto").match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  return {
    // A token that cannot be read at all is not a reason to teleport: the travel keeps its own
    // stated length, and a curve that cannot be parsed eases linearly over it (§ 4).
    durationMs: Number.isFinite(seconds) ? Math.max(seconds * 1000, 0) : FLYTO_FALLBACK_MS,
    ease: numbers.length === EASE_CONTROLS ? ([numbers[0], numbers[1], numbers[2], numbers[3]] as EaseControls) : null,
  };
}

export function ViewerScreen({ tenantId, projectId, drawingId, layoutName, initialViewport, initialSelection, head: supplied }: ViewerScreenProps) {
  const [head, setHead] = useState<ViewerHead | null>(supplied ?? null);
  const [feedRefusal, setFeedRefusal] = useState<{
    refusal: RefusalEntry;
    evidence: RefusalEvidence;
  } | null>(null);
  /** A head that could not be read at all — raised into the render so the error boundary takes it. */
  const [headFailure, setHeadFailure] = useState<Error | null>(null);
  const [loadedLayers, setLoadedLayers] = useState(supplied?.kind === "manifest" ? supplied.manifest.layers.length : 0);
  const [renderer, setRenderer] = useState<"webgl" | "unavailable">("unavailable");
  /** Whether the browser has been asked for a context yet — before that, nothing is claimed (I-82). */
  const [probed, setProbed] = useState(false);
  const [firstPaint, setFirstPaint] = useState(false);
  /**
   * The sheet this address names. `layoutName` is the path segment the route was opened at, which
   * Next hands a page exactly as the path spells it — `FOUNDATION%20PLAN` for a sheet whose name
   * carries a space — so the segment is read once, here, and the sheet's own name is what is shown
   * to a reader and asked of the feed (B-17, R-UI-031).
   */
  const sheetName = layoutNameOf(layoutName);

  const [camera, setCamera] = useState<Camera | null>(null);
  const [, bump] = useReducer((count: number) => count + 1, 0);

  /** The source keys held, in selection order — the address's `s`, and the inspector's list. */
  const [selection, setSelection] = useState<string[]>([]);
  /** Keys an address named that this sheet does not hold: a fact, never a refusal (I-88). */
  const [missing, setMissing] = useState<string[]>([]);
  const [hovered, setHovered] = useState<HoverFact | null>(null);
  /** Absent until the first fly-to ever runs, and never written when the address states `v` (I-85). */
  const [flyto, setFlyto] = useState<"flying" | "settled" | null>(null);
  const [marqueeOn, setMarqueeOn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const painterRef = useRef<Painter | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  /** When the index was last asked about a point, so its answer can be timed against PB-3. */
  const askedAtRef = useRef(0);
  /** Every layer whose geometry has arrived, by name — the painter's and the index's shared source. */
  const arrivedRef = useRef<Map<string, RenderLayer>>(new Map());
  const uploadedRef = useRef<Set<string>>(new Set());
  const postedRef = useRef<Set<string>>(new Set());
  /** Every layer whose geometry did not arrive. The posture is rebuilt whenever the head changes, so
   * what the feed learned is held here rather than inside it — otherwise a failure recorded before
   * the roster rendered would be forgotten by the render that would have shown it (I-81). */
  const failedRef = useRef<Set<string>>(new Set());
  /**
   * What each source key of this sheet is, gathered as the layers arrive: the record's type, the
   * layer holding it and the world box of everything painted under that key. It is what a hover, a
   * selection row and a reveal read; the index in the worker answers *which* keys, and this answers
   * what they are (I-86: a key that paints many pieces is one atom, spanning all of them).
   */
  const factsRef = useRef<Map<string, { type: string; layer: string; box: IndexBox; records: RenderRecord[] }>>(new Map());
  /** The keys held, off the render loop: a gesture publishes the address without a stale closure. */
  const selectionRef = useRef<string[]>([]);
  /** Whether the address's own selection has been applied — it is read once, not on every arrival. */
  const addressTakenRef = useRef(false);
  /** The address that reading was made of, so a new one is read again and the same one is not. */
  const addressReadRef = useRef<string | null>(null);
  /** The fly-to in flight, so a second reveal or a leaving screen cancels the first. */
  const flightRef = useRef(0);
  /** The next id a question to the index is asked under, and who is waiting for each answer. */
  const nextAskRef = useRef(0);
  const waitingRef = useRef<Map<number, (keys: string[]) => void>>(new Map());

  const evidence: RefusalEvidence = useMemo(
    () => ({
      href: shellHref(tenantId, "projects"),
      label: strings.viewer_evidence_project,
    }),
    [tenantId],
  );
  const state = useMemo(() => {
    const made = createViewerState(head ?? { kind: "absent", reason: "not-ingested" });
    for (const name of failedRef.current) made.markLayerFailed(name, true);
    return made;
  }, [head]);
  const rows = state.layerRows();
  const feed = useCallback(
    (query: string) => `/api/viewer/${drawingId}/${encodeURIComponent(sheetName)}?tenant=${encodeURIComponent(tenantId)}&${query}`,
    [drawingId, sheetName, tenantId],
  );

  /* --------------------------------------------------------------------- the sheet, layer by layer */

  // The posture the painter and the layer feed read, held on a ref: they run outside React's render
  // and must never be a reason to fetch the sheet again.
  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * What one arrived layer's records are, by the key each is selected under. A key that paints more
   * than one record keeps the first record's type and layer and spans every piece's box, because
   * that is the one thing a reader selected (I-86).
   */
  const learn = useCallback((layer: RenderLayer): void => {
    for (const record of layer.records) {
      const key = recordKey(record);
      const box = recordBox(record);
      if (key === undefined || box === null) continue;
      const held = factsRef.current.get(key);
      if (held === undefined) {
        factsRef.current.set(key, { type: record.type, layer: layer.name, box, records: [record] });
        continue;
      }
      held.records.push(record);
      held.box = unionBox([held.box, box]) ?? held.box;
    }
  }, []);

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

  /**
   * Every layer that has arrived and not yet been posted to the index, one message each. The whole
   * sheet in one message is a structured clone of every record of every layer on this thread, paid
   * for in one lump the moment the last layer lands; a layer at a time spreads it across the feed
   * and lets the index answer for what has arrived (R-UI-040, PB-3).
   */
  const indexLayers = useCallback(() => {
    const worker = workerRef.current;
    if (worker === null) return;
    for (const [name, layer] of arrivedRef.current) {
      if (postedRef.current.has(name)) continue;
      postedRef.current.add(name);
      worker.postMessage({ id: nextAskRef.current++, kind: "index", layers: [layer] });
    }
  }, []);

  /**
   * One question put to the index, answered from the worker's thread (R-UI-040, PB-3). Each carries
   * its own id and its own waiter, so a hover asked twice while a rectangle is in flight is never
   * answered with the other's keys — and a screen that leaves settles every waiter with nothing
   * rather than leaving a promise nobody will ever keep.
   */
  const ask = useCallback((request: SpatialAsk): Promise<string[]> => {
    const worker = workerRef.current;
    if (worker === null) return Promise.resolve([]);
    const id = nextAskRef.current++;
    return new Promise<string[]>((settle) => {
      waitingRef.current.set(id, settle);
      worker.postMessage({ ...request, id } as SpatialRequest);
    });
  }, []);

  /** The layers a rectangle or a click may take from: drawn, and not locked out of the hit-test. */
  const openLayers = useCallback(
    (): string[] =>
      stateRef.current
        .layerRows()
        .filter((row) => row.drawn && !row.locked)
        .map((row) => row.name),
    [],
  );

  /** A layer's geometry did not arrive, or arrived after all: the row says so, and stays (I-81). */
  const markFailed = useCallback((name: string, failed: boolean): void => {
    if (failed) failedRef.current.add(name);
    else failedRef.current.delete(name);
    stateRef.current.markLayerFailed(name, failed);
    bump();
  }, []);

  const takeLayer = useCallback(
    async (index: number, signal?: AbortSignal): Promise<boolean> => {
      // Every way one layer can fail to arrive is that layer's own row, never the whole screen's
      // error cell: a dropped connection and a body that is not JSON are the partial cell exactly as
      // a 500 is (I-81). Only a fetch this screen itself cut short is raised, and its caller ignores
      // it because leaving a sheet is not a failure anybody must be told about.
      try {
        const answer = await fetch(feed(`part=layer&index=${index}`), signal === undefined ? {} : { signal });
        if (!answer.ok) return false;
        const body = (await answer.json()) as {
          name: string;
          rgb: [number, number, number];
          entityCount: number;
          records: RenderLayer["records"];
        };
        const arrived: RenderLayer = {
          name: body.name,
          rgb: body.rgb,
          entityCount: body.entityCount,
          records: body.records,
        };
        arrivedRef.current.set(body.name, arrived);
        learn(arrived);
        flush();
        indexLayers();
        return true;
      } catch (failure) {
        if (signal?.aborted === true) throw failure;
        return false;
      }
    },
    [feed, flush, indexLayers, learn],
  );

  useEffect(() => {
    if (supplied !== undefined) {
      for (const layer of supplied.kind === "manifest" ? supplied.manifest.layers : []) {
        arrivedRef.current.set(layer.name, layer);
        learn(layer);
      }
      return;
    }

    const controller = new AbortController();
    const open = async (): Promise<void> => {
      const answer = await fetch(feed("part=head"), {
        signal: controller.signal,
      });
      if (answer.status === 401) {
        setFeedRefusal({
          refusal: REFUSALS.SIGNED_OUT,
          evidence: { href: "/sign-in", label: strings.shell_evidence_sign_in },
        });
        return;
      }
      if (answer.status === 403) {
        // The evidence a reader can act on is their own workspace, not the signed-out home the label
        // does not promise — a refusal's link lands on the address it names (R-UI-020).
        setFeedRefusal({
          refusal: REFUSALS.WORKSPACE_PERMISSION_NOT_HELD,
          evidence: {
            href: shellHref(tenantId, "projects"),
            label: strings.shell_denied_evidence,
          },
        });
        return;
      }
      const body = (await answer.json()) as HeadAnswer | null;
      // An answer that is not one of the three heads is no head at all — a 500 carrying a fault id
      // is the commonest one — and it is the error cell, raised so the root boundary takes it. A
      // sheet drawn empty out of it would be the silence R-UI-020 forbids (I-81).
      if (body === null || (body.kind !== "manifest" && body.kind !== "refusal" && body.kind !== "absent")) {
        throw new Error(`the sheet feed answered ${answer.status}, which is not a head`);
      }
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
        else markFailed(layer.name, true);
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
  }, [feed, learn, markFailed, supplied, takeLayer, tenantId]);

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

  /**
   * The address this sheet was opened at, captured before anything can navigate away from it: a
   * flush that settles after the reader has left must be able to tell that it has.
   *
   * It is read on the first client render rather than in an effect, so a camera published before the
   * effects have run is written rather than dropped, and read again whenever the sheet changes, so an
   * instance the framework keeps across a move to another drawing or layout goes on publishing to
   * the address it is now showing instead of falling silent for the rest of its life (R-UI-031).
   */
  const ownPathname = useRef(typeof window === "undefined" ? "" : window.location.pathname);
  useEffect(() => {
    ownPathname.current = window.location.pathname;
  }, [drawingId, layoutName]);

  /** R-UI-031: the address is the camera and the selection, written by the one module that
   * decides that (B-17). The selection is read off its ref, so a camera published from a settling
   * gesture carries whatever is held at that moment rather than what was held when it started. */
  const publish = useCallback((at: Camera): void => {
    if (typeof window === "undefined") return;
    publishViewport(window, ownPathname.current, at, selectionRef.current);
  }, []);

  useEffect(() => {
    cameraRef.current = camera;
    if (camera === null) return;
    painterRef.current?.draw(camera, state);
    publish(camera);
  }, [camera, publish, state]);

  // What is held is part of the address exactly as the camera is, and it is replaced onto it, never
  // pushed: Back leaves the sheet rather than unwinding a reader's clicks (R-UI-031).
  useEffect(() => {
    selectionRef.current = selection;
    const at = cameraRef.current;
    if (at !== null) publish(at);
  }, [publish, selection]);

  /** The settle a gesture's last frame is published on. */
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /**
   * The camera a reader moved to. A gesture in flight moves it on the ref the painter draws from and
   * publishes nothing: sixty pointer events a second are otherwise sixty React renders of the panel
   * and the readout on the painter's own thread, and sixty `history.replaceState` calls, which a
   * browser throttles into a SecurityError. The gesture's last camera is published once it settles;
   * every discrete move — a control, a key, a fit — publishes at once (PB-3, R-UI-031).
   */
  const moveCamera = useCallback((move: (held: Camera) => Camera, live: boolean): void => {
    const held = cameraRef.current;
    if (held === null) return;
    const next = move(held);
    cameraRef.current = next;
    painterRef.current?.draw(next, stateRef.current);
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
  }, []);

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
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [state]);

  /* ------------------------------------------------------------------------- the index, in a worker */

  useEffect(() => {
    if (head?.kind !== "manifest" || typeof Worker === "undefined") return;
    const worker = new Worker(new URL("../../../../../../../../../modules/takeoff/viewer/spatial.worker.ts", import.meta.url), { type: "module" });
    // What the index answers is read here, or the question was never asked: the round trip and the
    // number of keys it found are published on the readout the way the frame ledger is, so PB-3's
    // hit-test budget is a figure a journey and an operator can read (Decision § 7).
    const onAnswer = (event: MessageEvent<SpatialAnswer>): void => {
      const waiting = waitingRef.current.get(event.data.id);
      waitingRef.current.delete(event.data.id);
      if (event.data.kind === "hit") {
        const status = statusRef.current;
        status?.setAttribute("data-hit-ms", String(performance.now() - askedAtRef.current));
        status?.setAttribute("data-hit-keys", String(event.data.keys.length));
      }
      waiting?.(event.data.keys);
    };
    worker.addEventListener("message", onAnswer);
    workerRef.current = worker;
    postedRef.current.clear();
    indexLayers();
    return () => {
      worker.removeEventListener("message", onAnswer);
      worker.terminate();
      workerRef.current = null;
      postedRef.current.clear();
      // A question nobody will answer is settled with nothing rather than left pending: a screen
      // that left owes its callers an answer, and "no keys" is one (ARCH-03).
      for (const waiting of waitingRef.current.values()) waiting([]);
      waitingRef.current.clear();
    };
  }, [head, indexLayers]);

  /* ------------------------------------------------------------------- what is held, and revealed */

  /** One selected key as the inspector lists it — the keys this sheet has not met yet are not rows. */
  const entityOf = useCallback((key: string): SelectedEntity | null => {
    const held = factsRef.current.get(key);
    return held === undefined ? null : { key, type: held.type, layer: held.layer, box: held.box };
  }, []);

  const selected: SelectedEntity[] = selection.map(entityOf).filter((entity): entity is SelectedEntity => entity !== null);

  /** The layers being painted right now, as one value an effect can be keyed on. */
  const drawnLayers = rows
    .filter((row) => row.drawn)
    .map((row) => row.name)
    .join("\n");

  // What is held and what is under the pointer are painted from their own buffers, so a selection of
  // a whole sheet costs no re-tessellation of a single layer batch (PB-3).
  //
  // Only what is drawn is marked: a selected entity whose layer is then hidden, isolated away or
  // failed stays listed and stays in `s` — the address is the state, and a layer toggle may not
  // silently rewrite a link someone shared — but it is not painted, because a mark on a layer that
  // is not there would be paint claiming to sit on geometry nobody can see (Decision § 2's partial).
  useEffect(() => {
    const painter = painterRef.current;
    if (painter === null) return;
    const painted = new Set(drawnLayers === "" ? [] : drawnLayers.split("\n"));
    painter.setSelection(
      selection.flatMap((key) => {
        const held = factsRef.current.get(key);
        return held === undefined || !painted.has(held.layer) ? [] : held.records;
      }),
    );
    const at = cameraRef.current;
    if (at !== null) painter.draw(at, stateRef.current);
  }, [drawnLayers, head, loadedLayers, selection]);

  useEffect(() => {
    const painter = painterRef.current;
    if (painter === null) return;
    painter.setHover(hovered === null ? null : (factsRef.current.get(hovered.key)?.records[0] ?? null));
    const at = cameraRef.current;
    if (at !== null) painter.draw(at, stateRef.current);
  }, [head, hovered]);

  /**
   * The Trace's target (R-UI-022): the camera eases from where it stands to the frame that holds
   * everything selected, and the arrival is struck once in the pulse colour. It is one code path —
   * the Reveal door and a deep link that names keys and no camera both come through here (I-85).
   */
  const revealInSheet = useCallback((keys?: readonly string[]): void => {
    const stage = stageRef.current;
    if (stage === null || head?.kind !== "manifest") return;
    // The keys are taken as an argument where the caller has just chosen them: a deep link selects
    // and reveals in one pass, and the ref holding what is selected is a render behind it.
    const held = keys ?? selectionRef.current;
    const boxes = held.map((key) => factsRef.current.get(key)?.box).filter((box): box is IndexBox => box !== undefined);
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
      if (cameraRef.current === null) setCamera(to);
      else moveCamera(() => to, false);
      setFlyto("settled");
      painterRef.current?.pulse(durationMs);
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
  }, [head, moveCamera]);

  /**
   * The selection the address named, applied once the layers holding it have arrived. A key of the
   * right shape that no layer of this sheet carries, and a value that is no key at all, both land in
   * the partial cell while every key that was found stays selected (I-88, R-UI-050).
   */
  useEffect(() => {
    // A move to another sheet, or a new address for this one, is a new reading of `s` — kept as the
    // address it was read from rather than reset in an effect of its own, which would run after this
    // one on mount and undo the reading it had just made.
    const address = `${drawingId} ${layoutName} ${initialSelection ?? ""}`;
    if (addressReadRef.current !== address) {
      addressReadRef.current = address;
      addressTakenRef.current = false;
    }
    if (addressTakenRef.current || head?.kind !== "manifest") return;
    const asked = parseSelection(initialSelection);
    const arrived = loadedLayers + failedRef.current.size >= head.manifest.layers.length;
    const found = asked.keys.filter((key) => factsRef.current.has(key));
    const settled = asked.keys.length === 0 || found.length === asked.keys.length || arrived;
    // Nothing is written back to the address until the reading is settled: a link copied while the
    // sheet was still arriving would otherwise carry the keys that had reached the browser so far.
    if (!settled) return;

    addressTakenRef.current = true;
    if (asked.keys.length > 0) setSelection(found);
    setMissing([...asked.malformed, ...asked.keys.filter((key) => !factsRef.current.has(key))]);
    // A camera the address states is the camera the reader gets: only a link that named keys and no
    // viewport flies to them, and only then is `data-flyto` ever written (I-85).
    if (found.length > 0 && initialViewport === null) revealInSheet(found);
  }, [drawingId, head, initialSelection, initialViewport, layoutName, loadedLayers, revealInSheet]);

  /* ----------------------------------------------------------------------------------- the gestures */

  const zoomBy = useCallback(
    (factor: number) => {
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

  const fitSheet = useCallback(() => {
    if (head?.kind !== "manifest") return;
    const box = stageRef.current?.getBoundingClientRect();
    const fitted = fitCamera(head.manifest.extents, {
      width: box?.width ?? 0,
      height: box?.height ?? 0,
    });
    if (cameraRef.current === null) setCamera(fitted);
    else moveCamera(() => fitted, false);
  }, [head, moveCamera]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const box = canvas.getBoundingClientRect();
      moveCamera(
        (held) =>
          zoomCameraAt(held, Math.exp(-event.deltaY * WHEEL_ZOOM_RATE), {
            x: event.clientX - box.left,
            y: event.clientY - box.top,
          }),
        true,
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [head, moveCamera]);

  const dragRef = useRef<{ x: number; y: number } | null>(null);
  /** Where the gesture began, in client pixels, and whether it began a rectangle rather than a pan. */
  const gestureRef = useRef<{ x: number; y: number; marquee: boolean } | null>(null);
  /** The rectangle in stage pixels, written straight onto the element: a marquee is not a render. */
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const marqueeBoxRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  /** Whether a hover question is already in flight — one at a time, so a moving pointer never queues. */
  const hoveringRef = useRef(false);

  /** Where a client point stands on the canvas, and where that is in the drawing. */
  const pointOn = (canvas: HTMLCanvasElement, event: { clientX: number; clientY: number }): { px: { x: number; y: number }; world: [number, number] } | null => {
    const at = cameraRef.current;
    if (at === null) return null;
    const box = canvas.getBoundingClientRect();
    const px = { x: event.clientX - box.left, y: event.clientY - box.top };
    return { px, world: worldAt(at, px) };
  };

  /** The keys under a point, nearest first — answered by the index in its worker (PB-3, R-UI-040). */
  const keysUnder = useCallback(
    (world: [number, number]): Promise<string[]> => {
      const at = cameraRef.current;
      if (at === null) return Promise.resolve([]);
      askedAtRef.current = performance.now();
      // The postures travel with the question (Decision § 1): the index holds the whole sheet, and
      // a layer the reader locked or is not looking at may not answer for it. A locked layer is
      // painted and out of the hit-test; a layer that is not drawn is not there to point at, and a
      // selection a reader cannot see is a copyable list of ghosts (I-87).
      const shut = stateRef.current
        .layerRows()
        .filter((row) => row.locked || !row.drawn)
        .map((row) => row.name);
      return ask({ kind: "hit", point: world, tolerance: HIT_TOLERANCE_PX / at.scale, lockedLayers: shut });
    },
    [ask],
  );

  /** The marquee's rectangle, in stage pixels, written where the pointer left it. */
  const drawMarquee = (from: { x: number; y: number }, to: { x: number; y: number }): void => {
    const box = {
      left: Math.min(from.x, to.x),
      top: Math.min(from.y, to.y),
      width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y),
    };
    marqueeBoxRef.current = box;
    const element = marqueeRef.current;
    if (element === null) return;
    element.style.left = `${box.left}px`;
    element.style.top = `${box.top}px`;
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const on = pointOn(event.currentTarget, event);
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = { x: event.clientX, y: event.clientY, marquee: event.shiftKey };
    if (event.shiftKey && on !== null) {
      drawMarquee(on.px, on.px);
      setMarqueeOn(true);
      return;
    }
    dragRef.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const gesture = gestureRef.current;
    if (gesture !== null && gesture.marquee) {
      const on = pointOn(event.currentTarget, event);
      const box = event.currentTarget.getBoundingClientRect();
      if (on !== null) drawMarquee({ x: gesture.x - box.left, y: gesture.y - box.top }, on.px);
      return;
    }

    const from = dragRef.current;
    if (from !== null) {
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      dragRef.current = { x: event.clientX, y: event.clientY };
      moveCamera((held) => panCamera(held, -dx, -dy), true);
      return;
    }

    // Nothing is being dragged, so the pointer is reading: what is under it is asked of the index
    // one question at a time, and a pointer over bare paper reads nothing rather than the last
    // thing it read (AC-1).
    if (hoveringRef.current) return;
    const on = pointOn(event.currentTarget, event);
    if (on === null) return;
    hoveringRef.current = true;
    void keysUnder(on.world)
      .then((keys) => {
        const key = keys[0];
        const held = key === undefined ? undefined : factsRef.current.get(key);
        setHovered(key === undefined || held === undefined ? null : { key, type: held.type, layer: held.layer });
      })
      .finally(() => {
        hoveringRef.current = false;
      });
  };

  /** A key added to, or taken out of, what is held — Shift's own arithmetic. */
  const toggleKey = (key: string): void => {
    setSelection((held) => (held.includes(key) ? held.filter((each) => each !== key) : [...held, key]));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const gesture = gestureRef.current;
    const dragging = dragRef.current !== null;
    gestureRef.current = null;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (gesture === null) return;

    const travelled = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
    const on = pointOn(event.currentTarget, event);

    if (gesture.marquee) {
      setMarqueeOn(false);
      // A rectangle that never moved is a Shift+click, and toggles what is under it: a reader who
      // pressed Shift on one entity meant to add it, not to select an area of no extent (I-87).
      if (travelled > CLICK_TRAVEL_PX && on !== null) {
        const at = cameraRef.current;
        const box = marqueeBoxRef.current;
        if (at === null) return;
        const first = worldAt(at, { x: box.left, y: box.top });
        const last = worldAt(at, { x: box.left + box.width, y: box.top + box.height });
        void ask({
          kind: "rect",
          bbox: {
            min: [Math.min(first[0], last[0]), Math.min(first[1], last[1])],
            max: [Math.max(first[0], last[0]), Math.max(first[1], last[1])],
          },
          layers: openLayers(),
        }).then((keys) => setSelection(keys.filter((key) => factsRef.current.has(key))));
        return;
      }
      if (on !== null) void keysUnder(on.world).then((keys) => (keys[0] === undefined ? undefined : toggleKey(keys[0])));
      return;
    }

    // The gesture is over: where it left the camera is published now rather than on the settle.
    if (travelled > CLICK_TRAVEL_PX) {
      if (dragging) moveCamera((held) => held, false);
      return;
    }
    // A click of no travel selects the topmost hit; a click on bare paper lets go of what was held.
    if (on === null) return;
    void keysUnder(on.world).then((keys) => {
      const key = keys[0];
      setSelection(key === undefined ? [] : [key]);
    });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>): void => {
    const pan = (dx: number, dy: number): void => {
      event.preventDefault();
      moveCamera((held) => panCamera(held, dx, dy), false);
    };
    if (event.key === "+" || event.key === "=") zoomBy(ZOOM_STEP);
    else if (event.key === "-") zoomBy(1 / ZOOM_STEP);
    else if (event.key === "f" || event.key === "F") fitSheet();
    else if (event.key === "ArrowLeft") pan(-KEYBOARD_PAN_PX, 0);
    else if (event.key === "ArrowRight") pan(KEYBOARD_PAN_PX, 0);
    else if (event.key === "ArrowUp") pan(0, -KEYBOARD_PAN_PX);
    else if (event.key === "ArrowDown") pan(0, KEYBOARD_PAN_PX);
    // Escape with the sheet focused lets go of what is held (Decision § 1).
    else if (event.key === "Escape") setSelection([]);
  };

  /* ------------------------------------------------------------------------------- what is on screen */

  const retryLayer = (name: string): void => {
    const index = rows.findIndex((row) => row.name === name);
    if (index < 0) return;
    // The row keeps saying the layer is missing until it is not: clearing it on the ask would report
    // a second failure as a fix, and a sheet that quietly claims to hold what it does not is the
    // silence R-UI-020 forbids.
    void takeLayer(index)
      .then((took) => {
        if (took) setLoadedLayers((held) => held + 1);
        markFailed(name, !took);
      })
      .catch(() => markFailed(name, true));
  };

  const failed = rows.some((row) => row.failed);
  if (headFailure !== null) throw headFailure;

  /**
   * The source key on the clipboard, exactly as it stands — nothing stripped, nothing trimmed
   * (R-TO-011). A browser that refuses the write refuses this promise, and the row goes on offering
   * the copy rather than claiming to have made one.
   */
  const copyKey = (key: string): Promise<void> => navigator.clipboard.writeText(key);

  /** A whole layer taken, in the order the index answers it — the keyboard path to a selection. */
  const selectLayer = (name: string): void => {
    void ask({ kind: "layer", layer: name }).then((keys) => setSelection(keys.filter((key) => factsRef.current.has(key))));
  };

  const workArea = (): ReactNode => {
    if (feedRefusal !== null) {
      return (
        <div className="cx-viewer-refusal">
          <RefusalState refusal={feedRefusal.refusal} evidence={feedRefusal.evidence} />
        </div>
      );
    }
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
          {/* Bones where the inspector will stand: telling a reader to hover an entity before any
              exists is a lie about readiness (Decision § 2). */}
          <div className="cx-viewer-bones-panel">
            <Skeleton style={{ height: "16px", width: "96px" }} />
            {Array.from({ length: LOADING_CELLS }, (_, cell) => (
              <Skeleton key={cell} style={{ height: "12px", width: "140px" }} />
            ))}
          </div>
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
      /* Every panel carries a stable id and order, so a layout stored by the two-panel build no
         longer matches this group and is dropped rather than misapplied (Decision § 1). */
      <ResizablePanelGroup direction="horizontal" autoSaveId="cubit-viewer-split">
        <ResizablePanel id="viewer-layers-panel" order={1} defaultSize={PANEL_SIZE} minSize={PANEL_MIN} maxSize={PANEL_MAX}>
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
            onSelectLayer={selectLayer}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="viewer-stage-panel" order={2}>
          <div className="cx-viewer-stage" ref={stageRef}>
            {probed && renderer === "unavailable" ? (
              <div className="cx-viewer-empty">
                <h2 className="cx-viewer-empty-heading">{strings.viewer_no_webgl_heading}</h2>
                <p className="cx-viewer-empty-body">{strings.viewer_no_webgl_body}</p>
              </div>
            ) : null}
            <p className="cx-viewer-hidden" id="cx-viewer-keys">
              {strings.viewer_canvas_keys}
            </p>
            <canvas
              className="cx-viewer-canvas cx-reticle"
              data-testid="viewer-canvas"
              ref={canvasRef}
              // The sheet is driven from the keyboard, so it is not announced as a picture: the keys
              // it answers are named beside it and pointed at from here (R-TO-010, A-11Y).
              role="application"
              tabIndex={0}
              aria-label={fill(strings.viewer_canvas_label, {
                layout: sheetName,
              })}
              aria-describedby="cx-viewer-keys"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={() => setHovered(null)}
              onKeyDown={onKeyDown}
            />
            {/* The rectangle follows the pointer untweened and is written straight onto the element:
                sixty renders a second of the panel and the readout is what a marquee must not cost
                (PB-3). Its geometry is pointer data, not a style — the look is the stylesheet's. */}
            {marqueeOn ? (
              <div
                className="cx-viewer-marquee"
                data-testid="viewer-marquee"
                aria-hidden="true"
                ref={marqueeRef}
                style={{
                  left: `${marqueeBoxRef.current.left}px`,
                  top: `${marqueeBoxRef.current.top}px`,
                  width: `${marqueeBoxRef.current.width}px`,
                  height: `${marqueeBoxRef.current.height}px`,
                }}
              />
            ) : null}
            <div className="cx-viewer-controls">
              <Button variant="secondary" data-testid="viewer-fit" onClick={fitSheet}>
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
        <ResizableHandle />
        <ResizablePanel id="viewer-inspector-panel" order={3} defaultSize={PANEL_SIZE} minSize={PANEL_MIN} maxSize={PANEL_MAX}>
          <InspectorPanel
            hover={hovered}
            selection={selected}
            missing={missing}
            onCopy={copyKey}
            onReveal={revealInSheet}
            onClear={() => setSelection([])}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  };

  return (
    <div className="cx-viewer" data-testid="viewer-screen" data-project={projectId} data-flyto={flyto ?? undefined}>
      {/* The sheet names itself once, as the house style has every screen do: heading navigation
          lands on the sheet a reader opened rather than nowhere (R-UI-050's siblings, axe). */}
      <h1 className="cx-viewer-hidden">{fill(strings.viewer_canvas_label, { layout: sheetName })}</h1>
      <div className="cx-viewer-work">{workArea()}</div>
      <StatusLine
        statusRef={statusRef}
        layoutName={sheetName}
        sheet={camera !== null && head?.kind === "manifest"}
        scale={camera?.scale ?? 0}
        loadedLayers={loadedLayers}
        totalLayers={head?.kind === "manifest" ? head.manifest.layers.length : 0}
        drawnEntities={state.drawnEntityCount()}
        entityCount={state.entityCount()}
        selectionCount={selection.length}
        firstPaint={firstPaint}
        renderer={renderer}
        partial={failed}
      />
    </div>
  );
}

// R-UI-040's hit-test, off the main thread: the sheet's spatial index is built here from the layers
// the screen posts as they arrive, and a point, a rectangle or a layer asked about is answered with
// the keys it holds. The index is the same one `./client` builds — this file is where it lives, not a
// second one (B-17).
//
// The entry touches no DOM and imports nothing of `src/app`: it is loaded as a module worker, and a
// worker that reached a screen's module graph would pull a whole page into a background thread
// (ARCH-01).
import { buildSpatialIndex, hitTest, layerKeys, queryIndex, type IndexBox, type SpatialIndex } from "./client";
import type { RenderLayer } from "./types";

/** What the screen asks: here are the layers, or what is under this point, rectangle or layer. */
export type SpatialRequest =
  | { id: number; kind: "index"; layers: RenderLayer[] }
  /** A point, and the layers the reader has locked — locked layers are painted and are out of the
   * hit-test, so the posture travels with the question rather than being re-indexed (Decision § 1). */
  | {
      id: number;
      kind: "hit";
      point: [number, number];
      tolerance: number;
      lockedLayers?: readonly string[];
    }
  /** A world rectangle, and the layers that may answer it: a marquee takes what a reader can see,
   * so the drawn, unlocked roster travels with the question (Decision I-87). */
  | { id: number; kind: "rect"; bbox: IndexBox; layers: readonly string[] }
  /** One named layer, whole — the keyboard path to a selection. */
  | { id: number; kind: "layer"; layer: string };

/** Each arm of the union without its id — a question as a caller states it, before it is numbered. */
type WithoutId<Request> = Request extends unknown ? Omit<Request, "id"> : never;

/** A question the screen has not yet given an id to. */
export type SpatialAsk = WithoutId<SpatialRequest>;

/** What comes back: the request's own id, the kind it answers, and the keys it found. */
export type SpatialAnswer = { id: number; kind: SpatialRequest["kind"]; keys: string[] };

/** The worker's own global, named for what this file uses of it. */
type WorkerScope = {
  postMessage: (message: SpatialAnswer) => void;
  addEventListener: (kind: "message", listener: (event: { data: SpatialRequest }) => void) => void;
};

const scope = self as unknown as WorkerScope;

/** The sheet as it stands here: empty until the first layer is posted. */
let index: SpatialIndex = { root: null, size: 0 };

/** Every layer posted so far, so a sheet that arrives layer by layer indexes what it has. */
const layers: RenderLayer[] = [];

/** Whether a layer has arrived since the index was last packed. */
let stale = false;

/** The quiet a settling sheet is packed after — long enough that a progressive load's layers are
 * one build between them. */
const INDEX_SETTLE_MS = 200;

let settle: ReturnType<typeof setTimeout> | null = null;

/**
 * The index over everything posted so far, packed if a layer has arrived since the last packing. A
 * pack is a sort of every record in the sheet, so packing once per arriving layer would pay for the
 * whole sheet N times over — and on this thread, which owes a hit an answer inside 16 ms (PB-3).
 * Arrivals mark the sheet stale instead, and the pack happens once the layers go quiet, or at the
 * first question asked before they do.
 */
const packed = (): SpatialIndex => {
  if (stale) {
    index = buildSpatialIndex({ layers });
    stale = false;
  }
  return index;
};

/** The keys one question is answered with — every query the index serves runs on this thread. */
function answer(request: SpatialRequest): string[] {
  if (request.kind === "hit") return hitTest(packed(), request.point, request.tolerance, request.lockedLayers ?? []);
  if (request.kind === "rect") return queryIndex(packed(), request.bbox, request.layers);
  if (request.kind === "layer") return layerKeys(packed(), request.layer);
  return [];
}

scope.addEventListener("message", (event) => {
  const request = event.data;
  if (request.kind === "index") {
    layers.push(...request.layers);
    stale = true;
    if (settle !== null) clearTimeout(settle);
    settle = setTimeout(() => {
      settle = null;
      packed();
    }, INDEX_SETTLE_MS);
    scope.postMessage({ id: request.id, kind: request.kind, keys: [] });
    return;
  }
  scope.postMessage({ id: request.id, kind: request.kind, keys: answer(request) });
});

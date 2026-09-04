// R-UI-040's hit-test, off the main thread: the sheet's spatial index is built here from the layers
// the screen posts as they arrive, and a point asked about is answered with the keys under it. The
// index is the same one `./client` builds — this file is where it lives, not a second one (B-17).
//
// The entry touches no DOM and imports nothing of `src/app`: it is loaded as a module worker, and a
// worker that reached a screen's module graph would pull a whole page into a background thread
// (ARCH-01).
import { buildSpatialIndex, hitTest, type SpatialIndex } from "./client";
import type { RenderLayer } from "./types";

/** What the screen asks: here are the layers, or what is under this point. */
export type SpatialRequest =
  | { id: number; kind: "index"; layers: RenderLayer[] }
  | { id: number; kind: "hit"; point: [number, number]; tolerance: number };

/** What comes back: the request's own id, and the keys it found. */
export type SpatialAnswer = { id: number; keys: string[] };

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

scope.addEventListener("message", (event) => {
  const request = event.data;
  if (request.kind === "index") {
    layers.push(...request.layers);
    index = buildSpatialIndex({ layers });
    scope.postMessage({ id: request.id, keys: [] });
    return;
  }
  scope.postMessage({ id: request.id, keys: hitTest(index, request.point, request.tolerance) });
});

// S-Viewer's server door (ARCH-02): the sheet a viewer opens, the manifest it is drawn from, and the
// key that manifest is cached under. A caller — the layer feed, a screen's server component — speaks
// to the renderer through this file and never reaches past it.
//
// What is NOT here, on purpose: the camera, the spatial index and the painter. Those are ./client
// and ./painter, which the browser loads and which hold no import of the store — a barrel that named
// them would put a database pool into the browser's module graph (ARCH-01).
export { workspaceOfDrawing } from "./access";
export { renderManifestOf, type ViewerScope } from "./head";
export { buildRenderManifest, graphHoldsLayout, manifestCacheKey, manifestDigest } from "./manifest";
export type { Camera, RenderLayer, RenderManifest, RenderRecord, ViewerHead, Viewport } from "./types";

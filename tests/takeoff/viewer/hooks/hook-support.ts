/**
 * The mechanics the hook mounts share: a head the feed could have answered with, the source keys a
 * sheet is selected by, and the boxes those keys span.
 *
 * Mechanics only — nothing here judges the product. The fixture identities are declared once here
 * and imported everywhere they are asserted (B-19), so a sheet that grows a layer grows it for every
 * mount at once.
 */
import type { IngestFacts } from "../../../../src/modules/takeoff/ingest/facts";
import type { IndexBox } from "../../../../src/modules/takeoff/viewer/client";
import type { RenderLayer, RenderManifest, ViewerHead } from "../../../../src/modules/takeoff/viewer/types";

/** The world box every mount's sheet is drawn inside. */
export const EXTENTS: RenderManifest["extents"] = { min: [0, 0], max: [400, 200] };

/** A reading that recorded nothing worth reporting — the head still carries the shape of one. */
export const NO_FACTS: IngestFacts = { insunits: { code: 0, unit: null, unmapped: true }, dropped_layouts: [], layouts: [], counters: [] };

/** One source key of this corpus, in the shape `parseSelection` reads (L-CAD-03's atoms). */
export function sourceKey(handle: string): string {
  return `DXF_HANDLE:${handle}`;
}

/** A world box of the given span, at the origin — what a key that paints something covers. */
export function boxOf(span: number): IndexBox {
  return { min: [0, 0], max: [span, span] };
}

/** One layer of a roster, with no geometry unless a mount hands it some. */
export function layerOf(name: string, records: RenderLayer["records"] = []): RenderLayer {
  return { name, rgb: [1, 2, 3], entityCount: records.length, records };
}

/** The head the feed answers a readable sheet with, over the layers a mount names. */
export function sheetHead(layers: readonly RenderLayer[]): ViewerHead {
  return {
    kind: "manifest",
    cache: "miss",
    facts: NO_FACTS,
    manifest: { version: 1, layoutName: "SHEET ONE", extents: EXTENTS, insunits: NO_FACTS.insunits, digest: "sheet-one", layers: [...layers] },
  };
}

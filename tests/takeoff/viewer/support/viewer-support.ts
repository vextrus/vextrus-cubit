/**
 * The mechanics S-Viewer's acceptance runs on — module loading, the shapes the increment's interface
 * list publishes, and the derivations every expectation is taken from.
 *
 * Mechanics only: nothing here judges the product, and nothing here reads product source. Every name
 * below is one the increment's interfaces or its test contract publishes, and every expected value
 * is derived from the artifact under test rather than transcribed from a run (B-19) — a corpus that
 * grows a layout, a layer or a record grows the expectation with it.
 *
 * Product modules load by absolute path so a file the Builder has not written yet fails as an
 * assertion naming it rather than as a collection death that would read as a defect in the
 * acceptance. The root is `BUILDER_REPO_ROOT` where a mounted set states one, and the working
 * directory otherwise, so the same helpers serve the public lane and a held-out mount alike.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import type { EntityGraph } from "../../../../src/core/entitygraph/schema";
import type { IngestFacts } from "../../../../src/modules/takeoff/ingest/facts";

/** The homes this increment's interface list names. */
export const VIEWER_MODULE = "src/modules/takeoff/viewer/index.ts";
export const VIEWER_CLIENT_MODULE = "src/modules/takeoff/viewer/client.ts";
export const VIEWER_SCREEN_MODULE = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/viewer-screen.tsx";
export const VIEWER_ROUTE_MODULE = "src/app/api/viewer/[drawing]/[layout]/route.ts";
export const ERRORS_MODULE = "src/core/errors.ts";
export const FORMAT_MODULE = "src/core/format.ts";
export const ENTITYGRAPH_MODULE = "src/core/entitygraph/schema.ts";

/** The refusal this increment registers (test contract). */
export const MANIFEST_NOT_RENDERABLE = "MANIFEST_NOT_RENDERABLE";

/** The checkout the acceptance drives — a mounted set states it, a lane run stands in it. */
export function repoRoot(): string {
  return process.env["BUILDER_REPO_ROOT"]?.trim() || process.cwd();
}

/** Import a product module by repo-relative path, asserting it exists first. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(repoRoot(), relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/* ------------------------------------------------------------------ the shapes the seam answers in */

/** One drawn record of a manifest (increment interfaces: `RenderRecord`). */
export type RenderRecord = {
  key?: string;
  src?: string;
  type: string;
  rgb: [number, number, number];
  points?: unknown;
  text?: string;
  height?: number;
  anchor?: unknown;
};

/** One layer of a manifest (increment interfaces: `RenderLayer`). */
export type RenderLayer = {
  name: string;
  rgb: [number, number, number];
  entityCount: number;
  records: RenderRecord[];
};

/** A built manifest (increment interfaces: `RenderManifest`). */
export type RenderManifest = {
  version: number;
  layoutName: string;
  extents: { min: [number, number]; max: [number, number] } | null;
  insunits: unknown;
  layers: RenderLayer[];
  digest: string;
};

/** What a screen and a route are answered with (increment interfaces: `ViewerHead`). */
export type ViewerHead =
  | { kind: "manifest"; manifest: RenderManifest; cache: "hit" | "miss"; facts: IngestFacts }
  | { kind: "refusal"; refusal: { code: string; message: string; remedy: string; severity: string; surface: string }; facts: IngestFacts }
  | { kind: "absent"; reason: "not-ingested" | "layout-unknown" };

/** SEAM-STORAGE as `renderManifestOf` is handed one. */
export type StorageLike = {
  put: (tenantId: string, bytes: Uint8Array) => Promise<{ sha256: string }>;
  get: (tenantId: string, sha256: string) => Promise<Uint8Array | null>;
};

/** The server barrel, through the surface the increment publishes. */
export type ViewerSeam = {
  buildRenderManifest: (graph: EntityGraph, layoutName: string) => RenderManifest;
  manifestDigest: (manifest: RenderManifest) => string;
  manifestCacheKey: (artifactSha256: string, layoutName: string) => string;
  renderManifestOf: (scope: { tenantId: string; drawingId: string; layoutName: string }, deps: { storage: StorageLike }) => Promise<ViewerHead>;
};

/** A camera, as the client barrel hands one back — opaque here: it is read through `serialiseViewport`. */
export type Camera = unknown;

/** The viewport a deep link carries (increment interfaces: `parseViewport`). */
export type Viewport = { x: number; y: number; scale: number };

/** The browser-safe barrel, through the surface the increment publishes. */
export type ViewerClient = {
  LEGIBLE_TEXT_PX: number;
  FRAME_BUDGET_MS: number;
  HIT_TEST_BUDGET_MS: number;
  FIRST_PAINT_WARM_MS: number;
  FIRST_PAINT_COLD_MS: number;
  isTextLegible: (heightWorld: number, scale: number) => boolean;
  legibleTexts: (layer: RenderLayer, camera: Camera) => RenderRecord[];
  createCamera: (extents: RenderManifest["extents"], viewportPx: { width: number; height: number }) => Camera;
  fitCamera: (extents: RenderManifest["extents"], viewportPx: { width: number; height: number }) => Camera;
  panCamera: (camera: Camera, dxPx: number, dyPx: number) => Camera;
  zoomCameraAt: (camera: Camera, factor: number, atPx: { x: number; y: number }) => Camera;
  serialiseViewport: (camera: Camera) => string;
  parseViewport: (value: string) => Viewport | null;
  buildSpatialIndex: (manifest: RenderManifest) => unknown;
  hitTest: (index: unknown, worldPoint: [number, number], tolerance: number) => string[];
  queryIndex: (index: unknown, bbox: { min: [number, number]; max: [number, number] }) => string[];
  createViewerState: (head: ViewerHead) => unknown;
};

/** The register, as this acceptance reads one entry out of it. */
export type ErrorsModule = { refusalOf: (code: string) => { code: string; message: string; remedy: string; severity: string; surface: string } };

/** The figure seam every user-facing number renders through (R-SPINE-010). */
export type FormatModule = { formatUserFigure: (value: string) => string };

/** The Zod mirror both runtimes parse an artifact with (L-CAD-05). */
export type GraphSchemaModule = { entityGraphSchema: { safeParse: (value: unknown) => { success: boolean } } };

export const viewerSeam = (): Promise<ViewerSeam> => productModule<ViewerSeam>(VIEWER_MODULE);
export const viewerClient = (): Promise<ViewerClient> => productModule<ViewerClient>(VIEWER_CLIENT_MODULE);

/* ------------------------------------------------------------------ the corpus and its derivations */

/** Every committed artifact of the declared corpus, by name — read from the directory, never listed. */
export function committedArtifactNames(): string[] {
  const home = join(repoRoot(), "cad", "tests", "fixtures");
  const names = readdirSync(home)
    .filter((entry) => entry.endsWith(".entitygraph.json"))
    .map((entry) => entry.slice(0, -".entitygraph.json".length))
    .sort();
  expect(names.length, "the declared fixture corpus holds committed EntityGraph artifacts (test contract)").toBeGreaterThan(0);
  return names;
}

/** One committed artifact, parsed. */
export function committedGraph(name: string): EntityGraph {
  const path = join(repoRoot(), "cad", "tests", "fixtures", `${name}.entitygraph.json`);
  expect(existsSync(path), `${name}.entitygraph.json is part of the declared fixture corpus`).toBe(true);
  return JSON.parse(readFileSync(path, "utf8")) as EntityGraph;
}

/** The bytes of one committed artifact, as SEAM-STORAGE holds them. */
export function committedArtifactBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(repoRoot(), "cad", "tests", "fixtures", `${name}.entitygraph.json`)));
}

/** Every drawn record of a graph, original and derived alike — the two lists a sheet is painted from. */
export function drawnRecordsOf(graph: EntityGraph): (EntityGraph["entities"][number] | EntityGraph["derived"][number])[] {
  return [...graph.entities, ...graph.derived];
}

/** The spaces a graph carries records in — the layouts a manifest can be built for. */
export function layoutNamesOf(graph: EntityGraph): string[] {
  return [...new Set(drawnRecordsOf(graph).map((record) => record.space))].sort();
}

/** The records of one layout: exactly what a manifest of that layout must partition (AC-1). */
export function recordsInLayout(graph: EntityGraph, layoutName: string): (EntityGraph["entities"][number] | EntityGraph["derived"][number])[] {
  return drawnRecordsOf(graph).filter((record) => record.space === layoutName);
}

/** The source key a record is named by: its own where it is an atom, its parent's where it is paint. */
export function identityOf(record: { key?: string; src?: string }): string {
  return record.key ?? record.src ?? "";
}

/**
 * One record as everything AC-1 names about it, in one comparable string: the source key, the type,
 * the layer it is grouped under, the resolved colour, and — for text — the copy and the world height.
 * Comparing the multiset of these across a whole manifest proves the partition, the keying, the
 * grouping, the resolved colour and the world heights in one comparison, and says which record is
 * wrong when one of them is.
 */
export function compositeOf(record: {
  key?: string;
  src?: string;
  type: string;
  layer?: string;
  colour?: { rgb: readonly number[] };
  rgb?: readonly number[];
  text?: string;
  height?: number;
}, layerName: string): string {
  const rgb = record.rgb ?? record.colour?.rgb ?? [];
  return [identityOf(record), record.type, layerName, [...rgb].join(","), record.text ?? "", record.height === undefined ? "" : String(record.height)].join("|");
}

/** The composites a graph's layout owes, sorted — the expectation, derived from the artifact. */
export function expectedComposites(graph: EntityGraph, layoutName: string): string[] {
  return recordsInLayout(graph, layoutName)
    .map((record) => compositeOf(record, record.layer))
    .sort();
}

/** The composites a manifest carries, sorted — what the product answered, read through its own shape. */
export function manifestComposites(manifest: RenderManifest): string[] {
  return manifest.layers
    .flatMap((layer) => layer.records.map((record) => compositeOf(record, layer.name)))
    .sort();
}

/** How many records of a layout each layer name owes (AC-1: grouped by layer). */
export function expectedLayerCounts(graph: EntityGraph, layoutName: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of recordsInLayout(graph, layoutName)) counts.set(record.layer, (counts.get(record.layer) ?? 0) + 1);
  return counts;
}

/** A storage that counts what it is asked for, wrapped around the real one (AC-2, AC-7). */
export function countingStorage(inner: StorageLike): StorageLike & { getsOf: (sha256: string) => number; gets: () => string[] } {
  const asked: string[] = [];
  return {
    put: (tenantId, bytes) => inner.put(tenantId, bytes),
    get: async (tenantId, sha256) => {
      asked.push(sha256);
      return inner.get(tenantId, sha256);
    },
    getsOf: (sha256) => asked.filter((entry) => entry === sha256).length,
    gets: () => [...asked],
  };
}

/** A storage that answers the bytes it is given for every address — how a damaged reading is shown. */
export function fixedStorage(bytes: Uint8Array | null): StorageLike & { gets: () => string[] } {
  const asked: string[] = [];
  return {
    put: async () => ({ sha256: "" }),
    get: async (_tenantId: string, sha256: string) => {
      asked.push(sha256);
      return bytes;
    },
    gets: () => [...asked],
  };
}

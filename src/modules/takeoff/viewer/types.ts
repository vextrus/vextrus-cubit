// The shapes S-Viewer's two halves agree on (R-UI-040): what a server-built render manifest is, and
// what a screen is answered with when it asks for one. They live apart from both builders so the
// browser-safe half can name them without reaching the store, and the server half without reaching a
// camera (ARCH-01, B-17).
import type { RefusalEntry } from "../../../core/errors";
import type { EntityGraph } from "../../../core/entitygraph/schema";
import type { IngestFacts } from "../ingest/facts";

/**
 * One drawn record, ready to paint: named by the source key it came from (`key`) or by the key of
 * the instance it was painted from (`src`), at the colour L-CAD-05 resolved server-side, with its
 * geometry in world coordinates. Text carries the world height the extractor read and the single
 * point it is set at — the two facts level-of-detail and placement need.
 */
export type RenderRecord = {
  readonly key?: string;
  readonly src?: string;
  readonly type: string;
  readonly rgb: readonly [number, number, number];
  readonly points?: readonly (readonly [number, number])[];
  readonly text?: string;
  readonly height?: number;
  readonly anchor?: readonly [number, number];
};

/** One layer of a sheet: the swatch a panel row shows, how many records it holds, and them. */
export type RenderLayer = {
  readonly name: string;
  readonly rgb: readonly [number, number, number];
  readonly entityCount: number;
  readonly records: readonly RenderRecord[];
};

/** A sheet as the client paints it: the layout, its world box, its units and its layers. */
export type RenderManifest = {
  readonly version: 1;
  readonly layoutName: string;
  readonly extents: { readonly min: readonly [number, number]; readonly max: readonly [number, number] } | null;
  readonly insunits: EntityGraph["insunits"];
  readonly layers: readonly RenderLayer[];
  readonly digest: string;
};

/**
 * What the viewer seam answers when a sheet is asked for. Three answers, never one blurred into
 * another (ARCH-03): the sheet with the facts its reading recorded, the registered refusal a reading
 * nothing can be drawn from carries, or the plain absence of a drawing nobody has read yet.
 */
export type ViewerHead =
  | { readonly kind: "manifest"; readonly manifest: RenderManifest; readonly cache: "hit" | "miss"; readonly facts: IngestFacts }
  | { readonly kind: "refusal"; readonly refusal: RefusalEntry; readonly facts: IngestFacts }
  | { readonly kind: "absent"; readonly reason: "not-ingested" | "layout-unknown" };

/** The camera a sheet is seen through: where it looks, how close, and the box it is drawn into. */
export type Camera = {
  readonly centre: readonly [number, number];
  /** Pixels per drawing unit — the figure the status line and the deep link both carry. */
  readonly scale: number;
  readonly viewport: { readonly width: number; readonly height: number };
};

/** The camera a deep link carries: the world centre and the scale, and nothing else (I-77). */
export type Viewport = { readonly x: number; readonly y: number; readonly scale: number };

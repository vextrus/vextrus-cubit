// The shapes S-Viewer's two halves agree on (R-UI-040): what a server-built render manifest is, and
// what a screen is answered with when it asks for one. They live apart from both builders so the
// browser-safe half can name them without reaching the store, and the server half without reaching a
// camera (ARCH-01, B-17).
import type { RefusalEntry } from "@/core/errors";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { IngestFacts } from "../ingest/facts";

/**
 * Where a text's anchor stands on its lettering (L-CAD-05 v3, Decision I-462): across the run,
 * at its start, its middle or its end; and up it, on the first line's baseline, at the bottom of its
 * descenders, halfway between the first line's cap top and the last line's baseline, or at that cap
 * top. The server resolves it once from the drawing's own facts — a single-line text's `halign` and
 * `valign`, an MTEXT's attachment point — so the painter lays glyphs and reads no DXF code.
 */
export type TextJustify = {
  readonly x: "left" | "centre" | "right";
  readonly y: "baseline" | "bottom" | "middle" | "top";
};

/**
 * A single-line text the drawing fits between two points (DXF "aligned" and "fit"): the run goes
 * from the anchor to `to`, turned along them, and its height is either scaled with the run (aligned)
 * or kept as written (fit).
 */
export type TextFit = {
  readonly to: readonly [number, number];
  readonly height: "scaled" | "kept";
};

/**
 * One drawn record, ready to paint: named by the source key it came from (`key`) or by the key of
 * the instance it was painted from (`src`), at the colour L-CAD-05 resolved server-side, with its
 * geometry in world coordinates. Text carries the world height the extractor read and the single
 * point it is set at — the two facts level-of-detail and placement need — and, from a v3 reading,
 * how it is turned and where on its lettering that point stands. A text read at v2 carries neither,
 * and is laid square, left on its baseline, as it always was.
 */
export type RenderRecord = {
  readonly key?: string;
  readonly src?: string;
  /**
   * The handle of the paper-space viewport this record was projected through, where it is model
   * space seen on a sheet rather than paint of the sheet itself. Such a record names the model
   * entity it shows as `src`, so it selects as that entity; `via` says which window showed it.
   */
  readonly via?: string;
  readonly type: string;
  readonly rgb: readonly [number, number, number];
  readonly points?: readonly (readonly [number, number])[];
  readonly closed?: boolean;
  readonly text?: string;
  readonly height?: number;
  readonly anchor?: readonly [number, number];
  /** A text's world rotation, counter-clockwise degrees; absent where it is square. */
  readonly rotation?: number;
  /** Where `anchor` stands on the lettering; absent where it is the start of the first baseline. */
  readonly justify?: TextJustify;
  /** A single-line text fitted between `anchor` and a second point; absent for every other text. */
  readonly fit?: TextFit;
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
  | { readonly kind: "absent"; readonly reason: "not-ingested" | "layout-unknown" | "drawing-unknown" };

/** The camera a sheet is seen through: where it looks, how close, and the box it is drawn into. */
export type Camera = {
  readonly centre: readonly [number, number];
  /** Pixels per drawing unit — the figure the status line and the deep link both carry. */
  readonly scale: number;
  readonly viewport: { readonly width: number; readonly height: number };
};

/** The camera a deep link carries: the world centre and the scale, and nothing else (I-77). */
export type Viewport = { readonly x: number; readonly y: number; readonly scale: number };

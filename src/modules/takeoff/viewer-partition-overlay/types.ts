// R-TO-014's overlay, as a value: the stored partition of one drawing read onto one sheet, the two
// switches that gate what is painted, and the scene those three answer.
//
// Every field a stored row already carries is taken FROM that row's own type rather than respelled
// here (B-19): a view is `ViewRecord`'s reading with the two facts a sheet adds — how many
// assignments name it and the box its members stand in — and an axis is the grid row with the ring
// it was read off. A column that changes shape is a compile error here rather than a drift.
import type { GridAxisRow, GridDeferralRow } from "@/modules/takeoff/partition";
import type { ViewRecord } from "@/core/views";

/** A world box, as every seam of the sheet states one. */
export type OverlayBox = { readonly min: readonly [number, number]; readonly max: readonly [number, number] };

/** A ring, as the drawing carries one: where it stands and how far across it is (L-CAD-07). */
export type OverlayRing = { readonly centre: readonly [number, number]; readonly radius: number };

/**
 * One view of the drawing's current partition, ready to be shown and outlined. `box` is the union of
 * the world boxes of its member records ON THE OPENED LAYOUT, and is null for a view whose members
 * stand on no part of this sheet — a fact the panel says rather than hides (R-UI-050's partial).
 */
export type PartitionOverlayView = Pick<ViewRecord, "viewKey" | "type" | "reason" | "caption" | "anchorKey" | "proposed" | "confirmed"> & {
  readonly entityCount: number;
  readonly box: OverlayBox | null;
};

/** One georeferenced axis, with the ring its bubble is drawn at, or none where no ring stands. */
export type PartitionOverlayAxis = GridAxisRow & { readonly bubble: OverlayRing | null };

/** What the door and the feed answer: one reading of one ingest record, onto one sheet. */
export type PartitionOverlay = {
  readonly ingestId: string;
  readonly views: readonly PartitionOverlayView[];
  readonly axes: readonly PartitionOverlayAxis[];
  readonly deferrals: readonly GridDeferralRow[];
};

/** The two switches. They gate paint and nothing else — no camera, address, selection or hit-test. */
export type OverlayToggles = { readonly views: boolean; readonly grid: boolean };

/** One view's outline, in screen pixels, with what the paint tells apart by line rather than hue. */
export type OverlayOutline = {
  readonly viewKey: string;
  readonly type: string;
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** Set on an `UNTYPED` view alone (R-UI-060: the pattern, never the colour, carries the meaning). */
  readonly hatched: boolean;
  /** The stored reason a hatched view carries, verbatim; null on every other outline. */
  readonly reason: string | null;
  /**
   * The absence a view no affirmation act names declares — `SCALE_NO_EVIDENCE` or
   * `SCALE_UNIT_UNMAPPED` — or null where a calibration of record stands over it (R-TO-021,
   * L-MEA-05). It is hatched for either reason and counted apart from the untyped ones, so
   * `data-hatched` keeps the meaning J-021 reads it by (I-160).
   */
  readonly scaleRefusal: string | null;
};

/** One axis drawn through its view, in screen pixels, with its bubble where a ring stands. */
export type OverlayDrawnAxis = {
  readonly viewKey: string;
  readonly label: string;
  readonly family: string;
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly bubble: { readonly centre: readonly [number, number]; readonly radius: number } | null;
};

/** What `overlayScene` answers: everything the overlay paints, and no canvas needed to grade it. */
export type OverlayScene = {
  readonly outlines: readonly OverlayOutline[];
  readonly axes: readonly OverlayDrawnAxis[];
};

/**
 * What the overlay paints with, resolved from tokens by the screen and handed in (Decision I-115).
 * No colour is spelled anywhere in this module: the sheet's own `--canvas-*` values and the warn
 * token arrive here already read, exactly as s-viewer hands its painter a palette.
 */
export type OverlayPalette = {
  readonly ink: string;
  readonly warn: string;
  readonly paper: string;
  readonly label: string;
  readonly mono: string;
  /** The type spelling's size on the sheet, in CSS pixels. */
  readonly typeSizePx: number;
  /** A bubble label's size on the sheet, in CSS pixels. */
  readonly labelSizePx: number;
};

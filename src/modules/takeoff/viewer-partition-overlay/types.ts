// R-TO-014's overlay, as a value: the stored partition of one drawing read onto one sheet, the two
// switches that gate what is painted, and the scene those three answer.
//
// Every field a stored row already carries is taken FROM that row's own type rather than respelled
// here (B-19): a view is `ViewRecord`'s reading with the two facts a sheet adds — how many
// assignments name it and the box its members stand in — and an axis is the grid row with the ring
// it was read off. A column that changes shape is a compile error here rather than a drift.
import type { GridAxisRow, GridDeferralRow } from "@/modules/takeoff/partition";
import type { ViewRecord } from "@/core/views";
import type { RoomOutlineStatus, StoredRoomLabel } from "@/core/db";

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

/**
 * One room the rooms stage read off an architect's plan (s-takeoff I-643…d) — or one closed
 * region that is not a room, with the register's code for why. The outline and the anchor are in the
 * MODEL's coordinates, as the partition read them; the scene carries them onto whatever sheet shows
 * the plan through the plan's own grid (I-647).
 */
export type PartitionOverlayRoom = {
  readonly roomKey: string;
  readonly viewKey: string;
  readonly status: RoomOutlineStatus;
  readonly reason: string | null;
  readonly name: string | null;
  readonly labels: readonly StoredRoomLabel[];
  readonly outline: { readonly outer: readonly (readonly [number, number])[]; readonly holes: readonly (readonly (readonly [number, number])[])[] } | null;
  /** The area in square metres, as the exact decimal the store holds. */
  readonly areaM2: string | null;
  readonly anchor: readonly [number, number];
  /** How many surfaces the room registered: three for a room, one (its floor) for an open space. */
  readonly faces: number;
};

/** What the door and the feed answer: one reading of one ingest record, onto one sheet. */
export type PartitionOverlay = {
  readonly ingestId: string;
  readonly views: readonly PartitionOverlayView[];
  readonly axes: readonly PartitionOverlayAxis[];
  readonly deferrals: readonly GridDeferralRow[];
  /** The rooms the architect's plans enclose — absent from a reading that predates the rooms stage. */
  readonly rooms?: readonly PartitionOverlayRoom[];
};

/**
 * The switches. They gate paint and nothing else — no camera, address, selection or hit-test. The
 * rooms switch is on unless it is turned off: a sheet that shows a plan shows what was read off it.
 */
export type OverlayToggles = { readonly views: boolean; readonly grid: boolean; readonly rooms?: boolean };

/** One view's outline, in screen pixels, with what the paint tells apart by line rather than hue. */
export type OverlayOutline = {
  readonly viewKey: string;
  /** The stored type spelling, verbatim — what the counts and the hatch are judged by. */
  readonly type: string;
  /** The words the chip at the outline's corner says: the type as a reader reads it (R-UI-082, I-114). */
  readonly label: string;
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

/**
 * One room as the sheet paints it, in screen pixels: its outline and holes, the point its chip stands
 * at, and the words the chip says. What tells a room from a void from one whose walls do not close is
 * LINE, never hue (R-UI-060): a room is outlined solid, a void dotted, and an unclosed room has no
 * outline at all — only its chip, in the warn ink, saying why.
 */
export type OverlayDrawnRoom = {
  readonly roomKey: string;
  readonly status: RoomOutlineStatus;
  readonly outer: readonly (readonly [number, number])[];
  readonly holes: readonly (readonly (readonly [number, number])[])[];
  readonly anchor: readonly [number, number];
  /** The chip's lines: the room's name, then its area or the reason it carries. */
  readonly lines: readonly string[];
};

/** What `overlayScene` answers: everything the overlay paints, and no canvas needed to grade it. */
export type OverlayScene = {
  readonly outlines: readonly OverlayOutline[];
  readonly axes: readonly OverlayDrawnAxis[];
  /** The rooms, where the overlay carries any — absent where it carries no rooms stage's reading. */
  readonly rooms?: readonly OverlayDrawnRoom[];
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

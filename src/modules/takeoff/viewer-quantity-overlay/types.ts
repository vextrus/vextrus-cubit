// R-TO-015 / R-TO-044's overlay, as a value: every published quantity of the rendered campaign whose
// member stands on the opened sheet, grouped per placement, and the scene and legend it answers.
//
// Every field a stored row already carries is taken FROM that row's own type rather than respelled
// here (B-19): a class is the catalogue's `ElementType`, a kind the catalogue's `Kind`, a basis the
// offer law's `QuantityBasis`, a condition's colour and hatch the manual law's rosters.
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { ConditionColour, ConditionHatch } from "@/core/manual/law";
import type { QuantityBasis } from "@/core/offers/law";
import type { Unit } from "@/core/units/canon";
import type { OverlayBox } from "@/modules/takeoff/viewer-partition-overlay/types";

export type { OverlayBox };

/** Where a placement's quantities came from: a rail's reading of the drawing, or a person's hand measurement. */
export type QuantitySource = "rail" | "manual";

/** One kind's COMPLETE figure on one placement: the exact sum of its lines, never rounded (B-07). */
export type QuantitySum = {
  readonly kind: Kind;
  readonly unit: Unit;
  /** The exact decimal sum of every COMPLETE line of this kind on this placement. */
  readonly value: string;
  readonly lines: number;
};

/**
 * One kind of one placement that was SEEN and not billed: a PARTIAL_DECLARED line (L-QTY-02) or a
 * queue item (L-QTY-04). It carries its registered codes and the variables a partial line omitted —
 * its reason — and never a figure: a partial row is never totalled (L-QTY-07).
 */
export type QuantityUnmeasured = {
  readonly kind: Kind;
  readonly codes: readonly string[];
  readonly variables: readonly string[];
};

/**
 * One member of the rendered campaign that stands on the opened sheet, with what was measured off it.
 * `keys` are the entity keys it was read off that stand on this sheet (the outline and the mark of a
 * rail placement); `rings` the outline's own vertices on this sheet, where its records carry them.
 */
export type QuantityPlacement = {
  /** The placement key for a rail's member; the register object's own key for a hand measurement. */
  readonly key: string;
  readonly source: QuantitySource;
  readonly class: ElementType;
  readonly mark: string;
  /** The condition the legend keys this placement under (I-634). */
  readonly condition: QuantityCondition;
  readonly keys: readonly string[];
  readonly box: OverlayBox;
  readonly rings: readonly (readonly (readonly [number, number])[])[];
  /** The weakest basis of its COMPLETE lines (L-QTY-01's roll-up), or null where nothing was measured. */
  readonly basis: QuantityBasis | null;
  readonly sums: readonly QuantitySum[];
  readonly unmeasured: readonly QuantityUnmeasured[];
};

/**
 * What the legend keys a placement by (R-TO-044): a condition — the manual chest's own recipe for a
 * hand measurement, and for a rail's member its CLASS read as a condition (I-634).
 */
export type QuantityCondition = {
  /** `class:<class>` for a rail class read as a condition, `condition:<name>` for a chest condition. */
  readonly key: string;
  readonly source: QuantitySource;
  readonly class: ElementType;
  /** The chest condition's own name; null for a rail class, which is said in words by the screen. */
  readonly name: string | null;
  readonly colour: ConditionColour;
  readonly hatch: ConditionHatch;
};

/** A sheet of the same drawing on which more of the campaign's members stand (the resolver names it). */
export type QuantityElsewhere = {
  readonly layoutName: string;
  /** How a reader names the sheet — its number, where the title block states one. */
  readonly label: string;
  readonly placements: number;
};

/** What the door and the feed answer: the rendered campaign's quantities, onto one sheet. */
export type QuantityOverlay = {
  readonly campaignId: string;
  readonly placements: readonly QuantityPlacement[];
  readonly elsewhere: readonly QuantityElsewhere[];
};

/** The two switches. They gate paint and the legend's unmeasured rows, and nothing else. */
export type QuantityToggles = { readonly quantities: boolean; readonly unmeasured: boolean };

/** One legend row: a condition, the placements of it on this sheet, and its measured-scope totals. */
export type QuantityLegendRow = {
  readonly condition: QuantityCondition;
  /** How many of its placements on this sheet carry a COMPLETE figure. */
  readonly measured: number;
  /** Per kind, the exact sum of the COMPLETE figures — measured scope, never a grand total (L-QTY-07). */
  readonly totals: readonly QuantitySum[];
  /** How many of its placements carry a kind that was seen and not billed. */
  readonly unmeasured: number;
  /** The codes those kinds were left for, and the variables they omitted, each once. */
  readonly codes: readonly string[];
  readonly variables: readonly string[];
};

/** The legend of the visible sheet, and the bases its paint uses (each one keyed once, colour and glyph). */
export type QuantityLegend = {
  readonly rows: readonly QuantityLegendRow[];
  readonly bases: readonly QuantityBasis[];
};

/** One placement as the canvas paints it, in screen pixels. */
export type QuantityFill = {
  readonly key: string;
  readonly colour: ConditionColour;
  readonly hatch: ConditionHatch;
  /** The rings to fill, in screen pixels; empty where the outline's records carry no vertices, and the rect is filled. */
  readonly rings: readonly (readonly (readonly [number, number])[])[];
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** Null on a placement nothing was measured on: it is hatched as unmeasured, never filled. */
  readonly basis: QuantityBasis | null;
  /** Set where a kind of it was seen and not billed, and the switch shows the unmeasured. */
  readonly unmeasured: boolean;
};

/** What `quantityScene` answers: everything the canvas paints, and no canvas needed to grade it. */
export type QuantityScene = { readonly fills: readonly QuantityFill[] };

/**
 * What the canvas paints with, resolved from tokens by the screen and handed in (I-115's precedent).
 * No colour is spelled in this module: the element palette, the basis palette and the warn token
 * arrive read, and the basis glyphs arrive from their one home (`src/ui/primitives/core/basis.ts`).
 */
export type QuantityPalette = {
  readonly condition: Readonly<Record<ConditionColour, string>>;
  readonly basis: Readonly<Record<QuantityBasis, string>>;
  readonly glyph: Readonly<Record<QuantityBasis, string>>;
  readonly warn: string;
  readonly paper: string;
  readonly mono: string;
  readonly glyphSizePx: number;
};

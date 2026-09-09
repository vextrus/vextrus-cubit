// R-TO-021's sheet line, derived: the state a sheet's scale stands at, read from the calibrations in
// force over its views rather than from anything stored beside them (R-TO-004's three states,
// docs/design/s-scale.md § 1).
//
// Pure — no store, no clock. The reading the sheet grammar already made (`unplaceable` for a layout
// carrying no extent or no drawing unit) is kept as it stands and never re-derived here: that is a
// fact about the LAYOUT, and this file answers about its views (B-17).
import type { ScaleState } from "@/core/sheets/law";

/** One view of a sheet, narrowed to what a state derivation reads (the scale door's own answer). */
export type ScaleStateView = {
  readonly viewKey: string;
  /** The calibration of record over this view, with the anisotropy judgement the door made of it. */
  readonly affirmed: { readonly placeable: boolean } | null;
  /**
   * The absence code a view no act names declares, where the caller already knows which (L-MEA-05).
   * Optional: whether a view HAS a calibration is what this state stands on, and which absence it
   * declares is the scale door's own reading of the header — never re-derived here (B-17).
   */
  readonly refusal?: string | null;
};

/** What a sheet's scale line stands at: the state, how many views have no scale of record, and of how many. */
export type SheetScaleState = {
  readonly state: ScaleState;
  /** The count of views with no calibration of record or an unplaceable one; null where none was derived. */
  readonly unplaceable: number | null;
  readonly total: number;
};

/**
 * The state one sheet's scale line reads at.
 *
 * `unaffirmed` where there is no view to have a scale — a count nobody derived is never invented.
 * `affirmed` where every view stands under a calibration of record judged placeable at the edition's
 * anisotropy tolerance. Otherwise `unplaceable`, counting every view with no calibration of record
 * or an unplaceable one — which for a sheet whose header names no mapped length unit is every view
 * of it, because no rank carries a factor there at all (L-MEA-05's strict unit lane).
 */
export function scaleStateOf(core: ScaleState | string, views: readonly ScaleStateView[]): SheetScaleState {
  const total = views.length;
  // The layout carries no extent or no drawing unit: it cannot be placed at any scale, whatever its
  // views say, and that reading is the sheet grammar's own (B-17).
  if (core === "unplaceable") return { state: "unplaceable", unplaceable: null, total };
  if (total === 0) return { state: "unaffirmed", unplaceable: null, total };

  const without = views.filter((view) => view.affirmed === null || !view.affirmed.placeable).length;
  if (without === 0) return { state: "affirmed", unplaceable: 0, total };
  return { state: "unplaceable", unplaceable: without, total };
}

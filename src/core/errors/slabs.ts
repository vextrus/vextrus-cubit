// The SLABS rails' own refusals — L-MEA-08's rail-local codes, keyed (slab · shear_wall · stair ×
// rcc.concrete · rcc.formwork).
//
// A rail's refusals belong to the rail, so the file the slab, shear-wall and stair rails are written
// in is the file their codes are registered in, and no two rails ever edit one list (AM-11). The
// codes those rails also report under — `VIEW_SCALE_UNAFFIRMED` and `SECTION_BAND_UNCOVERED` — are
// the frame area's registration and are not re-declared here: one code has one home (B-17).

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type SlabsRefusalCode =
  | "JUNCTION_DEFERRED"
  | "JUNCTION_UNBOUNDED"
  | "COMPLEX_STAIR_GEOMETRY"
  | "PLAN_READING_ABSENT"
  | "OUTLINE_NOT_CLOSED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const SLABS_REFUSALS: RefusalGroup<SlabsRefusalCode> = Object.freeze({
  // L-QTY-04: a junction the reading could only BOUND is deducted at its bound and the figure is
  // then UNDER, which is a lawful disclosure — so the line stands and says so.
  JUNCTION_DEFERRED: Object.freeze({
    code: "JUNCTION_DEFERRED",
    message: "The drawing bounds this junction without stating it, so the quantity is taken off at that bound and stands under.",
    remedy: "State the junction on the drawing — the column, wall or beam it meets — then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  // L-QTY-04: "over-measurement → hard block, never a disclosure". A junction with no bound at all
  // cannot be deducted at anything, so nothing publishes rather than a figure that reads over.
  JUNCTION_UNBOUNDED: Object.freeze({
    code: "JUNCTION_UNBOUNDED",
    message: "Nothing in the drawing bounds this junction, so a quantity for the member would read over what it really is.",
    remedy: "Draw or schedule the members this one meets, then measure the campaign again.",
    severity: "error",
    surface: "inline",
  }),
  // AM-06 §3: a straight flight and a rectangular landing are measured; anything else is deferred
  // rather than approximated by the nearest shape the machine knows (L-MEA-03).
  COMPLEX_STAIR_GEOMETRY: Object.freeze({
    code: "COMPLEX_STAIR_GEOMETRY",
    message: "This stair is not a straight flight or a rectangular landing, so it is left for a person to measure.",
    remedy: "Measure the stair by hand on the sheet, or simplify the drawing into straight flights and rectangular landings.",
    severity: "warning",
    surface: "inline",
  }),
  // L-MEA-08: a rail measures from what a reader read. A placement with no plan reading has no
  // plate, drop, flight, landing or wall run to measure, and the row reaches the residue as evidence.
  PLAN_READING_ABSENT: Object.freeze({
    code: "PLAN_READING_ABSENT",
    message: "Nobody has read a plan for this member, so there is no outline, thickness or run to measure it by.",
    remedy: "Run the drawing's partition so its plans are read, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  // L-MEA-03: "a surface that is not a closed outline defers with a reason — never bounding-boxed".
  OUTLINE_NOT_CLOSED: Object.freeze({
    code: "OUTLINE_NOT_CLOSED",
    message: "This member's outline does not close, so its area cannot be measured without inventing the missing edge.",
    remedy: "Close the outline on the drawing, then run the partition and measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
});

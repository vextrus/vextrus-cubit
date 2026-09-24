// The MASONRY rail's own refusals — L-MEA-08's rail-local codes, keyed
// (brick_wall × masonry.brickwork | surface × finish.plaster | finish.paint).
//
// A rail's refusals belong to the rail, so the file a rail is written in is the file its codes are
// registered in, and no two rails ever edit one list (AM-11). The barrel `src/core/errors.ts` already
// enumerates this file.
//
// Every code below names ONE reading that was not stated, and every one is a `warning` rendered
// `inline`: a wall nobody has read the schedule for yet is expected and recoverable in stride, not an
// error state — the measurement stops, the row says why, and a reader knows which cell to go and read
// (L-QTY-02, L-QTY-04, R-UI-050).
//
// The first four stop the measurement entirely, because measuring past them would OVER-measure: a
// face with no schedule behind it would be billed gross, an opening nobody could read would be billed
// as solid wall, a row claiming floors nothing can place would be counted on the wrong storey, and a
// surface that is not a closed outline would be billed as its bounding box (L-MEA-02, L-MEA-03). The
// last five keep the row and name the reading it wants.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type MasonryRefusalCode =
  | "OPENING_SCHEDULE_ABSENT"
  | "OPENING_NOT_AREABLE"
  | "OPENING_FLOOR_UNJUDGEABLE"
  | "SURFACE_NOT_CLOSED"
  | "WALL_LENGTH_UNSTATED"
  | "WALL_HEIGHT_UNSTATED"
  | "WALL_THICKNESS_UNSTATED"
  | "FINISH_GROSS_UNSTATED"
  | "FINISH_SELECTOR_UNSTATED"
  | "OPENING_UNPLACED"
  | "OPENING_UNSCHEDULED"
  | "WALL_LINTEL_UNDEDUCTED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const MASONRY_REFUSALS: RefusalGroup<MasonryRefusalCode> = Object.freeze({
  // L-MEA-02: "the opening schedule is the authority; a face with no schedule is not measured (gross
  // area would over-measure)". So a wall or a surface the schedule reader has not read stands
  // unmeasured and says so — never measured gross and corrected later.
  OPENING_SCHEDULE_ABSENT: Object.freeze({
    code: "OPENING_SCHEDULE_ABSENT",
    message: "No opening schedule stands behind this face, so it is not measured — its gross area would over-measure the work.",
    remedy: "Read the opening schedule for this wall or surface, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  // L-MEA-03: "an opening seen but not areable is flagged". A row whose size cell nobody could read
  // is an opening that exists, so the face around it is not measured as though it were solid.
  OPENING_NOT_AREABLE: Object.freeze({
    code: "OPENING_NOT_AREABLE",
    message: "This scheduled opening was seen but states no area that can be measured, so the face it stands in is not measured.",
    remedy: "Read the opening schedule row's size cell, or record the opening's width and height, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  // L-MEA-02: "opening marks are scoped to their floor group". A row claiming an endpoint no live
  // level carries is a statement nothing can judge — the same fact L-CAD-07 answers for a person's
  // range — so the face is not measured rather than measured as if the row had claimed nothing.
  OPENING_FLOOR_UNJUDGEABLE: Object.freeze({
    code: "OPENING_FLOOR_UNJUDGEABLE",
    message: "This opening schedule row claims floors the level stack cannot place, so nothing can say which storeys it deducts from.",
    remedy: "Correct the row's floor range, or insert the levels it names, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  // L-MEA-03: "a surface that is not a closed outline defers with a reason — never bounding-boxed".
  SURFACE_NOT_CLOSED: Object.freeze({
    code: "SURFACE_NOT_CLOSED",
    message: "This surface was not read as a closed outline, so its area is not measured — a bounding box around it would not be the face.",
    remedy: "Close the surface's outline in the drawing, or read the face again, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  WALL_LENGTH_UNSTATED: Object.freeze({
    code: "WALL_LENGTH_UNSTATED",
    message: "Nothing states this wall's length, so its brickwork carries no quantity.",
    remedy: "Read the wall's length off the wall plan, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  WALL_HEIGHT_UNSTATED: Object.freeze({
    code: "WALL_HEIGHT_UNSTATED",
    message: "Nothing states this wall's height, so its brickwork carries no quantity.",
    remedy: "Read the wall's height off the section, or author the storey height of the level it stands on, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  WALL_THICKNESS_UNSTATED: Object.freeze({
    code: "WALL_THICKNESS_UNSTATED",
    message: "Nothing states this wall's nominal thickness, so its brickwork carries no quantity and no item can be selected for it.",
    remedy: "Read the wall's nominal thickness off the wall plan or its type mark, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  FINISH_GROSS_UNSTATED: Object.freeze({
    code: "FINISH_GROSS_UNSTATED",
    message: "Nothing states this surface's gross area, so the finish on it carries no quantity.",
    remedy: "Read the surface's outline, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  // L-MEA-06 bars a default from a selecting attribute: an unread mix or thickness is the right
  // number at the wrong rate, so the quantity stands and the ITEM is what cannot be priced (L-QTY-03).
  FINISH_SELECTOR_UNSTATED: Object.freeze({
    code: "FINISH_SELECTOR_UNSTATED",
    message: "Nothing states one of the facts that select this finish's item, so the quantity stands but the line cannot be priced.",
    remedy: "Read the finish schedule's thickness and mix for this surface, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  // The wall lane's three (s-takeoff I-591, I-594). Each stops a wall before any reading is
  // bound, because measuring past it would OVER-measure: an opening the schedule states and the plan
  // does not place may stand in any wall of those floors (L-MEA-02 with L-QTY-04: fewer placements
  // than the schedule prints is a hard block, never a disclosure); an opening no row of its plan's
  // schedule states has no size to deduct; and a lintel over an opening, deducted nowhere, would be
  // billed as brick.
  OPENING_UNPLACED: Object.freeze({
    code: "OPENING_UNPLACED",
    message: "The opening schedule states more of this opening on these floors than the plan places, so nothing says which wall the rest stand in — no wall of these floors is measured.",
    remedy: "Find the openings the plan does not tag, or state the schedule's quantity again, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  OPENING_UNSCHEDULED: Object.freeze({
    code: "OPENING_UNSCHEDULED",
    message: "An opening stands in this wall that no row of its plan's opening schedule states, so its size is unknown and the wall is not measured.",
    remedy: "Read the opening schedule that states this mark for these floors, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  WALL_LINTEL_UNDEDUCTED: Object.freeze({
    code: "WALL_LINTEL_UNDEDUCTED",
    message: "An opening stands in this wall and the lintel over it is deducted nowhere, so the wall is not measured — its brickwork would bill the lintel's concrete as brick.",
    remedy: "Read the lintel schedule for the openings in this wall, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
});

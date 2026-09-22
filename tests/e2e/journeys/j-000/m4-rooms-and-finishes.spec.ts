/**
 * J-000 SEGMENTS: take rooms and finishes
 *
 * MISSING DOOR: F-ARCH is not in the tree — no fixture carries a room, a room label, a door or window schedule or a finish schedule, and fixtures/rcc6-bnbc/arch-plan.dxf is a 25-entity xref stub — and the product models no room, closes its kinds on no floor or ceiling finish, and hands its finishes rail an empty surfaces seam; no golden holds a plaster, paint or room row to walk against.
 *
 * The third of AM-17's four M4 segments — AM-09 §3's "rooms and finishes taken" — declared before the
 * milestone lands, in its own file since session 7 split the leg one file per segment. Of the four it
 * is the door furthest off: the fixture it walks does not exist, so no amount of product work inside
 * this tree could make it walk.
 *
 * THE MEASURED WORK BEHIND EACH DOOR.
 * 1. No F-ARCH. The architectural set (docs/specs/cubit.bible.xml:725 — floor plans with rooms and
 *    labels, door/window schedules, a finish schedule, wall types, and a hand takeoff for finishes and
 *    openings) exists nowhere: outside docs/specs its id stands once, in a comment
 *    (tests/takeoff/rails/masonry-finishes/registration.test.ts:93, "once F-ARCH brings rooms").
 *    fixtures/rcc6-bnbc/arch-plan.dxf is the drawing S-13 binds as an xref (fixtures/gen/README.md:72),
 *    counted with ezdxf at 25 entities — 8 WALL lines, 8 WINDOW lines, 4 DOOR arcs, 4 DOOR lines and
 *    one TEXT, "ARCHITECTURAL BACKGROUND (BOUND XREF)" — with no room, label or schedule. F-RCC6-BNBC's
 *    golden has no plaster, paint or room row (fixtures/rcc6-bnbc/takeoff.golden.json: zero matches).
 * 2. No rooms. Nothing in src models a room or a space; the word stands only in prose. R-TO-036
 *    (cubit.bible.xml:470) derives room outlines from wall geometry and offers their faces — floor,
 *    ceiling, walls — under the face algebra; the closed kinds (src/core/catalogue/kinds.ts:12-26)
 *    hold finish.plaster and finish.paint and no floor or ceiling finish. Nothing in src answers to
 *    R-TO-037's learn-and-count (:471), which is how J-042 counts the doors.
 * 3. The finishes rail answers nothing in production. finish.plaster and finish.paint have their rails
 *    (src/modules/takeoff/rails/masonry-finishes/finishes.ts:163,166), and the measure job hands them
 *    `walls: {}` and `surfaces: {}` (src/modules/takeoff/measure/setup.ts:274-279) until the
 *    opening-schedule reader (S-25) lands, so they report OPENING_SCHEDULE_ABSENT — a face with no
 *    schedule is not measured, because its gross area would over-measure the work.
 *
 * THE LAW THAT FORCES IT. AM-01 (cubit.bible.xml:921): the golden is authored by the generator's
 * independent model, never by the product's methods — so the finishes cannot be walked against a
 * figure the product computes for itself. M4's exit (:829): "F-ARCH finishes within band". L-MEA-08
 * (:224): the face algebra is "a face of a space, gross less scheduled openings". J-042 (:753): rooms
 * and finishes on F-ARCH, opening deductions per rule, learn-and-count doors.
 *
 * HONEST SIZE. XL, and its own increment: an F-ARCH generator under fixtures/gen with an independent
 * hand takeoff for finishes and openings; rooms from walls under the face algebra, their names proposed
 * from cited labels (L-AI-03); floor and ceiling finish kinds; the opening schedules into the setup
 * seams; learn-and-count. None of it stands on the M3 fixture.
 *
 * The increment that lands these doors deletes this fixme and its line in
 * tests/journeys/fixme-roster.test.ts and writes the walk here; it never deletes the file (AM-09 §3,
 * AM-17).
 */
import { test } from "@playwright/test";

test.describe("J-000 — Golden Path: M4's rooms and finishes (AM-09 §3, AM-17), owed", () => {
  test.fixme("MISSING DOOR: J-000 m4-rooms-and-finishes: F-ARCH is not in the tree (arch-plan.dxf is a 25-entity xref stub and no golden holds a plaster, paint or room row), nothing in the product models a room, and the finishes rail's surfaces seam is hard-coded empty", () => {
    // AM-09 §3, AM-17: the walk lands with its doors; until then the leg is declared, collected and impossible to forget.
  });
});

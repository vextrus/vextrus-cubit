/**
 * J-000 SEGMENTS: measure a manual condition
 *
 * MISSING DOOR: S-Measure's Design Decision stands (docs/design/s-measure.md, C-13) and the viewer's Linear, Area and Count tools are armed — they draw, snap, cut out and read their figure live — but nothing they draw can be recorded: the product has no manual measurement act, no identity rule for a register row that carries no mark, no method over POLYLINE or POLYGON geometry and no condition to measure under (s-measure I-497).
 *
 * The second of AM-17's four M4 segments — AM-09 §3's "a manual condition measured" — declared before
 * the milestone lands. This file claimed all four segments until session 7 split the leg one file per
 * segment; it keeps its name and now claims this one, beside m4-pdf-sheet.spec.ts,
 * m4-rooms-and-finishes.spec.ts and m4-ask-the-drawings.spec.ts. Of the four it is the door nearest
 * to hand: it stands on the DXF the golden run already ingested, confirmed and scale-affirmed.
 *
 * THE MEASURED WORK BEHIND EACH DOOR.
 * 1. The Design Decision — landed. docs/design/s-measure.md (session 8, S0) rules the tool chest,
 *    the conditions/assemblies editor, the measurement list and the legend
 *    (docs/specs/cubit.bible.xml:625), the gesture grammar, the inline card, the book, every R-UI-050
 *    state and the law readings the doors below need (I-370 … I-394). viewer.md reserves the tool
 *    row (docs/design/viewer.md:27) and its IOU names the tools' owner (viewer.md:2370-2371); both
 *    cite s-measure.md at the wave's integration, so one row never has two spellings.
 * 2. The act — landed (session 8, S1). RECORD_MANUAL_MEASUREMENT under MEASURE
 *    (src/core/acts/record-manual-measurement.ts; L-ACT-03, cubit.bible.xml:210), behind the
 *    takeoffManual.preview/commit doors (src/server/routers/takeoff-manual.ts); an edit supersedes and
 *    strikes its predecessor, a delete is REPUDIATE (s-measure.md I-379).
 * 3. The identity — landed (session 8, S1). A hand row's mark is `~m.` and sixteen hex of its
 *    content (src/core/manual/identity.ts, s-measure.md I-378), and it registers through the
 *    register's one door, now in core (src/core/register/store.ts `registerSightingsIn`, I-495);
 *    the double-count guards between hand measurements and against the machine's cells stand at the
 *    act's preview (I-380 … I-382).
 * 4. No method, no condition. The offer law admits POLYLINE, POLYGON and POINT_SET geometry
 *    (src/core/offers/law.ts:57) and the RASTER engine (:63), and no method under
 *    src/core/rulesets/methods/ names any of them; no condition or assembly store exists; and the gate
 *    refuses an offer for an object nothing registered (src/core/gate/evaluate.ts:280).
 * 5. The tools — landed (session 8, S4). Linear L, Area A and Count C arm in the tool row; the
 *    gesture grammar is src/modules/takeoff/viewer-measure/gesture.ts, wired by the route's
 *    measure-region.tsx. S-08 is a paper sheet (its plan seen through viewport 2077 at 1:100), and the
 *    running figure is carried into metres through that window (s-measure I-501). Proven in jsdom
 *    only (tests/takeoff/viewer-measure/measure-screen.test.tsx): over 81D and 830 projected through
 *    2077 and the view's DIMENSION_RATIO 0.001 m per model unit, 81D reads A 328.838 m² and 320.791 m²
 *    with the pit cut out. Not yet walked in the running product. Each placed point keeps the source
 *    keys its snap was met on, which is what R-TO-040's act must cite, but it stands in PAPER
 *    coordinates, which the act must map back through its window (I-378); with no condition picked a
 *    finished shape is a draft and nothing is recorded, because no card and no act stand yet (I-497).
 *
 * THE LAW THAT FORCES IT. C-13 (cubit.bible.xml:800): "A screen with no Design Decision is not ready
 * to build". R-TO-040 (:475): every measurement is an act with geometry citing the entities snapped
 * to, MEASURED on vector geometry, and its results are offers to the gate under a chosen kind, never
 * lines the tool writes. L-MEA-08 (:224): a rail per quantity kind, never per drawing — so a manual
 * brickwork offer feeds the kind's own rail through its setup seam, not a second rail. J-041 (:752).
 *
 * HONEST SIZE. L: s-measure.md; the act type with its pair; the identity rule for a markless row; a
 * method pair over POLYLINE/POLYGON in an edition (a migration, as 0056 was); a minimal condition
 * store; Linear and Area armed; the measurement list; the live-database authorize() refusal. The first
 * condition is best a kind with no openings — blinding by area, SLAB × BLINDING at GF on S-08 — because
 * masonry waits on the opening schedule (OPENING_SCHEDULE_ABSENT, src/modules/takeoff/measure/
 * setup.ts:341-346). The leg asserts the gate's evaluation of what S-08 draws, less the register's GF
 * columns (s-measure.md I-389, I-393), never the golden's 23.615 m³
 * (fixtures/rcc6-bnbc/takeoff.golden.json:8495-8506), an informational row on the authored model.
 *
 * The increment that lands these doors deletes this fixme and its line in
 * tests/journeys/fixme-roster.test.ts and writes the walk here; it never deletes the file (AM-09 §3,
 * AM-17).
 */
import { test } from "@playwright/test";

test.describe("J-000 — Golden Path: M4's manual condition (AM-09 §3, AM-17), owed", () => {
  test.fixme("MISSING DOOR: J-000 m4-sheet-and-manual-measure: a hand measurement is recorded as an act with a markless register row (S1), and nothing yet turns one into a line — no method over POLYLINE or POLYGON geometry, no manual arm of a rail, no condition chest, and the viewer's Linear, Area and Count tools stand disabled", () => {
    // AM-09 §3, AM-17: the walk lands with its doors; until then the leg is declared, collected and impossible to forget.
  });
});

/**
 * J-000 SEGMENTS: measure a manual condition
 *
 * MISSING DOOR: S-Measure has no Design Decision, so by C-13 the screen is not ready to build; and beneath it the product has no manual measurement act, no identity rule for a register row that carries no mark, no method over POLYLINE or POLYGON geometry and no condition to measure under — the viewer's Linear, Area and Count tools stand disabled, "Measurement tools arrive with S-Measure".
 *
 * The second of AM-17's four M4 segments — AM-09 §3's "a manual condition measured" — declared before
 * the milestone lands. This file claimed all four segments until session 7 split the leg one file per
 * segment; it keeps its name and now claims this one, beside m4-pdf-sheet.spec.ts,
 * m4-rooms-and-finishes.spec.ts and m4-ask-the-drawings.spec.ts. Of the four it is the door nearest
 * to hand: it stands on the DXF the golden run already ingested, confirmed and scale-affirmed.
 *
 * THE MEASURED WORK BEHIND EACH DOOR.
 * 1. No Design Decision. docs/design/ holds no s-measure.md. S-Measure is a tool chest, a
 *    conditions/assemblies editor, a measurement list and a legend (docs/specs/cubit.bible.xml:625);
 *    viewer.md reserves the tool row (docs/design/viewer.md:27) and its IOU names the tools' owner
 *    (viewer.md:1995); 00-direction.md §3.1 names the screen (docs/design/00-direction.md:111,147).
 *    The Decision is written first and viewer.md then cites it, or one row has two spellings.
 * 2. No act. ACT_TYPES (src/core/acts/law.ts:11-34) holds no manual measurement act, though L-ACT-03
 *    cuts "manual measurement acts" under MEASURE (cubit.bible.xml:210); a new member needs its
 *    L-ACT-02 rendering pair and its permission.
 * 3. No identity. L-REG-02's key is (project, discipline, level, element type, mark, ordinal)
 *    (cubit.bible.xml:185) and a traced wall carries no mark; L-REG-03's double-count guard (:186)
 *    then meets a manual brick wall on 1F and the machine's own sighting of that wall once masonry
 *    publishes. The rule is ruled before the first row lands, and the row registers through the
 *    register's door (src/modules/takeoff/register/index.ts:210), never through a writer of its own.
 * 4. No method, no condition. The offer law admits POLYLINE, POLYGON and POINT_SET geometry
 *    (src/core/offers/law.ts:57) and the RASTER engine (:63), and no method under
 *    src/core/rulesets/methods/ names any of them; no condition or assembly store exists; and the gate
 *    refuses an offer for an object nothing registered (src/core/gate/evaluate.ts:243).
 * 5. The tools are disabled on purpose. viewer-toolbar.tsx:58-62
 *    (src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/) renders Linear L, Area A and
 *    Count C disabled over src/ui/strings/viewer.ts:20; their ids stand (src/ui/testids.ts:679-681).
 *    What already exists is the pick: a SnapResult carries the source keys it was met on
 *    (src/modules/takeoff/viewer-snap/types.ts:44-49), which is what R-TO-040's act must cite.
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
 * condition is best a kind with no openings — blinding by area, the golden's SLAB × BLINDING at GF,
 * 23.615 m³ (fixtures/rcc6-bnbc/takeoff.golden.json:8496-8501) — because masonry waits on the opening
 * schedule (OPENING_SCHEDULE_ABSENT, src/modules/takeoff/measure/setup.ts:274-279).
 *
 * The increment that lands these doors deletes this fixme and its line in
 * tests/journeys/fixme-roster.test.ts and writes the walk here; it never deletes the file (AM-09 §3,
 * AM-17).
 */
import { test } from "@playwright/test";

test.describe("J-000 — Golden Path: M4's manual condition (AM-09 §3, AM-17), owed", () => {
  test.fixme("MISSING DOOR: J-000 m4-sheet-and-manual-measure: S-Measure has no Design Decision (C-13), there is no manual measurement act, no identity rule for a row with no mark and no method over POLYLINE or POLYGON geometry, and the viewer's Linear, Area and Count tools stand disabled", () => {
    // AM-09 §3, AM-17: the walk lands with its doors; until then the leg is declared, collected and impossible to forget.
  });
});

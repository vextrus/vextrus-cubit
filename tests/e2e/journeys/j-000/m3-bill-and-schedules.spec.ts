/**
 * J-000 SEGMENTS: generate BOQ PDF (draft)
 *
 * M3's leg of the golden path, DECLARED before the milestone lands (AM-09 §3): "an M3 leg (levels
 * and schedules transcribed, the structural campaign run on the M3 fixture, the register reviewed,
 * the unpriced BOQ and the BBS emitted as DRAFT - UNSIGNED, the XLSX opened)".
 *
 * It stands as a stub rather than as nothing, because the roster (tests/journeys/j-000-roster.test.ts)
 * derives the golden path's legs from the Bible's own text: a milestone that lands without extending
 * J-000 is red by construction, and this file is where that milestone's leg is owed. The increment
 * that ships M3 replaces this `test.fixme` with the walk — it never deletes the file.
 */
import { test } from "@playwright/test";

test.describe("J-000 — Golden Path: M3's leg (AM-09 §3), owed", () => {
  test.fixme("J-000 m3-bill-and-schedules: levels and schedules transcribed, the campaign run on the M3 fixture, the register reviewed, and the unpriced BOQ and BBS emitted as DRAFT — UNSIGNED with the XLSX opened", () => {
    // AM-09 §3. M3 has not landed; the leg is declared, collected and impossible to forget.
  });
});

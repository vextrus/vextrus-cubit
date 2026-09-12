/**
 * J-000 SEGMENTS: view coverage grid
 * MISSING DOOR: the coverage grid reads a campaign's residue, and a campaign only bears cells once
 * its register holds objects — which needs the door m2-column-lines names (nothing in the UI
 * re-partitions an ingested sheet, so a set pinned after the reading never expands into register
 * objects). On a project a customer has just made, the grid can only ever answer `coverage-empty`.
 * AM-09 §2: "A leg that cannot be reached through the UI is a missing screen, not a licence to
 * stage." J-022 covers the grid today, over a stage.
 *
 * The walk this leg owes: the takeoff lane's own nav entry (`takeoff-nav-coverage`, never a typed
 * URL), the grid's cells with their measurement and bill readings, the legend, and the certificate
 * preview's MEASUREMENT and BILL statements. The increment that lands the door turns this
 * `test.fixme` into a `test` and deletes the MISSING DOOR line above.
 */
import { test } from "@playwright/test";

test.describe("J-000 — Golden Path: what the campaign did and did not establish", () => {
  test.fixme("J-000 m2-coverage-grid: the grid states every cell's coverage, and the certificate preview says it in sentences", () => {
    // Held on the missing door named above (AM-09 §2).
  });
});

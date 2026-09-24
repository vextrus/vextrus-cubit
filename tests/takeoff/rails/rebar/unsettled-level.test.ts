/**
 * I-667, for the bars: a column a bare typical caption left in the UNRESOLVED slot stands on no
 * storey, and the rebar rail reports it under `TYPICAL_RANGE_UNSTATED` against its VIEW — whether
 * its family's schedule is banded or not — and bills nothing.
 *
 * Before, the rail asked `variantCovering` about a member on no level. A banded family answered
 * nothing and the member was reported `REBAR_SCHEDULE_UNREAD` against the schedule entity, which sent
 * the QS to the column schedule; an unbanded family took the foundation slot's level-less arm and
 * made an offer the gate refused without storing the refusal (L-CAD-07, I-368).
 *
 * Pure: the rail is handed exactly what a loader would hand it, and no database is opened.
 */
import { describe, expect, test } from "vitest";
import { placement, railInput, rebarRailDoor, registerRow, variant, VIEW_KEY, zone, type RailShape } from "./support/rebar-contract";

const PLACEMENT_KEY = "PLAN:S-102:t:9|C9|3000.0|3000.0";
const FAMILY = "C9";
const MAIN = [zone({ zone: "main", bars: [{ n: 8, diameterMm: 16 }] })];

/** An unbanded family (one row for every level) and a banded one (GF to 5F). */
const FAMILIES = {
  unbanded: [variant({ variantKey: `${FAMILY}:ALL`, width: 300, depth: 300, rebar: MAIN })],
  banded: [variant({ variantKey: `${FAMILY}:GF-5F`, width: 300, depth: 300, bandFrom: "GF", bandTo: "5F", rebar: MAIN })],
} as const;

describe("I-667: a column on no storey is reported for its range, never for its bar schedule", () => {
  for (const [name, variants] of Object.entries(FAMILIES)) {
    test(`${name} family: TYPICAL_RANGE_UNSTATED against the view, and no bar is billed`, async () => {
      const rail = (await rebarRailDoor())["rebarRail"] as RailShape;
      const row = registerRow({ placementKey: PLACEMENT_KEY, levelSlot: "UNRESOLVED", mark: FAMILY });
      const batch = rail(
        railInput({
          objects: [row],
          placements: { [PLACEMENT_KEY]: placement({ placementKey: PLACEMENT_KEY, memberFamily: FAMILY }) },
          memberTypes: { [FAMILY]: variants },
        }),
      );
      expect(batch.offers, "a member on no storey has no storey run to bill bars over, so nothing is offered").toEqual([]);
      expect(
        batch.observations.map((one) => ({ code: one.code, objectKey: one.objectKey, sourceEntity: one.sourceEntity })),
        "it is reported against THE VIEW, whose range of floors a reader has to go and state (L-CAD-07)",
      ).toEqual([{ code: "TYPICAL_RANGE_UNSTATED", objectKey: String(row["objectKey"]), sourceEntity: VIEW_KEY }]);
    });
  }
});

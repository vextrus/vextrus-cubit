/**
 * The disclosure a member whose reinforcement schedule was never read stands under.
 *
 * `REBAR_SCHEDULE_UNREAD` is the code this leaf answers such a member with, and until now nothing in
 * the executed lane asserted it — it was admitted by a deferral instead, on the reasoning that no
 * member the corpus offers could reach the arm. It can: a register row whose placement the setup does
 * not hold is one, and a rail is a pure function that can be handed one here. Q-07 wants the claim,
 * not the amnesty, so this is the claim.
 *
 * The row is kept and reported rather than measured at zero: reinforcement is never inferred from a
 * section (L-QTY-01, L-QTY-02, L-MEA-08).
 */
import { describe, expect, test } from "vitest";
import { placement, railInput, rebarRailDoor, refusalRegister, registerRow, variant, zone, type RailShape } from "./support/rebar-contract";

/** The member both cases are about: one column, on one level, at one placement. */
const PLACEMENT_KEY = "PLAN:S-102:t:9|C9|3000.0|3000.0";
const FAMILY = "C9";
const LEVEL_ID = "55555555-5555-4555-8555-555555555555";

describe("a member whose reinforcement schedule nobody has read", () => {
  test("is observed under REBAR_SCHEDULE_UNREAD, never billed off its section", async () => {
    const rail = (await rebarRailDoor())["rebarRail"] as RailShape;

    // No placement stands for the row's placement key: nothing has been read for this member at all.
    const batch = rail(
      railInput({
        objects: [registerRow({ placementKey: PLACEMENT_KEY, levelId: LEVEL_ID, levelLabel: "1F", mark: FAMILY })],
        placements: {},
        memberTypes: {},
      }),
    );

    expect(
      batch.observations.map((one) => one.code),
      "a column with nothing read for it is reported by name, and no line is published for bars nobody stated (L-QTY-01)",
    ).toContain("REBAR_SCHEDULE_UNREAD");
    expect(batch.offers, "and the member is not billed: an unread schedule states no steel, not zero steel").toEqual([]);

    const register = await refusalRegister();
    expect(Object.hasOwn(register, "REBAR_SCHEDULE_UNREAD"), "REBAR_SCHEDULE_UNREAD is a code the one register holds (Q-07)").toBe(true);
  });

  test("is observed under the same code where the schedule states no bar group at all", async () => {
    const rail = (await rebarRailDoor())["rebarRail"] as RailShape;

    // Read this far — a placement, a calibration, a covering variant — and the schedule's main zone
    // still states no group: there is nothing to synthesise, and the absence is reported against the
    // schedule cell a reader goes and reads.
    const batch = rail(
      railInput({
        objects: [registerRow({ placementKey: PLACEMENT_KEY, levelId: LEVEL_ID, levelLabel: "1F", mark: FAMILY })],
        placements: { [PLACEMENT_KEY]: placement({ placementKey: PLACEMENT_KEY, memberFamily: FAMILY }) },
        memberTypes: { [FAMILY]: [variant({ variantKey: `${FAMILY}:ALL`, width: 300, depth: 300, rebar: [zone({ zone: "main", bars: null })] })] },
      }),
    );

    expect(
      batch.observations.map((one) => one.code),
      "a schedule that states a section and no bars is an unread schedule for the steel, and says so",
    ).toContain("REBAR_SCHEDULE_UNREAD");
  });
});

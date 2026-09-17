// @vitest-environment node
/**
 * The companion roster for the registry this area appends: `SLAB_WALL_STAIR_RAIL_CODES` (AM-11, Q-07).
 *
 * A rail-local roster is a closed list, so it is frozen here by name rather than derived: a
 * derivation cannot catch a code the roster dropped, and a code the roster gained without a case
 * behind it is exactly the claim Q-07 forbids — "a registered code that nothing can reach is a code
 * nobody will ever read". What the roster CLAIMS is judged here (each code is registered, whole, in
 * the one closed taxonomy the tree reads); that each is reached by a rail is judged where the rails
 * are driven, beside this area's acceptance.
 *
 * Pure: a code is data and the register is data. Nothing here reaches a store or a clock.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { SLABS_REFUSALS } from "@/core/errors/slabs";
import { SLAB_WALL_STAIR_RAIL_CODES } from "./index";

describe("AM-11: the slab, shear-wall and stair rails' code roster", () => {
  test("the roster is this shard's five and the two it borrows, in the order it reports them", () => {
    expect(
      [...SLAB_WALL_STAIR_RAIL_CODES],
      "the roster names every code one of these rails reports and no other — a code a rail reports and the roster omits is a refusal nobody can enumerate, and one the roster names and no rail reports is a refusal the tree cannot make (AM-11, Q-07)",
    ).toEqual(["JUNCTION_DEFERRED", "JUNCTION_UNBOUNDED", "COMPLEX_STAIR_GEOMETRY", "PLAN_READING_ABSENT", "OUTLINE_NOT_CLOSED", "SECTION_BAND_UNCOVERED", "VIEW_SCALE_UNAFFIRMED"]);
  });

  test("every code of the roster is registered whole, and this area's own five are registered here", () => {
    for (const code of SLAB_WALL_STAIR_RAIL_CODES) {
      const entry = REFUSALS[code];
      expect(entry, `\`${code}\` stands in the one closed register the whole tree reads — a rail's roster never mints a code of its own (Q-07)`).toBeTruthy();
      expect((entry?.message ?? "").length, `\`${code}\` says what was refused, in words`).toBeGreaterThan(0);
      expect((entry?.remedy ?? "").length, `\`${code}\` says what to do about it — a refusal teaches the next action (R-UI-050)`).toBeGreaterThan(0);
    }

    // `VIEW_SCALE_UNAFFIRMED` and `SECTION_BAND_UNCOVERED` are the register's from before this area:
    // a code has one home, and this shard's own five are the ones written in its own area file (AM-11).
    expect(
      Object.keys(SLABS_REFUSALS).sort(),
      "the slabs area registers exactly the codes its own rails are the first to need — a plan nobody read, an outline that does not close, a stair no rule of AM-06 §4 measures, and the two readings of a junction",
    ).toEqual(["JUNCTION_DEFERRED", "JUNCTION_UNBOUNDED", "COMPLEX_STAIR_GEOMETRY", "PLAN_READING_ABSENT", "OUTLINE_NOT_CLOSED"].sort());

    // L-QTY-04 is the whole severity table: a bound is deducted at and disclosed in stride, and a
    // junction nothing bounds blocks, because an over-measured figure is never a disclosure.
    for (const entry of Object.values(SLABS_REFUSALS)) {
      expect({ severity: entry.severity, surface: entry.surface }, `\`${entry.code}\` is refused in stride and rendered inline`).toEqual({
        severity: entry.code === "JUNCTION_UNBOUNDED" ? "error" : "warning",
        surface: "inline",
      });
    }
  });
});

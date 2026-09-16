// @vitest-environment node
/**
 * The companion roster for the registry this area appends: `MASONRY_RAIL_CODES` (AM-11, Q-07).
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
import { MASONRY_REFUSALS } from "@/core/errors/masonry";
import { MASONRY_RAIL_CODES } from "./index";

describe("AM-11: the masonry rails' code roster", () => {
  test("the roster is the two sighting codes and this shard's nine, in the order it reports them", () => {
    expect(
      [...MASONRY_RAIL_CODES],
      "the roster names every code a masonry rail reports and no other — a code a rail reports and the roster omits is a refusal nobody can enumerate, and one the roster names and no rail reports is a refusal the tree cannot make (AM-11, Q-07)",
    ).toEqual([
      "VIEW_SCALE_UNAFFIRMED",
      "MEMBER_TYPE_UNKNOWN",
      "OPENING_SCHEDULE_ABSENT",
      "OPENING_NOT_AREABLE",
      "OPENING_FLOOR_UNJUDGEABLE",
      "SURFACE_NOT_CLOSED",
      "WALL_LENGTH_UNSTATED",
      "WALL_HEIGHT_UNSTATED",
      "WALL_THICKNESS_UNSTATED",
      "FINISH_GROSS_UNSTATED",
      "FINISH_SELECTOR_UNSTATED",
    ]);
  });

  test("every code of the roster is registered whole, and this area's own nine are registered here", () => {
    for (const code of MASONRY_RAIL_CODES) {
      const entry = REFUSALS[code];
      expect(entry, `\`${code}\` stands in the one closed register the whole tree reads — a rail's roster never mints a code of its own (Q-07)`).toBeTruthy();
      expect((entry?.message ?? "").length, `\`${code}\` says what was refused, in words`).toBeGreaterThan(0);
      expect((entry?.remedy ?? "").length, `\`${code}\` says what to do about it — a refusal teaches the next action (R-UI-050)`).toBeGreaterThan(0);
    }

    // The two sighting codes are the register's from before this area: a code has one home, and this
    // shard's own nine are the ones written in its own area file (AM-11).
    expect(
      Object.keys(MASONRY_REFUSALS).sort(),
      "the masonry area registers exactly the codes its own rails are the first to need — each a warning rendered inline, because a reading nobody stated is expected and recoverable in stride",
    ).toEqual(
      [
        "OPENING_SCHEDULE_ABSENT",
        "OPENING_NOT_AREABLE",
        "OPENING_FLOOR_UNJUDGEABLE",
        "SURFACE_NOT_CLOSED",
        "WALL_LENGTH_UNSTATED",
        "WALL_HEIGHT_UNSTATED",
        "WALL_THICKNESS_UNSTATED",
        "FINISH_GROSS_UNSTATED",
        "FINISH_SELECTOR_UNSTATED",
      ].sort(),
    );
    for (const entry of Object.values(MASONRY_REFUSALS)) {
      expect({ severity: entry.severity, surface: entry.surface }, `\`${entry.code}\` is refused in stride and rendered inline`).toEqual({ severity: "warning", surface: "inline" });
    }
  });
});

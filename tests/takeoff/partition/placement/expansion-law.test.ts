/**
 * The two answers the expansion gives a view it cannot expand (L-CAD-07, Q-07).
 *
 * "A bare typical caption states no membership and registers UNRESOLVED rows with no line
 * (`TYPICAL_RANGE_UNSTATED`)... a stated range whose endpoint the stack lacks refuses
 * `LEVEL_RANGE_ENDPOINT_UNMAPPED`." Both are codes of the closed register, and a registered code is
 * one an executed test names (Q-07) — so both are exercised here, on the pure resolver, where the
 * rule they express is decided.
 *
 * Pure: the resolver reads no store, so the evidence is handed in whole.
 */
import { describe, expect, test } from "vitest";
import {
  FOOTING,
  LEVEL_RANGE_ENDPOINT_UNMAPPED,
  TYPICAL_RANGE_UNSTATED,
  UNRESOLVED,
  COLUMN,
  expansionDoor,
} from "../support/placement-stage";

/** One view the placements were read in, as the resolver is handed one. */
const VIEW = { viewClass: "LAYOUT_PLAN", captionAnchorSourceKey: "DXF_HANDLE:1" };

/** The view key the resolver derives for it — spelled by the grammar, never by this file. */
const VIEW_KEY = `v:${VIEW.viewClass}:${VIEW.captionAnchorSourceKey}`;

/** The live stack these captions are read against: two authored levels and nothing above them. */
const LEVELS = [
  { levelId: "11111111-1111-4111-8111-111111111111", label: "1ST", ordinal: 1 },
  { levelId: "22222222-2222-4222-8222-222222222222", label: "2ND", ordinal: 2 },
];

/** One placed member, as the placement stage leaves one. */
function placement(mark: string, elementType: string, x: number): Record<string, unknown> {
  return {
    viewKey: VIEW_KEY,
    view: VIEW,
    placementKey: `${VIEW_KEY}|${mark}|${x}.0,0.0`,
    mark,
    markText: mark,
    elementType,
    x,
    y: 0,
    gridLetter: "A",
    gridNumeral: "1",
    outlineKey: `DXF_HANDLE:${mark}O`,
    markKey: `DXF_HANDLE:${mark}M`,
    memberFamily: null,
  };
}

/** What one caption's evidence resolves to, through the door the contract names. */
async function resolved(caption: string, placements: readonly Record<string, unknown>[]): Promise<{ rows: Record<string, unknown>[]; deferrals: Record<string, unknown>[] }> {
  const door = await expansionDoor();
  const answer = door.resolveExpansion({ placements, views: [{ caption, view: VIEW }], levels: LEVELS, ranges: [] });
  return {
    rows: (answer["rows"] ?? []) as Record<string, unknown>[],
    deferrals: (answer["deferrals"] ?? []) as Record<string, unknown>[],
  };
}

describe("L-CAD-07: the two reasons an expansion defers", () => {
  test("a caption that names no level leaves its columns unresolved and says so", async () => {
    const { rows, deferrals } = await resolved("TYPICAL FLOOR PLAN", [placement("C1", COLUMN, 0)]);

    expect(rows.length, "the member is read: it stands somewhere, and which storey is what is unstated").toBe(1);
    expect(String(rows[0]?.["objectKey"]), `the row stands in the ${UNRESOLVED} slot (L-REG-04)`).toContain(UNRESOLVED);
    expect(deferrals.map((deferral) => deferral["reason"]), "and the view defers under the reason the register names").toEqual([TYPICAL_RANGE_UNSTATED]);
    expect(deferrals[0]?.["viewKey"], "the deferral names the view it is about").toBe(VIEW_KEY);
  });

  test("a range whose endpoint the stack lacks defers under its own reason, carrying both ends", async () => {
    const { rows, deferrals } = await resolved("TYPICAL FLOOR PLAN (1ST TO 9TH FLOOR)", [placement("C1", COLUMN, 0)]);

    expect(deferrals.map((deferral) => deferral["reason"]), "the stack carries no 9TH, so there is nothing to expand over").toEqual([LEVEL_RANGE_ENDPOINT_UNMAPPED]);
    // Not the same state as an unstated range: there is no placeholder to retire here, because the
    // levels the caption names do not exist. The remedy is INSERT_LEVEL, and the rebuild that follows
    // it registers all N at once (L-CAD-07, L-REG-04).
    expect(rows, "a member expands over nothing until the stack carries the range's ends").toEqual([]);
    expect([deferrals[0]?.["fromLabel"], deferrals[0]?.["toLabel"]], "and the deferral carries the two ends the caption stated (B-07)").toEqual(["1ST", "9TH"]);
  });

  test("a plan whose only members are foundations defers nothing, whatever its caption says", async () => {
    const { rows, deferrals } = await resolved("TYPICAL FLOOR PLAN", [placement("F1", FOOTING, 5)]);

    expect(rows.length, "a footing stands under the building rather than on a storey of it").toBe(1);
    expect(deferrals, "a deferral nobody's member stands under says nothing about the drawing").toEqual([]);
  });
});

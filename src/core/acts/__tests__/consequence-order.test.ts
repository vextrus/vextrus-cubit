/**
 * L-ACT-01: an act is "a human write that changes what the machine would derive", so what a subject
 * holds is a set of readings and not the order a query happened to return them in.
 */
import { describe, expect, test } from "vitest";
import { movesNothing, type Consequence } from "../consequence";

const over = (before: readonly string[], after: readonly string[]): Consequence => ({
  actType: "ASSIGN_PARTICIPANT_ROLE",
  tenantId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  projectId: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
  rendering: "SUBJECTS",
  subjects: [{ subjectId: "3f2504e0-4f89-41d3-9a0c-0305e82c3303", before, after }],
});

describe("movesNothing judges a subject by content", () => {
  test("the same roles in a different order move nothing", () => {
    expect(movesNothing(over(["MEASURER", "REVIEWER"], ["REVIEWER", "MEASURER"])), "order is a property of how a reading was built, never of what it says").toBe(true);
    expect(movesNothing(over(["LEAD", "MEASURER", "REVIEWER"], ["REVIEWER", "LEAD", "MEASURER"]))).toBe(true);
    expect(movesNothing(over([], [])), "a subject that held nothing and holds nothing moved nothing").toBe(true);
  });

  test("a real move is still a move", () => {
    expect(movesNothing(over(["MEASURER"], ["MEASURER", "REVIEWER"])), "a role granted is a move").toBe(false);
    expect(movesNothing(over(["MEASURER", "REVIEWER"], ["MEASURER"])), "a role withdrawn is a move").toBe(false);
    expect(movesNothing(over(["MEASURER"], ["REVIEWER"])), "one role swapped for another is a move").toBe(false);
  });

  test("a repeated reading is counted, not collapsed", () => {
    expect(movesNothing(over(["MEASURER", "MEASURER"], ["MEASURER", "REVIEWER"])), "two readings that say different things are different states, however they are ordered").toBe(false);
    expect(movesNothing(over(["MEASURER", "MEASURER"], ["MEASURER", "MEASURER"]))).toBe(true);
  });

  test("every subject is judged, not just the first", () => {
    const many = over(["MEASURER"], ["MEASURER"]);
    const moved: Consequence = { ...many, subjects: [...many.subjects, { subjectId: "3f2504e0-4f89-41d3-9a0c-0305e82c3304", before: [], after: ["REVIEWER"] }] };
    expect(movesNothing(moved), "an act that moves one subject of many is not an act that moves nothing (L-ACT-01)").toBe(false);
  });
});

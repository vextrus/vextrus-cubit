// ONE level stack over every section of an artifact, and a storey height that is a distance rather
// than a subtraction of two numbers written in different units (L-MEA-07, L-FRM-06, B-07).
//
// The marks are drawn here, so what the stack owes is read off what the draughtsman wrote: which view
// each mark stands in, what it says, and which of them the label dedupe leaves standing (B-19).
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { PartitionedView } from "../views/assign";
import { VIEW_TYPE } from "../views/law";
import { proposeLevelStack, type ProposedLevelRow } from "./propose";

const SECTION_A = "SECTION:A";
const SECTION_B = "SECTION:B";

/** One level mark: the view it was drawn in, and the words the draughtsman wrote. */
type Mark = { viewKey: string; said: string };

/** The stack the drawn marks propose, from the foot of the building up. */
function stackOf(marks: readonly Mark[]): ProposedLevelRow[] {
  const entities = marks.map((mark, index) => ({
    key: `e:${index}`,
    type: "TEXT",
    space: "Model",
    layer: "S-ANNO",
    colour: { rgb: [0, 0, 0], source: "explicit" },
    text: mark.said,
    height: 1,
    points: [[0, 100 - index]],
  }));
  const views = [...new Set(marks.map((mark) => mark.viewKey))].map(
    (viewKey) => ({ viewKey, type: VIEW_TYPE.MEMBER_SECTION, reason: null, caption: "SECTION", anchorKey: null }) as PartitionedView,
  );
  const proposal = proposeLevelStack({
    graph: { entities } as unknown as EntityGraph,
    views,
    assignments: new Map(entities.map((entity, index) => [entity.key, marks[index]?.viewKey ?? ""])),
  });
  return [...proposal.levels].sort((left, right) => left.ordinal - right.ordinal);
}

describe("L-MEA-07: one artifact states one level stack", () => {
  test("two sections state one stack: labels deduplicated, ordinals continuous from the foot", () => {
    const stack = stackOf([
      { viewKey: SECTION_A, said: "GF LVL +0.000 m" },
      { viewKey: SECTION_A, said: "1ST FLOOR LVL +3.000 m" },
      { viewKey: SECTION_B, said: "GROUND FLOOR LVL +0.000 m" },
      { viewKey: SECTION_B, said: "MEZZANINE LVL +6.000 m" },
    ]);

    expect(stack.map((level) => level.label), "a storey redrawn on a second section is one storey, however each view spells it").toEqual(["GF", "1ST", "MEZZ"]);
    expect(stack.map((level) => level.ordinal), "the ordinals run 0..n−1 over the whole artifact — a second section restarting them would offer one act naming two ground floors").toEqual([0, 1, 2]);
    expect(stack[0]?.markKey, "and each level cites the FIRST mark in artifact order that names it (L-CAD-03)").toBe("e:0");
  });

  test("a height is stated only between two standing marks of one section, adjacent in the stack", () => {
    const stack = stackOf([
      { viewKey: SECTION_A, said: "GF LVL +0.000 m" },
      { viewKey: SECTION_A, said: "1ST FLOOR LVL +3.000 m" },
      { viewKey: SECTION_B, said: "MEZZANINE LVL +6.000 m" },
    ]);

    expect(
      stack.map((level) => ({ label: level.label, height: level.heightAsWritten, unit: level.heightUnit })),
      "GF states the storey drawn over it on its own section; 1ST's neighbour above stands on the other section, where the drawing measured nothing, and MEZZ is the top of the stack (B-07)",
    ).toEqual([
      { label: "GF", height: "3", unit: "m" },
      { label: "1ST", height: null, unit: null },
      { label: "MEZZ", height: null, unit: null },
    ]);
  });

  test("a mark the label dedupe dropped is no neighbour of anything", () => {
    // B's ROOF is the dedupe's casualty: A named that storey first. B's MEZZ therefore has no next
    // mark of its own standing, and states no height even though A's ROOF stands above it.
    const stack = stackOf([
      { viewKey: SECTION_A, said: "GF LVL +0.000 m" },
      { viewKey: SECTION_A, said: "ROOF LVL +9.000 m" },
      { viewKey: SECTION_B, said: "MEZZANINE LVL +6.000 m" },
      { viewKey: SECTION_B, said: "ROOF SLAB LVL +9.000 m" },
    ]);

    const mezz = stack.find((level) => level.label === "MEZZ");
    expect(mezz?.heightAsWritten, "the three metres between MEZZ and a ROOF that stands from the other view is a distance nobody measured (L-CAD-03)").toBeNull();
  });

  test("two marks written in different units are differenced in canonical metres, stated in the lower mark's unit", () => {
    const stack = stackOf([
      { viewKey: SECTION_A, said: "GF LVL +0.000 m" },
      { viewKey: SECTION_A, said: "1ST FLOOR LVL +3000 mm" },
      { viewKey: SECTION_A, said: "2ND FLOOR LVL +6000 mm" },
    ]);

    expect(
      { height: stack[0]?.heightAsWritten, unit: stack[0]?.heightUnit },
      "a bare subtraction of the two numbers states three thousand metres: the distance is taken in canonical metres and carried back into the unit the LOWER mark was written in (L-FRM-06, B-17)",
    ).toEqual({ height: "3", unit: "m" });
    expect({ height: stack[1]?.heightAsWritten, unit: stack[1]?.heightUnit }, "and a pair written in one unit is untouched").toEqual({ height: "3000", unit: "mm" });
  });

  test("sections written in two units are stacked by what their elevations are worth, not by their numbers", () => {
    const stack = stackOf([
      { viewKey: SECTION_A, said: "GF LVL +0 mm" },
      { viewKey: SECTION_A, said: "1ST FLOOR LVL +3000 mm" },
      { viewKey: SECTION_B, said: "ROOF LVL +9.000 m" },
    ]);
    expect(stack.map((level) => level.label), "3000 mm stands above 9.000 m only in the numbers (L-FRM-06)").toEqual(["GF", "1ST", "ROOF"]);
  });
});

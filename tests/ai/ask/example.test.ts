/**
 * The example S-Ask's empty state offers (docs/design/s-ask.md §2 Empty): a count over the first
 * register object standing on a live level of the stack — level from the ground up, class in the
 * catalogue's order, mark as a QS counts them. An object stands on a level by the level's surrogate id;
 * a label no level was registered for, or an unresolved slot, stands on none (J-043: the stage's
 * columns stand on GF by its id, and the example had read only the unregistered label, so it offered
 * "Which sheets are in the set?" over a register that could answer a count).
 */
import { describe, expect, it } from "vitest";
import { ELEMENT_TYPES } from "@/core/catalogue/classes";
import { exampleOf, type ExampleObject } from "@/modules/takeoff/ask/example";

const GF = { levelId: "11111111-1111-4111-8111-111111111111", label: "GF", ordinal: 0 };
const F1 = { levelId: "22222222-2222-4222-8222-222222222222", label: "1F", ordinal: 1 };

describe("exampleOf", () => {
  it("counts the first object standing on a live level, by the level's id", () => {
    const objects: ExampleObject[] = [
      { elementType: "column", mark: "C3", levelId: GF.levelId },
      { elementType: "column", mark: "C10", levelId: GF.levelId },
      { elementType: "column", mark: "C1", levelId: GF.levelId },
    ];
    expect(exampleOf(objects, [F1, GF])).toEqual({ class: "column", mark: "C1", level: "GF" });
  });

  it("reads the level from the ground up, then the catalogue's class order, then the mark", () => {
    const objects: ExampleObject[] = [
      { elementType: "column", mark: "C1", levelId: F1.levelId },
      { elementType: "beam", mark: "B1", levelId: GF.levelId },
      { elementType: "column", mark: "C2", levelId: GF.levelId },
    ];
    const beamFirst = ELEMENT_TYPES.indexOf("beam") < ELEMENT_TYPES.indexOf("column");
    expect(exampleOf(objects, [GF, F1]), "the ground floor before the first, and on it the class the catalogue orders first").toEqual(
      beamFirst ? { class: "beam", mark: "B1", level: "GF" } : { class: "column", mark: "C2", level: "GF" },
    );
  });

  it("offers none where no object stands on a live level — no level id, a level off the stack, or no mark", () => {
    const objects: ExampleObject[] = [
      { elementType: "column", mark: "C1", levelId: null },
      { elementType: "column", mark: "C2", levelId: "33333333-3333-4333-8333-333333333333" },
      { elementType: "column", mark: " ", levelId: GF.levelId },
      { elementType: "not-a-class", mark: "X1", levelId: GF.levelId },
    ];
    expect(exampleOf(objects, [GF])).toBeNull();
    expect(exampleOf([], [GF])).toBeNull();
  });
});

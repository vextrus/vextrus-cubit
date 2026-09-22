/**
 * I-302 — the unit a drawing DECLARES its dimensions in, resolved from the counted declarations and
 * from nothing else (L-CAD-08, L-MEA-05: a unit is read, never guessed).
 *
 * The census is data here, as it is for every other case beside this method: the resolver is handed
 * counted readings and never a text, so what is graded is the arithmetic of agreement — one unit
 * declared is the drawing's convention however many texts declare it, and two are no convention at
 * all. Which texts declare what is the census's question and is graded where the census lives
 * (`src/modules/takeoff/partition/conventions/census.test.ts`).
 */
import { describe, expect, test } from "vitest";
import { resolve, type ConventionSeed, type EntityCensus } from "./resolve";

/** A drawing of one layer, so that the roles resolve and nothing here turns on them. */
const LAYERS = [{ layer: "NOTES", paths: 0, rings: 0, texts: 7, dimensions: 0 }];

/** That drawing, with whatever it declared about the unit its dimensions are figured in. */
function censusOf(unitDeclarations: EntityCensus["unitDeclarations"]): EntityCensus {
  return { layers: LAYERS, grammars: [], unitDeclarations };
}

describe("I-302: the unit a drawing declares its dimensions in", () => {
  test("one unit declared is the drawing's, however many of its texts declare it, and it cites the first of them", () => {
    const once = resolve(censusOf([{ unit: "mm", sourceKey: "DXF_HANDLE:1F3E", declarations: 1 }]));
    const often = resolve(censusOf([{ unit: "mm", sourceKey: "DXF_HANDLE:1F3E", declarations: 9 }]));

    expect(once.dimensionUnit, "the reading is the unit AND the entity it was read off — a unit read off S-01 is evidence from S-01 (L-QTY-03)").toEqual({
      unit: "mm",
      sourceKey: "DXF_HANDLE:1F3E",
    });
    expect(often.dimensionUnit, "a set that prints the same note on every sheet has said one thing many times, not nine things").toEqual(once.dimensionUnit);
  });

  test("two units declared are no declaration at all — a disagreement is not a reading", () => {
    const profile = resolve(
      censusOf([
        { unit: "in", sourceKey: "DXF_HANDLE:20", declarations: 1 },
        { unit: "mm", sourceKey: "DXF_HANDLE:10", declarations: 4 },
      ]),
    );

    expect(
      profile.dimensionUnit,
      "nothing here is in a position to decide which sheet the office meant, and the plurality is not a vote: a section measured off the loser is wrong by a factor of twenty-five (L-QTY-04)",
    ).toBeNull();
  });

  test("a drawing that declares none, and a census taken before this was read at all, both resolve to nothing", () => {
    expect(resolve(censusOf([])).dimensionUnit, "a drawing examined and found silent declares nothing — a number nobody gave a unit to is not a millimetre (L-MEA-01)").toBeNull();
    expect(resolve(censusOf(undefined)).dimensionUnit, "and a census that carries no such count at all resolves the same way, rather than throwing at a reader of a stored row").toBeNull();
  });

  test("the seed still corroborates and never acts", () => {
    const census = censusOf([{ unit: "mm", sourceKey: "DXF_HANDLE:1F3E", declarations: 1 }]);
    const seed: ConventionSeed = { roles: { text: ["SOMETHING-ELSE"] } };

    expect(resolve(census, {}), "resolve(census, {}) deep-equals resolve(census) — the clause's own CI-enforced equality holds of the new field too (L-CAD-08)").toEqual(resolve(census));
    expect(resolve(census, seed), "and a seed that would speak to a role leaves the declared unit exactly where the census put it").toEqual(resolve(census));
  });
});

/**
 * AC-2(d): L-REG-03's "a derived sighting yields to a measured one" has ONE home, and one key
 * (debt-src-modules-1cofuy1, B-17).
 *
 * The rule is asked of the exported function by name, over rows built here: one physical scope is a
 * mark at its own grid reference on one level, so each part of that key is varied on its own and the
 * answer says which part decided. Two implementations with contradictory keys cannot both satisfy
 * this, which is the point of there being one (ARCH-02).
 */
import { describe, expect, test } from "vitest";
import { MODULE, productModule } from "./support/sweep-stage";

/** One expansion row, as far as the ownership rule reads one. */
type Row = {
  objectKey: string;
  standing: string;
  level: { levelId: string };
  placement: { viewKey: string; mark: string; gridLetter: string | null; gridNumeral: string | null };
};

type Owner = (rows: readonly Row[]) => readonly Row[];

const MEASURED = "MEASURED";
const DERIVED = "DERIVED";

/** The plan that DREW the storey, and the typical plan whose rows are stood up from a range. */
const DRAWN = "PLAN:ROOF";
const TYPICAL = "PLAN:TYPICAL";

/** One row: what it stands for, where it was sighted, and how. */
function row(objectKey: string, standing: string, viewKey: string, at: { mark: string; letter: string | null; numeral: string | null; level: string }): Row {
  return { objectKey, standing, level: { levelId: at.level }, placement: { viewKey, mark: at.mark, gridLetter: at.letter, gridNumeral: at.numeral } };
}

async function ownedRows(): Promise<Owner> {
  const door = await productModule<Record<string, unknown>>(MODULE.resolve);
  expect(typeof door["ownedRows"], `${MODULE.resolve} EXPORTS \`ownedRows\` — the one implementation of L-REG-03's derived-yields-to-measured rule (B-17, interfaces)`).toBe("function");
  return door["ownedRows"] as Owner;
}

describe("AC-2: one home for the rule that a derived sighting yields to a measured one", () => {
  test("AC-2: a derived row yields only to a measured row of the SAME mark, grid reference and level, sighted in another view", async () => {
    const owned = await ownedRows();
    const at = { mark: "C1", letter: "A", numeral: "1", level: "level-1" };

    const rows: Row[] = [
      row("measured", MEASURED, DRAWN, at),
      // The same physical scope, stood up from the typical plan: the weaker of two readings of one
      // member, and the one L-REG-03 makes unrepresentable beside the other.
      row("derived-same-scope", DERIVED, TYPICAL, at),
      // Each of these differs from the measured row in ONE part of the key, so each says which part
      // decided: the level, the grid numeral, the grid letter, and the mark.
      row("derived-other-level", DERIVED, TYPICAL, { ...at, level: "level-2" }),
      row("derived-other-numeral", DERIVED, TYPICAL, { ...at, numeral: "2" }),
      row("derived-other-letter", DERIVED, TYPICAL, { ...at, letter: "B" }),
      row("derived-other-mark", DERIVED, TYPICAL, { ...at, mark: "C2" }),
      // And one derived row of the measured row's OWN view: within a view a placement's rows already
      // stand on distinct levels, so nothing there is a second sighting of anything.
      row("derived-same-view", DERIVED, DRAWN, at),
    ];

    expect(
      owned(rows).map((one) => one.objectKey),
      "the derived row of the same mark, grid letter, grid numeral and level — and only that one — yields to the measured sighting of another view: a wrong merge silently deletes quantity, and a missed one bills the member twice (L-REG-03)",
    ).toEqual(["measured", "derived-other-level", "derived-other-numeral", "derived-other-letter", "derived-other-mark", "derived-same-view"]);
  });

  test("AC-2: the rule is stable — what it answers, it answers again", async () => {
    const owned = await ownedRows();
    const at = { mark: "C1", letter: "A", numeral: "1", level: "level-1" };
    const rows: Row[] = [row("measured", MEASURED, DRAWN, at), row("derived", DERIVED, TYPICAL, at), row("kept", DERIVED, TYPICAL, { ...at, level: "level-2" })];

    const once = owned(rows);
    expect(
      owned(once).map((one) => one.objectKey),
      "a rebuild that re-derives the same sightings owns the same rows: the rule is a function of the rows, so the call path that filters them answers what a second pass answers (L-REG-04)",
    ).toEqual(once.map((one) => one.objectKey));
    expect(once.map((one) => one.objectKey), "and what stands is the measured sighting with the rows no measured sighting covers").toEqual(["measured", "kept"]);
  });
});

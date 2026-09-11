/**
 * AC-2 — the residue's CASE arms, in order, first wins (L-QTY-05).
 *
 * `resolveResidue` is pure, so every arm is driven by the input that reaches it and by nothing else:
 * a published line beats a declaration, a declaration in force beats a truncated sheet, a truncated
 * sheet beats the fall-through, and a declaration that resolves nothing moves nothing at all. The
 * two KIND-grain arms are the other half of the same law — a kind no sighted class bears, and a kind
 * no class bears at all, are stated once each rather than celled out.
 *
 * Each case names only what it changes: one input is built from the same small stage and the arm
 * under test is switched on, so what the assertion attributes to an arm is what the arm did.
 */
import { describe, expect, test } from "vitest";
import {
  GF,
  INGESTION_TRUNCATED,
  IN_BILL,
  KIND,
  KIND_NOT_YET_SEEDED,
  L1,
  NOT_ESTABLISHED,
  NOT_IN_PROJECT_SCOPE,
  NOT_IN_THIS_BILL,
  NO_BEARER_SIGHTED,
  QUANTITY_BEARING,
  SHEET,
  residueSeam,
  sighting,
  type DeclarationShape,
  type ResidueCellShape,
  type ResidueInputShape,
} from "./support/coverage-stage";

/** The seam under `residue.ts` opens a pool at import time; the address is stated, never dialled. */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

const COLUMN = "column";
const SLAB = "slab";
const CONCRETE = "rcc.concrete";
const SLAB_CONCRETE = "rcc.slab-concrete";
const WATERPROOFING = "rcc.waterproofing";

/**
 * The stage every case below switches one arm on: a column sighted on the ground floor only, in a
 * stack of two levels, bearing one kind. Nothing is published, declared or truncated.
 */
function stage(over: Partial<ResidueInputShape> = {}): ResidueInputShape {
  return {
    bears: [{ class: COLUMN, kind: CONCRETE }],
    workItems: [CONCRETE],
    levels: [{ ...GF }, { ...L1 }],
    sightings: [sighting(COLUMN, GF.levelId)],
    lines: [],
    declarations: [],
    truncated: [],
    observations: [],
    ...over,
  };
}

/** One declaration over the staged cell, in force and resolving, unless a case says otherwise. */
function declaration(cause: string, actId: string, over: Partial<DeclarationShape> = {}): DeclarationShape {
  return { class: COLUMN, kind: CONCRETE, levelId: GF.levelId, cause, actId, inForce: true, actResolves: true, ...over };
}

/** The cell of one address, asserted to be the one cell the residue holds for it. */
function cellAt(cells: readonly ResidueCellShape[], kind: string, klass: string | null, levelId: string | null): ResidueCellShape {
  const found = cells.filter((cell) => cell.kind === kind && cell.class === klass && cell.levelId === levelId);
  expect(found.length, `the residue holds exactly one cell for ${kind} × ${klass ?? "—"} × ${levelId ?? "—"}, and holds ${found.length}: ${JSON.stringify(cells)}`).toBe(1);
  return found[0] as ResidueCellShape;
}

const resolved = async (input: ResidueInputShape): Promise<ResidueCellShape[]> => (await residueSeam()).resolveResidue(input);

describe("AC-2: the arms resolve in order, first wins", () => {
  test("AC-2: a cell with a published line reads QUANTITY_BEARING, and beats a declaration in force over it", async () => {
    const published = await resolved(stage({ lines: [{ kind: CONCRETE, class: COLUMN, levelId: GF.levelId, lineId: "line-1" }] }));
    const bearing = cellAt(published, CONCRETE, COLUMN, GF.levelId);
    expect(bearing.measurement, "a line published for this cell is the first arm — nothing below it is asked").toBe(QUANTITY_BEARING);
    expect(bearing.lineIds, "and the cell names the line it bears").toContain("line-1");

    const beaten = await resolved(
      stage({
        lines: [{ kind: CONCRETE, class: COLUMN, levelId: GF.levelId, lineId: "line-2" }],
        declarations: [declaration(NOT_IN_PROJECT_SCOPE, "act-scope-2")],
      }),
    );
    const contradicted = cellAt(beaten, CONCRETE, COLUMN, GF.levelId);
    expect(contradicted.measurement, "a declaration standing under a published line loses its own axis to the line").toBe(QUANTITY_BEARING);
    expect(contradicted.contradicted, "and the cell says the declaration was contradicted rather than dropping it").toBe(true);
  });

  test("AC-2: a declaration in force whose act resolves reads its own cause, and leaves the other axis unmoved", async () => {
    const scoped = cellAt(await resolved(stage({ declarations: [declaration(NOT_IN_PROJECT_SCOPE, "act-scope-1")] })), CONCRETE, COLUMN, GF.levelId);
    expect(scoped.measurement, `${NOT_IN_PROJECT_SCOPE} is a reading of the measurement axis`).toBe(NOT_IN_PROJECT_SCOPE);
    expect(scoped.bill, "and the bill axis is orthogonal — nothing was held out of any bill (L-QTY-05)").toBe(IN_BILL);
    expect(scoped.measurementActId, "the cell names the act that declared it").toBe("act-scope-1");
    expect(scoped.contradicted, "nothing contradicts a declaration over a cell that bears no line").toBe(false);

    const held = cellAt(await resolved(stage({ declarations: [declaration(NOT_IN_THIS_BILL, "act-hold-1")] })), CONCRETE, COLUMN, GF.levelId);
    expect(held.bill, `${NOT_IN_THIS_BILL} is a reading of the bill axis`).toBe(NOT_IN_THIS_BILL);
    expect(held.measurement, "and the measurement axis still says what the campaign measured — which is nothing").toBe(NOT_ESTABLISHED);
    expect(held.billActId, "the cell names the act that held it out").toBe("act-hold-1");
  });

  test("AC-2: a cell whose every sighting stands on a truncated sheet reads INGESTION_TRUNCATED, and a declaration beats it", async () => {
    const truncated = cellAt(await resolved(stage({ truncated: [{ ...SHEET }] })), CONCRETE, COLUMN, GF.levelId);
    expect(truncated.measurement, "every sighting of this cell stands on a sheet that was read only in part").toBe(INGESTION_TRUNCATED);

    const declared = cellAt(
      await resolved(stage({ truncated: [{ ...SHEET }], declarations: [declaration(NOT_IN_PROJECT_SCOPE, "act-scope-1")] })),
      CONCRETE,
      COLUMN,
      GF.levelId,
    );
    expect(declared.measurement, "a person's declaration stands above a truncated sheet in the arm order").toBe(NOT_IN_PROJECT_SCOPE);
  });

  test("AC-2: a cell nothing explains falls through to NOT_ESTABLISHED", async () => {
    const cell = cellAt(await resolved(stage()), CONCRETE, COLUMN, GF.levelId);
    expect(cell.measurement, "no line, no declaration, no truncation — and nothing explains the absence").toBe(NOT_ESTABLISHED);
    expect(cell.bill, "the bill axis is untouched by any of it").toBe(IN_BILL);
    expect(cell.measurementActId, "and no act is named where none was made").toBe(null);
  });

  test("AC-2: a declaration that does not resolve, or is not in force, moves nothing", async () => {
    for (const idle of [{ actResolves: false }, { inForce: false }]) {
      const cell = cellAt(await resolved(stage({ declarations: [declaration(NOT_IN_PROJECT_SCOPE, "act-scope-1", idle)] })), CONCRETE, COLUMN, GF.levelId);
      expect(cell.measurement, `a declaration ${JSON.stringify(idle)} is not a cause: the cell reads as it would with no declaration at all`).toBe(NOT_ESTABLISHED);
      expect(cell.bill, "on either axis").toBe(IN_BILL);
      expect(cell.measurementActId, "and names no act").toBe(null);
    }
  });
});

describe("AC-2: the grain of a kind no cell can be made for", () => {
  test("AC-2: a kind borne only by classes no sighting names is one KIND-grain NO_BEARER_SIGHTED cell", async () => {
    const cells = await resolved(
      stage({
        bears: [
          { class: COLUMN, kind: CONCRETE },
          { class: SLAB, kind: SLAB_CONCRETE },
        ],
        workItems: [CONCRETE, SLAB_CONCRETE],
      }),
    );
    const stated = cells.filter((cell) => cell.kind === SLAB_CONCRETE);
    expect(stated.length, `${SLAB_CONCRETE} is borne only by a class no channel sighted: it is stated ONCE, at kind grain (L-QTY-07)`).toBe(1);
    const one = stated[0] as ResidueCellShape;
    expect({ grain: one.grain, class: one.class, levelId: one.levelId, measurement: one.measurement }, "the whole of the KIND-grain reading").toEqual({
      grain: KIND,
      class: null,
      levelId: null,
      measurement: NO_BEARER_SIGHTED,
    });
  });

  test("AC-2: a work item no class bears at all is one KIND-grain KIND_NOT_YET_SEEDED cell", async () => {
    const cells = await resolved(stage({ workItems: [CONCRETE, WATERPROOFING] }));
    const stated = cells.filter((cell) => cell.kind === WATERPROOFING);
    expect(stated.length, `${WATERPROOFING} is in the catalogue and borne by nothing: one cell, at kind grain`).toBe(1);
    const one = stated[0] as ResidueCellShape;
    expect({ grain: one.grain, class: one.class, levelId: one.levelId, measurement: one.measurement }, "the whole of the KIND-grain reading").toEqual({
      grain: KIND,
      class: null,
      levelId: null,
      measurement: KIND_NOT_YET_SEEDED,
    });
  });

  test("AC-2: no CELL-grain cell stands for a class or a level no channel sighted", async () => {
    const cells = await resolved(
      stage({
        bears: [
          { class: COLUMN, kind: CONCRETE },
          { class: SLAB, kind: CONCRETE },
        ],
      }),
    );
    expect(
      cells.filter((cell) => cell.grain !== KIND && cell.levelId === L1.levelId),
      `${L1.label} stands in the stack and no channel sighted the column on it — the residue is a union of EXISTS, never a cross join (L-QTY-05)`,
    ).toEqual([]);
    expect(
      cells.filter((cell) => cell.grain !== KIND && cell.class === SLAB),
      "and a class no channel sighted bears no cell either, whatever the catalogue says it bears",
    ).toEqual([]);
    expect(
      cells.filter((cell) => cell.grain !== KIND).map((cell) => `${cell.kind}:${cell.class ?? ""}:${cell.levelId ?? ""}`),
      "what stands is exactly the sighted ground: one cell, for the kind the sighted class bears on the level it was sighted on",
    ).toEqual([`${CONCRETE}:${COLUMN}:${GF.levelId}`]);
  });
});

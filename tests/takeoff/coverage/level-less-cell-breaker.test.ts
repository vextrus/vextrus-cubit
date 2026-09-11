// @vitest-environment jsdom
/**
 * BREAKER — a cell that names no level (inc-216-coverage-grid: L-QTY-05, L-ACT-01, R-UI-020).
 *
 * Two of the three channels sight a class WITHOUT a level: `partitionSightings` and
 * `layoutSightings` both answer `levelId: null` by construction (a placement is sighted on a sheet,
 * not on a storey — src/core/residue/channels/{partition,layout}.ts), and `register_objects.level_id`
 * is itself nullable. So when every sighting of a sighted class names no level — a campaign whose
 * partition has run and whose register has not yet placed that class on a storey, which is exactly
 * where J-000 stands when it reaches this screen — `levelsSighted` answers `[null]` and the residue
 * bears a CELL-grain cell whose `levelId` is null.
 *
 * That cell is not kind-grain and bears no quantity, so `doorsStand` (src/modules/takeoff/coverage/
 * coverage-workspace.tsx) opens both boundary doors over it. Pressing one hands the seam
 * `levelId: ""` (`inputOf`), the preview matches it — `cellRef` spells a missing level as the empty
 * string on both sides — and the COMMIT writes `scope_declarations.level_id`, which
 * db/migrations/0039_scope-acts.sql declares `uuid NOT NULL`. Postgres answers
 * `invalid input syntax for type uuid: ""`: a driver fault carrying no registered code, raised after
 * the reader has already confirmed the consequence.
 *
 * The settled reading of I-194 names the rule this breaks: "a door that can answer only a refusal is
 * theatre, so a cell no boundary can be declared over at all — a kind-grain row, WHICH NAMES NO CLASS
 * AND NO LEVEL, or a cell already bearing published quantity — carries neither door". A CELL-grain
 * cell naming no level is a cell no boundary can be declared over, because the store that holds a
 * declaration cannot hold its address.
 *
 * The control case beside it is J-022's own cell — sighted on a level of the stack — and it keeps
 * both doors, so nothing here is answered by closing every door on the screen.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  GF,
  TESTID,
  cleanup,
  coverageViewFixture,
  hooks,
  mountCoverage,
  residueSeam,
  sighting,
  type CoverageViewShape,
  type ResidueCellShape,
  type ResidueInputShape,
} from "./support/coverage-stage";

/** The seam under `residue.ts` opens a pool at import time; the address is stated, never dialled. */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

/** The class and kind the catalogue really bears (src/core/catalogue/bears.ts). */
const CLASS = "column";
const KIND = "rcc.concrete";

/** The channel that sights a class on a sheet and never on a storey (channels/partition.ts). */
const PARTITION = "PARTITION";

/**
 * A campaign whose only sighting of the borne class carries no level: the partition placed a column
 * on the manifest's sheet and nothing has put it on a storey yet.
 */
function levellessInput(): ResidueInputShape {
  return {
    bears: [{ class: CLASS, kind: KIND }],
    workItems: [KIND],
    levels: [{ ...GF }],
    sightings: [sighting(CLASS, null, PARTITION)],
    lines: [],
    declarations: [],
    truncated: [],
    observations: [],
  };
}

/** The same campaign, once the register has placed that column on the ground floor. */
function levelledInput(): ResidueInputShape {
  return { ...levellessInput(), sightings: [sighting(CLASS, GF.levelId)] };
}

/** The one CELL-grain cell a reading holds, asserted to be one. */
function onlyCell(view: CoverageViewShape): ResidueCellShape {
  const held = view.cells.filter((cell) => cell.grain === "CELL");
  expect(held.length, `the reading holds exactly one CELL-grain cell: ${JSON.stringify(view.cells)}`).toBe(1);
  return held[0] as ResidueCellShape;
}

afterEach(() => {
  cleanup();
});

describe("a cell of the residue that names no level", () => {
  test("stands in the residue, with no level and no label — the channels that sight a sheet name no storey", async () => {
    const residue = await residueSeam();
    const view = await coverageViewFixture(levellessInput());
    const cell = onlyCell(view);

    expect(cell.class, "the class the partition sighted is the cell's class").toBe(CLASS);
    expect(cell.levelId, "and no channel named a level for it").toBeNull();
    expect(residue.cellRef(cell), "so its address spells the level as nothing at all").toBe(`${KIND}:${CLASS}:`);
  });

  test("carries NEITHER boundary door: the store holding a declaration cannot hold an address with no level", async () => {
    const residue = await residueSeam();
    const view = await coverageViewFixture(levellessInput());
    const { root } = await mountCoverage({ view, cell: residue.cellRef(onlyCell(view)) });

    const inspector = hooks(root, TESTID.inspector);
    expect(inspector.length, "the inspector opened on the addressed cell").toBe(1);

    expect(
      hooks(root, TESTID.holdOut).length,
      "no HOLD_OUT_OF_BILL door stands over a cell naming no level: pressing it hands the act an empty levelId, and scope_declarations.level_id is uuid NOT NULL (0039_scope-acts.sql) — the commit fails with a driver fault carrying no registered code, after the reader has confirmed (I-194, R-UI-020)",
    ).toBe(0);
    expect(
      hooks(root, TESTID.declareOutOfScope).length,
      "and no DECLARE_NOT_IN_PROJECT_SCOPE door stands over it either, for the same reason (I-194)",
    ).toBe(0);
  });

  test("while the same cell sighted on a level of the stack keeps BOTH doors (J-022's own walk)", async () => {
    const residue = await residueSeam();
    const view = await coverageViewFixture(levelledInput());
    const cell = onlyCell(view);
    expect(cell.levelId, "the control cell names a level").toBe(GF.levelId);

    const { root } = await mountCoverage({ view, cell: residue.cellRef(cell) });
    expect(hooks(root, TESTID.holdOut).length, "the hold-out door stands over a cell a declaration can really be written for").toBe(1);
    expect(hooks(root, TESTID.declareOutOfScope).length, "and so does the out-of-scope door").toBe(1);
  });
});

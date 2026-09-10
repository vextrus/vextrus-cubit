/**
 * AC-1 — the residue is a QUERY over the borne grid, and `resolveResidue` is where its arms are law.
 *
 * L-QTY-05: "The residue's cell is (sighted class × kind borne × level sighted)." So the grid is
 * bounded on three sides at once — an unsighted class holds no cell, an unborne kind holds no cell,
 * and a level nothing was sighted on holds no column — and a class counts as sighted when ANY ONE of
 * the three channels returned a Sighting for it, which is what makes sighting a UNION of EXISTS.
 *
 * The arms resolve in order: published lines → an in-force human act whose evidence resolves → an
 * attributed truncation → the fall-through. Each arm below is proved to BEAT the one under it, not
 * merely to fire when it stands alone: an arm order is only an order if the higher arm wins a case
 * the lower one would otherwise take.
 *
 * The channel readers are proved by their declared shape rather than by running them: each answers
 * `Promise<Sighting[]>`, and the absence of an `absent()` constructor anywhere under `channels/**` is
 * a claim about source text, asked here of the text.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
// white-box: AC-1 — two of the criterion's clauses are about the channel readers' SOURCE, so the
// tree's one lexer is what reads them: a declared return type and an absent constructor leave no
// runtime trace at all.
import { lex } from "../../../../tests/support/source-lex";
import {
  BILL_CAUSES,
  IN_BILL,
  MEASUREMENT_CAUSES,
  QUANTITY_BEARING,
  SIGHTING_CHANNELS,
  cellRef,
  layoutSightings,
  parseCellRef,
  partitionSightings,
  registerSightings,
  resolveResidue,
  type ResidueCell,
  type ResidueInput,
  type Sighting,
} from "../index";

const CHANNELS = resolve(dirname(fileURLToPath(import.meta.url)), "../channels");

/** The staged campaign every case below varies: two levels, one class sighted, two kinds borne. */
const GROUND_FLOOR = { levelId: "level-gf", ordinal: 0, label: "GF" };
const FIRST_FLOOR = { levelId: "level-01", ordinal: 1, label: "L1" };

const sighting = (over: Partial<Sighting> = {}): Sighting => ({
  class: "column",
  levelId: GROUND_FLOOR.levelId,
  channel: "REGISTER",
  drawingId: "drawing-a",
  layoutName: "S-01",
  sourceKey: "DXF_HANDLE:1A2B",
  ...over,
});

function input(over: Partial<ResidueInput> = {}): ResidueInput {
  return {
    bears: [
      { class: "column", kind: "rcc.concrete" },
      { class: "column", kind: "rcc.formwork" },
      { class: "beam", kind: "rcc.concrete" },
    ],
    workItems: ["rcc.concrete", "rcc.formwork", "rcc.reinforcement"],
    levels: [GROUND_FLOOR, FIRST_FLOOR],
    sightings: [sighting()],
    lines: [],
    declarations: [],
    truncated: [],
    observations: [],
    ...over,
  };
}

const cellsOf = (over: Partial<ResidueInput> = {}): ResidueCell[] => resolveResidue(input(over)).filter((cell) => cell.grain === "CELL");
const kindRowsOf = (over: Partial<ResidueInput> = {}): ResidueCell[] => resolveResidue(input(over)).filter((cell) => cell.grain === "KIND");

const addressOf = (cell: ResidueCell): string => cellRef(cell);

const findCell = (cells: readonly ResidueCell[], kind: string, klass: string, levelId: string | null): ResidueCell | undefined =>
  cells.find((cell) => cell.kind === kind && cell.class === klass && cell.levelId === levelId);

describe("AC-1: the residue's cell is (sighted class × kind borne × level sighted)", () => {
  test("one cell per borne kind of a sighted class, on each level it was sighted on", () => {
    const cells = cellsOf();
    expect(cells.map(addressOf).sort(), "the column was sighted on the ground floor and bears two kinds there").toEqual([
      "rcc.concrete:column:level-gf",
      "rcc.formwork:column:level-gf",
    ]);
  });

  test("no cell for an unsighted class — the beam bears a kind and was never seen", () => {
    expect(
      cellsOf().filter((cell) => cell.class === "beam"),
      "the catalogue bears rcc.concrete on a beam, but no channel sighted a beam in this campaign (L-QTY-05)",
    ).toEqual([]);
  });

  test("no cell for a kind the catalogue does not bear on the sighted class", () => {
    expect(
      cellsOf().filter((cell) => cell.kind === "rcc.reinforcement"),
      "rcc.reinforcement is a work item no class bears, so the grid holds no cell for it",
    ).toEqual([]);
  });

  test("no column for a level nothing was sighted on", () => {
    expect(
      cellsOf().map((cell) => cell.levelId),
      "the first floor is in the stack and nothing was sighted on it, so it bears no cell",
    ).not.toContain(FIRST_FLOOR.levelId);
  });

  test("a class sighted on two levels bears its kinds on both", () => {
    const cells = cellsOf({ sightings: [sighting(), sighting({ levelId: FIRST_FLOOR.levelId, sourceKey: "DXF_HANDLE:9F" })] });
    expect(cells.map(addressOf).sort(), "each level sighted is a column of the grid, in the stack's own order").toEqual([
      "rcc.concrete:column:level-01",
      "rcc.concrete:column:level-gf",
      "rcc.formwork:column:level-01",
      "rcc.formwork:column:level-gf",
    ]);
  });

  test.each([...SIGHTING_CHANNELS])("sighting is a union of EXISTS: %s alone sights the class", (channel) => {
    const cells = cellsOf({ sightings: [sighting({ channel })] });
    expect(cells.length, `a Sighting from ${channel} alone is enough — the union is over what the three readers RETURNED`).toBeGreaterThan(0);
    expect(cells.every((cell) => cell.class === "column")).toBe(true);
  });

  test("the cell carries the evidence it was sighted by, and the level's own label", () => {
    const held = findCell(cellsOf(), "rcc.concrete", "column", GROUND_FLOOR.levelId);
    expect(held?.sightings.map((seen) => seen.sourceKey), "the sighting rows a reader is shown are the cell's own").toEqual(["DXF_HANDLE:1A2B"]);
    expect(held?.levelLabel, "the level is named by its label, never by its surrogate (I-25)").toBe("GF");
  });
});

describe("AC-1: the arms resolve in order, and each beats the one under it", () => {
  test("published lines stand above everything: QUANTITY_BEARING", () => {
    const cells = cellsOf({ lines: [{ kind: "rcc.concrete", class: "column", levelId: GROUND_FLOOR.levelId, lineId: "line-1" }] });
    const held = findCell(cells, "rcc.concrete", "column", GROUND_FLOOR.levelId);
    expect(held?.measurement).toBe(QUANTITY_BEARING);
    expect(held?.lineIds, "the cell names the lines that bear it").toEqual(["line-1"]);
  });

  test("NOT_IN_PROJECT_SCOPE: an in-force act whose evidence resolves explains the absence", () => {
    const cells = cellsOf({
      declarations: [
        {
          class: "column",
          kind: "rcc.formwork",
          levelId: GROUND_FLOOR.levelId,
          cause: "NOT_IN_PROJECT_SCOPE",
          actId: "act-1",
          inForce: true,
          actResolves: true,
        },
      ],
    });
    const held = findCell(cells, "rcc.formwork", "column", GROUND_FLOOR.levelId);
    expect(held?.measurement).toBe("NOT_IN_PROJECT_SCOPE");
    expect(held?.measurementActId, "the cell names the act the declaration was made by").toBe("act-1");
  });

  test("a declaration that is not in force, or whose act does not resolve, says nothing", () => {
    for (const [reason, over] of [
      ["withdrawn", { inForce: false, actResolves: true }],
      ["an act nobody can point at", { inForce: true, actResolves: false }],
    ] as const) {
      const cells = cellsOf({
        declarations: [
          { class: "column", kind: "rcc.formwork", levelId: GROUND_FLOOR.levelId, cause: "NOT_IN_PROJECT_SCOPE", actId: "act-1", ...over },
        ],
      });
      expect(findCell(cells, "rcc.formwork", "column", GROUND_FLOOR.levelId)?.measurement, `${reason} explains nothing (L-ACT-01)`).toBe("NOT_ESTABLISHED");
    }
  });

  test("INGESTION_TRUNCATED: every sighting of the cell stands on a sheet read only in part", () => {
    const cells = cellsOf({ truncated: [{ drawingId: "drawing-a", layoutName: "S-01" }] });
    expect(findCell(cells, "rcc.concrete", "column", GROUND_FLOOR.levelId)?.measurement).toBe("INGESTION_TRUNCATED");
  });

  test("a cell sighted on a whole sheet as well as a truncated one is not attributed to the truncation", () => {
    const cells = cellsOf({
      sightings: [sighting(), sighting({ drawingId: "drawing-b", layoutName: "S-02", sourceKey: "DXF_HANDLE:44" })],
      truncated: [{ drawingId: "drawing-a", layoutName: "S-01" }],
    });
    expect(
      findCell(cells, "rcc.concrete", "column", GROUND_FLOOR.levelId)?.measurement,
      "the loss is attributed only where EVERY sighting of the cell stands on a sheet read in part",
    ).toBe("NOT_ESTABLISHED");
  });

  test("a declaration beats a truncation, and lines beat both", () => {
    const truncated = [{ drawingId: "drawing-a", layoutName: "S-01" }];
    const declarations = [
      { class: "column", kind: "rcc.concrete", levelId: GROUND_FLOOR.levelId, cause: "NOT_IN_PROJECT_SCOPE" as const, actId: "act-1", inForce: true, actResolves: true },
    ];
    expect(findCell(cellsOf({ truncated, declarations }), "rcc.concrete", "column", GROUND_FLOOR.levelId)?.measurement).toBe("NOT_IN_PROJECT_SCOPE");
    expect(
      findCell(cellsOf({ truncated, declarations, lines: [{ kind: "rcc.concrete", class: "column", levelId: GROUND_FLOOR.levelId, lineId: "line-1" }] }), "rcc.concrete", "column", GROUND_FLOOR.levelId)
        ?.measurement,
    ).toBe(QUANTITY_BEARING);
  });

  test("NOT_ESTABLISHED is the fall-through: nothing explains this absence", () => {
    expect(findCell(cellsOf(), "rcc.concrete", "column", GROUND_FLOOR.levelId)?.measurement).toBe("NOT_ESTABLISHED");
  });

  test("every cause the arms can produce is one of L-QTY-05's closed measurement causes", () => {
    const readings = [...MEASUREMENT_CAUSES, QUANTITY_BEARING];
    for (const cell of resolveResidue(input())) expect(readings, `${cell.measurement} is not a reading the measurement axis may stand at`).toContain(cell.measurement);
  });
});

describe("AC-1: the bill axis is orthogonal to the measurement one (L-QTY-05)", () => {
  const heldOut = {
    class: "column",
    kind: "rcc.formwork",
    levelId: GROUND_FLOOR.levelId,
    cause: "NOT_IN_THIS_BILL" as const,
    actId: "act-2",
    inForce: true,
    actResolves: true,
  };

  test("NOT_IN_THIS_BILL is read on the bill axis and moves nothing on the measurement one", () => {
    const held = findCell(cellsOf({ declarations: [heldOut] }), "rcc.formwork", "column", GROUND_FLOOR.levelId);
    expect(held?.bill, "the hold is the bill axis' own cause").toBe("NOT_IN_THIS_BILL");
    expect(held?.measurement, "the cell is still unmeasured, and says so on its own axis").toBe("NOT_ESTABLISHED");
    expect(held?.billActId).toBe("act-2");
  });

  test("a cell nobody held out reads IN_BILL", () => {
    expect(findCell(cellsOf(), "rcc.formwork", "column", GROUND_FLOOR.levelId)?.bill).toBe(IN_BILL);
  });

  test("BILL_CAUSES is the closed set the axis may stand under", () => {
    expect([...BILL_CAUSES]).toEqual(["NOT_IN_THIS_BILL"]);
  });

  test("a declaration beaten by published lines is marked contradicted, and the row stands (I-192)", () => {
    const held = findCell(
      cellsOf({ declarations: [heldOut], lines: [{ kind: "rcc.formwork", class: "column", levelId: GROUND_FLOOR.levelId, lineId: "line-9" }] }),
      "rcc.formwork",
      "column",
      GROUND_FLOOR.levelId,
    );
    expect(held?.bill, "arm order beats the declaration on its own axis").toBe(IN_BILL);
    expect(held?.measurement).toBe(QUANTITY_BEARING);
    expect(held?.contradicted, "nothing is withdrawn — the cell says the declaration is contradicted").toBe(true);
    expect(held?.billActId, "the act the declaration was made by is still named").toBe("act-2");
  });
});

describe("AC-1: the kind grains — a kind with no cell is a row, never a silence (L-QTY-07)", () => {
  test("NO_BEARER_SIGHTED: a borne kind no sighted class bears", () => {
    const rows = kindRowsOf({ bears: [{ class: "beam", kind: "rcc.concrete" }, { class: "column", kind: "rcc.formwork" }] });
    const held = rows.find((row) => row.kind === "rcc.concrete");
    expect(held?.measurement, "the beam bears it and no channel sighted a beam").toBe("NO_BEARER_SIGHTED");
    expect([held?.class, held?.levelId], "a kind-grain row spans every class and level, so it names neither").toEqual(["", null]);
  });

  test("KIND_NOT_YET_SEEDED: a work item no class bears at all", () => {
    expect(kindRowsOf().find((row) => row.kind === "rcc.reinforcement")?.measurement).toBe("KIND_NOT_YET_SEEDED");
  });

  test("a kind a sighted class bears has no kind-grain row — it has cells instead", () => {
    expect(kindRowsOf().map((row) => row.kind), "rcc.concrete and rcc.formwork are borne by the sighted column").toEqual(["rcc.reinforcement"]);
  });

  test("the kind grains stand at the head of the grid", () => {
    const resolved = resolveResidue(input());
    expect(resolved[0]?.grain, "a kind with no cell is shown first, never hidden (R-UI-050)").toBe("KIND");
  });
});

describe("AC-1: the channels answer what they SAW — no absence lives under channels/**", () => {
  test.each([
    ["registerSightings", registerSightings],
    ["partitionSightings", partitionSightings],
    ["layoutSightings", layoutSightings],
  ])("%s is one of the three readers the union is taken over", (name, reader) => {
    expect(typeof reader, `${name} is exported from the residue's roster`).toBe("function");
  });

  test("each reader's declared return type is Sighting[]", () => {
    // white-box: AC-1 — "each reader's declared return type is `Sighting[]`" is a claim about the
    // signature, which has no runtime observable at all: a function that returns an array of
    // sightings and one that is DECLARED to are indistinguishable once the types are erased.
    for (const file of readdirSync(CHANNELS).filter((name) => name.endsWith(".ts") && name !== "scope.ts")) {
      const source = readFileSync(join(CHANNELS, file), "utf8");
      expect(source, `${file} declares its answer as a list of what it saw (L-QTY-05)`).toContain("Promise<Sighting[]>");
    }
  });

  test("no `absent` constructor exists anywhere under channels/**", () => {
    // white-box: AC-1 — the criterion is an absence in source text ("a recogniser's output type is
    // `Sighting[]` with no `absent()` constructor"), and a constructor nobody wrote has no runtime
    // trace to assert over. It is asked of CODE through the tree's one lexer: each reader's own
    // header explains the ban in prose, and prose is not a constructor.
    for (const file of readdirSync(CHANNELS).filter((name) => name.endsWith(".ts"))) {
      const code = lex(readFileSync(join(CHANNELS, file), "utf8")).code;
      expect(/\babsent\s*\(/u.test(code), `${file} constructs an absence — a channel says what it SAW (L-QTY-05)`).toBe(false);
      expect(/\babsent\b/u.test(code), `${file} names an absence constructor at all`).toBe(false);
    }
  });
});

describe("AC-1: a cell's address has one home (Decision § 7)", () => {
  test("a cell round-trips through its address", () => {
    const held = findCell(cellsOf(), "rcc.concrete", "column", GROUND_FLOOR.levelId);
    expect(parseCellRef(addressOf(held as ResidueCell))).toEqual({ kind: "rcc.concrete", class: "column", levelId: GROUND_FLOOR.levelId });
  });

  test("a kind-grain row addresses as {kind}::", () => {
    const row = kindRowsOf()[0] as ResidueCell;
    expect(addressOf(row)).toBe("rcc.reinforcement::");
    expect(parseCellRef(addressOf(row))).toEqual({ kind: "rcc.reinforcement", class: "", levelId: null });
  });

  test("an address that names no cell selects nothing (I-193)", () => {
    for (const stale of ["", "rcc.concrete", "a:b:c:d", ":column:level-gf"]) {
      expect(parseCellRef(stale), `"${stale}" names no cell, and nothing is invented for it`).toBeNull();
    }
  });
});

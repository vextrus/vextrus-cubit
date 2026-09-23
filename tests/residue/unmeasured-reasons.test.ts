/**
 * Every unmeasured cell says WHY, and the certificate never says that nothing does (s-coverage
 * I-480/c/d/e; L-QTY-05, L-QTY-07; walk-0's register-trace B11 and fresh-flow B03).
 *
 * L-QTY-05 keeps the cause closed — a cell nothing published for and no person declared stands under
 * NOT_ESTABLISHED, the writerless fall-through — and a rail's report stays evidence. What is judged
 * here is the evidence read BESIDE that cause, over `resolveResidue` itself (pure, no database):
 * - what a rail reported for the cell, with the views it names in the drawing's own words;
 * - a class the drawings declare and nothing placed;
 * - a campaign no run was ever carried over;
 * - a pair the run reads elsewhere and never reached here;
 * - a pair the run does not read at all;
 * and that the measurement statement carries the reason, enumerates the cells published only in
 * part, and says where a level-less cell stands.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { billStatementOf, measurementStatementOf, partialStatementOf, resolveResidue, unclassedStatementOf, type ResidueInput, type Sighting } from "@/core/residue";

/** The seam under `residue.ts` opens a pool at import time; the address is stated, never dialled. */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

const GF = { levelId: "level-gf", ordinal: 0, label: "GF" };
const L1 = { levelId: "level-1f", ordinal: 1, label: "1F" };
const L2 = { levelId: "level-2f", ordinal: 2, label: "2F" };

/** A member the register placed, on a level (or in the foundation slot). */
function placed(klass: string, levelId: string | null, over: Partial<Sighting> = {}): Sighting {
  return { class: klass, levelId, channel: "REGISTER", drawingId: "d1", layoutName: "S-10", sourceKey: `v:LAYOUT_PLAN:k|${klass}|${levelId ?? ""}`, ...over };
}

/** A class the drawing's own caption declares — nothing placed. */
function declaredBy(klass: string, caption: string): Sighting {
  return { class: klass, levelId: null, channel: "LAYOUT", drawingId: "d1", layoutName: "S-19", sourceKey: "DXF_HANDLE:caption", declared: true, caption };
}

function input(over: Partial<ResidueInput>): ResidueInput {
  return {
    bears: [
      { class: "column", kind: "rcc.concrete" },
      { class: "column", kind: "rcc.formwork" },
      { class: "slab", kind: "rcc.concrete" },
      { class: "beam", kind: "rcc.concrete" },
      { class: "pile", kind: "rcc.concrete" },
    ],
    workItems: ["rcc.concrete", "rcc.formwork"],
    levels: [GF, L1, L2],
    sightings: [],
    lines: [],
    declarations: [],
    truncated: [],
    observations: [],
    ...over,
  };
}

const cellAt = (cells: ReturnType<typeof resolveResidue>, kind: string, klass: string, levelId: string | null) =>
  cells.find((cell) => cell.kind === kind && cell.class === klass && cell.levelId === levelId);

describe("I-480: an unmeasured cell carries the reason it stands unmeasured, beside its cause", () => {
  test("what a rail reported for the cell is its reason, with the views it names in the drawing's own words", () => {
    const cells = resolveResidue(
      input({
        sightings: [placed("column", GF.levelId)],
        observations: [
          { class: "column", kind: "rcc.concrete", levelId: GF.levelId, rail: "column/rcc.concrete", reason: "…", code: "VIEW_SCALE_UNAFFIRMED", source: "v:LAYOUT_PLAN:A", view: "COLUMN LAYOUT PLAN" },
          { class: "column", kind: "rcc.concrete", levelId: GF.levelId, rail: "column/rcc.concrete", reason: "…", code: "VIEW_SCALE_UNAFFIRMED", source: "v:LAYOUT_PLAN:A", view: "COLUMN LAYOUT PLAN" },
          { class: "column", kind: "rcc.concrete", levelId: GF.levelId, rail: "column/rcc.concrete", reason: "…", code: "MEMBER_TYPE_UNKNOWN", source: "p1", view: null },
        ],
      }),
    );
    const cell = cellAt(cells, "rcc.concrete", "column", GF.levelId);
    expect(cell?.measurement, "the cause stays L-QTY-05's writerless fall-through").toBe("NOT_ESTABLISHED");
    expect(cell?.reason, "and the reason is the report said most — the one to act on first").toBe(REFUSALS.VIEW_SCALE_UNAFFIRMED.code);
    expect(cell?.reasonViews, "naming the view in its own words, never its address").toEqual(["COLUMN LAYOUT PLAN"]);
  });

  test("a caption on a sheet read in full never turns a cell whose placements all stand on a sheet read in part into the fall-through", () => {
    // The column's members were placed on d1, which was read only in part; the column schedule that
    // declares the class stands on d2, read in full. The cell's cause is the truncation, named.
    const schedule: Sighting = { ...declaredBy("column", "COLUMN SCHEDULE"), drawingId: "d2", layoutName: "S-11" };
    const cells = resolveResidue(input({ sightings: [placed("column", GF.levelId), schedule], truncated: [{ drawingId: "d1", layoutName: "S-10" }] }));
    expect(cellAt(cells, "rcc.concrete", "column", GF.levelId)?.measurement).toBe("INGESTION_TRUNCATED");
  });

  test("a class the drawings declare and nothing placed is NOT PLACED, and its column stands nowhere yet", () => {
    const cells = resolveResidue(input({ sightings: [placed("column", GF.levelId), declaredBy("slab", "TYPICAL SLAB REINFORCEMENT PLAN")], lines: [{ kind: "rcc.concrete", class: "column", levelId: GF.levelId, lineId: "l1" }] }));
    const slab = cellAt(cells, "rcc.concrete", "slab", null);
    expect(slab, "the declared class stands on the grid").toBeDefined();
    expect(slab?.measurement).toBe("NOT_ESTABLISHED");
    expect(slab?.reason).toBe(REFUSALS.COVERAGE_CLASS_NOT_PLACED.code);
    expect(slab?.reasonViews, "the caption that shows it").toEqual(["TYPICAL SLAB REINFORCEMENT PLAN"]);
    expect(slab?.levelSlot, "a column of a class nothing placed says it stands nowhere yet (I-482)").toBe("UNPLACED");
  });

  test("a campaign no run was carried over says so — not that nothing explains it", () => {
    const cells = resolveResidue(input({ sightings: [placed("column", GF.levelId)] }));
    expect(cellAt(cells, "rcc.concrete", "column", GF.levelId)?.reason).toBe(REFUSALS.COVERAGE_NOT_MEASURED_YET.code);
  });

  test("a pair the run reads elsewhere and never reached here, and a pair it does not read at all, are told apart", () => {
    const cells = resolveResidue(
      input({
        sightings: [placed("column", GF.levelId), placed("column", L1.levelId)],
        lines: [{ kind: "rcc.concrete", class: "column", levelId: GF.levelId, lineId: "l1" }],
      }),
    );
    expect(cellAt(cells, "rcc.concrete", "column", L1.levelId)?.reason, "column concrete is read — GF published — so 1F's members were not reached").toBe(
      REFUSALS.COVERAGE_MEMBERS_NOT_REACHED.code,
    );
    expect(cellAt(cells, "rcc.formwork", "column", GF.levelId)?.reason, "column formwork is published and reported nowhere: nothing reads it yet").toBe(
      REFUSALS.COVERAGE_KIND_NOT_READ.code,
    );
  });

  test("a measured cell and a declared cell carry no reason — a reason stands only beside the fall-through", () => {
    const cells = resolveResidue(
      input({
        sightings: [placed("column", GF.levelId)],
        lines: [{ kind: "rcc.concrete", class: "column", levelId: GF.levelId, lineId: "l1" }],
        declarations: [{ class: "column", kind: "rcc.formwork", levelId: GF.levelId, cause: "NOT_IN_PROJECT_SCOPE", actId: "act-1", inForce: true, actResolves: true }],
      }),
    );
    expect(cellAt(cells, "rcc.concrete", "column", GF.levelId)?.reason).toBeNull();
    expect(cellAt(cells, "rcc.formwork", "column", GF.levelId)?.measurement).toBe("NOT_IN_PROJECT_SCOPE");
    expect(cellAt(cells, "rcc.formwork", "column", GF.levelId)?.reason).toBeNull();
  });

  test("a report under a code the register does not hold stays evidence and is never the reason", () => {
    const cells = resolveResidue(
      input({
        sightings: [placed("column", GF.levelId), placed("column", L1.levelId)],
        lines: [{ kind: "rcc.concrete", class: "column", levelId: GF.levelId, lineId: "l1" }],
        observations: [{ class: "column", kind: "rcc.concrete", levelId: L1.levelId, rail: "column/rcc.concrete", reason: "NO_SECTION_MAPPED" }],
      }),
    );
    const cell = cellAt(cells, "rcc.concrete", "column", L1.levelId);
    expect(cell?.observations, "the report stands as the rail spelled it").toHaveLength(1);
    expect(cell?.reason, "and the reason is the campaign's own, registered").toBe(REFUSALS.COVERAGE_MEMBERS_NOT_REACHED.code);
  });

  test("every NOT_ESTABLISHED cell of any reading carries a registered reason", () => {
    const cells = resolveResidue(
      input({
        sightings: [placed("column", GF.levelId), placed("column", L1.levelId), declaredBy("slab", "SLAB PLAN"), placed("pile", null, { levelSlot: "FOUNDATION" })],
        lines: [{ kind: "rcc.concrete", class: "column", levelId: GF.levelId, lineId: "l1" }],
      }),
    );
    const unmeasured = cells.filter((cell) => cell.measurement === "NOT_ESTABLISHED");
    expect(unmeasured.length).toBeGreaterThan(0);
    for (const cell of unmeasured) {
      expect(cell.reason, `${cell.kind} on ${cell.class ?? ""}`).not.toBeNull();
      expect(Object.hasOwn(REFUSALS, cell.reason as string), `${cell.reason} is registered (Q-07)`).toBe(true);
    }
  });
});

describe("I-482: a level-less column says where its members stand", () => {
  test("a foundation filed under the FOUNDATION slot says Foundation, not no level", () => {
    const cells = resolveResidue(input({ sightings: [placed("pile", null, { levelSlot: "FOUNDATION" }), placed("pile", null, { channel: "PARTITION" })] }));
    expect(cellAt(cells, "rcc.concrete", "pile", null)?.levelSlot).toBe("FOUNDATION");
  });
});

describe("the measurement statement carries the reason, and never prints that nothing explains an absence", () => {
  test("a row carries the reason and the views; contiguous levels fold only while the reason holds", () => {
    const cells = resolveResidue(
      input({
        sightings: [placed("column", GF.levelId), placed("column", L1.levelId), placed("column", L2.levelId)],
        lines: [{ kind: "rcc.formwork", class: "column", levelId: GF.levelId, lineId: "f1" }],
        observations: [
          { class: "column", kind: "rcc.concrete", levelId: GF.levelId, rail: "column/rcc.concrete", reason: "…", code: "VIEW_SCALE_UNAFFIRMED", source: "v:A", view: "COLUMN LAYOUT PLAN" },
          { class: "column", kind: "rcc.concrete", levelId: L1.levelId, rail: "column/rcc.concrete", reason: "…", code: "VIEW_SCALE_UNAFFIRMED", source: "v:A", view: "COLUMN LAYOUT PLAN" },
        ],
      }),
    );
    const rows = measurementStatementOf(cells).filter((row) => row.kind === "rcc.concrete" && row.class === "column");
    expect(
      rows.map((row) => ({ levels: row.levels, cause: row.cause, reason: row.reason, views: row.views })),
      "GF–1F share the scale reason and fold; 2F was reached by nothing and prints on its own line",
    ).toEqual([
      { levels: "GF–1F", cause: "NOT_ESTABLISHED", reason: "VIEW_SCALE_UNAFFIRMED", views: ["COLUMN LAYOUT PLAN"] },
      { levels: "2F", cause: "NOT_ESTABLISHED", reason: "COVERAGE_MEMBERS_NOT_REACHED", views: [] },
    ]);
  });

  test("a row of the bill statement stands under the cause a person gave it, and carries no reason beside it", () => {
    const cells = resolveResidue(
      input({
        sightings: [placed("column", GF.levelId)],
        lines: [{ kind: "rcc.concrete", class: "column", levelId: GF.levelId, lineId: "l1" }],
        declarations: [{ class: "column", kind: "rcc.formwork", levelId: GF.levelId, cause: "NOT_IN_THIS_BILL", actId: "act-1", inForce: true, actResolves: true }],
      }),
    );
    expect(cellAt(cells, "rcc.formwork", "column", GF.levelId)?.reason, "the cell still reads why it is unmeasured").toBe(REFUSALS.COVERAGE_KIND_NOT_READ.code);
    expect(
      billStatementOf(cells).map((row) => ({ cause: row.cause, reason: row.reason, views: row.views })),
      "a reason beside a person's cause would be a second cause column (L-QTY-07)",
    ).toEqual([{ cause: "NOT_IN_THIS_BILL", reason: null, views: [] }]);
  });

  test("a cell published only in part is enumerated with what its lines left out, and no count", () => {
    const partial = (levelId: string, lineId: string) => ({
      kind: "rcc.concrete",
      class: "beam",
      levelId,
      lineId,
      objectKey: `b-${lineId}`,
      coverage: "PARTIAL_DECLARED",
      omitted: [{ variable: "t", code: "SLAB_THICKNESS_UNSTATED" }],
    });
    const cells = resolveResidue(input({ sightings: [placed("beam", L1.levelId), placed("beam", L2.levelId)], lines: [partial(L1.levelId, "a"), partial(L1.levelId, "b"), partial(L2.levelId, "c")] }));
    const beam = cellAt(cells, "rcc.concrete", "beam", L1.levelId);
    expect(beam?.measurement, "a published cell stays QUANTITY_BEARING on L-QTY-05's axis").toBe("QUANTITY_BEARING");
    expect(beam?.partial, "and says what its lines left out, over how many members").toEqual({ lines: 2, members: 2, omitted: [{ code: "SLAB_THICKNESS_UNSTATED", variables: ["t"], lines: 2 }] });
    expect(measurementStatementOf(cells).some((row) => row.class === "beam"), "it is no unpublished cell").toBe(false);
    expect(partialStatementOf(cells), "the statement's partial enumeration names it, levels folded").toEqual([
      { kind: "rcc.concrete", class: "beam", levelId: L1.levelId, levelLabel: "1F", levels: "1F–2F", levelSlot: null, omitted: ["SLAB_THICKNESS_UNSTATED"] },
    ]);
  });

  test("a cell whose lines are all COMPLETE is not partial", () => {
    const cells = resolveResidue(input({ sightings: [placed("column", GF.levelId)], lines: [{ kind: "rcc.concrete", class: "column", levelId: GF.levelId, lineId: "l1", coverage: "COMPLETE", omitted: [] }] }));
    expect(cellAt(cells, "rcc.concrete", "column", GF.levelId)?.partial).toBeNull();
    expect(partialStatementOf(cells)).toEqual([]);
  });

  test("the members no class measures are enumerated by word, in canonical order, each under its registered reason", () => {
    const listed = unclassedStatementOf([
      { drawingId: "d1", address: "v:1", caption: "SEPTIC TANK", word: "tank" },
      { drawingId: "d1", address: "v:2", caption: "PARAPET DETAIL", word: "parapet" },
      { drawingId: "d1", address: "v:3", caption: "OVERHEAD WATER TANK", word: "tank" },
    ]);
    expect(listed.map((member) => `${member.word}:${member.caption}`)).toEqual(["parapet:PARAPET DETAIL", "tank:OVERHEAD WATER TANK", "tank:SEPTIC TANK"]);
    expect(new Set(listed.map((member) => member.code)), "drawn, named, never measured — under one registered reason (Q-07)").toEqual(new Set([REFUSALS.COVERAGE_MEMBER_UNCLASSED.code]));
  });
});

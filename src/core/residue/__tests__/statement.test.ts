/**
 * L-QTY-07's two boundary statements, computed off the residue.
 *
 * "Two separately titled statements — measurement boundary first and in full over the whole
 * catalogue, then bill boundary — never a shared cause column. Prints enumerations …" So each is an
 * enumeration of cells in the certificate's own order over (kind, class, level), each row carrying
 * its own cause, and neither ever states how many rows it holds: a count is not a boundary.
 *
 * They are computed in core so that M7's certificate and this milestone's preview read the same rows
 * through the same order (B-19). A contradicted cell is in neither: a certificate never prints a
 * boundary the published lines themselves deny (I-192).
 */
import { describe, expect, test } from "vitest";
import { billStatementOf, measurementStatementOf, type ResidueCell } from "../index";

const cell = (over: Partial<ResidueCell>): ResidueCell => ({
  kind: "rcc.concrete",
  class: "column",
  levelId: "level-gf",
  levelLabel: "GF",
  levelOrdinal: 0,
  grain: "CELL",
  measurement: "NOT_ESTABLISHED",
  bill: "IN_BILL",
  contradicted: false,
  lineIds: [],
  sightings: [],
  observations: [],
  measurementActId: null,
  billActId: null,
  ...over,
});

const addressed = (rows: readonly { kind: string; class: string | null; levelId: string | null }[]): string[] =>
  rows.map((row) => `${row.kind}:${row.class ?? ""}:${row.levelId ?? ""}`);

describe("L-QTY-07: the measurement boundary statement", () => {
  test("every unmeasured cell is enumerated, each under its own cause", () => {
    const rows = measurementStatementOf([
      cell({ kind: "rcc.formwork", measurement: "INGESTION_TRUNCATED" }),
      cell({ kind: "rcc.concrete", measurement: "NOT_IN_PROJECT_SCOPE" }),
      cell({ kind: "rcc.reinforcement", class: "", levelId: null, levelLabel: "", levelOrdinal: null, grain: "KIND", measurement: "NO_BEARER_SIGHTED" }),
    ]);
    expect(rows.map((row) => row.cause), "a cause per row, never a shared column (L-QTY-07)").toEqual([
      "NOT_IN_PROJECT_SCOPE",
      "INGESTION_TRUNCATED",
      "NO_BEARER_SIGHTED",
    ]);
  });

  test("a cell that bears quantity is not in it — the statement states what was NOT measured", () => {
    expect(measurementStatementOf([cell({ measurement: "QUANTITY_BEARING", lineIds: ["line-1"] })]), "a measured cell stands outside no boundary").toEqual([]);
  });

  test("the rows stand in order over (kind, class, level ordinal)", () => {
    // L1 stands at ordinal 2, not 1: the storey between them was measured, so these two levels are
    // not one run and each states its own line. Order is asserted here; the run is asserted below.
    const rows = measurementStatementOf([
      cell({ kind: "rcc.formwork", class: "column", levelId: "level-01", levelLabel: "L1", levelOrdinal: 2 }),
      cell({ kind: "rcc.concrete", class: "column", levelId: "level-01", levelLabel: "L1", levelOrdinal: 2 }),
      cell({ kind: "rcc.concrete", class: "beam", levelId: "level-gf", levelLabel: "GF", levelOrdinal: 0 }),
      cell({ kind: "rcc.concrete", class: "column", levelId: "level-gf", levelLabel: "GF", levelOrdinal: 0 }),
    ]);
    expect(addressed(rows)).toEqual([
      "rcc.concrete:beam:level-gf",
      "rcc.concrete:column:level-gf",
      "rcc.concrete:column:level-01",
      "rcc.formwork:column:level-01",
    ]);
  });

  test("the level is ordered by where it stands in the stack, not by how its label sorts", () => {
    // "L10" precedes "L9" in an alphabet and follows it in a building. A statement is read by
    // somebody walking up the storeys (L-QTY-07), and a gap keeps them two lines.
    const rows = measurementStatementOf([
      cell({ levelId: "level-10", levelLabel: "L10", levelOrdinal: 10 }),
      cell({ levelId: "level-09", levelLabel: "L9", levelOrdinal: 8 }),
    ]);
    expect(rows.map((row) => row.levels)).toEqual(["L9", "L10"]);
  });

  test("a contiguous run of levels under one cause prints as one line, first–last", () => {
    const rows = measurementStatementOf([
      cell({ levelId: "level-gf", levelLabel: "GF", levelOrdinal: 0 }),
      cell({ levelId: "level-01", levelLabel: "L1", levelOrdinal: 1 }),
      cell({ levelId: "level-02", levelLabel: "L2", levelOrdinal: 2 }),
    ]);
    expect(rows.map((row) => [row.levels, row.levelId]), "three contiguous cells, one printed line, opening on the level a reader lands on").toEqual([
      ["GF–L2", "level-gf"],
    ]);
  });

  test("a gap in the run breaks the line, and a different cause never joins one", () => {
    const gapped = measurementStatementOf([
      cell({ levelId: "level-gf", levelLabel: "GF", levelOrdinal: 0 }),
      cell({ levelId: "level-02", levelLabel: "L2", levelOrdinal: 2 }),
    ]);
    expect(gapped.map((row) => row.levels), "the storey between them stands outside this boundary, so printing it inside the run would state something untrue").toEqual([
      "GF",
      "L2",
    ]);

    const mixed = measurementStatementOf([
      cell({ levelId: "level-gf", levelLabel: "GF", levelOrdinal: 0 }),
      cell({ levelId: "level-01", levelLabel: "L1", levelOrdinal: 1, measurement: "INGESTION_TRUNCATED" }),
    ]);
    expect(mixed.map((row) => [row.levels, row.cause]), "each row carries its own cause, so two causes are two lines (L-QTY-07)").toEqual([
      ["GF", "NOT_ESTABLISHED"],
      ["L1", "INGESTION_TRUNCATED"],
    ]);
  });

  test("a kind no class bears is enumerated too — KIND_NOT_YET_SEEDED is a row, not a silence", () => {
    const rows = measurementStatementOf([cell({ kind: "rcc.reinforcement", class: null, levelId: null, levelLabel: "", levelOrdinal: null, grain: "KIND", measurement: "KIND_NOT_YET_SEEDED" })]);
    expect(rows.map((row) => [row.grain, row.cause])).toEqual([["KIND", "KIND_NOT_YET_SEEDED"]]);
  });
});

describe("R-TO-052: the bill boundary statement", () => {
  test("only what a person held out of this bill", () => {
    const rows = billStatementOf([
      cell({ kind: "rcc.formwork", bill: "NOT_IN_THIS_BILL", billActId: "act-2" }),
      cell({ kind: "rcc.concrete", measurement: "NOT_ESTABLISHED" }),
    ]);
    expect(rows.map((row) => [row.kind, row.cause])).toEqual([["rcc.formwork", "NOT_IN_THIS_BILL"]]);
  });

  test("an unmeasured cell nobody held out is in the measurement statement and not in this one", () => {
    const unmeasured = [cell({ measurement: "NOT_ESTABLISHED" })];
    expect(measurementStatementOf(unmeasured).length, "the measurement boundary holds it").toBe(1);
    expect(billStatementOf(unmeasured), "the axes are orthogonal, so neither statement speaks for the other").toEqual([]);
  });

  test("a held-out cell is stated here and not repeated on the measurement boundary", () => {
    // The boundary a person drew is stated once, on the axis they moved: printing the same cell
    // again under NOT_ESTABLISHED would say the campaign failed to measure something a person had
    // deliberately taken out of this bill (L-QTY-07, I-198).
    const heldOut = [cell({ measurement: "NOT_ESTABLISHED", bill: "NOT_IN_THIS_BILL", billActId: "act-7" })];
    expect(billStatementOf(heldOut).map((row) => row.cause), "the bill boundary states it, under the cause the act declared").toEqual(["NOT_IN_THIS_BILL"]);
    expect(measurementStatementOf(heldOut), "and the measurement boundary does not state it a second time").toEqual([]);
  });
});

describe("I-192: a contradicted cell is printed by neither statement", () => {
  test.each([
    ["the measurement boundary", "NOT_IN_PROJECT_SCOPE" as const, measurementStatementOf],
    ["the bill boundary", "NOT_IN_THIS_BILL" as const, billStatementOf],
  ])("%s omits a declaration the published lines deny", (_where, cause, statementOf) => {
    const beaten = cell({
      measurement: cause === "NOT_IN_PROJECT_SCOPE" ? "QUANTITY_BEARING" : "NOT_ESTABLISHED",
      bill: "IN_BILL",
      contradicted: true,
      lineIds: ["line-1"],
    });
    expect(statementOf([beaten]), "a certificate never prints a boundary the lines themselves contradict").toEqual([]);
  });
});

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

const addressed = (rows: readonly { kind: string; class: string; levelId: string | null }[]): string[] =>
  rows.map((row) => `${row.kind}:${row.class}:${row.levelId ?? ""}`);

describe("L-QTY-07: the measurement boundary statement", () => {
  test("every unmeasured cell is enumerated, each under its own cause", () => {
    const rows = measurementStatementOf([
      cell({ kind: "rcc.formwork", measurement: "INGESTION_TRUNCATED" }),
      cell({ kind: "rcc.concrete", measurement: "NOT_IN_PROJECT_SCOPE" }),
      cell({ kind: "rcc.reinforcement", class: "", levelId: null, levelLabel: "", grain: "KIND", measurement: "NO_BEARER_SIGHTED" }),
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

  test("the rows stand in compareCanonical order over (kind, class, level)", () => {
    const rows = measurementStatementOf([
      cell({ kind: "rcc.formwork", class: "column", levelId: "level-01", levelLabel: "L1" }),
      cell({ kind: "rcc.concrete", class: "column", levelId: "level-01", levelLabel: "L1" }),
      cell({ kind: "rcc.concrete", class: "beam", levelId: "level-gf", levelLabel: "GF" }),
      cell({ kind: "rcc.concrete", class: "column", levelId: "level-gf", levelLabel: "GF" }),
    ]);
    expect(addressed(rows)).toEqual([
      "rcc.concrete:beam:level-gf",
      "rcc.concrete:column:level-gf",
      "rcc.concrete:column:level-01",
      "rcc.formwork:column:level-01",
    ]);
  });

  test("a kind no class bears is enumerated too — KIND_NOT_YET_SEEDED is a row, not a silence", () => {
    const rows = measurementStatementOf([cell({ kind: "rcc.reinforcement", class: "", levelId: null, levelLabel: "", grain: "KIND", measurement: "KIND_NOT_YET_SEEDED" })]);
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

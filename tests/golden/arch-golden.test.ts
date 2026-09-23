// F-ARCH's golden, read the way every product-side band will read it: through the one reader
// (`goldenRows("arch")`, tests/golden/support/golden-fixture.ts) and the one kind correspondence.
// The golden lane holds it here as committed bytes; its two independent paths are re-run by the cad
// half of the lane (cad/tests/arch, cad/tests/sanity/test_golden_corpora.py).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
// Relative, not `@/`: the golden lane's config carries no alias and must stay a bare-checkout lane
// (tests/golden/vitest.config.ts); the catalogue's two leaf modules import nothing at run time.
import { KINDS } from "../../src/core/catalogue/kinds";
import { KIND_DISCIPLINE } from "../../src/core/catalogue/maps";
import { PRODUCT_TO_GOLDEN_KIND, goldenDocument, goldenKindOf, goldenRows, printingAllowanceOf } from "./support/golden-fixture";

const FIXTURE = "arch";

type Cells = { milestone: string; cells: { cell: Record<string, string>; expected_residue?: string }[] };

function cells(): Cells {
  return JSON.parse(readFileSync(join(process.cwd(), "fixtures", FIXTURE, "cells.json"), "utf8")) as Cells;
}

describe("F-ARCH's golden through the one reader", () => {
  test("it is schema 2, authored by hand from the generator's model, and every row is a non-negative decimal with a unit", () => {
    const doc = goldenDocument(FIXTURE);
    expect(doc.fixture).toBe("F-ARCH");
    expect(doc.schema).toBe(2);
    expect(doc.provenance).toBe("HAND_FROM_AUTHORED_SOURCE");
    const rows = goldenRows(FIXTURE);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.quantity, JSON.stringify(row)).toMatch(/^\d+(\.\d+)?$/);
      expect(row.unit).not.toBe("");
      if (row.class === "SURFACE") expect(row.room, "a surface row names the room it is measured in").toBeTruthy();
      if (row.class === "OPENING") expect(row.mark, "an opening row names its mark").toBeTruthy();
    }
  });

  test("every product kind the ARCHITECTURAL set is authoritative for has a golden spelling, and F-ARCH carries rows in it", () => {
    const architectural = KINDS.filter((kind) => KIND_DISCIPLINE[kind] === "ARCHITECTURAL");
    expect(architectural.length).toBeGreaterThan(0);
    const kinds = new Set(goldenRows(FIXTURE).map((row) => row.kind));
    for (const kind of architectural) {
      expect(PRODUCT_TO_GOLDEN_KIND[kind], `${kind} is ARCHITECTURAL and the golden spells no such kind`).toBeDefined();
      expect(kinds.has(goldenKindOf(kind)), `F-ARCH carries no ${goldenKindOf(kind)} rows for ${kind}`).toBe(true);
    }
    expect(goldenKindOf("finish.plaster")).toBe("PLASTER");
    expect(goldenKindOf("finish.paint")).toBe("PAINT");
  });

  test("its M4 exit cells are each filled by rows, and a band can be taken on each (a printing allowance exists)", () => {
    const doc = cells();
    expect(doc.milestone).toBe("M4");
    const rows = goldenRows(FIXTURE);
    for (const entry of doc.cells) {
      const inCell = rows.filter((row) => Object.entries(entry.cell).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
      expect(inCell.length, `no row fills ${JSON.stringify(entry.cell)}`).toBeGreaterThan(0);
      expect(printingAllowanceOf(inCell)).not.toBe("0");
    }
  });

  test("the threshold the golden deducts by is the one the platform edition states (0.1 m², strictly greater)", () => {
    const doc = goldenDocument(FIXTURE) as { edition?: string };
    // Read off the seed's own text: importing the seed would pull the whole method registry into a
    // lane that must stay a bare-checkout one.
    const seed = readFileSync(join(process.cwd(), "src/core/rulesets/seed/index.ts"), "utf8");
    for (const parameter of ["openingDeductionMinM2", "finishOpeningDeductionMinM2"]) {
      expect(seed, `the edition states ${parameter} as 0.1 m2`).toMatch(new RegExp(`\\b${parameter}: \\{ value: "0\\.1", unit: "m2" \\}`));
      expect(doc.edition ?? "").toContain(parameter);
    }
    expect(doc.edition ?? "").toContain("0.1 m²");
  });
});

// AC-1, AC-2, AC-3 — the DWG lane converts through LibreDWG in an isolated subprocess and audits
// the conversion with two reconciled passes (L-CAD-04, R-TO-001).
//
// The lane is Python, so its behaviour is graded by the Python suite this increment ships at
// cad/tests/dwg/ — the modules that import `vextrus_cad.dwg` and drive `convert_dwg`, `census_of`,
// `geometry_tally` and `reconcile` directly. Re-deriving those drives here, over a subprocess
// boundary, would be the duplication ARCH-02 refuses; what this file adds is the gate: each
// criterion is run by name, its outcome is read from pytest's own summary rather than from an exit
// code alone, and a run that exercised nothing is a failure like any other.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { committedDwgFixtures, DWG_FIXTURE_DIR, expectPytestGreen, magic, requireDwgLane, runPytest } from "./support/dwg";

/** A DWG opens with its version marker: `AC1015`, `AC1024`, … — the family, not one release. */
const DWG_MARKER = /^AC10\d\d$/;

/** The suite the criteria below are driven by, addressed the way `pnpm verify` addresses cad. */
const DWG_SUITE = "cad/tests/dwg";

/** AC-1's named drawing. */
const BASIC_DWG = join(DWG_FIXTURE_DIR, "basic.dwg");

const PYTEST_BUDGET_MS = 900_000;

describe("the DWG lane's conversion and its audit", () => {
  it("AC-1: the committed basic.dwg is a real DWG the two passes can be run over", () => {
    expect(existsSync(BASIC_DWG), `${BASIC_DWG} is missing — AC-1 names this drawing`).toBe(true);
    expect(magic(BASIC_DWG, 6), "basic.dwg does not open with a DWG version marker").toMatch(DWG_MARKER);
    expect(committedDwgFixtures(), "the DWG fixture home holds no drawing").toContain("basic.dwg");
  });

  it("AC-1: two passes, reconciled, over a real DWG — census and geometry each from their own subprocess", () => {
    requireDwgLane();
    // Each half of the result is re-derived by the suite through the lane's own named pass
    // functions, so a `DwgConversion` that filled both tallies from one pass cannot match.
    expectPytestGreen(runPytest([DWG_SUITE, "-q", "-k", "ac1"]), "AC-1", 4);
  }, PYTEST_BUDGET_MS);

  it("AC-2: a shortfall or an UNKNOWN_ENT refuses that class on that sheet by name, as returned data", () => {
    requireDwgLane();
    expectPytestGreen(runPytest([DWG_SUITE, "-q", "-k", "ac2"]), "AC-2", 5);
  }, PYTEST_BUDGET_MS);

  it("AC-3: an isolated subprocess, the toolchain's own identity recorded, and nothing left behind", () => {
    requireDwgLane();
    expectPytestGreen(runPytest([DWG_SUITE, "-q", "-k", "ac3"]), "AC-3", 7);
  }, PYTEST_BUDGET_MS);
});

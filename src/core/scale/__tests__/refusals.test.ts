/**
 * The refusals L-MEA-05's engine answers with where the law does not admit a factor: an axis nothing
 * verifies, an axis nobody observed, and a header that maps to no length.
 *
 * Exercised here because Q-07's register admits a refusal code only where an EXECUTED test names
 * it: these are answers the engine gives instead of a factor, and the register is what makes naming
 * each an obligation rather than a nicety. Pure — the store, the artifact and the edition are the
 * caller's to bring, and none is brought here.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { proposalsFor, scaleAbsenceCodeOf, verifyAxis, type ScaleEvidence } from "..";

/** The seed edition's own ratio, so the tolerance is what a project would judge by. */
const TOLERANCE = "0.01";

/** A millimetre header's factor, and one two per cent away from it — outside ±1%. */
const ONE_MM = "0.001000000000";
const TWO_PERCENT_OFF = "0.001020000000";
const HALF_PERCENT_OFF = "0.001005000000";

/** An empty drawing with the header a scenario names — enough to ask what the machine proposes. */
function evidenceWith(unit: string | null): ScaleEvidence {
  return {
    graph: {
      entitygraph_version: 2,
      ingest: { scheme: "DXF_HANDLE", tool: "test", tool_version: "0", parameter_set_hash: "0".repeat(64) },
      insunits: { code: 0, unit: null, unmapped: true },
      layouts: [],
      dropped_layouts: [],
      entities: [],
      derived: [],
      block_attributes: [],
      counters: [],
    },
    viewKeys: ["LAYOUT_PLAN:DXF_HANDLE:1A"],
    assignments: new Map(),
    grid: [],
    unit,
    tolerances: { verification: TOLERANCE, anisotropy: TOLERANCE },
  };
}

describe("L-MEA-05: a single observation is verified at tolerance or rejected", () => {
  test("an observation nothing corroborates within tolerance is SCALE_OBSERVATION_UNVERIFIED", () => {
    const failure = (() => {
      try {
        verifyAxis("x", [ONE_MM], [TWO_PERCENT_OFF], TOLERANCE);
        return null;
      } catch (thrown) {
        return thrown;
      }
    })();
    expect(refusalCodeOf(failure), "the drawing's own reading stands two per cent away, which ±1% does not admit").toBe(REFUSALS.SCALE_OBSERVATION_UNVERIFIED.code);
  });

  test("two observations that disagree beyond tolerance are SCALE_OBSERVATION_UNVERIFIED, whatever the drawing says", () => {
    const failure = (() => {
      try {
        verifyAxis("y", [ONE_MM, TWO_PERCENT_OFF], [ONE_MM], TOLERANCE);
        return null;
      } catch (thrown) {
        return thrown;
      }
    })();
    expect(refusalCodeOf(failure), "the second observation contradicts the first, and observations are averaged as nothing").toBe(REFUSALS.SCALE_OBSERVATION_UNVERIFIED.code);
  });

  test("a corroborated observation stands at its own factor, verified by what agreed with it", () => {
    expect(verifyAxis("x", [ONE_MM], [TWO_PERCENT_OFF, HALF_PERCENT_OFF], TOLERANCE)).toEqual({ axis: "x", factor: ONE_MM, verifiedBy: [HALF_PERCENT_OFF] });
    expect(verifyAxis("x", [ONE_MM, HALF_PERCENT_OFF], [], TOLERANCE), "a second observation within tolerance verifies the first, which is the factor").toEqual({
      axis: "x",
      factor: ONE_MM,
      verifiedBy: [HALF_PERCENT_OFF],
    });
  });

  test("an axis nobody observed is SCALE_NO_EVIDENCE — X and Y derive independently", () => {
    const failure = (() => {
      try {
        verifyAxis("y", [], [ONE_MM], TOLERANCE);
        return null;
      } catch (thrown) {
        return thrown;
      }
    })();
    expect(refusalCodeOf(failure), "a machine reading along y is no observation along y, and nothing is borrowed").toBe(REFUSALS.SCALE_NO_EVIDENCE.code);
  });
});

describe("L-MEA-05: the strict unit lane", () => {
  test("an unmapped or unitless header leaves every machine rank absent, and the view declares SCALE_UNIT_UNMAPPED", () => {
    for (const unit of [null, "unitless"]) {
      const proposals = proposalsFor(evidenceWith(unit));
      expect([...proposals.values()], `${JSON.stringify(unit)} carries no metres, so no rank proposes a factor — never a guessed one`).toEqual([[]]);
      expect(scaleAbsenceCodeOf(unit), "and the absence a view declares names the header as the reason").toBe(REFUSALS.SCALE_UNIT_UNMAPPED.code);
    }
  });

  test("a mapped header with no evidence beyond it still proposes rank 4, and the view's absence is SCALE_NO_EVIDENCE", () => {
    const proposals = proposalsFor(evidenceWith("mm"));
    expect([...proposals.values()].map((rows) => rows.map((row) => row.rank)), "the header alone is rank FILE_UNITS").toEqual([["FILE_UNITS"]]);
    expect(scaleAbsenceCodeOf("mm"), "a view no act names has no scale, and the header is not why").toBe(REFUSALS.SCALE_NO_EVIDENCE.code);
  });
});

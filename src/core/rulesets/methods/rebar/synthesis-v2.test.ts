/**
 * `rcc.rebar.synthesis@2` against an exact oracle (R6b, D-003; s-bbs I-656, I-657).
 *
 * The count N(D) and its never-over minimum are graded against the brute-force oracle in
 * `tests/takeoff/rails/rebar/support/column-ties.ts`, which works in whole 1/240 mm and visits every
 * depth of the 1/40 mm lattice — independent arithmetic, no shared code. The sweep below is chosen to
 * cross every regime the zones have: ℓo held by the section and by clear/6, the one-run column, the
 * two spacings equal, a bound under 450, and bounds near the top of the storey.
 */
import { describe, expect, test } from "vitest";
import { oracleNeverOver, oracleSetsAt, type OracleProbe } from "../../../../../tests/takeoff/rails/rebar/support/column-ties";
import { DETAILING_BNBC2020_BD, type DetailingEdition } from "./detailing-bnbc2020-bd";
import { applyDetailing } from "./synthesis";
import { lapLengthFor, synthesiseColumnTies, synthesiseVertical, tieSetsAt, tieSetsNeverOver, type TieCountProbe } from "./synthesis-v2";

const EDITION = DETAILING_BNBC2020_BD.resolve() as DetailingEdition;

/** The product's probe for an oracle probe. */
function probeOf(one: OracleProbe): TieCountProbe {
  return { storeyRunMm: one.h, bMm: one.b, dMm: one.d, endSpacingMm: String(one.se), midSpacingMm: String(one.sm) };
}

/** A deterministic sweep across the regimes (not every product of them: the oracle is a brute force). */
function sweep(): { probe: OracleProbe; lower: string }[] {
  const runs = ["609.6", "2743.2", "3048", "3352.8", "4200.5"];
  const sections: [string, string][] = [["300", "300"], ["300", "600"], ["450", "750"], ["600", "600"]];
  const spacings: [number, number][] = [[100, 150], [75, 150], [100, 200], [125, 125]];
  const lowers = ["0", "300", "450", "600", "900", "1200.5", "2400"];
  const held: { probe: OracleProbe; lower: string }[] = [];
  let at = 0;
  for (const h of runs) {
    for (const [b, d] of sections) {
      for (const [se, sm] of spacings) {
        // every seventh lower bound per (run, section, spacing) triple, rotating, so each regime is
        // crossed with several bounds without the product of all of them
        for (let k = 0; k < 2; k += 1) {
          const lower = lowers[(at + k * 3) % lowers.length] as string;
          held.push({ probe: { h, b, d, se, sm }, lower });
        }
        at += 1;
      }
    }
  }
  return held;
}

describe("synthesis@2: a column's tie sets under D-003", () => {
  test("N(D) equals the oracle's count at every depth of the sweep", () => {
    for (const { probe, lower } of sweep()) {
      for (const depth of [lower, "450", "600", "900"]) {
        expect(tieSetsAt(probeOf(probe), depth), `N(${depth}) over ${JSON.stringify(probe)}`).toBe(oracleSetsAt(probe, depth));
      }
    }
  });

  test("the BOUNDED count is the exact minimum over [max(D_lo, 450), h), and never above N at any depth the bound allows", () => {
    let belowTheBound = 0;
    for (const { probe, lower } of sweep()) {
      const answer = tieSetsNeverOver(probeOf(probe), { standing: "BOUNDED", depthMm: lower });
      expect(answer.sets, `the never-over minimum over ${JSON.stringify(probe)} from ${lower}`).toBe(oracleNeverOver(probe, lower));
      // the depth it names attains it, and lies inside the interval the bound leaves open
      expect(tieSetsAt(probeOf(probe), answer.jointMm), "the joint depth named attains the minimum").toBe(answer.sets);
      expect(Number(answer.jointMm) >= Math.max(Number(lower), 450), "the joint named lies at or above the bound").toBe(true);
      if (answer.sets < tieSetsAt(probeOf(probe), lower)) belowTheBound += 1;
    }
    // N is not monotonic in D: somewhere in the sweep a deeper joint needs FEWER sets than the bound,
    // which is why N(D_lo) alone would read over (the map's `afterfrm3.py`).
    expect(belowTheBound, "the sweep holds a case where the interval's minimum is below N(D_lo)").toBeGreaterThan(0);
  });

  test("RESOLVED counts N at the depth read, floored at 450", () => {
    const probe: OracleProbe = { h: "3352.8", b: "300", d: "600", se: 100, sm: 150 };
    expect(tieSetsNeverOver(probeOf(probe), { standing: "RESOLVED", depthMm: "300" })).toEqual({ sets: oracleSetsAt(probe, "450"), jointMm: "450" });
    expect(tieSetsNeverOver(probeOf(probe), { standing: "RESOLVED", depthMm: "900" }).sets).toBe(oracleSetsAt(probe, "900"));
  });

  test("the ties are a closed link (shape 51) counted at the never-over sets, inside the cover, on two 135° hooks", () => {
    const applied = applyDetailing({ fy: null, fc: null, lapMultiplier: null, hookExtension: null, suspended: [], sourceKeys: [] }, EDITION, "0".repeat(64));
    const probe = { storeyRunMm: "3048", bMm: "300", dMm: "400", endSpacingMm: "100", midSpacingMm: "150" };
    const tied = synthesiseColumnTies({ ...probe, joint: { standing: "BOUNDED", depthMm: "600" }, coverMm: 40, tieMm: 10, detailing: applied, edition: EDITION, sourceKeys: ["cell"] });
    expect(tied.count.sets).toBe(oracleNeverOver({ h: "3048", b: "300", d: "400", se: 100, sm: 150 }, "600"));
    expect(tied.bars).toEqual([
      { role: "TIE", diameterMm: 10, shape: "51", legsMm: ["220", "320", "220", "320", "75", "75"], barsPerUnit: tied.count.sets, lapMm: "0", lapsPerBar: 0, sourceKeys: ["cell"] },
    ]);
  });
});

describe("synthesis@2: R2 — a stated lap binds outside the grade and mix contest (I-308)", () => {
  const stated = (suspended: string[]) => applyDetailing({ fy: null, fc: null, lapMultiplier: 50, hookExtension: null, suspended, sourceKeys: ["note"] }, EDITION, "0".repeat(64));
  const at = { diameterMm: 16, confined: false, top: false };

  test("a stated 50d with the mix contested is 50 × d, where @1 answered the contest", () => {
    expect(lapLengthFor(stated(["FC"]), EDITION, at)).toEqual({ ok: true, mm: "800" });
    expect(lapLengthFor(stated(["FY", "FC"]), EDITION, at)).toEqual({ ok: true, mm: "800" });
  });

  test("a contested LAP note still states nothing", () => {
    expect(lapLengthFor(stated(["LAP"]), EDITION, at).ok).toBe(false);
  });

  test("with no lap stated, the derived lap still waits on a settled mix", () => {
    const unstated = applyDetailing({ fy: null, fc: null, lapMultiplier: null, hookExtension: null, suspended: ["FC"], sourceKeys: [] }, EDITION, "0".repeat(64));
    expect(lapLengthFor(unstated, EDITION, at).ok).toBe(false);
  });

  test("the verticals carry the stated lap once each", () => {
    const bars = synthesiseVertical({ storeyRunMm: "3048", mains: [{ n: 8, diameterMm: 16 }], detailing: stated(["FC"]), edition: EDITION, sourceKeys: ["main"] });
    expect(bars).toEqual([{ role: "MAIN", diameterMm: 16, shape: "00", legsMm: ["3048"], barsPerUnit: 8, lapMm: "800", lapsPerBar: 1, sourceKeys: ["main"] }]);
  });
});

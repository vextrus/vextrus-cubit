// L-QTY-06's band, as arithmetic: how one cell of the validation matrix is graded, and how the
// methods that produced it are cited. Pure — nothing here opens a database or reads a fixture, so
// the grader can be exercised in the unit lane and reasoned about on its own (ARCH-02).
//
// The rule it implements, in the law's own words: "±3 % under, +0 % over against a competent manual
// takeoff, per class, a class passing only if its components pass (no netting)". So a cell is graded
// LEVEL BY LEVEL and the worst level governs; the levels are never summed together first, because a
// sum lets an over at one storey be paid for by an under at another — which is exactly the netting
// the clause forbids.
//
// The two closed ROSTERS a verdict and a provenance are drawn from are the store's: the CHECKs that
// close the ledger's columns are written from them, so they live beside the table and this file only
// takes the TYPE of a verdict from there — a type import is erased, so nothing this file pulls in
// can open a connection and the grader stays a unit-lane citizen (SEAM-TENANT, ARCH-02). The rosters
// themselves are handed out by `./index.ts`, the door every reader of the ledger opens.
import { exact } from "@/core/units/canon";
import type { ValidationVerdict } from "@/core/db";
import { createHash } from "node:crypto";

/**
 * How far under a golden figure a published sum may stand: three per cent, as a multiplier on the
 * golden (L-QTY-06). There is no matching OVER tolerance, and that asymmetry is the clause — an
 * over-measured figure is never a disclosure.
 */
export const UNDER_TOLERANCE = "0.97";

/** One level of a cell: what the yardstick printed there, and what the register published. */
export type LevelReading = {
  readonly level: string;
  /** The golden's figure at this level, exactly as the fixture PRINTS it. */
  readonly golden: string;
  /** The exact sum of the register's COMPLETE lines at this level. */
  readonly measured: string;
};

/** A level once graded. */
export type GradedLevel = LevelReading & { readonly verdict: ValidationVerdict };

/**
 * Half a unit in the last place a figure PRINTS — the finest the golden can be compared at, on
 * either side.
 *
 * A golden row is published rounded (`16.740`, never the exact figure the authored model computed),
 * so the takeoff L-QTY-06 names as the yardstick and the string the fixture stores differ by up to
 * half a unit of that last printed place. A delta smaller than the transcript's own typography
 * cannot be distinguished from the transcript's rounding, so it is not over-measurement; anything
 * beyond it still is, and B-07 forbids the other cure — the product's figures are never rounded to
 * the golden's precision to make a cell pass. The allowance is derived from the GOLDEN string alone,
 * never from the figure it is compared against (L-QTY-06). This is the reading the foundations band
 * already stands on.
 */
function printingAllowance(golden: string): string {
  const dot = golden.indexOf(".");
  const decimals = dot < 0 ? 0 : golden.length - dot - 1;
  return `5e-${decimals + 1}`;
}

/**
 * Grade one level against its golden: OVER above the printed figure plus its own half-unit, UNDER
 * below 0.97 × the golden, PASS between them (L-QTY-06).
 */
function gradeLevel(reading: LevelReading): ValidationVerdict {
  const measured = exact(reading.measured);
  const golden = exact(reading.golden);
  if (measured.gt(golden.add(exact(printingAllowance(reading.golden))))) return "OVER";
  if (measured.lt(golden.mul(exact(UNDER_TOLERANCE)))) return "UNDER";
  return "PASS";
}

/**
 * Grade one (class, kind) cell over every level it was measured at.
 *
 * The cell is OVER if ANY level is over, else UNDER if any is under, else PASS — "a class passing
 * only if its components pass (no netting)" read down to the level grain, which is the grain
 * V-GOLDEN takes the band at. A cell with no levels is graded PASS over nothing, and the caller is
 * the one that decides an empty cell is not gradable at all: an empty row set reconciles nothing
 * (L-QTY-06, "Ground truth is row sums"), so the band suites never hand one here.
 */
export function gradeCell(levels: readonly LevelReading[]): { verdict: ValidationVerdict; levels: GradedLevel[] } {
  const graded = levels.map((reading) => ({ ...reading, verdict: gradeLevel(reading) }));
  const verdict = graded.some((level) => level.verdict === "OVER") ? "OVER" : graded.some((level) => level.verdict === "UNDER") ? "UNDER" : "PASS";
  return { verdict, levels: graded };
}

/**
 * The instruments that produced a cell's lines, as one citation: the sha256 of the DISTINCT
 * `ruleId@ruleVersion` pairs, sorted by code point and joined by newlines.
 *
 * It hashes the methods that actually ran, not the methods a shard declares: a PASS is only evidence
 * while the thing it was proved under is still in force (R-TO-035), and what was in force for this
 * cell is what its own lines cite. A shard's manifest digest would move when a method the cell never
 * used was edited, and would not move when the cell's rail was re-pointed at another method.
 */
export function methodHashOf(lines: readonly { ruleId: string; ruleVersion: string }[]): string {
  const pairs = [...new Set(lines.map((line) => `${line.ruleId}@${line.ruleVersion}`))].sort();
  return createHash("sha256").update(pairs.join("\n"), "utf8").digest("hex");
}

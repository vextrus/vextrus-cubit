// The one reading of which levels a view's members stand on under a range a person proposes — asked
// by `AUTHOR_TYPICAL_RANGE` and answered by the expansion's own resolver (L-CAD-07, L-REG-04, I-303).
//
// WHY A PORT. The act seam is core, and core imports nothing above it (ARCH-01); the resolver is the
// partition module's. Until this existed the act answered the question itself — it re-did the band
// cut, kept a cross-view ownership rule of its own and never read a placement's note — so the rows it
// registered were a THIRD spelling of the expansion, and the rebuild that ran right after it could
// only report the difference as stale, never retract it (the register is append-only, 0029). A
// member a plan note named (C7, C5 on F-RCC6-BNBC) then stood on storeys no drawing put it on. So the
// question is declared here and answered there: the module that owns the one resolver registers the
// answer, and the act writes exactly the rows it is handed (B-17: one fact, one home).
//
// The answer is read on the act's own transaction, so the Consequence a person is shown and the rows
// the commit writes are computed from the state that write lands in (L-ACT-02).
//
// Held on the process rather than the module instance, for the reason the fault sink and the job
// handlers are (ARCH-02): a bundler that compiles this file into two graphs would otherwise leave the
// act asking an instance nobody registered into.
import type { TenantTx } from "../db";
import type { SightingStanding } from "../identity";

/** What the act asks: whose view, and the two ends a person proposes for it (by surrogate, L-REG-02). */
export type TypicalRangeQuestion = {
  readonly tenantId: string;
  readonly projectId: string;
  /** L-REG-04's view key — the view whose caption stated no range. */
  readonly viewKey: string;
  readonly fromLevelId: string;
  readonly toLevelId: string;
};

/** One row the resolver answers for a member of that view: the key, the level, and on what evidence. */
export type TypicalRangeRow = {
  /** The placement the row is a sighting of — the key a placeholder of it carries too (L-REG-04). */
  readonly placementKey: string;
  readonly objectKey: string;
  readonly levelId: string;
  readonly standing: SightingStanding;
};

/**
 * The reading: every level-class row the one resolver derives for the view's members with the proposed
 * range standing in place of any the view already has, on a live level each. A member the resolver
 * places on no level under that range answers no row.
 */
export type TypicalRangeReading = (tx: TenantTx, question: TypicalRangeQuestion) => Promise<readonly TypicalRangeRow[]>;

const READING_KEY = Symbol.for("vextrus.cubit.core.levels.typical-range-reading");

const readingScope = globalThis as typeof globalThis & { [READING_KEY]?: { current: TypicalRangeReading | null } };

const held: { current: TypicalRangeReading | null } = (readingScope[READING_KEY] ??= { current: null });

/** The fault's own name, so a caller and a test read it off the error rather than off its words. */
export const TYPICAL_RANGE_READING_UNREGISTERED = "TypicalRangeReadingUnregistered";

/**
 * A process that commits `AUTHOR_TYPICAL_RANGE` with nothing registered to answer it. That is a
 * composition defect of ours, never a fact about anybody's drawing, so it is a fault and not a refusal
 * (ARCH-03, B-21) — and it is thrown rather than answered with an empty reading, because an empty
 * reading would leave every placeholder standing with no word said.
 */
export function typicalRangeReadingUnregistered(): Error {
  const fault = new Error(
    "no typical-range reading is registered in this process — the expansion module registers the one resolver's answer when it loads, and a process that commits AUTHOR_TYPICAL_RANGE must load it first (L-CAD-07, ARCH-01)",
  );
  fault.name = TYPICAL_RANGE_READING_UNREGISTERED;
  return fault;
}

/**
 * Say which function answers the question, answering with the one replaced so a caller can always put
 * it back (the fault sink's own shape). Null takes the answer away.
 */
export function registerTypicalRangeReading(next: TypicalRangeReading | null): TypicalRangeReading | null {
  const previous = held.current;
  held.current = next;
  return previous;
}

/** The registered reading, or the named fault where this process registered none. */
export function typicalRangeReading(): TypicalRangeReading {
  const reading = held.current;
  if (reading === null) throw typicalRangeReadingUnregistered();
  return reading;
}

// R-TO-004's closed enums and the identity a sheet is named by, as values that touch no database.
// The `sheet_disciplines` CHECK is written from `DISCIPLINES` and the screen's filter chips are drawn
// from it, so the roster has one home and the column and the chip read the same list (ARCH-02, B-17).
//
// This file imports nothing: `src/core/db.ts` reads the roster to close its CHECK, and a leaf is what
// keeps that from being a cycle.

/**
 * R-TO-004's discipline roster, in the clause's own order. L-REG-03 makes discipline
 * "drawing-scoped, machine-proposed, human-confirmed", and this is the closed set both halves speak.
 */
export const DISCIPLINES = ["STRUCTURAL", "ARCHITECTURAL", "MEP", "CIVIL", "OTHER"] as const;

/** One discipline, drawn from the closed enum above. */
export type Discipline = (typeof DISCIPLINES)[number];

/**
 * R-TO-004's scale states. `affirmed` is carried by the type alone in this increment: AFFIRM_SCALE is
 * an act nobody has rendered yet, so no sheet reaches that state — a derived state and an affirmed
 * one are different claims, and the derivation never invents the second.
 */
export const SCALE_STATES = ["unaffirmed", "affirmed", "unplaceable"] as const;

/** One scale state, drawn from the closed enum above. */
export type ScaleState = (typeof SCALE_STATES)[number];

/**
 * Who judged a sheet's proposal. L-AI-03 prefers "a deterministic grammar where the text is vector",
 * so the grammar answers `GRAMMAR` where it read something and `NONE` where there was nothing to
 * read; the model leg that would add a third basis is not wired in this increment.
 */
export const PROPOSAL_BASES = ["GRAMMAR", "NONE"] as const;

/** One proposal basis, drawn from the closed enum above. */
export type ProposalBasis = (typeof PROPOSAL_BASES)[number];

/**
 * R-TO-001's fidelity counters, as the names a card shows them under. The roster is the set of
 * counters an ingest record carries — the per-layout stray count, the three per-space counters and
 * the record-level dropped layouts — so a card names every loss the extractor reported and no fact
 * the record does not hold.
 */
export const FIDELITY_FACTS = ["strays_rejected", "explode_truncated", "explode_losses", "flatten_capped", "dropped_layouts"] as const;

/** One fidelity fact's name, drawn from the roster above. */
export type FidelityFact = (typeof FIDELITY_FACTS)[number];

/** What the title-block grammar proposes for one sheet, with the entities it read it from. */
export type SheetProposal = {
  readonly number: string | null;
  readonly title: string;
  readonly discipline: Discipline;
  readonly basis: ProposalBasis;
  readonly cited: readonly string[];
};

/** What separates the record a sheet belongs to from the layout it is (`sheetIdOf`). */
const SHEET_ID_SEPARATOR = ":";

/**
 * A sheet's identity: the record it is a reading of, and the layout inside it. A sheet is not a
 * stored row — proposals are computed on read — so it is named by the two facts that decide it, and
 * a record superseded by a re-ingest yields different sheet ids rather than silently moving these.
 */
export function sheetIdOf(ingestId: string, layoutName: string): string {
  return `${ingestId}${SHEET_ID_SEPARATOR}${layoutName}`;
}

/**
 * The two facts back out of a sheet id, or null where the string names no sheet. The record id
 * carries no separator and a layout name may carry several, so the split is at the first one; a
 * caller writing anything else has named no sheet, which is an empty membership rather than an error.
 */
export function parseSheetId(sheetId: string): { ingestId: string; layoutName: string } | null {
  if (typeof sheetId !== "string") return null;
  const at = sheetId.indexOf(SHEET_ID_SEPARATOR);
  if (at <= 0 || at === sheetId.length - 1) return null;
  return { ingestId: sheetId.slice(0, at), layoutName: sheetId.slice(at + 1) };
}

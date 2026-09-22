// The seventh stage's stored rows, folded back into the ONE stack they propose — the `levels` of the
// `INSERT_LEVEL` a person confirms whole (L-MEA-07, R-UI-023). Pure over the rows the store answered,
// so the fold, and the refusal of a record that is not one stack, are proved without a store.
//
// A row is one MARK a level was read off (the store keys it so), and a storey its section states in
// two notations was read off two (D-001): the rows of one level are folded back into it, each citing
// its own mark as the reading it carries. That is no dedupe — no spelling is chosen, because the stage
// wrote every row of a level under the level's one label, in its one view, at its one ordinal. Which
// spelling of a storey stands has one home, the stage itself (B-17, `./propose`).
import type { ProposedLevel, ProposedReading } from "@/core/acts";
import { dotlessUpper } from "@/core/identity";

/** The facts of one stored row the fold reads — a stored row is free to carry more (C-05). */
export type OfferedRow = {
  readonly viewKey: string;
  readonly label: string;
  readonly ordinal: number;
  readonly heightAsWritten: string | null;
  readonly heightUnit: string | null;
  readonly markKey: string;
};

/**
 * The storey height one row states: the one the seventh stage READ, published as it stands
 * (L-REG-01, L-CAD-03).
 *
 * That stage states each height as the distance between two marks of ONE section and ONE notation,
 * adjacent in the one stack it proposes — and states none anywhere else. Re-deriving a height here
 * from the stack's own adjacency would answer the distance between two marks nobody measured
 * together: the views are drawn from their own datums, and a mark the label dedupe dropped leaves two
 * levels that were never neighbours standing next to each other. Committed, that is a `TRANSCRIBED`
 * reading of a figure nobody drew, under the basis that means it was read off the drawing (B-17).
 *
 * An empty list is the drawing's silence, never a zero somebody would have to disbelieve (B-07).
 */
function storeyHeightOf(row: OfferedRow): ProposedReading[] {
  if (row.heightAsWritten === null || row.heightUnit === null) return [];
  return [{ valueAsWritten: row.heightAsWritten, unitAsWritten: row.heightUnit, sourceKey: row.markKey }];
}

/** The stored rows grouped by the level their label names, in the order the store answered them. */
function foldedByLabel<R extends OfferedRow>(rows: readonly R[]): R[][] {
  const byLabel = new Map<string, R[]>();
  for (const row of rows) {
    const label = dotlessUpper(row.label);
    const held = byLabel.get(label);
    if (held === undefined) byLabel.set(label, [row]);
    else held.push(row);
  }
  return [...byLabel.values()];
}

/**
 * The levels one record's stored rows offer, in the order the store answered them (the run from the
 * foot up), or null where the rows are not one stack.
 *
 * A record partitioned BEFORE the stage read every section into one stack carries a stack per view:
 * the same storey proposed twice, at the ordinal each view gave it, which `INSERT_LEVEL` would take at
 * its word and author twice over (L-ACT-01 — a level is authored, never edited). Such rows are not
 * one stack and are not offered as one; the drawing is rebuilt, and the rebuild is what proposes a
 * stack a person can confirm (R-UI-050, L-MEA-07). One label's rows standing in two views, or at two
 * ordinals, are that record.
 *
 * The ordinal offered is the level's place in the one run: an ordinal is physical (L-MEA-07).
 */
export function offeredLevelsOf(rows: readonly OfferedRow[]): ProposedLevel[] | null {
  const levels = foldedByLabel(rows);
  if (levels.some((held) => new Set(held.map((row) => row.viewKey)).size !== 1 || new Set(held.map((row) => row.ordinal)).size !== 1)) return null;
  return levels.map((held, at) => ({
    label: (held[0] as OfferedRow).label,
    ordinal: at,
    readings: held.flatMap(storeyHeightOf),
  }));
}

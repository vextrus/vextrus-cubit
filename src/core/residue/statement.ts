// L-QTY-07's two statements, computed off the residue: the measurement boundary first and in full
// over the whole catalogue, then the bill boundary. Two separately titled enumerations, never a
// shared cause column and never a count — a certificate states what stands outside a boundary, and
// "how many" is not a boundary.
//
// They are computed here, in core, so the certificate M7 prints and the preview this milestone shows
// read the same rows through the same order (B-17, B-19).
import { compareCanonical } from "../identity";
import { IN_BILL, QUANTITY_BEARING, type ResidueCause, type ResidueCell, type StatementRow } from "./law";

/** The certificate's own order over a cell's three coordinates (L-QTY-07, L-REG-05). */
function inCertificateOrder(left: StatementRow, right: StatementRow): number {
  return (
    compareCanonical(left.kind, right.kind) ||
    compareCanonical(left.class ?? "", right.class ?? "") ||
    compareCanonical(left.levelLabel, right.levelLabel) ||
    compareCanonical(left.levelId ?? "", right.levelId ?? "")
  );
}

/** One cell, as a statement row states it — the cause it stands under, and nothing derived. */
function rowOf(cell: ResidueCell, cause: ResidueCause): StatementRow {
  return { kind: cell.kind, class: cell.class, levelId: cell.levelId, levelLabel: cell.levelLabel, grain: cell.grain, cause };
}

/**
 * The measurement boundary: every kind, class and level this campaign did not measure, with the
 * cause each stands unmeasured under. A cell whose declaration the published lines deny is omitted —
 * a certificate never prints a boundary the lines themselves contradict (I-192).
 */
export function measurementStatementOf(cells: readonly ResidueCell[]): StatementRow[] {
  return cells
    .filter((cell) => cell.measurement !== QUANTITY_BEARING && !cell.contradicted)
    .map((cell) => rowOf(cell, cell.measurement as ResidueCause))
    .sort(inCertificateOrder);
}

/** The bill boundary: every kind, class and level a person held out of this bill (R-TO-052). */
export function billStatementOf(cells: readonly ResidueCell[]): StatementRow[] {
  return cells
    .filter((cell) => cell.bill !== IN_BILL && !cell.contradicted)
    .map((cell) => rowOf(cell, cell.bill as ResidueCause))
    .sort(inCertificateOrder);
}

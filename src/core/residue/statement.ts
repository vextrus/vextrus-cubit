// L-QTY-07's two statements, computed off the residue: the measurement boundary first and in full
// over the whole catalogue, then the bill boundary. Two separately titled enumerations, never a
// shared cause column and never a count — a certificate states what stands outside a boundary, and
// "how many" is not a boundary.
//
// They are computed here, in core, so the certificate M7 prints and the preview this milestone shows
// read the same rows through the same order (B-17, B-19).
import { compareCanonical } from "../identity";
import { IN_BILL, QUANTITY_BEARING, type ResidueCause, type ResidueCell, type StatementRow } from "./law";

/** A row still carrying the level's place in the stack, which the printed row no longer needs. */
type Placed = StatementRow & { readonly ordinal: number | null };

/**
 * The certificate's own order over a cell's three coordinates (L-QTY-07, L-REG-05): the kind and the
 * class canonically, then the level by where it STANDS in the stack rather than by how its label
 * sorts — "L10" follows "L9" in a building and precedes it in an alphabet, and a statement is read
 * by someone walking up the storeys. A cell naming no level sorts above the levelled ones.
 */
function inCertificateOrder(left: Placed, right: Placed): number {
  return (
    compareCanonical(left.kind, right.kind) ||
    compareCanonical(left.class ?? "", right.class ?? "") ||
    (left.ordinal ?? Number.NEGATIVE_INFINITY) - (right.ordinal ?? Number.NEGATIVE_INFINITY) ||
    compareCanonical(left.levelId ?? "", right.levelId ?? "")
  );
}

/** One cell, as a statement row states it — the cause it stands under, and nothing derived. */
function rowOf(cell: ResidueCell, cause: ResidueCause): Placed {
  return {
    kind: cell.kind,
    class: cell.class,
    levelId: cell.levelId,
    levelLabel: cell.levelLabel,
    levels: cell.levelLabel,
    grain: cell.grain,
    cause,
    ordinal: cell.levelOrdinal,
  };
}

/** The en dash a run of levels is printed across — `first–last`, one line for the whole run. */
const RUN = "–";

/**
 * Whether the second row continues the first: the same kind, class and cause on the very next level
 * of the stack. A gap is a different line, because the level between them stands outside this
 * boundary and printing it inside the run would state something untrue (L-QTY-07).
 */
function continues(run: Placed, next: Placed, lastOrdinal: number | null): boolean {
  if (run.ordinal === null || next.ordinal === null || lastOrdinal === null) return false;
  return run.kind === next.kind && (run.class ?? "") === (next.class ?? "") && run.cause === next.cause && next.ordinal === lastOrdinal + 1;
}

/**
 * The enumeration a statement prints: the sorted rows, with every contiguous run of levels bearing
 * one cause folded into the single line that states it (L-QTY-07). The residue behind it is
 * untouched — `resolveResidue` still answers one cell per level, and this is only how it READS.
 */
function enumerated(rows: Placed[]): StatementRow[] {
  const printed: StatementRow[] = [];
  let open: Placed | null = null;
  let lastOrdinal: number | null = null;
  let lastLabel = "";

  const close = (): void => {
    if (open === null) return;
    printed.push({
      kind: open.kind,
      class: open.class,
      levelId: open.levelId,
      levelLabel: open.levelLabel,
      levels: open.levelLabel === lastLabel ? open.levelLabel : `${open.levelLabel}${RUN}${lastLabel}`,
      grain: open.grain,
      cause: open.cause,
    });
    open = null;
  };

  for (const row of rows.sort(inCertificateOrder)) {
    if (open !== null && continues(open, row, lastOrdinal)) {
      lastOrdinal = row.ordinal;
      lastLabel = row.levelLabel;
      continue;
    }
    close();
    open = row;
    lastOrdinal = row.ordinal;
    lastLabel = row.levelLabel;
  }
  close();
  return printed;
}

/**
 * The measurement boundary: every kind, class and level this campaign did not measure, with the
 * cause each stands unmeasured under.
 *
 * Two cells are left out. A cell whose declaration the published lines deny is omitted — a
 * certificate never prints a boundary the lines themselves contradict (I-192). And a cell a person
 * held out of THIS BILL is stated on the bill boundary instead: a boundary somebody drew is stated
 * once, on the axis they moved (I-198's rule, applied to the statements), because a cell printed on
 * both under two different causes is the shared cause column L-QTY-07 forbids in the only form the
 * two-statement shape still allows it.
 */
export function measurementStatementOf(cells: readonly ResidueCell[]): StatementRow[] {
  return enumerated(
    cells
      .filter((cell) => cell.measurement !== QUANTITY_BEARING && cell.bill === IN_BILL && !cell.contradicted)
      .map((cell) => rowOf(cell, cell.measurement as ResidueCause)),
  );
}

/** The bill boundary: every kind, class and level a person held out of this bill (R-TO-052). */
export function billStatementOf(cells: readonly ResidueCell[]): StatementRow[] {
  return enumerated(cells.filter((cell) => cell.bill !== IN_BILL && !cell.contradicted).map((cell) => rowOf(cell, cell.bill as ResidueCause)));
}

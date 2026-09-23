// L-QTY-07's two statements, computed off the residue: the measurement boundary first and in full
// over the whole catalogue, then the bill boundary. Two separately titled enumerations, never a
// shared cause column and never a count — a certificate states what stands outside a boundary, and
// "how many" is not a boundary.
//
// They are computed here, in core, so the certificate M7 prints and the preview this milestone shows
// read the same rows through the same order (B-17, B-19).
//
// The measurement boundary states three things (s-coverage I-480/c/e): every cell nothing
// was published for, under its cause AND the reason read beside it — so no row says that nothing
// explains an absence; every cell whose lines were published with no quantity, under the codes they
// left their components out by — so a cell of PARTIAL_DECLARED lines never passes as measured; and
// every member the drawings show that no class of the roster is — so a tank nothing can measure is
// still named as not measured.
import { REFUSALS } from "../errors";
import { compareCanonical } from "../identity";
import { IN_BILL, QUANTITY_BEARING, type PartialStatementRow, type ResidueCause, type ResidueCell, type StatementRow, type UnclassedDeclaration } from "./law";

/** A row still carrying the level's place in the stack, which the printed row no longer needs. */
type Placed = StatementRow & { readonly ordinal: number | null };

/** The three coordinates and the stack position every row of either enumeration is ordered by. */
type Orderable = { readonly kind: string; readonly class: string | null; readonly levelId: string | null; readonly ordinal: number | null };

/**
 * The certificate's own order over a cell's three coordinates (L-QTY-07, L-REG-05): the kind and the
 * class canonically, then the level by where it STANDS in the stack rather than by how its label
 * sorts — "L10" follows "L9" in a building and precedes it in an alphabet, and a statement is read
 * by someone walking up the storeys. A cell naming no level sorts above the levelled ones.
 */
function inCertificateOrder(left: Orderable, right: Orderable): number {
  return (
    compareCanonical(left.kind, right.kind) ||
    compareCanonical(left.class ?? "", right.class ?? "") ||
    (left.ordinal ?? Number.NEGATIVE_INFINITY) - (right.ordinal ?? Number.NEGATIVE_INFINITY) ||
    compareCanonical(left.levelId ?? "", right.levelId ?? "")
  );
}

/** One cell, as a statement row states it — the cause it stands under, the reason beside it, and nothing derived. */
function rowOf(cell: ResidueCell, cause: ResidueCause): Placed {
  return {
    kind: cell.kind,
    class: cell.class,
    levelId: cell.levelId,
    levelLabel: cell.levelLabel,
    levels: cell.levelLabel,
    grain: cell.grain,
    cause,
    // The reason stands beside the writerless fall-through and nowhere else: a row the bill statement
    // prints stands under the cause a PERSON gave it, and a reason beside that would be a second
    // cause column (L-QTY-07).
    reason: cause === cell.measurement ? (cell.reason ?? null) : null,
    views: cause === cell.measurement ? (cell.reasonViews ?? []) : [],
    levelSlot: cell.levelSlot ?? null,
    ordinal: cell.levelOrdinal,
  };
}

/** The en dash a run of levels is printed across — `first–last`, one line for the whole run. */
const RUN = "–";

/**
 * Whether the second row continues the first: the same kind, class, cause and reason on the very next
 * level of the stack. A gap is a different line, because the level between them stands outside this
 * boundary and printing it inside the run would state something untrue (L-QTY-07) — and so is a
 * different reason, because one line states one reason.
 */
function continues(run: Placed, next: Placed, lastOrdinal: number | null): boolean {
  if (run.ordinal === null || next.ordinal === null || lastOrdinal === null) return false;
  return (
    run.kind === next.kind &&
    (run.class ?? "") === (next.class ?? "") &&
    run.cause === next.cause &&
    (run.reason ?? null) === (next.reason ?? null) &&
    next.ordinal === lastOrdinal + 1
  );
}

/** Each distinct value once, in canonical order. */
function distinct(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCanonical);
}

/**
 * The enumeration a statement prints: the sorted rows, with every contiguous run of levels bearing
 * one cause folded into the single line that states it (L-QTY-07). The residue behind it is
 * untouched — `resolveResidue` still answers one cell per level, and this is only how it READS.
 */
function enumerated(rows: Placed[]): StatementRow[] {
  const printed: StatementRow[] = [];
  let open: Placed | null = null;
  let views: string[] = [];
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
      reason: open.reason ?? null,
      views: distinct(views),
      levelSlot: open.levelSlot ?? null,
    });
    open = null;
    views = [];
  };

  for (const row of rows.sort(inCertificateOrder)) {
    if (open !== null && continues(open, row, lastOrdinal)) {
      lastOrdinal = row.ordinal;
      lastLabel = row.levelLabel;
      views.push(...(row.views ?? []));
      continue;
    }
    close();
    open = row;
    views = [...(row.views ?? [])];
    lastOrdinal = row.ordinal;
    lastLabel = row.levelLabel;
  }
  close();
  return printed;
}

/**
 * The measurement boundary: every kind, class and level this campaign did not measure, with the
 * cause each stands unmeasured under and the reason read beside it.
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

/** A partial row still carrying its level's place in the stack and its omissions' key. */
type PlacedPartial = PartialStatementRow & { readonly ordinal: number | null; readonly key: string };

/**
 * The measurement boundary's second enumeration (s-coverage I-483): every cell that bears
 * published lines of which some were kept PARTIAL_DECLARED, with the codes they left components out
 * under — in the certificate's order, contiguous levels leaving the same components out folded into
 * one line, and never a count (L-QTY-07). A published cell is QUANTITY_BEARING on L-QTY-05's axis,
 * and stays so; what this states is what its lines themselves declared (L-QTY-02), which a boundary
 * that printed only unpublished cells let pass as measured.
 */
export function partialStatementOf(cells: readonly ResidueCell[]): PartialStatementRow[] {
  const rows: PlacedPartial[] = cells
    .filter((cell) => cell.grain === "CELL" && cell.measurement === QUANTITY_BEARING && (cell.partial ?? null) !== null)
    .map((cell) => {
      const omitted = (cell.partial?.omitted ?? []).map((omission) => omission.code);
      return {
        kind: cell.kind,
        class: cell.class,
        levelId: cell.levelId,
        levelLabel: cell.levelLabel,
        levels: cell.levelLabel,
        levelSlot: cell.levelSlot ?? null,
        omitted,
        ordinal: cell.levelOrdinal,
        key: omitted.join("\u0000"),
      };
    })
    .sort(inCertificateOrder);

  const printed: PartialStatementRow[] = [];
  let open: PlacedPartial | null = null;
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
      levelSlot: open.levelSlot,
      omitted: open.omitted,
    });
    open = null;
  };
  for (const row of rows) {
    const joins =
      open !== null &&
      open.ordinal !== null &&
      row.ordinal !== null &&
      lastOrdinal !== null &&
      open.kind === row.kind &&
      (open.class ?? "") === (row.class ?? "") &&
      open.key === row.key &&
      row.ordinal === lastOrdinal + 1;
    if (joins) {
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

/** One row of the measurement boundary's third enumeration: the member, and the reason it is named under. */
export type UnclassedStatementRow = UnclassedDeclaration & { readonly code: typeof MEMBER_UNCLASSED };

/** The registered reason a member no class measures is named under (I-481). */
const MEMBER_UNCLASSED = REFUSALS.COVERAGE_MEMBER_UNCLASSED.code;

/**
 * The measurement boundary's third enumeration (s-coverage I-481): every member the
 * drawings show that no class of the roster is, by the word that names it and the caption that
 * shows it — drawn, named, and never measured, in the word's canonical order, each under the one
 * registered reason such a member stands under.
 */
export function unclassedStatementOf(unclassed: readonly UnclassedDeclaration[]): UnclassedStatementRow[] {
  return [...unclassed]
    .sort((left, right) => compareCanonical(left.word, right.word) || compareCanonical(left.caption, right.caption))
    .map((member) => ({ ...member, code: MEMBER_UNCLASSED }));
}

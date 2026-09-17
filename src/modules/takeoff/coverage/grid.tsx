"use client";
// THE HEAT GRID (Design Direction 00 §3.5, Decision § 1): kinds × (class · level), as a real matrix.
//
// It was drawn in SVG, for two reasons that have both been answered. The first was that a cell
// carries two orthogonal readings at once (I-189) — it still does, and it still states both, on
// `data-measurement` and `data-bill`. The second was the focus mark (I-190): an SVG `<g>` hosts no
// pseudo-element, so `cx-reticle` could not reach a cell and the grid drew its own corner ticks. A
// DOM cell hosts one, so the grid wears the tree's ONE focus ring from its one home (B-17, R-UI-012)
// and the second dialect retires with the drawing.
//
// What the DOM buys, and what SVG could not: `position: sticky`. §3.5 fixes the kind column frozen
// and the class/level header frozen while the matrix scrolls horizontally INSIDE the grid and never
// the page (§7 C10) — three properties of a scroll container, none of them expressible in a viewBox.
// The hatch patterns of §4.3 are the same story: they are CSS gradients painted in `currentColor`
// (`--pattern-*`), so a cell that is a box can wear one and a cell that is a `<g>` cannot.
//
// Every measure below is the reader's own row height (`--row-h`, 28 compact / 36 comfortable) read
// in the stylesheet beside this file; a module may not reach the token table (ARCH-01), so this file
// states no size at all. Colour is the mark's (`data-mark`) and the fill is the ramp step
// (`data-cov`); the words are the registry's. Nothing on this grid is carried by colour alone.
import { useRef } from "react";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { cellRef, type CellGrain, type ResidueCell, type ResidueLevel, type TruncatedSheet } from "@/core/residue/law";
import { compareCanonical } from "@/core/identity";
import { BILL_AXIS, axisReadOf } from "./cited-act";
import { fillCoverageCopy, COVERAGE_COPY } from "./copy";
import { CauseGlyph, type GlyphReading } from "./glyphs";
import { MARK_OF, rampStep, rowShare, sharePublished, type Mark } from "./heat";

/** The density a reader set on the frame. It moves `--row-h`, which is the cell's whole geometry. */
export type CoverageDensity = "comfortable" | "compact";

/** One column of the grid: a class, and one level it was sighted on. */
type Column = { readonly klass: string; readonly levelId: string | null; readonly label: string };

/** One band of columns: every column of one class, so the class is named once above them. */
type Band = { readonly klass: string; readonly span: number };

/**
 * The registry read by a code that may not be one of its own — the two idle axis readings are
 * refusal-SHAPED and are not refusals (L-QTY-05), so the lookup answers `undefined` for them rather
 * than throwing the way the register's own total reader does. One home for that reading (B-17): the
 * grid, the key line and the inspector all take a cause's words through this function.
 */
export const causeWords = (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];

/**
 * The cause a cell is READ under, which is not always the cause it stands at (I-198). The two axes
 * are orthogonal and a cell may carry a reading on each, so the one a reader is answered with is the
 * axis a person moved: a cell held out of this bill is read under the bill's own cause, and every
 * other cell under its measurement cause. J-022 is this rule walked — the hold changes what the
 * inspector states while the measurement axis goes on saying what it always said (L-QTY-05).
 */
export function causeRead(cell: ResidueCell): string {
  return axisReadOf(cell) === BILL_AXIS ? cell.bill : cell.measurement;
}

/** The mark one cell wears — the mark of the cause it is READ under (§4.3, I-198). */
export function markOf(cell: ResidueCell): Mark {
  return MARK_OF[causeRead(cell) as GlyphReading];
}

/**
 * The whole reading of one cell, in words (Decision § 3): the kind, the class, the level and the
 * cause — never a code (I-195) — with the bill axis and a contradiction appended where they hold.
 */
export function cellLabel(cell: ResidueCell): string {
  const read = causeRead(cell);
  const cause = read === "QUANTITY_BEARING" ? COVERAGE_COPY.takeoff_coverage_cell_label_measured : (causeWords(read)?.message ?? read);
  const named =
    cell.grain === "KIND"
      ? fillCoverageCopy("takeoff_coverage_cell_label_kind_grain", { kind: cell.kind, cause })
      : fillCoverageCopy("takeoff_coverage_cell_label", { kind: cell.kind, class: cell.class ?? "", level: cell.levelLabel, cause });
  const held = cell.bill === "NOT_IN_THIS_BILL" ? ` ${COVERAGE_COPY.takeoff_coverage_cell_label_held}` : "";
  const beaten = cell.contradicted ? ` ${COVERAGE_COPY.takeoff_coverage_cell_label_contradicted}` : "";
  return `${named}${held}${beaten}`;
}

/**
 * The grid's columns and bands, derived from the cells themselves: a class holds a column for each
 * level it was sighted on, in the stack's own order, and the classes stand in canonical order.
 */
function columnsOf(cells: readonly ResidueCell[], levels: readonly ResidueLevel[]): { columns: Column[]; bands: Band[] } {
  const ordinalOf = new Map(levels.map((level) => [level.levelId, level.ordinal]));
  const labelOf = new Map(levels.map((level) => [level.levelId, level.label]));
  const byClass = new Map<string, (string | null)[]>();
  for (const cell of cells) {
    if (cell.grain !== "CELL" || cell.class === null) continue;
    const held = byClass.get(cell.class);
    if (held === undefined) byClass.set(cell.class, [cell.levelId]);
    else if (!held.includes(cell.levelId)) held.push(cell.levelId);
  }

  const columns: Column[] = [];
  const bands: Band[] = [];
  for (const klass of [...byClass.keys()].sort(compareCanonical)) {
    const levelIds = [...(byClass.get(klass) ?? [])].sort(
      (left, right) => (ordinalOf.get(left ?? "") ?? 0) - (ordinalOf.get(right ?? "") ?? 0) || compareCanonical(left ?? "", right ?? ""),
    );
    bands.push({ klass, span: levelIds.length });
    // A level the stack does not name — the two channels that sight a placement on a sheet answer
    // none — is a column all the same, and the cell's own label is what says so in words.
    for (const levelId of levelIds) columns.push({ klass, levelId, label: labelOf.get(levelId ?? "") ?? "" });
  }
  return { columns, bands };
}

/** One row of the grid: a kind, at one grain, and every cell it bears at that grain. */
type Row = { readonly key: string; readonly kind: string; readonly cells: readonly ResidueCell[] };

/**
 * The grid's rows, in reading order (I-196, Decision § 1): the KIND-grain rows first — a kind that
 * bears no cell is shown at the head of the grid rather than dropped from it — then the borne kinds,
 * each group in canonical order. The grain is part of a row's identity, so a kind that stands at both
 * grains gets a row at each rather than one row quietly holding two different claims.
 */
function rowsOf(cells: readonly ResidueCell[]): Row[] {
  const group = (grain: CellGrain): Row[] => {
    const borne = cells.filter((cell) => (grain === "KIND" ? cell.grain === "KIND" : cell.grain !== "KIND"));
    return [...new Set(borne.map((cell) => cell.kind))]
      .sort(compareCanonical)
      .map((kind) => ({ key: `${grain}:${kind}`, kind, cells: borne.filter((cell) => cell.kind === kind) }));
  };
  return [...group("KIND"), ...group("CELL")];
}

export type CoverageGridProps = {
  readonly cells: readonly ResidueCell[];
  readonly levels: readonly ResidueLevel[];
  /** The sheets read only in part, which is what makes a partial cell partial (§4.3). */
  readonly truncated: readonly TruncatedSheet[];
  readonly density: CoverageDensity;
  readonly selected: string | null;
  readonly onSelect: (address: string) => void;
};

/**
 * The grid itself: two sticky header rows, one sticky kind column, and one cell per cell of the
 * residue. The box scrolls; the page never does (§7 C10).
 */
export function CoverageGrid({ cells, levels, truncated, density, selected, onSelect }: CoverageGridProps) {
  const { columns, bands } = columnsOf(cells, levels);
  const rows = rowsOf(cells);

  // One tab stop, on the selected cell or on the first the grid holds (Decision § 1, R-UI-032).
  const tabStop = cells.find((cell) => cellRef(cell) === selected) ?? cells[0];
  const tabStopRef = tabStop === undefined ? null : cellRef(tabStop);

  // Arrowing moves FOCUS and never selection (Decision § 1), so the cells are held by address and
  // focused directly rather than found by a query the grid would have to spell a second selector for.
  const focusable = useRef(new Map<string, HTMLDivElement>());

  const move = (event: React.KeyboardEvent<HTMLDivElement>, cell: ResidueCell, at: number): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(cellRef(cell));
      return;
    }
    const row = rows[at]?.cells ?? [];
    const here = row.indexOf(cell);
    const step = (next: ResidueCell | undefined): void => {
      if (next === undefined) return;
      event.preventDefault();
      focusable.current.get(cellRef(next))?.focus();
    };
    if (event.key === "ArrowRight") step(row[here + 1]);
    else if (event.key === "ArrowLeft") step(row[here - 1]);
    else if (event.key === "Home") step(row[0]);
    else if (event.key === "End") step(row[row.length - 1]);
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const target = rows[at + (event.key === "ArrowDown" ? 1 : -1)]?.cells;
      if (target === undefined) return;
      step(target[Math.min(here, target.length - 1)]);
    }
  };

  // The one number the stylesheet cannot derive: how many level columns the matrix holds. It rides
  // as a custom property rather than as a width, so the CSS still owns every measure (ARCH-01).
  //
  // Floored at one: `repeat(0, …)` is invalid, and an invalid track list would take the whole grid
  // template down with it. A reading that bears only kind-grain rows — nothing sighted yet, which is
  // the `partial` state's own shape — then draws one empty track that its spanning row fills (I-196).
  const track = { "--cx-coverage-columns": String(Math.max(columns.length, 1)) } as React.CSSProperties;

  return (
    <div
      className="cx-coverage-grid"
      data-testid="coverage-grid"
      role="grid"
      // The matrix names itself. The `<h2>` it used to be labelled by existed only to BE that label —
      // a heading nobody wanted to read, and §1's "never a heading with a sentence under it" (I-190).
      aria-label={COVERAGE_COPY.takeoff_coverage_grid_label}
      aria-colcount={columns.length + 1}
      aria-rowcount={rows.length + 2}
      data-density={density}
      style={track}
    >
      <div className="cx-coverage-headers" role="rowgroup">
        <div className="cx-coverage-row cx-coverage-band" role="row">
          <div className="cx-coverage-corner" role="columnheader">
            {COVERAGE_COPY.takeoff_coverage_kind_column}
          </div>
          {bands.map((band) => (
            <div key={band.klass} className="cx-coverage-class" role="columnheader" data-class={band.klass} style={{ gridColumn: `span ${band.span}` }}>
              {band.klass}
            </div>
          ))}
        </div>
        <div className="cx-coverage-row cx-coverage-levels" role="row">
          <div className="cx-coverage-corner cx-coverage-corner-foot" role="columnheader" aria-label={COVERAGE_COPY.takeoff_coverage_level_label} />
          {columns.map((column) => (
            <div
              key={`${column.klass}:${column.levelId ?? ""}`}
              className="cx-coverage-level"
              role="columnheader"
              data-class={column.klass}
              data-level={column.levelId ?? ""}
              aria-label={fillCoverageCopy("takeoff_coverage_column_label", { class: column.klass, level: column.label })}
            >
              {column.label}
            </div>
          ))}
        </div>
      </div>

      <div className="cx-coverage-body-rows" role="rowgroup">
        {rows.map((row, at) => {
          const heat = rowShare(row.cells);
          return (
            <div key={row.key} className="cx-coverage-row" data-testid="coverage-kind-row" role="row" data-kind={row.kind}>
              <div
                className="cx-coverage-kind"
                role="rowheader"
                data-cov={rampStep(heat.share)}
                aria-label={`${row.kind} ${fillCoverageCopy("takeoff_coverage_kind_share", { count: String(heat.published), total: String(heat.total) })}`}
              >
                <span className="cx-coverage-kind-name">{row.kind}</span>
              </div>
              {row.cells.map((cell) => {
                const address = cellRef(cell);
                const read = causeRead(cell);
                const column = columns.findIndex((held) => held.klass === cell.class && held.levelId === cell.levelId);
                // A kind-grain row names no class and no level, so its one cell spans the matrix
                // (I-196); a cell whose column the header does not hold is placed by the flow.
                const placement =
                  cell.grain === "KIND" ? { gridColumn: "2 / -1" } : column < 0 ? undefined : { gridColumn: String(column + 2) };
                return (
                  <div
                    key={address}
                    ref={(node) => {
                      if (node === null) focusable.current.delete(address);
                      else focusable.current.set(address, node);
                    }}
                    className="cx-coverage-cell cx-reticle"
                    data-testid="coverage-cell"
                    role="gridcell"
                    data-kind={cell.kind}
                    data-class={cell.class ?? ""}
                    data-level={cell.levelId ?? ""}
                    data-grain={cell.grain}
                    data-measurement={cell.measurement}
                    data-bill={cell.bill}
                    data-contradicted={cell.contradicted ? "true" : "false"}
                    // I-198: the axes are orthogonal, but a reader is answered under ONE of them.
                    data-code={read}
                    // §4.3: a mark is a glyph AND a pattern AND a colour. The stylesheet reads this
                    // one attribute for the last two, and spells no colour of its own.
                    data-mark={markOf(cell)}
                    // …and the fill is the share published, on the ramp's own five steps.
                    data-cov={rampStep(sharePublished(cell, truncated))}
                    tabIndex={address === tabStopRef ? 0 : -1}
                    aria-selected={address === selected}
                    aria-label={cellLabel(cell)}
                    style={placement}
                    onClick={() => onSelect(address)}
                    onKeyDown={(event) => move(event, cell, at)}
                  >
                    <CauseGlyph reading={cell.measurement as GlyphReading} read={read === cell.measurement} />
                    {cell.bill === "NOT_IN_THIS_BILL" ? <CauseGlyph reading="NOT_IN_THIS_BILL" read={read === cell.bill} corner /> : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

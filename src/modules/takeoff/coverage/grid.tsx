"use client";
// The heat grid (Decision § 1): kind × class × level, drawn.
//
// It is drawn rather than tabled because a cell of this grid carries two orthogonal readings at once
// (I-189) and a focus mark the one CSS home cannot paint (I-190) — a table cell can hold neither
// without a second dialect of both. The geometry is stated here, in the units an SVG viewBox is
// measured in, because a module may not reach the token table (ARCH-01): each number below is the
// Decision § 1's own, and the two cell sides are the row heights R-UI-005 fixes.
//
// Colour is temperature and the mark is the cause (I-188). Nothing here is carried by colour alone:
// every cell states its whole reading in its accessible name, in words, and again in its mark.
import { useRef } from "react";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { cellRef, type ResidueCell, type ResidueLevel } from "@/core/residue";
import { compareCanonical } from "@/core/identity";
import { fillCoverageCopy, COVERAGE_COPY } from "./copy";
import { CauseGlyph, type GlyphReading } from "./glyphs";
import { CoverageReticle } from "./coverage-reticle";

/** The kind gutter's width and the bill mark's side — the Decision § 5's closed literal set. */
const GUTTER = 200;
const BILL_GLYPH = 8;
const SEAM = 1;
const HATCH_PITCH = 4;
const SELECTION_STROKE = 2;
const CONTRADICTION_STROKE = 1.5;
/** The centred mark fills half the cell, so it reads at either density (R-UI-005). */
const HALF = 2;

/** The hatch's one id: a `<defs>` pattern is referenced by name, so the name has one home (B-17). */
const HATCH_ID = "cx-coverage-hatch";

/** The heading the grid is labelled by, spelled once here and once where the heading is rendered. */
export const GRID_LABEL_ID = "cx-coverage-grid-label";

/** The density a reader set on the frame, which moves the grid itself rather than a padding. */
export type CoverageDensity = "comfortable" | "compact";

/**
 * The cell's side at each density: `--row-comfortable` and `--row-compact`'s own values (R-UI-005,
 * Decision § 1). Stated as numbers because a viewBox is measured in numbers and a custom property
 * cannot be one; the CSS beside this file paints nothing that depends on them.
 */
const CELL_SIDE: Readonly<Record<CoverageDensity, number>> = Object.freeze({ comfortable: 36, compact: 28 });

/** The break between two class bands — `var(--space-2)`'s own value (Decision § 1). */
const CLASS_GAP = 8;

/** One column of the grid: a class, and one level it was sighted on. */
type Column = { readonly klass: string; readonly levelId: string | null; readonly label: string; readonly x: number };

/** One band of columns: every column of one class, so the class is named once above them. */
type Band = { readonly klass: string; readonly x: number; readonly width: number };

/** The severity tint a cell is painted in — the registry's own reading of the cause (I-188). */
const SURFACES: Readonly<Record<RefusalEntry["severity"], string>> = Object.freeze({
  error: "var(--danger-surface)",
  warning: "var(--warn-surface)",
  info: "var(--info-surface)",
});

/** What a cell that bears published quantity is painted in — not a cause, so not in the map above. */
const MEASURED_SURFACE = "var(--success-surface)";

const entryOf = (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];

/** The tint one measurement reading paints its cell in. */
function surfaceOf(measurement: string): string {
  if (measurement === "QUANTITY_BEARING") return MEASURED_SURFACE;
  const held = entryOf(measurement);
  return held === undefined ? MEASURED_SURFACE : SURFACES[held.severity];
}

/**
 * The whole reading of one cell, in words (Decision § 3): the kind, the class, the level and the
 * cause — never a code (I-195) — with the bill axis and a contradiction appended where they hold.
 */
export function cellLabel(cell: ResidueCell): string {
  const cause = cell.measurement === "QUANTITY_BEARING" ? COVERAGE_COPY.takeoff_coverage_cell_label_measured : (entryOf(cell.measurement)?.message ?? cell.measurement);
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
 * level it was sighted on, in the stack's own order, and the classes stand in canonical order with a
 * break between them (Decision § 1).
 */
function columnsOf(cells: readonly ResidueCell[], levels: readonly ResidueLevel[], side: number): { columns: Column[]; bands: Band[]; width: number } {
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
  let x = GUTTER;
  for (const klass of [...byClass.keys()].sort(compareCanonical)) {
    const levelIds = [...(byClass.get(klass) ?? [])].sort(
      (left, right) => (ordinalOf.get(left ?? "") ?? 0) - (ordinalOf.get(right ?? "") ?? 0) || compareCanonical(left ?? "", right ?? ""),
    );
    bands.push({ klass, x, width: levelIds.length * side });
    for (const levelId of levelIds) {
      columns.push({ klass, levelId, label: labelOf.get(levelId ?? "") ?? "", x });
      x += side;
    }
    x += CLASS_GAP;
  }
  return { columns, bands, width: Math.max(x - CLASS_GAP, GUTTER) };
}

export type CoverageGridProps = {
  readonly cells: readonly ResidueCell[];
  readonly levels: readonly ResidueLevel[];
  readonly density: CoverageDensity;
  readonly selected: string | null;
  readonly onSelect: (address: string) => void;
};

/**
 * The grid itself. One `<g role="row">` per kind — the kind-grain rows first, because a kind that
 * bears no cell is shown rather than dropped (I-196) — and one `<g role="gridcell">` per cell of it.
 */
export function CoverageGrid({ cells, levels, density, selected, onSelect }: CoverageGridProps) {
  const side = CELL_SIDE[density];
  const { columns, bands, width } = columnsOf(cells, levels, side);
  const bandY = 0;
  const levelY = side;
  const bodyY = side * 2;

  const kinds: string[] = [];
  for (const cell of cells) if (!kinds.includes(cell.kind)) kinds.push(cell.kind);
  const rowY = new Map(kinds.map((kind, index) => [kind, bodyY + index * side]));
  const height = bodyY + kinds.length * side;

  // One tab stop, on the selected cell or on the first the grid holds (Decision § 1, R-UI-032).
  const tabStop = cells.find((cell) => cellRef(cell) === selected) ?? cells[0];
  const tabStopRef = tabStop === undefined ? null : cellRef(tabStop);

  // Arrowing moves FOCUS and never selection (Decision § 1), so the cells are held by address and
  // focused directly rather than found by a query the grid would have to spell a second selector for.
  const focusable = useRef(new Map<string, SVGGElement>());

  const move = (event: React.KeyboardEvent<SVGGElement>, cell: ResidueCell): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(cellRef(cell));
      return;
    }
    const row = cells.filter((held) => held.kind === cell.kind);
    const here = row.indexOf(cell);
    const rowIndex = kinds.indexOf(cell.kind);
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
      const nextKind = kinds[rowIndex + (event.key === "ArrowDown" ? 1 : -1)];
      if (nextKind === undefined) return;
      const target = cells.filter((held) => held.kind === nextKind);
      step(target[Math.min(here, target.length - 1)]);
    }
  };

  return (
    <svg
      className="cx-coverage-grid"
      data-testid="coverage-grid"
      role="grid"
      aria-labelledby={GRID_LABEL_ID}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
    >
      <defs>
        {/* I-189: the bill axis is a hatch over the whole cell, so the axes never displace each other. */}
        <pattern id={HATCH_ID} width={HATCH_PITCH} height={HATCH_PITCH} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={HATCH_PITCH} stroke="var(--graphite-500)" strokeWidth={SEAM} />
        </pattern>
      </defs>

      <g role="row" className="cx-coverage-band">
        {bands.map((band) => (
          <text key={band.klass} role="columnheader" className="cx-coverage-class" x={band.x} y={bandY + side / HALF} dominantBaseline="middle">
            {band.klass}
          </text>
        ))}
      </g>
      <g role="row" className="cx-coverage-levels">
        {columns.map((column) => (
          <text
            key={`${column.klass}:${column.levelId ?? ""}`}
            role="columnheader"
            className="cx-coverage-level"
            x={column.x + side / HALF}
            y={levelY + side / HALF}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {column.label}
          </text>
        ))}
      </g>

      {kinds.map((kind) => {
        const y = rowY.get(kind) ?? bodyY;
        return (
          <g key={kind} data-testid="coverage-kind-row" role="row" data-kind={kind}>
            <text className="cx-coverage-kind" x={0} y={y + side / HALF} dominantBaseline="middle">
              {kind}
            </text>
            {cells
              .filter((cell) => cell.kind === kind)
              .map((cell) => {
                const address = cellRef(cell);
                const column = columns.find((held) => held.klass === cell.class && held.levelId === cell.levelId);
                const x = cell.grain === "KIND" ? GUTTER : (column?.x ?? GUTTER);
                const span = cell.grain === "KIND" ? Math.max(width - GUTTER, side) : side;
                const active = address === selected;
                const glyph = side / HALF;
                return (
                  <g
                    key={address}
                    ref={(node) => {
                      if (node === null) focusable.current.delete(address);
                      else focusable.current.set(address, node);
                    }}
                    data-testid="coverage-cell"
                    role="gridcell"
                    data-kind={cell.kind}
                    data-class={cell.class ?? ""}
                    data-level={cell.levelId ?? ""}
                    data-grain={cell.grain}
                    data-measurement={cell.measurement}
                    data-bill={cell.bill}
                    data-contradicted={cell.contradicted ? "true" : "false"}
                    tabIndex={address === tabStopRef ? 0 : -1}
                    aria-selected={active}
                    aria-label={cellLabel(cell)}
                    onClick={() => onSelect(address)}
                    onKeyDown={(event) => move(event, cell)}
                  >
                    <rect x={x} y={y} width={span} height={side} fill={surfaceOf(cell.measurement)} stroke="var(--graphite-200)" strokeWidth={SEAM} />
                    {cell.bill === "NOT_IN_THIS_BILL" ? <rect x={x} y={y} width={span} height={side} fill={`url(#${HATCH_ID})`} /> : null}
                    {cell.contradicted ? (
                      <rect x={x} y={y} width={span} height={side} fill="none" stroke="var(--danger)" strokeWidth={CONTRADICTION_STROKE} />
                    ) : null}
                    {active ? <rect x={x} y={y} width={span} height={side} fill="none" stroke="var(--beam-500)" strokeWidth={SELECTION_STROKE} /> : null}
                    <CauseGlyph reading={cell.measurement as GlyphReading} x={x + span / HALF - glyph / HALF} y={y + side / HALF - glyph / HALF} size={glyph} />
                    {cell.bill === "NOT_IN_THIS_BILL" ? (
                      <CauseGlyph reading="NOT_IN_THIS_BILL" x={x + span - BILL_GLYPH - HATCH_PITCH} y={y + side - BILL_GLYPH - HATCH_PITCH} size={BILL_GLYPH} />
                    ) : null}
                    {active ? <CoverageReticle x={x} y={y} side={side} /> : null}
                  </g>
                );
              })}
          </g>
        );
      })}
    </svg>
  );
}

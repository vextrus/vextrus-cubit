// The cause marks (Decision § 1, I-188): one drawn mark per reading a cell may stand at, so what a
// cell says is carried by geometry and by its accessible name, never by colour alone (R-UI-060).
//
// The map is TOTAL over the readings a cell can hold — a reading without a mark is a compile error,
// which is the same shape of totality L-ACT-02 puts on the act map. `IN_BILL` is the one reading with
// no mark: a cell nobody held out says nothing about the bill axis, and drawing "nothing has
// happened" is a second mark to read.
//
// Every mark is drawn geometry on a 16 px viewBox at 1.5 px in `currentColor`, never a font
// character: a glyph that depends on a typeface is a glyph that disappears when the typeface does.
import type { BillCause, MeasurementReading } from "@/core/residue";

/** The marks' shared canvas: the Decision's own numbers (§ 5's closed literal set). */
const VIEW_BOX_SIDE = 16;
const VIEW_BOX = `0 0 ${VIEW_BOX_SIDE} ${VIEW_BOX_SIDE}`;
const CENTRE = 8;
const RADIUS = 4;
const STROKE = 1.5;

/** Every reading a mark is drawn for — the measurement axis' whole union, plus the bill axis' cause. */
export type GlyphReading = MeasurementReading | BillCause;

/** One mark, as the grid draws it inside a cell's own `<g>`. */
type Mark = () => React.ReactElement;

const ring = (dashed = false): React.ReactElement => (
  <circle cx={CENTRE} cy={CENTRE} r={RADIUS} fill="none" stroke="currentColor" strokeWidth={STROKE} strokeDasharray={dashed ? "2 2" : undefined} />
);

/**
 * The seven marks, keyed by the reading each states. Keyed by the union itself and by nothing wider,
 * which is what makes a reading with no mark a compile error rather than a blank cell.
 */
export const CAUSE_GLYPHS: Readonly<Record<GlyphReading, Mark>> = Object.freeze({
  // A published quantity is the one solid mark: the cell is full.
  QUANTITY_BEARING: () => <circle cx={CENTRE} cy={CENTRE} r={RADIUS} fill="currentColor" />,
  // Nothing explains the absence, so the mark is the plain outline — the ring the others vary from.
  NOT_ESTABLISHED: () => ring(),
  // Something was lost on the way in: the ring is broken, with a quarter missing at the upper right.
  INGESTION_TRUNCATED: () => (
    <path
      d={`M ${CENTRE + RADIUS} ${CENTRE} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTRE} ${CENTRE - RADIUS}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
    />
  ),
  // A person struck the cell out of the project: the ring, struck through corner to corner.
  NOT_IN_PROJECT_SCOPE: () => (
    <g>
      {ring()}
      <line x1={CENTRE - RADIUS} y1={CENTRE + RADIUS} x2={CENTRE + RADIUS} y2={CENTRE - RADIUS} stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </g>
  ),
  // No class the campaign sighted bears this kind: the ring is drawn, but only in part — dashed.
  NO_BEARER_SIGHTED: () => ring(true),
  // The catalogue holds the work item and nothing bears it yet: a row of dots, not yet a ring.
  KIND_NOT_YET_SEEDED: () => (
    <g fill="currentColor">
      <circle cx={CENTRE - RADIUS} cy={CENTRE} r={1} />
      <circle cx={CENTRE} cy={CENTRE} r={1} />
      <circle cx={CENTRE + RADIUS} cy={CENTRE} r={1} />
    </g>
  ),
  // A person held the cell out of THIS bill: the ring, crossed on the level — a line drawn under it.
  NOT_IN_THIS_BILL: () => (
    <g>
      {ring()}
      <line x1={CENTRE - RADIUS} y1={CENTRE} x2={CENTRE + RADIUS} y2={CENTRE} stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </g>
  ),
});

/**
 * One mark, drawn at a size and placed. The placement and the scale ride on the group the mark is
 * named by, so the geometry inside it is the mark itself and nothing else: one cause is drawn the
 * same way wherever it stands, at either density and at either of the two sizes a cell carries
 * (I-189, R-UI-005).
 */
export function CauseGlyph({ reading, x, y, size }: { reading: GlyphReading; x: number; y: number; size: number }) {
  const Mark = CAUSE_GLYPHS[reading];
  return (
    <g data-testid="coverage-cell-glyph" data-cause={reading} transform={`translate(${x} ${y}) scale(${size / VIEW_BOX_SIDE})`} aria-hidden="true" focusable="false">
      <Mark />
    </g>
  );
}

/** The same mark, standing on its own in the legend beside the words it means (I-195). */
export function LegendGlyph({ reading, size }: { reading: GlyphReading; size: number }) {
  const Mark = CAUSE_GLYPHS[reading];
  return (
    <svg className="cx-coverage-legend-mark" width={size} height={size} viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <Mark />
    </svg>
  );
}

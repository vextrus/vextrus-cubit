// I-190: the grid is drawn, so its focus reticle is drawn.
//
// `cx-reticle` renders through `::after`, and an SVG `<g>` hosts no pseudo-element — so the one CSS
// home cannot reach a cell of this grid. R-UI-012 offers a 2 px outline fallback for exactly this
// case, but SVG can express the corner ticks precisely, so the cell draws them: four corner marks at
// the law's own numbers, read from this one file rather than written at each corner.
//
// This is not a second dialect of the reticle. It is the same mark on the one surface the single CSS
// home cannot paint, and every number below is `cx-reticle`'s own.

/** The law's own numbers (core I-1's mandated class): a 2 px beam stroke, 8 px arms, 4 px outside. */
const BEAM = 2;
const ARM = 8;
const OFFSET = 4;

/**
 * The four corner ticks around one cell box. Drawn under the cell's own marks and hidden from the
 * accessibility tree: focus is stated by the browser's focus, and this only shows where it stands.
 */
export function CoverageReticle({ x, y, side }: { x: number; y: number; side: number }) {
  const left = x - OFFSET;
  const top = y - OFFSET;
  const right = x + side + OFFSET;
  const bottom = y + side + OFFSET;

  const corners = [
    `M ${left} ${top + ARM} L ${left} ${top} L ${left + ARM} ${top}`,
    `M ${right - ARM} ${top} L ${right} ${top} L ${right} ${top + ARM}`,
    `M ${right} ${bottom - ARM} L ${right} ${bottom} L ${right - ARM} ${bottom}`,
    `M ${left + ARM} ${bottom} L ${left} ${bottom} L ${left} ${bottom - ARM}`,
  ];

  return (
    <g className="cx-coverage-reticle" aria-hidden="true">
      {corners.map((path) => (
        <path key={path} d={path} fill="none" stroke="var(--beam-500)" strokeWidth={BEAM} strokeLinecap="square" />
      ))}
    </g>
  );
}

// The draft's paint (s-measure §2.3): one scene onto the measure canvas, in CSS pixels, over the sheet
// and the views overlay already drawn. Paint and nothing else — the canvas lies above the sheet with
// `pointer-events: none`, so nothing here can be reached by a pointer, and the points' test hooks are
// published by the region as data, never read off pixels.
//
// Every distinction is carried by LINE or SHAPE as well as hue (R-UI-060): an outline is solid, a
// cut-out dashed, the live segment a finer dash; a placed point wears its basis GLYPH (R-UI-002),
// handed in by the screen that holds the one glyph table. No colour is spelled here: each arrives
// resolved from a token by the region that reads the stage's computed style (R-UI-001, R-UI-086).
import type { PointBasis } from "./gesture";
import type { MeasureAt, MeasureScene } from "./scene";

/** What the paint is drawn with — every value read from a token, in the theme standing. */
export type MeasurePalette = {
  readonly measure: string;
  readonly paper: string;
  readonly basis: Readonly<Record<PointBasis, string>>;
  readonly glyphs: Readonly<Record<PointBasis, string>>;
  /** The face the glyphs and the segment lengths are set in, and its size in px. */
  readonly font: string;
  readonly glyphPx: number;
  readonly labelPx: number;
};

/** §2.3's weights and §7's closed px set: the outline and cut-outs at 2 px, the live segment at 1. */
const OUTLINE_PX = 2;
const LIVE_PX = 1;
const CUTOUT_DASH: readonly number[] = [6, 4];
const LIVE_DASH: readonly number[] = [4, 3];
/** The draft's fill, mixed at paint time from the measure token (§2.3: 12 %). */
const FILL_ALPHA = 0.12;
/** The halo a placed point's glyph wears, in the paper's own colour (§2.3: 1 px). */
const HALO_PX = 1;

function trace(context: CanvasRenderingContext2D, points: readonly MeasureAt[], closed: boolean): void {
  points.forEach((point, at) => (at === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
  if (closed) context.closePath();
}

/**
 * The whole scene: the fill (outline less cut-outs, even-odd so a cut-out is knocked out of it), each
 * ring, the live segment, each segment's length, and the placed points' glyphs on top.
 * `letter` spells a placed segment's length in the route's own words and figures (ARCH-01).
 */
export function drawMeasureScene(
  context: CanvasRenderingContext2D,
  scene: MeasureScene,
  palette: MeasurePalette,
  size: { width: number; height: number },
  letter?: (from: readonly [number, number], to: readonly [number, number]) => string | null,
): void {
  context.clearRect(0, 0, size.width, size.height);
  if (scene.rings.length === 0 && scene.points.length === 0) return;
  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";

  if (scene.fill !== null) {
    context.beginPath();
    trace(context, scene.fill.ring, true);
    for (const hole of scene.fill.holes) trace(context, hole, true);
    context.globalAlpha = FILL_ALPHA;
    context.fillStyle = palette.measure;
    context.fill("evenodd");
    context.globalAlpha = 1;
  }

  context.strokeStyle = palette.measure;
  for (const ring of scene.rings) {
    context.beginPath();
    context.lineWidth = OUTLINE_PX;
    context.setLineDash(ring.cutout ? [...CUTOUT_DASH] : []);
    trace(context, ring.points, ring.closed);
    context.stroke();
  }

  if (scene.live !== null) {
    context.beginPath();
    context.lineWidth = LIVE_PX;
    context.setLineDash([...LIVE_DASH]);
    context.moveTo(scene.live.from.x, scene.live.from.y);
    context.lineTo(scene.live.to.x, scene.live.to.y);
    context.stroke();
  }
  context.setLineDash([]);

  context.textAlign = "center";
  context.textBaseline = "middle";
  if (letter !== undefined) {
    context.font = `${palette.labelPx}px ${palette.font}`;
    for (const segment of scene.segments) {
      const words = letter(segment.from, segment.to);
      if (words === null) continue;
      context.lineWidth = HALO_PX * 3;
      context.strokeStyle = palette.paper;
      context.strokeText(words, segment.at.x, segment.at.y);
      context.fillStyle = palette.measure;
      context.fillText(words, segment.at.x, segment.at.y);
    }
  }

  context.font = `${palette.glyphPx}px ${palette.font}`;
  context.lineWidth = HALO_PX * 2;
  for (const point of scene.points) {
    const glyph = palette.glyphs[point.basis];
    context.strokeStyle = palette.paper;
    context.strokeText(glyph, point.at.x, point.at.y);
    context.fillStyle = palette.basis[point.basis];
    context.fillText(glyph, point.at.x, point.at.y);
  }
  context.restore();
}

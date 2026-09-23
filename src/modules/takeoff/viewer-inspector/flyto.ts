// R-UI-022's target half: where a reveal lands, and how the camera travels there. The Trace's one
// eased motion (Decision I-85) — every other camera write in this product is untweened.
//
// The camera itself is not re-derived here: a reveal is `fitCamera` over the padded box, so the
// framing a reveal gives and the framing the Fit control gives come from the same reading and cannot
// answer differently (B-17). Nothing here reads a token, a DOM or a clock: the duration is handed in,
// which is what lets reduced motion be a zero at source rather than a branch in this file.
import { fitCamera, type IndexBox } from "../viewer/client";
import { NOMINAL_FACE, letter } from "../viewer/lettering";
import type { Camera, RenderRecord } from "../viewer/types";

/**
 * How much sheet a reveal leaves around the selection, as a fraction of the box's larger extent — a
 * ratio, so it holds at any zoom. A selection pressed against both edges of the stage tells a reader
 * what they selected and nothing about where it was found (Decision § 5).
 */
const PAD_RATIO = 0.12;

/**
 * The extent a box of no extent at all is opened to, in drawing units. No token expresses a drawing
 * unit, so it is stated here as the world constant it is: a single point selected on its own is seen
 * with the sheet around it rather than through a needle (Decision § 5).
 */
const MIN_EXTENT = 1;

/** A cubic Bézier's two control points, as the `--ease-flyto` token spells them. */
export type EaseControls = readonly [number, number, number, number];

/** How near a solved Bézier parameter must be before the search stops. */
const EASE_EPSILON = 1e-5;

/** How many halvings the solver takes — 24 brackets a unit interval far below the epsilon above. */
const EASE_STEPS = 24;

/**
 * The cap height, in device-independent pixels, a text a reveal lands on is shown at — read without
 * leaning in, with the sheet around it (Decision I-464). A reveal of a note does not fill the
 * stage with its letters: it stops here, and the rest of the stage is the note's context.
 */
export const READING_TEXT_PX = 12;

/**
 * The most a reveal may zoom in on these records: where every one of them is text, the scale at which
 * the smallest stands `READING_TEXT_PX` tall, as it is lettered (`../viewer/lettering`). Null where
 * any of them is geometry, and nothing stops the fit: a selection that holds a member — the Trace's
 * own pair, a member's outline and its mark (I-421) — is framed by what it names exactly as it always
 * was, and only a selection of words alone is a note to be read on its sheet (I-464).
 */
export function readingScaleOf(records: readonly RenderRecord[]): number | null {
  let smallest = Number.POSITIVE_INFINITY;
  for (const record of records) {
    if (record.text === undefined) return null;
    const lettered = letter(record, NOMINAL_FACE);
    if (lettered !== null && lettered.height < smallest) smallest = lettered.height;
  }
  return Number.isFinite(smallest) && smallest > 0 ? READING_TEXT_PX / smallest : null;
}

/**
 * The camera a reveal leaves: looking at the centre of the box it was given, framed with room around
 * it, at a scale inside the camera's own band. A box with no extent is opened to `MIN_EXTENT` first,
 * so a fit over it answers a real scale rather than an infinity. Where the selection is text alone,
 * the frame zooms no closer than that text's reading size (`readingScaleOf`): a traced note is framed
 * as a note on its sheet, never as its own glyph box pressed against the stage (B08).
 */
export function revealCamera(box: IndexBox, viewportPx: { width: number; height: number }, readingScale: number | null = null): Camera {
  const spanX = Math.max(box.max[0] - box.min[0], 0);
  const spanY = Math.max(box.max[1] - box.min[1], 0);
  const largest = Math.max(spanX, spanY);
  const open = largest > 0 ? 0 : MIN_EXTENT / 2;
  const pad = (largest > 0 ? largest : MIN_EXTENT) * PAD_RATIO;
  const reach = open + pad;

  const fitted = fitCamera(
    {
      min: [box.min[0] - reach, box.min[1] - reach],
      max: [box.max[0] + reach, box.max[1] + reach],
    },
    viewportPx,
  );
  return readingScale !== null && readingScale > 0 && fitted.scale > readingScale ? { ...fitted, scale: readingScale } : fitted;
}

/** One axis of a cubic Bézier with its ends pinned at 0 and 1. */
function bezier(t: number, first: number, second: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t;
}

/**
 * The eased fraction of the travel at this fraction of its time. The curve is the one the screen
 * read out of `--ease-flyto`; with none stated the travel is linear, which is what a token that
 * could not be parsed leaves behind (Decision § 4). The parameter is found by bisection — a curve
 * is solved for x and read for y, and a monotonic x means halving always brackets it.
 */
function eased(fraction: number, ease: EaseControls | null): number {
  if (ease === null) return fraction;
  const [x1, y1, x2, y2] = ease;
  let low = 0;
  let high = 1;
  let at = fraction;
  for (let step = 0; step < EASE_STEPS; step += 1) {
    const x = bezier(at, x1, x2);
    if (Math.abs(x - fraction) <= EASE_EPSILON) break;
    if (x < fraction) low = at;
    else high = at;
    at = (low + high) / 2;
  }
  return bezier(at, y1, y2);
}

/**
 * The camera part-way through a reveal's travel. A zero duration is already there — reduced motion
 * zeroes `--motion-flyto` at source, so the first frame is the destination and no branch is needed —
 * and a frame that arrives late does not carry on past the end.
 *
 * The centre is walked straight and the scale geometrically: zooming is multiplicative, and a scale
 * walked straight would rush the near half of a long travel and crawl the far half.
 */
export function flyTo(from: Camera, to: Camera, elapsedMs: number, durationMs: number, ease: EaseControls | null = null): Camera {
  if (!(durationMs > 0) || !(elapsedMs < durationMs)) return to;
  const at = eased(Math.max(elapsedMs, 0) / durationMs, ease);
  return {
    centre: [from.centre[0] + (to.centre[0] - from.centre[0]) * at, from.centre[1] + (to.centre[1] - from.centre[1]) * at],
    scale: from.scale * Math.pow(to.scale / from.scale, at),
    viewport: to.viewport,
  };
}

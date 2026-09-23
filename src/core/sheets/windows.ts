// The windows a paper sheet opens onto model space, as the artifact inventories them (L-CAD-05) —
// the one reading of which viewports a reader looks through and which piece of model space each one
// frames. The viewer's projection paints through these windows and `./frames` says what a sheet SHOWS
// through them, so the two can never disagree about a sheet (B-17).
//
// Kept apart from `./frames` on purpose: this file imports nothing but the schema's types, so a
// browser bundle that paints a sheet carries none of the key grammar the Trace reads keys with.
import type { EntityGraph } from "../entitygraph/schema";

/** An axis-aligned box: `[minX, minY, maxX, maxY]`. */
export type Box = readonly [number, number, number, number];

/** One viewport record of a layout inventory, as the schema spells it. */
export type ViewportRecord = NonNullable<EntityGraph["layouts"][number]["viewports"]>[number];

/**
 * Whether a viewport is a window this reading looks through: switched on, untwisted, with a frame. A
 * twisted window would need a rotation no reader performs, and a window switched off shows nothing on
 * the plot either; both are left out rather than approximated.
 */
export function projectable(viewport: ViewportRecord): boolean {
  return (
    viewport.on &&
    viewport.twist === 0 &&
    viewport.view_height > 0 &&
    viewport.size[0] > 0 &&
    viewport.size[1] > 0 &&
    Number.isFinite(viewport.size[0]) &&
    Number.isFinite(viewport.size[1]) &&
    Number.isFinite(viewport.view_height)
  );
}

/**
 * The piece of model space a projectable window looks at. The artifact states the window as the
 * VIEWPORT does — its paper size, its view height and the model point it is centred on — and the one
 * derivation left to a consumer is the scale, `size[1] / view_height` (L-CAD-05).
 */
export function modelBoxOf(viewport: ViewportRecord): Box {
  const scale = viewport.size[1] / viewport.view_height;
  const halfWidth = viewport.size[0] / scale / 2;
  const halfHeight = viewport.view_height / 2;
  const [vx, vy] = viewport.view_centre;
  return [vx - halfWidth, vy - halfHeight, vx + halfWidth, vy + halfHeight];
}

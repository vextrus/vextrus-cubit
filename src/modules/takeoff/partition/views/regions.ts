// L-CAD-06's FRAMED regions: the pieces of model space a sheet's own windows title.
//
// A drawing sheet lays its views out in VIEWPORTS and titles each window with a text drawn on the
// paper beneath it — L-CAD-05's inventory is where those windows stand and what each of them looks
// at, and "a viewport frames what is drawn" is the whole of the reading. A drawing titled that way
// says nothing at all in model space over the plan it frames, so the caption competition beside
// this file — which reads model text and distance only — hands such a plan to whichever distant
// model caption happens to reach furthest across the sheet. That is how F-RCC6-BNBC's S-10 column
// layout, whole and framed, ended up inside COLUMN SCHEDULE.
//
// So a region is read instead: one window of one paper layout, the title its own sheet gives it,
// and the model box it frames. Every model-space entity standing inside that box belongs to that
// region's view — a membership PREDICATE, not a distance, because paper and model coordinates are
// incommensurable and a frame is already the drawing's own statement of what belongs together.
//
// Pure over the artifact, like the partitioning it serves. The windows are the shipped projection's
// (`projectable`/`windowOf`: one home for what a VIEWPORT means, B-17), the classification is the
// shipped grammar's, and nothing here invents a fact — the title is an original TEXT of the very
// paper layout the window is drawn on, quoted as the drawing wrote it.
import type { EntityGraph } from "@/core/entitygraph/schema";
import { projectable, windowOf, type Box } from "../../viewer/projection";
import { classifyCaption } from "./grammar";
import { VIEW_TYPE, partitionViewKey, type ViewType } from "./law";

/**
 * The smallest lettering, in the paper units the layout is plotted in, that a sheet titles a window
 * with. A plot-size fact rather than a share of anything on the sheet: a title is lettered to be
 * read at arm's length off a printed sheet, and what is drawn smaller than this in the band under a
 * frame is title-block furniture — a sheet name, a revision letter, a drawn-by note — which titles
 * nothing. Fixed rather than derived because the paper is a fixed size whatever the model's scale.
 */
const TITLE_MIN_HEIGHT = 3.5;

/**
 * How deep the band beneath a window's frame runs, in the same paper units: two title heights. A
 * window's title is drawn immediately under the frame it titles, so one title height would already
 * hold it and two leave room for the way a draughtsman actually spaces one. Deeper than this and
 * the band reaches into the NEXT window down the sheet and would read its title as this one's.
 *
 * The band has no horizontal padding at all: a title stands within the width of the frame it titles,
 * and a text beyond either edge of the frame belongs to whatever stands beside it.
 */
const TITLE_BAND_DEPTH = 8;

/** A point in the drawing's own plane. */
type Point = readonly [number, number];

/**
 * One model-space caption as the precedence below reads one: what it says, what the grammar read it
 * as, how tall it stands and where. Handed in rather than re-derived — `captionsAmong` beside this
 * file is the one reading of what counts as a model caption (B-17).
 */
export type RegionCaption = {
  readonly key: string;
  readonly text: string;
  readonly height: number;
  readonly at: Point;
  readonly type: ViewType;
  readonly reason: string | null;
};

/**
 * One framed region: the view a window opens, and the piece of model space that view is made of.
 *
 * `area` and `via` are not part of what the view IS — they are how two regions that overlap are
 * told apart deterministically, which L-REG-04 needs and which no DXF guarantees will never happen.
 */
export type Region = {
  readonly viewKey: string;
  readonly type: ViewType;
  readonly reason: string | null;
  readonly caption: string;
  readonly anchorKey: string;
  /** The piece of model space the window frames: `[minX, minY, maxX, maxY]`. */
  readonly model: Box;
  /** The frame's area in model units — the tighter of two overlapping frames is the closer reading. */
  readonly area: number;
  /** The VIEWPORT's own handle, which breaks a tie between two frames of equal area. */
  readonly via: string;
};

/**
 * Every region one artifact's paper layouts frame, in the drawing's own order: layout by layout,
 * window by window.
 *
 * A window earns a region only where something captions it (L-CAD-06: classification follows caption
 * grammar). The precedence is the drawing's own order of authority:
 *
 *  1. a TYPED model caption standing inside the window titles it — the draughtsman wrote the title
 *     into the drawing itself, and the frame only decides how far it carries. The tallest wins, then
 *     the higher up the sheet, then the lower source key. This is what keeps the keys of every view
 *     BNBC already reads unmoved, and keeps a schedule anchored on the model text its own bands are
 *     read down from (L-CAD-08);
 *  2. otherwise the window's TITLE on the paper, classified by the same grammar — including where
 *     the grammar reads it UNTYPED, which mints an honestly untyped view exactly as a lone untyped
 *     model caption does today. An unclassifiable caption TYPES nothing; it does not vanish, and the
 *     entities it frames are not residue;
 *  3. a window with neither titles nothing and frames no region. Its interior falls through to the
 *     caption competition, which is where an untitled piece of model space belonged all along.
 *
 * An UNTYPED model caption inside a region anchors nothing and is content of it — a bar mark, a
 * floor note — which is L-CAD-06 read at its word.
 */
export function regionsOf(graph: EntityGraph, captions: readonly RegionCaption[]): Region[] {
  const regions: Region[] = [];
  for (const layout of graph.layouts) {
    if (layout.kind === "model") continue;
    const texts = titleCandidatesOn(graph, layout.name);
    for (const viewport of layout.viewports ?? []) {
      if (!projectable(viewport)) continue;
      const window = windowOf(viewport);
      const region = regionOf(window.model, window.via, titleUnder(window.paper, texts), captions);
      if (region !== null) regions.push(region);
    }
  }
  return regions;
}

/**
 * The region a point stands in, or null where no frame shows it. A point inside exactly one frame
 * is that frame's; a point inside several belongs to the TIGHTEST frame that shows it — the closest
 * the sheet comes to saying "this one" — and where two are equally tight, to the lower viewport
 * handle, so the same artifact partitions the same way forever (L-REG-04).
 */
export function regionAt(at: Point | null, regions: readonly Region[]): Region | null {
  if (at === null) return null;
  let held: Region | null = null;
  for (const region of regions) {
    if (!inside(region.model, at)) continue;
    if (held === null || region.area < held.area || (region.area === held.area && region.via < held.via)) held = region;
  }
  return held;
}

/** What one window is titled, and by what — or nothing, where nothing captions it. */
function regionOf(model: Box, via: string, title: RegionTitle | null, captions: readonly RegionCaption[]): Region | null {
  const said = titledInModelSpace(model, captions);
  const frame = { model, area: (model[2] - model[0]) * (model[3] - model[1]), via };
  if (said !== null) return { viewKey: partitionViewKey(said.type, said.key), type: said.type, reason: said.reason, caption: said.text, anchorKey: said.key, ...frame };
  if (title === null) return null;
  const read = classifyCaption(title.text);
  return { viewKey: partitionViewKey(read.type, title.key), type: read.type, reason: read.reason, caption: title.text, anchorKey: title.key, ...frame };
}

/**
 * The typed model caption that titles this window: the tallest standing inside it, then the higher
 * up the drawing, then the lower source key. An UNTYPED one is not a candidate — it types nothing,
 * so it anchors nothing and is content of whatever frames it (L-CAD-06).
 */
function titledInModelSpace(model: Box, captions: readonly RegionCaption[]): RegionCaption | null {
  let held: RegionCaption | null = null;
  for (const caption of captions) {
    if (caption.type === VIEW_TYPE.UNTYPED || !inside(model, caption.at)) continue;
    if (held === null || caption.height > held.height || (caption.height === held.height && (caption.at[1] > held.at[1] || (caption.at[1] === held.at[1] && caption.key < held.key)))) {
      held = caption;
    }
  }
  return held;
}

/** One paper text that could title a window: what it says, where its first point stands, how tall. */
type RegionTitle = { readonly key: string; readonly text: string; readonly height: number; readonly at: Point };

/**
 * The texts of one paper layout that are large enough to title a window, in the artifact's order.
 *
 * Original entities only: a block attribute collects separately from the geometry its instance
 * painted (L-CAD-03), so a title block's SHEETTITLE is never a candidate however it is lettered —
 * the sheet's own name is not the name of any one window on it.
 */
function titleCandidatesOn(graph: EntityGraph, layoutName: string): RegionTitle[] {
  const found: RegionTitle[] = [];
  for (const entity of graph.entities) {
    if (entity.space !== layoutName) continue;
    const text = entity.text ?? "";
    const at = (entity.points ?? [])[0];
    if (text.trim() === "" || (entity.height ?? 0) < TITLE_MIN_HEIGHT || at === undefined) continue;
    found.push({ key: entity.key, text: text.trim(), height: entity.height ?? 0, at });
  }
  return found;
}

/**
 * The title of one window: the tallest candidate standing in the band under its paper frame, ties
 * to the lower source key. A sheet titles its windows at one size, so the taller of two texts in
 * the band is the title and the shorter is furniture that drifted into it.
 */
function titleUnder(paper: Box, texts: readonly RegionTitle[]): RegionTitle | null {
  let held: RegionTitle | null = null;
  for (const text of texts) {
    const [x, y] = text.at;
    if (x < paper[0] || x > paper[2] || y > paper[1] || y < paper[1] - TITLE_BAND_DEPTH) continue;
    if (held === null || text.height > held.height || (text.height === held.height && text.key < held.key)) held = text;
  }
  return held;
}

/** Whether a point stands in a box, edges included. */
function inside(box: Box, at: Point): boolean {
  return at[0] >= box[0] && at[0] <= box[2] && at[1] >= box[1] && at[1] <= box[3];
}

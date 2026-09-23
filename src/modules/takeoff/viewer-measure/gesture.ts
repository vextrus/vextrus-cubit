// R-UI-042's gesture grammar (s-measure I-372), whole, as a pure state machine: one grammar for Linear,
// Area and Count and for every later tool. No DOM, no camera, no clock and no sentence — the machine
// answers what the shape is now and a FACT about what happened (a note); the route says it in words
// (ARCH-01, I-151's split). Every input a hand or a keyboard can give lands on exactly one row of
// I-372's table, and the rows the table leaves unwritten are ruled here and in the Decision (I-499).
//
// The machine never snaps, never constrains and never measures: a point arrives already snapped (or
// free) with its basis and its source keys (I-387); Shift's constraint is the snapping region's
// (I-372: one home), and the figure is `./figure.ts`'s.
import { cutoutFits, ringEncloses, samePoint } from "./rings";

/** The three tools M4 arms (R-TO-040), in the tool row's order. */
export const MEASURE_TOOLS = ["linear", "area", "count"] as const;

/** One armed tool. */
export type MeasureTool = (typeof MEASURE_TOOLS)[number];

/** Is this value one of the armed tools — the reading the pointer, the keys and the row share? */
export function isMeasureTool(value: string): value is MeasureTool {
  return (MEASURE_TOOLS as readonly string[]).includes(value);
}

/**
 * The basis a placed point wears (I-387): MEASURED where it was snapped to vector geometry and sits
 * exactly where the snap met the drawing, ENTERED where it was placed free, INTERPRETED on raster.
 */
export type PointBasis = "MEASURED" | "ENTERED" | "INTERPRETED";

/** One placed point: where it stands, its basis, and the source keys a MEASURED point was met on. */
export type MeasurePoint = {
  readonly at: readonly [number, number];
  readonly basis: PointBasis;
  readonly sourceKeys: readonly string[];
};

/**
 * Where a shape stands in the grammar (I-372's columns, and `measure-draft[data-state]`):
 * - `idle` — nothing in progress;
 * - `drawing` — points placed on the outline, the run or the count;
 * - `closed` — finished, with its card open (S6's card; a tool with no card never enters it);
 * - `cutting` — a cut-out ring in progress inside a finished outline (Area);
 * - `draft` — finished, with no card open: the shape stays on the sheet, and nothing is committed.
 */
export type MeasurePhase = "idle" | "drawing" | "closed" | "cutting" | "draft";

/** The shape in progress: its outline (or run, or count), its finished cut-outs and the one being cut. */
export type MeasureDraft = {
  readonly phase: MeasurePhase;
  readonly outer: readonly MeasurePoint[];
  readonly cutouts: readonly (readonly MeasurePoint[])[];
  readonly cutting: readonly MeasurePoint[];
};

/** Nothing in progress. */
export const NO_DRAFT: MeasureDraft = Object.freeze({ phase: "idle", outer: Object.freeze([]), cutouts: Object.freeze([]), cutting: Object.freeze([]) });

/** What a gesture did, as a fact the route words (never a sentence here). */
export type GestureNote =
  | { readonly kind: "placed"; readonly index: number; readonly basis: PointBasis }
  | { readonly kind: "removed" }
  | { readonly kind: "finished" }
  | { readonly kind: "cutout-started" }
  | { readonly kind: "cutout-finished" }
  | { readonly kind: "cutout-discarded" }
  | { readonly kind: "cutout-outside" }
  | { readonly kind: "reopened" }
  | { readonly kind: "kept" }
  | { readonly kind: "discarded" }
  | { readonly kind: "card" }
  | { readonly kind: "finish-first" }
  | { readonly kind: "too-few"; readonly needs: number }
  | { readonly kind: "degenerate" }
  | { readonly kind: "repeated" }
  | { readonly kind: "leave" };

/** One input of I-372's table. */
export type GestureInput =
  /** A click, Space at the keyboard cursor, or a rectangle's corner: a point where the snap stands. */
  | { readonly kind: "point"; readonly point: MeasurePoint }
  /** Enter, or a double-click's second click. */
  | { readonly kind: "finish" }
  /** Backspace. */
  | { readonly kind: "undo" }
  | { readonly kind: "escape" }
  /** X, or the measure menu's Cut out. */
  | { readonly kind: "cutout" }
  /** A tool key (L, A, C, V, H) or a tool button: allowed only with nothing in progress. */
  | { readonly kind: "tool" };

/** What the machine is told about the tool it serves. */
export type GestureContext = {
  readonly tool: MeasureTool;
  /** Area only: each ring is a rectangle spanned by two opposite corners (§2.1, the M menu). */
  readonly rectangle: boolean;
  /** Whether finishing opens a card (S6: a condition picked and its card standing). */
  readonly card: boolean;
  /**
   * The point a rectangle's derived corner is — the drawing asked whether anything stands exactly
   * there (I-500). A corner nothing stands on is ENTERED.
   */
  readonly corner: (at: readonly [number, number]) => MeasurePoint;
};

/** One step of the grammar: the shape after the input, and what it did. */
export type GestureStep = { readonly draft: MeasureDraft; readonly note: GestureNote | null };

/** How many points each tool needs before it may be finished (I-372: Linear ≥ 2, Area ≥ 3, Count ≥ 1). */
function least(context: GestureContext): number {
  if (context.tool === "linear") return 2;
  if (context.tool === "count") return 1;
  return context.rectangle ? 2 : 3;
}

/** Is a shape in progress — anything a stray key or click must not cost the QS (I-372)? */
export function busy(draft: MeasureDraft): boolean {
  return draft.phase !== "idle";
}

/** Where a finished shape stands: before its card, or on the sheet as a draft. */
function finishedPhase(context: GestureContext): MeasurePhase {
  return context.card ? "closed" : "draft";
}

/** A rectangle's four corners from its two clicked ones: the two clicked keep their own basis. */
function rectangleOf(first: MeasurePoint, second: MeasurePoint, context: GestureContext): MeasurePoint[] {
  return [first, context.corner([second.at[0], first.at[1]]), second, context.corner([first.at[0], second.at[1]])];
}

const ats = (ring: readonly MeasurePoint[]): (readonly [number, number])[] => ring.map((point) => point.at);

/** The last point of the ring a point would join, or undefined where it would start one. */
function lastOf(draft: MeasureDraft): MeasurePoint | undefined {
  const ring = draft.phase === "cutting" ? draft.cutting : draft.outer;
  return ring[ring.length - 1];
}

/** A cut-out ring offered to the outline: closed and filed where it fits, refused by name where not. */
function closeCutout(draft: MeasureDraft, ring: readonly MeasurePoint[], context: GestureContext): GestureStep {
  if (!cutoutFits(ats(draft.outer), ats(ring), draft.cutouts.map(ats))) return { draft, note: { kind: "cutout-outside" } };
  return { draft: { ...draft, phase: finishedPhase(context), cutouts: [...draft.cutouts, ring], cutting: [] }, note: { kind: "cutout-finished" } };
}

/** A point placed, where the grammar lets one be placed. */
function place(draft: MeasureDraft, point: MeasurePoint, context: GestureContext): GestureStep {
  if (draft.phase === "closed" || draft.phase === "draft") return { draft, note: { kind: "finish-first" } };
  const last = lastOf(draft);
  // A point where the ring's last one stands adds no length and no area (I-499). A count is a set of
  // symbols, not a path: a point where ANY counted point already stands is that symbol counted again,
  // however many clicks ago it was counted — an over-count is a hard block, never a disclosure.
  const repeats = context.tool === "count" ? draft.outer.some((placed) => samePoint(placed.at, point.at)) : last !== undefined && samePoint(last.at, point.at);
  if (repeats) return { draft, note: { kind: "repeated" } };

  if (draft.phase === "cutting") {
    if (context.rectangle && draft.cutting.length === 1) {
      const first = draft.cutting[0] as MeasurePoint;
      if (first.at[0] === point.at[0] || first.at[1] === point.at[1]) return { draft, note: { kind: "degenerate" } };
      return closeCutout(draft, rectangleOf(first, point, context), context);
    }
    const cutting = [...draft.cutting, point];
    return { draft: { ...draft, cutting }, note: { kind: "placed", index: cutting.length, basis: point.basis } };
  }

  if (context.tool === "area" && context.rectangle && draft.outer.length === 1) {
    const first = draft.outer[0] as MeasurePoint;
    if (first.at[0] === point.at[0] || first.at[1] === point.at[1]) return { draft, note: { kind: "degenerate" } };
    // The second corner finishes a rectangle: there is nothing left to place (I-499).
    return { draft: { ...draft, phase: finishedPhase(context), outer: rectangleOf(first, point, context) }, note: { kind: "finished" } };
  }
  const outer = [...draft.outer, point];
  return { draft: { ...draft, phase: "drawing", outer }, note: { kind: "placed", index: outer.length, basis: point.basis } };
}

/** Enter or a double-click: finish what is in progress, where it has enough to be finished. */
function finish(draft: MeasureDraft, context: GestureContext): GestureStep {
  if (draft.phase === "draft") return context.card ? { draft: { ...draft, phase: "closed" }, note: { kind: "card" } } : { draft, note: null };
  if (draft.phase === "cutting") {
    if (draft.cutting.length < (context.rectangle ? 2 : 3)) return { draft, note: { kind: "too-few", needs: context.rectangle ? 2 : 3 } };
    return closeCutout(draft, draft.cutting, context);
  }
  if (draft.phase !== "drawing") return { draft, note: null };
  const needs = least(context);
  if (draft.outer.length < needs) return { draft, note: { kind: "too-few", needs } };
  // An outline must enclose something, once — the shape the door would refuse as degenerate is said
  // here, before anybody is asked to confirm it (MANUAL_GEOMETRY_DEGENERATE).
  if (context.tool === "area" && !ringEncloses(ats(draft.outer))) return { draft, note: { kind: "degenerate" } };
  return { draft: { ...draft, phase: finishedPhase(context) }, note: { kind: "finished" } };
}

/** Backspace: the last point goes; on a finished shape, the last thing closed opens again (I-372). */
function undo(draft: MeasureDraft): GestureStep {
  if (draft.phase === "drawing") {
    const outer = draft.outer.slice(0, -1);
    return { draft: outer.length === 0 ? NO_DRAFT : { ...draft, outer }, note: { kind: "removed" } };
  }
  if (draft.phase === "cutting") {
    // An empty cut-out ring gives the outline back; otherwise its last point goes (I-499).
    if (draft.cutting.length === 0) return { draft: { ...draft, phase: "draft" }, note: { kind: "cutout-discarded" } };
    return { draft: { ...draft, cutting: draft.cutting.slice(0, -1) }, note: { kind: "removed" } };
  }
  if (draft.phase === "draft") {
    // The last ring closed is the first re-opened: a cut-out before its outline (I-499).
    const last = draft.cutouts[draft.cutouts.length - 1];
    if (last !== undefined) return { draft: { ...draft, phase: "cutting", cutouts: draft.cutouts.slice(0, -1), cutting: last }, note: { kind: "reopened" } };
    return { draft: { ...draft, phase: "drawing" }, note: { kind: "reopened" } };
  }
  return { draft, note: null };
}

/** Escape: discard what is in progress, close the card, or leave the tool (I-372). */
function escape(draft: MeasureDraft): GestureStep {
  if (draft.phase === "idle") return { draft, note: { kind: "leave" } };
  if (draft.phase === "closed") return { draft: { ...draft, phase: "draft" }, note: { kind: "kept" } };
  // A stray Escape in a cut-out costs the cut-out, never the outline it is cut from (I-499).
  if (draft.phase === "cutting") return { draft: { ...draft, phase: "draft", cutting: [] }, note: { kind: "cutout-discarded" } };
  return { draft: NO_DRAFT, note: { kind: "discarded" } };
}

/** One input, one step of the grammar. Pure: the same shape and input always answer the same step. */
export function step(draft: MeasureDraft, input: GestureInput, context: GestureContext): GestureStep {
  switch (input.kind) {
    case "point":
      return place(draft, input.point, context);
    case "finish":
      return finish(draft, context);
    case "undo":
      return undo(draft);
    case "escape":
      return escape(draft);
    case "cutout":
      if (context.tool !== "area" || (draft.phase !== "closed" && draft.phase !== "draft")) return { draft, note: null };
      return { draft: { ...draft, phase: "cutting", cutting: [] }, note: { kind: "cutout-started" } };
    case "tool":
      // A tool key never discards a shape in progress: only Escape does, and it says so (I-372).
      return { draft, note: busy(draft) ? { kind: "finish-first" } : null };
  }
}

/** The point the next segment is constrained from (Shift, Ortho, Angle): the last point of the ring being drawn. */
export function anchorOf(draft: MeasureDraft, tool: MeasureTool): readonly [number, number] | null {
  if (tool === "count" || (draft.phase !== "drawing" && draft.phase !== "cutting")) return null;
  return lastOf(draft)?.at ?? null;
}

/** Every placed point of the shape, ring by ring, as `measure-point` publishes them. */
export function pointsOf(draft: MeasureDraft): { readonly ring: string; readonly index: number; readonly point: MeasurePoint }[] {
  const found = draft.outer.map((point, at) => ({ ring: "outer", index: at + 1, point }));
  draft.cutouts.forEach((ring, n) => ring.forEach((point, at) => found.push({ ring: `cutout-${n + 1}`, index: at + 1, point })));
  draft.cutting.forEach((point, at) => found.push({ ring: `cutout-${draft.cutouts.length + 1}`, index: at + 1, point }));
  return found;
}

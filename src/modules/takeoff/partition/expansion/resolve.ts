// L-CAD-07's level expansion, resolved: which levels each placed member stands on — the sixth stage
// of R-TO-030's stored partition.
//
// "Vertical classes (column, shear wall) expand per level at placement; foundation classes take the
// lawful-null level basis." What a view's members expand OVER is stated by one of two things, and by
// nothing else: a range a person authored for the view (`AUTHOR_TYPICAL_RANGE`), or the range its own
// caption states. A caption that states neither leaves its members in the UNRESOLVED slot and says so
// (`TYPICAL_RANGE_UNSTATED`); a range whose endpoint the live stack does not carry expands over
// nothing and says so (`LEVEL_RANGE_ENDPOINT_UNMAPPED`).
//
// Pure and order-independent: nothing here reads a store, a clock or a model, and both answers are
// returned in the key's own order — so the same placements, stack and authored ranges resolve to the
// same instance keys however they were handed in (L-REG-04, AC-8).
import { EXPANSION_DEFERRAL_REASONS, type ExpansionDeferralReason } from "@/core/errors";
import { instanceKey, SIGHTING_STANDINGS, viewKey as viewKeyOf, type LevelRef, type SightingStanding, type ViewRef } from "@/core/identity";
import { normaliseMark, parseFloorZone } from "../notation";
import { isFoundationClass, isVerticalClass } from "../placement/law";
import type { PlacementRow } from "../placement/detect";

/**
 * The two standings a resolved row stands at, read off the register's own roster (B-17). Risk note
 * (2): a typical plan is DRAWN once, at the first level of the range it states — the geometry of the
 * rows on that level was read off the drawing, and the rows on the levels above it are derived from
 * it. `standing` IS the geometry basis; there is no second column for it.
 */
const MEASURED: SightingStanding = SIGHTING_STANDINGS[0];
const DERIVED: SightingStanding = SIGHTING_STANDINGS[1];

/** The two reasons this stage defers under, read off the closed taxonomy rather than spelled (Q-07). */
const [TYPICAL_RANGE_UNSTATED, LEVEL_RANGE_ENDPOINT_UNMAPPED] = EXPANSION_DEFERRAL_REASONS;

/** The lawful-null slot a foundation member stands in, and the one an unstated range leaves (L-REG-04). */
const FOUNDATION: LevelRef = { slot: "FOUNDATION" };
const UNRESOLVED: LevelRef = { slot: "UNRESOLVED" };

/** One level of the live stack, as the resolver reads one: never by label alone (L-REG-02). */
export type StackedLevel = {
  readonly levelId: string;
  readonly label: string;
  readonly ordinal: number;
};

/** One range a person authored for a view, by the surrogates its two ends name (L-CAD-07, L-ACT-01). */
export type AuthoredRange = {
  readonly viewKey: string;
  readonly fromLevelId: string;
  readonly toLevelId: string;
};

/**
 * One view the placements were read in, with the caption whose words may state its range. The view
 * is named by the reference a key is derived from and never by a spelling handed in: a placement and
 * its view agree on one key because both derive it, here, from the same reference (L-REG-04, B-17).
 */
export type ExpandedView = {
  readonly caption: string;
  readonly view: ViewRef;
};

/** What the stage is handed: what was placed, what the stack holds, and what a person authored. */
export type ExpansionEvidence = {
  readonly placements: readonly PlacementRow[];
  readonly views: readonly ExpandedView[];
  /** The project's LIVE level stack, in whatever order — the resolver orders it itself (AC-8). */
  readonly levels: readonly StackedLevel[];
  readonly ranges: readonly AuthoredRange[];
};

/** One instance row the expansion resolves to: where the member stands, and on what evidence. */
export type ExpansionRow = {
  readonly objectKey: string;
  readonly placement: PlacementRow;
  readonly level: LevelRef;
  readonly standing: SightingStanding;
};

/** One view whose vertical members stand on no level, and why (L-CAD-07, Q-07). */
export type ExpansionDeferral = {
  readonly viewKey: string;
  readonly reason: ExpansionDeferralReason;
  /** The two ends the caption STATED, where it stated any — null where it stated none (B-07). */
  readonly fromLabel: string | null;
  readonly toLabel: string | null;
};

/** What one artifact's expansion resolved to, in the key's own order (L-REG-04). */
export type ResolvedExpansion = {
  readonly rows: readonly ExpansionRow[];
  readonly deferrals: readonly ExpansionDeferral[];
};

/**
 * The range a caption states, as this stage reads one. Three answers and no fourth: two or more level
 * words is a range from the first to the last, exactly one is a single-level plan, and none is a plan
 * that states no level at all — which is what a bare `TYPICAL FLOOR PLAN` is.
 */
export type CaptionRange =
  | { readonly kind: "range"; readonly from: string; readonly to: string }
  | { readonly kind: "single"; readonly label: string }
  | { readonly kind: "unstated" };

/** What separates the words of a caption: everything that is not a letter or a digit. */
const CAPTION_WORDS = /[^A-Za-z0-9]+/;

/**
 * The level words a caption says, in the order it says them. Each word is put to the notation's own
 * floor-zone reading (B-17: one home) — `1ST`, `GF`, `ROOF` name levels; `TYPICAL`, `FLOOR`, `PLAN`
 * and `TO` name none — so a caption's range is read by the same grammar a schedule's column header is.
 */
function levelWordsOf(caption: string): string[] {
  const said: string[] = [];
  for (const word of caption.split(CAPTION_WORDS)) {
    if (word === "") continue;
    const band = parseFloorZone(word);
    // A single word reads as a band of one level, or as no level at all; a word that read as a band
    // of two would be a separator this split already dropped.
    if (band === null || band.from !== band.to) continue;
    said.push(band.from);
  }
  return said;
}

/**
 * The range a view's caption states (L-CAD-07: "typical ranges from captions"). A caption naming the
 * levels `1ST … 6TH` states the range between them whatever words stand around them, and a caption
 * naming none states nothing — which is the state `AUTHOR_TYPICAL_RANGE` exists to settle.
 */
export function typicalRangeOf(caption: string): CaptionRange {
  const words = levelWordsOf(caption);
  const first = words[0];
  const last = words[words.length - 1];
  if (first === undefined || last === undefined) return { kind: "unstated" };
  if (words.length === 1) return { kind: "single", label: first };
  return { kind: "range", from: first, to: last };
}

/** Code-point order, so one resolution lists one answer one way (L-REG-04, AC-8). */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** The live level a label names, or null where the stack carries none — labels compare normalised. */
function levelLabelled(levels: readonly StackedLevel[], label: string): StackedLevel | null {
  const wanted = normaliseMark(label);
  const found = levels.filter((level) => normaliseMark(level.label) === wanted);
  // Ties go to the lower ordinal, so one stack answers one way however it was handed in (AC-8).
  return found.sort((left, right) => left.ordinal - right.ordinal || byCodePoint(left.levelId, right.levelId))[0] ?? null;
}

/** The live level a surrogate names, or null where no live level carries it (L-REG-02). */
function levelSurrogate(levels: readonly StackedLevel[], levelId: string): StackedLevel | null {
  return levels.find((level) => level.levelId === levelId) ?? null;
}

/** What a view's vertical members expand over, once the authored range and the caption are read. */
type Span =
  | { readonly kind: "levels"; readonly drawn: StackedLevel; readonly levels: readonly StackedLevel[] }
  | { readonly kind: "unregistered"; readonly label: string }
  | { readonly kind: "deferred"; readonly reason: ExpansionDeferralReason; readonly fromLabel: string | null; readonly toLabel: string | null };

/**
 * Every live level standing between the two ends of a range, inclusive — the range is physical, so it
 * is read off the ordinals and never off the labels (L-MEA-07, L-REG-02). The DRAWN level is the end
 * the range runs FROM: a typical plan is drawn once, at the storey its caption starts at (risk note 2).
 */
function spanBetween(levels: readonly StackedLevel[], from: StackedLevel, to: StackedLevel): Span {
  const low = Math.min(from.ordinal, to.ordinal);
  const high = Math.max(from.ordinal, to.ordinal);
  const within = levels.filter((level) => level.ordinal >= low && level.ordinal <= high);
  return { kind: "levels", drawn: from, levels: within };
}

/** What one view's vertical members expand over: the authored range first, then the caption's own. */
function spanOf(view: ExpandedView, viewKey: string, evidence: ExpansionEvidence): Span {
  // A person's statement about a view outranks the caption's silence AND its words: the act is what
  // `TYPICAL_RANGE_UNSTATED` exists to be settled by, and a rebuild reads it (L-ACT-01, L-CAD-07).
  const authored = evidence.ranges.find((range) => range.viewKey === viewKey);
  if (authored !== undefined) {
    const from = levelSurrogate(evidence.levels, authored.fromLevelId);
    const to = levelSurrogate(evidence.levels, authored.toLevelId);
    if (from === null || to === null) {
      return { kind: "deferred", reason: LEVEL_RANGE_ENDPOINT_UNMAPPED, fromLabel: from?.label ?? null, toLabel: to?.label ?? null };
    }
    return spanBetween(evidence.levels, from, to);
  }

  const stated = typicalRangeOf(view.caption);
  if (stated.kind === "unstated") return { kind: "deferred", reason: TYPICAL_RANGE_UNSTATED, fromLabel: null, toLabel: null };
  if (stated.kind === "single") {
    const only = levelLabelled(evidence.levels, stated.label);
    // A caption naming ONE level nobody has authored is not a deferral: the drawing said which level,
    // and the placeholder carries onto the surrogate the moment somebody authors it (L-REG-04's
    // one-hop carry). A range is different — an unmapped endpoint leaves nothing to expand over.
    return only === null ? { kind: "unregistered", label: stated.label } : { kind: "levels", drawn: only, levels: [only] };
  }
  const from = levelLabelled(evidence.levels, stated.from);
  const to = levelLabelled(evidence.levels, stated.to);
  if (from === null || to === null) {
    return { kind: "deferred", reason: LEVEL_RANGE_ENDPOINT_UNMAPPED, fromLabel: stated.from, toLabel: stated.to };
  }
  return spanBetween(evidence.levels, from, to);
}

/**
 * Whether a deferred view's members stand in the UNRESOLVED slot or stand nowhere at all. The two
 * reasons are not one state (L-CAD-07): a caption that states NO range has been read whole — every
 * member on it was drawn, and what is unknown is only which storey, which is exactly the placeholder
 * `AUTHOR_TYPICAL_RANGE` retires. A caption that states a range the stack cannot carry has not been
 * read at all: the levels it names do not exist yet, so there is nothing for a member to stand on and
 * no placeholder to retire — the remedy is INSERT_LEVEL, after which the rebuild registers all N.
 */
function standsUnresolved(reason: ExpansionDeferralReason): boolean {
  return reason === TYPICAL_RANGE_UNSTATED;
}

/** The rows one vertical member stands on, over the span its view resolved to. */
function verticalRows(placement: PlacementRow, span: Span): ExpansionRow[] {
  if (span.kind === "deferred") return standsUnresolved(span.reason) ? [rowOn(placement, UNRESOLVED, MEASURED)] : [];
  if (span.kind === "unregistered") return [rowOn(placement, { unregistered: span.label }, MEASURED)];
  return span.levels.map((level) => rowOn(placement, { levelId: level.levelId }, level.levelId === span.drawn.levelId ? MEASURED : DERIVED));
}

/** One instance row, keyed by the grammar and by nothing this file spells itself (L-REG-04, B-17). */
function rowOn(placement: PlacementRow, level: LevelRef, standing: SightingStanding): ExpansionRow {
  const objectKey = instanceKey({
    placement: { view: placement.view, mark: placement.mark, x: placement.x, y: placement.y },
    level,
  });
  return { objectKey, placement, level, standing };
}

/**
 * The instance rows one artifact's placements expand to, and the views that expanded over nothing
 * (L-CAD-07). Total over any evidence: a view with no placements contributes nothing and defers
 * nothing, because a deferral nobody's member stands under says nothing about the drawing.
 */
export function resolveExpansion(evidence: ExpansionEvidence): ResolvedExpansion {
  const byView = new Map<string, PlacementRow[]>();
  for (const placement of evidence.placements) {
    const held = byView.get(placement.viewKey);
    if (held === undefined) byView.set(placement.viewKey, [placement]);
    else held.push(placement);
  }

  const rows: ExpansionRow[] = [];
  const deferrals: ExpansionDeferral[] = [];

  for (const view of evidence.views) {
    const key = viewKeyOf(view.view);
    const placed = byView.get(key) ?? [];
    if (placed.length === 0) continue;

    // Foundation classes take the lawful-null level basis whatever the caption says: a footing stands
    // under the building rather than on a storey of it (L-CAD-07, L-REG-04).
    const foundations = placed.filter((placement) => isFoundationClass(placement.elementType));
    for (const placement of foundations) rows.push(rowOn(placement, FOUNDATION, MEASURED));

    const verticals = placed.filter((placement) => isVerticalClass(placement.elementType));
    if (verticals.length === 0) continue;

    const span = spanOf(view, key, evidence);
    for (const placement of verticals) rows.push(...verticalRows(placement, span));
    // A deferral is a statement about members that stand nowhere: it is recorded because this view
    // HAS vertical members, and a view whose only members are foundations defers nothing.
    if (span.kind === "deferred") deferrals.push({ viewKey: key, reason: span.reason, fromLabel: span.fromLabel, toLabel: span.toLabel });
  }

  return {
    rows: [...rows].sort((left, right) => byCodePoint(left.objectKey, right.objectKey)),
    deferrals: [...deferrals].sort((left, right) => byCodePoint(left.viewKey, right.viewKey)),
  };
}

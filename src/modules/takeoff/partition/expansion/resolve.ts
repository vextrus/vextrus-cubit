// L-CAD-07's level expansion, resolved: which levels each placed member stands on — the sixth stage
// of R-TO-030's stored partition.
//
// "Vertical classes (column, shear wall) expand per level at placement; foundation classes take the
// lawful-null level basis." What a view's members expand OVER is stated by one of two things, and by
// nothing else: a range a person authored for the view (`AUTHOR_TYPICAL_RANGE`), or the storeys its
// own caption states — a range where it wrote one, a list where it listed them, and never the storeys
// between two it listed (I-409). A caption that states neither leaves its members in the
// UNRESOLVED slot and says so (`TYPICAL_RANGE_UNSTATED`); a statement one of whose storeys the live
// stack does not carry expands over nothing and says so (`LEVEL_RANGE_ENDPOINT_UNMAPPED`).
//
// What a view states is then CUT, twice, and by nothing else: by the band the member's own mark is
// scheduled under (L-FRM-02), and by the note the plan wrote against that mark (I-303 — a member a
// note names is not one of the plan's typical, and stands on the level the plan draws or over the
// range its own note states). Both are intersections of the view's span, so neither can place a
// member on a storey the plan does not reach and their order is not a question.
//
// And one CONTINUATION, made after both cuts and of verticals alone: a vertical whose lowest storey
// is the ground storey stands on the foundation neck beneath it too, where a person has entered one
// (I-338) — the member continued down to what it stands on, DERIVED, never a storey the plan drew.
//
// Pure and order-independent: nothing here reads a store, a clock or a model, and both answers are
// returned in the key's own order — so the same placements, stack and authored ranges resolve to the
// same instance keys however they were handed in (L-REG-04, AC-8).
import { EXPANSION_DEFERRAL_REASONS, type ExpansionDeferralReason } from "@/core/errors";
import { carryLevel, instanceKey, levelSegment, SIGHTING_STANDINGS, viewKey as viewKeyOf, type LevelRef, type SightingStanding, type ViewRef } from "@/core/identity";
import { bandCovers, bandJudgeable, bandOpen, foundationNeckOf, type BandStatement } from "@/core/offers/contract";
import { sameStorey } from "../notation";
import { isFoundationClass, isLevelClass, isVerticalClass, levelRunsOf, TOP_FLOOR, TOP_FLOOR_BENEATH, type LevelRun } from "../placement/law";
import type { PlacementRow } from "../placement/rows";

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

/**
 * One mark family's banding, as this stage reads one: the level bands its schedule states for it. A
 * family whose schedule stated no band at all states one band with two null ends, which covers every
 * level — that is what an unbanded row says (L-FRM-02).
 */
export type FamilyBands = {
  readonly family: string;
  readonly bands: readonly { readonly from: string | null; readonly to: string | null }[];
};

/** What the stage is handed: what was placed, what the stack holds, and what a person authored. */
export type ExpansionEvidence = {
  readonly placements: readonly PlacementRow[];
  readonly views: readonly ExpandedView[];
  /** The project's LIVE level stack, in whatever order — the resolver orders it itself (AC-8). */
  readonly levels: readonly StackedLevel[];
  readonly ranges: readonly AuthoredRange[];
  /** The bands the record's schedules state per mark family (R-TO-031); empty where none were read. */
  readonly families?: readonly FamilyBands[];
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
  /**
   * The two ends the caption STATED, where it stated any — null where it stated none (B-07). For a
   * caption stating a set, the ends of the first run the stack cannot carry (I-409).
   */
  readonly fromLabel: string | null;
  readonly toLabel: string | null;
};

/**
 * One ownership decision (L-REG-03, L-MEA-09): a view whose rows of a mark on a storey stand beside a
 * plan that DREW that mark on that storey. `derived` is how many rows of the mark the view derives
 * there, `drawn` how many the drawing plans measured there, and `yielded` how many of the view's rows
 * gave way. `surplus` is what the drawing plans leave unaccounted for — `derived − drawn`, zero where
 * they draw at least as many — and a surplus is never yielded blind (see `ownedRows`).
 */
export type ExpansionYield = {
  readonly viewKey: string;
  readonly mark: string;
  readonly level: LevelRef;
  readonly derived: number;
  readonly drawn: number;
  readonly yielded: number;
  readonly surplus: number;
};

/** What one artifact's expansion resolved to, in the key's own order (L-REG-04). */
export type ResolvedExpansion = {
  readonly rows: readonly ExpansionRow[];
  readonly deferrals: readonly ExpansionDeferral[];
  /** Every ownership decision the rows were filtered by, in the view's, the mark's and the level's order. */
  readonly yields: readonly ExpansionYield[];
};

/**
 * The storeys a caption states, as this stage reads them. Three answers and no fourth:
 *   · a SET: the runs the caption writes, each a range it wrote a range sign across or one storey it
 *     listed (I-409);
 *   · a single-level plan: exactly one level word;
 *   · nothing: no level at all, which is what a bare `TYPICAL FLOOR PLAN` is.
 */
export type CaptionLevels =
  | { readonly kind: "set"; readonly runs: readonly LevelRun[] }
  | { readonly kind: "single"; readonly label: string }
  | { readonly kind: "unstated" };

/**
 * The storeys a view's caption states (L-CAD-07: "typical ranges from captions"), read by the
 * placement law's one reading of a level set (`levelRunsOf`, B-17).
 *
 * `TYPICAL FLOOR PLAN (1ST TO 6TH)` states the range between its two words. `2ND, 4TH & 6TH FLOOR
 * BEAM LAYOUT` states those three storeys and none between them. Before I-409, any two level
 * words were read as a range from the first to the last, so that caption stood its members on 3RD and
 * 5TH as well: an over-measurement nothing disclosed. A caption naming no level states nothing, which
 * is the state `AUTHOR_TYPICAL_RANGE` exists to settle.
 */
export function captionLevelsOf(caption: string): CaptionLevels {
  const runs = levelRunsOf(caption);
  const only = runs.length === 1 ? runs[0] : undefined;
  if (runs.length === 0) return { kind: "unstated" };
  if (only !== undefined && only.from === only.to) return { kind: "single", label: only.from };
  return { kind: "set", runs };
}

/** Code-point order, so one resolution lists one answer one way (L-REG-04, AC-8). */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The live level a label names, or null where the stack carries none — labels compare as storeys
 * (`sameStorey`: the grammar's one reading, so a caption's "2ND" places on a stack marked "2F").
 */
function levelLabelled(levels: readonly StackedLevel[], label: string): StackedLevel | null {
  const found = levels.filter((level) => sameStorey(level.label, label));
  // Ties go to the lower ordinal, so one stack answers one way however it was handed in (AC-8).
  return found.sort((left, right) => left.ordinal - right.ordinal || byCodePoint(left.levelId, right.levelId))[0] ?? null;
}

/** The live level a surrogate names, or null where no live level carries it (L-REG-02). */
function levelSurrogate(levels: readonly StackedLevel[], levelId: string): StackedLevel | null {
  return levels.find((level) => level.levelId === levelId) ?? null;
}

/**
 * The live level a run's far end names. It is the stack's own level under that label, as every end is
 * read. Where a caption ran its range to `TOP` and the stack carries no level of that label, the end is
 * the building's top floor (I-411): the highest live level standing below the stack's ROOF.
 *
 * The roof is the anchor because a floor is what a person stands on, and the roof is where the top
 * floor's verticals end. A stack that carries no roof cannot say which of its levels is the top floor.
 * Its highest level may be the roof under another name (`TERRACE`), and a plan's members stood there
 * would be a storey of over-measurement. So the end is null, and the view defers under
 * `LEVEL_RANGE_ENDPOINT_UNMAPPED`, naming `TOP` (L-QTY-01: never a guess).
 *
 * A range runs UP to the top floor. One that starts at the roof or above it (`ROOF TO TOP FLOOR`) names a
 * top floor beneath its own start, and which storeys it means is nobody's reading. Its end is null too.
 * The view defers rather than stand the plan's members on the storey below the roof, a storey the
 * caption never named.
 *
 * The walk is by ordinal, and ties go to the lower surrogate, so one stack answers one way however it
 * was handed in (AC-8).
 */
function runEndOf(levels: readonly StackedLevel[], label: string, from: StackedLevel): StackedLevel | null {
  const labelled = levelLabelled(levels, label);
  if (labelled !== null || label !== TOP_FLOOR) return labelled;
  const roof = levelLabelled(levels, TOP_FLOOR_BENEATH);
  if (roof === null) return null;
  const top = levels
    .filter((level) => level.ordinal < roof.ordinal)
    .reduce<StackedLevel | null>((held, level) => (held === null || level.ordinal > held.ordinal || (level.ordinal === held.ordinal && byCodePoint(level.levelId, held.levelId) < 0) ? level : held), null);
  return top === null || top.ordinal < from.ordinal ? null : top;
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
  return spanAcross(levels, { from, to }, []);
}

/** One run of a stated set, placed on the live stack: the two levels its ends name. */
type PlacedRun = { readonly from: StackedLevel; readonly to: StackedLevel };

/**
 * Every live level standing within ANY run of a stated set, and none outside them all (I-409).
 * `2ND, 4TH & 6TH` is three runs of one storey each, and the span is those three levels: never the
 * storeys between, because the caption listed them rather than ran a range across them.
 *
 * Each run is read the way `spanBetween` reads a range: by ordinal, inclusive. So a set of one run IS
 * that range, and a caption that states a range reads exactly as it did. The DRAWN level is where the
 * FIRST run the caption writes runs from. A plan captioned for several storeys is drawn once, and the
 * caption opens with the storey it is drawn at (risk note 2).
 */
function spanAcross(levels: readonly StackedLevel[], first: PlacedRun, rest: readonly PlacedRun[]): Span {
  const runs = [first, ...rest];
  const within = levels.filter((level) =>
    runs.some((run) => level.ordinal >= Math.min(run.from.ordinal, run.to.ordinal) && level.ordinal <= Math.max(run.from.ordinal, run.to.ordinal)),
  );
  return { kind: "levels", drawn: first.from, levels: within };
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

  const stated = captionLevelsOf(view.caption);
  if (stated.kind === "unstated") return { kind: "deferred", reason: TYPICAL_RANGE_UNSTATED, fromLabel: null, toLabel: null };
  if (stated.kind === "single") {
    const only = levelLabelled(evidence.levels, stated.label);
    // A caption naming ONE level nobody has authored is not a deferral: the drawing said which level,
    // and the placeholder carries onto the surrogate the moment somebody authors it (L-REG-04's
    // one-hop carry). A set is different: an unmapped storey leaves nothing to expand over.
    return only === null ? { kind: "unregistered", label: stated.label } : { kind: "levels", drawn: only, levels: [only] };
  }
  // Every run is placed before any is expanded (I-409). A set with one storey the stack does
  // not carry has not been read whole. Expanding the rest would stand the plan's members on some of the
  // storeys it names and on none of the others, with no word said (L-QTY-04). So the view defers under
  // the law's own reason, naming the ends of the first run the stack cannot carry: for a range, the two
  // ends the caption stated, as ever.
  const placed: PlacedRun[] = [];
  for (const run of stated.runs) {
    const from = levelLabelled(evidence.levels, run.from);
    const to = from === null ? null : runEndOf(evidence.levels, run.to, from);
    if (from === null || to === null) return { kind: "deferred", reason: LEVEL_RANGE_ENDPOINT_UNMAPPED, fromLabel: run.from, toLabel: run.to };
    placed.push({ from, to });
  }
  const [first, ...rest] = placed;
  return first === undefined ? { kind: "deferred", reason: TYPICAL_RANGE_UNSTATED, fromLabel: null, toLabel: null } : spanAcross(evidence.levels, first, rest);
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

/**
 * The levels of a span this placement's own mark family is stated to stand over (L-FRM-02, L-MEA-09).
 *
 * A schedule's `LEVELS` cell is the drawing's statement of which storeys carry a mark: a `BEAM
 * SCHEDULE` row reading `1F TO ROOF` says the beam starts at the first floor, whatever range the plan
 * that draws it is typical of. So the span a view states is CUT to that band, and two marks on one
 * plan can stand on different levels — which is the only reading under which a plan typical of
 * `GF … ROOF` does not register a first-floor beam in the ground storey (L-QTY-04: a member is never
 * registered on a level the drawing never said it stands at).
 *
 * The cut is made only where the stack can be read against the band. A family whose schedule stated no
 * band, or whose every band names an endpoint the stack does not carry, is not cut here at all: the
 * band is then a statement nothing can judge, and the rail says so per level under
 * `SECTION_BAND_UNCOVERED` rather than the member vanishing from the register with no word said.
 *
 * A band's two ends are read against the WHOLE live stack and never against the span being cut. `1F TO
 * ROOF` names two storeys of the building, not two storeys of the plan: read against a typical plan's
 * own span the roof end would be unfindable, the band would count as unjudgeable, and the cut it exists
 * to make — keeping a first-floor beam out of the ground storey — would be abandoned on exactly the
 * plans that need it (L-REG-02: a level is named by the stack that carries it).
 */
function bandedLevels(placement: PlacementRow, levels: readonly StackedLevel[], stack: readonly StackedLevel[], families: readonly FamilyBands[]): readonly StackedLevel[] {
  const stated = families.find((one) => one.family === placement.memberFamily)?.bands ?? [];
  if (stated.length === 0 || stated.some((band) => bandOpen(band))) return levels;
  // This stage places a band's ends the way it places every label it reads off a drawing — normalised,
  // ties to the lower ordinal. What a placed band MEANS is `bandCovers`, asked here and nowhere else.
  const place = (label: string): number | undefined => levelLabelled(stack, label)?.ordinal;
  const readable = stated.filter((band) => bandJudgeable(band, place));
  if (readable.length === 0) return levels;
  return levels.filter((level) => readable.some((band) => bandCovers(band, level.ordinal, place)));
}

/**
 * The levels a NOTED member's own note states it stands on, cut from the levels its view gave it
 * (I-303: a plan note that names a mark is evidence about that MEMBER, and a member so noted is not
 * one of the plan's typical).
 *
 * Two answers and no third, off the note's own words:
 *   · the note states NO range — its member stands on the level the plan DRAWS, alone. The drawn
 *     level is the span's own (`spanBetween`: a typical plan is drawn once, at the storey its range
 *     runs from), so this reads no new fact off the drawing; it takes the fact the span already
 *     carries and keeps that one level (`C7 Ø450 PORCH COLUMN` → GF).
 *   · the note states a range — its member stands over the levels that range covers, read by core's
 *     own `bandCovers`, whose "an open end is no bound: a band stating only its start runs to the
 *     top of whatever it is read against" already means exactly what `STARTS AT 1F` says (B-17).
 *
 * A CUT, and only ever a cut: this filters the levels handed in, so nothing it answers can place a
 * member on a storey the view's span did not reach and nothing it answers can restore a level the
 * schedule's own band excluded. That is I-303's whole safety — a note misread costs floors of UNDER,
 * which the band discloses; it cannot cost a cubic metre of over (L-QTY-04, L-QTY-06).
 *
 * The band's ends are placed against the WHOLE live stack, never against the span being cut, for the
 * reason `bandedLevels` places a schedule's are: `1F` names a storey of the BUILDING (L-REG-02). A
 * band naming an end the stack cannot place is unjudgeable and `bandCovers` answers false for every
 * level of it, so the member stands nowhere — the same answer `LEVEL_RANGE_ENDPOINT_UNMAPPED` gives
 * a view whose stated range the stack cannot carry, and for the same reason: there is nothing for it
 * to stand on until somebody inserts the level (L-QTY-04: never a silent default).
 */
export function notedLevels(placement: PlacementRow, levels: readonly StackedLevel[], drawn: StackedLevel, stack: readonly StackedLevel[]): readonly StackedLevel[] {
  // `?? null` rather than a bare null test: the field is REQUIRED of the type, and the only way a row
  // reaches here without it is a caller from outside TypeScript — which would otherwise read
  // `undefined.band` and take a whole partition down over one column (ARCH-03).
  const note = placement.note ?? null;
  if (note === null) return levels;
  if (note.band === null) return levels.filter((level) => level.levelId === drawn.levelId);
  const place = (label: string): number | undefined => levelLabelled(stack, label)?.ordinal;
  return levels.filter((level) => bandCovers(note.band as BandStatement, level.ordinal, place));
}

/**
 * The lowest of a set of levels, or null where the set is empty — by ORDINAL, ties to the lower
 * surrogate.
 *
 * Never `levels[0]`. The stack arrives "in whatever order" (`ExpansionEvidence`), and an index read
 * would make which row is MEASURED depend on how the evidence was handed in — the one thing this
 * resolver promises it never does (AC-8, L-REG-04).
 */
export function lowestOf(levels: readonly StackedLevel[]): StackedLevel | null {
  return levels.reduce<StackedLevel | null>(
    (held, level) => (held === null || level.ordinal < held.ordinal || (level.ordinal === held.ordinal && byCodePoint(level.levelId, held.levelId) < 0) ? level : held),
    null,
  );
}

/** The rows one level-class member stands on, over the span its view resolved to, cut to its own band. */
function levelRows(placement: PlacementRow, span: Span, evidence: ExpansionEvidence): ExpansionRow[] {
  if (span.kind === "deferred") return standsUnresolved(span.reason) ? [rowOn(placement, UNRESOLVED, MEASURED)] : [];
  if (span.kind === "unregistered") return [rowOn(placement, { unregistered: span.label }, MEASURED)];
  // Two cuts, both intersections of the span, so the order they are made in is not a question: the
  // schedule states which storeys carry the MARK (L-FRM-02), and the note states which storeys carry
  // THIS MEMBER (I-303). Neither can restore what the other took away.
  const banded = bandedLevels(placement, span.levels, evidence.levels, evidence.families ?? []);
  const levels = notedLevels(placement, banded, span.drawn, evidence.levels);
  // The geometry basis (risk note 2): the storey a member's own drawing is OF. For one of the plan's
  // typical that is the level the plan was drawn at; for a member a note excepted it is the LOWEST
  // level the member stands on, because a noted member was drawn once and its own note says which
  // storey that drawing is of. One rule, and it answers the same thing for both where they agree —
  // a note stating no range leaves exactly the drawn level, whose lowest is itself.
  const drawn = (placement.note ?? null) === null ? span.drawn : lowestOf(levels);
  const rows = levels.map((level) => rowOn(placement, { levelId: level.levelId }, level.levelId === drawn?.levelId ? MEASURED : DERIVED));
  const neck = neckBeneath(placement, levels, evidence.levels);
  return neck === null ? rows : [...rows, rowOn(placement, { levelId: neck.levelId }, DERIVED)];
}

/**
 * The foundation neck a VERTICAL member continues down to, or null where it continues to none
 * (Interpretation I-338, L-MEA-01: "vertical members measure full storey height floor-to-floor").
 *
 * A column does not start at the ground floor. It rises from the top of what the building stands on,
 * and a person who enters that storey beneath GF — F-RCC6-BNBC's `FDN`, 2'-0" to the foot of S-25's
 * column lines — has stated where every ground-storey vertical begins. So a vertical whose LOWEST
 * storey, after every cut its view, its schedule band and its note made, is the ground storey stands
 * on the neck beneath it too, DERIVED: nothing drew it there, it is the ground-storey member continued
 * (risk note (2)). The neck is `foundationNeckOf`'s — the level named as the foundation standing
 * immediately below the level named as the ground storey — so a stack with no such level, which is
 * every stack a person has not told of one (F-RCC6's among them), moves nothing.
 *
 * Only ever the storey BENEATH the member's own lowest, and only where that is GF: a member whose own
 * note starts it higher (F-RCC6-BNBC's C5, `STARTS AT 1F`) has no neck, and one whose note binds it
 * to GF alone (the porch C7) keeps its neck, because the note says which storeys of the PLAN it stands
 * on and the neck is no storey of the plan. A beam is not a vertical and is never continued.
 */
function neckBeneath(placement: PlacementRow, levels: readonly StackedLevel[], stack: readonly StackedLevel[]): StackedLevel | null {
  if (!isVerticalClass(placement.elementType)) return null;
  const neck = foundationNeckOf(stack);
  if (neck === null || levels.some((level) => level.levelId === neck.neck.levelId)) return null;
  return lowestOf(levels)?.levelId === neck.ground.levelId ? neck.neck : null;
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

    const standing = placed.filter((placement) => isLevelClass(placement.elementType));
    if (standing.length === 0) continue;

    const span = spanOf(view, key, evidence);
    for (const placement of standing) rows.push(...levelRows(placement, span, evidence));
    // A deferral is a statement about members that stand nowhere: it is recorded because this view
    // HAS members that stand on a level, and a view whose only members are foundations defers nothing.
    if (span.kind === "deferred") deferrals.push({ viewKey: key, reason: span.reason, fromLabel: span.fromLabel, toLabel: span.toLabel });
  }

  const owned = ownership(rows);
  return {
    rows: [...owned.rows].sort((left, right) => byCodePoint(left.objectKey, right.objectKey)),
    deferrals: [...deferrals].sort((left, right) => byCodePoint(left.viewKey, right.viewKey)),
    yields: owned.yields,
  };
}

/** What the ownership rule reads of a row — every field it keys on and nothing else. */
type OwnedRow = Pick<ExpansionRow, "standing" | "level"> & {
  readonly placement: Pick<PlacementRow, "viewKey" | "mark" | "gridLetter" | "gridNumeral">;
};

/**
 * The MEMBER a row stands for: its mark at its own grid reference, on one level — where two MEASURED
 * sightings in two views are one member drawn twice (a plan and its enlargement of one storey).
 */
function memberOf(row: OwnedRow): string {
  return [row.placement.mark, row.placement.gridLetter ?? "", row.placement.gridNumeral ?? "", levelSegment(row.level)].join("|");
}

/**
 * The mark on one storey — what a plan OF that storey owns against a plan typical of it (L-MEA-09,
 * L-CAD-07: "a plan OF a storey is what that storey is measured from, and a typical plan is typical of
 * the storeys no plan of their own draws").
 *
 * Deliberately NOT the grid reference. Two plans of one drawing need not read one backbone: a grid
 * reference is the nearest axis of each family of the view's OWN bubbles, and F-RCC6's ROOF PLAN
 * letters six of its B1/B2 beams differently from the TYPICAL FLOOR PLAN that is also typical of the
 * roof. Keyed by grid reference, those six stood twice — +2.09125 m³ of beam concrete at ROOF over the
 * golden 19.205, and B1's runs summing to 50.4 m where the fixture states 42.000 — on the router's
 * path from the day the re-expansion landed (session 7, A1).
 */
function storeyMarkOf(row: OwnedRow): string {
  return `${row.placement.mark}|${levelSegment(row.level)}`;
}

/** One tally, keyed twice: by the storey-mark and by the view. */
function tally(into: Map<string, Map<string, number>>, key: string, viewKey: string): void {
  const held = into.get(key) ?? new Map<string, number>();
  held.set(viewKey, (held.get(viewKey) ?? 0) + 1);
  into.set(key, held);
}

/**
 * The drawn sighting owns its scope (L-REG-03: "a measured sighting landing where a level expansion
 * already stands is a promotion … not a refusal") — the ONE implementation of that rule, with the
 * decisions it made. Pure and order-independent: every answer is a count or a set over the rows handed
 * in, never the order they arrived in, and nothing here reads the register's state (L-REG-04, AC-8).
 *
 * A DERIVED row yields to a plan that DREW its mark on its storey. A roof plan draws the beams a
 * typical plan is also typical of; the plan that drew that storey read its geometry there, so the
 * typical plan's derived rows of that mark on that storey are the weaker reading of the same members,
 * and registering both would bill them twice — the over-measurement L-REG-03 exists to make
 * unrepresentable.
 *
 * But only where the drawing plans ACCOUNT for them: where they draw at least as many of the mark on
 * that storey as the typical plan derives there. Where they draw fewer, yielding every derived row
 * would drop members the drawing plans never showed with no word said — the undeclared partial L-QTY-02
 * makes unrepresentable — and keeping every one would bill the drawn ones twice. That surplus is
 * reported (`ExpansionYield.surplus`) and, until the store can carry its declaration, only the derived
 * rows standing at a drawn member's own grid reference yield: the reading this rule had before it was
 * keyed by storey, which moves nothing a surplus touches (IOU: the declaration's home, I-309).
 *
 * A MEASURED row yields only to another view's MEASURED row of the same member — one member drawn
 * twice — and the later view in the evidence keeps it, as it always has.
 *
 * Only across views: within one view a placement's rows stand on distinct levels already, and two
 * placements of one mark in one view are two members.
 */
function ownership<T extends OwnedRow>(rows: readonly T[]): { rows: T[]; yields: ExpansionYield[] } {
  const memberDrawnBy = new Map<string, string>();
  const drawnBy = new Map<string, Map<string, number>>();
  const derivedBy = new Map<string, Map<string, number>>();
  const levelOf = new Map<string, LevelRef>();
  for (const row of rows) {
    const key = storeyMarkOf(row);
    levelOf.set(key, row.level);
    if (row.standing === MEASURED) {
      memberDrawnBy.set(memberOf(row), row.placement.viewKey);
      tally(drawnBy, key, row.placement.viewKey);
    } else tally(derivedBy, key, row.placement.viewKey);
  }

  /** How many of a mark on a storey the plans OTHER than this view drew there. */
  const drawnElsewhere = (key: string, viewKey: string): number =>
    [...(drawnBy.get(key) ?? new Map<string, number>())].reduce((sum, [drawer, count]) => (drawer === viewKey ? sum : sum + count), 0);

  const kept = rows.filter((row) => {
    const member = memberDrawnBy.get(memberOf(row));
    const memberElsewhere = member !== undefined && member !== row.placement.viewKey;
    if (row.standing === MEASURED) return !memberElsewhere;
    const key = storeyMarkOf(row);
    const drawn = drawnElsewhere(key, row.placement.viewKey);
    if (drawn === 0) return true;
    const derived = derivedBy.get(key)?.get(row.placement.viewKey) ?? 0;
    // Accounted for: the drawing plans own the storey's instances of this mark. Not accounted for:
    // only the derived row a drawn member stands on yields, and the rest is the reported surplus.
    return derived > drawn && !memberElsewhere;
  });

  const keptBy = new Map<string, Map<string, number>>();
  for (const row of kept) if (row.standing !== MEASURED) tally(keptBy, storeyMarkOf(row), row.placement.viewKey);

  const yields: ExpansionYield[] = [];
  for (const [key, byView] of derivedBy) {
    for (const [viewKey, derived] of byView) {
      const drawn = drawnElsewhere(key, viewKey);
      if (drawn === 0) continue;
      const mark = key.slice(0, key.lastIndexOf("|"));
      const level = levelOf.get(key) as LevelRef;
      yields.push({ viewKey, mark, level, derived, drawn, yielded: derived - (keptBy.get(key)?.get(viewKey) ?? 0), surplus: Math.max(0, derived - drawn) });
    }
  }
  yields.sort(
    (left, right) =>
      byCodePoint(left.viewKey, right.viewKey) || byCodePoint(left.mark, right.mark) || byCodePoint(levelSegment(left.level), levelSegment(right.level)),
  );
  return { rows: kept, yields };
}

/**
 * The rows `ownership` keeps — exported because it is the ONE implementation of which sighting owns a
 * scope: a second reading of it, keyed any other way, answers a different set of rows for the same
 * drawing, and one of the two then bills a member twice or loses it with no word said (B-17, ARCH-02).
 */
export function ownedRows<T extends OwnedRow>(rows: readonly T[]): T[] {
  return ownership(rows).rows;
}

/**
 * One register object standing under a level's placeholder (`@unregistered:<label>`, L-REG-04), as
 * the carry reads one: its key, the label that key was spelled with — the caption's own word, as the
 * register wrote it — and the standing it was registered at.
 */
export type StandingPlaceholder = {
  readonly objectKey: string;
  readonly label: string;
  readonly standing: SightingStanding;
};

/** One placeholder a resolution retires: the row it becomes, and the surrogate its key is carried onto. */
export type PlaceholderCarry = {
  readonly placeholder: StandingPlaceholder;
  readonly row: ExpansionRow;
  readonly levelId: string;
};

/**
 * The placeholders these rows RETIRE (Interpretation I-366; L-REG-04's one-hop carry, L-REG-03).
 *
 * A single-level plan whose storey the stack does not carry yet registers its members under the
 * caption's own word (`1ST FLOOR BEAM LAYOUT` → `@unregistered:1ST`), and once the storey stands the
 * resolver places the same members on it — reading the word by the grammar's storey reading
 * (`levelLabelled`: `1ST` is `1F`). The placeholder and the resolved row are then ONE sighting under
 * two keys, and the register must hold it once: the placeholder is carried onto the row, never
 * stood beside it. Until this, the carry was the level act's alone and compared labels letter by
 * letter (`dotlessUpper`), so `1ST` against `1F` carried nothing and the rebuild after it registered
 * the 23 beams of F-RCC6-BNBC's 1F plan a second time (195 beam objects where the stack gives 172).
 *
 * Read by the resolver's OWN reading and nothing else: the label is placed on the stack exactly as
 * the caption's was (`levelLabelled`, ties to the lower ordinal), the key it becomes is the identity
 * grammar's (`carryLevel`), and a placeholder is retired only onto a row these rows actually hold. So
 * a member its band or its note keeps off that storey is never carried onto it (L-FRM-02, I-303) — it
 * keeps its placeholder, and the rebuild reports it stale rather than measuring it where no drawing
 * put it (L-QTY-04). And never onto a key already standing (`standing`), because two rows of one key
 * are one identity (L-REG-03); nor where the standings differ, because the carry moves the level and
 * nothing else about the sighting.
 *
 * Pure and order-independent: one row retires at most one placeholder, decided in key order.
 */
export function placeholderCarries(
  rows: readonly ExpansionRow[],
  placeholders: readonly StandingPlaceholder[],
  levels: readonly StackedLevel[],
  standing: ReadonlySet<string> = new Set<string>(),
): PlaceholderCarry[] {
  const derived = new Map(rows.map((row) => [row.objectKey, row]));
  const claimed = new Set<string>();
  const carries: PlaceholderCarry[] = [];
  for (const placeholder of [...placeholders].sort((left, right) => byCodePoint(left.objectKey, right.objectKey))) {
    const level = levelLabelled(levels, placeholder.label);
    if (level === null) continue;
    const carried = carryLevel(placeholder.objectKey, { label: placeholder.label, levelId: level.levelId });
    const row = carried.carried ? derived.get(carried.key) : undefined;
    if (row === undefined || row.standing !== placeholder.standing || standing.has(row.objectKey) || claimed.has(row.objectKey)) continue;
    claimed.add(row.objectKey);
    carries.push({ placeholder, row, levelId: level.levelId });
  }
  return carries;
}

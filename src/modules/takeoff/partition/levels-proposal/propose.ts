// The seventh stage of R-TO-030's stored partition: the level stack a drawing's sections STATE.
//
// "The machine proposes a stack, never a level" — L-ACT-03 makes authoring a level stack a human's
// act, so nothing here writes a level. What it reads is the level marks of a long-section strip or a
// member section (`GF LVL +0.00 M`), and what it answers is a proposal a person confirms whole as one
// `INSERT_LEVEL` (L-MEA-07, R-UI-023).
//
// A level mark states three things and is read for all three: the level it names — through the
// notation's own floor-zone reading, which is the one home of what `GF` and `1ST` mean (B-17) — the
// elevation it stands at, and the unit that elevation was written in. The storey height is the
// distance to the level above, kept as the drawing's own words beside that unit; the topmost level of
// a section states none (L-REG-01, B-07).
//
// A section may state its storeys in TWO notations — F-RCC6-BNBC S-25 marks `1F EL +3.353` on the
// right and `EL +11'-0"` on the left, where the metric figure is the imperial design converted and
// rounded. Each notation is read on its own: a storey height is the distance between two marks of ONE
// notation, never a metric mark less an imperial one, because a rounded elevation corrupts the storey
// above it (6.401 − 11'-0" is 3.0482, not 3.048). An imperial mark names no storey of its own, so it
// is bound to the storey whose metric mark it is drawn beside, by the section's own geometry; the
// storey is proposed ONCE, and its height carries one reading per notation that states it (D-001,
// T-NOT-LEVEL: "levels in both notations resolve to one level stack").
//
// Pure over the artifact and the stages before it: no store, no clock, no model (L-REG-04).
import { dotlessUpper } from "@/core/identity";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { CANONICAL_UNIT, convert, exact, unitNamed } from "@/core/units/canon";
import { normaliseNotation, parseFeetInches, parseFloorZone } from "../notation";
import type { PartitionedView } from "../views/assign";
import { VIEW_TYPE, type ViewType } from "../views/law";

/**
 * A storey height read a second time, in the other notation its section states it in (D-001): the
 * distance between the two imperial marks bound to this storey and the one above it, in inches, citing
 * this storey's OWN imperial mark exactly as a metric height cites the storey's own metric mark.
 */
export type ProposedNotationReading = {
  readonly heightAsWritten: string;
  readonly heightUnit: string;
  /** The imperial mark this reading was read off (L-CAD-03). */
  readonly markKey: string;
  /** The elevation that mark states, in the unit the height is written in. */
  readonly elevation: number;
};

/** One level a section proposes, as the store holds one and as the door offers one (L-MEA-07). */
export type ProposedLevelRow = {
  readonly viewKey: string;
  readonly label: string;
  /** Zero at the foot of the section, counting up by ascending elevation (L-MEA-07: physical). */
  readonly ordinal: number;
  readonly elevation: number;
  /** The storey height to the level above, as written, or null at the top of the section (B-07). */
  readonly heightAsWritten: string | null;
  readonly heightUnit: string | null;
  /** The level mark this row was read off (L-CAD-03: a reading names the atom it was read from). */
  readonly markKey: string;
  /**
   * The same storey height as the section's other notation states it — present ONLY where it does, so
   * a section written in one notation proposes exactly the rows it always proposed (D-001).
   */
  readonly otherNotation?: ProposedNotationReading;
};

/** What one artifact's levels-proposal stage read: the sections it examined, and what they stated. */
export type ProposedLevelStack = {
  readonly views: number;
  readonly levels: readonly ProposedLevelRow[];
};

/** What the stage is handed: the artifact, and what the views stage cut out of it. */
export type LevelProposalEvidence = {
  readonly graph: EntityGraph;
  readonly views: readonly PartitionedView[];
  /** Entity source key → view key, as the views stage assigned them (L-CAD-06). */
  readonly assignments: ReadonlyMap<string, string>;
};

/**
 * The view classes a level mark is read off. L-CAD-06 says sections "yield types and dimensions only"
 * — a level stack is a dimension of the building, not an instance of anything — so the two section
 * classes are read and the plans are not.
 */
const SECTION_VIEWS: readonly ViewType[] = Object.freeze([VIEW_TYPE.LONG_SECTION_STRIP, VIEW_TYPE.MEMBER_SECTION]);

/**
 * A level mark's elevation and the unit it was written in: a SIGNED number, because a level mark
 * states its height above or below the datum and a bare number on a section is a dimension rather
 * than a level (L-CAD-03: a reading never invents what the drawing withheld).
 */
const ELEVATION = /([+-]\d+(?:\.\d+)?)\s*([A-Za-z']+)?\s*$/;

/** How many parts of a unit a written height is kept to — six, which is past any drawing's precision. */
const WRITTEN_PARTS = 1e6;

/**
 * One level mark, as this stage reads one. `y` is where the drawing put it — the one fact of its
 * geometry the stage reads, and only to bind an imperial mark to the storey it is drawn beside.
 */
type LevelMark = { readonly viewKey: string; readonly label: string; readonly elevation: number; readonly unit: string | null; readonly markKey: string; readonly y: number | null };

/**
 * An elevation printed in feet and inches, as a section writes one beside its metric storey marks:
 * `EL +11'-0"`, `P.L= +0'-0"` (F-RCC6-BNBC S-25). The words, an optional `=`, then a SIGNED length —
 * the sign is what makes it a level rather than a dimension, as it is for a metric mark.
 */
const IMPERIAL_ELEVATION = /^([A-Z][A-Z.\s]*?)\s*=?\s*([+-])\s*(\d.*)$/;

/**
 * The words that say an imperial figure is the elevation of a FLOOR — the two S-25 writes, and no
 * other (L-QTY-01: a word admitted on a hunch is a reading nobody proved). `EL` says the figure is an
 * elevation, as the notation already reads it on a metric mark; `P.L` is the plinth level, the
 * ground storey's finished floor. `E.G.L` is absent on purpose: the existing ground is the SITE, not
 * a storey of the building (T-NOT-LEVEL: "EGL −457.2 is the SITE fact").
 */
const FLOOR_ELEVATION_WORDS: ReadonlySet<string> = new Set(["EL", "PL"]);

/** The unit an imperial storey height is written in: the inch, the least mark feet-and-inches states. */
const IMPERIAL_HEIGHT_UNIT = "in";

/** One imperial elevation mark: which view it stands in, what it states in inches, and where it is. */
type ImperialMark = { readonly viewKey: string; readonly inches: number; readonly markKey: string; readonly y: number };

/**
 * The elevation one text states in feet and inches, in signed inches, or null where it states none.
 * The length is read by the notation's own feet-and-inches reader (B-17); the sign is the mark's, and
 * is read here, because that reader reads a length and a length has none.
 */
function imperialElevationOf(text: string): number | null {
  const stated = IMPERIAL_ELEVATION.exec(normaliseNotation(text).trim().toUpperCase());
  if (stated === null || !FLOOR_ELEVATION_WORDS.has(dotlessUpper(stated[1] ?? ""))) return null;
  const inches = parseFeetInches(stated[3] ?? "");
  if (inches === null) return null;
  return stated[2] === "-" && inches !== 0 ? -inches : inches;
}

/** Where an entity was drawn, up the sheet — its first point's y — or null where it carries none. */
function heightOnSheet(points: readonly (readonly number[])[] | undefined): number | null {
  const y = points?.[0]?.[1];
  return typeof y === "number" && Number.isFinite(y) ? y : null;
}

/**
 * The level one mark names, or null where its text names none. Total over any text a section carries:
 * a dimension, a note and a member mark all name no level and answer null rather than throwing.
 */
function levelMarkOf(text: string): { readonly label: string; readonly elevation: number; readonly unit: string | null } | null {
  const said = text.trim();
  const stated = ELEVATION.exec(said);
  if (stated === null) return null;
  const elevation = Number(stated[1]);
  if (!Number.isFinite(elevation)) return null;
  // The words BEFORE the elevation say which level it is: `1ST FLOOR LVL` reads as `1ST` because the
  // notation drops the storey words and keeps the one that names a level (B-17).
  const band = parseFloorZone(said.slice(0, stated.index));
  if (band === null || band.from !== band.to) return null;
  return { label: band.from, elevation, unit: stated[2] ?? null };
}

/**
 * A written height, kept to the precision a drawing states one at — never a double's last bits.
 * Published because the door states the same height over the merged stack: a figure spelled two ways
 * would be two figures (B-17).
 */
export function statedHeight(value: number): string {
  return String(Math.round(value * WRITTEN_PARTS) / WRITTEN_PARTS);
}

/** Code-point order, so one artifact proposes one stack one way (L-REG-04). */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * One artifact's ONE level stack (L-MEA-07, AC-7). Every section view is examined and every mark they
 * state is read into a single stack: a sheet ordinarily carries `SECTION A-A` beside `SECTION B-B`,
 * and a stack per view would have a person confirming the machine's own proposal author the
 * building's storeys twice over, under one `INSERT_LEVEL` naming two ground floors (L-ACT-01).
 *
 * A view whose marks state no level contributes nothing, which is an honest silence rather than an
 * empty stack somebody would have to confirm.
 */
export function proposeLevelStack(evidence: LevelProposalEvidence): ProposedLevelStack {
  const sections = new Map(evidence.views.filter((view) => SECTION_VIEWS.includes(view.type)).map((view) => [view.viewKey, view]));

  // Read in the ARTIFACT's own order, over every section at once: what a mark says is the same fact
  // whichever view it was drawn in, and the order the artifact lists them in is what decides which of
  // two spellings of one storey stands (L-REG-04).
  const marks: LevelMark[] = [];
  const imperial: ImperialMark[] = [];
  for (const entity of evidence.graph.entities) {
    const viewKey = evidence.assignments.get(entity.key);
    if (viewKey === undefined || !sections.has(viewKey)) continue;
    const y = heightOnSheet(entity.points);
    const read = levelMarkOf(entity.text ?? "");
    if (read !== null) {
      marks.push({ viewKey, label: read.label, elevation: read.elevation, unit: read.unit, markKey: entity.key, y });
      continue;
    }
    // The section's other notation: an elevation in feet and inches, naming no storey of its own.
    const inches = imperialElevationOf(entity.text ?? "");
    if (inches !== null && y !== null) imperial.push({ viewKey, inches, markKey: entity.key, y });
  }

  // One level per elevation a SECTION states: a mark drawn twice at one height in one view is one
  // level, and the first of them in the artifact's own order is the one that stands (L-REG-04).
  const byElevation = new Map<string, LevelMark>();
  for (const mark of marks) {
    const at = `${mark.viewKey}@${statedHeight(mark.elevation)}`;
    if (!byElevation.has(at)) byElevation.set(at, mark);
  }
  const standing = [...byElevation.values()];

  // A storey is named ONCE, by the label that names it and by nothing else: two sections of one
  // building state one GF however each of them spells it. An elevation is not the identity — a member
  // section is routinely drawn from its own datum, so a `1ST` at +0.00 on one view and the `GF` at
  // +0.00 on another are two storeys that share a number.
  // Which of two spellings stands is decided in the ARTIFACT's own order, before anything is sorted:
  // two sections are routinely drawn from their own datums, so a `GF` at −0.150 on the second section
  // is the same storey as the `GF` at +0.000 on the first, and sorting by elevation first would keep
  // whichever of them happens to sit lower rather than the one the drawing states first (L-REG-04).
  const named = new Set<string>();
  const kept = standing.filter((mark) => {
    const label = dotlessUpper(mark.label);
    if (named.has(label)) return false;
    named.add(label);
    return true;
  });
  // The stack itself counts from the foot up: an ordinal is physical (L-MEA-07).
  const stacked = [...kept].sort((left, right) => canonicalElevationOf(left) - canonicalElevationOf(right) || byCodePoint(left.markKey, right.markKey));

  // Which mark stands next ABOVE each one in its own view — the pair a storey height is a distance
  // between. Read off every standing mark of the view, so a mark the label dedupe dropped still
  // separates the two levels it stood between (B-07).
  const nextInView = nextMarkInEachView(standing);

  // Which imperial mark each storey is drawn beside, where the section's geometry says (D-001).
  const imperialOf = bindImperialMarks(standing, imperial);

  return {
    views: sections.size,
    levels: stacked.map((mark, ordinal) => {
      const above = stacked[ordinal + 1];
      // The storey height is the distance to the level standing above it IN THIS VIEW, and only where
      // that level is this view's own next mark. The views are drawn from their own datums, so the gap
      // between two of them is not a measurement anybody took, and a mark dropped by the dedupe is no
      // neighbour of anything — both state no height rather than a figure nobody drew (B-07, L-CAD-03).
      const adjacent = above !== undefined && above.viewKey === mark.viewKey && nextInView.get(mark.markKey) === above.markKey ? above : null;
      const measured = adjacent === null ? null : storeyHeightOf(mark, adjacent);
      // The same pair, read again in the other notation — each notation differenced within itself.
      const other = adjacent === null ? null : imperialHeightOf(imperialOf.get(mark.markKey), imperialOf.get(adjacent.markKey));
      return {
        viewKey: mark.viewKey,
        label: mark.label,
        ordinal,
        elevation: mark.elevation,
        heightAsWritten: measured,
        heightUnit: measured === null ? null : mark.unit,
        markKey: mark.markKey,
        ...(other === null ? {} : { otherNotation: other }),
      };
    }),
  };
}

/**
 * The storey height two imperial marks state, in inches, citing the LOWER one — the storey's own
 * imperial mark, as a metric height cites the storey's own metric mark (L-CAD-03). A pair whose upper
 * figure does not stand above the lower one states no height: the section draws the storey upward,
 * and a pair that says otherwise was never the pair this storey's height is the distance between.
 */
function imperialHeightOf(below: ImperialMark | undefined, above: ImperialMark | undefined): ProposedNotationReading | null {
  if (below === undefined || above === undefined || !(above.inches > below.inches)) return null;
  return { heightAsWritten: statedHeight(above.inches - below.inches), heightUnit: IMPERIAL_HEIGHT_UNIT, markKey: below.markKey, elevation: below.inches };
}

/** One section's standing marks from the foot up, where its geometry says which way is up. */
type Axis = readonly { readonly markKey: string; readonly y: number }[];

/**
 * A section's vertical axis, read off its own marks: the standing marks in physical order, and where
 * each was drawn — or null where the section states none. A view whose marks rise on the sheet as
 * their elevations rise says which way is up; one with fewer than two marks, a mark with no position,
 * or marks that do not rise with their elevations says nothing a binding could lean on (L-CAD-03).
 */
function axisOf(marks: readonly LevelMark[]): Axis | null {
  if (marks.length < 2) return null;
  const run = [...marks].sort((left, right) => canonicalElevationOf(left) - canonicalElevationOf(right) || byCodePoint(left.markKey, right.markKey));
  const axis: { readonly markKey: string; readonly y: number }[] = [];
  for (const mark of run) {
    const below = axis[axis.length - 1];
    if (mark.y === null || (below !== undefined && !(mark.y > below.y))) return null;
    axis.push({ markKey: mark.markKey, y: mark.y });
  }
  return axis;
}

/**
 * The storey an imperial mark at `y` is drawn beside: the mark on the axis it is STRICTLY nearest to,
 * and no further from it than half the storey it would stand in — the storey toward the mark's own
 * side, or, past the foot or the top of the section, the one storey there is. Nearer to one storey's
 * line than to any other is what "drawn beside it" means; an equal distance to two is no answer, and
 * a figure standing half a storey clear of the stack marks something other than a storey.
 */
function storeyBeside(axis: Axis, y: number): string | null {
  let nearest = -1;
  let distance = Number.POSITIVE_INFINITY;
  let tied = false;
  for (const [index, mark] of axis.entries()) {
    const gap = Math.abs(y - mark.y);
    if (gap < distance) [nearest, distance, tied] = [index, gap, false];
    else if (gap === distance) tied = true;
  }
  const at = axis[nearest];
  if (at === undefined || tied) return null;
  const toward = y >= at.y ? (axis[nearest + 1] ?? axis[nearest - 1]) : (axis[nearest - 1] ?? axis[nearest + 1]);
  if (toward === undefined) return null;
  return distance < Math.abs(toward.y - at.y) / 2 ? at.markKey : null;
}

/**
 * Which imperial mark each standing metric mark is drawn beside (D-001), keyed by the metric mark.
 *
 * An imperial mark names no storey — `EL +11'-0"` says an elevation and nothing about which floor —
 * so the storey it states is the one the section DRAWS it beside, read off the section's own geometry
 * and nothing else: its axis (`axisOf`) and the storey the mark is nearest to on it (`storeyBeside`).
 * Never by value: binding a figure to the storey whose metric elevation it rounds to would bind only
 * the marks that already agree, and hide the one that does not from the standing that must declare
 * it (L-REG-03). A storey two imperial marks are drawn beside keeps the first of them in the
 * artifact's own order, as a storey two metric marks name does (L-REG-04).
 */
function bindImperialMarks(standing: readonly LevelMark[], imperial: readonly ImperialMark[]): Map<string, ImperialMark> {
  const bound = new Map<string, ImperialMark>();
  if (imperial.length === 0) return bound;
  const axes = new Map<string, Axis | null>();
  for (const viewKey of new Set(standing.map((mark) => mark.viewKey))) {
    axes.set(viewKey, axisOf(standing.filter((mark) => mark.viewKey === viewKey)));
  }
  for (const mark of imperial) {
    const axis = axes.get(mark.viewKey);
    const storey = axis === undefined || axis === null ? null : storeyBeside(axis, mark.y);
    if (storey !== null && !bound.has(storey)) bound.set(storey, mark);
  }
  return bound;
}

/** For each mark, the key of the mark standing next above it in its OWN view, where one does. */
function nextMarkInEachView(marks: readonly LevelMark[]): Map<string, string> {
  const next = new Map<string, string>();
  const byView = new Map<string, LevelMark[]>();
  for (const mark of marks) {
    const held = byView.get(mark.viewKey);
    if (held === undefined) byView.set(mark.viewKey, [mark]);
    else held.push(mark);
  }
  for (const held of byView.values()) {
    const ordered = [...held].sort((left, right) => left.elevation - right.elevation || byCodePoint(left.markKey, right.markKey));
    for (const [index, mark] of ordered.entries()) {
      const above = ordered[index + 1];
      if (above !== undefined) next.set(mark.markKey, above.markKey);
    }
  }
  return next;
}

/**
 * The storey height between two marks of one section, in the unit the LOWER mark was written in — a
 * height is stated with its unit or not at all (L-MEA-01, B-07).
 *
 * Two marks of one view can still be written in two units (`+0.000 m` beneath `+3000 mm`), and a bare
 * subtraction of those two numbers states three thousand metres. The distance is taken in canonical
 * metres through the canon's one converter and carried back into the lower mark's own unit (B-17,
 * L-FRM-06). A pair written in one unit is differenced as written and is untouched by any of this.
 */
function storeyHeightOf(below: LevelMark, above: LevelMark): string | null {
  if (below.unit === null) return null;
  const stated = unitNamed(below.unit);
  const upper = above.unit === null ? stated : unitNamed(above.unit);
  if (stated === null || upper === null || stated === upper) return statedHeight(above.elevation - below.elevation);

  const foot = convert(below.elevation, stated, CANONICAL_UNIT.LENGTH);
  const head = convert(above.elevation, upper, CANONICAL_UNIT.LENGTH);
  if (!foot.ok || !head.ok) return null;
  const distance = convert(exact(head.value).sub(foot.value).toString(), CANONICAL_UNIT.LENGTH, stated);
  return distance.ok ? statedHeight(Number(distance.value)) : null;
}

/**
 * One mark's elevation in canonical metres — what the merged stack is ordered by. Two sections written
 * in two units state their elevations in two scales, and 3000 mm stands above 9.000 m only in the
 * numbers (L-FRM-06). A mark whose unit the canon names nothing for is ordered as it was written,
 * which is the only scale it states.
 */
function canonicalElevationOf(mark: LevelMark): number {
  const named = mark.unit === null ? null : unitNamed(mark.unit);
  if (named === null) return mark.elevation;
  const carried = convert(mark.elevation, named, CANONICAL_UNIT.LENGTH);
  return carried.ok ? Number(carried.value) : mark.elevation;
}

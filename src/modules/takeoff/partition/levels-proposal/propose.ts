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
// Pure over the artifact and the stages before it: no store, no clock, no model (L-REG-04).
import { dotlessUpper } from "@/core/identity";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { CANONICAL_UNIT, convert, exact, unitNamed } from "@/core/units/canon";
import { parseFloorZone } from "../notation";
import type { PartitionedView } from "../views/assign";
import { VIEW_TYPE, type ViewType } from "../views/law";

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

/** One level mark, as this stage reads one. */
type LevelMark = { readonly viewKey: string; readonly label: string; readonly elevation: number; readonly unit: string | null; readonly markKey: string };

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
  for (const entity of evidence.graph.entities) {
    const viewKey = evidence.assignments.get(entity.key);
    if (viewKey === undefined || !sections.has(viewKey)) continue;
    const read = levelMarkOf(entity.text ?? "");
    if (read === null) continue;
    marks.push({ viewKey, label: read.label, elevation: read.elevation, unit: read.unit, markKey: entity.key });
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

  return {
    views: sections.size,
    levels: stacked.map((mark, ordinal) => {
      const above = stacked[ordinal + 1];
      // The storey height is the distance to the level standing above it IN THIS VIEW, and only where
      // that level is this view's own next mark. The views are drawn from their own datums, so the gap
      // between two of them is not a measurement anybody took, and a mark dropped by the dedupe is no
      // neighbour of anything — both state no height rather than a figure nobody drew (B-07, L-CAD-03).
      const measured = above !== undefined && above.viewKey === mark.viewKey && nextInView.get(mark.markKey) === above.markKey ? storeyHeightOf(mark, above) : null;
      return {
        viewKey: mark.viewKey,
        label: mark.label,
        ordinal,
        elevation: mark.elevation,
        heightAsWritten: measured,
        heightUnit: measured === null ? null : mark.unit,
        markKey: mark.markKey,
      };
    }),
  };
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

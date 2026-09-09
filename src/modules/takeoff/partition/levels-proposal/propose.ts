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
import type { EntityGraph } from "@/core/entitygraph/schema";
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

/** A written height, kept to the precision a drawing states one at — never a double's last bits. */
function statedHeight(value: number): string {
  return String(Math.round(value * WRITTEN_PARTS) / WRITTEN_PARTS);
}

/** Code-point order, so one artifact proposes one stack one way (L-REG-04). */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The level stack one artifact's sections state (AC-7). Every section view is examined; one whose
 * marks state no level contributes nothing, which is an honest silence rather than an empty stack
 * somebody would have to confirm.
 */
export function proposeLevelStack(evidence: LevelProposalEvidence): ProposedLevelStack {
  const levels: ProposedLevelRow[] = [];
  let examined = 0;

  for (const view of evidence.views) {
    if (!SECTION_VIEWS.includes(view.type)) continue;
    examined += 1;

    const marks: LevelMark[] = [];
    for (const entity of evidence.graph.entities) {
      if (evidence.assignments.get(entity.key) !== view.viewKey) continue;
      const read = levelMarkOf(entity.text ?? "");
      if (read === null) continue;
      marks.push({ viewKey: view.viewKey, label: read.label, elevation: read.elevation, unit: read.unit, markKey: entity.key });
    }

    // One level per elevation the section states: a mark drawn twice at one height is one level, and
    // the first of them in the artifact's own order is the one that stands (L-REG-04).
    const byElevation = new Map<string, LevelMark>();
    for (const mark of marks) {
      const at = statedHeight(mark.elevation);
      if (!byElevation.has(at)) byElevation.set(at, mark);
    }

    const stacked = [...byElevation.values()].sort((left, right) => left.elevation - right.elevation || byCodePoint(left.markKey, right.markKey));
    for (const [ordinal, mark] of stacked.entries()) {
      const above = stacked[ordinal + 1];
      // The storey height is the distance to the level above, in the unit the mark itself was written
      // in — a height is stated with its unit or not at all (L-MEA-01, B-07).
      const height = above === undefined || mark.unit === null ? null : statedHeight(above.elevation - mark.elevation);
      levels.push({
        viewKey: view.viewKey,
        label: mark.label,
        ordinal,
        elevation: mark.elevation,
        heightAsWritten: height,
        heightUnit: height === null ? null : mark.unit,
        markKey: mark.markKey,
      });
    }
  }

  return { views: examined, levels };
}

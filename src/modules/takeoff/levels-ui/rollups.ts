// S-Levels' roll-ups, composed from the stored lines (I-241, I-433): which row of the grid a line
// stands on, and what one row's lines of one kind amount to.
//
// Pure — no store, no clock — so the one rule is proved without a cluster, and `server.ts` is left
// to read the lines and the stack and hand them here. Nothing is re-derived: a roll-up states the
// count, the sum of the COMPLETE values, the weakest coverage and the code that weakest line declared
// its omission under, exactly as the gate published them.
import type { RefusalCode } from "@/core/errors";
import type { LevelSlot } from "@/core/identity";
import { exact } from "@/core/units/canon";
import type { LevelsViewRollup, LevelsViewSlot } from "./view";

/** L-QTY-02's two coverages a stored line stands at; the second is the weaker of them. */
const COMPLETE = "COMPLETE";
const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The register's lawful-null slot beneath every level (L-REG-04), whose lines have a row of their own. */
const FOUNDATION: LevelSlot = "FOUNDATION";

/**
 * Where the register stands the object a line was measured off: on a surrogate, in a lawful-null
 * slot, or under a placeholder label — exactly one of the three (`register_objects_level_stated_once`).
 */
export type LinePlace = {
  readonly levelId: string | null;
  readonly levelSlot: string | null;
  readonly levelLabel: string | null;
};

/** One stored line, in the facts a roll-up is composed of, and where its object stands. */
export type RolledLine = {
  readonly place: LinePlace;
  readonly kind: string;
  readonly unit: string;
  readonly coverage: string;
  readonly value: string | null;
  readonly omitted: readonly unknown[];
};

/** Every line of a campaign, laid on the one row of the grid it stands on (I-433). */
export type RowsOfLines = {
  /** The lines whose object stands on a LIVE level, by that level's surrogate. */
  readonly byLevel: ReadonlyMap<string, readonly RolledLine[]>;
  /** The rows that are no level, only those holding a line: FOUNDATION, then UNPLACED. */
  readonly slots: readonly LevelsViewSlot[];
};

/**
 * Lay each line on its row, keyed in one pass rather than scanned once per level: a campaign holds as
 * many lines as the register holds objects, and a scan per level would price the page in their
 * product (the register workspace's own reading takes the same care).
 *
 * A line on a live level stands on that level's row. A line in the FOUNDATION slot stands on the
 * Foundation row: the slot is a place a member stands beneath every level, and a stack that left it
 * out stated the foundation of F-RCC6-BNBC as the neck's 3.060 m³ while its piles and caps held about
 * 500 (session 8's walk). Every other line — the UNRESOLVED slot, a placeholder label nobody authored
 * a level for, a level since repudiated — stands on no live level, and says so on a row of its own
 * rather than vanishing from the sum: a stack whose rows leave a line out is a completeness nobody
 * measured (L-QTY-02).
 */
export function rowsOfLines(liveLevelIds: readonly string[], lines: readonly RolledLine[]): RowsOfLines {
  const live = new Set(liveLevelIds);
  const byLevel = new Map<string, RolledLine[]>();
  const foundation: RolledLine[] = [];
  const unplaced: RolledLine[] = [];
  for (const line of lines) {
    const { levelId, levelSlot } = line.place;
    if (levelId !== null && live.has(levelId)) {
      const held = byLevel.get(levelId);
      if (held === undefined) byLevel.set(levelId, [line]);
      else held.push(line);
    } else if (levelId === null && levelSlot === FOUNDATION) {
      foundation.push(line);
    } else {
      unplaced.push(line);
    }
  }
  const slots: LevelsViewSlot[] = [];
  if (foundation.length > 0) slots.push({ slot: "FOUNDATION", rollups: rollupsOf(foundation) });
  if (unplaced.length > 0) slots.push({ slot: "UNPLACED", rollups: rollupsOf(unplaced) });
  return { byLevel, slots };
}

/**
 * One roll-up cell per kind the lines bear, in the kind's own order. Weakest-wins over the lines of
 * that kind: one PARTIAL_DECLARED line makes the cell partial, and the code is the one that line
 * declared its omission under — read off the record, never derived from the level's standing
 * (L-QTY-02, I-241, settled reading).
 */
export function rollupsOf(lines: readonly RolledLine[]): LevelsViewRollup[] {
  const byKind = new Map<string, RolledLine[]>();
  for (const line of lines) {
    const held = byKind.get(line.kind);
    if (held === undefined) byKind.set(line.kind, [line]);
    else held.push(line);
  }
  return [...byKind.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([kind, held]) => {
      const partial = held.filter((line) => line.coverage !== COMPLETE);
      const complete = held.filter((line) => line.coverage === COMPLETE && line.value !== null);
      // A partial roll-up carries no figure at all: L-QTY-02's rule about a row, applied to the cell
      // that sums them — a sum over the COMPLETE half would print an under-measured total as a fact.
      const value = partial.length > 0 || complete.length === 0 ? null : complete.reduce((total, line) => total.add(exact(line.value as string)), exact("0")).toString();
      return {
        kind,
        unit: held[0]?.unit ?? "",
        lines: held.length,
        value,
        coverage: partial.length > 0 ? PARTIAL_DECLARED : COMPLETE,
        code: firstOmissionCode(partial),
      };
    });
}

/**
 * The code the weakest line of this kind declared its omission under — the first one it enumerated,
 * as L-QTY-02 makes it enumerate every omitted component on the row. A partial line that enumerated
 * none carries no code, which the cell states as none rather than inventing one.
 */
function firstOmissionCode(partial: readonly RolledLine[]): RefusalCode | null {
  for (const line of partial) {
    for (const omission of line.omitted) {
      const code = (omission as { code?: unknown } | null)?.code;
      if (typeof code === "string") return code as RefusalCode;
    }
  }
  return null;
}

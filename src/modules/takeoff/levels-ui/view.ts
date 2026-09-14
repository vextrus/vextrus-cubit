// S-Levels' reading, as one value (R-TO-033, docs/design/s-levels.md §1). The screen renders this
// and derives nothing from it: every standing, every figure and every coverage below was computed by
// the code path that owns the state it names, and the workspace only shows it (I-241, B-17).
import type { RefusalCode } from "@/core/errors";

/** One reading somebody made of a level's storey height, as it was written (L-MEA-07, R-TO-051). */
export type LevelsViewReading = {
  readonly readingKey: string;
  readonly actorId: string;
  readonly basis: string;
  /** Null where the reading cites no drawing entity — a height somebody entered cites none. */
  readonly sourceKey: string | null;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonicalMetres: string;
  /** True where a LATER reading under the same key replaced this one (a re-affirmation). */
  readonly superseded: boolean;
};

/**
 * What one level's stored quantity lines of one kind amount to. Read, never re-derived: the count,
 * the sum of the COMPLETE values at full precision, the weakest coverage over them and the code the
 * weakest line declared its omission under (L-QTY-02, I-241).
 */
export type LevelsViewRollup = {
  readonly kind: string;
  readonly unit: string;
  readonly lines: number;
  /** Null where no line of this kind is COMPLETE — a partial roll-up carries no figure (L-QTY-02). */
  readonly value: string | null;
  readonly coverage: "COMPLETE" | "PARTIAL_DECLARED";
  readonly code: RefusalCode | null;
};

/** One live level of the stack, with how its height stands and what stands on it (L-MEA-07). */
export type LevelsViewLevel = {
  readonly levelId: string;
  readonly label: string;
  readonly ordinal: number;
  readonly standing: "AGREED" | "SUSPENDED" | "NONE";
  readonly code: "STOREY_HEIGHT_CONTESTED" | "STOREY_HEIGHT_UNSTATED" | null;
  /** The agreed height in metres, or null where the readings do not agree on one. */
  readonly canonicalMetres: string | null;
  readonly readings: readonly LevelsViewReading[];
  readonly rollups: readonly LevelsViewRollup[];
};

/** One view of the partition whose typical range nobody has stated (L-CAD-07) — the rail's index. */
export type LevelsViewRange = {
  readonly viewKey: string;
  readonly drawingId: string;
  readonly caption: string;
  readonly code: "TYPICAL_RANGE_UNSTATED";
};

/** The whole reading S-Levels renders: the stack in ordinal order, and the index beside it (I-240). */
export type LevelsView = {
  readonly projectId: string;
  readonly stack: readonly LevelsViewLevel[];
  readonly unstatedRanges: readonly LevelsViewRange[];
};

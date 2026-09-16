// The shapes the placement stage reads and writes — what a placed member IS, what the stage is
// handed, and what it answers with (L-CAD-07, L-MEA-09, L-REG-04).
//
// One home for them because the stage has TWO readers over one evidence: `./detect` reads the members
// a plan draws as a closed outline anchored by a mark, and `./runs` reads the members it draws as a
// pair of edge lines. They answer in the same currency — a `PlacementRow` is a placed member whichever
// way the plan drew it — and `./detect` composes `./runs`. Declaring the currency in either reader
// would make the two import each other, and a cycle at file grain is unlawful (ARCH-01).
//
// Shapes only: nothing here reads an artifact, a store or a clock.
import type { ElementType } from "@/core/catalogue/classes";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { ViewRef } from "@/core/identity";
import type { QuantityBasis } from "@/core/offers/law";
import type { Unit } from "@/core/units/canon";
import type { DetectedGrid } from "../grid/detect";
import type { PartitionedView } from "../views/assign";
import type { PlacementShares } from "./shares";

/** One placed member, as the store holds one and as the expansion reads one (L-REG-04). */
export type PlacementRow = {
  /** L-REG-04's view key — the class and the caption anchor the view was read at. */
  readonly viewKey: string;
  /** The view itself, as a key is derived from one: the expansion keys instance rows off it (L-REG-04). */
  readonly view: ViewRef;
  /** L-REG-04's placement key: the view, the mark and the point quantised onto the lattice. */
  readonly placementKey: string;
  readonly mark: string;
  /** What the drawing spelled, kept beside what the rule compares (L-CAD-03). */
  readonly markText: string;
  readonly elementType: ElementType;
  readonly x: number;
  readonly y: number;
  /** The nearest axis of each family of this view's backbone, or null where it carries none. */
  readonly gridLetter: string | null;
  readonly gridNumeral: string | null;
  readonly outlineKey: string;
  readonly markKey: string;
  /** The member family of the record's own schedules this mark names, or null where none does. */
  readonly memberFamily: string | null;
};

/** A layout plan that placed nothing because it georeferenced as deferred (L-CAD-07). */
export type UngriddedView = { readonly viewKey: string };

/** One reading a run carries: what was read, in the unit it was read in, and off which entities. */
export type RunReading = {
  readonly value: string;
  readonly unit: Unit;
  readonly basis: QuantityBasis;
  readonly sourceKeys: readonly string[];
};

/** One placement's run: its clear axis, and the slab adjoining each of its two sides (L-MEA-09). */
export type RunRow = {
  readonly placementKey: string;
  readonly clear: RunReading | null;
  readonly sides: readonly [RunReading | null, RunReading | null];
};

/** What one artifact's run stage read: the members it placed off edge-line pairs, and their runs. */
export type DetectedRuns = {
  readonly placements: readonly PlacementRow[];
  readonly runs: readonly RunRow[];
};

/** What one artifact's placement stage read: the plans it examined, and what it found in them. */
export type DetectedPlacements = {
  readonly views: number;
  readonly placements: readonly PlacementRow[];
  readonly ungridded: readonly UngriddedView[];
  /**
   * The run each member drawn as an edge-line PAIR measures along its own axis (`./runs`, L-MEA-09).
   * Empty where the plans drew none; a placement read off a closed outline carries no run at all —
   * a column has no clear span between its supports, it IS the support.
   */
  readonly runs?: readonly RunRow[];
};

/**
 * One member family the record's schedules named — what a placement's `member_family` joins to, and
 * what the schedules said that family IS. The variants are optional because a record whose schedules
 * stated no section still names its families, and a family with no section is judged by nothing.
 */
export type FamilyNamed = {
  readonly family: string;
  readonly variants?: readonly { readonly sectionWidth: number | null; readonly sectionDepth: number | null; readonly bandText?: string }[];
};

/** What the stage is handed: the artifact, what the stages before it derived, and the pinned shares. */
export type PlacementEvidence = {
  readonly graph: EntityGraph;
  readonly views: readonly PartitionedView[];
  /** Entity source key → view key, as the views stage assigned them (L-CAD-06). */
  readonly assignments: ReadonlyMap<string, string>;
  /** What the grid stage detected, or null where no such stage ran (L-CAD-07). */
  readonly grid: DetectedGrid | null;
  readonly shares: PlacementShares;
  /** The families the schedules stage registered for this record (R-TO-031). */
  readonly families: readonly FamilyNamed[];
};

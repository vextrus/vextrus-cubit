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
import type { MemberShape } from "@/core/db";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { ViewRef } from "@/core/identity";
import type { BandStatement } from "@/core/offers/contract";
import type { QuantityBasis } from "@/core/offers/law";
import type { Unit } from "@/core/units/canon";
import type { DetectedGrid } from "../grid/detect";
import type { PartitionedView } from "../views/assign";
import type { PlacementShares } from "./shares";

/**
 * What a plan NOTE said about ONE member (I-303: a plan note that names a mark is evidence about that
 * member). The note's own source key, its words verbatim, and the two things I-303 admits it may
 * state — the range of storeys it names, and the shape it names.
 *
 * `band` is null where the note stated no range at all, which is not "covers everything": `bandOpen`
 * is what a band with both ends open means (`@/core/offers/contract`), and a note stating no range
 * says the precise opposite — its member stands on the level the plan DRAWS, alone. The reader can
 * never build such a band (`bandStatedIn` answers from a level word it actually saw), so the null is
 * the only spelling of that fact and the store's own columns read back the same way (`./store`).
 *
 * This is the note as a placed member CARRIES one, which is a different shape from `MemberNote`
 * (`./law`) — that is the note as a TEXT was read, and it names the mark it is about, which a row
 * already carries. One reading, two shapes, and the conversion is made exactly once (`./detect`).
 */
export type PlacementNote = {
  /** The note's own entity — the third atom a noted member was read from (L-CAD-03). */
  readonly sourceKey: string;
  /** The note's words, verbatim: a reading never replaces what was drawn (L-CAD-03). */
  readonly text: string;
  /** The range of storeys the note STATED, or null where it stated none (I-303). */
  readonly band: BandStatement | null;
  /** The shape the note STATED, or null where it stated none (I-304). */
  readonly shape: MemberShape | null;
};

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
  /**
   * The plan note that names this member, or null where no note names it (I-303).
   *
   * REQUIRED rather than optional, against the `runs?:` precedent below, because the named defect
   * this field exists to close is a reader that FORGOT a column: the rebuild reads the drawing and
   * the re-expansion reads only the store, and the two must answer the same rows or a member stands
   * on seven storeys after an ingest and one after a pin (L-REG-04, B-17). A required field makes
   * every reader that builds a row carry it or stop compiling; an optional one would let the next
   * one quietly forget, which is the whole of the defect.
   */
  readonly note: PlacementNote | null;
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
  /**
   * How many of those placements a plan NOTE names, and how many of them the note itself PLACED
   * (I-303). A reader of a rebuild sees how many members a plan's notes excepted from its typical
   * range and how many stood on the evidence of a note alone, because a stage whose result is not
   * visible is a stage nobody can audit (R-TO-030, L-CAD-03). `minted` is a subset of `noted`.
   */
  readonly noted: number;
  readonly minted: number;
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

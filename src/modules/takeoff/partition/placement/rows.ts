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
import type { MemberShape, SectionUnit } from "@/core/db";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { ViewRef } from "@/core/identity";
import type { BandStatement } from "@/core/offers/contract";
import type { QuantityBasis } from "@/core/offers/law";
import type { Unit } from "@/core/units/canon";
import type { DetectedGrid } from "../grid/detect";
import type { PartitionedView } from "../views/assign";
import type { OutlineReading } from "./outline";
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

/**
 * The plan one outline-placed member's RING encloses (I-333): the geometry the ring is, and its area,
 * perimeter and — for a rectangle — its own two sides, in the unit it was drawn in and on the lattice a
 * placement is keyed on. Keyed by the placement it was read for, and cited to the ring itself: the
 * ring is the one entity every figure here was read off (L-CAD-03, L-QTY-03).
 */
export type OutlineRow = {
  readonly placementKey: string;
  readonly sourceKey: string;
  /**
   * The declaration the unit was read off, where the drawing's header named none and its own general
   * notes did (I-302) — null where the header named it. A figure read in a unit somebody declared is
   * evidence from that declaration too, and is cited to it (L-QTY-03).
   */
  readonly unitSourceKey: string | null;
} & OutlineReading;

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
   * The plan each member placed off a closed ring encloses (I-333) — one row per such placement, in the
   * placements' own order. Empty where no ring was placed, and absent from a drawing whose units the
   * seam could not map: a figure in a unit nobody named is no figure (L-CAD-02). A member placed off
   * edge lines has none; its run is its reading.
   */
  readonly outlines?: readonly OutlineRow[];
  /**
   * The drawn scale the stage judged every stated section at — how many drawing units one unit of the
   * schedules measures, read off the drawing's own members (L-MEA-01) — or null where nothing could be
   * compared. Carried so a reader of a rebuild can see what the placements were judged at: a stage
   * whose result is not visible is a stage nobody can audit (R-TO-030).
   */
  readonly scale?: number | null;
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
  readonly variants?: readonly {
    readonly sectionWidth: number | null;
    readonly sectionDepth: number | null;
    readonly bandText?: string;
    /** The dimensions the row states beside its section, where it states any (I-322). */
    readonly dimensions?: readonly { readonly dimension: string; readonly text: string; readonly value: number }[];
  }[];
  /**
   * What a bare-prefix row's `NOS` cell states (I-321): corroboration a placement checks the plans
   * against, never a count, and never stored — absent on every other family.
   */
  readonly corroboration?: { readonly placed: number };
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
  /**
   * The unit the drawing's own notes DECLARE its dimensions in, where the conventions stage read one
   * (I-302) — the unit a ring's plan is read in where the header states none (I-333). Optional
   * because a caller holding no profile still places every member; what it does not get is a plan
   * for a drawing whose header is unitless.
   */
  readonly declaredUnit?: { readonly unit: SectionUnit; readonly sourceKey: string } | null;
};

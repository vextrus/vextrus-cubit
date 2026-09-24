// What S-BBS is drawn from: the project's open campaign, the revision it is pinned to, and the bill
// of bars the ONE door answered for it (R-TO-054, goal).
//
// Nothing here is a figure of this screen's own. `document` is `bbsOf`'s answer, carried across
// whole, and `partial` is the campaign's published rebar lines speaking for themselves (L-QTY-02).
import type { BbsDocument } from "@/modules/takeoff/rebar";

export type { BbsDocument };

/**
 * One thing the partly declared lines left out, as they state it (L-QTY-02): the registered code the
 * absence is declared under, and the COMPONENTS of the line it was declared for — the line's own
 * variable names (`net`, `lap`, `ties`), each once, in the order the lines first state them. The
 * screen says the components in words before the registry's message, so a reader learns WHAT is
 * missing before why (I-354).
 */
export type BbsOmission = {
  readonly code: string;
  readonly components: readonly string[];
};

/**
 * How one ENTRY of the schedule stands (s-bbs I-655): the coverage its members' rebar lines state
 * and what those lines left out. An entry is COMPLETE only where every member it counts published a
 * COMPLETE line; otherwise it is PARTIAL_DECLARED and `omitted` names each registered code the
 * members' lines state, once, in the order the lines first state it, with the components it was
 * stated for (L-QTY-02, I-354). Read from the published lines, never inferred from the bars drawn.
 */
export type BbsEntryCoverage = {
  readonly coverage: string;
  readonly omitted: readonly BbsOmission[];
};

/** One sheet, and the entities on it a Trace selects — the viewer's address, uncomposed (I-559). */
export type BbsSheetSelection = {
  readonly drawingId: string;
  readonly layoutName: string;
  readonly sourceKeys: readonly string[];
};

/**
 * Where the schedule's figures came from, as the Trace selects them (s-bbs I-559): each entry's
 * members on their plan — by the entry's key, its first member's — and each bar's schedule cells on
 * the sheet they are drawn on, by the bar's key. An entry or a bar absent here resolved to nothing
 * the pinned record holds, and its cell states the figure with no link.
 */
export type BbsTraces = {
  readonly members: Readonly<Record<string, BbsSheetSelection>>;
  readonly bars: Readonly<Record<string, BbsSheetSelection>>;
};

/** The whole reading one bar-schedule screen paints (test contract: `bbsViewOf`). */
export type BbsView = {
  /** The project's open campaign, or `null` where none is pinned (R-UI-050's empty). */
  readonly campaignId: string | null;
  /** The revision that campaign measures against, stated whole so a reader copies all of it. */
  readonly setRevisionId: string | null;
  /** The bill of bars, exactly as the door answered it — never a second reckoning beside it. */
  readonly document: BbsDocument | null;
  /** Whether any `rcc.rebar` line of the campaign stands PARTLY DECLARED (L-QTY-02, Decision §2). */
  readonly partial: boolean;
  /**
   * The registered codes those partly declared lines state for what they left out — each once, in
   * the order the lines first state it, with the components it was stated for (L-QTY-02, I-354). The
   * screen says each as the component in words, the registry's own message and where it is settled,
   * beside the partial line, so a total a reader reads is never taken for the whole of the column
   * steel. Absent, or empty, where nothing was left out.
   */
  readonly omitted?: readonly BbsOmission[];
  /**
   * Each entry's own standing, by the entry's key — its first member's `objectKey`, the key its group
   * row is named by (I-534, s-bbs I-655). A reader of one column's bars learns from its own row
   * whether they are the whole of its steel, not only from the schedule-wide list. Absent, or missing
   * an entry, reads as nothing stated for it — never as COMPLETE.
   */
  readonly entries?: Readonly<Record<string, BbsEntryCoverage>>;
  /** Where each mass and each bar was read from, for the Trace (I-559). Absent reads as none. */
  readonly traces?: BbsTraces;
  /**
   * The members whose rebar line declared a LENGTH term missing — the laps (or the run itself) the
   * synthesis could not state — in the order the lines state them (I-567). Their running bars
   * are storey-height runs, not lengths anybody can cut: the schedule labels them so and withholds
   * the cutting stock of every diameter they touch. Absent, or empty, where every length is stated.
   */
  readonly deferred?: readonly string[];
  /**
   * The reinforcement the campaign published no line for — the measurement statement's `rcc.rebar`
   * rows (beam, pile, cap and slab steel), in the words the draft BOQ closes on (I-569,
   * `notMeasuredScopeOf`): what, over which levels, and why. Absent, or empty, where there is none.
   */
  readonly notInSchedule?: readonly BbsNotInSchedule[];
};

/** One row of the steel no line was published for, as the draft's closing block says it (I-569). */
export type BbsNotInSchedule = { readonly about: string; readonly levels: string; readonly why: string };

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
};

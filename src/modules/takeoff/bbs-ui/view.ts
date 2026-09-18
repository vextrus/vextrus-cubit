// What S-BBS is drawn from: the project's open campaign, the revision it is pinned to, and the bill
// of bars the ONE door answered for it (R-TO-054, goal).
//
// Nothing here is a figure of this screen's own. `document` is `bbsOf`'s answer, carried across
// whole, and `partial` is the campaign's published rebar lines speaking for themselves (L-QTY-02).
import type { BbsDocument } from "@/modules/takeoff/rebar";

export type { BbsDocument };

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
};

// R-UI-050's matrix for the bar-schedule workspace, in the one enumerable place a suite reflects
// over (B-19). The readings below are exactly what `bbs-screen[data-state]` can wear, in the order
// the Decision §2 resolves them — first holding wins. A reading the screen can reach and this list
// does not hold, or a reading here the screen can never reach, is the drift the declaration prevents.
import type { BbsView } from "./view";

/** The declared readings, in precedence order (s-bbs §2). */
export const BBS_STATES = ["loading", "denied", "offline", "error", "refused", "empty", "partial", "ready"] as const;

/** One of them. */
export type BbsState = (typeof BBS_STATES)[number];

/** What the screen is told about itself, beside the reading it holds. */
export type BbsStanding = {
  readonly view: BbsView | null;
  /** Whether this reader holds MEASURE on the project (I-bbs-1). */
  readonly permitted?: boolean;
  readonly offline?: boolean;
  readonly refused?: string | null;
  /** The state a caller has already settled — `loading` is the route's, never derivable here. */
  readonly state?: string | null;
};

/**
 * Whether this reading has anything to schedule: no campaign pinned, or a campaign whose
 * measurement wrote no bar row. A fact about the READING, not about the state cell — a reader who
 * is denied the schedule is still owed the reason it is empty (R-UI-020, R-UI-050).
 */
export function nothingScheduled(view: BbsView | null): boolean {
  if (view === null) return false;
  return view.campaignId === null || view.document === null || view.document.rows.length === 0;
}

/**
 * The state cell this screen stands in, in the Decision §2's own order — first holding wins, and
 * every reading is one of `BBS_STATES`, so the declaration and the screen cannot spell the same
 * state two ways (B-19). `loading` is not derivable from a reading and is the caller's to state.
 *
 * The denial outranks everything a reading could say (I-bbs-1): a reader without MEASURE meets the
 * refusal, never an empty grid that implies this project has no bars.
 */
export function bbsStateOf(standing: BbsStanding): BbsState {
  const stated = standing.state ?? null;
  if (stated !== null && (BBS_STATES as readonly string[]).includes(stated)) return stated as BbsState;
  if (standing.permitted === false) return "denied";
  if (standing.offline === true) return "offline";
  if (standing.view === null) return "error";
  if ((standing.refused ?? null) !== null) return "refused";
  if (nothingScheduled(standing.view)) return "empty";
  return standing.view.partial ? "partial" : "ready";
}

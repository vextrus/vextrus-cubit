// R-UI-050's matrix for the draft-BOQ workspace, in the one enumerable place a suite reflects over
// (B-19). The readings below are exactly what `boq-screen[data-state]` can wear, in the order the
// Decision §2 resolves them — first holding wins. A reading the screen can reach and this list does
// not hold, or a reading here the screen can never reach, is the drift the declaration prevents.
import type { BoqView } from "./view";

/** The declared readings, in precedence order (s-boq §2). */
export const BOQ_STATES = ["loading", "denied", "offline", "error", "refused", "empty", "partial", "ready"] as const;

/** One of them. */
export type BoqState = (typeof BOQ_STATES)[number];

/** What a line says about what it could not measure (L-QTY-02). */
const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** What the screen is told about itself, beside the reading it holds. */
export type BoqStanding = {
  readonly view: BoqView | null;
  readonly permitted?: boolean;
  readonly offline?: boolean;
  readonly refused?: string | null;
  /** The state a caller has already settled — `loading` is the route's, never derivable here. */
  readonly state?: string | null;
};

/**
 * Whether this reading has anything to show: no campaign pinned, or a campaign that published no
 * line. A fact about the READING, not about the state cell — a reader denied the export door is
 * still owed the reason the screen is empty (R-UI-020, R-UI-050).
 */
export function nothingPublished(view: BoqView | null): boolean {
  if (view === null) return false;
  return view.campaignId === null || view.payload === null || (view.payload.sections.length === 0 && view.payload.unclassified.lines.length === 0);
}

/**
 * Whether the draft has a gap in it a reader must be shown: a line the taxonomy could not place, or
 * a line that declared what it could not measure (L-BD-08, L-QTY-02).
 *
 * INCOMPLETE COVERAGE ALONE IS NOT ONE. A campaign that sighted a class no rail measured states its
 * gap in the coverage statement and in each section's measured-scope subtotal — the draft itself is
 * whole and every line of it reads (L-QTY-04, Decision §2). So `data-coverage` and `data-state` say
 * two different true things, and neither is derived from the other.
 */
export function draftIsPartial(view: BoqView | null): boolean {
  const payload = view?.payload ?? null;
  if (payload === null) return false;
  if (payload.unclassified.lines.length > 0) return true;
  return payload.sections.some((section) => section.groups.some((group) => group.lines.some((line) => line.coverage === PARTIAL_DECLARED)));
}

/**
 * The state cell this screen stands in, in the Decision §2's own order — first holding wins, and
 * every reading is one of `BOQ_STATES`, so the declaration and the screen cannot spell the same
 * state two ways (B-19). `loading` is not derivable from a reading and is the caller's to state.
 */
export function boqStateOf(standing: BoqStanding): BoqState {
  const stated = standing.state ?? null;
  if (stated !== null && (BOQ_STATES as readonly string[]).includes(stated)) return stated as BoqState;
  if (standing.permitted === false) return "denied";
  if (standing.offline === true) return "offline";
  if (standing.view === null) return "error";
  if ((standing.refused ?? null) !== null) return "refused";
  if (nothingPublished(standing.view)) return "empty";
  return draftIsPartial(standing.view) ? "partial" : "ready";
}

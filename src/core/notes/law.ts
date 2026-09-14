// R-TO-034's note vocabulary as data: the five detailing figures a general note states, the two
// verdicts a reading is judged under, and the one basis a reading off a drawing's text carries.
//
// It stands in core for the reason `../levels/law.ts` does: the act seam is core and L-ACT-02 makes
// the act map's totality a compile-time property, so TRANSCRIBE_SHEET_NOTES' rendering has to read
// this roster itself — and a rendering that reached into `src/modules` could not (ARCH-01). The
// takeoff module's door re-publishes exactly these values, so a note kind has one home (B-17).
import type { RefusalCode } from "../errors";

/**
 * The five figures a general note states that detailing then applies (R-TO-034, AM-03). Each is one
 * (kind, value, unit) reading: the minimum hook length is its own kind rather than a second field of
 * the hook, so every reading is one row the store's CHECK can close.
 */
export const NOTE_KINDS = ["FY", "FC", "LAP", "HOOK", "HOOK_MIN"] as const;

/** One of the five. */
export type NoteKind = (typeof NOTE_KINDS)[number];

/**
 * What the seam judged a committed reading to be: the figure the grammar proposed, or another one
 * the person read for themselves. It is never what the caller claimed — the commit re-reads the
 * sheet and compares (R-TO-034).
 */
export const NOTE_ACCEPTANCES = ["ACCEPTED", "EDITED"] as const;

/** One of the two. */
export type NoteAcceptance = (typeof NOTE_ACCEPTANCES)[number];

/** L-QTY-01: a note reading is read off the drawing's own text, so its basis is transcribed. */
export const NOTE_BASIS = "TRANSCRIBED" as const;

/** The three standings a kind stands at over the readings made of it (L-REG-03, R-TO-051). */
export const NOTE_STANDINGS = ["AGREED", "SUSPENDED", "NONE"] as const;

/** One of the three. */
export type NoteStandingName = (typeof NOTE_STANDINGS)[number];

/**
 * The registered code a kind carrying no figure is reported under. One home for the pairing: the
 * standing derived in `./standing.ts` and the code a screen renders the absence through are the same
 * fact said twice (B-17, Q-07). AGREED carries a figure, and a kind nobody read is not a refusal —
 * it is silence, and R-UI-050 renders silence as nothing at all.
 */
export const NOTE_STANDING_ABSENCE: Readonly<Record<NoteStandingName, RefusalCode | null>> = Object.freeze({
  AGREED: null,
  SUSPENDED: "NOTE_READING_CONTESTED",
  NONE: null,
});

/** Is this string one of the five kinds the law closes? */
export function isNoteKind(value: string): value is NoteKind {
  return (NOTE_KINDS as readonly string[]).includes(value);
}

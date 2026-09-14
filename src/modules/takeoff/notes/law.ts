// R-TO-034's note vocabulary: which reinforcement figures a sheet's general notes can state, the two
// verdicts a committed reading is judged under, and the one basis such a reading ever carries.
//
// The law is a value, so the grammar, the act, the store's CHECK and the screen all read the same
// one (ARCH-02, B-17). The KIND spellings themselves are written down in
// `@/core/errors/transport-vocabulary`, where Q-07's register can tell `HOOK_MIN` from a refusal
// nobody registered, and read from there rather than copied — one spelling, one place (B-19).
import { NOTE_KIND_SPELLINGS } from "@/core/errors/transport-vocabulary";

/**
 * The five figures a general note states, in the order R-TO-034 names them: the reinforcement
 * grade, the concrete strength, the tension lap, the 135° hook's multiplier and its minimum length.
 *
 * The hook's minimum is its own kind rather than a second field of HOOK so that every reading is one
 * (kind, value, unit) row the store's CHECK can close.
 */
export const NOTE_KINDS = NOTE_KIND_SPELLINGS;

/** One of the five. */
export type NoteKind = (typeof NOTE_KINDS)[number];

/** Is this string one of the kinds the law declares? A reading naming anything else reads nothing. */
export function isNoteKind(value: unknown): value is NoteKind {
  return typeof value === "string" && (NOTE_KINDS as readonly string[]).includes(value);
}

/**
 * The two verdicts the SEAM judges a committed reading under: the grammar's own figure, or another
 * one the person read instead. Never a flag a client sends — the commit path re-runs the grammar
 * and decides (R-TO-034).
 */
export const NOTE_ACCEPTANCES = ["ACCEPTED", "EDITED"] as const;

/** One of the two. */
export type NoteAcceptance = (typeof NOTE_ACCEPTANCES)[number];

/**
 * L-QTY-01's basis for a figure read off a drawing's own text: a note reading is TRANSCRIBED, by
 * construction, and the store's CHECK closes the column on this one value.
 */
export const NOTE_BASIS = "TRANSCRIBED" as const;

/** The three standings a kind can hold over the readings made of it (the levels stack's own three). */
export const NOTE_STANDINGS = ["AGREED", "SUSPENDED", "NONE"] as const;

/** One of the three. */
export type NoteStandingName = (typeof NOTE_STANDINGS)[number];

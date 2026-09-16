// R-TO-034's note vocabulary, as the takeoff lane reads it: the five kinds a general note states,
// the two verdicts the seam judges a reading under, and the one basis it carries.
//
// The roster's home is `@/core/notes/law` — TRANSCRIBE_SHEET_NOTES' rendering is core and reads it
// there (ARCH-01), and the screen, the door and the store read exactly the same values here rather
// than a second list to drift (B-17, B-19).
export { NOTE_ACCEPTANCES, NOTE_BASIS, NOTE_KINDS, NOTE_STANDINGS, isNoteKind } from "@/core/notes/law";
export type { NoteAcceptance, NoteKind, NoteStandingName } from "@/core/notes/law";

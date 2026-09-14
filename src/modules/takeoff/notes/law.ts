// R-TO-034's note vocabulary, as the takeoff module reads it.
//
// The law itself is written down once in `@/core/notes/law`, because the act that re-runs the
// grammar and the CHECK the store's column is closed by both stand below a module and could not
// reach a roster kept here (ARCH-01, ARCH-02). This file is the module's door onto that one roster
// and re-publishes it unchanged — one vocabulary, however many readers (B-17, B-19).

export { isNoteKind, NOTE_ACCEPTANCES, NOTE_BASIS, NOTE_KINDS, NOTE_STANDINGS, type NoteAcceptance, type NoteKind, type NoteStandingName } from "@/core/notes/law";

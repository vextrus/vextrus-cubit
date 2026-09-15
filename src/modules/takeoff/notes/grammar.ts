// R-TO-034's note grammar, as the takeoff lane reads it: what a sheet's general notes propose.
//
// Pure — no store, no clock, no model. Its home is `@/core/notes/grammar`, because the commit half of
// TRANSCRIBE_SHEET_NOTES re-runs it to judge a reading against what was offered and the act seam is
// core, which may not reach a module (ARCH-01). One grammar, one answer, whoever asks (B-17).
export { proposeNotes } from "@/core/notes/grammar";
export type { NoteProposal, SheetText } from "@/core/notes/grammar";

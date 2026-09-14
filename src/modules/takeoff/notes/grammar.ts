// R-TO-034's notes grammar, as the takeoff module reads it.
//
// The grammar is written down once in `@/core/notes/grammar`, because TRANSCRIBE_SHEET_NOTES judges
// a committed reading by re-running it and an act stands below a module (ARCH-01). This file is the
// module's door onto that one reading of a sheet's notes and re-publishes it unchanged (B-17).

export { proposeNotes, type NoteProposal, type SheetText } from "@/core/notes/grammar";

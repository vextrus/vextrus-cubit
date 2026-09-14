// R-TO-034's sheet notes, as the takeoff lane opens them: what a sheet's general notes propose, how
// a figure stands over the readings made of it, and what the pinned campaign applies off the readings
// its own revision holds.
//
// Every one of these is written down once in `@/core/notes`, because the act that judges a committed
// reading re-runs the same grammar over the same sheet and an act is core (ARCH-01). This barrel is
// the module's door onto them, so a screen, a lane and the seam read one answer (B-17).

export { isNoteKind, NOTE_ACCEPTANCES, NOTE_BASIS, NOTE_KINDS, NOTE_STANDINGS, type NoteAcceptance, type NoteKind, type NoteStandingName } from "@/core/notes/law";
export { canonicalFigureOf, proposeNotes, type NoteProposal, type SheetText } from "@/core/notes/grammar";
export { noteReadingKey, noteStanding, type NoteReadingRef, type NoteStanding, type ReadingOfNote } from "@/core/notes/standing";
export { sheetTextsOf, type NotesSheetScope } from "@/core/notes/texts";
export {
  appliedDetailingValuesOf,
  readingsOfSheet,
  type AppliedDetailingScope,
  type AppliedDetailingValues,
  type AppliedFigure,
  type AppliedHook,
  type NoteReadingRow,
  type NotesSheet,
} from "@/core/notes/store";

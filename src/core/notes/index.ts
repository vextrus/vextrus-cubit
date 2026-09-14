// R-TO-034's note readings, whole: the law, the grammar that proposes a figure off a sheet's own
// text, the rule by which a figure stands over the readings made of it, and the one read a note is
// made over.
//
// The store is NOT published here. It reaches the database, and a caller that wants a reading
// written goes through SEAM-ACT like every other writer of a project fact (ARCH-01, SEAM-ACT) —
// `appliedDetailingValuesOf` is a read and is re-published by the takeoff module's own door.

export { isNoteKind, NOTE_ACCEPTANCES, NOTE_BASIS, NOTE_KINDS, NOTE_STANDINGS, type NoteAcceptance, type NoteKind, type NoteStandingName } from "./law";
export { canonicalFigureOf, proposeNotes, type NoteProposal, type SheetText } from "./grammar";
export { noteReadingKey, noteStanding, type NoteReadingRef, type NoteStanding, type ReadingOfNote } from "./standing";
export { sheetTextsOf, type NotesSheetScope } from "./texts";

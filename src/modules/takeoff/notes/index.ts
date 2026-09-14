// R-TO-034's notes, as the takeoff lane publishes them: what a sheet's general notes propose, how a
// kind stands over the readings made of it, and what a pinned revision therefore applies.
//
// This is the barrel a screen, a door and the rebar engine reach for. The LAW, the grammar and the
// standing live in core, because TRANSCRIBE_SHEET_NOTES' rendering reads them and the act seam is
// core (ARCH-01); what this module adds is the reads that open a transaction — the sheet's texts,
// the readings of a sheet, and the campaign's applied values (AM-03(h)).
export { NOTE_ACCEPTANCES, NOTE_BASIS, NOTE_KINDS, NOTE_STANDINGS, isNoteKind } from "./law";
export type { NoteAcceptance, NoteKind, NoteStandingName } from "./law";
export { proposeNotes } from "./grammar";
export type { NoteProposal, SheetText } from "./grammar";
export { noteReadingKey, noteStanding } from "./standing";
export type { NoteReadingRef, NoteStanding, ReadingOfNote } from "./standing";
export { sheetLayoutsOf, sheetTextsOf } from "./texts";
export type { SheetLayout, SheetTextScope } from "./texts";
export { appliedDetailingValuesOf, readingsOfSheet, readingsOnDrawings, readingsOnSheet, writeNoteReadings } from "./store";
export type { AppliedDetailingScope, AppliedDetailingValues, DetailingFigure, NoteReadingRow, NotesScope, SheetRef } from "./store";

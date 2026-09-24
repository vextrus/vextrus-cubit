// How a note reading is keyed, and how a kind stands over the readings made of it — as the takeoff
// lane reads it (R-TO-034, R-TO-051, L-REG-03).
//
// Pure. Its home is `@/core/notes/standing`, because the act's own preview names a subject by the
// key and reads what that key said before, and the act seam is core (ARCH-01).
export { noteReadingKey, noteStanding, noteStandingsByScope } from "@/core/notes/standing";
export type { NoteReadingRef, NoteStanding, ReadingOfNote, ScopedReadingOfNote } from "@/core/notes/standing";

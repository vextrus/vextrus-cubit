// How a note's figure stands over the readings made of it, as the takeoff module reads it.
//
// The rule is written down once in `@/core/notes/standing`, because the act that writes a reading
// and the screen that shows where one stands must weigh readings the same way (ARCH-01, B-17). This
// file is the module's door onto it and re-publishes it unchanged.

export { noteReadingKey, noteStanding, type NoteReadingRef, type NoteStanding, type ReadingOfNote } from "@/core/notes/standing";

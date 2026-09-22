// The note-clause question's recorder (R-TO-034). A STUB until its increment lands: the registry
// holds its line so the roster compiles, and a recording asked for is refused by name.
import type { Asked, RecorderContext } from "./recorder";

export function subjectsOf(ctx: RecorderContext): Asked[] {
  return ctx.fail("note-clause is named but not yet spelled: nothing to record");
}

"use server";
// What the schedules workspace asks the server to do: the schedules lane's own doors, reached from
// the browser.
//
// Nothing is read or decided here. The lane is mounted through the one home this workspace shares
// with the register, the coverage grid and the level stack (`../lane`), and each door's own
// `.input(parsed(...))` is the one reading of what a reader stated — a reading of its own beside that
// one would be a second answer to what is lawful (B-17, ARCH-03), so a statement this workspace
// cannot make lawfully comes back as the registered refusal the lane refused it with, never as a
// thrown Error.
import type { TranscribeSheetNotesInput } from "@/core/acts";
import type { SchedulesView } from "@/modules/takeoff/schedules-ui/view";
import { asked, schedulesLane, type DoorAnswer, type Previewed } from "../lane";

export type { DoorAnswer, Previewed } from "../lane";

/** What this workspace calls itself where a context names the client that mounted the lane. */
const CLIENT = "a schedules and notes workspace";

export async function readSchedules(projectId: string): Promise<DoorAnswer<SchedulesView>> {
  const caller = await schedulesLane(CLIENT);
  return asked(() => caller.schedules({ projectId }));
}

export async function previewTranscribeSheetNotes(input: TranscribeSheetNotesInput): Promise<DoorAnswer<Previewed>> {
  const caller = await schedulesLane(CLIENT);
  return asked(() => caller.previewTranscribeSheetNotes({ input }));
}

export async function commitTranscribeSheetNotes(input: TranscribeSheetNotesInput, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await schedulesLane(CLIENT);
  return asked(() => caller.commitTranscribeSheetNotes({ input, consequenceDigest }));
}

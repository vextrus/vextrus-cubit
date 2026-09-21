"use server";
// What the bar-schedule workspace asks the server to do: the one door of this screen, reached from
// the browser (I-270's precedent, R-TO-054).
//
// Nothing is read or decided here. The lane is mounted through the one home this workspace shares
// with the draft BOQ, the register and the coverage grid (`../lane`), and the door's own
// `.input(parsed(...))` is the one reading of what a reader stated — so a statement this workspace
// cannot make lawfully comes back as the registered refusal the lane refused it with, never as a
// thrown Error (B-17, ARCH-03).
import { asked, bbsLane, type DoorAnswer } from "../lane";

export type { DoorAnswer } from "../lane";

/** What this workspace calls itself where a context names the client that mounted the lane. */
const CLIENT = "a bar schedule workspace";

export async function exportSchedule(projectId: string): Promise<DoorAnswer<{ jobId: string; deduplicated: boolean }>> {
  const caller = await bbsLane(CLIENT);
  return asked(() => caller.exportSchedule({ projectId }));
}

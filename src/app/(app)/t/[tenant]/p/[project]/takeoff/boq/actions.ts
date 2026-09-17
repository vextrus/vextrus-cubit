"use server";
// What the draft workspace asks the server to do: the one door of this screen, reached from the
// browser (I-270).
//
// Nothing is read or decided here. The lane is mounted through the one home this workspace shares
// with the register, the coverage grid and the schedules screen (`../lane`), and the door's own
// `.input(parsed(...))` is the one reading of what a reader stated — so a statement this workspace
// cannot make lawfully comes back as the registered refusal the lane refused it with, never as a
// thrown Error (B-17, ARCH-03).
import { asked, boqLane, type DoorAnswer } from "../lane";

export type { DoorAnswer } from "../lane";

/** What this workspace calls itself where a context names the client that mounted the lane. */
const CLIENT = "a draft BOQ workspace";

export async function exportDraft(projectId: string): Promise<DoorAnswer<{ jobId: string; deduplicated: boolean }>> {
  const caller = await boqLane(CLIENT);
  return asked(() => caller.exportDraft({ projectId }));
}

/** The quantities, written now and answered as a signed link to the bytes themselves (I-272). */
export async function exportQuantities(projectId: string, kind: "xlsx" | "csv"): Promise<DoorAnswer<{ url: string; sha256: string; kind: string }>> {
  const caller = await boqLane(CLIENT);
  return asked(() => caller.exportQuantities({ projectId, kind }));
}

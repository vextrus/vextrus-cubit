"use server";
// What the register workspace asks the server to do: the lane's own doors, reached from the browser.
//
// Nothing is read or decided here. The lane is mounted through the one home this workspace and the
// coverage grid share (`../lane`), and each door's own `.input(parsed(...))` is the one reading of
// what a reader stated — a reading of its own beside that one would be a second answer to what is
// lawful (B-17, ARCH-03), so a statement this workspace cannot make lawfully comes back as the
// registered REQUEST_MALFORMED the lane refused it with, never as a thrown Error.
import type { CorroborateInput, InsertLevelInput, RepudiateInput } from "@/core/acts";
import type { MeasureRefused, MeasureRequested } from "@/modules/takeoff/measure";
import type { RegisterView } from "@/modules/takeoff/register-ui/view";
import { asked, lane, type DoorAnswer, type Previewed } from "../lane";

export type { DoorAnswer, Previewed } from "../lane";

/** What this workspace calls itself where a context names the client that mounted the lane. */
const CLIENT = "a register workspace";

export async function readRegister(projectId: string): Promise<DoorAnswer<RegisterView>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.register({ projectId }));
}

export async function previewCorroborate(input: CorroborateInput): Promise<DoorAnswer<Previewed>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.previewCorroborate({ input }));
}

export async function commitCorroborate(input: CorroborateInput, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.commitCorroborate({ input, consequenceDigest }));
}

export async function previewRepudiate(input: RepudiateInput): Promise<DoorAnswer<Previewed>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.previewRepudiate({ input }));
}

export async function commitRepudiate(input: RepudiateInput, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.commitRepudiate({ input, consequenceDigest }));
}

export async function previewInsertLevel(input: InsertLevelInput): Promise<DoorAnswer<Previewed>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.previewInsertLevel({ input }));
}

export async function commitInsertLevel(input: InsertLevelInput, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.commitInsertLevel({ input, consequenceDigest }));
}

export async function requestMeasure(projectId: string, campaignId: string): Promise<DoorAnswer<MeasureRequested | MeasureRefused>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.requestMeasure({ projectId, campaignId }));
}

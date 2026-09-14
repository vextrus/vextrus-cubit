"use server";
// What the level stack editor asks the server to do: the lane's own doors, reached from the browser.
//
// Nothing is read or decided here. The lane is mounted through the one home this workspace shares
// with the register and the coverage grid (`../lane`), and each door's own `.input(parsed(...))` is
// the one reading of what a reader stated — a reading of its own beside that one would be a second
// answer to what is lawful (B-17, ARCH-03), so a statement this workspace cannot make lawfully comes
// back as the registered refusal the lane refused it with, never as a thrown Error.
import type { AuthorStoreyHeightInput, AuthorTypicalRangeInput, InsertLevelInput, RepudiateLevelInput } from "@/core/acts";
import type { LevelsView } from "@/modules/takeoff/levels-ui/view";
import { asked, lane, type DoorAnswer, type Previewed } from "../lane";

export type { DoorAnswer, Previewed } from "../lane";

/** What this workspace calls itself where a context names the client that mounted the lane. */
const CLIENT = "a level stack editor";

export async function readLevels(projectId: string): Promise<DoorAnswer<LevelsView>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.levels({ projectId }));
}

export async function previewInsertLevel(input: InsertLevelInput): Promise<DoorAnswer<Previewed>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.previewInsertLevel({ input }));
}

export async function commitInsertLevel(input: InsertLevelInput, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.commitInsertLevel({ input, consequenceDigest }));
}

export async function previewRepudiateLevel(input: RepudiateLevelInput): Promise<DoorAnswer<Previewed>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.previewRepudiateLevel({ input }));
}

export async function commitRepudiateLevel(input: RepudiateLevelInput, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.commitRepudiateLevel({ input, consequenceDigest }));
}

export async function previewAuthorStoreyHeight(input: AuthorStoreyHeightInput): Promise<DoorAnswer<Previewed>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.previewAuthorStoreyHeight({ input }));
}

export async function commitAuthorStoreyHeight(input: AuthorStoreyHeightInput, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.commitAuthorStoreyHeight({ input, consequenceDigest }));
}

export async function previewAuthorTypicalRange(input: AuthorTypicalRangeInput): Promise<DoorAnswer<Previewed>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.previewAuthorTypicalRange({ input }));
}

export async function commitAuthorTypicalRange(input: AuthorTypicalRangeInput, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.commitAuthorTypicalRange({ input, consequenceDigest }));
}

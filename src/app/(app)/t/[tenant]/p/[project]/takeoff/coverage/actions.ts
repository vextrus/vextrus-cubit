"use server";
// What the coverage grid asks the server to do: the takeoff lane's own doors, reached from the
// browser.
//
// Nothing is read or decided here. The lane is mounted through the one home both this workspace and
// the register's share (`../lane`), and each door's own `.input(parsed(...))` is where what a reader
// pointed at BECOMES a class, a kind and a cell — one narrowing, at the lane's door, against the
// closed rosters the catalogue holds. A reading of its own beside that one would be a second answer
// to what is lawful (B-17, ARCH-03), so a statement this grid cannot make lawfully comes back as the
// registered MALFORMED the lane refused it with, never as a thrown Error.
import type { DeclareNotInProjectScopeInput, HoldOutOfBillInput } from "@/core/acts";
import type { CoverageView } from "@/modules/takeoff/coverage/view";
import { asked, lane, type DoorAnswer, type Previewed } from "../lane";

export type { DoorAnswer, Previewed } from "../lane";

/** What this workspace calls itself where a context names the client that mounted the lane. */
const CLIENT = "a coverage grid";

/**
 * The cell a boundary door is asked about, as a reader's browser states it: the act type and the
 * three coordinates of L-QTY-05's cell, in the words the grid wears. The class and the kind become
 * members of the catalogue's closed rosters at the lane's own door and nowhere earlier — a screen
 * states what a reader pointed at, and narrowing it twice would be two answers to what is lawful
 * (B-17, ARCH-03).
 */
export type BoundaryAsk = {
  readonly type: string;
  readonly projectId: string;
  readonly campaignId: string;
  readonly class: string;
  readonly kind: string;
  readonly levelId: string;
};

export async function readCoverage(projectId: string): Promise<DoorAnswer<CoverageView>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.coverage({ projectId }));
}

/**
 * The ask, as the lane's own door declares it. The door parses what it is handed against the closed
 * rosters before anything reaches the seam, so this is where a name a reader pointed at BECOMES a
 * class and a kind — the assertion states which door does the narrowing, and no second guard stands
 * beside it (B-17, ARCH-03).
 */
const declared = <T extends HoldOutOfBillInput | DeclareNotInProjectScopeInput>(ask: BoundaryAsk): T => ask as unknown as T;

export async function previewHoldOutOfBill(input: BoundaryAsk): Promise<DoorAnswer<Previewed>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.previewHoldOutOfBill({ input: declared<HoldOutOfBillInput>(input) }));
}

export async function commitHoldOutOfBill(input: BoundaryAsk, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.commitHoldOutOfBill({ input: declared<HoldOutOfBillInput>(input), consequenceDigest }));
}

export async function previewDeclareNotInProjectScope(input: BoundaryAsk): Promise<DoorAnswer<Previewed>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.previewDeclareNotInProjectScope({ input: declared<DeclareNotInProjectScopeInput>(input) }));
}

export async function commitDeclareNotInProjectScope(input: BoundaryAsk, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane(CLIENT);
  return asked(() => caller.commitDeclareNotInProjectScope({ input: declared<DeclareNotInProjectScopeInput>(input), consequenceDigest }));
}

"use server";
// What S-Ask asks the server to do: its one door, `ai.ask`, reached from the browser
// (docs/design/s-ask.md §6).
//
// Nothing is read or decided here. The lane is mounted through the one home every takeoff workspace
// shares (`../lane`), and the door's own `.input(parsed(...))` is the one reading of what a reader
// stated — so a blank or an over-long question comes back as the registered REQUEST_MALFORMED, and a
// reading naming a subject the project does not hold is resolved by the engine and refused by name,
// never as a thrown Error (B-17, ARCH-03).
//
// A failure that is NOT a registered refusal is a fault: it is recorded once, at the one seam that
// mints a report id, and the id is carried back so the answer's own ErrorState can quote it (B-21,
// §1.1's failed article) — the thread keeps every other answer standing.
import { reportFault } from "@/core/faults/report";
import type { AskAnswer, AskReading } from "@/modules/takeoff/ask/law";
import { aiLane, asked, type DoorAnswer } from "../lane";

/** What this workspace calls itself where a context names the client that mounted the lane. */
const CLIENT = "an ask the drawings workspace";

/** The file route the fault seam keys a failed question under. */
const ROUTE = "/t/[tenant]/p/[project]/takeoff/ask";

/** What one question is answered with: the door's answer or refusal, or the fault it left behind. */
export type AskDoorAnswer = DoorAnswer<AskAnswer> | { readonly ok: false; readonly fault: string };

/** What the screen states at the door: the question, and where it comes from a clarify or a follow-up, a reading. */
export type AskAsk = {
  readonly question: string;
  readonly reading?: AskReading;
  readonly previous?: AskReading;
};

export async function askTheDrawings(projectId: string, ask: AskAsk): Promise<AskDoorAnswer> {
  const requestId = globalThis.crypto.randomUUID();
  try {
    const caller = await aiLane(CLIENT);
    return await asked(() => caller.ask({ projectId, ...ask }));
  } catch (cause) {
    return { ok: false, fault: reportFault({ requestId, actor: CLIENT, route: ROUTE, cause }).faultId };
  }
}

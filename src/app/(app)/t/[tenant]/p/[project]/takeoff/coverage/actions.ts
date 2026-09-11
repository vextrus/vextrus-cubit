"use server";
// What the coverage grid asks the server to do: the takeoff lane's own doors, reached from the
// browser (the register workspace's own idiom beside this file).
//
// Nothing is decided here. Each action mounts the takeoff router with the session this request
// presents and calls the door by name, so the guard, the digest and the seam are the ONE set the wire
// already answers through — a second guard beside them would be a second answer to who may act
// (B-17, ARCH-02).
//
// A registered refusal is carried back as its code rather than thrown across the boundary, because a
// rejection crossing a server-action boundary keeps neither its marker nor its cause: the screen
// re-raises it as the refusal it is and renders the registry's own words (ARCH-03, B-21).
import { randomUUID } from "node:crypto";
import type { DeclareNotInProjectScopeInput, HoldOutOfBillInput } from "@/core/acts";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import type { CoverageView } from "@/modules/takeoff/coverage/view";
import { takeoffRouter } from "@/server/routers/takeoff";
import { sessionOf } from "@/server/shell/resolve";
import { presentedSessionToken } from "@/server/shell/session";

/** What a door answered: what the lane answered, or the registered code that stopped it. */
export type DoorAnswer<T> = { readonly ok: true; readonly answer: T } | { readonly ok: false; readonly refusal: string };

/** What a preview answers (L-ACT-02). */
export type Previewed = { consequence: unknown; consequenceDigest: string };

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

/** The address this deployment states it answers at (R-SPINE-001), as the context carries it. */
const configuredOrigin = (): string => process.env["CUBIT_PUBLIC_ORIGIN"] ?? "";

/**
 * The takeoff lane, called as the person this request presents a session for. The stated origin is
 * null: a server action is not a cross-site form post, and R-SPINE-006's rule is about a request that
 * STATES an origin — its one home decides that, not this file.
 */
async function lane() {
  const session = await sessionOf(await presentedSessionToken());
  const origin = configuredOrigin();
  return takeoffRouter.createCaller({
    requestId: randomUUID(),
    actor: session === null ? "anonymous" : session.userId,
    origin,
    statedOrigin: null,
    requestOrigin: origin,
    deviceLabel: "browser",
    client: "a coverage grid",
    session,
    secureCookies: false,
    cookies: [],
  });
}

/** Call one door and carry back what it answered, refusal included (ARCH-03). */
async function asked<T>(call: () => Promise<T>): Promise<DoorAnswer<T>> {
  try {
    return { ok: true, answer: await call() };
  } catch (thrown) {
    const code = refusalCodeOf(thrown) ?? refusalCodeOf((thrown as { cause?: unknown } | null)?.cause);
    if (code === null) throw thrown;
    return { ok: false, refusal: code };
  }
}

export async function readCoverage(projectId: string): Promise<DoorAnswer<CoverageView>> {
  const caller = await lane();
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
  const caller = await lane();
  return asked(() => caller.previewHoldOutOfBill({ input: declared<HoldOutOfBillInput>(input) }));
}

export async function commitHoldOutOfBill(input: BoundaryAsk, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane();
  return asked(() => caller.commitHoldOutOfBill({ input: declared<HoldOutOfBillInput>(input), consequenceDigest }));
}

export async function previewDeclareNotInProjectScope(input: BoundaryAsk): Promise<DoorAnswer<Previewed>> {
  const caller = await lane();
  return asked(() => caller.previewDeclareNotInProjectScope({ input: declared<DeclareNotInProjectScopeInput>(input) }));
}

export async function commitDeclareNotInProjectScope(
  input: BoundaryAsk,
  consequenceDigest: string,
): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane();
  return asked(() => caller.commitDeclareNotInProjectScope({ input: declared<DeclareNotInProjectScopeInput>(input), consequenceDigest }));
}

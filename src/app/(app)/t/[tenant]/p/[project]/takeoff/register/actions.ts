"use server";
// What the register workspace asks the server to do: the lane's own doors, reached from the browser.
//
// Nothing is decided here. Each action mounts the takeoff lane's router with the session this
// request presents and calls the door by name, so the guard, the digest and the seam are the ONE set
// the wire already answers through — a second guard beside them would be a second answer to who may
// act (B-17, ARCH-02).
//
// A registered refusal is carried back as its code rather than thrown across the boundary, because a
// rejection crossing a server-action boundary keeps neither its marker nor its cause: the screen
// re-raises it as the refusal it is and renders the registry's own words (ARCH-03, B-21).
import { randomUUID } from "node:crypto";
import type { CorroborateInput, InsertLevelInput, RepudiateInput } from "@/core/acts";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import type { MeasureRefused, MeasureRequested } from "@/modules/takeoff/measure";
import type { RegisterView } from "@/modules/takeoff/register-ui/view";
import { takeoffRouter } from "@/server/routers/takeoff";
import { sessionOf } from "@/server/shell/resolve";
import { presentedSessionToken } from "@/server/shell/session";

/** What a door answered: what the lane answered, or the registered code that stopped it. */
export type DoorAnswer<T> = { readonly ok: true; readonly answer: T } | { readonly ok: false; readonly refusal: string };

/** What a preview answers (L-ACT-02). */
export type Previewed = { consequence: unknown; consequenceDigest: string };

/** The address this deployment states it answers at (R-SPINE-001), as the context carries it. */
const configuredOrigin = (): string => process.env["CUBIT_PUBLIC_ORIGIN"] ?? "";

/**
 * The takeoff lane, called as the person this request presents a session for. The stated origin is
 * null: a server action is not a cross-site form post, and R-SPINE-006's rule is about a request
 * that STATES an origin — its one home decides that, not this file.
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
    client: "a register workspace",
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

export async function readRegister(projectId: string): Promise<DoorAnswer<RegisterView>> {
  const caller = await lane();
  return asked(() => caller.register({ projectId }));
}

export async function previewCorroborate(input: CorroborateInput): Promise<DoorAnswer<Previewed>> {
  const caller = await lane();
  return asked(() => caller.previewCorroborate({ input }));
}

export async function commitCorroborate(input: CorroborateInput, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane();
  return asked(() => caller.commitCorroborate({ input, consequenceDigest }));
}

export async function previewRepudiate(input: RepudiateInput): Promise<DoorAnswer<Previewed>> {
  const caller = await lane();
  return asked(() => caller.previewRepudiate({ input }));
}

export async function commitRepudiate(input: RepudiateInput, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane();
  return asked(() => caller.commitRepudiate({ input, consequenceDigest }));
}

export async function previewInsertLevel(input: InsertLevelInput): Promise<DoorAnswer<Previewed>> {
  const caller = await lane();
  return asked(() => caller.previewInsertLevel({ input }));
}

export async function commitInsertLevel(input: InsertLevelInput, consequenceDigest: string): Promise<DoorAnswer<{ actId: string }>> {
  const caller = await lane();
  return asked(() => caller.commitInsertLevel({ input, consequenceDigest }));
}

export async function requestMeasure(projectId: string, campaignId: string): Promise<DoorAnswer<MeasureRequested | MeasureRefused>> {
  const caller = await lane();
  return asked(() => caller.requestMeasure({ projectId, campaignId }));
}

// The takeoff lane, as the two workspaces of this route reach it from a browser (ARCH-02, B-17).
//
// The coverage grid and the register workspace were each keeping their own copy of this: the same
// caller, mounted the same way, with the same reading of what a door answered. One copy is the
// point — a second would be a second answer to how a screen reaches the lane, and the two had
// already begun to drift in their prose.
//
// Nothing is decided here. A door is called with the session this request presents, so the guard,
// the digest and the seam are the ONE set the wire already answers through — a second guard beside
// them would be a second answer to who may act (B-17, ARCH-02).
//
// A registered refusal is carried back as its code rather than thrown across the boundary, because a
// rejection crossing a server-action boundary keeps neither its marker nor its cause: the screen
// re-raises it as the refusal it is and renders the registry's own words (ARCH-03, B-21).
import { actionContext, refused } from "@/server/call";
import { takeoffRouter } from "@/server/routers/takeoff";

/** What a door answered: what the lane answered, or the registered code that stopped it. */
export type DoorAnswer<T> = { readonly ok: true; readonly answer: T } | { readonly ok: false; readonly refusal: string };

/** What a preview answers (L-ACT-02). */
export type Previewed = { consequence: unknown; consequenceDigest: string };

/**
 * The lane, called as the person this request presents a session for. The context is the one server
 * -call seam's (`@/server/call`), so the presented session is resolved once for the action whatever
 * it goes on to do with it, and the origin facts a server action carries are stated in one place.
 */
export async function lane(client: string) {
  return takeoffRouter.createCaller(await actionContext(client));
}

/** Call one door and carry back what it answered, refusal included (ARCH-03). */
export async function asked<T>(call: () => Promise<T>): Promise<DoorAnswer<T>> {
  try {
    return { ok: true, answer: await call() };
  } catch (thrown) {
    return { ok: false, refusal: refused(thrown) };
  }
}

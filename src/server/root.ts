// The composition root: one namespace per module lane, each defined in its own file, so a lane's
// procedures are added in that lane's file and the root never changes hands (ARCH-01, ARCH-02).
import { aiRouter } from "./routers/ai";
import { assureRouter } from "./routers/assure";
import { bidRouter } from "./routers/bid";
import { spineRouter } from "./routers/spine";
import { takeoffRouter } from "./routers/takeoff";
import { answerFor, router, type AnswerRequest } from "./trpc";
import type { AppContext } from "./context";

/**
 * The closed lane set of the layered tree (ARCH-01) — each namespace is its own file's router, and
 * this table is where a seam reads a lane by name (ARCH-02).
 *
 * The router factory copies every nested namespace into a record of its own, so `appRouter.spine`
 * is the factory's copy and not the lane. Writing the lanes back over that copy would be this file
 * reaching into another module's private state to make a public fact true; the fact has a home
 * here instead, and what the root MOUNTS is what it dispatches — every procedure it resolves under
 * `<lane>.<path>` is the lane's own procedure, because the factory carries those objects through.
 */
export const lanes = Object.freeze({
  spine: spineRouter,
  takeoff: takeoffRouter,
  bid: bidRouter,
  assure: assureRouter,
  ai: aiRouter,
});

export const appRouter = router(lanes);

export type AppRouter = typeof appRouter;

/**
 * ARCH-03: the transport's one hand-off to the fault seam. Every failure the handler sees passes
 * here — a refusal is recognised and left alone, everything else is recorded before the client is
 * told anything at all. Mounted as `onError` by every handler that serves this router.
 */
export function trpcOnError(opts: AnswerRequest): void {
  answerFor(opts);
}

/**
 * R-SPINE-001: the transport's other hand-off. A door that hands out or ends a session puts the
 * cookie on the context (`AppContext.cookies`) and never touches a header; this is the one place
 * those become `Set-Cookie`, so no procedure knows the wire and the header is written exactly once
 * per response. Mounted as `responseMeta` by every handler that serves this router, beside
 * `trpcOnError` — the handler stays wiring.
 */
export function trpcResponseMeta({ ctx }: { ctx?: AppContext | undefined }): { headers?: Headers } {
  const cookies = ctx?.cookies ?? [];
  if (cookies.length === 0) return {};
  const headers = new Headers();
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return { headers };
}

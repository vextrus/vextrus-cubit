// The composition root: one namespace per module lane, each defined in its own file, so a lane's
// procedures are added in that lane's file and the root never changes hands (ARCH-01, ARCH-02).
import { aiRouter } from "./routers/ai";
import { assureRouter } from "./routers/assure";
import { bidRouter } from "./routers/bid";
import { spineRouter } from "./routers/spine";
import { takeoffRouter } from "./routers/takeoff";
import { answerFor, router, type AnswerRequest } from "./trpc";
import type { AppContext } from "./context";

/** The closed lane set of the layered tree (ARCH-01) — each namespace is its own file's router. */
const lanes = {
  spine: spineRouter,
  takeoff: takeoffRouter,
  bid: bidRouter,
  assure: assureRouter,
  ai: aiRouter,
};

const composed = router(lanes);

// ARCH-02: a lane has exactly one home. The router factory copies every nested namespace into a
// fresh plain record, which would leave each lane with a second identity at the root — the same
// procedures behind a different object. Binding each lane's own router back onto its namespace
// keeps `appRouter.spine` and `routers/spine.ts` the same value. Dispatch is untouched: procedures
// are resolved through `_def.procedures`, and a router nested under a namespace is exactly what the
// factory reads when this root is itself composed.
Object.assign(composed, lanes);
Object.assign(composed._def.record, lanes);

export const appRouter = composed;

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

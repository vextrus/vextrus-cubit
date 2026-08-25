// The composition root: one namespace per module lane, each defined in its own file, so a lane's
// increment edits its own router and the root never changes hands (ARCH-01, ARCH-02).
import { aiRouter } from "./routers/ai";
import { assureRouter } from "./routers/assure";
import { bidRouter } from "./routers/bid";
import { spineRouter } from "./routers/spine";
import { takeoffRouter } from "./routers/takeoff";
import { answerFor, router, type AnswerRequest } from "./trpc";

export const appRouter = router({
  spine: spineRouter,
  takeoff: takeoffRouter,
  bid: bidRouter,
  assure: assureRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;

/**
 * ARCH-03: the transport's one hand-off to the fault seam. Every failure the handler sees passes
 * here — a refusal is recognised and left alone, everything else is recorded before the client is
 * told anything at all. Mounted as `onError` by every handler that serves this router.
 */
export function trpcOnError(opts: AnswerRequest): void {
  answerFor(opts);
}

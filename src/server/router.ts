import { router } from './trpc';
import { spineRouter } from './routers/spine';
import { aiRouter } from './routers/ai';
import { takeoffRouter } from '../modules/takeoff/router';
import { assureRouter } from '../modules/assure/router';
import { bookRouter } from '../modules/book/router';
import { estimateRouter } from '../modules/estimate/router';
import { bidRouter } from '../modules/bid/router';

/**
 * AS-A1 — the whole composition, written once in the Foundation increment. Each
 * module owns its own router file; this file only mounts them, so an increment
 * that fills a module in never edits composition and two increments never
 * collide here.
 */
export const appRouter = router({
  spine: spineRouter,
  takeoff: takeoffRouter,
  assure: assureRouter,
  book: bookRouter,
  estimate: estimateRouter,
  bid: bidRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;

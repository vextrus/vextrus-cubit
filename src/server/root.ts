/**
 * The one router the product serves (C-05, B-03).
 *
 * `appRouter` mounts exactly one namespace per module, each from its own file in
 * `src/server/routers`. Founding a module founds its namespace here and nowhere else, which is
 * why this file belongs to module-founding increments alone.
 *
 * `initTRPC` appears here for one value only: `createCallerFactory`, which tRPC v11 hands out
 * on a root instance rather than as a free function. The instance is not exported, no procedure
 * is built from it, and its context type is `TenantCtx` like the one in src/server/trpc.ts — so
 * there is still no way to reach a procedure whose context is not the tenant scope.
 */
import { initTRPC } from '@trpc/server';
import type { TenantCtx } from './context';
import { spineRouter } from './routers/spine';
import { router } from './trpc';

export const appRouter = router({
  spine: spineRouter,
});

/** The shape a client is typed against — the whole API, as a type and nothing more. */
export type AppRouter = typeof appRouter;

/**
 * Drive the API in-process over a `TenantCtx` built by the caller: what acceptance uses to
 * exercise a procedure without a socket, and what a server-side render would use.
 */
export const createCaller = initTRPC.context<TenantCtx>().create().createCallerFactory(appRouter);

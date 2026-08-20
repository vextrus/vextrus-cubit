import { publicProcedure, router } from '../trpc';

/** The spine's own procedures: identity, tenancy and the machine's own health. */
export const spineRouter = router({
  health: router({
    /** The gate's liveness probe — V-E2E asks for it over /api/trpc. */
    ping: publicProcedure.query(() => 'ok' as const),
  }),
});

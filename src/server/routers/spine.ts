// The spine lane: the tier's own answers about itself, and the identity doors the platform's own
// people come through (R-SPINE-001). The auth namespace is defined in `../auth/router.ts` — the
// lane composes it here, so `spine.auth.*` has one home and this file stays a table of contents.
import { authRouter } from "../auth/router";
import { publicProcedure, router } from "../trpc";

export const spineRouter = router({
  /** Liveness plus the request id the tier minted, so a caller can prove which request it got. */
  health: publicProcedure.query(({ ctx }) => ({ ok: true as const, requestId: ctx.requestId })),

  auth: authRouter,
});

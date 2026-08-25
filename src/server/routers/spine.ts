// The spine lane: the tier's own answers about itself. No domain, no database.
import { publicProcedure, router } from "../trpc";

export const spineRouter = router({
  /** Liveness plus the request id the tier minted, so a caller can prove which request it got. */
  health: publicProcedure.query(({ ctx }) => ({ ok: true as const, requestId: ctx.requestId })),
});

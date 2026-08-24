/**
 * The act seam's API surface (R-SPINE-011, L-ACT-02, L-ACT-03, SEAM-ACT).
 *
 * One router file per module, and this one is the act seam's. It holds no law: the permission
 * check, the digest and the single-statement write are `src/core/acts`' own, reached through
 * that module's barrel and nothing behind it — L-ACT-01 makes the seam "the sole writer of the
 * log and unimportable elsewhere", so what this file does is turn a request into an `ActCtx`
 * and a refusal into a transport code.
 *
 * The pair is `actPair`, which is L-ACT-02's shape made the only shape available: an act type
 * mounted here has a `preview` and a `commit` or it does not compile.
 *
 * The refusals arrive at a caller as the TRPCError *message*, verbatim (the spine.ts
 * convention): `PERMISSION_NOT_HELD` is what the seam said, and translating it into prose here
 * would mean two places deciding what a refusal is called.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  ROLE_BUNDLES,
  commitAct,
  listParticipantHistory,
  previewAct,
  refusalCodeOf,
} from '../../core/acts';
import { ACT_TYPE } from '../../core/acts';
import type { ActCtx, ActRefusalCode, Role } from '../../core/acts';
import type { TenantCtx, TrpcCode } from '../context';
import { actPair, router, tenantProcedure } from '../trpc';

/**
 * The roles a human may pick, derived from the bundles rather than spelled.
 *
 * Q-07: the register reads every screaming-snake literal under `src/` as a refusal code, and a
 * role name written into a `z.enum([...])` would be one. Deriving the enum from the closed
 * vocabulary also means a role founded in L-ACT-03's table reaches the wire without a second
 * edit — the list has one source, and it is the law's.
 */
const roleNames = Object.keys(ROLE_BUNDLES) as [Role, ...Role[]];

const assignInput = z.object({
  projectId: z.string(),
  userId: z.string(),
  role: z.enum(roleNames),
});

/** The project whose history is being read. */
const historyInput = z.object({ projectId: z.string() });

/**
 * The seam's context, built from the request's own (SEAM-ACT: "refuses non-human actors by
 * type"). The actor is the signed-in human `createContext` resolved, and there is no parameter
 * a caller could put anybody else in.
 */
function acting(ctx: TenantCtx): ActCtx {
  return { db: ctx.db, tenantId: ctx.tenantId, actorId: ctx.userId };
}

/**
 * Which transport code each of the seam's refusals travels as.
 *
 * Total over the seam's own taxonomy, so a fourth refusal is a compile error here rather than
 * one that quietly inherits somebody else's meaning. Only one of the three is about authority:
 * `PERMISSION_NOT_HELD` is a caller who may not do this, while a stale digest and a project
 * about to lose its last principal are preconditions the *state* fails.
 */
const TRANSPORT_OF: Readonly<Record<ActRefusalCode, TrpcCode>> = {
  PERMISSION_NOT_HELD: 'FORBIDDEN',
  CONSEQUENCES_NOT_CARRIED: 'CONFLICT',
  PROJECT_WOULD_HAVE_NO_PRINCIPAL: 'CONFLICT',
};

/** Run a seam call, surfacing its refusal code as the exact message of its transport code. */
async function performing<T>(act: () => Promise<T>): Promise<T> {
  try {
    return await act();
  } catch (error: unknown) {
    const code = refusalCodeOf(error);
    if (code === null) throw error;
    throw new TRPCError({ code: TRANSPORT_OF[code], message: code });
  }
}

/**
 * R-SPINE-011: "assign roles by act (`ASSIGN_PARTICIPANT_ROLE`) with preview → consequence".
 *
 * The preview is a mutation rather than a query because it is what a dialog opens on and a
 * query would be cached: L-ACT-02's Consequence is computed from current state each time it is
 * shown, and a commit checks that state still produces it. Nothing is written by either call
 * until the digest matches.
 */
const assignParticipantRole = actPair({
  preview: tenantProcedure.input(assignInput).mutation(async ({ ctx, input }) => {
    const previewed = await performing(async () =>
      previewAct(acting(ctx), ACT_TYPE.ASSIGN_PARTICIPANT_ROLE, input),
    );
    return { consequence: previewed.consequence, consequenceDigest: previewed.digest };
  }),

  commit: tenantProcedure
    .input(assignInput.extend({ consequenceDigest: z.string() }))
    .mutation(async ({ ctx, input }) =>
      performing(async () =>
        commitAct(
          acting(ctx),
          ACT_TYPE.ASSIGN_PARTICIPANT_ROLE,
          input,
          input.consequenceDigest,
        ),
      ),
    ),
});

export const actsRouter = router({
  assignParticipantRole,

  /** R-SPINE-011: "role history visible" — every grant this project has made, oldest first. */
  participantHistory: tenantProcedure
    .input(historyInput)
    .query(async ({ ctx, input }) =>
      performing(async () => listParticipantHistory(acting(ctx), input.projectId)),
    ),
});

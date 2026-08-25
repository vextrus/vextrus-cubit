// The tRPC init: the one place the transport is configured, and therefore the one place a failure
// is turned into an answer. ARCH-03 and B-21 want three different answers on the wire — a server
// fault, an expired session and a refusal — so the shape a client reads is stamped with which of
// them it is, and a fault is recorded through the core seam before anything user-facing is shaped.
import { TRPCError, initTRPC } from "@trpc/server";
import { reportFault } from "../core/faults/report";
import { refusalCodeOf } from "../core/faults/refusal-marker";
import type { AppContext } from "./context";

/** A failure the operator must see: the id to quote, and the request it belongs to. */
export interface FaultAnswer {
  kind: "fault";
  faultId: string;
  requestId: string;
}

/** A failure that is an answer, not an outage: the code, for the registry's renderer to read. */
export interface RefusalAnswer {
  kind: "refusal";
  refusalCode: string;
}

export type ErrorAnswer = FaultAnswer | RefusalAnswer;

/** What a fault is attributed to when the transport failed before it knew: never silence. */
const UNATTRIBUTED = "unattributed";

/**
 * One failure, one answer. tRPC shows the same error twice — to `onError` and to the error
 * formatter — and B-21 wants exactly one FaultRecord per failure, so the decision is taken once
 * and memoised against the error itself; whichever side asks first is the one that records it.
 */
const decided = new WeakMap<object, ErrorAnswer>();

export interface AnswerRequest {
  error: unknown;
  path?: string | undefined;
  ctx?: Partial<AppContext> | undefined;
}

/**
 * Decide (and, for a fault, record) how this failure is answered. Idempotent per error object.
 */
export function answerFor(request: AnswerRequest): ErrorAnswer {
  const key = typeof request.error === "object" && request.error !== null ? request.error : null;
  const remembered = key === null ? undefined : decided.get(key);
  if (remembered !== undefined) return remembered;

  const answer = decide(request);
  if (key !== null) decided.set(key, answer);
  return answer;
}

function decide(request: AnswerRequest): ErrorAnswer {
  const failure = thrownValue(request.error);

  const refusalCode = refusalCodeOf(failure);
  if (refusalCode !== null) return { kind: "refusal", refusalCode };

  const requestId = request.ctx?.requestId ?? UNATTRIBUTED;
  const { faultId } = reportFault({
    requestId,
    actor: request.ctx?.actor ?? UNATTRIBUTED,
    route: request.path !== undefined && request.path !== "" ? request.path : UNATTRIBUTED,
    cause: failure,
  });
  return { kind: "fault", faultId, requestId };
}

/**
 * What the procedure actually threw. tRPC wraps anything that is not already a `TRPCError`, and
 * the refusal marker — like the message an operator needs — sits on the wrapped value.
 */
function thrownValue(error: unknown): unknown {
  if (error instanceof TRPCError && error.cause !== undefined) return error.cause;
  return error;
}

const t = initTRPC.context<AppContext>().create({
  errorFormatter({ shape, error, ctx, path }) {
    const answer = answerFor({ error, path, ctx });
    return {
      ...shape,
      // The user-facing answer carries the id or the code and nothing the tier knows internally:
      // a fault's cause belongs on the fault sink, never on the wire (ARCH-03).
      message: answer.kind === "fault" ? answer.faultId : answer.refusalCode,
      data: answer,
    };
  },
});

/** The router factory every lane composes with — and so the formatter every lane answers through. */
export const router = t.router;

/** The procedure every lane builds on. Guards and sessions arrive in later spine increments. */
export const publicProcedure = t.procedure;

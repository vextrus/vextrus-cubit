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
 * One failure, one answer. tRPC shows the same failure twice — once to `onError`, once to the error
 * formatter — and B-21 wants exactly one FaultRecord per failure, so the decision is taken once and
 * handed to whichever of the two asks second.
 *
 * The memo is anchored on the *context object* the request was minted with, because that object is
 * the only thing in reach whose lifetime is the request's. Nothing may be assumed about the second
 * reader arriving at all: a response can be aborted or streamed away before it is shaped, a mount
 * may wire `onError` and no formatter, and a future adapter may call only one of the two. An entry
 * left unconsumed by such a failure must never be able to answer a *later* one — a later request
 * carries a different context object, so it cannot reach this entry, and the entry itself is
 * collected with the request that made it. (Keying on the thrown object instead cannot do this: a
 * module-scope constant or a re-thrown singleton is one object across many failures, and a stale
 * entry under a caller-supplied — therefore repeatable — request id would hand a real outage the
 * earlier failure's answer, so `reportFault` would never run and the operator would get no record.)
 *
 * Within one context an entry is matched on the failing route and the thrown value's own identity,
 * which is what separates two failing procedures inside one batch — those share one context.
 *
 * The two callbacks are not in the same synchronous tick (@trpc/server 11.18.0 calls `onError`
 * inside the per-call catch and `getErrorShape` after the batch's calls settle), so entries must
 * survive interleaving and must not clobber each other: each call keeps its own entry, and the
 * second reader consumes it. Nothing bounds how many calls a batch may carry, and every one of them
 * is unconsumed until the batch settles, so the entries a request holds are never capped: evicting
 * one before its formatter arrives would have that formatter decide the failure a second time and
 * file a second FaultRecord — the double record B-21 forbids, and the very thing the memo is for.
 * They need no cap to be safe: the whole set is anchored on the request's context object, so it is
 * collected with the request whether or not the second readers ever came.
 */
interface MemoEntry {
  /** The thrown value, compared by identity — two failures are the same failure or they are not. */
  error: unknown;
  route: string;
  answer: ErrorAnswer;
}

interface AnswerMemo {
  /** Decisions for one request, held only as long as that request's context object is. */
  byRequest: WeakMap<object, MemoEntry[]>;
}

/**
 * ARCH-02 reads "one home" as an identity property, and a module-scope singleton only holds it for
 * as long as the module instance does. Nothing guarantees one instance: a bundler may compile this
 * file into two graphs (Next's route-handler and server-component graphs are separate), and a
 * module runner may instantiate it twice when two importers race the same first import. Either way
 * `onError` and the error formatter would then hold *different* memos, and one outage would reach
 * the sink as two FaultRecords with two ids — the operator reading double, and B-21's "one failure,
 * one record" broken by a packaging detail. The memo is therefore anchored to the process.
 */
const MEMO_KEY = Symbol.for("vextrus.cubit.server.trpc.answerMemo");

const processScope = globalThis as typeof globalThis & { [MEMO_KEY]?: AnswerMemo };

const memos: AnswerMemo = (processScope[MEMO_KEY] ??= {
  byRequest: new WeakMap<object, MemoEntry[]>(),
});

export interface AnswerRequest {
  error: unknown;
  path?: string | undefined;
  ctx?: Partial<AppContext> | undefined;
}

/**
 * Decide (and, for a fault, record) how this failure is answered. Idempotent within one call: the
 * second of `onError`/the formatter to ask is handed the first one's answer.
 */
export function answerFor(request: AnswerRequest): ErrorAnswer {
  const requestId = request.ctx?.requestId ?? UNATTRIBUTED;
  const route = request.path !== undefined && request.path !== "" ? request.path : UNATTRIBUTED;
  const anchor = anchorOf(request.ctx);

  // A failure that arrived with no context has nothing request-scoped to remember it against. It is
  // decided afresh, because every substitute anchor is worse: a deadline, or the thrown value on its
  // own, would hand a genuinely later unattributed outage the earlier one's answer — `reportFault`
  // would never run for it and the operator would get no record at all, which is the failure B-21
  // forbids most. Deciding twice at worst records twice; deciding never records nothing.
  if (anchor === null) return decide(request, requestId, route);

  let entries = memos.byRequest.get(anchor);
  if (entries === undefined) {
    entries = [];
    memos.byRequest.set(anchor, entries);
  }

  // Matched on the thrown value's own identity and the failing route — what separates two failing
  // procedures inside one batch, which share one context. Comparing the value itself rather than a
  // key derived from it means two different calls can never collide into one entry and leave one
  // FaultRecord for two outages (B-21).
  const remembered = entries.find((entry) => Object.is(entry.error, request.error) && entry.route === route);
  if (remembered !== undefined) {
    // Consumed: one failure is shown to exactly two readers, and the entry has now served both.
    entries.splice(entries.indexOf(remembered), 1);
    return remembered.answer;
  }

  const answer = decide(request, requestId, route);
  entries.push({ error: request.error, route, answer });
  return answer;
}

/**
 * The request-scoped object a decision may be remembered against: the context tRPC minted for this
 * request and hands to both `onError` and the error formatter. It is the anchor precisely because
 * it dies with the request — a later failure gets a later context and can never read this one's
 * entries, so an entry no second reader ever came for suppresses nothing.
 */
function anchorOf(ctx: AnswerRequest["ctx"]): object | null {
  return typeof ctx === "object" && ctx !== null ? ctx : null;
}

function decide(request: AnswerRequest, requestId: string, route: string): ErrorAnswer {
  // The marker is read one level deep — the value itself or its direct `cause` — from the value the
  // *procedure* threw. When tRPC wrapped a plain failure, that is the wrapper's cause; when the
  // procedure threw a `TRPCError` itself, tRPC hands that very object over and its `cause` is a
  // second-level detail the developer attached, not the failure. Probing below it would let a
  // grandchild marker turn an outage into a silent refusal, which is the worse failure.
  const refusalCode = refusalCodeOf(thrownValue(request.error));
  if (refusalCode !== null) return { kind: "refusal", refusalCode };

  const { faultId } = reportFault({
    requestId,
    actor: request.ctx?.actor ?? UNATTRIBUTED,
    route,
    cause: underlyingCause(request.error),
  });
  return { kind: "fault", faultId, requestId };
}

/**
 * What the procedure actually threw. tRPC wraps anything that is not already a `TRPCError` in a
 * synthetic one built with no message of its own (`getTRPCErrorFromUnknown` → `new TRPCError({ code:
 * "INTERNAL_SERVER_ERROR", cause })`, whose message is then the cause's), so that shape — and only
 * that shape — is unwrapped. A `TRPCError` the procedure threw deliberately is itself the value.
 */
function thrownValue(error: unknown): unknown {
  if (!(error instanceof TRPCError) || error.cause === undefined) return error;
  const synthetic = error.code === "INTERNAL_SERVER_ERROR" && error.message === error.cause.message;
  return synthetic ? error.cause : error;
}

/**
 * What the operator needs to read on the record: the underlying failure, whichever wrapper carried
 * it. Unlike the marker probe this may look through a deliberate `TRPCError` too — a cause is
 * evidence for the sink, and there it can only ever add detail.
 */
function underlyingCause(error: unknown): unknown {
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

/** The procedure every lane builds on; guards layer on top of it, never beside it (SEAM-ACT). */
export const publicProcedure = t.procedure;

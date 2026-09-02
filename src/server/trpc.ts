// The tRPC init: the one place the transport is configured, and therefore the one place a failure
// is turned into an answer. ARCH-03 and B-21 want three different answers on the wire — a server
// fault, an expired session and a refusal — so the shape a client reads is stamped with which of
// them it is, and a fault is recorded through the core seam before anything user-facing is shaped.
import { TRPCError, initTRPC } from "@trpc/server";
import { REFUSALS, type RefusalCode } from "../core/errors";
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
 * The most unconsumed answers one request's memo holds. Beyond it the answer whose failure first
 * appeared longest ago is evicted, and its late reader decides afresh — a second FaultRecord for
 * one failure, which is the safe direction: an operator reading double still reads it, while an
 * evicted answer that silenced its reader would leave the outage unrecorded (B-21, ARCH-03).
 */
export const ANSWER_MEMO_CAP = 1024;

/**
 * One failure, one answer. tRPC shows the same failure twice — once to `onError`, once to the error
 * formatter — and B-21 wants exactly one FaultRecord per failure, so the decision is taken once and
 * handed to whichever of the two asks second (ARCH-03: the fault seam records every failure once,
 * before anything user-facing is shaped).
 *
 * The memo's key is (context, route, identity): the context object the request was minted with, the
 * route that failed, and the thrown value's own identity. Each part answers a way two readers could
 * be confused about which failure they are looking at:
 *
 *   - the CONTEXT is the only thing in reach whose lifetime is the request's, so an entry no second
 *     reader ever came for (an aborted response, a mount that wires `onError` and no formatter)
 *     cannot answer a *later* request: a later request carries a different context object and the
 *     entry is collected with the request that made it. Keying on the thrown value alone cannot do
 *     this — a re-thrown singleton is one object across many failures — and keying on a
 *     caller-supplied request id would hand a real outage an earlier failure's answer, so
 *     `reportFault` would never run and the operator would get no record at all;
 *   - the ROUTE separates two failing procedures inside one batch, which share one context;
 *   - the IDENTITY is the object itself for an object and the type-and-value for a primitive, so a
 *     pool wrapper re-throwing the string `"the pool is down"` on two calls is two failures and the
 *     number `1` is not the string `"1"`.
 *
 * A key holds a FIFO of answers rather than one, so two identical failures on one route in one
 * request each leave their own record and each reader consumes the answer made for it: the count of
 * records is the count of failures, never fewer.
 *
 * The two callbacks are not in the same synchronous tick (@trpc/server 11.18.0 calls `onError`
 * inside the per-call catch and `getErrorShape` after the batch's calls settle), so entries survive
 * interleaving. What is bounded is the number of answers waiting to be consumed
 * (`ANSWER_MEMO_CAP`); the key's PLACE in the memo is its first appearance, so a request whose
 * distinct failures outnumber the cap evicts the same oldest failures each time instead of sweeping
 * the memo and making every later reader decide again.
 */
interface RequestMemo {
  /** Unconsumed answers per key, in first-appearance order — a Map iterates as it was filled. */
  byKey: Map<string, ErrorAnswer[]>;
  unconsumed: number;
}

interface AnswerMemo {
  /** Decisions for one request, held only as long as that request's context object is. */
  byRequest: WeakMap<object, RequestMemo>;
  /** The identity a thrown object is remembered by, minted once and collected with the object. */
  identities: WeakMap<object, string>;
  minted: number;
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
  byRequest: new WeakMap<object, RequestMemo>(),
  identities: new WeakMap<object, string>(),
  minted: 0,
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

  let memo = memos.byRequest.get(anchor);
  if (memo === undefined) {
    memo = { byKey: new Map<string, ErrorAnswer[]>(), unconsumed: 0 };
    memos.byRequest.set(anchor, memo);
  }

  // The route is written with its own length, so no route-and-identity pair spells another's key.
  const keyed = `${route.length}:${route}:${identityOf(request.error)}`;
  const waiting = memo.byKey.get(keyed);
  const remembered = waiting?.shift();
  if (remembered !== undefined) {
    // Consumed: one failure is shown to exactly two readers, and this answer has now served both.
    memo.unconsumed -= 1;
    return remembered;
  }

  const answer = decide(request, requestId, route);
  if (waiting === undefined) memo.byKey.set(keyed, [answer]);
  else waiting.push(answer);
  memo.unconsumed += 1;
  if (memo.unconsumed > ANSWER_MEMO_CAP) evictOldest(memo);
  return answer;
}

/**
 * The identity a thrown value is remembered by: the value itself for an object (an id minted once
 * and collected with it), and its type together with its value for a primitive — so `1` and `"1"`
 * are two failures, as two calls that threw them are (B-21).
 */
function identityOf(error: unknown): string {
  if (typeof error !== "object" && typeof error !== "function") return `${typeof error}:${String(error)}`;
  if (error === null) return "object:null";
  const held = memos.identities.get(error);
  if (held !== undefined) return held;
  memos.minted += 1;
  const minted = `object:${memos.minted}`;
  memos.identities.set(error, minted);
  return minted;
}

/**
 * Make room: the answer whose key first appeared longest ago goes, and its late reader decides
 * afresh rather than being handed silence (B-21). Keys keep their place once they have one, so a
 * request that keeps failing past the cap evicts the same oldest failures rather than sweeping the
 * memo — including, when the memo is full and a long-evicted failure is asked about again, the
 * answer just made for it.
 */
function evictOldest(memo: RequestMemo): void {
  for (const waiting of memo.byKey.values()) {
    if (waiting.length === 0) continue;
    waiting.shift();
    memo.unconsumed -= 1;
    return;
  }
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

/**
 * The status a refusal travels with. ARCH-03's distinction is not only a thing screens draw — it is
 * a thing the wire says. A refusal is the answer a well-formed request earned, so it can never be a
 * 5xx: on 500 a registered refusal is indistinguishable from the server having failed, and every
 * reader that is not our own screen — a browser's console, a proxy, an uptime monitor, an operator
 * reading access logs — records a live door as an outage.
 *
 * 400 is the floor they share: understood, and not carried out. The codes HTTP itself has a name for
 * are given that name, so those readers agree with the taxonomy rather than merely not contradicting
 * it. A code with no HTTP name keeps the floor, which is why this table is partial by design — the
 * taxonomy is closed and this is a translation of it, not a second copy (B-17). It is keyed by
 * `RefusalCode`, so a code renamed or retired in the register is a compile error here.
 */
const REFUSAL_STATUS_FLOOR = 400;

const REFUSAL_STATUS: Readonly<Partial<Record<RefusalCode, number>>> = Object.freeze({
  SIGNED_OUT: 401,
  PERMISSION_NOT_HELD: 403,
  ACCOUNT_ALREADY_EXISTS: 409,
  RATE_LIMITED: 429,
});

/**
 * What the transport puts on the response for this answer — read by tRPC's own status resolver.
 *
 * A fault travels with the status tRPC decided for the error it handed over: a procedure nobody
 * wrote is 404 and a body nobody could read is 400, and answering either as 500 tells the operator
 * their tier is down when it is answering exactly as it should. A refusal travels with the
 * register's status instead, whatever TRPCError code carried it, because a refusal is the answer a
 * well-formed request earned and the code it was thrown under is a transport detail.
 *
 * The code is checked against the register rather than trusted: only a registered refusal can claim
 * a refusal's status, and anything else travels as what tRPC says it is.
 */
function httpStatusOf(answer: ErrorAnswer, decidedByTrpc: number): number {
  if (answer.kind === "fault") return decidedByTrpc;
  if (!Object.hasOwn(REFUSALS, answer.refusalCode)) return decidedByTrpc;
  return REFUSAL_STATUS[answer.refusalCode as RefusalCode] ?? REFUSAL_STATUS_FLOOR;
}

/** What tRPC states about a failure beside its own message: kept, minus the stack (ARCH-03). */
interface TrpcErrorData {
  code: string;
  httpStatus: number;
  path?: string | undefined;
  stack?: string | undefined;
}

const t = initTRPC.context<AppContext>().create({
  errorFormatter({ shape, error, ctx, path }) {
    const answer = answerFor({ error, path, ctx });
    // tRPC's own reading of the failure is kept — the code it settled on and the route that failed,
    // which is what an operator correlates a record with — and its `stack` is dropped: tRPC adds it
    // under `isDev` and it carries the internal message the wire may not (ARCH-03).
    const { stack: _internal, ...stated } = shape.data as TrpcErrorData;
    return {
      ...shape,
      // The user-facing answer carries the id or the code and nothing the tier knows internally:
      // a fault's cause belongs on the fault sink, never on the wire (ARCH-03).
      message: answer.kind === "fault" ? answer.faultId : answer.refusalCode,
      data: { ...stated, ...answer, httpStatus: httpStatusOf(answer, stated.httpStatus) },
    };
  },
});

/** The router factory every lane composes with — and so the formatter every lane answers through. */
export const router = t.router;

/** The procedure every lane builds on; guards layer on top of it, never beside it (SEAM-ACT). */
export const publicProcedure = t.procedure;

// The one way into this tier from a browser (ARCH-02, B-17). Every entry point the product has —
// a "use server" action, a route handler, a tRPC procedure — is a place where a stranger's bytes
// first become a value this tier acts on, and until now each of them read those bytes its own way:
// a hand-written coercer per lane, a session resolved again in every door, and a body nobody could
// read arriving at a person as a thrown Error, which the fault seam then records as an outage of
// ours (ARCH-03). It is not an outage. A statement this tier cannot read is the caller's, and the
// answer to it is a refusal from the closed taxonomy — understood, and not carried out (B-21).
//
// So there is one reading, here, spelled in one schema language (zod), and one answer for the
// failure of it: REQUEST_MALFORMED, as `core/errors` registers it. That code is the TRANSPORTS' own
// and no other door's — `MALFORMED` is the model transport's, whose copy L-AI-01 fixes at the shape
// a proposal takes, and one code may carry one meaning (R-SPINE-062). Three doors are opened onto
// that one reading, one per transport:
//
//   `serverCall`   — a "use server" action: the statement is parsed, the session is resolved ONCE
//                    and handed over, and a registered refusal is carried back in the answer shape
//                    the screen already reads, never thrown across the action boundary.
//   `routeHandler` — a route handler: the statement is parsed, the answer to an unreadable one is
//                    400 with the registered refusal in the body, and a failure of OURS is the only
//                    thing that is still recorded at the fault seam and answered as a 500.
//   `parsed`       — a tRPC `.input()`, and any door whose answer has no room for a refusal: the
//                    same reading, raised as the marked refusal `src/server/trpc.ts` already reads
//                    off a thrown value and answers as a refusal rather than as a fault.
//
// What this seam deliberately does NOT hold is an opinion about who may do anything. It resolves
// the session — one lookup per request, which is R-SPINE-001's own rule — and hands it over. Every
// permission question stays where it already lives: in the module's guard, in the act seam, in the
// procedure that asks for a workspace-scoped actor (B-17).
import { z } from "zod";
import { REFUSALS, type RefusalCode } from "../core/errors";
import { refusal, refusalCodeOf } from "../core/faults/refusal-marker";
import { reportFault } from "../core/faults/report";
import type { AuthSession } from "./auth/session";
import { createContext, type AppContext } from "./context";
import { sessionOf } from "./shell/resolve";
import { presentedSessionToken } from "./shell/session";

/**
 * The one answer a statement this tier cannot read earns. It is a refusal and not a fault: nothing
 * of ours failed, and nothing about the product is learned from being told so (ARCH-03, B-21).
 */
const REQUEST_MALFORMED = "REQUEST_MALFORMED" as const satisfies RefusalCode;

/** The status an unreadable statement is answered under — understood, and not carried out. */
const REQUEST_MALFORMED_STATUS = 400;

/** The status a failure of ours is answered under, with the id it was recorded as and nothing else. */
const FAULT_STATUS = 500;

/**
 * The status a refusal travels with — the one table for the whole tier, which the tRPC lane reads
 * from here rather than keeping a second of (B-17, ARCH-02).
 *
 * A refusal is the answer a well-formed request earned, so it can never be a 5xx: on 500 a
 * registered refusal is indistinguishable from the server having failed, and every reader that is
 * not our own screen — a proxy, an uptime monitor, an operator reading access logs — records a live
 * door as an outage. 400 is the floor they share: understood, and not carried out. The codes HTTP
 * itself has a name for are given that name, so those readers agree with the taxonomy rather than
 * merely not contradicting it; a code with no HTTP name keeps the floor, which is why this table is
 * partial by design — the taxonomy is closed and this is a translation of it, not a second copy.
 */
const REFUSAL_STATUS_FLOOR = 400;

const REFUSAL_STATUS: Readonly<Partial<Record<RefusalCode, number>>> = Object.freeze({
  SIGNED_OUT: 401,
  PERMISSION_NOT_HELD: 403,
  // The same "you may not", said about a workspace instead of a project (R-SPINE-004): the upload
  // doors and the viewer feed have always answered it 403, and one code may carry one meaning.
  WORKSPACE_PERMISSION_NOT_HELD: 403,
  ACCOUNT_ALREADY_EXISTS: 409,
  RATE_LIMITED: 429,
});

/** The status one registered code is answered under. A code the register does not hold has none. */
export function refusalStatus(code: RefusalCode): number {
  return REFUSAL_STATUS[code] ?? REFUSAL_STATUS_FLOOR;
}

/**
 * The registered code a thrown value carries, or null — the whole test a refusal has to pass before
 * it may be answered as one. `refusalCodeOf` reads the marker; the register decides whether the code
 * it read is a refusal this product can answer with (R-SPINE-062, B-06).
 */
function registeredRefusalOf(failure: unknown): RefusalCode | null {
  const code = refusalCodeOf(failure);
  return code !== null && Object.hasOwn(REFUSALS, code) ? (code as RefusalCode) : null;
}

/**
 * What a caller is told when the schema itself put no sentence to the failure. A door with prose of
 * its own states it (`sentence`), and a schema that names the field it could not read states that —
 * this is the floor under both, never a description of what the door wanted.
 */
const UNREADABLE = "the request is not in the shape this door reads";

/**
 * Everything a caller stated, in the ONE shape every route schema is written over. A schema names
 * the parts it is about and nothing else, so what a door reads is visible at the door: `address`
 * for the segments and the query, `header` for what the transport itself carries, `body` for the
 * JSON a door said it reads.
 *
 * The address is one record rather than two, because an address is one thing to the person typing
 * it; the segments Next resolved are written over the query, so a query string can never restate a
 * part of the path it was attached to.
 */
export interface Stated {
  readonly address: Record<string, string>;
  readonly header: Record<string, string>;
  readonly body: unknown;
}

/** What a route's door is handed: what the caller stated, read, beside the request it arrived on. */
export interface Asked<I> {
  /** The statement, as the schema read it — the only shape of it this door ever sees. */
  readonly input: I;
  /** The request itself, for the doors whose body is bytes rather than a statement. */
  readonly request: Request;
  /** The context this request is answered under, session included: minted once, here (R-SPINE-001). */
  readonly context: AppContext;
}

/** What a route handler is declared as: where its failures are recorded, and what it reads. */
export interface RouteDoor<S extends z.ZodType> {
  /** The route the fault seam records this handler's failures under (ARCH-03). */
  readonly route: string;
  /** Who a failure is attributed to when no session stood behind the request. */
  readonly actor: string;
  /** The reading of everything the caller stated. */
  readonly schema: S;
  /** Whether the body is read as JSON before the statement is judged. Bytes are never read here. */
  readonly reads?: "json";
  /** This door's own sentence for a statement it could not read at all. */
  readonly sentence?: string;
}

/** The address as Next hands it over. A route with no dynamic segment is handed none. */
type Address = { params: Promise<Record<string, string>> };

/**
 * Parse a statement, or raise the registered refusal for one that cannot be read. This is the
 * reading behind all three doors, and the only place REQUEST_MALFORMED is made.
 *
 * The marker is the settled one (`core/faults/refusal-marker`), so every reader the tier already
 * has — the tRPC error formatter, an action's own `refused`, the route wrapper below — recognises
 * it as a refusal and answers it as one. The operator detail is the schema's own sentence about the
 * field it could not read; what a person reads is the registry's copy, rendered by the one renderer.
 */
export function parsed<S extends z.ZodType>(schema: S): (stated: unknown) => z.output<S> {
  return (stated: unknown): z.output<S> => {
    const read = schema.safeParse(stated);
    if (read.success) return read.data;
    throw refusal(REQUEST_MALFORMED, sentenceOf(read.error, UNREADABLE));
  };
}

/**
 * A "use server" action, with one reading of its input and one resolution of its session.
 *
 * The three things every action in this tree was writing out for itself are written once here: the
 * input is read (and an unreadable one is answered, not thrown — a rejection crossing a server-action
 * boundary keeps neither its marker nor its cause, so a throw would reach the screen as an
 * improvised sentence nobody registered); the session is resolved ONCE, through the request-scoped
 * resolver R-SPINE-001 already puts one resolution per render behind; and a registered refusal
 * raised anywhere under the door is carried back in the shape the screen reads.
 *
 * `refusedAs` is the door's own answer shape — `{ previewed: false, refusal }`, `{ moved: false,
 * refusal }`, a redirect for the screens whose way out of SIGNED_OUT is the door itself. The
 * taxonomy is closed and this seam adds nothing to it: anything the seam did not mark as a refusal
 * is a fault and travels on unchanged, which is what puts it on the error boundary with a recorded
 * id instead of on the screen as a shrug (ARCH-03, B-21).
 */
export function serverCall<S extends z.ZodType, A>(
  schema: S,
  door: (input: z.output<S>, session: AuthSession) => Promise<A>,
  refusedAs: (code: RefusalCode) => A,
): (stated: unknown) => Promise<A> {
  return async (stated: unknown): Promise<A> => {
    const read = schema.safeParse(stated);
    if (!read.success) return refusedAs(REQUEST_MALFORMED);
    const session = await presentedSession();
    if (session === null) return refusedAs("SIGNED_OUT");
    try {
      return await door(read.data, session);
    } catch (thrown) {
      const code = registeredRefusalOf(thrown);
      // Anything the register does not hold is an outage of ours, and it is RECORDED before it
      // travels on: re-throwing is what puts it on the error boundary, but a failure that reached a
      // person with no record behind it is the one thing ARCH-03 says may never happen. The action
      // carries no `Request`, so the record names the session that asked and the door's own shape.
      if (code === null) {
        reportFault({ requestId: globalThis.crypto.randomUUID(), actor: session.userId, route: ACTION_ROUTE, cause: thrown });
        throw thrown;
      }
      return refusedAs(code);
    }
  };
}

/** What the fault seam records a server action's outage under; an action has no route of its own. */
const ACTION_ROUTE = "server action";

/**
 * A route handler, with the same one reading and the same one session.
 *
 * The handler this returns is the whole shape of a route in this tree: read what the caller stated,
 * answer an unreadable statement with 400 and the registered refusal, mint the context (which is
 * where the presented session is resolved, once), and hand the rest to the door. The door answers
 * every question that is about the product — who may, what exists, what it costs — and this seam
 * answers only the two that are about the request itself.
 *
 * The reading comes first deliberately: a statement about the address is not a question about the
 * caller, so a client that got its address wrong is told which half of it was unreadable instead of
 * being told to sign in first — and a request nobody could act on costs this tier no resolution of
 * anybody's session (ARCH-03, R-SPINE-001).
 *
 * The catch is the fault seam's, and it is now the only way a 500 leaves these doors: a caller error
 * cannot reach it, because a statement that could not be read was answered before the door was
 * called (ARCH-03).
 */
export function routeHandler<S extends z.ZodType>(
  door: RouteDoor<S>,
  answered: (asked: Asked<z.output<S>>) => Promise<Response>,
): (request: Request, address?: Address) => Promise<Response> {
  return async (request: Request, address?: Address): Promise<Response> => {
    let context: AppContext | null = null;
    try {
      const stated = await statementOf(request, address, door.reads);
      const read = door.schema.safeParse(stated);
      if (!read.success) return malformedAnswer(sentenceOf(read.error, door.sentence ?? UNREADABLE));
      context = await createContext({ req: request });
      return await answered({ input: read.data, request, context });
    } catch (failure) {
      // Two different failures, told apart before either is answered (ARCH-03, B-21). A body that is
      // not JSON never became a statement at all and is raised wearing the registered marker, so it
      // is answered as the caller error it is; anything else happened on our side and is recorded at
      // the fault seam before the caller is given the id of the record, and nothing else.
      // A refusal is an answer whichever door raised it. Before this, only the seam's OWN code was
      // recognised here, so a module guard's registered "you may not" — the takeoff pipeline throws
      // two — became a recorded outage and a 500. The register decides, not the seam's memory of
      // which codes it raises itself.
      const refused = registeredRefusalOf(failure);
      if (refused === REQUEST_MALFORMED) return malformedAnswer(door.sentence ?? UNREADABLE);
      if (refused !== null) return json({ refusal: REFUSALS[refused] }, refusalStatus(refused));
      const { faultId } = reportFault({
        requestId: context?.requestId ?? globalThis.crypto.randomUUID(),
        actor: context?.actor ?? door.actor,
        route: door.route,
        cause: failure,
      });
      return json({ faultId }, FAULT_STATUS);
    }
  };
}

/**
 * The session this action's request presents, resolved once. Every door that needs the session but
 * not this seam's answer shape — an action that mounts a lane's own caller, say — asks here, so the
 * tier still resolves one presented token once per request (R-SPINE-001).
 */
export async function presentedSession(): Promise<AuthSession | null> {
  return sessionOf(await presentedSessionToken());
}

/**
 * The context a server action mounts a lane's own caller with. A server action carries no `Request`,
 * so the facts a context is minted from are taken from the platform's own: the session this request
 * presents, and the address this deployment states it answers at. The stated origin is null — a
 * server action is not a cross-site form post, and R-SPINE-006's rule is about a request that STATES
 * an origin; its one home decides that, not this seam.
 */
export async function actionContext(client: string): Promise<AppContext> {
  const session = await presentedSession();
  const origin = configuredOrigin();
  return {
    requestId: globalThis.crypto.randomUUID(),
    actor: session === null ? ANONYMOUS : session.userId,
    origin,
    statedOrigin: null,
    requestOrigin: origin,
    deviceLabel: "browser",
    client,
    session,
    secureCookies: false,
    cookies: [],
  };
}

/** A JSON answer, uncached: nothing a door answers is the same twice. */
export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * The registered code a failure travels with, or the failure itself. A refusal is an answer and is
 * carried back to whoever asked; anything else is a fault, and re-throwing it is what puts it on the
 * error boundary with a recorded id rather than on a screen as a sentence nobody registered.
 *
 * A marker carrying a code the register does not hold is not a refusal the product can answer with,
 * so it travels as what it is (R-SPINE-062, B-06). This is the one copy of a function nine doors
 * were each keeping their own of.
 */
export function refused(thrown: unknown): RefusalCode {
  const code = refusalCodeOf(thrown);
  if (code === null || !Object.hasOwn(REFUSALS, code)) throw thrown;
  return code as RefusalCode;
}

/** What a request with no session is answered as — the truth, never an invented identity (B-21). */
const ANONYMOUS = "anonymous";

/** The address this deployment states it answers at (R-SPINE-001), as the context carries it. */
function configuredOrigin(): string {
  return process.env["CUBIT_PUBLIC_ORIGIN"] ?? "";
}

/**
 * The refusal a caller reads for a statement this tier could not read: the registered entry whole,
 * so a client renders the register's own copy (R-SPINE-062), and beside it the one sentence saying
 * which part of the statement was unreadable — the detail the register deliberately does not hold,
 * because a registered message is about the product and this is about one request.
 */
function malformedAnswer(sentence: string): Response {
  return json({ refusal: REFUSALS[REQUEST_MALFORMED], error: sentence }, REQUEST_MALFORMED_STATUS);
}

/**
 * Everything the caller stated, assembled. The body is read as JSON only where a door said it reads
 * one — a chunk of a drawing is bytes, and a seam that buffered it as text to look for a `{` would
 * decide for every door how much of the server's memory one caller may hold (Q-12).
 */
async function statementOf(request: Request, address: Address | undefined, reads: "json" | undefined): Promise<Stated> {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);
  const segments = address === undefined ? {} : await address.params;
  const body = reads === "json" ? await jsonBody(request) : undefined;
  return { address: { ...query, ...segments }, header: Object.fromEntries(request.headers), body };
}

/**
 * The body as JSON. A body of no bytes stated nothing — which is a statement a schema can refuse in
 * its own words — and a body that is not JSON is the caller's mistake, raised wearing the registered
 * marker so the handler above tells it from an outage of ours rather than recording one.
 */
async function jsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch (failure) {
    throw refusal(REQUEST_MALFORMED, "the request body is not JSON", { cause: failure });
  }
}

/**
 * The sentence a failed reading carries. A schema that states its own message about the field it
 * could not read is the most useful thing a client can be told, so the first issue's message is the
 * sentence; zod's own default for a shape nobody described is replaced by the door's prose, which is
 * what the screens and the test contracts already quote.
 */
function sentenceOf(error: z.ZodError, fallback: string): string {
  const first = error.issues[0];
  if (first === undefined || first.message.startsWith(ZOD_DEFAULT)) return fallback;
  return first.message;
}

/** How zod opens every message it wrote itself, as against one a schema in this tree stated. */
const ZOD_DEFAULT = "Invalid input";

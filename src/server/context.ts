// The per-request context every procedure is answered under. It is minted once per request so one
// user action carries one traceable id across the tier, which is what makes a fault record
// attributable at all (ARCH-03, B-21) — and, since R-SPINE-001, so that one request resolves the
// presented `cubit_session` exactly once, whatever it goes on to do with it.
import { randomUUID } from "node:crypto";
import { resolveSession, SESSION_COOKIE, deviceLabelFrom, type AuthSession } from "./auth/session";

export interface AppContext {
  requestId: string;
  /** Who the request is answered as: the account's id, or `anonymous` when no session was presented. */
  actor: string;
  /** The address this request arrived on — what a mailed link points back at (R-SPINE-001). */
  origin: string;
  /** What to call the device in the session list, derived from the request rather than asked for. */
  deviceLabel: string;
  /** Who is calling, as far as the server itself can tell (`observedClient`) — the sign-in limiter's key. */
  client: string;
  /** The live session the cookie resolved to, or null. A refusal for null is the procedure's to make. */
  session: AuthSession | null;
  /** Whether a cookie set on this answer must carry `Secure` (`deploymentIsSecure`). */
  secureCookies: boolean;
  /** `Set-Cookie` values the answer must carry: the transport drains this, so no door writes a header. */
  cookies: string[];
}

/** The header a gateway stamps so a request keeps its id across hops. */
const REQUEST_ID_HEADER = "x-request-id";

/** What a request with no session is answered as — the truth, never an invented identity (B-21). */
const ANONYMOUS = "anonymous";

/**
 * The declared contract is `requestId = x-request-id header ?? crypto.randomUUID()`: a supplied id
 * is the caller's trace, and it is honoured verbatim — whatever its length and whatever characters
 * it carries. An earlier reading rejected long ids and control characters as an operator-log
 * guard; that is a policy the interface does not state, and it broke the caller's trace silently,
 * with no fault and no signal. The sink's framing does not need it either: a FaultRecord is written
 * as JSON, which escapes a control character rather than splitting the line on it.
 *
 * The one thing an absent header and a blank one share is that neither is an id, so both mint.
 */
function suppliedRequestId(req: Request): string | null {
  const supplied = req.headers.get(REQUEST_ID_HEADER);
  if (supplied === null || supplied.trim() === "") return null;
  return supplied;
}

/**
 * The session token this request presents, or null. Read from the raw Cookie header rather than from
 * an adapter's jar, because the seam is handed a plain `Request` by every transport that serves it
 * — and by every harness that drives it directly. A header carrying no `cubit_session` resolves to null
 * without touching the database: a request that presents nothing is not a lookup.
 */
function presentedToken(req: Request): string | null {
  const jar = req.headers.get("cookie");
  if (jar === null) return null;
  for (const pair of jar.split(";")) {
    const at = pair.indexOf("=");
    if (at === -1) continue;
    if (pair.slice(0, at).trim() !== SESSION_COOKIE) continue;
    const value = pair.slice(at + 1).trim();
    return value === "" ? null : value;
  }
  return null;
}

/**
 * Where the product answers, as something other than the caller says. Next builds a route handler's
 * `Request.url` from the incoming `Host` header, so the request's own origin is a value the caller
 * writes — and this origin is what a mailed reset or magic link points at (session.ts). An
 * unauthenticated caller who posted `requestPasswordReset` with `Host: attacker.example` would
 * otherwise have a link to the attacker's host mailed to the victim, and the victim's click would
 * hand over a single-use credential. R-SPINE-001 legislates against exactly this shape for the
 * limiter — "never client-influencable headers alone" — and a link's destination is the same class.
 */
const PUBLIC_ORIGIN_VAR = "CUBIT_PUBLIC_ORIGIN";

/** Loopback names: the only hosts a request can claim that a deployment is not reachable at. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** The deployment's own statement of its address, when it made one. */
function configuredOrigin(): string | null {
  const configured = process.env[PUBLIC_ORIGIN_VAR]?.trim();
  if (configured === undefined || configured === "") return null;
  return URL.parse(configured)?.origin ?? null;
}

/**
 * Whether a session cookie set on this answer must carry `Secure` (R-SPINE-001).
 *
 * The rule is stated so that forgetting to configure anything is the *safe* answer, because a
 * session token is the whole session: a deployment behind TLS whose operator never set
 * `CUBIT_PUBLIC_ORIGIN` would otherwise hand out a thirty-day token an attacker on the network
 * strips to http and captures, and it would do it silently — nothing about the deployment says it
 * is missing a variable. So absence is not permission. The flag is dropped only where a `Secure`
 * cookie is a cookie the browser will not keep at all, and the two cases where that is true are the
 * only two exemptions:
 *
 *   - the deployment configured its own origin and said it is plain http — a deliberate statement,
 *     made by the one party entitled to make it;
 *   - nothing is configured and the request arrived on a loopback host, which is a developer's
 *     machine or the journeys' own server (`LOOPBACK_HOSTS`) and can be nothing else.
 *
 * Everything else — an unconfigured deployment answering on a real hostname — is treated as TLS.
 * The request is read only to recognise loopback, never to grant security: a caller who writes a
 * `Host` cannot turn the flag on, and the only thing writing one can turn it off for is a request
 * claiming to be a request to the machine it is already running on.
 */
export function deploymentIsSecure(req: Request): boolean {
  const configured = configuredOrigin();
  if (configured !== null) return configured.startsWith("https:");
  return !isLoopbackRequest(req);
}

/** Did this request arrive on a loopback name — the development and journey servers, and nothing else? */
function isLoopbackRequest(req: Request): boolean {
  const url = URL.parse(typeof req.url === "string" ? req.url : "");
  return url !== null && LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * The address a link built on this request points back at. The configured origin when the
 * deployment named one; otherwise the request's own origin only while it names a loopback host,
 * which is a development machine and the journeys' own server and can be nothing else.
 *
 * Everything else leaves the origin empty rather than trusting the caller's `Host`, which would let
 * a caller point a mailed link at a host of their choosing. That is a deployment that has named no
 * address, and the mailing doors send nothing at all on an empty origin: they answer the registered
 * LINK_NOT_SENDABLE and record the configuration outage for the operator (R-SPINE-001) — see
 * `canSendLinks` and `mail` in src/server/auth/session.ts.
 */
function originOf(req: Request): string {
  const configured = configuredOrigin();
  if (configured !== null) return configured;

  if (!isLoopbackRequest(req)) return "";
  return URL.parse(typeof req.url === "string" ? req.url : "")?.origin ?? "";
}

/**
 * What the server can tell one caller from another by, for the half of the sign-in limit that
 * refuses (R-SPINE-001, and `rate-limit.ts`'s `admitSignIn`). A hard refusal keyed on the address
 * somebody is signing in *as* is a lever any stranger can pull on any account — they hammer the
 * address and its owner is the one locked out — so the refusing key is the caller, and the address's
 * own counter only slows an attempt down.
 *
 * The caller is the connection, never a header. `X-Forwarded-For` is written by whoever sent the
 * request unless a proxy the deployment trusts overwrote it, and R-SPINE-001 legislates against a key
 * a caller can rotate ("never client-influencable headers alone") — a limiter keyed on a value the
 * limited party chooses limits nobody.
 *
 * This seam is handed a plain `Request` by every transport that serves it — Next's route handler, the
 * journeys' server, a harness calling `createContext` directly — and a `Request` carries no peer
 * address. So a deployment that has not put this seam behind something that can name its callers
 * cannot tell two of them apart, and says exactly that: every such request is the same unnamed
 * caller, which spends one allowance between them rather than a caller-chosen allowance each.
 */
const UNOBSERVED_CLIENT = "an unobserved caller";

/**
 * Mint the context. The actor is the account the presented session resolved to and nothing else: a
 * cookie that names no live session is anonymous, exactly like a request that presented none, so a
 * revoked device cannot be recorded as the person it used to belong to.
 */
export async function createContext({ req }: { req: Request }): Promise<AppContext> {
  const token = presentedToken(req);
  const session = token === null ? null : await resolveSession(token);
  return {
    requestId: suppliedRequestId(req) ?? randomUUID(),
    actor: session?.userId ?? ANONYMOUS,
    origin: originOf(req),
    deviceLabel: deviceLabelFrom(req.headers.get("user-agent")),
    client: UNOBSERVED_CLIENT,
    session,
    secureCookies: deploymentIsSecure(req),
    cookies: [],
  };
}

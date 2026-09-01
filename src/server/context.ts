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
  /**
   * The address the deployment states it answers at (`CUBIT_PUBLIC_ORIGIN`) — what a mailed link
   * points back at, and empty when nothing was configured (R-SPINE-001).
   */
  origin: string;
  /**
   * The `Origin` the request stated, or null when it stated none — read verbatim and compared
   * nowhere here. What it MEANS is R-SPINE-006's origin rule, whose one home is the tenancy module's
   * guard; this seam only carries the fact off the request, because a procedure is handed a context
   * and never the request itself (ARCH-02, B-17).
   */
  statedOrigin: string | null;
  /** The origin of the URL this request arrived at, carried beside the stated one for the same rule. */
  requestOrigin: string;
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
  return answeredScheme(arrivedAtHostname(req)) === "https";
}

/**
 * The hostname this request was reached at, on the same terms `arrivalOrigin` composes the arrival
 * address on: the `Host` it stated, and where it stated none the URL it carries.
 *
 * A request off a network always states a `Host` — HTTP/1.1 requires it and a hop writes its own —
 * so a `Request` without one was composed in this process by the caller holding it, a suite driving
 * the shipped handler, and the address it composed is by construction the address it dialled. Both
 * screens read that same fact the same way: one request has one arrival address, and a suite that
 * composes `http://127.0.0.1/…` is not a deployment behind TLS (ARCH-02, B-17).
 */
function arrivedAtHostname(req: Request): string | null {
  const host = req.headers.get("host");
  if (host !== null) return reachedHostname(host);
  return URL.parse(req.url)?.hostname ?? null;
}

/** The hostname half of a `Host`, which is the only part of an address a request states truthfully. */
function reachedHostname(host: string | null): string | null {
  if (host === null || host === "") return null;
  return URL.parse(`http://${host}`)?.hostname ?? null;
}

/**
 * The address a request was reached at, off the `Host` it stated — the arrival address both lanes
 * carry, composed in one place (ARCH-02, B-17).
 *
 * `Host` is read and `X-Forwarded-Host` is not, and the asymmetry is the point (R-SPINE-001): a
 * caller writes both, but `Host` is the name they had to reach to be answered at all, while a
 * forwarded host is a name they simply nominate. Reading the nominated one would let a caller hand
 * themselves an address of their own choosing — `localhost:9999`, a page their own machine serves —
 * as the address this request arrived at. A request stating no `Host` arrived nowhere this can
 * name, and says so with the empty string; the caller-composed case is answered by `arrivalOrigin`.
 */
function arrivedAtFromHost(host: string | null): string {
  if (host === null || host === "") return "";
  return URL.parse(`${answeredScheme(reachedHostname(host))}://${host}`)?.origin ?? "";
}

/**
 * The scheme the deployment answers in, for a host it was reached at — the other half of an address,
 * decided by the same party and on the same terms (R-SPINE-001).
 *
 * `x-forwarded-proto` is a caller-written header: an edge stamps it and so may anybody, and nothing
 * on the request tells the two apart. It is not read, because a scheme read off the caller is a
 * scheme the caller chooses, and where the arrival address is carried at all (this machine, an
 * unconfigured deployment) that choice would compose an address the deployment does not answer at —
 * `https://localhost:3210`, a page the visitor's own machine serves at that port — and hand it to the
 * origin rule as a dialled one. So the deployment's own statement answers, and where it made none the
 * host is read exactly as `deploymentIsSecure` reads it: only to recognise the two names of this
 * machine as plain http, never to grant TLS to anything a caller wrote.
 */
function answeredScheme(hostname: string | null): "http" | "https" {
  const configured = configuredOrigin();
  if (configured !== null) return configured.startsWith("https:") ? "https" : "http";
  return hostname !== null && LOOPBACK_HOSTS.has(hostname) ? "http" : "https";
}

/**
 * The address this request was DIALLED at, judged nowhere here. It is one of the two addresses
 * R-SPINE-006's origin rule admits a stated `Origin` against, and that rule has one home
 * (src/modules/spine/tenancy/guard): this seam carries the fact, because a procedure is handed a
 * context and never the request itself.
 *
 * The arrival address is composed from `Host`, and `Host` is not evidence of where anybody dialled
 * unless the process is the thing the browser reached. A hop rewrites it to the upstream it forwards
 * to — nginx with a bare `proxy_pass http://127.0.0.1:3000` hands every request the same loopback
 * name, whoever dialled what — and it does so stamping no header at all, so no mark on the request
 * can tell the two apart. Asking the request would be asking the caller (R-SPINE-001); `Host` is a
 * value they write, and `X-Forwarded-Host` more so — an edge mark is not a credential, and reading
 * one as though a caller could only lose an admission by writing it would let a caller who writes
 * `X-Forwarded-Host: localhost:3000` hand THEMSELVES an address the deployment never answers at.
 *
 * So the party asked is the one entitled to answer: the deployment's own statement of where it
 * answers. The arrival address is carried when
 *
 *   - it IS what the deployment states it answers at — the Host-preserving edge (Cloudflare, an ALB,
 *     `proxy_set_header Host $host;`) and the direct deployment alike, whatever else was stamped; or
 *   - the deployment states it answers at this machine, or states nothing at all — a developer's
 *     machine, the journeys' own server, processes a browser reaches directly, where `localhost` and
 *     `127.0.0.1` are one machine under two spellings and the arrival address is genuinely the
 *     dialled one; or
 *   - the request carried no `Host` at all, which no request off a network is: HTTP/1.1 requires the
 *     header and a hop writes its own, so a `Request` without one was composed in this process by
 *     the caller holding it — a suite driving the shipped handler — and the URL it composed is by
 *     construction the address it dialled.
 *
 * Everywhere else — a deployment that states a network address and was reached at some other name —
 * that name is a hop's upstream or a forgery, never an address a browser dialled, and there is no
 * dialled address to carry: this says so with the empty string. Nothing here can WIDEN what the rule
 * admits, because nothing a caller writes is read: what remains beside the empty string is the
 * deployment's own statement, the one fact no caller writes (R-SPINE-001).
 */
function dialledOrigin(arrivedAt: string, statedHost: string | null): string {
  const configured = configuredOrigin();
  if (configured === null || arrivedAt === configured || statedHost === null) return arrivedAt;
  return answersDirectly(configured) ? arrivedAt : "";
}

/** Does the deployment state it answers at this machine — the one statement a hop cannot be behind? */
function answersDirectly(configured: string): boolean {
  const hostname = URL.parse(configured)?.hostname;
  return hostname !== undefined && LOOPBACK_HOSTS.has(hostname);
}

/**
 * The address this request was dialled at, for the lane the platform hands a whole `Request`.
 *
 * The platform composes `Request.url` out of headers the caller wrote — Next builds its host from
 * `X-Forwarded-Host` where one was stamped and its scheme from `X-Forwarded-Proto` — so the URL
 * handed over is not read for either half of the address. Both halves come from where the other
 * lane takes them: the `Host` the request had to state, and the scheme the deployment answers in
 * (`arrivedAtFromHost`). One request therefore has one arrival address, whichever transport carries
 * it (ARCH-02, B-17).
 *
 * A request carrying no `Host` at all was composed in this process by the caller holding it — a
 * suite driving the shipped handler — and the URL it composed is by construction the address it
 * dialled: that one, and only that one, is kept verbatim.
 */
function arrivalOrigin(req: Request): string {
  const host = req.headers.get("host");
  if (host !== null) return dialledOrigin(arrivedAtFromHost(host), host);
  return dialledOrigin(URL.parse(req.url)?.origin ?? "", null);
}

/**
 * The address a mailed link points back at: the deployment's own statement of it, and nothing else.
 *
 * The request is not consulted at all. Every part of a request's own origin is written by whoever
 * sent it — Next composes a route handler's `Request.url` from the incoming `Host`, and the scheme
 * of that URL is decided by `x-forwarded-proto` — so a link built on it is a link addressed where
 * the caller chose. Recognising loopback does not rescue it either: `Host: 127.0.0.1` is a header
 * like any other, and even a request genuinely from loopback carries a scheme and a port a caller
 * wrote, so the link a victim is mailed under a stranger's `x-forwarded-proto: https` is one nobody
 * can follow while the door answers as though it sent it. A mailed link is a live credential
 * (R-SPINE-001), and there is exactly one party entitled to say where it points.
 *
 * A deployment that named no address leaves this empty, and the mailing doors then send nothing at
 * all: they answer the registered LINK_NOT_SENDABLE before any address is looked up, and record the
 * configuration outage for the operator (R-SPINE-007) — see `canSendLinks` and `mail` in
 * src/server/auth/session.ts.
 *
 * `deploymentIsSecure` still reads the request, and for the opposite reason: it reads it only to
 * *drop* a guarantee where a `Secure` cookie is one no browser would keep, never to grant one.
 */
function originOf(): string {
  return configuredOrigin() ?? "";
}

/**
 * The three facts R-SPINE-006's origin rule judges, for a seam the platform hands headers instead of
 * a `Request` — a server action, which is handed no request at all. What they MEAN is the tenancy
 * module's guard, exactly as above; what this seam owes it is the facts, and they are derived here
 * because the env var's name, the configured value's normalisation and the arrival address have one
 * home, which the tRPC lane already reads through `createContext` (B-17, ARCH-02).
 */
export interface RequestOriginFacts {
  statedOrigin: string | null;
  requestOrigin: string;
  configuredOrigin: string;
}

/**
 * Those three facts, off the headers the platform kept about the request.
 *
 * The arrival address is composed from the `Host` the request named and the scheme the deployment
 * answers in (`answeredScheme`) — never the scheme a caller stated, which is the whole of what
 * `x-forwarded-proto` is. A proxy that terminates TLS is answered for by the address its deployment
 * states, which is the same statement the other lane reads, so both lanes hand the rule the same
 * address for the same request (ARCH-02, B-17).
 */
export function originFactsFromHeaders(sent: Headers): RequestOriginFacts {
  const configured = originOf();
  const host = sent.get("host");
  return {
    statedOrigin: sent.get("origin"),
    requestOrigin: dialledOrigin(arrivedAtFromHost(host), host),
    configuredOrigin: configured,
  };
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
    origin: originOf(),
    statedOrigin: req.headers.get("origin"),
    requestOrigin: arrivalOrigin(req),
    deviceLabel: deviceLabelFrom(req.headers.get("user-agent")),
    client: UNOBSERVED_CLIENT,
    session,
    secureCookies: deploymentIsSecure(req),
    cookies: [],
  };
}

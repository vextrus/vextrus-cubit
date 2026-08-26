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
  /** The live session the cookie resolved to, or null. A refusal for null is the procedure's to make. */
  session: AuthSession | null;
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
 * — the acceptance suites included. A header that carries no `cubit_session` at all resolves to null
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
 * The address the request arrived on. A transport that hands the seam something without a readable
 * url leaves the origin empty, and a link built on it is root-relative — still a link inside the
 * app, never a throw on a request that was otherwise answerable.
 */
function originOf(req: Request): string {
  const url = typeof req.url === "string" ? req.url : "";
  return URL.parse(url)?.origin ?? "";
}

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
    session,
    cookies: [],
  };
}

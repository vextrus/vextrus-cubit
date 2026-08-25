// The per-request context every procedure is answered under. It is minted once per request so one
// user action carries one traceable id across the tier, which is what makes a fault record
// attributable at all (ARCH-03, B-21).
import { randomUUID } from "node:crypto";

export interface AppContext {
  requestId: string;
  actor: "anonymous";
}

/** The header a gateway stamps so a request keeps its id across hops. */
const REQUEST_ID_HEADER = "x-request-id";

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
 * Mint the context. Sessions and real actors arrive in a later spine increment; until then every
 * caller is anonymous, and saying so plainly beats inventing an identity the tier cannot prove.
 */
export function createContext({ req }: { req: Request }): AppContext {
  return {
    requestId: suppliedRequestId(req) ?? randomUUID(),
    actor: "anonymous",
  };
}

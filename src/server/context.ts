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
 * The header is a caller's word, and the tier is anonymous — so a supplied id is honoured only
 * within bounds it cannot abuse. It is written to the operator's fault sink and echoed to the
 * caller, and an unbounded string there is an operator-log flood, not a trace. Anything longer than
 * this, or carrying a control character, is not an id: the request gets a minted one instead.
 */
const MAX_REQUEST_ID_LENGTH = 200;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

function suppliedRequestId(req: Request): string | null {
  const supplied = req.headers.get(REQUEST_ID_HEADER);
  if (supplied === null || supplied.trim() === "") return null;
  if (supplied.length > MAX_REQUEST_ID_LENGTH) return null;
  if (!PRINTABLE_ASCII.test(supplied)) return null;
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

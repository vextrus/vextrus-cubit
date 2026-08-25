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
 *
 * The bound is on the two hazards only — an unbounded flood and a character that would break the
 * sink's one-record-per-line framing. A printable non-ASCII id is still an id: this is a bn-BD
 * product whose gateways stamp UTF-8, and dropping such a header would silently break the caller's
 * trace and refuse to echo it, which AC-2 promises.
 */
const MAX_REQUEST_ID_LENGTH = 200;
// C0 and DEL only — the characters that would break the sink's one-record-per-line framing. A
// UTF-8 id a gateway stamped arrives here as its bytes, several of which land in the C1 range;
// those are payload, not control characters, and rejecting them would be the ASCII cap by another
// name.
const FIRST_PRINTABLE_CODE_POINT = 0x20;
const DELETE_CODE_POINT = 0x7f;

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < FIRST_PRINTABLE_CODE_POINT || code === DELETE_CODE_POINT) return true;
  }
  return false;
}

function suppliedRequestId(req: Request): string | null {
  const supplied = req.headers.get(REQUEST_ID_HEADER);
  if (supplied === null || supplied.trim() === "") return null;
  if (supplied.length > MAX_REQUEST_ID_LENGTH) return null;
  if (hasControlCharacter(supplied)) return null;
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

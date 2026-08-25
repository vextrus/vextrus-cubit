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
 * Mint the context. Sessions and real actors arrive in a later spine increment; until then every
 * caller is anonymous, and saying so plainly beats inventing an identity the tier cannot prove.
 */
export function createContext({ req }: { req: Request }): AppContext {
  const supplied = req.headers.get(REQUEST_ID_HEADER);
  return {
    requestId: supplied !== null && supplied.trim() !== "" ? supplied : randomUUID(),
    actor: "anonymous",
  };
}

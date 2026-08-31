// R-SPINE-006: "cookie-authenticated mutations verify origin". This is the whole of that rule and
// its one home (ARCH-02, B-17) — a transport that compared an origin of its own would be a second
// answer to a question that has one, free to drift from this one.
//
// A browser stamps `Origin` on the requests a page makes, and a cookie the browser holds is sent
// whoever made the request: the header is therefore the one thing that says WHICH page spent the
// session. A request stating an origin this deployment does not serve is a request some other site's
// page made with this deployment's cookie, and it is refused before anything is judged or moved.
//
// A request stating NO origin proceeds. An absent header is not a browser page claiming a foreign
// origin; it is a caller that stamps none — a suite driving the shipped handler in process, a
// server-to-server call, a navigation the browser does not stamp — and refusing those would refuse
// the honest callers while the dishonest one simply omits the header it was never obliged to send.
// What the header can do is prove a page's origin when it is there, which is what this reads it for.
import { originNotVerified } from "../refusals";

/** The three facts the rule is decided on, all of them the server's own reading of the request. */
export interface OriginClaim {
  /** The `Origin` header as the request stated it, or null when it stated none. */
  readonly statedOrigin: string | null;
  /** The origin of the URL the request arrived at. */
  readonly requestOrigin: string;
  /** The address the deployment states it answers at, empty when nothing is configured. */
  readonly configuredOrigin: string;
}

/** An origin, as a comparison may hold it: the origin of what was written, or the text as written. */
function originOf(value: string): string {
  return URL.parse(value)?.origin ?? value.trim();
}

/**
 * Refuse a stated origin this deployment does not answer at, and let every other request through.
 * The deployment's own statement of its address is admitted beside the request's own origin, because
 * a deployment behind a proxy answers at an address the request's URL does not carry.
 */
export function verifyStatedOrigin(claim: OriginClaim): void {
  if (claim.statedOrigin === null) return;
  const stated = originOf(claim.statedOrigin);
  const answeredAt = [claim.requestOrigin, claim.configuredOrigin].map(originOf).filter((origin) => origin !== "");
  if (answeredAt.includes(stated)) return;
  throw originNotVerified(claim.statedOrigin);
}

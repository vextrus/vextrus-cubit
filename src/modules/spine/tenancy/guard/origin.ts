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
 * The names that address the machine a process is already running on. Stated here because this is
 * where the question is asked: a module may not import the server tier (ARCH-01), and the seam's own
 * list answers a different question entirely — whether a cookie may be handed out without `Secure`.
 */
const SELF_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Does this address name the machine the process runs on, rather than somewhere on a network? */
function addressesThisMachine(origin: string): boolean {
  const hostname = URL.parse(origin)?.hostname;
  return hostname !== undefined && SELF_HOSTS.has(hostname);
}

/**
 * The addresses a stated origin is admitted against.
 *
 * The deployment's own statement of where it answers is the comparator, because it is the only one of
 * the three facts no caller writes. The request's OWN origin is composed from the `Host` the request
 * carried (and the scheme an edge stated), so admitting it would admit a caller that states one
 * foreign origin coherently twice — the forged `Host` makes the address the request "arrived at" the
 * attacker's own, and the stated `Origin` then matches it. That is precisely the cross-site request
 * R-SPINE-006 legislates against, and R-SPINE-001 bans deciding anything on client-written headers.
 *
 * The arrival address is admitted beside it in exactly the cases where the request reached this
 * process with nothing in between — a browser composes `Host` from the address it dialled, so where
 * no hop rewrote it the arrival address IS an address somebody typed at this deployment:
 *
 *   - the deployment named no address at all AND the request arrived on a loopback name: a
 *     developer's own machine, the only place an unconfigured deployment answers at all — one that
 *     states no address mails no link either, and says so (R-SPINE-001, src/server/context.ts). An
 *     unconfigured deployment answering on a real hostname is not a deployment whose cookies this
 *     rule may spend on a caller's word: absence is not permission;
 *   - the deployment answers at this machine's own address and the request arrived at one of them
 *     too: a caller inside the process driving the shipped handler, which composes the URL itself,
 *     and a browser that dialled one of this machine's several names — `localhost` and `127.0.0.1`
 *     are the same machine under two spellings, and one served port is not the other. What such a
 *     deployment states it answers at is one of those names, never all of them, so refusing the
 *     arrival address here refuses the deployment its own page.
 *
 * A deployment that answers on a network name is reached through something, and what a hop puts in
 * `Host` is its own upstream address rather than the address the browser dialled: a proxy forwarding
 * to `127.0.0.1:3000` makes EVERY request's arrival address that loopback name, so admitting it would
 * hand the deployment a standing second origin — and any page the visitor's own machine serves at
 * that port could then spend their session cookie on it, which is the cross-site request R-SPINE-006
 * legislates against. Such a deployment is admitted at what it states and nothing else, and it loses
 * nothing by it: a browser dials the name a networked deployment publishes, so its own page states
 * that name already. The extra admission belongs to the deployment that is dialled at whichever of
 * its machine's names the person typed, and to nobody else — the arrival address is admitted for
 * being this machine's own, never for matching what was stated (R-SPINE-001).
 */
function answeredAt(claim: OriginClaim): readonly string[] {
  const configured = originOf(claim.configuredOrigin);
  const arrivedAt = originOf(claim.requestOrigin);
  const arrivedHere = addressesThisMachine(arrivedAt);
  if (configured === "") return arrivedHere ? [arrivedAt] : [];
  if (!addressesThisMachine(configured)) return [configured];
  return arrivedHere ? [configured, arrivedAt] : [configured];
}

/** Refuse a stated origin this deployment does not answer at, and let every other request through. */
export function verifyStatedOrigin(claim: OriginClaim): void {
  if (claim.statedOrigin === null) return;
  const stated = originOf(claim.statedOrigin);
  if (stated !== "" && answeredAt(claim).includes(stated)) return;
  throw originNotVerified(claim.statedOrigin);
}

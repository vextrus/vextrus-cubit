/**
 * R-SPINE-006, R-SPINE-001: what the seam hands the origin rule as the address a request was
 * dialled at, and what that makes the rule answer.
 *
 * The rule admits the dialled address beside the deployment's own statement when it names this
 * machine, because a browser composes `Host` from the address it dialled. A hop breaks that: nginx
 * forwarding to `proxy_pass http://127.0.0.1:3000` rewrites `Host` to its own upstream, so every
 * request behind it would otherwise "arrive" at one loopback name — and that name would stand as a
 * second admitted origin for a deployment on a network, for any page the visitor's own machine
 * happens to serve at that port to spend their session cookie on.
 *
 * No mark on the request tells the two apart — a bare `proxy_pass` stamps none, and a caller may
 * stamp any of them — so the seam asks the one party entitled to answer: the deployment's statement
 * of where it answers. The arrival address is carried where it IS that address, and where the
 * deployment states this machine or states nothing (a developer's machine, the journeys' server, a
 * suite in process); a deployment that states a network address and was reached at some other name
 * carries no dialled address at all. Both lanes are read here — the tRPC lane's `createContext` and
 * the server actions' `originFactsFromHeaders` — because a rule with one home is only as good as the
 * facts each transport hands it (ARCH-02, B-17).
 */
import { afterEach, describe, expect, test } from "vitest";
import { verifyStatedOrigin } from "../../modules/spine/tenancy";
import { refusalCodeOf } from "../../core/faults/refusal-marker";
import { refusalOf } from "../../core/errors";
import { createContext, originFactsFromHeaders } from "../context";

const PUBLIC_ORIGIN_VAR = "CUBIT_PUBLIC_ORIGIN";
const NOT_VERIFIED = refusalOf("ORIGIN_NOT_VERIFIED").code;

/** The upstream a proxy forwards to, which is what it rewrites `Host` to. */
const UPSTREAM = "http://127.0.0.1:3000";
/** The address the browser actually dialled, which only the edge can state. */
const PUBLISHED = "https://cubit.example";

const OPERATORS_OWN = process.env[PUBLIC_ORIGIN_VAR];

afterEach(() => {
  if (OPERATORS_OWN === undefined) delete process.env[PUBLIC_ORIGIN_VAR];
  else process.env[PUBLIC_ORIGIN_VAR] = OPERATORS_OWN;
});

/** A request as a transport hands it over: the URL the platform composed, and the caller's headers. */
function requestAs(url: string, headers: Readonly<Record<string, string>>): Request {
  const carried = new Headers();
  for (const [name, value] of Object.entries(headers)) carried.set(name, value);
  return new Request(url, { headers: carried });
}

/** The address the tRPC lane hands the rule for a request the platform composed at `url`. */
async function dialledOnTheRequestLane(url: string, headers: Readonly<Record<string, string>>, configured: string): Promise<string> {
  process.env[PUBLIC_ORIGIN_VAR] = configured;
  return (await createContext({ req: requestAs(url, headers) })).requestOrigin;
}

/** The same address as the server-action lane reads it, which is handed headers and no request. */
function dialledOnTheActionLane(headers: Readonly<Record<string, string>>, configured: string): string {
  process.env[PUBLIC_ORIGIN_VAR] = configured;
  const carried = new Headers();
  for (const [name, value] of Object.entries(headers)) carried.set(name, value);
  return originFactsFromHeaders(carried).requestOrigin;
}

/** The registered code a claim was refused with, or null when it was admitted. */
function refusalFor(claim: { statedOrigin: string | null; requestOrigin: string; configuredOrigin: string }): string | null {
  try {
    verifyStatedOrigin(claim);
    return null;
  } catch (thrown) {
    // A refusal is an answer and carries its registered code; a fault is not this reader's to turn
    // into one and goes on up (ARCH-03, B-21), asked of the marker's one reader (ARCH-02).
    const code = refusalCodeOf(thrown);
    if (code === null) throw thrown;
    return code;
  }
}

describe("R-SPINE-006: the seam carries the address a request was dialled at, not a hop's upstream", () => {
  test("with nothing in front of the process, the address it arrived at is the address it was dialled at", async () => {
    const served = "http://127.0.0.1:3211";
    expect(await dialledOnTheRequestLane(`${served}/api/trpc/spine.auth.signIn`, { host: "127.0.0.1:3211" }, served)).toBe(served);
    expect(dialledOnTheActionLane({ host: "localhost:3211" }, served), "the journeys' own browser dials one of this machine's names and is served at another").toBe(
      "http://localhost:3211",
    );
  });

  test("a deployment that states this machine keeps the address a request arrived at", async () => {
    // A suite driving the shipped handler, a developer's own machine, the journeys' server: the
    // deployment states it answers here, so nothing can stand between it and its caller, and the
    // URL the caller reached is the address it dialled — under either spelling of this machine.
    const served = "http://127.0.0.1:3211";
    expect(await dialledOnTheRequestLane("http://127.0.0.1/api/trpc/spine.tenancy.assignRole", { host: "127.0.0.1" }, served)).toBe("http://127.0.0.1");
    expect(dialledOnTheActionLane({ host: "localhost:3210" }, served)).toBe("http://localhost:3210");
  });

  test("a request carrying no Host at all was composed in this process and keeps the URL it composed", async () => {
    // A suite driving the shipped route handler hands it a `Request` it built: no Host, so nothing
    // stands between it and the process — HTTP/1.1 requires the header and every hop writes its own.
    expect(await dialledOnTheRequestLane("http://127.0.0.1/api/trpc/spine.tenancy.assignRole", {}, PUBLISHED)).toBe("http://127.0.0.1");
  });

  test("a deployment that states nothing keeps it too, and an unrelated mark does not take it away", async () => {
    // R-SPINE-001: an unconfigured deployment mails no links and answers on a developer's machine.
    // A Host-preserving edge stamps `x-forwarded-for`/`-proto` and rewrites nothing; a caller can
    // stamp the same headers, and neither may cost this request the address it actually arrived at.
    const marked = { host: "localhost:3000", "x-forwarded-for": "203.0.113.7" };
    expect(await dialledOnTheRequestLane("http://localhost:3000/api/trpc/spine.tenancy.assignRole", marked, "")).toBe("http://localhost:3000");
    expect(dialledOnTheActionLane(marked, "")).toBe("http://localhost:3000");
  });

  test("behind a Host-preserving edge, the arrival address is the deployment's own and is carried", async () => {
    // Cloudflare, an ALB, `proxy_set_header Host $host;`: `Host` survives the hop and the edge marks
    // only the client and the scheme. The request arrived where the deployment says it answers.
    const behindAProxy = { host: "cubit.example", "x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.7" };
    expect(await dialledOnTheRequestLane(`${PUBLISHED}/api/trpc/spine.tenancy.assignRole`, behindAProxy, PUBLISHED)).toBe(PUBLISHED);
    expect(dialledOnTheActionLane(behindAProxy, PUBLISHED)).toBe(PUBLISHED);
  });

  test("behind a Host-rewriting edge that stamps nothing at all, there is no dialled address to carry", async () => {
    // nginx with a bare `proxy_pass http://127.0.0.1:3000;` — no `proxy_set_header` lines, so the
    // only headers it adds are `Host: $proxy_host` and `Connection`. The loopback name is the hop's
    // upstream and nobody dialled it, so the seam reports none rather than inventing one.
    const bare = { host: "127.0.0.1:3000" };
    expect(await dialledOnTheRequestLane(`${UPSTREAM}/api/trpc/spine.tenancy.assignRole`, bare, PUBLISHED)).toBe("");
    expect(dialledOnTheActionLane(bare, PUBLISHED)).toBe("");
  });

  test("an edge that states a dialled address states it to nobody: the seam reads no forwarded host", async () => {
    // The shape that would otherwise WIDEN the rule: `Host` names the vhost the caller had to reach,
    // and the caller adds `X-Forwarded-Host: localhost:3000` to nominate an address of their own.
    // Nothing a caller writes is read, so what the request arrived at is the deployment's own address.
    const forged = { host: "cubit.example", "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "https", origin: "https://localhost:3000" };
    const requestOrigin = await dialledOnTheRequestLane(`${PUBLISHED}/api/trpc/spine.tenancy.assignRole`, forged, PUBLISHED);
    expect(requestOrigin).toBe(PUBLISHED);
    expect(dialledOnTheActionLane(forged, PUBLISHED)).toBe(PUBLISHED);
    expect(refusalFor({ statedOrigin: "https://localhost:3000", requestOrigin, configuredOrigin: PUBLISHED }), "an address nobody dialled admits nothing").toBe(NOT_VERIFIED);
  });

  test("a caller's stated scheme composes no arrival address on a deployment that answers here", async () => {
    // The last thing a caller wrote that reached this composition: `x-forwarded-proto`. On the
    // journeys' server, a developer's machine or an unconfigured deployment the arrival address is
    // carried, so a caller stamping `https` would otherwise hand themselves `https://localhost:3210`
    // — a page their own machine serves at that port — as an address this deployment answers at. The
    // scheme is the deployment's own statement, exactly like the address it is half of (R-SPINE-001).
    const forged = { host: "localhost:3210", "x-forwarded-proto": "https", origin: "https://localhost:3210" };
    const served = "http://localhost:3210";
    expect(dialledOnTheActionLane(forged, served)).toBe(served);
    // The other lane composes the same address: Next builds `Request.url`'s scheme from that same
    // header, so a caller writing it moves the URL the platform hands over too.
    expect(await dialledOnTheRequestLane("https://localhost:3210/api/trpc/spine.tenancy.assignRole", forged, served)).toBe(served);
    expect(refusalFor({ statedOrigin: "https://localhost:3210", requestOrigin: dialledOnTheActionLane(forged, served), configuredOrigin: served })).toBe(NOT_VERIFIED);
    // And with nothing configured at all — the same machine, no statement to read — the caller's
    // scheme is still not one of this deployment's addresses.
    expect(dialledOnTheActionLane(forged, "")).toBe(served);
  });

  test("the upstream a proxy rewrote Host to is no second origin the deployment answers at", async () => {
    // The cross-site request R-SPINE-006 legislates against, in the shape a hop would otherwise
    // create: a page served at the proxy's upstream address on the visitor's OWN machine, spending
    // their cookie against a deployment that answers on a network name.
    const rewritten = { host: "127.0.0.1:3000", "x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.7", origin: UPSTREAM };
    const requestOrigin = await dialledOnTheRequestLane(`${UPSTREAM}/api/trpc/spine.tenancy.assignRole`, rewritten, PUBLISHED);
    expect(
      refusalFor({ statedOrigin: UPSTREAM, requestOrigin, configuredOrigin: PUBLISHED }),
      "a deployment reached through a hop is admitted at what it states and nothing else",
    ).toBe(NOT_VERIFIED);
    expect(refusalFor({ statedOrigin: PUBLISHED, requestOrigin, configuredOrigin: PUBLISHED }), "and its own page is admitted as it always was").toBeNull();
  });

  test("a caller's own forwarding marks take an admission away from them and hand out none", async () => {
    // R-SPINE-001: nothing a caller writes decides this. `x-forwarded-host` is not read at all, so
    // the address stays the one the request arrived at and the origin they stated matches nothing.
    const forged = { host: "127.0.0.1:3211", "x-forwarded-host": "attacker.example", "x-forwarded-proto": "https", origin: "https://attacker.example" };
    const served = "http://127.0.0.1:3211";
    const requestOrigin = await dialledOnTheRequestLane(`${served}/api/trpc/spine.tenancy.assignRole`, forged, served);
    expect(refusalFor({ statedOrigin: "https://attacker.example", requestOrigin, configuredOrigin: served })).toBe(NOT_VERIFIED);
    expect(refusalFor({ statedOrigin: served, requestOrigin, configuredOrigin: served }), "the deployment's own statement is untouched by what a caller wrote").toBeNull();
  });
});

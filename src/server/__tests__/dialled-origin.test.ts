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
 * So the seam carries the address the request was DIALLED at: what arrived where nothing stands in
 * front, what the edge states the browser dialled where something does, and nothing at all where an
 * edge stated none. Both lanes are read here — the tRPC lane's `createContext` and the server
 * actions' `originFactsFromHeaders` — because a rule with one home is only as good as the facts each
 * transport hands it (ARCH-02, B-17).
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

  test("an in-process caller that composed the URL itself keeps its arrival address", async () => {
    // A suite driving the shipped handler writes no forwarding marks, so nothing stands between it
    // and the process: the URL it composed is the address it dialled.
    expect(await dialledOnTheRequestLane("http://127.0.0.1/api/trpc/spine.tenancy.assignRole", { host: "127.0.0.1" }, PUBLISHED)).toBe("http://127.0.0.1");
  });

  test("behind an edge, the address is the one the edge states the browser dialled", async () => {
    const behindAProxy = { host: "127.0.0.1:3000", "x-forwarded-host": "cubit.example", "x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.7" };
    expect(await dialledOnTheRequestLane(`${UPSTREAM}/api/trpc/spine.tenancy.assignRole`, behindAProxy, PUBLISHED)).toBe(PUBLISHED);
    expect(dialledOnTheActionLane(behindAProxy, PUBLISHED)).toBe(PUBLISHED);
  });

  test("an edge that states no dialled address leaves none to carry", async () => {
    // The hop's `Host` is its own upstream and says nothing about where the browser went.
    const rewritten = { host: "127.0.0.1:3000", "x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.7" };
    expect(await dialledOnTheRequestLane(`${UPSTREAM}/api/trpc/spine.tenancy.assignRole`, rewritten, PUBLISHED)).toBe("");
    expect(dialledOnTheActionLane(rewritten, PUBLISHED)).toBe("");
  });

  test("the upstream a proxy rewrote Host to is no second origin the deployment answers at", async () => {
    // The whole of the finding this closes: a page served at the proxy's upstream address on the
    // visitor's OWN machine, spending their cookie against a deployment answering on a network name.
    const rewritten = { host: "127.0.0.1:3000", "x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.7", origin: UPSTREAM };
    const requestOrigin = await dialledOnTheRequestLane(`${UPSTREAM}/api/trpc/spine.tenancy.assignRole`, rewritten, PUBLISHED);
    expect(
      refusalFor({ statedOrigin: UPSTREAM, requestOrigin, configuredOrigin: PUBLISHED }),
      "a deployment reached through a hop is admitted at what it states and nothing else",
    ).toBe(NOT_VERIFIED);
    expect(refusalFor({ statedOrigin: PUBLISHED, requestOrigin, configuredOrigin: PUBLISHED }), "and its own page is admitted as it always was").toBeNull();
  });

  test("a caller's own forwarding marks take an admission away from them and hand out none", async () => {
    // R-SPINE-001: nothing a caller writes decides this. Writing `x-forwarded-host` moves the dialled
    // address to what they wrote — which is not this machine, so it admits nothing.
    const forged = { host: "127.0.0.1:3211", "x-forwarded-host": "attacker.example", "x-forwarded-proto": "https", origin: "https://attacker.example" };
    const served = "http://127.0.0.1:3211";
    const requestOrigin = await dialledOnTheRequestLane(`${served}/api/trpc/spine.tenancy.assignRole`, forged, served);
    expect(refusalFor({ statedOrigin: "https://attacker.example", requestOrigin, configuredOrigin: served })).toBe(NOT_VERIFIED);
    expect(refusalFor({ statedOrigin: served, requestOrigin, configuredOrigin: served }), "the deployment's own statement is untouched by what a caller wrote").toBeNull();
  });
});

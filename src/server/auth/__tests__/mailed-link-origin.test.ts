/**
 * Public acceptance for AC-2 (R-SPINE-001): the origin of a mailed reset, magic-link or
 * verification link comes from `CUBIT_PUBLIC_ORIGIN` alone.
 *
 * The seam is observed the way every transport hands it over — a plain `Request` into
 * `createContext`, and `AppContext.origin` out. That is the whole of what a mailed link is built
 * from (`src/server/auth/session.ts`'s mailing doors take `origin` as an argument), and it is the
 * only half of the rule a lane with no database can honestly see: the doors themselves count an
 * attempt before they judge the origin, so their `LINK_NOT_SENDABLE` answer is the journeys' to
 * prove (tests/e2e/journeys/auth-identity-breaker.spec.ts and the J-001 mailed-link walks).
 *
 * Next builds a route handler's `Request.url` from the incoming `Host` header, so a request's own
 * URL is a caller-written value exactly like the four headers below; both are presented here, and
 * neither may move a link.
 *
 * The module is loaded by absolute path so a module the Builder has not written yet fails as an
 * assertion naming the file. This file is `.ts`, not `.tsx`, so `pnpm verify`'s `tsc` reads it too.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The homes the increment's interfaces name. */
const CONTEXT_MODULE = "src/server/context.ts";
const PLAYWRIGHT_CONFIG = "playwright.config.ts";

/** The deployment's one statement of its address (increment interfaces, `PUBLIC_ORIGIN_VAR`). */
const PUBLIC_ORIGIN_VAR = "CUBIT_PUBLIC_ORIGIN";

/**
 * An origin no request in this file carries, so a passing assertion can only have come from the
 * variable: a scheme, a host and a port that differ from both the loopback URL and the caller's
 * headers below.
 */
const CONFIGURED_ORIGIN = "https://links.cubit.example:8443";

/** The four caller-written values the criterion names, in the shapes a caller writes them. */
const CALLER_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "x-forwarded-proto": "https",
  "x-forwarded-host": "attacker.example",
  forwarded: "proto=https;host=attacker.example",
  host: "attacker.example",
});

/** The route the criterion posts at, on a plain-http loopback deployment — the journeys' shape. */
const LOOPBACK_URL = "http://127.0.0.1:3211/api/trpc/spine.auth.requestPasswordReset";

/** The same request as a caller who also rewrote the `Host` Next reads the URL from. */
const CALLER_URL = "https://attacker.example/api/trpc/spine.auth.requestPasswordReset";

interface AppContextShape {
  origin: string;
}

interface ContextModule {
  createContext(opts: { req: Request }): Promise<AppContextShape>;
}

type ModuleBag = Record<string, unknown>;

async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/**
 * A request as a transport hands it to the seam: a URL, and whatever headers the caller wrote.
 * `host` is among them, and node carries it — a caller who writes one is the shape this criterion
 * is about, so the request is built with it rather than around it.
 */
function requestAs(url: string, headers: Readonly<Record<string, string>> = {}): Request {
  const carried = new Headers();
  for (const [name, value] of Object.entries(headers)) carried.set(name, value);
  return new Request(url, { headers: carried });
}

/** Mint a context with the deployment's address set to `configured`, or to nothing at all. */
async function originFor(req: Request, configured: string | null): Promise<string> {
  const { createContext } = await productModule<ContextModule>(CONTEXT_MODULE);
  if (configured === null) delete process.env[PUBLIC_ORIGIN_VAR];
  else process.env[PUBLIC_ORIGIN_VAR] = configured;
  const ctx = await createContext({ req });
  return ctx.origin;
}

const OPERATORS_OWN = process.env[PUBLIC_ORIGIN_VAR];

afterEach(() => {
  // An operator's own value is never left changed by a test run.
  if (OPERATORS_OWN === undefined) delete process.env[PUBLIC_ORIGIN_VAR];
  else process.env[PUBLIC_ORIGIN_VAR] = OPERATORS_OWN;
});

describe("AC-2: a mailed link's origin is the deployment's own statement of its address", () => {
  test("AC-2: the configured origin decides, and nothing substitutes for it when it is absent", async () => {
    const configured = new URL(CONFIGURED_ORIGIN).origin;

    // Configured: the same origin, byte for byte, whatever the caller wrote and whatever host the
    // transport built the URL from.
    expect(await originFor(requestAs(LOOPBACK_URL), configured), "the configured origin is what a link is built on").toBe(configured);
    expect(
      await originFor(requestAs(LOOPBACK_URL, CALLER_HEADERS), configured),
      `x-forwarded-proto, x-forwarded-host, forwarded and host do not move a mailed link off ${configured} (R-SPINE-001)`,
    ).toBe(configured);
    expect(
      await originFor(requestAs(CALLER_URL, CALLER_HEADERS), configured),
      "nor does the URL the transport composed from the caller's own Host",
    ).toBe(configured);

    // Unconfigured: no request property substitutes. A loopback request is still a request, and its
    // scheme is one `x-forwarded-proto` decides, so the request's own URL is not a second source of
    // truth — the deployment has named no address and the mailing doors send nothing.
    expect(
      await originFor(requestAs(LOOPBACK_URL), null),
      `with ${PUBLIC_ORIGIN_VAR} unset, a request arriving on loopback is not an address to mail a link at`,
    ).toBe("");
    expect(
      await originFor(requestAs(LOOPBACK_URL, CALLER_HEADERS), null),
      `with ${PUBLIC_ORIGIN_VAR} unset, a caller's own headers name no address either`,
    ).toBe("");
    expect(await originFor(requestAs(CALLER_URL, CALLER_HEADERS), null), "nor does a caller-written Host").toBe("");

    // A blank or whitespace-only variable is not a statement of an address.
    expect(await originFor(requestAs(LOOPBACK_URL), "   "), `a blank ${PUBLIC_ORIGIN_VAR} names no address`).toBe("");
  });

  test("AC-2: the journeys' own web server names CUBIT_PUBLIC_ORIGIN as the config's own baseURL origin", async () => {
    const config = (await productModule<ModuleBag>(PLAYWRIGHT_CONFIG))["default"] as
      | { use?: { baseURL?: string }; webServer?: { env?: Record<string, string> } | { env?: Record<string, string> }[] }
      | undefined;
    expect(config, `${PLAYWRIGHT_CONFIG} has a default export`).toBeTruthy();

    const baseURL = config?.use?.baseURL;
    expect(typeof baseURL, `${PLAYWRIGHT_CONFIG} names the address the journeys drive (use.baseURL)`).toBe("string");
    const expected = new URL(baseURL as string).origin;

    const servers = Array.isArray(config?.webServer) ? config.webServer : config?.webServer === undefined ? [] : [config.webServer];
    expect(servers.length, `${PLAYWRIGHT_CONFIG} starts the product itself (webServer) — what CI ships is what the journeys walk`).toBeGreaterThan(0);

    for (const server of servers) {
      const env = server.env ?? {};
      expect(
        env[PUBLIC_ORIGIN_VAR],
        `the journeys' server is a deployment and names its own address, or every mailed-link journey silently stops mailing (${PUBLIC_ORIGIN_VAR} = the config's own baseURL origin)`,
      ).toBe(expected);
      // The database the journeys' server opens is still named here: naming one address may not
      // cost the lane the other (V-E2E).
      expect(typeof env["DATABASE_URL"], `${PLAYWRIGHT_CONFIG} still points the journeys' server at the journeys' database`).toBe("string");
    }
  });
});

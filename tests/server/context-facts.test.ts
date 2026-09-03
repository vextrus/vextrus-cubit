/**
 * AC-3, AC-5(d) and AC-6(b) — the request id the caller's trace survives as, and one derivation of
 * the arrival origin and the `Secure` flag for both lanes that ask for them (ARCH-02, B-17).
 *
 * The origin table is asserted as an equality between the lanes rather than as a roster of expected
 * addresses: what the law says is that one request has one arrival address and one `Secure` answer,
 * whichever seam asks. AC-6(b) pins the two values the rule itself decides.
 */
import { afterEach, describe, expect, test } from "vitest";
import { CONTEXT_MODULE, UUID_PATTERN, assertOnlyOneTestRebaselined, enclosingFunctionsOf, loadContext, productSource, stripComments } from "./support/wire";

const SEAM_HARDENING = "tests/server/seam-hardening.test.ts";

/** The pre-fix assertion B-20 re-baselines: the 100,000-character id echoed back whole. */
const REBASELINED_TEST = "a long id is still the caller's id and is echoed verbatim (AC-2)";

const PUBLIC_ORIGIN_VAR = "CUBIT_PUBLIC_ORIGIN";

/** The header rows the origin rule is decided over, with what the deployment states for each. */
const ROWS: { headers: Record<string, string>; configured: string | null }[] = [
  { headers: { host: "127.0.0.1:3211" }, configured: "http://127.0.0.1:3211" },
  { headers: { host: "cubit.example", "x-forwarded-proto": "https" }, configured: "https://cubit.example" },
  { headers: { host: "127.0.0.1:3000" }, configured: "https://cubit.example" },
  { headers: { host: "localhost:3000", "x-forwarded-host": "attacker.example" }, configured: null },
  { headers: { host: "cubit.example", "x-forwarded-host": "localhost" }, configured: null },
];

const requestWith = (headers: Record<string, string>, url = "http://cubit.test/api/trpc/spine.health"): Request => new Request(url, { headers: new Headers(headers) });

const withRequestId = (id: string): Request => requestWith({ "x-request-id": id });

const configuredOrigin = (value: string | null): void => {
  if (value === null) delete process.env[PUBLIC_ORIGIN_VAR];
  else process.env[PUBLIC_ORIGIN_VAR] = value;
};

const originallyConfigured = process.env[PUBLIC_ORIGIN_VAR];

afterEach(() => {
  configuredOrigin(originallyConfigured ?? null);
});

describe("AC-3: the request id the caller's trace survives as", () => {
  test("AC-3: a supplied id is trimmed, and a blank one is no id at all", async () => {
    const { createContext } = await loadContext();
    expect((await createContext({ req: withRequestId("  req-1  ") })).requestId, "the padding around a header value is not part of the caller's id").toBe("req-1");

    const blank = (await createContext({ req: withRequestId("   ") })).requestId;
    const alsoBlank = (await createContext({ req: withRequestId("\t \t") })).requestId;
    expect(blank, "a header carrying only whitespace states no id, so one is minted").toMatch(UUID_PATTERN);
    expect(alsoBlank, "two blank headers are two requests, each with its own minted id").not.toBe(blank);
  });

  test("AC-3: an over-long id is bounded by truncation, never replaced by a minted one", async () => {
    const { createContext, REQUEST_ID_MAX_LENGTH } = await loadContext();
    expect(typeof REQUEST_ID_MAX_LENGTH, `${CONTEXT_MODULE} must export REQUEST_ID_MAX_LENGTH`).toBe("number");
    expect(REQUEST_ID_MAX_LENGTH, "the declared bound: a UUID (36) and a W3C traceparent (55) both fit").toBe(128);

    const bound = REQUEST_ID_MAX_LENGTH as number;
    const supplied = "x".repeat(100_000);
    const requestId = (await createContext({ req: withRequestId(supplied) })).requestId;
    expect(requestId, "the caller's prefix is kept, so their trace still matches — a minted id would break it silently").toBe(supplied.slice(0, bound));
  });

  test("AC-3: one derivation answers the arrival origin and the Secure flag for both lanes", async () => {
    const { createContext, deploymentIsSecure, originFactsFromHeaders } = await loadContext();
    expect(typeof originFactsFromHeaders, `${CONTEXT_MODULE} must export originFactsFromHeaders`).toBe("function");
    expect(typeof deploymentIsSecure, `${CONTEXT_MODULE} must export deploymentIsSecure`).toBe("function");
    const factsOf = originFactsFromHeaders as (sent: Headers) => { requestOrigin: string; secureCookies?: unknown };
    const isSecure = deploymentIsSecure as (req: Request) => boolean;

    for (const row of ROWS) {
      configuredOrigin(row.configured);
      const where = `${JSON.stringify(row.headers)} against ${String(row.configured)}`;
      const facts = factsOf(new Headers(row.headers));
      const context = await createContext({ req: requestWith(row.headers) });

      expect(typeof facts.secureCookies, `RequestOriginFacts carries a boolean secureCookies — ${where}`).toBe("boolean");
      expect(facts.requestOrigin, `the two lanes compose different arrival addresses for one request — ${where}`).toBe(context.requestOrigin);
      expect(facts.secureCookies, `the headers lane and deploymentIsSecure disagree about Secure — ${where}`).toBe(isSecure(requestWith(row.headers)));
      expect(facts.secureCookies, `the headers lane and the minted context disagree about Secure — ${where}`).toBe(context.secureCookies);
    }
  });

  test("AC-3: the seam reads its environment in one function and narrates no build", () => {
    const source = productSource(CONTEXT_MODULE);
    const code = stripComments(source);

    const readers = enclosingFunctionsOf(source, "process.env");
    expect(readers.length, `${CONTEXT_MODULE} reads process.env nowhere — the deployment's own statement has to come from somewhere`).toBeGreaterThan(0);
    expect([...new Set(readers)], `${CONTEXT_MODULE} reads process.env in more than one function: ${[...new Set(readers)].join(", ")}`).toHaveLength(1);
    expect(code.split(PUBLIC_ORIGIN_VAR).length - 1, `${PUBLIC_ORIGIN_VAR} is spelled more than once in code — the variable's name has one home`).toBe(1);

    for (const narration of ["earlier reading", "An earlier", "this increment"]) {
      expect(source.includes(narration), `${CONTEXT_MODULE} narrates the build ("${narration}") — comments cite Bible ids (Q-17)`).toBe(false);
    }
    expect(/\binc-\d/.test(source), `${CONTEXT_MODULE} names an increment id — process artifacts never appear in src/ comments (Q-17)`).toBe(false);
  });

  test("AC-3: the B-20 re-baseline moves exactly the assertion whose law changed", () => {
    assertOnlyOneTestRebaselined(SEAM_HARDENING, REBASELINED_TEST);
  });
});

describe("AC-5 and AC-6: the edges of the request id and the Secure flag", () => {
  test("AC-5: a padded over-long id is bounded to the same id every time", async () => {
    const { createContext, REQUEST_ID_MAX_LENGTH } = await loadContext();
    const bound = REQUEST_ID_MAX_LENGTH as number;
    expect(typeof bound, `${CONTEXT_MODULE} must export REQUEST_ID_MAX_LENGTH`).toBe("number");
    const supplied = `${" ".repeat(100)}${"y".repeat(bound + 1)}${" ".repeat(100)}`;

    const once = (await createContext({ req: withRequestId(supplied) })).requestId;
    const again = (await createContext({ req: withRequestId(supplied) })).requestId;
    expect(once, "trimmed, then bounded — never minted").toBe("y".repeat(bound));
    expect(again, "bounding is deterministic: two requests stating one id carry one id").toBe(once);
  });

  test("AC-6: an unconfigured deployment answering on a real hostname keeps Secure, and a stated http origin drops it", async () => {
    const { deploymentIsSecure, originFactsFromHeaders } = await loadContext();
    const factsOf = originFactsFromHeaders as (sent: Headers) => { secureCookies?: unknown };
    const isSecure = deploymentIsSecure as (req: Request) => boolean;
    const headers = { host: "cubit.example", "x-forwarded-host": "localhost", "x-forwarded-proto": "http" };
    const req = (): Request => requestWith(headers, "http://localhost/api/trpc/spine.health");

    configuredOrigin(null);
    expect(factsOf(new Headers(headers)).secureCookies, "absence is not permission: an unconfigured deployment on a real hostname is treated as TLS").toBe(true);
    expect(isSecure(req()), "the two lanes disagree about Secure for the same request").toBe(true);

    configuredOrigin("http://cubit.example");
    expect(factsOf(new Headers(headers)).secureCookies, "the deployment stated plain http — the one party entitled to say so").toBe(false);
    expect(isSecure(req()), "the two lanes disagree about Secure for the same request").toBe(false);
  });
});

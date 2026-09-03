/**
 * AC-4(e), AC-4(f), AC-4(g) and AC-6(c) — one home for the cleared session cookie (ARCH-02).
 *
 * The shell writes a cookie carrying the attributes a browser matches an expiry against, rather than
 * deleting one by name; the tRPC lane serialises the same value, so the wire form is unchanged. Both
 * are observed through the shipped code: `next/headers` is replaced because a server-rendered route
 * is handed a jar and not a request, and the two identity-seam calls that would dial a database are
 * answered here so the cookie under test is still the product's own.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AUTH_SESSION_MODULE, SHELL_SESSION_MODULE, callMutation, productModule, productSource, shippedMutationHandler } from "./support/wire";

/** A token the (stood-in) store knows, and the session it resolves to. */
const LIVE_TOKEN = "a-live-session-token";
const LIVE_SESSION = { sessionId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };

/** The cookie jar a server-rendered route is handed, recording what the shell does to it. */
const jar = { set: vi.fn(), delete: vi.fn(), get: vi.fn(() => undefined) };

/** The headers the platform kept about the request the shell is rendering. */
let sent = new Headers({ host: "localhost:3000" });

vi.mock("next/headers", () => ({
  cookies: async () => jar,
  headers: async () => sent,
}));

// Only the two calls that would dial a database are answered here; every other export of the
// identity seam — the cookie's name, its attributes, `clearedSessionCookie` — stays the shipped one.
vi.mock("../../src/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    resolveSession: async (token: string) => (token === LIVE_TOKEN ? LIVE_SESSION : null),
    signOut: async () => ({ endedAt: new Date(0).toISOString() }),
  };
});

interface ClearedSessionCookie {
  name: string;
  value: string;
  path: string;
  httpOnly: boolean;
  sameSite: string;
  secure: boolean;
  maxAge: number;
}

interface AuthSessionModule {
  clearedSessionCookie?: (secure: boolean) => ClearedSessionCookie;
}

interface ShellSessionModule {
  endSession(sessionToken: string | null): Promise<void>;
}

async function clearedCookieOf(secure: boolean): Promise<ClearedSessionCookie> {
  const { clearedSessionCookie } = await productModule<AuthSessionModule>(AUTH_SESSION_MODULE);
  expect(typeof clearedSessionCookie, `${AUTH_SESSION_MODULE} must export clearedSessionCookie — the cleared cookie has one home (ARCH-02)`).toBe("function");
  return (clearedSessionCookie as (secure: boolean) => ClearedSessionCookie)(secure);
}

beforeEach(() => {
  jar.set.mockClear();
  jar.delete.mockClear();
  delete process.env.CUBIT_PUBLIC_ORIGIN;
});

describe("AC-4 and AC-6: ending a session", () => {
  test("AC-4: the cleared cookie is one value, carrying the attributes a browser matches on", async () => {
    const cleared = await clearedCookieOf(false);
    expect(cleared).toEqual({ name: "cubit_session", value: "", path: "/", httpOnly: true, sameSite: "lax", secure: false, maxAge: 0 });
    expect((await clearedCookieOf(true)).secure, "the flag the caller states is the flag the cookie carries").toBe(true);
  });

  test("AC-4: the shipped sign-out puts the same cookie on the wire, byte for byte", async () => {
    const answer = await callMutation(await shippedMutationHandler(), "spine.auth.signOut", {
      requestId: "req-sign-out",
      host: "127.0.0.1:3000",
      cookie: `cubit_session=${LIVE_TOKEN}`,
    });

    expect(answer.setCookie, `the sign-out answered no Set-Cookie: ${answer.raw.slice(0, 400)}`).toEqual(["cubit_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"]);
  });

  test("AC-4: the shell sets the cleared cookie rather than deleting one by name", async () => {
    sent = new Headers({ host: "localhost:3000" });
    const { endSession } = await productModule<ShellSessionModule>(SHELL_SESSION_MODULE);

    await endSession(null);

    expect(jar.set.mock.calls.length, "the shell wrote no cookie at all").toBe(1);
    expect(jar.set.mock.calls[0]?.[0], "a cookie deleted by name carries none of the attributes it was set with").toEqual(await clearedCookieOf(false));
    expect(jar.delete.mock.calls.length, "`cookies().delete` drops the attributes a browser matches an expiry against").toBe(0);
  });

  test("AC-6: the shell reads Secure from the same seam the transport does", async () => {
    sent = new Headers({ host: "cubit.example" });
    const { endSession } = await productModule<ShellSessionModule>(SHELL_SESSION_MODULE);

    await endSession("not-a-live-token");

    expect(jar.set.mock.calls.length, "a token that resolves to nothing still ends the cookie").toBe(1);
    expect(jar.set.mock.calls[0]?.[0], "an unconfigured deployment on a real hostname clears a Secure cookie — absence is not permission").toEqual(await clearedCookieOf(true));
    expect(jar.delete.mock.calls.length).toBe(0);
  });

  test("AC-4: the render memo cites the clause it serves rather than the cost it saved", () => {
    const source = productSource("src/server/shell/resolve.ts");
    expect(source.includes("cost three round trips"), "src/server/shell/resolve.ts narrates the pre-fix cost — comments cite Bible ids (Q-17)").toBe(false);
    expect(source.includes("R-SPINE-001"), "src/server/shell/resolve.ts must cite the clause the memo serves").toBe(true);
  });
});

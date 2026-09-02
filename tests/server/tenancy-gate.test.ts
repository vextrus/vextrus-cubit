// The database this suite must never reach: a closed port, so a read that happens at all fails
// loudly and immediately. Set before the first import of src/server, because the database seam
// reads the variable when it first connects.
process.env.DATABASE_URL = "postgres://cubit:none@127.0.0.1:1/cubit";

/**
 * AC-4(c), AC-4(d), AC-4(g), AC-6(a) and AC-6(d) — the tenancy transport asks the origin question
 * before it reads anything (R-SPINE-006), and narrows a parsed body to the move it names.
 *
 * The proof drives the shipped router with `createCaller` against a database nobody can reach: a
 * transport that reads the roster before verifying the origin fails with a connection error, and one
 * that verifies first refuses ORIGIN_NOT_VERIFIED. No mock stands in for either.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { TENANCY_ROUTER_MODULE, loadErrors, loadFaults, loadRefusalMarker, productModule, productSource, withFaultSink } from "./support/wire";

/** A stranger's page, spending this deployment's cookie. */
const FOREIGN_ORIGIN = "https://attacker.example";

/** Where this deployment answers, as both the request and the configuration state it. */
const HERE = "http://127.0.0.1:3211";

interface TenancyContext {
  requestId: string;
  actor: string;
  origin: string;
  statedOrigin: string | null;
  requestOrigin: string;
  deviceLabel: string;
  client: string;
  session: { sessionId: string; userId: string } | null;
  secureCookies: boolean;
  cookies: string[];
}

interface TenancyCaller {
  assignRole(input: { subjectUserId: string; role: string }): Promise<unknown>;
  removeMember(input: { subjectUserId: string }): Promise<unknown>;
}

interface RoleMove {
  kind: string;
  subjectUserId: string;
  role?: string;
}

interface TenancyRouterModule {
  tenancyRouter: { createCaller(ctx: TenancyContext): TenancyCaller };
  assignRoleInput?: (raw: unknown) => RoleMove;
  removeMemberInput?: (raw: unknown) => RoleMove;
}

const loadTenancy = (): Promise<TenancyRouterModule> => productModule<TenancyRouterModule>(TENANCY_ROUTER_MODULE);

function contextWith(overrides: Partial<TenancyContext>): TenancyContext {
  return {
    requestId: randomUUID(),
    actor: "an-account",
    origin: HERE,
    statedOrigin: null,
    requestOrigin: HERE,
    deviceLabel: "a browser",
    client: "an unobserved caller",
    session: { sessionId: randomUUID(), userId: randomUUID() },
    secureCookies: false,
    cookies: [],
    ...overrides,
  };
}

/** The value a call rejected with, or null when it resolved — a resolution is its own failure here. */
async function rejection(call: Promise<unknown>): Promise<unknown> {
  return call.then(
    () => null,
    (failure: unknown) => failure,
  );
}

describe("AC-4 and AC-6: the origin is verified before anything is read", () => {
  test("AC-4: assignRole from a foreign origin refuses before the database is consulted", async () => {
    const faults = await loadFaults();
    const { refusalCodeOf } = await loadRefusalMarker();
    const { REFUSALS } = await loadErrors();
    const { tenancyRouter } = await loadTenancy();

    await withFaultSink(faults, async (records) => {
      const caller = tenancyRouter.createCaller(contextWith({ statedOrigin: FOREIGN_ORIGIN }));
      const failure = await rejection(caller.assignRole({ subjectUserId: randomUUID(), role: "MEMBER" }));

      expect(failure, "a foreign page's role move was carried out").not.toBeNull();
      expect(refusalCodeOf(failure), "the roster was read before the origin was verified — the failure is a connection error, not a refusal").toBe(REFUSALS.ORIGIN_NOT_VERIFIED?.code);
      expect(records, "a refusal is an answer, not an outage: nothing reaches the fault seam").toEqual([]);
    });
  });

  test("AC-6: removeMember refuses the same way, and a signed-out caller is answered before either question", async () => {
    const faults = await loadFaults();
    const { refusalCodeOf } = await loadRefusalMarker();
    const { REFUSALS } = await loadErrors();
    const { tenancyRouter } = await loadTenancy();

    await withFaultSink(faults, async (records) => {
      const caller = tenancyRouter.createCaller(contextWith({ statedOrigin: FOREIGN_ORIGIN }));
      const failure = await rejection(caller.removeMember({ subjectUserId: randomUUID() }));
      expect(refusalCodeOf(failure)).toBe(REFUSALS.ORIGIN_NOT_VERIFIED?.code);
      expect(records).toEqual([]);
    });

    await withFaultSink(faults, async (records) => {
      const caller = tenancyRouter.createCaller(contextWith({ statedOrigin: FOREIGN_ORIGIN, session: null }));
      const failure = await rejection(caller.assignRole({ subjectUserId: randomUUID(), role: "MEMBER" }));
      expect(refusalCodeOf(failure), "a door that needs a session says so first — an expired session and a foreign origin are two different answers (B-21)").toBe(REFUSALS.SIGNED_OUT?.code);
      expect(records).toEqual([]);
    });
  });
});

describe("AC-4 and AC-6: each mutation's body is narrowed to its own kind", () => {
  test("AC-4: assignRoleInput and removeMemberInput read a body into the move it names", async () => {
    const { assignRoleInput, removeMemberInput } = await loadTenancy();
    expect(typeof assignRoleInput, `${TENANCY_ROUTER_MODULE} must export assignRoleInput`).toBe("function");
    expect(typeof removeMemberInput, `${TENANCY_ROUTER_MODULE} must export removeMemberInput`).toBe("function");

    const assign = assignRoleInput as (raw: unknown) => RoleMove;
    expect(assign({ subjectUserId: "u", role: "MEMBER" })).toEqual({ kind: "assignRole", subjectUserId: "u", role: "MEMBER" });
  });

  test("AC-6: a malformed body is a fault, and a removal carries no role", async () => {
    const { refusalCodeOf } = await loadRefusalMarker();
    const { assignRoleInput, removeMemberInput } = await loadTenancy();
    const assign = assignRoleInput as (raw: unknown) => RoleMove;
    const remove = removeMemberInput as (raw: unknown) => RoleMove;

    let refused: unknown = null;
    try {
      assign({ kind: "removeMember", subjectUserId: "u" });
      expect.fail("a body naming no role was read as an assignRole");
    } catch (failure: unknown) {
      refused = failure;
    }
    expect(refusalCodeOf(refused), "a body nobody could read is a fault: no request was judged and found wanting (ARCH-03)").toBeNull();

    const removal = remove({ subjectUserId: "u", role: "OWNER" });
    expect(Object.hasOwn(removal, "role"), "a removal names no role, whatever the body stated").toBe(false);
    expect(removal).toEqual({ kind: "removeMember", subjectUserId: "u" });
  });

  test("AC-4: the transport's comments cite clauses rather than another file's procedures", () => {
    const source = productSource(TENANCY_ROUTER_MODULE);
    expect(source.includes("spelled against"), `${TENANCY_ROUTER_MODULE} still describes another file's procedures — comments cite Bible ids (Q-17)`).toBe(false);
  });
});

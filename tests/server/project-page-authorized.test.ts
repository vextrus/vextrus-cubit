/**
 * The project pages' guard, at the choke point they all render inside.
 *
 * Before it, a server component read project data with a tenant taken from the URL and, in the worst
 * of them, no session at all: `forTenant({ tenantId: params.tenant })` arms the row policy with
 * whatever it is handed, and `projectHeld` then answers a question about existence that a stranger
 * may ask as freely as a member. This states the three answers the layout now gives.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const nav = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => nav);

const seam = vi.hoisted(() => ({
  authorize: vi.fn(async () => ({ authorized: true, actor: {}, tenantId: "tenant-1", userId: "user-1" })),
  token: vi.fn(async () => "a-live-token" as string | null),
  session: vi.fn(async (token: string | null) => (token === null ? null : { sessionId: "s", userId: "user-1" })),
}));
vi.mock("../../src/server/authorize", () => ({ authorize: seam.authorize, authorizeOrThrow: vi.fn() }));
vi.mock("../../src/server/shell/session", () => ({ presentedSessionToken: seam.token }));
vi.mock("../../src/server/shell/resolve", () => ({ sessionOf: seam.session }));

const { authorizePage } = await import("../../src/server/authorize-page");

beforeEach(() => {
  vi.clearAllMocks();
  nav.redirect.mockImplementation((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  });
  nav.notFound.mockImplementation(() => {
    throw new Error("NOT_FOUND");
  });
  seam.token.mockImplementation(async () => "a-live-token");
  seam.session.mockImplementation(async (token) => (token === null ? null : { sessionId: "s", userId: "user-1" }));
  seam.authorize.mockImplementation(async () => ({ authorized: true, actor: {}, tenantId: "tenant-1", userId: "user-1" }));
});

describe("a project page is rendered for its own workspace and nobody else's", () => {
  test("a signed-out request is sent to sign in, and no project is read", async () => {
    seam.token.mockImplementation(async () => null);
    await expect(authorizePage({ tenant: "tenant-1", project: "project-1" })).rejects.toThrow("REDIRECT:/sign-in");
    expect(seam.authorize, "a door with no session has nothing to authorize").not.toHaveBeenCalled();
  });

  test("a stranger's session is answered exactly as a project that is not there", async () => {
    seam.authorize.mockImplementation(async () => ({ authorized: false, refusal: "PERMISSION_NOT_HELD" }) as never);
    await expect(authorizePage({ tenant: "tenant-1", project: "project-1" })).rejects.toThrow("NOT_FOUND");
    expect(nav.notFound, "not a screen that says which project ids exist inside a workspace you are not in").toHaveBeenCalled();
  });

  test("the guard is asked about the project, and the tenant from the URL is an assertion it checks", async () => {
    const answer = await authorizePage({ tenant: "tenant-1", project: "project-1", permission: "MEASURE" });
    expect(seam.authorize).toHaveBeenCalledWith({
      userId: "user-1",
      tenantId: "tenant-1",
      projectId: "project-1",
      permission: "MEASURE",
      actType: null,
    });
    expect(answer.tenantId, "the reads below are scoped by what the guard answered, never by the segment").toBe("tenant-1");
  });
});

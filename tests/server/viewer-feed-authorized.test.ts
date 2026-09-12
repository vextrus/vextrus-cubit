/**
 * The viewer feed asks the one guard (B-17, ARCH-02).
 *
 * `GET /api/viewer/{drawing}/{layout}` asked `holdsWorkspace` and nothing else: a member of the
 * workspace was served every sheet of every project in it, whatever they held on the project the
 * sheet belongs to — the half-guard `authorize()` was written to replace. The door now names the
 * drawing's OWN project (read as the system, never taken from the wire), the drawing itself, and
 * whether the caller is ON that project. NOT a permission: L-ACT-03 cuts its enum on what an act
 * MOVES, and four of the six shipped roles hold no MEASURE — a feed that named it served a REVIEWER
 * and a stranger the same 403 (the adversary's F1/F2).
 *
 * The door's answer set is unchanged: 401 SIGNED_OUT, 403 WORKSPACE_PERMISSION_NOT_HELD. A caller
 * still cannot tell "not yours" from "not there" (Q-12), and no new code is registered.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const DRAWING = "0f9b1b7c-2f3a-4c2e-9d1a-2b3c4d5e6f70";
const PROJECT = "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d";
const TENANT = "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9";
const LAYOUT = "Sheet 1";

const guard = vi.hoisted(() => ({
  authorize: vi.fn(async () => ({ authorized: true, actor: {}, tenantId: "tenant-1", userId: "user-1" })),
}));
vi.mock("../../src/server/authorize", () => ({ authorize: guard.authorize, authorizeOrThrow: vi.fn() }));

const seam = vi.hoisted(() => ({
  drawingAddress: vi.fn(async () => ({ tenantId: "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9", projectId: "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d" }) as { tenantId: string; projectId: string } | null),
  renderManifestOf: vi.fn(async () => ({ kind: "absent" as const })),
  session: vi.fn(async () => ({ sessionId: "s", userId: "user-1" }) as { sessionId: string; userId: string } | null),
}));
vi.mock("../../src/modules/takeoff/viewer", () => ({ drawingAddress: seam.drawingAddress, renderManifestOf: seam.renderManifestOf }));
vi.mock("../../src/core/storage/app", () => ({ appStorage: () => ({}) }));
// The session the door is answered under is the CONTEXT's — `routeHandler` mints it once per request
// (R-SPINE-001) — so the resolution is mocked where the context reads it.
vi.mock("../../src/server/auth/session", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  resolveSession: seam.session,
}));

const { GET } = await import("../../src/app/api/viewer/[drawing]/[layout]/route");

function ask(query = "part=head"): Promise<Response> {
  return GET(new Request(`http://127.0.0.1/api/viewer/${DRAWING}/${encodeURIComponent(LAYOUT)}?${query}`, { headers: { cookie: "cubit_session=a-live-token" } }), {
    params: Promise.resolve({ drawing: DRAWING, layout: LAYOUT }),
  });
}

/** The registered code a refusal answer carries. */
async function refusalOf(response: Response): Promise<string> {
  const body = (await response.json()) as { refusal?: { code?: string } };
  return String(body.refusal?.code);
}

beforeEach(() => {
  vi.clearAllMocks();
  guard.authorize.mockImplementation(async () => ({ authorized: true, actor: {}, tenantId: TENANT, userId: "user-1" }));
  seam.drawingAddress.mockImplementation(async () => ({ tenantId: TENANT, projectId: PROJECT }));
  seam.renderManifestOf.mockImplementation(async () => ({ kind: "absent" }) as never);
  seam.session.mockImplementation(async () => ({ sessionId: "s", userId: "user-1" }));
});

describe("GET /api/viewer/{drawing}/{layout} asks the one guard", () => {
  test("the drawing's own project, the drawing and the READ's own question reach the guard", async () => {
    await ask();
    expect(guard.authorize, "the project is the drawing's own, read as the system — never a segment the caller wrote").toHaveBeenCalledWith({
      userId: "user-1",
      tenantId: TENANT,
      projectId: PROJECT,
      drawingId: DRAWING,
      participation: true,
    });
  });

  test("a workspace member the guard refuses is refused at the door, and no sheet is read", async () => {
    guard.authorize.mockImplementation(async () => ({ authorized: false, refusal: "PERMISSION_NOT_HELD" }) as never);
    const response = await ask();
    expect(response.status, "the door's shipped status for a refused reader").toBe(403);
    expect(await refusalOf(response), "the door's own closed answer set is unchanged (Q-12)").toBe("WORKSPACE_PERMISSION_NOT_HELD");
    expect(seam.renderManifestOf, "nothing is read for a reader the guard did not admit").not.toHaveBeenCalled();
  });

  test("a `?tenant=` that disagrees with the drawing's workspace names none, and asks nothing", async () => {
    const response = await ask(`part=head&tenant=${PROJECT}`);
    expect(response.status).toBe(403);
    expect(guard.authorize, "a workspace the caller wrote is judged before anybody is asked about it").not.toHaveBeenCalled();
  });

  test("a REVIEWER of the drawing's own project is served the head and every layer", async () => {
    // The guard answers for the caller it was asked about; what this door must not do is ask a
    // question a REVIEWER cannot pass. The head and a layer are both asked for, because the feed
    // authorizes once per request and a screen makes many.
    for (const query of ["part=head", "part=layer&index=0", "part=layer&index=7"]) {
      const response = await ask(query);
      expect(response.status, `a REVIEWER reviews the measurements taken off this sheet (${query})`).not.toBe(403);
    }
    for (const call of guard.authorize.mock.calls) {
      expect(call[0], "no permission is named at a read door").not.toHaveProperty("permission");
    }
  });

  test("no session is no admission, before any workspace question is asked", async () => {
    seam.session.mockImplementation(async () => null);
    const response = await ask();
    expect(response.status).toBe(401);
    expect(await refusalOf(response)).toBe("SIGNED_OUT");
    expect(guard.authorize, "a door with no session has nothing to authorize").not.toHaveBeenCalled();
  });
});

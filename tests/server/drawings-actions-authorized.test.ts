/**
 * The sheet index's two machine requests ask the one guard (B-17, ARCH-02).
 *
 * `workspaceFor` (src/app/(app)/t/[tenant]/p/[project]/drawings/actions.ts) stopped at
 * `holdsWorkspace`: any member of a workspace could set a sibling project's drawings to be read and
 * to be drawn, whatever they held on that project. Reading a drawing is what a person does before
 * they may measure it, and the upload door that put it there admits a workspace member — so these
 * two ask what the upload asks, and never MEASURE: a drawing lawfully uploaded would otherwise sit
 * `stored` and never be read (the adversary's finding 3).
 *
 * A drawing a door NAMES travels with the question, so the guard binds it to the project rather
 * than merely to the workspace (R-SPINE-004).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const PROJECT = "project-1";
const DRAWING = "drawing-1";

const guard = vi.hoisted(() => ({
  authorize: vi.fn(async () => ({ authorized: true, actor: {}, tenantId: "tenant-1", userId: "user-1" })),
}));
vi.mock("../../src/server/authorize", () => ({ authorize: guard.authorize, authorizeOrThrow: vi.fn() }));

const seams = vi.hoisted(() => ({
  requestIngest: vi.fn(async () => ({ jobId: "job-1", deduplicated: false })),
  requestThumbnails: vi.fn(async () => ({ jobId: "job-2", deduplicated: true })),
  session: vi.fn(async () => ({ sessionId: "s", userId: "user-1" }) as { sessionId: string; userId: string } | null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("../../src/modules/takeoff/ingest", () => ({ requestIngest: seams.requestIngest }));
vi.mock("../../src/modules/takeoff/thumbnails", () => ({ requestThumbnails: seams.requestThumbnails }));
vi.mock("../../src/server/shell/session", () => ({ presentedSessionToken: vi.fn(async () => "a-live-token") }));
vi.mock("../../src/server/shell/resolve", () => ({ sessionOf: seams.session }));

const actions = await import("../../src/app/(app)/t/[tenant]/p/[project]/drawings/actions");

beforeEach(() => {
  vi.clearAllMocks();
  guard.authorize.mockImplementation(async () => ({ authorized: true, actor: {}, tenantId: "tenant-1", userId: "user-1" }));
  seams.session.mockImplementation(async () => ({ sessionId: "s", userId: "user-1" }));
});

describe("the drawings actions ask the one guard for the permission a reading moves", () => {
  test("asking for every stored drawing to be read names the project, and no permission", async () => {
    await actions.requestSheetsFor({ projectId: PROJECT, drawingIds: [DRAWING] });
    expect(guard.authorize, "the project's OWN workspace, never a tenant id from a form field").toHaveBeenCalledWith({
      userId: "user-1",
      projectId: PROJECT,
    });
  });

  test("a member who may upload gets the drawing ingested: the two doors of one flow agree", async () => {
    // The queue calls this as each row reaches `stored`. The upload door admits a workspace member
    // and names no permission, so a door that demanded MEASURE here left a lawfully uploaded drawing
    // stored and never read (the adversary's finding 3).
    seams.requestIngest.mockImplementation(async () => ({ jobId: "job-9", deduplicated: false }));
    const asked = await actions.requestSheetsFor({ projectId: PROJECT, drawingIds: [DRAWING] });
    expect(asked[0]?.refusal, "nothing about MEASURE stands between an upload and its reading").toBeNull();
    expect(asked[0]?.jobId, "the drawing is enqueued to be read").toBe("job-9");
    const asks = guard.authorize.mock.calls.map((call) => (call as unknown[])[0] as Record<string, unknown>);
    expect(asks.every((ask) => !Object.hasOwn(ask, "permission")), "no permission is named at either door of this flow").toBe(true);
  });

  test("a caller the guard refuses is refused, and nothing is enqueued for any drawing", async () => {
    guard.authorize.mockImplementation(async () => ({ authorized: false, refusal: "PERMISSION_NOT_HELD" }) as never);
    const asked = await actions.requestSheetsFor({ projectId: PROJECT, drawingIds: [DRAWING, "drawing-2"] });
    expect(asked.map((row) => row.refusal), "the guard's own registered code, carried back per drawing").toEqual([
      "PERMISSION_NOT_HELD",
      "PERMISSION_NOT_HELD",
    ]);
    expect(seams.requestIngest, "a drawing that will never be read is answered, never enqueued").not.toHaveBeenCalled();
  });

  test("asking for a drawing's sheets to be drawn binds the drawing to the project at the guard", async () => {
    await actions.requestThumbnailsFor({ projectId: PROJECT, drawingId: DRAWING });
    expect(guard.authorize, "the row policy is a tenant boundary and cannot tell a sibling project's sheet from this one's").toHaveBeenCalledWith({
      userId: "user-1",
      projectId: PROJECT,
      drawingId: DRAWING,
    });
  });

  test("a caller the guard refuses is refused at the thumbnails door too", async () => {
    guard.authorize.mockImplementation(async () => ({ authorized: false, refusal: "PERMISSION_NOT_HELD" }) as never);
    expect(await actions.requestThumbnailsFor({ projectId: PROJECT, drawingId: DRAWING })).toEqual({
      jobId: null,
      deduplicated: false,
      refusal: "PERMISSION_NOT_HELD",
    });
    expect(seams.requestThumbnails).not.toHaveBeenCalled();
  });

  test("no session is no admission, before any workspace question is asked", async () => {
    seams.session.mockImplementation(async () => null);
    const asked = await actions.requestSheetsFor({ projectId: PROJECT, drawingIds: [DRAWING] });
    expect(asked[0]?.refusal).toBe("SIGNED_OUT");
    expect(guard.authorize, "a door with no session has nothing to authorize").not.toHaveBeenCalled();
  });
});

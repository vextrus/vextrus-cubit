/**
 * Two doors that named a drawing and were scoped only by the workspace (R-SPINE-004).
 *
 * `authorize()` binds a NAMED drawing to the project that named it, because the row policy is a
 * tenant boundary: every project of one workspace reads under the same scope, so a drawing id
 * posted from one project's screen reached a sibling project's sheet and the policy standing behind
 * the read handed it over. Two doors carried a drawing and did not state it — the Trace's
 * `linesCiting` read and the confirm-discipline pair — so the guard could not bind what it was
 * never told about.
 *
 * The claim is made where the binding is stated: the argument `projectActorFor` passes on to the
 * guard. A `SHEET` group key names an ingest record rather than a drawing and states nothing here;
 * its membership is the act seam's project-scoped read.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const PROJECT = "project-1";
const DRAWING = "drawing-1";

const spine = vi.hoisted(() => ({
  projectActorFor: vi.fn(async () => ({ tenantId: "tenant-1", userId: "user-1", actorKind: "human" })),
}));
vi.mock("../../src/server/routers/spine", () => ({ projectActorFor: spine.projectActorFor }));

const seams = vi.hoisted(() => ({
  linesCiting: vi.fn(async () => []),
  lineEvidence: vi.fn(async () => null),
  preview: vi.fn(async () => ({ subjects: [] })),
  commit: vi.fn(async () => ({ actId: "act-1" })),
  session: vi.fn(async () => ({ sessionId: "s", userId: "user-1" }) as { sessionId: string; userId: string } | null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("../../src/modules/takeoff/trace", () => ({ linesCiting: seams.linesCiting, lineEvidence: seams.lineEvidence }));
vi.mock("../../src/modules/takeoff/ingest", () => ({ requestIngest: vi.fn() }));
vi.mock("../../src/modules/takeoff/thumbnails", () => ({ requestThumbnails: vi.fn() }));
vi.mock("../../src/server/shell/session", () => ({ presentedSessionToken: vi.fn(async () => "a-live-token") }));
vi.mock("../../src/server/shell/resolve", () => ({ sessionOf: seams.session }));
vi.mock("../../src/core/acts", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  preview: seams.preview,
  commit: seams.commit,
  consequenceDigest: () => "digest-1",
}));

const trace = await import("../../src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/trace-actions");
const drawings = await import("../../src/app/(app)/t/[tenant]/p/[project]/drawings/actions");

beforeEach(() => {
  vi.clearAllMocks();
  spine.projectActorFor.mockImplementation(async () => ({ tenantId: "tenant-1", userId: "user-1", actorKind: "human" }));
  seams.session.mockImplementation(async () => ({ sessionId: "s", userId: "user-1" }));
});

describe("a door that names a drawing states it at the guard", () => {
  test("the Trace's citing read binds the sheet it is about to the project", async () => {
    await trace.readLinesCiting({ projectId: PROJECT, drawingId: DRAWING, sourceKeys: ["key-1"] });
    expect(spine.projectActorFor, "the drawing is the fifth argument the guard binds by").toHaveBeenCalledWith("user-1", PROJECT, null, "MEASURE", DRAWING);
  });

  test("a preview of a proposed discipline binds the drawing the group key names", async () => {
    await drawings.previewConfirmDiscipline({ projectId: PROJECT, group: { kind: "PROPOSED_DISCIPLINE", drawingId: DRAWING, discipline: "STRUCTURAL" } });
    expect(spine.projectActorFor).toHaveBeenCalledWith("user-1", PROJECT, "CONFIRM_DISCIPLINE", "MEASURE", DRAWING);
  });

  test("a commit of the same group binds it too — a bound preview over an unbound write proves nothing", async () => {
    await drawings.commitConfirmDiscipline({
      projectId: PROJECT,
      group: { kind: "PROPOSED_DISCIPLINE", drawingId: DRAWING, discipline: "STRUCTURAL" },
      consequenceDigest: "digest-1",
    });
    expect(spine.projectActorFor).toHaveBeenCalledWith("user-1", PROJECT, "CONFIRM_DISCIPLINE", "MEASURE", DRAWING);
  });

  test("a SHEET key names an ingest record rather than a drawing, and states no binding", async () => {
    await drawings.previewConfirmDiscipline({ projectId: PROJECT, group: { kind: "SHEET", sheetId: "record-1:Sheet 1", discipline: "STRUCTURAL" } });
    expect(spine.projectActorFor, "nothing is claimed to be a drawing that is not one").toHaveBeenCalledWith("user-1", PROJECT, "CONFIRM_DISCIPLINE", "MEASURE", undefined);
  });
});

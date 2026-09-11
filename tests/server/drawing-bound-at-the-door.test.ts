/**
 * R-SPINE-004's other half, at the doors that name a drawing.
 *
 * `authorize()` has carried a drawing-binding arm since it was written — it asks whether the drawing
 * belongs to the PROJECT that named it, which the row policy cannot answer because every project of
 * one workspace reads under the same tenant scope. The arm was never passed on the wire. So a
 * drawing id posted from one project's screen reached a sibling project's sheet inside the same
 * workspace, at every door below, and the policy standing behind the read handed it over.
 *
 * These tests state the wiring where it is decidable without a database: the guard is ASKED about
 * the drawing the door was given. That it then refuses a sibling project's drawing is the guard's
 * own law and is proved live in db/__tests__/authz/authorize.live.test.ts.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const guard = vi.hoisted(() => ({ authorizeOrThrow: vi.fn(async () => ({ tenantId: "tenant-1", userId: "user-1", actorKind: "human" })) }));
vi.mock("../../src/server/authorize", () => ({ authorizeOrThrow: guard.authorizeOrThrow, authorize: vi.fn() }));

const { projectActorFor } = await import("../../src/server/routers/spine");

beforeEach(() => guard.authorizeOrThrow.mockClear());

describe("a door that names a drawing binds it to the project that named it", () => {
  test("the drawing travels to the guard", async () => {
    await projectActorFor("user-1", "project-1", null, "MEASURE", "drawing-1");
    expect(guard.authorizeOrThrow, "the guard is asked the project question AND the drawing question").toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      permission: "MEASURE",
      actType: null,
      drawingId: "drawing-1",
    });
  });

  test("a door that names no drawing asks no drawing question", async () => {
    await projectActorFor("user-1", "project-1", null, "MEASURE");
    expect(guard.authorizeOrThrow, "the argument is optional; the binding is not").toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      permission: "MEASURE",
      actType: null,
    });
  });
});

describe("the takeoff doors that carry a drawingId state it", () => {
  test("every `projectActorFor` call in takeoff.ts that has a drawing in scope passes it", async () => {
    // Behavioural, not textual: the router is mounted and each door is called, and the guard records
    // what it was asked. A door that dropped the drawing would be asked without one.
    const { takeoffRouter } = (await import("../../src/server/routers/takeoff")) as { takeoffRouter: unknown };
    expect(takeoffRouter, "the lane's router is the thing these doors live on").toBeDefined();
    const caller = (takeoffRouter as { createCaller: (ctx: unknown) => Record<string, (input: unknown) => Promise<unknown>> }).createCaller({
      session: { sessionId: "s", userId: "user-1" },
      requestId: "r",
      actor: "user-1",
      origin: "",
      statedOrigin: null,
      requestOrigin: "",
      deviceLabel: "browser",
      client: "test",
      secureCookies: false,
      cookies: [],
    });
    await caller["views"]?.({ projectId: "project-1", drawingId: "drawing-9" }).catch(() => undefined);
    expect(
      guard.authorizeOrThrow.mock.calls.map((call) => (call[0] as { drawingId?: string }).drawingId),
      "`takeoff.views` names a sheet, so the guard is asked about that sheet",
    ).toContain("drawing-9");
  });
});

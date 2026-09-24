/**
 * The rooms doors, judged at the doors themselves — live, against a scratch database the committed
 * migrations built (V-DB, viewer.md Part 7, I-687).
 *
 * Every entry point resolves actor, tenant, project, participation and permission through the one
 * `authorize()`, and carries a live-database test that a caller without the permission is refused BY
 * NAME. `takeoffRooms.ask`, `.preview` and `.commit` move MEASURE; `.rooms` is a participant's read:
 *   · a REVIEWER reads the panel — knowledge is not permission — and is refused `PERMISSION_NOT_HELD`
 *     at the ask, the preview and the commit, with no act and no confirmation written;
 *   · a statement the doors cannot read — a kind outside the closed enum, a type outside the roster —
 *     is `REQUEST_MALFORMED`, never a fault;
 *   · a MEASURER confirms a plan's rooms in ONE act: the Consequence names exactly the rooms whose type
 *     the labels read, the commit writes one confirmation per room at LABEL, and the plan's group then
 *     answers `GROUP_NOT_OFFERED`; the room the grammar cannot type is left out, listed UNASKED, and a
 *     person confirms it on its own at the type they give it (PERSON).
 *
 * The people, workspaces and projects are real: accounts are enrolled through the shipped sign-up door
 * and the doors are called through the router's own caller, with a context the shipped `createContext`
 * mints off a request carrying the person's real session cookie. The partition's rooms are seeded as
 * the rooms stage writes them.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { TENANT_COLUMN } from "../../db/__tests__/support/fixtures";
import { ident, lit } from "../../db/__tests__/support/live-sql";
import { closeStage, enrol, openStage, productModule, sql, sqlValue, stageProject, type Person } from "../spine/uploads/support/upload-stage";
import { stageDrawing, unique } from "../takeoff/support/ingest-stage";

const ROUTER_MODULE = "src/server/routers/takeoff-rooms.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";
const ERRORS_MODULE = "src/core/errors.ts";

const BUDGET_MS = 300_000;

const MEASURER = "MEASURER";
const REVIEWER = "REVIEWER";

/** The plan the seeded rooms stand on, as the rooms stage keys a view. */
const PLAN = "v:LAYOUT_PLAN:DXF_HANDLE:CAP";

type Door = {
  rooms(input: unknown): Promise<unknown>;
  ask(input: unknown): Promise<unknown>;
  preview(input: unknown): Promise<{ consequence: { subjects: { subjectId: string; subjectLabel?: string; after: string[] }[] }; consequenceDigest: string }>;
  commit(input: unknown): Promise<{ actId: string }>;
};

afterAll(async () => {
  await closeStage();
});

/** A project of the person's own workspace, this role on it for them, and a drawing of it with a record. */
async function projectFor(person: Person, name: string, role: string): Promise<{ projectId: string; drawingId: string; ingestId: string }> {
  const projectId = stageProject(person.tenantId, name);
  sql(
    `insert into participants (${ident(TENANT_COLUMN)}, project_id, user_id)
       values (${lit(person.tenantId)}, ${lit(projectId)}, ${lit(person.userId)}) on conflict do nothing;
     insert into participant_roles (${ident(TENANT_COLUMN)}, project_id, user_id, role)
       values (${lit(person.tenantId)}, ${lit(projectId)}, ${lit(person.userId)}, ${lit(role)}) on conflict do nothing;`,
  );
  const bytes = new TextEncoder().encode(`0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; ${name}\n`);
  const drawing = await stageDrawing(person as never, projectId, bytes, { name: unique("A-02.dxf"), format: "dxf" });
  const ingestId = randomUUID();
  sql(
    `insert into ingests (tenant_id, ingest_id, drawing_id, sha256, job_id, artifact_sha256, extractor_scheme, extractor_tool, extractor_tool_version, extractor_parameter_set_hash, facts)
       values (${lit(person.tenantId)}::uuid, ${lit(ingestId)}::uuid, ${lit(drawing.drawingId)}::uuid, ${lit(drawing.sha256)}, ${lit(`rooms-${ingestId}`)},
               ${lit(randomBytes(32).toString("hex"))}, 'DXF_HANDLE', 'ezdxf', '1.4.4', 'rooms-door', '{}'::json);`,
  );
  return { projectId, drawingId: drawing.drawingId, ingestId };
}

/** One room as the rooms stage writes it. */
function seedRoom(person: Person, at: { projectId: string; drawingId: string; ingestId: string }, room: { key: string; name: string | null; label: string; status: string; reason: string | null }): void {
  const labels = JSON.stringify(room.name === null ? [] : room.name.split(" / ").map((name, index) => ({ key: `DXF_HANDLE:${room.label}${index}`, name, size: null, agrees: null, astray: false })));
  const outline = room.status === "NOT_CLOSED" ? "null" : `'${JSON.stringify({ outer: [[0, 0], [4000, 0], [4000, 3000], [0, 3000]], holes: [] })}'::jsonb`;
  sql(
    `insert into room_outlines (tenant_id, project_id, drawing_id, ingest_id, room_key, view_key, layout_name, status, reason, name, labels, outline, area_m2, anchor_x, anchor_y, faces, source_keys)
       values (${lit(person.tenantId)}::uuid, ${lit(at.projectId)}::uuid, ${lit(at.drawingId)}::uuid, ${lit(at.ingestId)}::uuid, ${lit(room.key)}, ${lit(PLAN)}, 'Model',
               ${lit(room.status)}, ${room.reason === null ? "null" : lit(room.reason)}, ${room.name === null ? "null" : lit(room.name)}, '${labels}'::jsonb, ${outline},
               ${room.status === "NOT_CLOSED" ? "null" : "'12'"}, 2000, 1500, '[]'::jsonb, array[${lit(`DXF_HANDLE:${room.label}F`)}]);`,
  );
}

/** The shipped doors, as this person's live session reaches them. */
async function doorFor(person: Person): Promise<Door> {
  const { createContext } = await productModule<{ createContext(opts: { req: Request }): Promise<unknown> }>(CONTEXT_MODULE);
  const { takeoffRoomsRouter } = await productModule<{ takeoffRoomsRouter: { createCaller(ctx: unknown): Door; _def?: { procedures?: Record<string, unknown> } } }>(ROUTER_MODULE);
  expect(Object.keys(takeoffRoomsRouter._def?.procedures ?? {}).sort(), "the rooms lane's four doors are on the wire").toEqual(["ask", "commit", "preview", "rooms"]);
  const request = new Request("http://127.0.0.1/api/trpc/takeoffRooms.preview", { method: "POST", headers: { cookie: person.cookie } });
  return takeoffRoomsRouter.createCaller(await createContext({ req: request }));
}

/** What the door threw — and, where it answered instead, a failure that says so. */
async function refusalFrom(work: () => Promise<unknown>, what: string): Promise<string | null> {
  const { refusalCodeOf } = await productModule<{ refusalCodeOf(error: unknown): string | null }>(REFUSAL_MARKER_MODULE);
  let answered: unknown;
  let thrown: unknown;
  let refused = false;
  try {
    answered = await work();
  } catch (caught) {
    thrown = caught;
    refused = true;
  }
  if (!refused) expect.fail(`${what} must be refused, and the door answered with ${JSON.stringify(answered)}`);
  return refusalCodeOf(thrown);
}

async function code(name: string): Promise<string> {
  const found = (await productModule<{ REFUSALS: Record<string, { code: string } | undefined> }>(ERRORS_MODULE)).REFUSALS[name]?.code;
  expect(found, `the register publishes ${name}`).toBeDefined();
  return found as string;
}

function confirmations(tenantId: string): { roomKey: string; type: string; basis: string }[] {
  const rows = sqlValue(
    `select coalesce(json_agg(json_build_object('roomKey', room_key, 'type', room_type, 'basis', basis) order by room_key), '[]'::json)::text
       from room_confirmations where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid;`,
  );
  return JSON.parse(rows) as { roomKey: string; type: string; basis: string }[];
}

function roomActs(tenantId: string): number {
  return Number(sqlValue(`select count(*)::text from acts where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and act_type = 'CONFIRM_ROOMS';`));
}

/** A plan of four regions: two rooms the labels type, one they cannot, and one whose walls do not close. */
function seedPlan(person: Person, at: { projectId: string; drawingId: string; ingestId: string }): void {
  seedRoom(person, at, { key: "room-a", name: "BED-01", label: "A", status: "CLOSED", reason: null });
  seedRoom(person, at, { key: "room-b", name: "TOILET-02", label: "B", status: "CLOSED", reason: null });
  seedRoom(person, at, { key: "room-c", name: "M.BED", label: "C", status: "CLOSED", reason: null });
  seedRoom(person, at, { key: "room-d", name: "GUARD ROOM", label: "D", status: "NOT_CLOSED", reason: "SURFACE_NOT_CLOSED" });
}

describe("the rooms doors, at the guard", () => {
  it(
    "lets a REVIEWER read the panel and refuses them the ask, the preview and the commit, by name, writing nothing",
    async () => {
      await openStage();
      const reviewer = await enrol("rooms-door-reviewer");
      const at = await projectFor(reviewer, "Rooms — reviewer", REVIEWER);
      seedPlan(reviewer, at);
      const permission = await code("PERMISSION_NOT_HELD");
      const door = await doorFor(reviewer);

      const read = (await door.rooms({ projectId: at.projectId, drawingId: at.drawingId })) as { state: string; plans: { offered: number; untyped: number; refused: unknown[] }[] };
      expect(read.state, "a participant reads what the project holds").toBe("READ");
      expect(read.plans.map((plan) => [plan.offered, plan.untyped, plan.refused.length])).toEqual([[2, 1, 1]]);

      const group = { kind: "PROPOSED_ROOMS", drawingId: at.drawingId, viewKey: PLAN };
      expect(await refusalFrom(() => door.ask({ projectId: at.projectId, drawingId: at.drawingId }), "a REVIEWER asking the model"), "asking spends and ledgers: MEASURE's").toBe(permission);
      expect(await refusalFrom(() => door.preview({ projectId: at.projectId, group }), "a REVIEWER previewing"), `${REVIEWER} holds no MEASURE (L-ACT-03)`).toBe(permission);
      expect(await refusalFrom(() => door.commit({ projectId: at.projectId, group, consequenceDigest: "0".repeat(64) }), "a REVIEWER committing")).toBe(permission);
      expect(roomActs(reviewer.tenantId), "a refused door writes no act").toBe(0);
      expect(confirmations(reviewer.tenantId), "and no confirmation").toEqual([]);
    },
    BUDGET_MS,
  );

  it(
    "answers a statement it cannot read with REQUEST_MALFORMED — a kind outside the enum, a type outside the roster, a list of rooms",
    async () => {
      await openStage();
      const measurer = await enrol("rooms-door-malformed");
      const at = await projectFor(measurer, "Rooms — malformed", MEASURER);
      const malformed = await code("REQUEST_MALFORMED");
      const door = await doorFor(measurer);
      expect(await refusalFrom(() => door.preview({ projectId: at.projectId, group: { kind: "ROOMS", drawingId: at.drawingId, viewKey: PLAN } }), "a kind nobody offers")).toBe(malformed);
      expect(await refusalFrom(() => door.preview({ projectId: at.projectId, group: { kind: "ROOM", drawingId: at.drawingId, roomKey: "room-c", roomType: "GARAGE" } }), "a type outside the roster")).toBe(malformed);
      expect(await refusalFrom(() => door.preview({ projectId: at.projectId, rooms: ["room-a", "room-b"] }), "a list assembled by the caller"), "bulk is offered, never assembled (L-ACT-02)").toBe(malformed);
    },
    BUDGET_MS,
  );

  it(
    "lets a MEASURER confirm a plan's rooms in one act, leaves the untyped room for a person, and offers the plan no more",
    async () => {
      await openStage();
      const measurer = await enrol("rooms-door-measurer");
      const at = await projectFor(measurer, "Rooms — measurer", MEASURER);
      seedPlan(measurer, at);
      const notOffered = await code("GROUP_NOT_OFFERED");
      const door = await doorFor(measurer);
      const group = { kind: "PROPOSED_ROOMS", drawingId: at.drawingId, viewKey: PLAN };

      const previewed = await door.preview({ projectId: at.projectId, group });
      expect(
        previewed.consequence.subjects.map((subject) => [subject.subjectId, subject.subjectLabel, subject.after]),
        "exactly the rooms the labels type — the unclosed region and the abbreviation are not in the plan's group",
      ).toEqual([
        ["room-a", "BED-01", ["BED", "LABEL"]],
        ["room-b", "TOILET-02", ["TOILET", "LABEL"]],
      ]);
      await door.commit({ projectId: at.projectId, group, consequenceDigest: previewed.consequenceDigest });
      expect(roomActs(measurer.tenantId), "one reviewed act").toBe(1);
      expect(confirmations(measurer.tenantId)).toEqual([
        { roomKey: "room-a", type: "BED", basis: "LABEL" },
        { roomKey: "room-b", type: "TOILET", basis: "LABEL" },
      ]);
      expect(await refusalFrom(() => door.preview({ projectId: at.projectId, group }), "the plan confirmed again"), "a confirmed room leaves the group").toBe(notOffered);

      const read = (await door.rooms({ projectId: at.projectId, drawingId: at.drawingId })) as { plans: { confirmed: number; rooms: { roomKey: string; state: string; why: string | null }[] }[] };
      expect(read.plans[0]?.confirmed).toBe(2);
      expect(read.plans[0]?.rooms.find((room) => room.roomKey === "room-c"), "the abbreviation waits for the model, and says so").toMatchObject({ state: "WAITING", why: "UNASKED" });

      const single = { kind: "ROOM", drawingId: at.drawingId, roomKey: "room-c", roomType: "BED" };
      const one = await door.preview({ projectId: at.projectId, group: single });
      expect(one.consequence.subjects.map((subject) => subject.after)).toEqual([["BED", "PERSON"]]);
      await door.commit({ projectId: at.projectId, group: single, consequenceDigest: one.consequenceDigest });
      expect(confirmations(measurer.tenantId).find((row) => row.roomKey === "room-c")).toEqual({ roomKey: "room-c", type: "BED", basis: "PERSON" });
      expect(
        await refusalFrom(() => door.preview({ projectId: at.projectId, group: { kind: "ROOM", drawingId: at.drawingId, roomKey: "room-d", roomType: "GUARD" } }), "a region whose walls do not close"),
        "a room is confirmed only where it closes",
      ).toBe(notOffered);
    },
    BUDGET_MS,
  );
});

/**
 * ARCH-03 at the two transports that answer without tRPC: `routeHandler` and `serverCall`.
 *
 * The distinction the seam is built on is "a refusal is an answer; a fault is an outage of ours",
 * and both doors held only half of it:
 *
 *  * `routeHandler`'s catch recognised exactly ONE registered refusal — REQUEST_MALFORMED, the code
 *    the seam itself raises. Every other registered refusal raised under a route door — and
 *    `src/modules/takeoff/ingest/pipeline.ts` raises WORKSPACE_PERMISSION_NOT_HELD and
 *    SHEET_NOT_INGESTABLE — was recorded at the fault seam and answered 500. A door telling a
 *    caller "you may not" was logged as the tier being down, and the operator's fault stream filled
 *    with answers that worked (B-21).
 *  * `serverCall` had the mirror hole: an UNREGISTERED throw was re-raised (`refused`) and nothing
 *    was recorded, so an action's real outage reached the error boundary with no record behind it —
 *    the one thing ARCH-03 says may never happen.
 *
 * The status a refusal travels with is the register's, read from the one table the tRPC lane already
 * answers from; a refusal can never be a 5xx, and 400 is the floor a code with no HTTP name keeps.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { REFUSALS } from "../../src/core/errors";
import { refusal } from "../../src/core/faults/refusal-marker";
import { setFaultSink, type FaultRecord } from "../../src/core/faults/report";

/** A live session, without a database: the seam resolves one token per request and this is it. */
vi.mock("../../src/server/shell/session", () => ({ presentedSessionToken: async () => "a-live-token" }));
vi.mock("../../src/server/shell/resolve", () => ({
  sessionOf: async (token: string | null) => (token === null ? null : { sessionId: "session-1", userId: "user-1" }),
}));

const { routeHandler, serverCall, json } = await import("../../src/server/call");

/** Everything the fault seam recorded while `body` ran. A refusal must leave this empty. */
async function faultsDuring<T>(body: () => Promise<T>): Promise<{ answer: T; records: FaultRecord[] }> {
  const records: FaultRecord[] = [];
  const previous = setFaultSink((record) => void records.push(record));
  try {
    return { answer: await body(), records };
  } finally {
    setFaultSink(previous);
  }
}

const DOOR = { route: "GET /probe", actor: "probe", schema: z.object({}).passthrough() } as const;
const ask = (): Request => new Request("http://127.0.0.1/probe");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("a registered refusal raised under a route door is an answer", () => {
  test("WORKSPACE_PERMISSION_NOT_HELD is 403 with the register's entry and no fault", async () => {
    const handler = routeHandler(DOOR, async () => {
      throw refusal(REFUSALS.WORKSPACE_PERMISSION_NOT_HELD.code, "the door's own operator detail");
    });
    const { answer, records } = await faultsDuring(async () => handler(ask()));
    expect(answer.status, "a refusal is the answer a well-formed request earned; it is never a 5xx").toBe(403);
    const body = (await answer.json()) as { refusal?: { code?: string }; faultId?: string };
    expect(body.refusal?.code, "the caller reads the register's entry").toBe("WORKSPACE_PERMISSION_NOT_HELD");
    expect(body.faultId, "a refusal carries no fault id, because nothing of ours failed (B-21)").toBeUndefined();
    expect(records, `a refusal records no fault; the sink saw ${JSON.stringify(records.map((r) => r.cause))}`).toEqual([]);
  });

  test("SHEET_NOT_INGESTABLE — the pipeline's other throw — is answered, not recorded", async () => {
    const handler = routeHandler(DOOR, async () => {
      throw refusal(REFUSALS.SHEET_NOT_INGESTABLE.code, "pdf is not a format the cad extractor reads");
    });
    const { answer, records } = await faultsDuring(async () => handler(ask()));
    expect(answer.status, "a code with no HTTP name of its own keeps the floor: understood, not carried out").toBe(400);
    expect(((await answer.json()) as { refusal?: { code?: string } }).refusal?.code).toBe("SHEET_NOT_INGESTABLE");
    expect(records, "a refusal records no fault").toEqual([]);
  });

  test("an unregistered throw is still a fault: 500, a recorded id, and nothing else on the wire", async () => {
    const handler = routeHandler(DOOR, async () => {
      throw new Error("the store went away mid-answer");
    });
    const { answer, records } = await faultsDuring(async () => handler(ask()));
    expect(answer.status, "an outage of ours is a 500").toBe(500);
    const body = (await answer.json()) as { faultId?: string; refusal?: unknown };
    expect(typeof body.faultId, "the caller is given the id the outage was recorded under, and nothing else").toBe("string");
    expect(body.refusal, "a fault is not a refusal and carries no registered entry").toBeUndefined();
    expect(records.map((r) => r.route), "the fault seam recorded it under the door's own route").toEqual([DOOR.route]);
    expect(records[0]?.faultId, "the id the caller was given is the id on the record").toBe(body.faultId);
  });

  test("a marker carrying a code the register does not hold is a fault, not an answer", async () => {
    const handler = routeHandler(DOOR, async () => {
      throw Object.assign(new Error("improvised"), { refusalCode: "NOT_IN_THE_REGISTER" });
    });
    const { answer, records } = await faultsDuring(async () => handler(ask()));
    expect(answer.status, "the taxonomy is closed: only a registered code may claim a refusal's status (R-SPINE-062)").toBe(500);
    expect(records.length, "and it is recorded as the outage it is").toBe(1);
  });
});

describe("an action's outage is recorded before it leaves serverCall", () => {
  test("an unregistered throw records a fault and travels on to the error boundary", async () => {
    const acting = serverCall(
      z.object({}).passthrough(),
      async () => {
        throw new Error("the act seam could not write");
      },
      (code: string) => ({ done: false, refusal: code }),
    );
    const { records } = await faultsDuring(async () => {
      await expect(acting({}), "a fault is re-raised, which is what puts it on the error boundary").rejects.toThrow("the act seam could not write");
      return null;
    });
    expect(records.length, "ARCH-03: no failure of ours leaves this tier unrecorded").toBe(1);
    expect(records[0]?.actor, "recorded as the session that asked").toBe("user-1");
  });

  test("a registered refusal is carried back in the answer shape and records nothing", async () => {
    const acting = serverCall(
      z.object({}).passthrough(),
      async () => {
        throw refusal(REFUSALS.PERMISSION_NOT_HELD.code, "the door's own detail");
      },
      (code: string) => ({ done: false, refusal: code }),
    );
    const { answer, records } = await faultsDuring(async () => acting({}));
    expect(answer, "the screen reads the code it already reads").toEqual({ done: false, refusal: "PERMISSION_NOT_HELD" });
    expect(records, "a refusal records no fault").toEqual([]);
  });
});

test("the seam still answers a statement it cannot read as 400, unchanged", async () => {
  const handler = routeHandler({ route: "GET /strict", actor: "probe", schema: z.object({ body: z.string() }) }, async () => json({}, 200));
  const answer = await handler(ask());
  expect(answer.status).toBe(400);
  expect(((await answer.json()) as { refusal?: { code?: string } }).refusal?.code).toBe("REQUEST_MALFORMED");
});

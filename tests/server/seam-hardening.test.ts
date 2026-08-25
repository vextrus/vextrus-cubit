/**
 * Hardening proofs for the fault seam — the cases the criteria imply but no acceptance reaches.
 *
 * Composed through the same shipped machinery the acceptance uses (`probeHandler` mounts the
 * product's `router`/`publicProcedure`/`createContext`/`trpcOnError`), so these observe answers,
 * never internals.
 */
import { TRPCError } from "@trpc/server";
import { describe, expect, test } from "vitest";
import { callWire, errorData, loadContext, loadFaults, loadTrpc, probeHandler, withFaultSink, type FaultRecord } from "./support/wire";

/** An error object shared across requests — a module-scope constant, or one a retry re-throws. */
const SHARED = new Error("the pool is down");

/**
 * The same, already a `TRPCError`: tRPC hands this very object to both callbacks unwrapped, so it
 * is the shape in which one object really does reach the seam twice on two different requests.
 */
const SHARED_TRPC = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "the pool is down" });

describe("the seam tells a refusal from a fault however the failure is wrapped", () => {
  test("a refusal marker on a TRPCError that also carries a cause is still a refusal (ARCH-03)", async () => {
    const faults = await loadFaults();
    const handler = await probeHandler({
      probeMarkedTrpcError: () => {
        throw Object.assign(new TRPCError({ code: "FORBIDDEN", cause: new Error("row-level security said no") }), {
          refusalCode: "SIGNED_OUT",
        });
      },
    });

    await withFaultSink(faults, async (records) => {
      const data = errorData(await callWire(handler, "probeMarkedTrpcError", { requestId: "req-marked-trpc" }));

      expect(data.kind, "a marked TRPCError that keeps its cause is a refusal, not an outage").toBe("refusal");
      expect(data.refusalCode).toBe("SIGNED_OUT");
      expect(records, "a refusal reaches no operator sink").toHaveLength(0);
    });
  });

  test("a marker two hops below a directly-thrown TRPCError is an outage, not a refusal (ARCH-03)", async () => {
    const faults = await loadFaults();
    const handler = await probeHandler({
      // tRPC hands a directly-thrown TRPCError to both callbacks unmodified, so the value the
      // procedure threw IS this TRPCError: the marker is read on it and on its direct cause, and no
      // deeper. The code below sits on the cause's OWN cause — a taxonomy code for something else
      // entirely, buried in a wrapped low-level failure — and must not silence the outage.
      probeGrandchildMarker: () => {
        throw new TRPCError({
          code: "FORBIDDEN",
          cause: new Error("the pool is down", { cause: { refusalCode: "SIGNED_OUT" } }),
        });
      },
    });

    await withFaultSink(faults, async (records) => {
      const data = errorData(await callWire(handler, "probeGrandchildMarker", { requestId: "req-grandchild" }));

      expect(data.kind, "a grandchild marker turned an outage into a silent refusal").toBe("fault");
      expect(records, "the operator must still see this failure").toHaveLength(1);
      expect((records[0] as FaultRecord).requestId).toBe("req-grandchild");
    });
  });
});

describe("one failure, one record — and one record per failure (B-21)", () => {
  test("the same error object thrown by two requests records both, each under its own request id", async () => {
    const faults = await loadFaults();
    const handler = await probeHandler({
      probeShared: () => {
        throw SHARED;
      },
    });

    await withFaultSink(faults, async (records) => {
      const first = errorData(await callWire(handler, "probeShared", { requestId: "req-shared-one" }));
      const second = errorData(await callWire(handler, "probeShared", { requestId: "req-shared-two" }));

      expect(first.requestId).toBe("req-shared-one");
      expect(second.requestId).toBe("req-shared-two");
      expect(second.faultId, "the second outage is its own fault, not a replay of the first").not.toBe(first.faultId);

      expect(records, "two outages, two records").toHaveLength(2);
      const a = records[0] as FaultRecord;
      const b = records[1] as FaultRecord;
      expect([a.requestId, b.requestId]).toEqual(["req-shared-one", "req-shared-two"]);
      expect([a.faultId, b.faultId]).toEqual([first.faultId, second.faultId]);
    });
  });

  test("a re-thrown TRPCError constant is a new outage on every request, never a replay of the first", async () => {
    const faults = await loadFaults();
    const handler = await probeHandler({
      probeSharedTrpc: () => {
        throw SHARED_TRPC;
      },
    });

    await withFaultSink(faults, async (records) => {
      const first = errorData(await callWire(handler, "probeSharedTrpc", { requestId: "req-trpc-one" }));
      const second = errorData(await callWire(handler, "probeSharedTrpc", { requestId: "req-trpc-two" }));

      expect(first.requestId).toBe("req-trpc-one");
      expect(second.requestId, "the second caller was handed the first request's id").toBe("req-trpc-two");
      expect(second.faultId).not.toBe(first.faultId);

      expect(records, "two outages, two records — the operator sees both").toHaveLength(2);
      const a = records[0] as FaultRecord;
      const b = records[1] as FaultRecord;
      expect([a.requestId, b.requestId]).toEqual(["req-trpc-one", "req-trpc-two"]);
    });
  });

  test("two procedures in ONE batch that throw the same error object leave two records, one per route", async () => {
    const faults = await loadFaults();
    const handler = await probeHandler({
      probeBatchOne: () => {
        throw SHARED;
      },
      probeBatchTwo: () => {
        throw SHARED;
      },
    });

    await withFaultSink(faults, async (records) => {
      // One request id covers both calls, so a memo keyed on (error object, request) alone would
      // hand the second failure the first's answer and file a single record under one route — an
      // outage the operator never sees (B-21: one failure, one record, and one record per failure).
      const req = new Request("http://cubit.test/api/trpc/probeBatchOne,probeBatchTwo?batch=1&input=%7B%7D", {
        method: "GET",
        headers: { "x-request-id": "req-batch" },
      });
      const answers = JSON.parse(await (await handler(req, { params: Promise.resolve({ trpc: ["probeBatchOne", "probeBatchTwo"] }) })).text()) as {
        error?: { data?: { kind?: string; faultId?: string } };
      }[];

      expect(answers, "the batch answered both calls").toHaveLength(2);
      const ids = answers.map((answer) => answer.error?.data?.faultId);
      expect(answers.map((answer) => answer.error?.data?.kind)).toEqual(["fault", "fault"]);
      expect(ids[0], "the second failure was answered with the first one's fault id").not.toBe(ids[1]);

      expect(records, "two failures in one batch, two records").toHaveLength(2);
      const routes = records.map((record) => (record as FaultRecord).route).sort();
      expect(routes, "each record names the route that actually failed").toEqual(["probeBatchOne", "probeBatchTwo"]);
      expect(records.map((record) => (record as FaultRecord).faultId).sort()).toEqual([...ids].sort());
    });
  });

  test("a primitive thrown value handed to the seam twice is still one failure, one record", async () => {
    const faults = await loadFaults();
    const { answerFor } = await loadTrpc();

    await withFaultSink(faults, async (records) => {
      // `answerFor` is an exported seam, not just the formatter's private helper: the shipped
      // transport funnels everything through `getTRPCErrorFromUnknown` first, but nothing stops a
      // future mount from handing over the raw thrown value — and a value that cannot key the memo
      // would be decided (and recorded) once per reader: two fault ids for one failure, only one of
      // which the caller is ever told.
      const call = { error: "the pool is down", path: "spine.health", ctx: { requestId: "req-primitive", actor: "anonymous" } };
      const first = answerFor(call);
      const second = answerFor(call);

      expect(first.kind).toBe("fault");
      expect(second.faultId, "the second reader was told a different fault id").toBe(first.faultId);
      expect(records, "one failure, one record").toHaveLength(1);
      expect((records[0] as FaultRecord).faultId).toBe(first.faultId);
    });
  });

  test("one failing request still leaves exactly one record", async () => {
    const faults = await loadFaults();
    const handler = await probeHandler({
      probeOnce: () => {
        throw new Error("a single outage");
      },
    });

    await withFaultSink(faults, async (records) => {
      await callWire(handler, "probeOnce", { requestId: "req-once" });
      expect(records).toHaveLength(1);
    });
  });
});

describe("the caller's request id is honoured within bounds", () => {
  const request = (value: string) => new Request("http://cubit.test/api/trpc/spine.health", { headers: { "x-request-id": value } });
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  test("an ordinary supplied id is echoed verbatim", async () => {
    const { createContext } = await loadContext();
    expect((await createContext({ req: request("req-from-the-edge") })).requestId).toBe("req-from-the-edge");
  });

  test("a printable non-ASCII id is still an id and is honoured verbatim (AC-2)", async () => {
    const { createContext } = await loadContext();
    // This is a bn-BD product and gateways stamp UTF-8: dropping such an id would silently break
    // the caller's trace, and AC-2 promises the supplied header is echoed. Header values are bytes,
    // so a UTF-8 id reaches the seam as its byte string — that is the form asserted here.
    const supplied = Buffer.from("অনুরোধ-১২৩", "utf8").toString("latin1");
    expect((await createContext({ req: request(supplied) })).requestId).toBe(supplied);
    expect((await createContext({ req: request("café-req-1") })).requestId).toBe("café-req-1");
  });

  test("an unbounded id is not an id: the operator log cannot be flooded through the header", async () => {
    const { createContext } = await loadContext();
    const ctx = await createContext({ req: request("x".repeat(100_000)) });

    expect(ctx.requestId).toMatch(UUID);
  });

  test("a control character in the id is refused and a fresh one is minted", async () => {
    const { createContext } = await loadContext();
    // Built by hand: the fetch Request rejects a header value carrying a control character before
    // the seam could ever see it, and the seam must not lean on that for its own soundness.
    const control = `req${String.fromCharCode(7)}bell`;
    const ctx = await createContext({ req: { headers: { get: () => control } } as unknown as Request });

    expect(ctx.requestId).toMatch(UUID);
  });
});

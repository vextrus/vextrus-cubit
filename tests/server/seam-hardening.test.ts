/**
 * Hardening proofs for the fault seam — the cases the criteria imply but no acceptance reaches.
 *
 * Composed through the same shipped machinery the acceptance uses (`probeHandler` mounts the
 * product's `router`/`publicProcedure`/`createContext`/`trpcOnError`), so these observe answers,
 * never internals.
 */
import { TRPCError } from "@trpc/server";
import { describe, expect, test } from "vitest";
import { callWire, errorData, loadContext, loadFaults, probeHandler, withFaultSink, type FaultRecord } from "./support/wire";

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

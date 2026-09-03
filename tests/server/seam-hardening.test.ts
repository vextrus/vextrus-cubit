/**
 * Hardening proofs for the fault seam — the cases the criteria imply but no acceptance reaches.
 *
 * Composed through the same shipped machinery the acceptance uses (`probeHandler` mounts the
 * product's `router`/`publicProcedure`/`createContext`/`trpcOnError`), so these observe answers,
 * never internals.
 */
import { TRPCError } from "@trpc/server";
import { describe, expect, test } from "vitest";
import { join } from "node:path";
import {
  FAULTS_MODULE,
  REPO_ROOT,
  TRPC_MODULE,
  callWire,
  errorData,
  loadContext,
  loadFaults,
  loadTrpc,
  probeHandler,
  withFaultSink,
  type FaultRecord,
  type FaultsModule,
  type TrpcModule,
} from "./support/wire";

/**
 * Load a SECOND instance of a product module. Nothing in the tier may assume it is instantiated
 * once: Next compiles the server into more than one graph, and a module runner can instantiate a
 * file twice when two importers race its first import — which is how a memo keyed in module scope
 * silently becomes two memos.
 */
async function secondInstanceOf<T>(relative: string): Promise<T> {
  return (await import(`${join(REPO_ROOT, relative)}?second-instance`)) as T;
}

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

  test("a failure only ONE reader ever saw cannot suppress the next outage's record (B-21)", async () => {
    const faults = await loadFaults();
    const { answerFor } = await loadTrpc();

    await withFaultSink(faults, async (records) => {
      // The two readers of a failure are `onError` and the error formatter, but nothing guarantees
      // both come: an aborted or streamed-away response is never shaped, and a mount may wire only
      // `onError`. What such a half-read failure leaves behind must not be handed to a LATER one —
      // and the shapes that make that reachable are all repeatable: a module-scope error object, a
      // caller-supplied (therefore repeated) request id, and the same route.
      const half = { error: SHARED, path: "spine.health", ctx: { requestId: "req-repeated", actor: "anonymous" } };
      const seenOnce = answerFor(half);

      // A genuinely later outage: same error object, same supplied id, same route — a new request,
      // so a new context object.
      const later = { error: SHARED, path: "spine.health", ctx: { requestId: "req-repeated", actor: "anonymous" } };
      const first = answerFor(later);
      const second = answerFor(later);

      expect(first.kind).toBe("fault");
      expect(first.faultId, "the later outage was answered with the stale failure's id").not.toBe(seenOnce.faultId);
      expect(second.faultId, "the second reader of the later outage was told a different id").toBe(first.faultId);
      expect(records, "two outages, two records — the half-read one did not swallow the next").toHaveLength(2);
      expect(records.map((record) => (record as FaultRecord).faultId)).toEqual([seenOnce.faultId, first.faultId]);
    });
  });

  test("a large batch's first failure is still one record when the last one is decided (B-21)", async () => {
    const faults = await loadFaults();
    const { answerFor } = await loadTrpc();

    await withFaultSink(faults, async (records) => {
      // @trpc/server 11.18.0 calls `onError` for every call in a batch inside the per-call catch and
      // only then shapes each answer, so every entry a batch makes is unconsumed until the batch
      // settles. Nothing bounds how many calls a batch carries: if the memo forgot the oldest entry
      // to stay under a size, the first call's formatter would decide its failure all over again and
      // file a second FaultRecord — the operator reading one outage as two (B-21).
      const ctx = { requestId: "req-big-batch", actor: "anonymous" };
      const calls = Array.from({ length: 512 }, (_, index) => ({
        error: new Error(`call ${index} failed`),
        path: `probeBatch${index}`,
        ctx,
      }));

      const first = calls.map((call) => answerFor(call));
      const second = calls.map((call) => answerFor(call));

      expect(second.map((answer) => answer.faultId), "a formatter re-decided a failure onError had already recorded").toEqual(
        first.map((answer) => answer.faultId),
      );
      expect(records, "one record per failure, however many failures the batch carried").toHaveLength(calls.length);
      expect(new Set(records.map((record) => (record as FaultRecord).faultId)).size).toBe(calls.length);
    });
  });

  test("a second instance of the transport shares the one memo — one failure, still one record (ARCH-02)", async () => {
    const faults = await loadFaults();
    const first = await loadTrpc();
    const second = await secondInstanceOf<TrpcModule>(TRPC_MODULE);
    expect(second.answerFor, "the duplicate import was deduplicated, so this proves nothing").not.toBe(first.answerFor);

    await withFaultSink(faults, async (records) => {
      // The two readers of one failure (onError and the error formatter) can come from different
      // instances of this file. If each kept its own memo the outage would be recorded twice under
      // two ids — the operator reading double (B-21).
      const call = { error: new Error("the pool is down"), path: "spine.health", ctx: { requestId: "req-two-instances", actor: "anonymous" } };
      const a = first.answerFor(call);
      const b = second.answerFor(call);

      expect(b.faultId, "the second instance decided the same failure all over again").toBe(a.faultId);
      expect(records, "one failure, one record, however many times the module was instantiated").toHaveLength(1);
    });
  });

  test("a second instance of the fault seam shares the one sink — a swapped sink is never half-applied (ARCH-02)", async () => {
    const first = await loadFaults();
    const second = await secondInstanceOf<FaultsModule>(FAULTS_MODULE);
    expect(second.reportFault, "the duplicate import was deduplicated, so this proves nothing").not.toBe(first.reportFault);

    await withFaultSink(first, async (records) => {
      second.reportFault({ requestId: "req-other-instance", actor: "anonymous", route: "spine.health", cause: new Error("the pool is down") });
      expect(records, "the fault went to a sink the host had already swapped out — silence by packaging accident").toHaveLength(1);
      expect((records[0] as FaultRecord).requestId).toBe("req-other-instance");
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

  test("a long id is bounded rather than replaced, so the caller's trace still matches (AC-2)", async () => {
    const { createContext, REQUEST_ID_MAX_LENGTH } = await loadContext();
    // The declared interface bounds the value at `REQUEST_ID_MAX_LENGTH` by TRUNCATION. Minting over
    // a long id would break the caller's trace silently — no fault, no signal — which is the opposite
    // of what B-21 asks a tier to do with something it will not honour; the kept prefix still matches.
    const long = "x".repeat(100_000);
    const bound = REQUEST_ID_MAX_LENGTH as number;
    expect(typeof bound, "the seam states its own bound — REQUEST_ID_MAX_LENGTH").toBe("number");
    expect((await createContext({ req: request(long) })).requestId).toBe(long.slice(0, bound));
  });

  test("a control character in the id neither mints over it nor breaks the sink's framing", async () => {
    const faults = await loadFaults();
    const { createContext } = await loadContext();
    // Built by hand: the fetch Request rejects a header value carrying a control character before
    // the seam could ever see it, and the seam must not lean on that for its own soundness.
    const control = `req${String.fromCharCode(7)}bell`;
    const ctx = await createContext({ req: { headers: { get: () => control } } as unknown as Request });

    expect(ctx.requestId, "the caller's trace was silently replaced").toBe(control);

    // The framing the old rejection existed to protect: a record is JSON, so the control character
    // is escaped and the record is still exactly one line.
    await withFaultSink(faults, async (records) => {
      faults.reportFault({ requestId: ctx.requestId, actor: ctx.actor, route: "spine.health", cause: new Error("the pool is down") });
      const line = JSON.stringify(records[0]);
      expect(line.includes("\n"), "the record would have spanned two lines").toBe(false);
    });
  });
});

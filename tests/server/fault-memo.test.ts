/**
 * AC-1 and AC-5(a) — one failure, one record, and never no record at all (B-21, ARCH-03).
 *
 * The memo is observed the two ways it is reached: through probes composed with the product's own
 * `router`/`publicProcedure` and mounted behind its `createContext`/`trpcOnError` (`probeHandler`),
 * and through the exported `answerFor` called directly. The sink is swapped for each case, so every
 * record is counted where it was made.
 */
import { describe, expect, test } from "vitest";
import { TRPC_MODULE, callBatch, docComments, errorDataOf, loadFaults, loadTrpc, probeHandler, productSource, stripComments, withFaultSink } from "./support/wire";

/** A primitive failure — the value a pool wrapper re-throws, identical on every call it makes. */
const POOL_IS_DOWN = "the pool is down";

/** The memo's declared bound, read from its one home and checked against the law's floor. */
async function memoCap(): Promise<number> {
  const { ANSWER_MEMO_CAP } = await loadTrpc();
  expect(typeof ANSWER_MEMO_CAP, `${TRPC_MODULE} must export ANSWER_MEMO_CAP — the most unconsumed answers one request's memo holds`).toBe("number");
  const cap = ANSWER_MEMO_CAP as number;
  expect(cap, "ANSWER_MEMO_CAP is the law's floor of 512 or more").toBeGreaterThanOrEqual(512);
  return cap;
}

/** One failure, as `answerFor` is asked about it: a distinct thrown object on a distinct route. */
function failures(count: number): { error: unknown; path: string }[] {
  return Array.from({ length: count }, (_unused, at) => ({ error: new Error(`the ledger pool failed (${at})`), path: `spine.probe${at}` }));
}

describe("AC-1: the per-request answer memo", () => {
  test("AC-1: two failures on one route in one batch each leave a record", async () => {
    const faults = await loadFaults();
    const handler = await probeHandler({
      downstream: () => {
        throw POOL_IS_DOWN;
      },
    });

    await withFaultSink(faults, async (records) => {
      const batch = await callBatch(handler, ["downstream", "downstream"], { requestId: "req-one-batch" });
      const answered = batch.elements.map((element, at) => {
        const data = errorDataOf(element, `element ${at}`);
        expect(data.kind, `element ${at} of the batch is not answered as a fault`).toBe("fault");
        return data.faultId;
      });

      expect(records.length, "two failures in one batch are two failures, and each leaves its own record (B-21)").toBe(2);
      expect(
        records.map((record) => record.route),
        "both records name the route that failed",
      ).toEqual(["downstream", "downstream"]);
      const recorded = new Set(records.map((record) => record.faultId));
      for (const [at, faultId] of answered.entries()) {
        expect(recorded.has(String(faultId)), `element ${at} quotes a fault id (${String(faultId)}) that is on no record — the operator cannot find it`).toBe(true);
      }
    });
  });

  test("AC-1: the memo keys on a primitive's own value, so `1` and \"1\" are two failures", async () => {
    const faults = await loadFaults();
    const { answerFor } = await loadTrpc();

    await withFaultSink(faults, async (records) => {
      const ctx = { requestId: "req-two-primitives", actor: "an-account" };
      const first = answerFor({ error: 1, path: "spine.health", ctx });
      const second = answerFor({ error: "1", path: "spine.health", ctx });
      expect(records.length, "a number and the string of that number are two different failures").toBe(2);
      expect(new Set([first.faultId, second.faultId]).size, "each failure carries its own fault id").toBe(2);
    });

    await withFaultSink(faults, async (records) => {
      const ctx = { requestId: "req-one-primitive", actor: "an-account" };
      const first = answerFor({ error: 1, path: "spine.health", ctx });
      const second = answerFor({ error: 1, path: "spine.health", ctx });
      expect(records.length, "one failure shown to both readers is still one failure (B-21)").toBe(1);
      expect(second.faultId, "the second reader is handed the first reader's answer").toBe(first.faultId);
    });
  });

  test("AC-1: a memo full to ANSWER_MEMO_CAP hands every second reader the first reader's id", async () => {
    const faults = await loadFaults();
    const { answerFor } = await loadTrpc();
    const cap = await memoCap();
    const batch = failures(cap);

    await withFaultSink(faults, async (records) => {
      const ctx = { requestId: "req-to-the-cap", actor: "an-account" };
      // Every first reader arrives before any second one — the shape a batch of `cap` failing calls
      // makes, since @trpc/server shapes the answers only after the calls settle.
      const first = batch.map((failure) => answerFor({ ...failure, ctx }));
      expect(records.length, "each of the failures is recorded exactly once").toBe(cap);

      for (const [at, failure] of batch.entries()) {
        const second = answerFor({ ...failure, ctx });
        expect(second.faultId, `the second reader of ${failure.path} decided afresh instead of reading the memo`).toBe(first[at]?.faultId);
      }
      expect(records.length, "the second readers add no records: one failure, one record").toBe(cap);
    });
  });

  test("AC-1: a failure with no context is answered and recorded as unattributed", async () => {
    const faults = await loadFaults();
    const { answerFor } = await loadTrpc();

    await withFaultSink(faults, async (records) => {
      const answer = answerFor({ error: new Error("x"), path: "spine.health" });
      expect(answer.kind, "a failure the transport could not attribute is still a fault").toBe("fault");
      expect(answer.requestId, "the answer says what it knows: nothing, and says so by name").toBe("unattributed");
      expect(records.length, "an unattributed failure is recorded rather than silenced (B-21)").toBe(1);
      expect(records[0]?.requestId).toBe("unattributed");
      expect(records[0]?.actor).toBe("unattributed");
    });
  });

  test("AC-1: the memo is a keyed lookup, and its comment cites the law it serves", () => {
    const source = productSource(TRPC_MODULE);
    const code = stripComments(source);

    expect(code.includes(".find("), `${TRPC_MODULE} scans a list for the remembered answer — the memo is looked up by key`).toBe(false);
    expect(code.includes(".indexOf("), `${TRPC_MODULE} scans a list for the remembered answer — the memo is looked up by key`).toBe(false);

    const aboutTheMemo = docComments(source).filter((comment) => /\bmemo\b/i.test(comment));
    expect(aboutTheMemo.length, `${TRPC_MODULE} documents no memo`).toBeGreaterThan(0);
    const citing = aboutTheMemo.filter(
      (comment) => comment.includes("B-21") && comment.includes("ARCH-03") && /\bcontext\b/i.test(comment) && /\broute\b/i.test(comment) && /\bidentity\b/i.test(comment),
    );
    expect(citing.length, "the memo's doc comment must cite B-21 and ARCH-03 and state its key as (context, route, identity)").toBeGreaterThan(0);
  });
});

describe("AC-5: the memo past its bound", () => {
  test("AC-5: past ANSWER_MEMO_CAP the memo decides again rather than silencing", async () => {
    const faults = await loadFaults();
    const { answerFor } = await loadTrpc();
    const cap = await memoCap();
    const batch = failures(cap + 1);

    await withFaultSink(faults, async (records) => {
      const ctx = { requestId: "req-past-the-cap", actor: "an-account" };
      const first = batch.map((failure) => answerFor({ ...failure, ctx }));
      const second = batch.map((failure) => answerFor({ ...failure, ctx }));

      const recorded = new Set(records.map((record) => record.faultId));
      for (const answer of [...first, ...second]) {
        expect(recorded.has(String(answer.faultId)), `a reader was handed the fault id ${String(answer.faultId)}, which is on no record — an evicted answer must be decided again, never dropped`).toBe(
          true,
        );
      }
      expect(records.length, "every failure is recorded at least once; an eviction records twice at worst").toBeGreaterThanOrEqual(batch.length);

      for (let at = batch.length - cap; at < batch.length; at += 1) {
        expect(second[at]?.faultId, `the second reader of ${batch[at]?.path ?? "?"} — one of the last ANSWER_MEMO_CAP failures — did not read the memo`).toBe(first[at]?.faultId);
      }
    });
  });
});

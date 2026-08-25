/**
 * AC-1 — the fault seam has one home (ARCH-02, ARCH-03, B-21): `reportFault` in
 * src/core/faults/report.ts. Every assertion here goes through the declared names only.
 *
 * Staging is lazy and memoised on purpose: a `beforeAll` that throws leaves every test *skipped*,
 * and a skipped test proves nothing and reports no criterion id.
 */
import { describe, expect, test } from "vitest";
import { UUID_PATTERN, loadFaults, withFaultSink, type FaultRecord, type FaultsModule } from "./support/wire";

let pending: Promise<FaultsModule> | undefined;
const faults = (): Promise<FaultsModule> => (pending ??= loadFaults());

const input = (over: Partial<{ requestId: string; actor: string; route: string; cause: unknown }> = {}) => ({
  requestId: "req-ac1",
  actor: "anonymous",
  route: "spine.health",
  cause: new Error("internal detail"),
  ...over,
});

describe("AC-1: the fault seam", () => {
  test("AC-1: reportFault emits exactly one FaultRecord through the current sink and returns { faultId, requestId }", async () => {
    const seam = await faults();
    await withFaultSink(seam, async (records) => {
      const report = seam.reportFault(input({ requestId: "req-one", actor: "operator@cubit", route: "bid.publish" }));

      expect(records).toHaveLength(1);
      const record = records[0] as FaultRecord;
      expect(record.requestId).toBe("req-one");
      expect(record.actor).toBe("operator@cubit");
      expect(record.route).toBe("bid.publish");
      expect(record.faultId).toBe(report.faultId);
      expect(report.requestId).toBe("req-one");
      // The record carries the whole declared shape — the operator reads it, not the caller.
      expect(typeof record.cause).toBe("string");
      expect(typeof record.at).toBe("string");
    });
  });

  test("AC-1: faultId is a freshly generated UUID — a new one for every report", async () => {
    const seam = await faults();
    await withFaultSink(seam, async (records) => {
      const first = seam.reportFault(input());
      const second = seam.reportFault(input());

      expect(first.faultId).toMatch(UUID_PATTERN);
      expect(second.faultId).toMatch(UUID_PATTERN);
      expect(second.faultId).not.toBe(first.faultId);
      expect(records.map((r) => r.faultId)).toEqual([first.faultId, second.faultId]);
    });
  });

  test("AC-1: the cause is string-serialised — an Error by name and message, anything else by String(x)", async () => {
    const seam = await faults();
    await withFaultSink(seam, async (records) => {
      const thrown = new TypeError("kaboom: connection to the ledger died");
      seam.reportFault(input({ cause: thrown }));
      const serialisedError = (records[0] as FaultRecord).cause;
      expect(serialisedError).toContain("TypeError");
      expect(serialisedError).toContain("kaboom: connection to the ledger died");

      // `String(x)` is the declared fallback, so the expectation is computed, never transcribed.
      const others: unknown[] = ["a bare string", 42, null, undefined, { detail: "an object nobody typed" }];
      for (const cause of others) {
        records.length = 0;
        seam.reportFault(input({ cause }));
        expect(records, `reportFault dropped the record for cause ${String(cause)}`).toHaveLength(1);
        expect((records[0] as FaultRecord).cause).toBe(String(cause));
      }
    });
  });

  test("AC-1: reportFault never throws — not even when the installed sink throws", async () => {
    const seam = await faults();
    const previous = seam.setFaultSink(() => {
      throw new Error("the sink itself is down");
    });
    try {
      const report = seam.reportFault(input({ requestId: "req-sink-down" }));
      expect(report.requestId).toBe("req-sink-down");
      expect(report.faultId).toMatch(UUID_PATTERN);
    } finally {
      seam.setFaultSink(previous);
    }
  });

  test("AC-1: setFaultSink swaps the sink and returns the previous one", async () => {
    const seam = await faults();
    const toA: FaultRecord[] = [];
    const toB: FaultRecord[] = [];

    const beforeA = seam.setFaultSink((record) => void toA.push(record));
    expect(typeof beforeA, "setFaultSink must answer with the sink it replaced").toBe("function");

    const returnedA = seam.setFaultSink((record) => void toB.push(record));
    seam.reportFault(input({ requestId: "req-to-b" }));

    // The returned sink is the previous one itself: putting it back sends records to A again.
    seam.setFaultSink(returnedA);
    seam.reportFault(input({ requestId: "req-to-a" }));
    seam.setFaultSink(beforeA);

    expect(toB.map((r) => r.requestId)).toEqual(["req-to-b"]);
    expect(toA.map((r) => r.requestId)).toEqual(["req-to-a"]);
  });

  test("AC-1: the default sink writes the record as one JSON line to stderr", async () => {
    const seam = await faults();
    // Take the default sink out and put it straight back, so what follows runs on the shipped one.
    seam.setFaultSink(seam.setFaultSink(() => {}));

    const emitted: string[] = [];
    const realWrite = process.stderr.write;
    const realConsoleError = console.error;
    process.stderr.write = ((chunk: unknown) => {
      emitted.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    console.error = (...args: unknown[]) => void emitted.push(args.map((a) => String(a)).join(" "));

    let report: { faultId: string; requestId: string };
    try {
      report = seam.reportFault(input({ requestId: "req-default-sink", actor: "anonymous", route: "assure.review", cause: new Error("stderr me") }));
    } finally {
      process.stderr.write = realWrite;
      console.error = realConsoleError;
    }

    const lines = emitted.join("").split("\n").filter((line) => line.trim() !== "");
    expect(lines, `the default sink wrote ${lines.length} lines to stderr, not one: ${lines.join(" | ").slice(0, 400)}`).toHaveLength(1);

    const parsed = JSON.parse(lines[0] as string) as Record<string, unknown>;
    expect(parsed.faultId).toBe(report.faultId);
    expect(parsed.requestId).toBe("req-default-sink");
    expect(parsed.actor).toBe("anonymous");
    expect(parsed.route).toBe("assure.review");
    expect(String(parsed.cause)).toContain("stderr me");
    expect(typeof parsed.at).toBe("string");
  });
});

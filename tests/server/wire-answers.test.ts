/**
 * AC-3 — a server fault and a refusal are mechanically distinguishable answers (ARCH-03, B-21).
 *
 * The probes are composed from the SHIPPED `router`/`publicProcedure` and mounted behind the
 * SHIPPED `trpcOnError`/`createContext`, exactly as the criterion prescribes, so the error
 * formatter under test is the product's own. The unknown-procedure case goes through the shipped
 * route handler itself.
 */
import { describe, expect, test } from "vitest";
import {
  UUID_PATTERN,
  callWire,
  causeMarkedError,
  errorData,
  loadContext,
  loadFaults,
  loadRefusalMarker,
  markedError,
  probeHandler,
  shippedHandler,
  withFaultSink,
  type FaultRecord,
} from "./support/wire";

/** A message no honest fault answer may contain: it is the internal cause and nothing else. */
const INTERNAL = "ledger-pool-exhausted-42";

describe("AC-3: fault and refusal over the wire", () => {
  test("AC-3: a non-refusal failure answers kind 'fault' with a faultId, and records exactly that fault", async () => {
    const faults = await loadFaults();
    const { createContext } = await loadContext();
    const handler = await probeHandler({
      probeFault: () => {
        throw new Error(INTERNAL);
      },
    });
    const expectedActor = (await createContext({ req: new Request("http://cubit.test/api/trpc/probeFault") })).actor;

    await withFaultSink(faults, async (records) => {
      const answer = await callWire(handler, "probeFault", { requestId: "req-fault" });
      const data = errorData(answer);

      expect(data.kind).toBe("fault");
      expect(data.requestId).toBe("req-fault");
      expect(String(data.faultId)).toMatch(UUID_PATTERN);
      expect(data.refusalCode, "a fault answer carries no refusal code").toBeUndefined();

      expect(records, "one failing request, one fault record").toHaveLength(1);
      const record = records[0] as FaultRecord;
      expect(record.faultId).toBe(data.faultId);
      expect(record.requestId).toBe("req-fault");
      expect(record.route, "the fault is attributed to the procedure path").toBe("probeFault");
      expect(record.actor).toBe(expectedActor);
      expect(record.cause).toContain(INTERNAL);

      expect(answer.raw, `the internal message leaked into the answer: ${answer.raw.slice(0, 600)}`).not.toContain(INTERNAL);
    });
  });

  test("AC-3: a refusal-marked failure answers kind 'refusal' with its code and reaches no fault sink", async () => {
    const faults = await loadFaults();
    const handler = await probeHandler({
      probeRefusalOnError: () => {
        throw markedError(INTERNAL, "SIGNED_OUT");
      },
      probeRefusalOnCause: () => {
        throw causeMarkedError(INTERNAL, "OVER_PLAN_LIMIT");
      },
    });

    await withFaultSink(faults, async (records) => {
      for (const [path, code] of [
        ["probeRefusalOnError", "SIGNED_OUT"],
        ["probeRefusalOnCause", "OVER_PLAN_LIMIT"],
      ] as const) {
        const answer = await callWire(handler, path, { requestId: `req-${code}` });
        const data = errorData(answer);

        expect(data.kind, `${path} was not answered as a refusal`).toBe("refusal");
        expect(data.refusalCode).toBe(code);
        expect(data.faultId, "a refusal answer carries no fault id").toBeUndefined();
      }

      expect(records, `a refusal is an answer, not a fault — nothing may reach the sink, got ${records.length}`).toHaveLength(0);
    });
  });

  test("AC-3: an unknown procedure on the shipped route also answers kind 'fault' and records a fault", async () => {
    const faults = await loadFaults();
    const handler = await shippedHandler();

    await withFaultSink(faults, async (records) => {
      const answer = await callWire(handler, "spine.thisProcedureDoesNotExist", { requestId: "req-unknown" });
      const data = errorData(answer);

      expect(data.kind).toBe("fault");
      expect(data.requestId).toBe("req-unknown");
      expect(String(data.faultId)).toMatch(UUID_PATTERN);

      expect(records, "an unknown procedure is a failure the operator must see").toHaveLength(1);
      const record = records[0] as FaultRecord;
      expect(record.faultId).toBe(data.faultId);
      expect(record.requestId).toBe("req-unknown");
      expect(typeof record.route, "the record names the route that failed").toBe("string");
      expect(record.route.length).toBeGreaterThan(0);
    });
  });

  test("AC-3: isRefusalMarked recognises a string refusalCode on the value or on its cause, and nothing else", async () => {
    const { isRefusalMarked } = await loadRefusalMarker();

    expect(isRefusalMarked(markedError("x", "SIGNED_OUT"))).toBe(true);
    expect(isRefusalMarked(causeMarkedError("x", "SIGNED_OUT"))).toBe(true);
    expect(isRefusalMarked({ refusalCode: "SIGNED_OUT" })).toBe(true);

    expect(isRefusalMarked(new Error("a plain fault"))).toBe(false);
    expect(isRefusalMarked(undefined)).toBe(false);
    expect(isRefusalMarked(null)).toBe(false);
    expect(isRefusalMarked("SIGNED_OUT")).toBe(false);
    // The marker is a string code, not any truthy value.
    expect(isRefusalMarked({ refusalCode: 7 })).toBe(false);
    expect(isRefusalMarked(new Error("x", { cause: { refusalCode: 7 } }))).toBe(false);
  });
});

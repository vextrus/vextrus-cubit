/**
 * AC-2, AC-5(b) and AC-5(c) — what a failure looks like on the wire: tRPC's own `code` and `path`
 * kept, its stack dropped, and a status that says which of ARCH-03's three answers this is.
 *
 * A fault travels with tRPC's own status for the error it handed over; a refusal travels with the
 * register's, whatever TRPCError code carried it. Both are observed through the shipped formatter —
 * probes composed with the product's `router`/`publicProcedure`, and the shipped route handler.
 */
import { TRPCError } from "@trpc/server";
import { describe, expect, test } from "vitest";
import { UUID_PATTERN, callBatch, callWire, errorData, errorDataOf, loadErrors, loadFaults, markedError, probeHandler, shippedHandler, withFaultSink, type WireEnvelope } from "./support/wire";

/** What the operator must read on the sink and the client must never read on the wire. */
const INTERNAL_MESSAGE = "ledger-pool-exhausted-42";

/**
 * The refusal codes HTTP has a name for, as the increment's own status table states them. Every
 * other registered code keeps the 400 floor, so the floor's proof takes its code from the register
 * rather than spelling one: a code renamed or retired there cannot leave this test asserting a
 * phantom (ARCH-02, Q-07).
 */
const HTTP_NAMED: Readonly<Record<string, number>> = { SIGNED_OUT: 401, PERMISSION_NOT_HELD: 403, ACCOUNT_ALREADY_EXISTS: 409, RATE_LIMITED: 429 };
const REFUSAL_STATUS_FLOOR = 400;

/** A registered refusal code the status table gives no HTTP name — the floor's own case. */
async function flooredRefusalCode(): Promise<string> {
  const { REFUSALS } = await loadErrors();
  const codes = Object.keys(REFUSALS).filter((code) => !Object.hasOwn(HTTP_NAMED, code));
  expect(codes.length, "the register holds no code outside the status table — the floor has no case to prove").toBeGreaterThan(0);
  return codes[0] as string;
}

describe("AC-2: the error formatter and the status table", () => {
  test("AC-2: a fault answers tRPC's code and path, an id to quote, and nothing the tier knows internally", async () => {
    const faults = await loadFaults();
    const handler = await probeHandler({
      ledger: () => {
        throw new Error(INTERNAL_MESSAGE);
      },
    });

    await withFaultSink(faults, async (records) => {
      const answer = await callWire(handler, "ledger", { requestId: "req-ledger" });
      const data = errorData(answer);

      expect(data.code, "tRPC's own code for the failure it handed over stays on `error.data`").toBe("INTERNAL_SERVER_ERROR");
      expect(data.path, "the failing route stays on `error.data`").toBe("ledger");
      expect(data.kind).toBe("fault");
      expect(String(data.faultId), "the fault id is the one the sink minted").toMatch(UUID_PATTERN);
      expect(data.requestId).toBe("req-ledger");
      expect(data.httpStatus, "a wrapped plain failure is tRPC's own 500").toBe(500);
      expect(Object.hasOwn(data, "stack"), "`stack` carries the internal message the wire may not (ARCH-03)").toBe(false);
      expect(answer.raw).not.toContain(INTERNAL_MESSAGE);
      expect(answer.status).toBe(500);
      expect(records.length, "the operator gets exactly one record for the one failure").toBe(1);
      expect(records[0]?.faultId).toBe(data.faultId);
    });
  });

  test("AC-2: a fault travels with tRPC's own status — 404 for an unknown procedure, 400 for a BAD_REQUEST", async () => {
    const faults = await loadFaults();

    await withFaultSink(faults, async (records) => {
      const answer = await callWire(await shippedHandler(), "spine.thisProcedureDoesNotExist", { requestId: "req-unknown-procedure" });
      const data = errorData(answer);
      expect(data.kind, "a procedure nobody wrote is the tier's own failure, not an answer somebody earned").toBe("fault");
      expect(records.length, "the failure is recorded once (B-21)").toBe(1);
      expect(data.httpStatus, "tRPC answered NOT_FOUND, so the wire says 404").toBe(404);
      expect(answer.status).toBe(404);
    });

    const handler = await probeHandler({
      malformed: () => {
        throw new TRPCError({ code: "BAD_REQUEST" });
      },
    });
    await withFaultSink(faults, async () => {
      const answer = await callWire(handler, "malformed", { requestId: "req-bad-request" });
      const data = errorData(answer);
      expect(data.kind).toBe("fault");
      expect(data.httpStatus, "tRPC answered BAD_REQUEST, so the wire says 400 rather than an outage").toBe(400);
    });
  });

  test("AC-2: a refusal travels with the register's status, whatever TRPCError code carried it", async () => {
    const faults = await loadFaults();
    const floored = await flooredRefusalCode();
    const handler = await probeHandler({
      signedOut: () => {
        throw Object.assign(new TRPCError({ code: "FORBIDDEN" }), { refusalCode: "SIGNED_OUT" });
      },
      floored: () => {
        throw markedError("a registered refusal HTTP has no name for", floored);
      },
    });

    await withFaultSink(faults, async (records) => {
      const answer = await callWire(handler, "signedOut", { requestId: "req-signed-out" });
      const data = errorData(answer);
      expect(data.kind, "a registered refusal is an answer, never an outage (ARCH-03)").toBe("refusal");
      expect(data.refusalCode).toBe("SIGNED_OUT");
      expect(data.httpStatus, "the register's own status answers, not the FORBIDDEN it was thrown under").toBe(HTTP_NAMED.SIGNED_OUT);
      expect(answer.status).toBe(HTTP_NAMED.SIGNED_OUT);
      expect(Object.hasOwn(data, "faultId"), "a refusal has no fault id: nothing broke").toBe(false);
      expect(records, "a refusal is not recorded on the fault seam").toEqual([]);
    });

    await withFaultSink(faults, async () => {
      const answer = await callWire(handler, "floored", { requestId: "req-floored" });
      const data = errorData(answer);
      expect(data.kind).toBe("refusal");
      expect(data.refusalCode).toBe(floored);
      expect(data.httpStatus, `${floored} has no HTTP name, so it keeps the floor`).toBe(REFUSAL_STATUS_FLOOR);
      expect(data.code, "a refusal keeps tRPC's code on `error.data` too").toBeTypeOf("string");
      expect(data.path).toBe("floored");
    });
  });
});

describe("AC-5: the transport's edges", () => {
  test("AC-5: one batch carrying a fault and a refusal answers each with its own status", async () => {
    const faults = await loadFaults();
    const handler = await probeHandler({
      broke: () => {
        throw new Error(INTERNAL_MESSAGE);
      },
      refused: () => {
        throw markedError("the session presented is not live", "SIGNED_OUT");
      },
    });

    await withFaultSink(faults, async (records) => {
      const batch = await callBatch(handler, ["broke", "refused"], { requestId: "req-mixed-batch" });
      const fault = errorDataOf(batch.elements[0] as WireEnvelope, "the failing element");
      const refusal = errorDataOf(batch.elements[1] as WireEnvelope, "the refused element");

      expect(fault.kind).toBe("fault");
      expect(fault.httpStatus).toBe(500);
      expect(refusal.kind).toBe("refusal");
      expect(refusal.httpStatus).toBe(HTTP_NAMED.SIGNED_OUT);
      expect(records.length, "the refusal leaves no record and the fault leaves exactly one").toBe(1);
      expect(Object.hasOwn(fault, "stack")).toBe(false);
      expect(Object.hasOwn(refusal, "stack")).toBe(false);
    });
  });

  test("AC-5: a refusal thrown under NOT_FOUND still answers the register's floor, not tRPC's 404", async () => {
    const faults = await loadFaults();
    const floored = await flooredRefusalCode();
    const handler = await probeHandler({
      misfiled: () => {
        throw Object.assign(new TRPCError({ code: "NOT_FOUND" }), { refusalCode: floored });
      },
    });

    await withFaultSink(faults, async (records) => {
      const answer = await callWire(handler, "misfiled", { requestId: "req-misfiled" });
      const data = errorData(answer);
      expect(data.kind).toBe("refusal");
      expect(data.refusalCode).toBe(floored);
      expect(data.httpStatus).toBe(REFUSAL_STATUS_FLOOR);
      expect(answer.status).toBe(REFUSAL_STATUS_FLOOR);
      expect(records).toEqual([]);
    });
  });
});

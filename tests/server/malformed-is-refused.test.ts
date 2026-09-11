/**
 * The one server-call seam's promise, graded at both transports (ARCH-03, B-21).
 *
 * A statement this tier cannot read is the caller's mistake and not an outage of ours, so it is
 * answered with a REGISTERED refusal — the closed taxonomy's REQUEST_MALFORMED, as `src/core/errors` holds
 * it — and never as a thrown Error, a 500, or a fault record. The two claims are graded together
 * here because they are one claim: the fault sink is watched across the whole file, and a door that
 * writes a record for a caller error fails this suite even when its status looks right.
 *
 * Nothing is staged and no session is mounted. Every case below is refused before the door it was
 * sent to asks anybody who is calling, which is precisely why it can be graded with no database
 * behind it: the reading happens first, and a statement that fails it goes no further.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { reportFault, setFaultSink, type FaultRecord } from "@/core/faults/report";

/** Every fault reported while this file runs — a refusal that reports one is a defect (ARCH-03). */
const faults: FaultRecord[] = [];
let previousSink: ((record: FaultRecord) => void) | null = null;

beforeAll(() => {
  previousSink = setFaultSink((record) => void faults.push(record));
});

afterAll(() => {
  if (previousSink !== null) setFaultSink(previousSink);
});

/** An address the doors below need not find anything at: what is graded is the reading, not the row. */
const UPLOAD = "0f9b1b7c-2f3a-4c2e-9d1a-2b3c4d5e6f70";
const DRAWING = "3a2b1c0d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const LAYOUT = "Sheet 1";

/** The answer a door gave, read as a JSON body beside its status. */
async function answered(response: Response): Promise<{ status: number; body: Record<string, unknown> }> {
  const text = await response.text();
  const body = text === "" ? {} : (JSON.parse(text) as Record<string, unknown>);
  return { status: response.status, body };
}

/**
 * The claim itself, made once and spent on every door: understood and not carried out (400), the
 * registered code by name, and nothing written down as a failure of ours.
 */
async function expectRefusedAsMalformed(response: Response, where: string): Promise<void> {
  const { status, body } = await answered(response);
  expect(status, `${where}: a statement this door cannot read is the caller's mistake, answered at 400 — never as an outage of ours`).toBe(400);
  const refusal = body["refusal"] as { code?: unknown; message?: unknown; remedy?: unknown } | undefined;
  expect(refusal?.code, `${where}: the answer names the registered refusal, so a client renders the register's own copy (R-SPINE-062)`).toBe(
    REFUSALS.REQUEST_MALFORMED.code,
  );
  expect(refusal?.message, `${where}: the registered message travels with the code, whole`).toBe(REFUSALS.REQUEST_MALFORMED.message);
  expect(refusal?.remedy, `${where}: and so does its remedy`).toBe(REFUSALS.REQUEST_MALFORMED.remedy);
  expect(body["faultId"], `${where}: a caller error is not a fault, so no record's id is handed back`).toBeUndefined();
}

describe("a route handler answers an unreadable statement with the registered refusal", () => {
  test("POST /api/upload — a body that is not the shape an upload is opened with", async () => {
    const { POST } = await import("@/app/api/upload/route");
    for (const [why, body] of [
      ["no fields at all", "{}"],
      ["a size that is not a number", JSON.stringify({ projectId: UPLOAD, name: "a.dxf", size: "500", sha256: "a".repeat(64) })],
      ["a content address that is not one", JSON.stringify({ projectId: UPLOAD, name: "a.dxf", size: 1, sha256: "not-a-digest" })],
      ["a name with nothing visible in it", JSON.stringify({ projectId: UPLOAD, name: "   ", size: 1, sha256: "a".repeat(64) })],
      ["bytes that are not JSON at all", "{ this is not json"],
    ] as const) {
      const response = await POST(new Request("http://127.0.0.1/api/upload", { method: "POST", body }));
      await expectRefusedAsMalformed(response, `POST /api/upload with ${why}`);
    }
  });

  test("PATCH /api/upload/{uploadId} — a chunk stating no offset this door can read", async () => {
    const { PATCH } = await import("@/app/api/upload/[uploadId]/route");
    for (const [why, headers] of [
      ["no Upload-Offset at all", {}],
      ["an offset that is not a whole number", { "upload-offset": "1.5" }],
      ["an offset below zero", { "upload-offset": "-1" }],
      ["an offset past the last place a transfer can stand", { "upload-offset": "9".repeat(30) }],
    ] as const) {
      const response = await PATCH(new Request(`http://127.0.0.1/api/upload/${UPLOAD}`, { method: "PATCH", headers, body: new Uint8Array([1, 2, 3]) }), {
        params: Promise.resolve({ uploadId: UPLOAD }),
      });
      await expectRefusedAsMalformed(response, `PATCH /api/upload/{uploadId} with ${why}`);
    }
  });

  test("GET /api/viewer/{drawing}/{layout} — an address asking for a part of a sheet that is not one", async () => {
    const { GET } = await import("@/app/api/viewer/[drawing]/[layout]/route");
    for (const [why, query] of [
      ["a part this feed does not serve", "part=elevation"],
      ["a layer index that is not a place in a roster", "part=layer&index=abc"],
      ["a layer asked for with no index at all", "part=layer"],
    ] as const) {
      const response = await GET(new Request(`http://127.0.0.1/api/viewer/${DRAWING}/${encodeURIComponent(LAYOUT)}?${query}`), {
        params: Promise.resolve({ drawing: DRAWING, layout: LAYOUT }),
      });
      await expectRefusedAsMalformed(response, `GET /api/viewer with ${why}`);
    }
  });

  test("the sentence beside the refusal still says WHICH half of the address was unreadable", async () => {
    const { GET } = await import("@/app/api/viewer/[drawing]/[layout]/route");
    const ask = async (query: string): Promise<string> => {
      const { body } = await answered(
        await GET(new Request(`http://127.0.0.1/api/viewer/${DRAWING}/${encodeURIComponent(LAYOUT)}?${query}`), {
          params: Promise.resolve({ drawing: DRAWING, layout: LAYOUT }),
        }),
      );
      return String(body["error"] ?? "");
    };
    const part = await ask("part=elevation");
    const index = await ask("part=layer&index=abc");
    expect(index.toLowerCase(), "the index answer names the query it is about, so a client knows which of the two it got wrong").toContain("index");
    expect(index, "and it is not the sentence written for an unknown part").not.toBe(part);
  });
});

describe('a "use server" action answers an unreadable input with its own typed refusal', () => {
  test("the viewer's act doors answer the shape their screen reads, carrying the registered code", async () => {
    const { previewConfirmViewType, commitConfirmViewType } = await import("@/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/partition-actions");
    // Nothing here is the shape the door takes: no project, and a group key over no closed enum.
    const previewed = await previewConfirmViewType({ projectId: 7, group: { kind: "SHEET" } } as never);
    expect(previewed, "a preview answers its screen's own shape, refusal included — it never throws across the boundary").toEqual({
      previewed: false,
      refusal: REFUSALS.REQUEST_MALFORMED.code,
    });

    const committed = await commitConfirmViewType({} as never);
    expect(committed, "and so does its commit").toEqual({ committed: false, refusal: REFUSALS.REQUEST_MALFORMED.code });
  });

  test("the Trace's reads answer the same way, in the shape their own screen reads", async () => {
    const { readLineEvidence, readLinesCiting } = await import("@/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/trace-actions");
    expect(await readLineEvidence({ projectId: "a" } as never), "a read with no line named is not a read this door can make").toEqual({
      read: false,
      refusal: REFUSALS.REQUEST_MALFORMED.code,
    });
    expect(await readLinesCiting({ projectId: "a", drawingId: "b", sourceKeys: "all of them" } as never), "nor is one whose keys are not keys").toEqual({
      read: false,
      refusal: REFUSALS.REQUEST_MALFORMED.code,
    });
  });

  test("the participants door refuses a role the closed enum does not hold, as a refusal and not a throw", async () => {
    const { previewAssignRole } = await import("@/app/(app)/t/[tenant]/p/[project]/settings/participants/actions");
    const answer = await previewAssignRole({ projectId: "a", subjectUserId: "b", role: "EMPEROR", direction: "GRANT" } as never);
    expect(answer, "a role nobody registered bundles nothing, so the door never carries it to the seam").toEqual({
      previewed: false,
      refusal: REFUSALS.REQUEST_MALFORMED.code,
    });
  });

  test("not one of those refusals was a fault (ARCH-03)", () => {
    // The seam is exercised once here so a suite that recorded nothing because nothing ran at all
    // cannot pass: the sink is live, and it hears this one.
    const { faultId } = reportFault({ requestId: "proof", actor: "proof", route: "proof", cause: new Error("the sink is live") });
    expect(faults.map((record) => record.faultId), "the watched sink is the one the tier reports through").toEqual([faultId]);
  });
});

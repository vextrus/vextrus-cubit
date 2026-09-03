/**
 * AC-1 — the resumable protocol, client and server agreeing (R-SPINE-020, Q-12).
 *
 * The client under test is the shipped `uploadFiles` from the dropzone barrel; the server under
 * test is the two shipped route handlers, called in process with a `fetch` bound to them. Between
 * them sits nothing this file invented: the chunking, the retry and the resumption are the
 * product's, and the only thing the harness does is interrupt one PATCH and read the answers.
 *
 * Nothing here freezes a shape the spec does not fix. The chunk count is derived from the size the
 * server announces (`chunkBytes`), not from a number written down: the file is sent in as many
 * chunks as that announcement implies, which is the rule the protocol states.
 *
 * The journey half of AC-1 — the same protocol walked through a browser session against the served
 * product — is `tests/e2e/journeys/j-010-upload-seam.spec.ts`, tagged J-010.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  boundFetch,
  closeStage,
  DROPZONE_BARREL,
  enrol,
  expectRegistered,
  fixture,
  openStage,
  patchChunk,
  productModule,
  readAnswer,
  sha256Of,
  stageProject,
  stored,
  uploadStatus,
  UPLOADS_MODULE,
  UPLOAD_ID_ROUTE,
  UPLOAD_ROUTE,
  type Answered,
  type Person,
  type UploadFiles,
} from "./support/upload-stage";

/** Everything AC-1 names as shipped code; asserted before a database is provisioned for it. */
const DECLARED = [UPLOADS_MODULE, UPLOAD_ROUTE, UPLOAD_ID_ROUTE, DROPZONE_BARREL] as const;

interface Staged {
  person: Person;
  projectId: string;
  bytes: Uint8Array;
  digest: string;
}

let pending: Promise<Staged> | undefined;

/** Staged lazily and memoised, so a staging failure is a failed test rather than a skipped file. */
function staged(): Promise<Staged> {
  pending ??= (async () => {
    for (const relative of DECLARED) await productModule(relative);
    await openStage();
    const person = await enrol("uploader");
    const projectId = stageProject(person.tenantId);
    const bytes = fixture("rcc6/rcc6.dxf");
    return { person, projectId, bytes, digest: sha256Of(bytes) };
  })();
  return pending;
}

afterAll(async () => {
  await closeStage();
});

describe("AC-1 — a transfer survives an interruption and lands exactly once", () => {
  test("AC-1: uploadFiles opens, is interrupted, resumes and completes; the bytes arrive at their address", async () => {
    const stage = await staged();
    const { uploadFiles } = await productModule<{ uploadFiles: UploadFiles }>(DROPZONE_BARREL);
    expect(typeof uploadFiles, `${DROPZONE_BARREL} exports uploadFiles (test contract)`).toBe("function");

    /** What the harness observed, asserted after the client has finished with it. */
    const observed: {
      created?: Answered;
      afterInterruption?: Answered;
      mismatched?: Answered;
      unchanged?: Answered;
      final?: Answered;
      patches: number;
    } = { patches: 0 };

    let interrupted = false;
    let firstChunkBytes = 0;
    let uploadId = "";

    const fetchBound = boundFetch(stage.person.cookie, {
      before: async (callMade) => {
        if (callMade.method !== "PATCH") return;
        observed.patches += 1;
        if (observed.patches !== 2 || interrupted) return;
        interrupted = true;
        // The interruption itself: the second PATCH never reaches the server. Everything the
        // criterion asks about the state it leaves behind is probed here, while it is true.
        observed.afterInterruption = await uploadStatus(stage.person.cookie, uploadId);
        observed.mismatched = await patchChunk(stage.person.cookie, uploadId, firstChunkBytes + 1, stage.bytes.slice(0, 8));
        observed.unchanged = await uploadStatus(stage.person.cookie, uploadId);
        throw new TypeError("fetch failed");
      },
      after: async (callMade, answer) => {
        const read = await readAnswer(answer.clone());
        if (callMade.method === "POST") {
          observed.created = read;
          uploadId = read.body.uploadId ?? "";
          // The client is told a chunk size and must honour it; the harness announces one that
          // makes this fixture a three-chunk transfer, which is the only way an interruption of
          // "the second PATCH" exists to be staged at all.
          const announced = Math.ceil(stage.bytes.length / 3);
          return new Response(JSON.stringify({ ...read.body, chunkBytes: announced }), {
            status: answer.status,
            headers: { "content-type": "application/json" },
          });
        }
        if (callMade.method === "PATCH") {
          observed.final = read;
          if (firstChunkBytes === 0 && typeof read.body.receivedBytes === "number") firstChunkBytes = read.body.receivedBytes;
        }
        return;
      },
    });

    const outcomes = await uploadFiles([{ name: "rcc6.dxf", file: new Blob([stage.bytes as BlobPart]) }], { projectId: stage.projectId, fetch: fetchBound });

    /* --- the session was opened as the contract spells it --- */
    expect(observed.created?.status, "POST /api/upload answers 201 (test contract)").toBe(201);
    expect(observed.created?.body.uploadId ?? "", "the created session names itself").not.toBe("");
    expect(observed.created?.body.receivedBytes, "a session that has taken no bytes has received none").toBe(0);
    expect(typeof observed.created?.body.chunkBytes, "the session announces the chunk size it takes").toBe("number");
    expect(observed.created?.body.chunkBytes ?? 0, "the announced chunk size is a real size").toBeGreaterThan(0);

    /* --- the interruption happened at all, and the client resumed through it --- */
    expect(interrupted, "the harness interrupted a second PATCH — the client sent the file in more than one chunk, as the announced chunk size requires").toBe(true);
    expect(observed.patches, "the interrupted chunk is sent again: a resumed transfer costs more PATCHes than an uninterrupted one").toBeGreaterThan(2);

    /* --- what the server held while the transfer was broken --- */
    expect(firstChunkBytes, "the interrupted transfer left a genuine partial: some bytes taken…").toBeGreaterThan(0);
    expect(firstChunkBytes, "…and not the whole file").toBeLessThan(stage.bytes.length);
    expect(observed.afterInterruption?.status, "GET /api/upload/{uploadId} answers 200 while a transfer is open").toBe(200);
    expect(observed.afterInterruption?.body.receivedBytes, "the server holds exactly the bytes the first PATCH carried").toBe(firstChunkBytes);
    expect(observed.afterInterruption?.body.size, "the probe answers the size the session was opened for").toBe(stage.bytes.length);
    expect(observed.afterInterruption?.body.complete, "an interrupted transfer is not complete").toBe(false);

    /* --- a chunk offered from the wrong place is refused by name, and changes nothing --- */
    const mismatched = observed.mismatched;
    expect(mismatched, "the mismatched-offset probe was made").toBeTruthy();
    await expectRegistered(mismatched as Answered, "UPLOAD_NOT_RESUMABLE", 409);
    expect(mismatched?.body.receivedBytes, "the refusal says where to resume from").toBe(firstChunkBytes);
    expect(observed.unchanged?.body.receivedBytes, "a refused chunk adds nothing to what the server holds").toBe(firstChunkBytes);

    /* --- the last byte: one drawing, hashed by the server itself --- */
    const final = observed.final;
    expect(final?.status, "the last PATCH answers 200").toBe(200);
    expect(final?.body.complete, "the last PATCH says the upload is complete").toBe(true);
    expect(final?.body.receivedBytes, "a complete upload has taken every byte it was opened for").toBe(stage.bytes.length);
    expect(final?.body.skipped, "nothing was skipped: one file, in a format the product reads").toEqual([]);
    const drawings = final?.body.drawings ?? [];
    expect(drawings.length, "one presented file records one drawing").toBe(1);
    expect(drawings[0]?.name, "the drawing carries the name it was presented under").toBe("rcc6.dxf");
    expect(drawings[0]?.sha256, "the server's own digest of the staged bytes is node's digest of the fixture").toBe(stage.digest);
    expect(drawings[0]?.format, "the format is the one the name and the content agree on").toBe("dxf");
    expect(drawings[0]?.duplicate, "the first upload of a content is not a duplicate").toBe(false);
    expect((drawings[0]?.drawingId ?? "").length, "the drawing names itself").toBeGreaterThan(0);

    /* --- the client answered for the file it was given --- */
    expect(Array.isArray(outcomes), "uploadFiles answers an outcome per presented file").toBe(true);
    expect(outcomes.length, "one presented file, one outcome").toBe(1);

    /* --- and the bytes are at their address, byte for byte --- */
    const held = await stored(stage.person.tenantId, stage.digest);
    expect(held, "the stored object stands at its content address under the tenant's prefix (SEAM-STORAGE)").not.toBeNull();
    expect(Array.from(held ?? []), "the stored bytes are the fixture's bytes").toEqual(Array.from(stage.bytes));
  }, 300_000);
});

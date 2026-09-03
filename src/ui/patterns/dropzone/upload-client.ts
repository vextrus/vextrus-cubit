/**
 * The client half of R-SPINE-020's protocol: the browser's side of "opened, sent in chunks, probed,
 * resumed, completed". It ships beside the pattern that gathers the files because the two are one
 * contract — a queue that showed progress a different client produced would be showing a guess.
 *
 * Everything the server is the authority on comes from the server: the chunk size is the one the
 * session announced, and the offset a chunk continues from is the count the server acknowledged.
 * When a request never arrives, the client asks where the server got to and continues from there —
 * which is the whole point of a resumable transfer.
 *
 * ARCH-01: this layer holds no value import of `src/core` and none at all of `src/modules`, so the
 * wire's shapes are described here as types. The register's own entry travels in the answer, which
 * is what the queue renders — no code is re-spelled and no sentence is written here.
 */
import type { RefusalEntry } from "../../../core/errors";

/** The addresses the protocol is spoken at (test contract). */
const ROUTES = {
  create: "/api/upload",
  one: (uploadId: string): string => `/api/upload/${uploadId}`,
} as const;

/** The header a chunk states the offset it continues from in. */
const OFFSET_HEADER = "upload-offset";

/** How many times one chunk is offered again after a request that never arrived. */
const CHUNK_ATTEMPTS = 3;

/** A `fetch`, as a caller may hand one in — a test binds this to the routes themselves. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** One drawing a completed upload recorded, as the doors answer it. */
export interface UploadedDrawing {
  drawingId: string;
  name: string;
  sha256: string;
  format: string;
  duplicate: boolean;
}

/** A member of an archive the product does not read, with the registered reason it was left behind. */
export interface SkippedUpload {
  name: string;
  reason: string;
}

/**
 * What one presented file amounted to. It mirrors what the upload seam answers rather than importing
 * it: `src/ui` may not reach into `src/modules` at all (ARCH-01), and this is the shape on the wire
 * between them.
 */
export interface UploadOutcome {
  name: string;
  uploadId: string | null;
  /**
   * `refused` is an answer the product means and always carries the registered entry it was refused
   * under; `failed` is the other thing that can happen to a transfer — the server answered for an
   * outage of its own, or the connection went and never came back — and it is never dressed as a
   * refusal, because a row saying "Refused" with nothing to say is an outage with the evidence
   * thrown away (ARCH-03, B-21). The consuming screen shows a failure in its error cell with the
   * fault id the door reported (Decision § 2's error state); a refusal is a row.
   */
  state: "stored" | "refused" | "failed";
  drawings: UploadedDrawing[];
  skipped: SkippedUpload[];
  refusal?: RefusalEntry;
  /** The id the door recorded its outage under, where it gave one — what a person quotes. */
  faultId?: string;
}

/** What a caller watching a transfer is told, as often as the server acknowledges anything. */
export interface UploadProgress {
  name: string;
  uploadId: string | null;
  state: "queued" | "uploading" | "stored" | "refused" | "failed";
  receivedBytes: number;
  size: number;
}

/** How a transfer is made: which project it lands in, and who reports it. */
export interface UploadOptions {
  projectId: string;
  fetch?: FetchLike;
  onProgress?: (progress: UploadProgress) => void;
}

/** The body any of the three doors answers with, read as the shapes they can be. */
interface UploadAnswer {
  uploadId?: string;
  receivedBytes?: number;
  chunkBytes?: number;
  size?: number;
  complete?: boolean;
  drawings?: UploadedDrawing[];
  skipped?: SkippedUpload[];
  refusal?: RefusalEntry;
  faultId?: string;
}

/** An answer, with the status it came under. */
interface Answered {
  status: number;
  body: UploadAnswer;
}

/** The sha256 of a file, lowercase hex — the digest the browser declares and the server checks. */
async function digestOf(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** One call, read as JSON when it carries any. */
async function call(send: FetchLike, path: string, init: RequestInit): Promise<Answered> {
  const answer = await send(path, init);
  const text = await answer.text();
  if (text.trim() === "") return { status: answer.status, body: {} };
  return { status: answer.status, body: JSON.parse(text) as UploadAnswer };
}

/**
 * What the door's answer amounted to: the refusal it named, or a failure. An answer with no
 * registered entry is not a refusal — a refusal is a sentence the product means, and an answer that
 * carries none is an outage, reported as one with whatever the door recorded it under.
 */
function settled(name: string, uploadId: string | null, answer: Answered): UploadOutcome {
  const refusal = answer.body.refusal;
  if (refusal === undefined) {
    return { name, uploadId, state: "failed", drawings: [], skipped: [], ...(answer.body.faultId === undefined ? {} : { faultId: answer.body.faultId }) };
  }
  return { name, uploadId, state: "refused", drawings: [], skipped: [], refusal };
}

/**
 * Send every one of these files, in turn, and answer what each one amounted to. A file that is
 * refused is one refused outcome and no exception: a refusal is an answer the product means, and the
 * files behind it in the queue are still sent (R-UI-050's partial).
 */
export async function uploadFiles(files: { name: string; file: Blob }[], options: UploadOptions): Promise<UploadOutcome[]> {
  const send: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const outcomes: UploadOutcome[] = [];
  for (const presented of files) outcomes.push(await uploadOne(presented, options, send));
  return outcomes;
}

/** One file, from the session that opens for it to the last byte of it. */
async function uploadOne(presented: { name: string; file: Blob }, options: UploadOptions, send: FetchLike): Promise<UploadOutcome> {
  const size = presented.file.size;
  const report = (state: UploadProgress["state"], uploadId: string | null, receivedBytes: number): void => {
    options.onProgress?.({ name: presented.name, uploadId, state, receivedBytes, size });
  };
  report("queued", null, 0);

  const sha256 = await digestOf(presented.file);
  const created = await call(send, ROUTES.create, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId: options.projectId, name: presented.name, size, sha256 }),
  });
  const uploadId = created.body.uploadId ?? "";
  if (created.status !== 201 || uploadId === "") {
    report(created.body.refusal === undefined ? "failed" : "refused", null, 0);
    return settled(presented.name, null, created);
  }

  const chunkBytes = created.body.chunkBytes ?? size;
  let offset = created.body.receivedBytes ?? 0;
  report("uploading", uploadId, offset);

  while (offset < size) {
    const end = Math.min(offset + chunkBytes, size);
    const sent = await sendChunk(send, uploadId, offset, presented.file.slice(offset, end));
    if (sent.status === 200) {
      const acknowledged = sent.body.receivedBytes ?? end;
      offset = acknowledged;
      report(sent.body.complete === true ? "stored" : "uploading", uploadId, acknowledged);
      if (sent.body.complete === true) {
        return { name: presented.name, uploadId, state: "stored", drawings: sent.body.drawings ?? [], skipped: sent.body.skipped ?? [] };
      }
      continue;
    }
    // The server said where it got to: a client that resumes from anywhere else is refused again,
    // so it continues from the point the answer names and offers that chunk instead.
    const resumeAt = sent.body.receivedBytes;
    if (typeof resumeAt === "number" && resumeAt !== offset && resumeAt < size) {
      offset = resumeAt;
      report("uploading", uploadId, offset);
      continue;
    }
    return await asked(presented.name, uploadId, offset, send, sent, report);
  }

  // Every byte was acknowledged without the door ever saying the upload completed — the server's own
  // account of the transfer is what settles it, so it is asked.
  return await asked(presented.name, uploadId, offset, send, { status: 0, body: {} }, report);
}

/**
 * What the transfer amounted to when the chunk loop stopped without an answer that settled it: the
 * server is asked, and its account decides. An acknowledgement that never arrived is not a refusal
 * and not a failure — the last chunk may well have landed, and a transfer the server calls complete
 * is stored no matter what happened to the answer that said so (R-SPINE-020). Only when the server
 * says the transfer is unfinished does the door's own answer stand as what it was.
 */
async function asked(
  name: string,
  uploadId: string,
  offset: number,
  send: FetchLike,
  answer: Answered,
  report: (state: UploadProgress["state"], uploadId: string | null, receivedBytes: number) => void,
): Promise<UploadOutcome> {
  let probed: Answered = { status: 0, body: {} };
  try {
    probed = await call(send, ROUTES.one(uploadId), { method: "GET" });
  } catch {
    // The probe did not arrive either; the door's own answer is all there is to go on.
  }
  if (probed.body.complete === true) {
    report("stored", uploadId, probed.body.receivedBytes ?? offset);
    return { name, uploadId, state: "stored", drawings: answer.body.drawings ?? [], skipped: answer.body.skipped ?? [] };
  }
  const outcome = settled(name, uploadId, answer);
  report(outcome.state === "refused" ? "refused" : "failed", uploadId, probed.body.receivedBytes ?? offset);
  return outcome;
}

/**
 * One chunk, offered again when the request never arrives. A transfer that loses its connection asks
 * the server what it holds and continues from there — the interruption costs the chunk that was in
 * flight and nothing else (R-SPINE-020).
 *
 * A chunk that has spent its attempts answers rather than throwing: this file is sent one file at a
 * time, and an exception here would carry away the outcomes of every file already stored behind it.
 * What became of the transfer is then the server's to say, and the caller asks it.
 */
async function sendChunk(send: FetchLike, uploadId: string, offset: number, chunk: Blob): Promise<Answered> {
  for (let attempt = 0; attempt < CHUNK_ATTEMPTS; attempt += 1) {
    try {
      return await call(send, ROUTES.one(uploadId), {
        method: "PATCH",
        headers: { "content-type": "application/octet-stream", [OFFSET_HEADER]: String(offset) },
        body: await chunk.arrayBuffer(),
      });
    } catch {
      const held = await probe(send, uploadId);
      // The server took some of the chunk before the connection went: the caller is told where it
      // got to and sends the bytes from there, rather than the ones it already holds. A server that
      // took none of them is offered this very chunk again.
      if (held !== null && held !== offset) return { status: 0, body: { receivedBytes: held } };
    }
  }
  return { status: 0, body: {} };
}

/** What the server holds, or null when the probe itself did not arrive. */
async function probe(send: FetchLike, uploadId: string): Promise<number | null> {
  try {
    const answer = await call(send, ROUTES.one(uploadId), { method: "GET" });
    return answer.body.receivedBytes ?? null;
  } catch {
    return null;
  }
}

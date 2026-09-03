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
  state: "stored" | "refused";
  drawings: UploadedDrawing[];
  skipped: SkippedUpload[];
  refusal?: RefusalEntry;
}

/** What a caller watching a transfer is told, as often as the server acknowledges anything. */
export interface UploadProgress {
  name: string;
  uploadId: string | null;
  state: "queued" | "uploading" | "stored" | "refused";
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

/** A refused outcome, carrying the registered entry the door answered with. */
function refused(name: string, uploadId: string | null, answer: Answered): UploadOutcome {
  return { name, uploadId, state: "refused", drawings: [], skipped: [], ...(answer.body.refusal === undefined ? {} : { refusal: answer.body.refusal }) };
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
  if (created.status !== 201 || uploadId === "") return refused(presented.name, null, created);

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
    report("refused", uploadId, offset);
    return refused(presented.name, uploadId, sent);
  }

  // Every byte was acknowledged without the door ever saying the upload completed — the server's own
  // account of the transfer is what settles it, so it is asked.
  const probed = await call(send, ROUTES.one(uploadId), { method: "GET" });
  report(probed.body.complete === true ? "stored" : "uploading", uploadId, probed.body.receivedBytes ?? offset);
  return { name: presented.name, uploadId, state: "stored", drawings: [], skipped: [] };
}

/**
 * One chunk, offered again when the request never arrives. A transfer that loses its connection asks
 * the server what it holds and continues from there — the interruption costs the chunk that was in
 * flight and nothing else (R-SPINE-020).
 */
async function sendChunk(send: FetchLike, uploadId: string, offset: number, chunk: Blob): Promise<Answered> {
  let last: unknown;
  for (let attempt = 0; attempt < CHUNK_ATTEMPTS; attempt += 1) {
    try {
      return await call(send, ROUTES.one(uploadId), {
        method: "PATCH",
        headers: { "content-type": "application/octet-stream", [OFFSET_HEADER]: String(offset) },
        body: await chunk.arrayBuffer(),
      });
    } catch (failure) {
      last = failure;
      const held = await probe(send, uploadId);
      // The server took some of the chunk before the connection went: the caller is told where it
      // got to and sends the bytes from there, rather than the ones it already holds. A server that
      // took none of them is offered this very chunk again.
      if (held !== null && held !== offset) return { status: 0, body: { receivedBytes: held } };
    }
  }
  throw last;
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

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
import type { RefusalEntry } from "@/core/errors";

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
  /**
   * The transfer stored, but on the server's word rather than on the acknowledgement that lists what
   * it recorded: the last answer never arrived and the probe's shape carries no drawings, so
   * `drawings` and `skipped` are empty because this client cannot say, not because nothing was
   * recorded. A consumer that renders a row per drawing reads this before reading an empty list as
   * "nothing stored" (R-UI-050: a partial is answered, never dressed as a whole).
   */
  recovered?: true;
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

/** The 64 SHA-256 round constants (first 32 bits of fractional parts of cube roots of primes 2..311). */
const K = new Uint32Array(
  (
    "428a2f98 71374491 b5c0fbcf e9b5dba5 3956c25b 59f111f1 923f82a4 ab1c5ed5 " +
    "d807aa98 12835b01 243185be 550c7dc3 72be5d74 80deb1fe 9bdc06a7 c19bf174 " +
    "e49b69c1 efbe4786 0fc19dc6 240ca1cc 2de92c6f 4a7484aa 5cb0a9dc 76f988da " +
    "983e5152 a831c66d b00327c8 bf597fc7 c6e00bf3 d5a79147 06ca6351 14292967 " +
    "27b70a85 2e1b2138 4d2c6dfc 53380d13 650a7354 766a0abb 81c2c92e 92722c85 " +
    "a2bfe8a1 a81a664b c24b8b70 c76c51a3 d192e819 d6990624 f40e3585 106aa070 " +
    "19a4c116 1e376c08 2748774c 34b0bcb5 391c0cb3 4ed8aa4a 5b9cca4f 682e6ff3 " +
    "748f82ee 78a5636f 84c87814 8cc70208 90befffa a4506ceb bef9a3f7 c67178f2"
  )
    .split(" ")
    .map((hex) => Number.parseInt(hex, 16)),
);

/** The initial SHA-256 state values (fractional parts of square roots of first 8 primes 2..19). */
const H_INIT = new Uint32Array(
  "6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19"
    .split(" ")
    .map((hex) => Number.parseInt(hex, 16)),
);

/** 32-bit right rotate. */
function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

/**
 * Pure TypeScript SHA-256 fallback when Web Cryptography API (`crypto.subtle`) is unavailable,
 * such as in non-secure HTTP contexts (e.g. dev server accessed over WSL2 / local network IP).
 */
export function sha256Fallback(bytes: Uint8Array): string {
  let h0 = H_INIT[0] ?? 0;
  let h1 = H_INIT[1] ?? 0;
  let h2 = H_INIT[2] ?? 0;
  let h3 = H_INIT[3] ?? 0;
  let h4 = H_INIT[4] ?? 0;
  let h5 = H_INIT[5] ?? 0;
  let h6 = H_INIT[6] ?? 0;
  let h7 = H_INIT[7] ?? 0;

  const w = new Uint32Array(64);

  const processBlock = (view: DataView, offset: number): void => {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(offset + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const w15 = w[t - 15] ?? 0;
      const w2 = w[t - 2] ?? 0;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[t] = ((w[t - 16] ?? 0) + s0 + (w[t - 7] ?? 0) + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const kt = K[t] ?? 0;
      const wt = w[t] ?? 0;
      const t1 = (h + s1 + ch + kt + wt) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  };

  const len = bytes.length;
  const mainView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fullBlocks = Math.floor(len / 64);

  for (let b = 0; b < fullBlocks; b++) {
    processBlock(mainView, b * 64);
  }

  const rem = len % 64;
  const tailLen = rem < 56 ? 64 : 128;
  const tail = new Uint8Array(tailLen);
  tail.set(bytes.subarray(fullBlocks * 64));
  tail[rem] = 0x80;

  const tailView = new DataView(tail.buffer);
  tailView.setUint32(tailLen - 8, Math.floor(len / 536870912), false);
  tailView.setUint32(tailLen - 4, (len * 8) >>> 0, false);

  processBlock(tailView, 0);
  if (tailLen === 128) {
    processBlock(tailView, 64);
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((p) => p.toString(16).padStart(8, "0"))
    .join("");
}

/** The sha256 of a file, lowercase hex — the digest the browser declares and the server checks. */
export async function digestOf(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    try {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // In insecure contexts or environments where subtle.digest throws, fall back to pure JS sha256.
    }
  }
  return sha256Fallback(new Uint8Array(buffer));
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
    const recorded = answer.body.drawings;
    if (recorded === undefined) {
      // The transfer stored and the door's own answer for it never arrived, so what it recorded is
      // not knowable from here — the probe's shape carries no drawings. The outcome says so rather
      // than handing back an empty list that reads as "stored nothing".
      return { name, uploadId, state: "stored", recovered: true, drawings: [], skipped: [] };
    }
    return { name, uploadId, state: "stored", drawings: recorded, skipped: answer.body.skipped ?? [] };
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

// R-SPINE-020's upload session: opened for one declared file, fed in offset-addressed chunks,
// probed and resumed after an interruption, and settled on the last byte.
//
// The server is the authority on every fact that matters. It counts the bytes it holds — a client's
// idea of the offset is a claim, and a claim that disagrees is refused rather than trusted; it takes
// the sha256 of the staged bytes itself and compares that to what the browser declared; it reads the
// format out of the content as well as the name; and it hands the bytes to the scan hook before a
// single one of them reaches the store (Q-12).
//
// Everything an upload is refused for is a registered code (R-SPINE-062): nothing here invents a
// message, and a refusal is never a fault (ARCH-03). A staging copy whose length disagrees with the
// row is not an outage either: the transfer resumes from the bytes both of them vouch for, under the
// registered code whose remedy is exactly that correction.
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, open, readFile, rm, stat, truncate } from "node:fs/promises";
import { drawings, eq, files, forTenant, holdStateLock, isUuid, projects, runAsSystem, uploads, UPLOAD_CHUNK_BYTES, UPLOAD_MAX_BYTES, type AcceptedFormat, type ScanVerdict, type TenantDb, type TenantTx, type UploadState } from "../../../core/db";
import { REFUSALS } from "../../../core/errors";
import type { UploadRefusalCode } from "./refusals";
import { declaredFormat, detectFormat, FORMAT_HEAD_BYTES, isArchiveContent, isArchiveName } from "./formats";
import { scanUpload } from "./scanner";
import { stagingDir, stagingPath, uploadStorage } from "./storage";
import { expandZip, type SkippedMember } from "./zip";

/** Who the transfer belongs to: the workspace it lands in, and the person the drawing is credited to. */
export interface UploadActor {
  tenantId: string;
  userId: string;
}

/** The session as a caller opens it (test contract: the POST body, plus the caller's identity). */
export interface CreateUploadRequest {
  actor: UploadActor;
  projectId: string;
  name: string;
  size: number;
  sha256: string;
}

/** One chunk, offered from the offset the client believes the server holds. */
export interface AppendChunkRequest {
  actor: UploadActor;
  uploadId: string;
  offset: number;
  bytes: Uint8Array;
}

/** A probe of an open session. */
export interface UploadStatusRequest {
  actor: UploadActor;
  uploadId: string;
}

/** One drawing a completed upload recorded, as the door answers it. */
export interface RecordedDrawing {
  drawingId: string;
  name: string;
  sha256: string;
  format: AcceptedFormat;
  duplicate: boolean;
}

/** A refusal, with the resumption point where one exists — a refused chunk still says where to go on. */
export interface UploadRefused {
  refusal: UploadRefusalCode;
  receivedBytes?: number;
}

/** An opened session (test contract: the 201 answer). */
export interface UploadOpened {
  uploadId: string;
  receivedBytes: number;
  chunkBytes: number;
}

/** What a chunk is acknowledged with — and, on the last byte, what the whole transfer amounted to. */
export interface UploadAdvanced {
  uploadId: string;
  receivedBytes: number;
  complete?: true;
  drawings?: RecordedDrawing[];
  skipped?: SkippedMember[];
}

/** What a probe answers (test contract: the GET answer). */
export interface UploadProbe {
  uploadId: string;
  receivedBytes: number;
  size: number;
  complete: boolean;
  state: UploadState;
}

/**
 * What one presented file amounted to, whole: the drawings it recorded, the members of it the
 * product does not read, and the registered code it was refused with if it was. This is the shape a
 * client reports per file (`uploadFiles`), and the shape a caller of the seam reads an upload back as.
 */
export interface UploadOutcome {
  name: string;
  uploadId: string | null;
  state: "stored" | "refused";
  drawings: RecordedDrawing[];
  skipped: SkippedMember[];
  refusal?: UploadRefusalCode;
}

/** The row this seam reads a session out of, whichever door asked. */
interface SessionRow {
  uploadId: string;
  projectId: string;
  name: string;
  declaredSize: number;
  declaredSha256: string;
  receivedBytes: number;
  state: UploadState;
}

/** An upload of a workspace the caller's session does not hold is an upload they cannot see at all. */
const NOT_THEIRS: UploadRefused = { refusal: REFUSALS.WORKSPACE_PERMISSION_NOT_HELD.code };

/**
 * The workspace an address belongs to is never taken from the caller: a tenant id on the wire is a
 * value the caller wrote, and scoping a handle by it would let a signed-in stranger reach into
 * somebody else's workspace. It is read as the system — the fact decides which tenant handle may be
 * opened at all, so no tenant handle can be the one to answer it — and the caller's membership is
 * what admits the request (the shape `holdsWorkspace` guards every other named-workspace door with).
 */
const OWNING_TENANT_REASON = "R-SPINE-020 upload seam: the workspace a named project or upload session belongs to, before any tenant handle is opened";

/** The workspace this project belongs to, or null when no project stands under that id. */
export async function workspaceOfProject(projectId: string): Promise<string | null> {
  if (!isUuid(projectId)) return null;
  const owning = await runAsSystem(OWNING_TENANT_REASON).select({ tenantId: projects.tenantId }).from(projects).where(eq(projects.projectId, projectId)).limit(1);
  return owning[0]?.tenantId ?? null;
}

/** The workspace this upload session belongs to, or null when no session stands under that id. */
export async function workspaceOfUpload(uploadId: string): Promise<string | null> {
  if (!isUuid(uploadId)) return null;
  const owning = await runAsSystem(OWNING_TENANT_REASON).select({ tenantId: uploads.tenantId }).from(uploads).where(eq(uploads.uploadId, uploadId)).limit(1);
  return owning[0]?.tenantId ?? null;
}

/** The handle every statement of this seam runs on: the tenant's, as SEAM-TENANT requires. */
function handle(actor: UploadActor): TenantDb {
  return forTenant({ tenantId: actor.tenantId });
}

/**
 * A tenant's typed surface, whether the caller is running on the handle itself or inside the
 * transaction one chunk is taken in. The statements this seam writes are the same either way.
 */
type Handle = TenantDb | TenantTx;

/**
 * The state a second concurrent chunk of the same transfer waits behind: everything appendChunk
 * reads about a session — its state, its acknowledged offset, the length of its staging copy — has
 * to stay true until the chunk it judged has been written and counted, or two retries of one chunk
 * both pass the same checks and the transfer is counted twice.
 */
function sessionLockKey(uploadId: string): string {
  return `spine.uploads.session:${uploadId}`;
}

/** The session this caller named, or null when their workspace holds none under that id. */
async function sessionOf(db: Handle, uploadId: string): Promise<SessionRow | null> {
  if (!isUuid(uploadId)) return null;
  const rows = await db
    .select({
      uploadId: uploads.uploadId,
      projectId: uploads.projectId,
      name: uploads.name,
      declaredSize: uploads.declaredSize,
      declaredSha256: uploads.declaredSha256,
      receivedBytes: uploads.receivedBytes,
      state: uploads.state,
    })
    .from(uploads)
    .where(eq(uploads.uploadId, uploadId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Open a session for one declared file. The ceiling and the name are judged before a byte is taken —
 * a person is told the file is too large or in a format the product does not read while they can
 * still do something about it, rather than after 500 MB have crossed the wire (Q-12, R-UI-033).
 */
export async function createUpload(request: CreateUploadRequest): Promise<UploadOpened | UploadRefused> {
  if (request.size > UPLOAD_MAX_BYTES) return { refusal: REFUSALS.FILE_TOO_LARGE.code };
  // An archive is expanded into its members, so it opens a session under its own name even though it
  // is not itself one of the formats the product reads.
  if (!isArchiveName(request.name) && declaredFormat(request.name) === null) return { refusal: REFUSALS.FORMAT_NOT_ACCEPTED.code };

  const opened = await handle(request.actor)
    .insert(uploads)
    .values({
      tenantId: request.actor.tenantId,
      projectId: request.projectId,
      name: request.name,
      declaredSize: request.size,
      declaredSha256: request.sha256,
      receivedBytes: 0,
      state: "open",
      createdBy: request.actor.userId,
    })
    .returning({ uploadId: uploads.uploadId });

  const uploadId = opened[0]?.uploadId ?? "";
  return { uploadId, receivedBytes: 0, chunkBytes: UPLOAD_CHUNK_BYTES };
}

/**
 * Take one chunk. The offset is judged against the server's own count, not against the client's, and
 * a chunk offered from anywhere else adds nothing and says where to resume from (R-SPINE-020).
 */
export async function appendChunk(request: AppendChunkRequest): Promise<UploadAdvanced | UploadRefused> {
  const db = handle(request.actor);
  // One transfer's chunks are taken one at a time: the lock is held on the session's name for the
  // whole read-judge-write, so a retry racing the request it was retrying cannot pass the same
  // checks twice and count the transfer twice (the shape every check-then-act writer here uses).
  //
  // Its span is that judgement and no more. Settling the last chunk hashes, scans and stores up to
  // 500 MB, and holding a pooled connection open — idle in a transaction, with an advisory lock —
  // for the length of a store is how a handful of large uploads exhaust the pool. It is safe to let
  // go of first: exactly one chunk can bring the count to the declared size under the lock, and
  // every other chunk that arrives while that one settles is refused by the checks above, because
  // the row and the staging copy both stand at the declared size until the settling is written.
  const taken: UploadAdvanced | UploadRefused | { settling: SessionRow } = await db.transaction(async (tx) => {
    await holdStateLock(tx, sessionLockKey(request.uploadId));
    const session = await sessionOf(tx, request.uploadId);
    if (session === null) return NOT_THEIRS;
    if (session.state !== "open") return { refusal: REFUSALS.UPLOAD_NOT_RESUMABLE.code, receivedBytes: session.receivedBytes };

    const acknowledged = await reconcile(tx, request.actor, session);
    if (acknowledged !== session.receivedBytes) return { refusal: REFUSALS.UPLOAD_NOT_RESUMABLE.code, receivedBytes: acknowledged };
    if (request.offset !== acknowledged) return { refusal: REFUSALS.UPLOAD_NOT_RESUMABLE.code, receivedBytes: acknowledged };
    if (acknowledged + request.bytes.length > session.declaredSize) {
      return { refusal: REFUSALS.UPLOAD_NOT_RESUMABLE.code, receivedBytes: acknowledged };
    }

    const received = await stage(request.actor, session, request.bytes);
    await tx.update(uploads).set({ receivedBytes: received }).where(eq(uploads.uploadId, session.uploadId));
    if (received < session.declaredSize) return { uploadId: session.uploadId, receivedBytes: received };

    return { settling: { ...session, receivedBytes: received } };
  });

  if (!("settling" in taken)) return taken;
  return complete(db, request.actor, taken.settling);
}

/** Where an open session stands (test contract: the GET answer). */
export async function uploadStatus(request: UploadStatusRequest): Promise<UploadProbe | UploadRefused> {
  const session = await sessionOf(handle(request.actor), request.uploadId);
  if (session === null) return NOT_THEIRS;
  return {
    uploadId: session.uploadId,
    receivedBytes: session.receivedBytes,
    size: session.declaredSize,
    complete: session.state === "stored",
    state: session.state,
  };
}

/**
 * What the server can honestly resume from, with the row and the staging copy made to agree on it.
 * The two can disagree — a process that died between the write and the count, a staging copy a
 * volume lost — and only the bytes both of them vouch for are resumable, so the transfer continues
 * from the lower of the two rather than becoming unsendable. The correction is the client's to make,
 * so it travels as the registered refusal that carries the server's own count (R-SPINE-020,
 * UPLOAD_NOT_RESUMABLE's remedy: "resume from the point the server reports").
 */
async function reconcile(db: Handle, actor: UploadActor, session: SessionRow): Promise<number> {
  const path = stagingPath(actor.tenantId, session.uploadId);
  const held = await stagedLength(path);
  if (held === session.receivedBytes) return held;

  const resumable = Math.min(held, session.receivedBytes);
  if (held > resumable) {
    if (resumable === 0) await rm(path, { force: true });
    else await truncate(path, resumable);
  }
  await db.update(uploads).set({ receivedBytes: resumable }).where(eq(uploads.uploadId, session.uploadId));
  return resumable;
}

/** Write the chunk at the offset the row acknowledged, and answer the server's new count. */
async function stage(actor: UploadActor, session: SessionRow, bytes: Uint8Array): Promise<number> {
  const path = stagingPath(actor.tenantId, session.uploadId);
  await mkdir(stagingDir(actor.tenantId), { recursive: true });
  const handle = await open(path, session.receivedBytes === 0 ? "w" : "r+");
  try {
    await handle.write(bytes, 0, bytes.length, session.receivedBytes);
  } finally {
    await handle.close();
  }
  return session.receivedBytes + bytes.length;
}

/**
 * How many bytes the staging copy holds — none at all when there is no copy, which is a state an
 * open session can genuinely be in and the count `reconcile` answers from.
 */
async function stagedLength(path: string): Promise<number> {
  if (!existsSync(path)) return 0;
  return (await stat(path)).size;
}

/** The seam's own digest of the staged bytes, streamed — a 500 MB file is never held in memory to hash. */
async function stagedDigest(path: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk as Uint8Array);
  return digest.digest("hex");
}

/** The staged file's leading bytes — enough to read a signature, never the whole file. */
async function stagedHead(path: string): Promise<Uint8Array> {
  const handle = await open(path, "r");
  try {
    const head = new Uint8Array(FORMAT_HEAD_BYTES);
    const { bytesRead } = await handle.read(head, 0, FORMAT_HEAD_BYTES, 0);
    return head.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * The last byte: hash, format, scan, store, record — in that order, because each one is a reason not
 * to do the next. Whatever the answer, the staged copy goes: it was a means, never a record.
 */
async function complete(db: Handle, actor: UploadActor, session: SessionRow): Promise<UploadAdvanced | UploadRefused> {
  const path = stagingPath(actor.tenantId, session.uploadId);
  try {
    const digest = await stagedDigest(path);
    if (digest !== session.declaredSha256) return await refuse(db, session, REFUSALS.DIGEST_MISMATCH.code);

    const head = await stagedHead(path);
    if (isArchiveName(session.name)) {
      if (!isArchiveContent(head)) return await refuse(db, session, REFUSALS.FORMAT_NOT_ACCEPTED.code);
      return await completeArchive(db, actor, session, path);
    }

    const format = detectFormat(session.name, head);
    if (format === null) return await refuse(db, session, REFUSALS.FORMAT_NOT_ACCEPTED.code);

    const bytes = new Uint8Array(await readFile(path));
    const scan = await scanUpload(bytes, session.name);
    if (scan.verdict === "infected") return await refuse(db, session, REFUSALS.SCAN_REJECTED.code);

    const drawing = await record(db, actor, session, { name: session.name, bytes, format, digest, verdict: scan.verdict });
    return await settle(db, session, [drawing], []);
  } finally {
    await rm(path, { force: true });
  }
}

/**
 * An archive is packaging: it is expanded into the drawings it holds, and the container itself is
 * neither stored nor recorded. A member the product does not read is named in `skipped` with the
 * registered reason — R-UI-050's partial, answered rather than hidden.
 */
async function completeArchive(db: Handle, actor: UploadActor, session: SessionRow, path: string): Promise<UploadAdvanced | UploadRefused> {
  const expansion = expandZip(new Uint8Array(await readFile(path)));
  if (!expansion.readable) return await refuse(db, session, REFUSALS.FORMAT_NOT_ACCEPTED.code);

  const recorded: RecordedDrawing[] = [];
  const skipped: SkippedMember[] = [...expansion.skipped];
  for (const member of expansion.members) {
    const format = detectFormat(member.path, member.bytes.subarray(0, FORMAT_HEAD_BYTES));
    if (format === null) {
      skipped.push({ name: member.path, reason: REFUSALS.FORMAT_NOT_ACCEPTED.code });
      continue;
    }
    const scan = await scanUpload(member.bytes, member.path);
    if (scan.verdict === "infected") {
      skipped.push({ name: member.path, reason: REFUSALS.SCAN_REJECTED.code });
      continue;
    }
    const digest = createHash("sha256").update(member.bytes).digest("hex");
    recorded.push(await record(db, actor, session, { name: member.path, bytes: member.bytes, format, digest, verdict: scan.verdict }));
  }
  return await settle(db, session, recorded, skipped);
}

/** One content and the drawing made of it: stored once per workspace, recorded once per presented name. */
async function record(
  db: Handle,
  actor: UploadActor,
  session: SessionRow,
  content: { name: string; bytes: Uint8Array; format: AcceptedFormat; digest: string; verdict: ScanVerdict },
): Promise<RecordedDrawing> {
  const held = await db.select({ sha256: files.sha256 }).from(files).where(eq(files.sha256, content.digest)).limit(1);
  const duplicate = held[0] !== undefined;
  // R-SPINE-021's retention is a property of the store, not of two stores agreeing: a row saying the
  // content is already held is trusted only as far as the object it points at, so bytes that are not
  // at their address are laid down now, while the sender still has them. Identical content that is
  // genuinely stored is linked and not written again.
  const atItsAddress = duplicate && (await uploadStorage().get(actor.tenantId, content.digest)) !== null;
  if (!atItsAddress) {
    // The bytes reach the store before the row that points at them: an object with no row is a
    // retention nobody reads, where a row with no object is a drawing that cannot be opened.
    await uploadStorage().put(actor.tenantId, content.bytes);
  }
  if (!duplicate) {
    await db
      .insert(files)
      .values({
        tenantId: actor.tenantId,
        sha256: content.digest,
        byteLength: content.bytes.length,
        format: content.format,
        scanVerdict: content.verdict,
      })
      .onConflictDoNothing();
  }

  const written = await db
    .insert(drawings)
    .values({
      tenantId: actor.tenantId,
      projectId: session.projectId,
      sha256: content.digest,
      name: content.name,
      format: content.format,
      uploadedBy: actor.userId,
    })
    .returning({ drawingId: drawings.drawingId });

  return { drawingId: written[0]?.drawingId ?? "", name: content.name, sha256: content.digest, format: content.format, duplicate };
}

/** End the session as stored, and answer what the transfer amounted to. */
async function settle(db: Handle, session: SessionRow, recorded: RecordedDrawing[], skipped: SkippedMember[]): Promise<UploadAdvanced> {
  await db.update(uploads).set({ state: "stored", completedAt: new Date() }).where(eq(uploads.uploadId, session.uploadId));
  return { uploadId: session.uploadId, receivedBytes: session.receivedBytes, complete: true, drawings: recorded, skipped };
}

/** End the session as refused. The row stands with the state it ended in — nothing is taken away. */
async function refuse(db: Handle, session: SessionRow, code: UploadRefusalCode): Promise<UploadRefused> {
  await db.update(uploads).set({ state: "refused", completedAt: new Date() }).where(eq(uploads.uploadId, session.uploadId));
  return { refusal: code, receivedBytes: session.receivedBytes };
}

/** Did this answer refuse? The one reading of the seam's two-armed answers (ARCH-03). */
export function isRefused(answer: object): answer is UploadRefused {
  return "refusal" in answer;
}

/**
 * R-SPINE-020's virus-scan hook point, driven through the shipped doors: what an installation that
 * wires a scanner in gets, and what one that wires none gets.
 *
 * The verdict is a fact about the stored content, so it is read back from the `files` row rather
 * than from the answer: a file nobody scanned must never read back as one somebody passed clean
 * (Q-12), and a file a scanner rejected must not be stored at all.
 *
 * A rejected scan is a refusal, not a fault (ARCH-03): the registered `SCAN_REJECTED` entry is the
 * answer, message and remedy included, and the fault sink hears nothing.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import {
  closeStage,
  createUpload,
  dxfLike,
  enrol,
  expectRegistered,
  openStage,
  patchChunk,
  productModule,
  rowsFor,
  sha256Of,
  sqlValue,
  stageProject,
  stagingPath,
  stored,
  UPLOADS_MODULE,
  type Person,
} from "./support/upload-stage";

/** The hook as the seam publishes it (increment interfaces). */
interface ScannerSeam {
  setUploadScanner(scanner: { scan(bytes: Uint8Array, name: string): Promise<{ verdict: string; detail?: string }> } | null): void;
}

interface Staged {
  person: Person;
  projectId: string;
}

let pending: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  pending ??= (async () => {
    await openStage();
    const person = await enrol("scanned");
    return { person, projectId: stageProject(person.tenantId) };
  })();
  return pending;
}

/** Wire a verdict in for one case, and hand the hook back its default afterwards. */
async function scanningWith(verdict: string): Promise<void> {
  const seam = await productModule<ScannerSeam>(UPLOADS_MODULE);
  seam.setUploadScanner({ scan: async () => ({ verdict }) });
}

afterEach(async () => {
  const seam = await productModule<ScannerSeam>(UPLOADS_MODULE);
  seam.setUploadScanner(null);
});

afterAll(async () => {
  await closeStage();
});

/** Send a whole file in one chunk, under a name of its own. */
async function upload(person: Person, projectId: string, bytes: Uint8Array, name: string): Promise<Awaited<ReturnType<typeof patchChunk>> & { uploadId: string }> {
  const created = await createUpload(person.cookie, { projectId, name, size: bytes.length, sha256: sha256Of(bytes) });
  expect(created.status, `POST /api/upload answers 201 for ${name}`).toBe(201);
  const uploadId = created.body.uploadId ?? "";
  return { ...(await patchChunk(person.cookie, uploadId, 0, bytes)), uploadId };
}

/** The verdict the store recorded against a content address. */
function verdictOf(tenantId: string, digest: string): string {
  return sqlValue(`select scan_verdict from files where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and sha256 = ${lit(digest)};`);
}

describe("the scan hook decides whether bytes are stored at all", () => {
  test("an installation with no scanner records that nothing scanned the file", async () => {
    const stage = await staged();
    const bytes = dxfLike("UNSCANNED");
    const digest = sha256Of(bytes);
    const answer = await upload(stage.person, stage.projectId, bytes, `unscanned-${randomUUID().slice(0, 8)}.dxf`);
    expect(answer.body.complete, "a file in a format the product reads completes").toBe(true);
    expect(verdictOf(stage.person.tenantId, digest), "the default hook answers skipped, and the row says so").toBe("skipped");
  }, 300_000);

  test("a scanner that passes the file has its verdict recorded on the stored content", async () => {
    const stage = await staged();
    await scanningWith("clean");
    const bytes = dxfLike("CLEAN");
    const digest = sha256Of(bytes);
    const answer = await upload(stage.person, stage.projectId, bytes, `clean-${randomUUID().slice(0, 8)}.dxf`);
    expect(answer.body.complete, "a file the scanner passed completes").toBe(true);
    expect(verdictOf(stage.person.tenantId, digest), "the scanner's own verdict is what the row records").toBe("clean");
    expect(await stored(stage.person.tenantId, digest), "and the bytes stand at their address").not.toBeNull();
  }, 300_000);

  test("SCAN_REJECTED — a scanner that rejects the file has it stored nowhere", async () => {
    const stage = await staged();
    await scanningWith("infected");
    const bytes = dxfLike("INFECTED");
    const digest = sha256Of(bytes);
    const answer = await upload(stage.person, stage.projectId, bytes, `infected-${randomUUID().slice(0, 8)}.dxf`);

    await expectRegistered(answer, "SCAN_REJECTED", 422);
    expect(rowsFor("files", stage.person.tenantId, digest), "a rejected file records no files row").toBe(0);
    expect(rowsFor("drawings", stage.person.tenantId, digest), "and no drawings row").toBe(0);
    expect(await stored(stage.person.tenantId, digest), "and no object at its content address").toBeNull();
    expect(existsSync(stagingPath(stage.person.tenantId, answer.uploadId)), "the staged bytes are discarded").toBe(false);

    const state = sqlValue(`select state::text from uploads where ${ident(TENANT_COLUMN)} = ${lit(stage.person.tenantId)} and upload_id = ${lit(answer.uploadId)};`);
    expect(state, "the session ends refused, and stays on the record saying so").toBe("refused");
  }, 300_000);
});

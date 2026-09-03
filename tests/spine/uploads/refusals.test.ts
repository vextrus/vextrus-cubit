/**
 * AC-3 — validation refuses by name and stores nothing (R-SPINE-020, Q-12, Q-07).
 *
 * Every case here is exercised by the registered code's own name, which is what Q-07 counts: the
 * message and the remedy are read out of `REFUSALS` and compared, so a code whose copy drifts from
 * its register entry fails here rather than reaching a person.
 *
 * "Stores nothing" is graded at the three places a byte could hide: the `files` and `drawings`
 * rows for that content, the object at its address under the tenant's prefix, and the staging copy
 * the interfaces put at `<STORAGE_ROOT>/.uploads/<tenantId>/<uploadId>`.
 *
 * On the `uploads` row: a door that refuses BEFORE a session exists leaves no row at all, and that
 * is asserted for each of those cases. A refusal at completion is the other shape — AC-5 binds the
 * scan refusal to an `uploads` row standing at `state: "refused"` — so the completion cases below
 * assert the session did not end `stored`, which is the same claim ("nothing was stored") stated
 * where the row genuinely stands.
 *
 * A refusal is not a fault (ARCH-03): the fault sink is watched across the whole file and must
 * receive nothing.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import {
  closeStage,
  createUpload,
  dxfLike,
  enrol,
  expectRegistered,
  fixture,
  openStage,
  patchChunk,
  productModule,
  rowsFor,
  sha256Of,
  sqlValue,
  stageProject,
  stagingPath,
  stored,
  uploadStatus,
  UPLOADS_MODULE,
  UPLOAD_ID_ROUTE,
  UPLOAD_ROUTE,
  type Person,
} from "./support/upload-stage";

const DECLARED = [UPLOADS_MODULE, UPLOAD_ROUTE, UPLOAD_ID_ROUTE] as const;

/** The seam whose sink a refusal must never reach. */
const FAULTS_MODULE = "src/core/faults/report.ts";

interface Staged {
  person: Person;
  stranger: Person;
  projectId: string;
  strangerProjectId: string;
}

let pending: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  pending ??= (async () => {
    for (const relative of DECLARED) await productModule(relative);
    await openStage();
    const person = await enrol("refused");
    const stranger = await enrol("stranger");
    return {
      person,
      stranger,
      projectId: stageProject(person.tenantId),
      strangerProjectId: stageProject(stranger.tenantId, "A workspace of somebody else's"),
    };
  })();
  return pending;
}

/** Every fault reported while this file runs — a refusal that reports one is a defect (ARCH-03). */
const faults: unknown[] = [];
let restoreSink: ((record: unknown) => void) | undefined;

beforeAll(async () => {
  const seam = await productModule<{ setFaultSink(sink: (record: unknown) => void): (record: unknown) => void }>(FAULTS_MODULE);
  restoreSink = seam.setFaultSink((record) => faults.push(record));
});

afterAll(async () => {
  if (restoreSink !== undefined) {
    const seam = await productModule<{ setFaultSink(sink: (record: unknown) => void): (record: unknown) => void }>(FAULTS_MODULE);
    seam.setFaultSink(restoreSink);
  }
  await closeStage();
});

/** How many upload sessions this workspace holds under a presented name. */
function sessionsNamed(tenantId: string, name: string): number {
  return Number(sqlValue(`select count(*)::text from uploads where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and name = ${lit(name)};`));
}

/** Nothing of this content is anywhere: no row, no object, no staging copy. */
async function nothingStored(tenantId: string, digest: string, uploadId: string | undefined): Promise<void> {
  expect(rowsFor("files", tenantId, digest), "a refused upload records no files row").toBe(0);
  expect(rowsFor("drawings", tenantId, digest), "a refused upload records no drawings row").toBe(0);
  expect(await stored(tenantId, digest), "a refused upload leaves no object at its content address").toBeNull();
  if (uploadId !== undefined && uploadId !== "") {
    expect(existsSync(stagingPath(tenantId, uploadId)), "the staged bytes of a refused upload are discarded").toBe(false);
  }
}

describe("AC-3 — the five new codes and the two the session owes, each by name", () => {
  test("AC-3: FILE_TOO_LARGE — a size above the ceiling never opens a session", async () => {
    const stage = await staged();
    const uploads = await productModule<{ UPLOAD_MAX_BYTES: number }>(UPLOADS_MODULE);
    expect(uploads.UPLOAD_MAX_BYTES, "the ceiling R-SPINE-020 states, in bytes (interfaces)").toBe(500 * 1024 * 1024);

    const name = `too-large-${randomUUID().slice(0, 8)}.dxf`;
    const answer = await createUpload(stage.person.cookie, { projectId: stage.projectId, name, size: uploads.UPLOAD_MAX_BYTES + 1, sha256: sha256Of(dxfLike("TOO-LARGE")) });
    await expectRegistered(answer, "FILE_TOO_LARGE", 413);
    expect(sessionsNamed(stage.person.tenantId, name), "a file above the ceiling opens no session at all").toBe(0);
  }, 300_000);

  test("AC-3: FORMAT_NOT_ACCEPTED — a name the product does not read is refused before any byte", async () => {
    const stage = await staged();
    const bytes = dxfLike("EXE");
    const answer = await createUpload(stage.person.cookie, { projectId: stage.projectId, name: "plan.exe", size: bytes.length, sha256: sha256Of(bytes) });
    await expectRegistered(answer, "FORMAT_NOT_ACCEPTED", 415);
    expect(sessionsNamed(stage.person.tenantId, "plan.exe"), "a name outside the accepted formats opens no session").toBe(0);
  }, 300_000);

  test("AC-3: FORMAT_NOT_ACCEPTED — content that is not what the name declares is refused at completion", async () => {
    const stage = await staged();
    const bytes = fixture("rcc6/rcc6.pdf");
    const digest = sha256Of(bytes);
    const name = `mislabelled-${randomUUID().slice(0, 8)}.dxf`;
    const created = await createUpload(stage.person.cookie, { projectId: stage.projectId, name, size: bytes.length, sha256: digest });
    expect(created.status, "a DXF name and a plausible size open a session — the content is only knowable once it arrives").toBe(201);
    const uploadId = created.body.uploadId ?? "";

    const answer = await patchChunk(stage.person.cookie, uploadId, 0, bytes);
    await expectRegistered(answer, "FORMAT_NOT_ACCEPTED", 415);
    await nothingStored(stage.person.tenantId, digest, uploadId);
    const state = sqlValue(`select state::text from uploads where ${ident(TENANT_COLUMN)} = ${lit(stage.person.tenantId)} and upload_id = ${lit(uploadId)};`);
    expect(state, "the refused session did not end stored").not.toBe("stored");
  }, 300_000);

  test("AC-3: DIGEST_MISMATCH — bytes that do not hash to what the browser declared are discarded", async () => {
    const stage = await staged();
    const bytes = dxfLike("HONEST");
    const declared = sha256Of(dxfLike("SOMETHING-ELSE"));
    const actual = sha256Of(bytes);
    expect(declared, "the declared digest is a digest of other bytes").not.toBe(actual);

    const name = `mismatch-${randomUUID().slice(0, 8)}.dxf`;
    const created = await createUpload(stage.person.cookie, { projectId: stage.projectId, name, size: bytes.length, sha256: declared });
    expect(created.status, "a session opens on what the client declares").toBe(201);
    const uploadId = created.body.uploadId ?? "";

    const answer = await patchChunk(stage.person.cookie, uploadId, 0, bytes);
    await expectRegistered(answer, "DIGEST_MISMATCH", 409);
    await nothingStored(stage.person.tenantId, actual, uploadId);
    await nothingStored(stage.person.tenantId, declared, uploadId);
  }, 300_000);

  test("AC-3: WORKSPACE_PERMISSION_NOT_HELD — a project of another workspace, and a project that is nobody's", async () => {
    const stage = await staged();
    const bytes = dxfLike("FOREIGN");
    const draft = { name: `foreign-${randomUUID().slice(0, 8)}.dxf`, size: bytes.length, sha256: sha256Of(bytes) };

    const foreign = await createUpload(stage.person.cookie, { projectId: stage.strangerProjectId, ...draft });
    await expectRegistered(foreign, "WORKSPACE_PERMISSION_NOT_HELD", 403);

    const unknown = await createUpload(stage.person.cookie, { projectId: randomUUID(), ...draft });
    await expectRegistered(unknown, "WORKSPACE_PERMISSION_NOT_HELD", 403);
    expect(sessionsNamed(stage.stranger.tenantId, draft.name), "no session is opened in a workspace the caller is no member of").toBe(0);
    expect(sessionsNamed(stage.person.tenantId, draft.name), "and none in their own, for a project that is not theirs").toBe(0);
  }, 300_000);

  test("AC-3: SIGNED_OUT — no session, no upload, at either door", async () => {
    const stage = await staged();
    const bytes = dxfLike("ANONYMOUS");
    const name = `anonymous-${randomUUID().slice(0, 8)}.dxf`;
    const created = await createUpload(null, { projectId: stage.projectId, name, size: bytes.length, sha256: sha256Of(bytes) });
    await expectRegistered(created, "SIGNED_OUT", 401);
    expect(sessionsNamed(stage.person.tenantId, name), "a request carrying no session opens none").toBe(0);

    const probed = await uploadStatus(null, randomUUID());
    await expectRegistered(probed, "SIGNED_OUT", 401);
  }, 300_000);

  test("AC-3: not one of those refusals was a fault (ARCH-03)", async () => {
    await staged();
    expect(faults, "a refusal is an answer the product means; the fault sink hears nothing from these doors").toEqual([]);
  }, 300_000);
});

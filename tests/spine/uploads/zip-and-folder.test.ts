/**
 * AC-2 — an archive is expanded into the drawings it holds, and a dropped folder keeps its paths
 * (R-SPINE-020).
 *
 * The archive is written by `tests/support/zip.ts` — stored method, one directory entry, one member
 * the product does not read — and handed to the shipped doors as a single upload named `set.zip`.
 * What the acceptance grades is what comes back and what is left in the store: two drawings under
 * their member paths verbatim, one skipped member named with the registered reason, and no trace of
 * the container itself, which is packaging and not a drawing.
 *
 * The member bytes are built from the corpus fixture's own head (`dxfLike`), so "the content says
 * what the name says" is true of them for the same reason it is true of `fixtures/rcc6/rcc6.dxf`.
 */
import { afterAll, describe, expect, test } from "vitest";
import { buildZip } from "../../support/zip";
import {
  closeStage,
  createUpload,
  dxfLike,
  enrol,
  openStage,
  patchChunk,
  productModule,
  rowsFor,
  sha256Of,
  sqlValue,
  stageProject,
  stored,
  UPLOADS_MODULE,
  UPLOAD_ID_ROUTE,
  UPLOAD_ROUTE,
  type Person,
} from "./support/upload-stage";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";

const DECLARED = [UPLOADS_MODULE, UPLOAD_ROUTE, UPLOAD_ID_ROUTE] as const;

/** The two members the product must read, and the one it must not. */
const S101 = "structural/S-101.dxf";
const S102 = "structural/S-102.dxf";
const NOTES = "notes.txt";

interface Staged {
  person: Person;
  projectId: string;
}

let pending: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  pending ??= (async () => {
    for (const relative of DECLARED) await productModule(relative);
    await openStage();
    const person = await enrol("archivist");
    return { person, projectId: stageProject(person.tenantId) };
  })();
  return pending;
}

/** Send a whole file in one chunk and answer what the last PATCH said. */
async function uploadWhole(person: Person, projectId: string, name: string, bytes: Uint8Array): Promise<{ created: number; complete: Awaited<ReturnType<typeof patchChunk>> }> {
  const created = await createUpload(person.cookie, { projectId, name, size: bytes.length, sha256: sha256Of(bytes) });
  expect(created.status, `POST /api/upload answers 201 for ${name}`).toBe(201);
  const complete = await patchChunk(person.cookie, created.body.uploadId ?? "", 0, bytes);
  return { created: created.status, complete };
}

afterAll(async () => {
  await closeStage();
});

describe("AC-2 — a .zip is expanded, and a folder drop's path is the drawing's name", () => {
  test("AC-2: set.zip records one drawing per accepted member, skips the rest, and stores no container", async () => {
    const stage = await staged();
    const members = {
      [S101]: dxfLike("S-101"),
      [S102]: dxfLike("S-102"),
      [NOTES]: new TextEncoder().encode("Site notes: the podium slab pour is on the 14th.\n"),
    };
    expect(sha256Of(members[S101] as Uint8Array), "the two sheets are two distinct contents").not.toBe(sha256Of(members[S102] as Uint8Array));

    const zip = buildZip([
      { path: "structural/", directory: true },
      { path: S101, bytes: members[S101] },
      { path: S102, bytes: members[S102] },
      { path: NOTES, bytes: members[NOTES] },
    ]);
    const zipDigest = sha256Of(zip);

    const { complete } = await uploadWhole(stage.person, stage.projectId, "set.zip", zip);
    expect(complete.status, "the archive's last byte is answered under 200").toBe(200);
    expect(complete.body.complete, "an archive whose bytes all arrived is complete").toBe(true);

    const drawings = complete.body.drawings ?? [];
    expect(
      drawings.map((drawing) => drawing.name).sort(),
      "exactly the two members the product reads are recorded, under their member paths verbatim — a directory entry is not a drawing",
    ).toEqual([S101, S102]);

    for (const path of [S101, S102] as const) {
      const drawing = drawings.find((candidate) => candidate.name === path);
      const bytes = members[path] as Uint8Array;
      const digest = sha256Of(bytes);
      expect(drawing?.sha256, `${path} is addressed by the digest of its own bytes, not the archive's`).toBe(digest);
      expect(drawing?.format, `${path} is read as the format its name and content agree on`).toBe("dxf");
      expect(drawing?.duplicate, `${path} is stored for the first time here`).toBe(false);
      const held = await stored(stage.person.tenantId, digest);
      expect(Array.from(held ?? []), `${path}'s own bytes stand at its own address (SEAM-STORAGE)`).toEqual(Array.from(bytes));
    }

    expect(complete.body.skipped, "the member the product does not read is named, with the registered reason it was not taken").toEqual([{ name: NOTES, reason: "FORMAT_NOT_ACCEPTED" }]);

    /* --- the container is packaging: it is neither a file nor a drawing, and it is not stored --- */
    expect(rowsFor("files", stage.person.tenantId, zipDigest), "no files row carries the archive's own content address").toBe(0);
    expect(rowsFor("drawings", stage.person.tenantId, zipDigest), "no drawings row carries the archive's own content address").toBe(0);
    expect(await stored(stage.person.tenantId, zipDigest), "the archive itself is not an object in the store").toBeNull();
  }, 300_000);

  test("AC-2: a folder drop's relative path is the name the drawing row carries", async () => {
    const stage = await staged();
    const bytes = dxfLike("A-01");
    const digest = sha256Of(bytes);
    const { complete } = await uploadWhole(stage.person, stage.projectId, "arch/A-01.dxf", bytes);
    expect(complete.body.complete, "the folder member's upload completes").toBe(true);
    expect(complete.body.drawings?.[0]?.name, "the answer carries the relative path it was presented under").toBe("arch/A-01.dxf");

    const recorded = sqlValue(`select name from drawings where ${ident(TENANT_COLUMN)} = ${lit(stage.person.tenantId)} and sha256 = ${lit(digest)};`);
    expect(recorded, "the drawing row records the relative path verbatim — which folder a sheet came out of is drawing information").toBe("arch/A-01.dxf");
  }, 300_000);
});

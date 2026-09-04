/**
 * The stage J-011 walks its sheet on (test contract: `stageSyntheticSheet`).
 *
 * Mechanics only — nothing here judges the product. A person enrols, verifies and signs in through
 * the shipped doors exactly as J-010 does, makes a project on S-Home, and uploads a drawing through
 * `/api/upload`; then the reading of that drawing is recorded in-process by the shipped ingest job,
 * with a stand-in for the `cad/` extractor that emits the synthetic 100 000-entity sheet
 * (`tests/takeoff/viewer/support/synthetic-graph.ts`, the one fixture identity — Q-17). Nothing here
 * invents a second way to record an ingest or to store an object (ARCH-02): both are the product's
 * own modules, driven under the journey lane's database and the served product's storage root.
 *
 * Two orderings matter: `DATABASE_URL` is pointed at the journeys' database and the storage root is
 * left exactly as the served product resolves it (`STORAGE_ROOT`, else `<cwd>/storage`) BEFORE any
 * product module is imported, and the drawing exists before the reading of it is recorded.
 *
 * This file imports no test framework but Playwright: it runs inside the journey process, where a
 * unit lane's `expect` has no runner to bind to.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { SHomePage } from "../pages/s-home.page";
import { ShellPage } from "../pages/shell.page";
import { UploadPage } from "../pages/upload.page";
import { newestMail } from "../support/outbox";
import { e2eDatabaseUrl } from "../support/scratch-db";
import { SYNTHETIC_LAYOUT, syntheticArtifact, syntheticEntityGraph, syntheticLayerNames } from "../../takeoff/viewer/support/synthetic-graph";

/** The journeys' own database, stated before a product module opens a pool. */
process.env["DATABASE_URL"] = e2eDatabaseUrl();

/** The name the ingest client's command prefix is read from (SEAM-CAD). */
const CAD_COMMAND_VAR = "CUBIT_CAD_COMMAND";

/** The drawing the sheet is a reading of: one of the committed corpus, uploaded through the door. */
const DRAWING_FIXTURE = join("cad", "tests", "fixtures", "basic.dxf");

/** A marker no two runs collide on. */
const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/** What a staged sheet is, as a journey addresses it. */
export type StagedSheet = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  layoutName: string;
  entityCount: number;
  layerNames: string[];
};

/** Import a product module by repo-relative path, saying which file is missing when one is. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(process.cwd(), relative);
  if (!existsSync(absolute)) throw new Error(`${relative} is missing from the checkout — the product does not provide it yet`);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/** A stand-in for the `cad/` CLI that emits a prepared artifact at the path behind `--out`. */
function standInExtractor(artifact: Uint8Array): string {
  const home = mkdtempSync(join(tmpdir(), "cubit-viewer-cad-"));
  const payload = join(home, "artifact.json");
  const script = join(home, "cli.cjs");
  writeFileSync(payload, artifact);
  writeFileSync(
    script,
    [
      'const fs = require("node:fs");',
      "const argv = process.argv.slice(2);",
      'const at = argv.indexOf("--out");',
      `if (at >= 0 && argv[at + 1] !== undefined) fs.copyFileSync(${JSON.stringify(payload)}, argv[at + 1]);`,
      "process.exit(0);",
      "",
    ].join("\n"),
  );
  return `${process.execPath} ${script}`;
}

/**
 * A member of a fresh workspace, a project of theirs, a drawing uploaded through the shipped door,
 * and a recorded reading of that drawing which is the synthetic sheet of the size asked for.
 */
export async function stageSyntheticSheet(page: Page, options: { entities: number }): Promise<StagedSheet> {
  const auth = new SAuthPage(page);
  const shell = new ShellPage(page);
  const home = new SHomePage(page);
  const uploads = new UploadPage(page);

  const email = `j011-${RUN}@cubit.test`;
  const password = `viewer-journey-${RUN}`;
  const project = `Sattva Viewer ${RUN}`;

  /* --- this journey's own identity, so its sheet never lands in another spec's workspace --- */
  await auth.open(S_AUTH.signUp);
  await auth.signUpWith(email, password, `Viewer ${RUN}`);
  await auth.expectNotice();
  const verifyMail = await newestMail(email, "verify-email");
  await auth.openWithToken(S_AUTH.verify, verifyMail.token);
  await auth.expectNotice();
  await auth.open(S_AUTH.signIn);
  await auth.signInWith(email, password);

  await shell.workspaceDoor.click();
  await page.waitForURL(/\/t\/[0-9a-f-]{36}$/);
  const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
  expect(tenantId, "the workspace door leads to the workspace this person holds").not.toBe("");

  /* --- a project of that workspace, made through the shipped screen --- */
  await home.createWith({ name: project, code: `SVC-${RUN.slice(0, 4)}`, client: "Sattva Holdings", district: "Dhaka", buildingType: 1, storeys: "12" });
  const card = home.cardNamed(project);
  await expect(card, "the created project stands on S-Home").toBeVisible();
  const projectId = (await card.getAttribute("data-project")) ?? "";
  expect(projectId, "the card names the project it is for").not.toBe("");

  /* --- a drawing, through the shipped upload door, in the browser's own session --- */
  const bytes = readFileSync(join(process.cwd(), DRAWING_FIXTURE));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const name = `viewer-${RUN}.dxf`;
  const created = await uploads.create({ projectId, name, size: bytes.length, sha256 });
  expect(created.status, "POST /api/upload opens a session for a member of the project's workspace").toBe(201);
  const uploadId = created.body.uploadId ?? "";
  const chunkBytes = created.body.chunkBytes ?? bytes.length;

  let sent = 0;
  let last = created;
  while (sent < bytes.length) {
    const end = Math.min(sent + chunkBytes, bytes.length);
    last = await uploads.send(uploadId, sent, bytes.subarray(sent, end));
    expect(last.status, `the chunk at ${sent} is taken`).toBe(200);
    sent = end;
  }
  expect(last.body.complete, "the last byte completes the upload").toBe(true);
  const drawingId = uploads.onlyDrawing(last).drawingId;

  /* --- the reading of it: the shipped job, with the synthetic sheet standing in for the extractor --- */
  const artifact = syntheticArtifact({ entities: options.entities, layers: 4, seed: 11 });
  const graph = syntheticEntityGraph({ entities: 1, layers: 4, seed: 11 });
  const command = standInExtractor(artifact);
  const held = process.env[CAD_COMMAND_VAR];
  process.env[CAD_COMMAND_VAR] = command;
  try {
    const job = await productModule<{ runIngestJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> }>(
      "src/modules/takeoff/ingest/job.ts",
    );
    const storage = (await productModule<{ uploadStorage: () => unknown }>("src/modules/spine/uploads/index.ts")).uploadStorage();
    await job.runIngestJob(
      { tenantId, drawingId, requestedBy: randomUUID(), declared: null },
      { jobId: randomUUID(), tempDir: mkdtempSync(join(tmpdir(), "cubit-viewer-ingest-")), step: async () => undefined },
      { storage },
    );
  } finally {
    if (held === undefined) delete process.env[CAD_COMMAND_VAR];
    else process.env[CAD_COMMAND_VAR] = held;
  }

  const ingest = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ artifactSha256: string } | null> }>(
    "src/modules/takeoff/ingest/index.ts",
  );
  const record = await ingest.ingestRecordOf({ tenantId, drawingId });
  expect(record, "staging the sheet left an ingest record — a sheet is drawn from a recorded reading").not.toBeNull();

  return {
    tenantId,
    projectId,
    drawingId,
    layoutName: graph.layouts[0]?.name ?? SYNTHETIC_LAYOUT,
    entityCount: options.entities,
    layerNames: syntheticLayerNames(4),
  };
}

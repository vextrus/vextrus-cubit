/**
 * The stage J-021's views/grid leg walks its sheet on (test contract: `stagePartitionedSheet`).
 *
 * Mechanics only — nothing here judges the product. A person enrols, verifies and signs in through
 * the shipped doors exactly as J-011's stage does, makes a project on S-Home and uploads a drawing
 * through `/api/upload`; then the reading of that drawing is recorded in-process by the shipped
 * ingest job with a stand-in for the `cad/` extractor, and the shipped partition job is run over
 * that reading with a recorded model answer minted for every caption the grammar cannot read. Both
 * jobs are the product's own modules, driven under the journey lane's database and the served
 * product's storage root (ARCH-02): nothing here invents a second way to record an ingest, to store
 * an object or to partition one.
 *
 * The `viewer-partition-plan` artifact is authored here rather than imported from
 * `tests/takeoff/viewer-partition-overlay/support/overlay-stage.ts`: that file is the Verifier's,
 * and it opens with `import { expect } from "vitest"` — a unit lane's `expect` has no runner to bind
 * to inside the journey process. The shape it builds is the seam's own EntityGraph v2, which the
 * product's Zod mirror is the single judge of.
 *
 * Two orderings matter, as they do for every stage of this lane: `DATABASE_URL` is pointed at the
 * journeys' database and the storage root is left exactly as the served product resolves it BEFORE
 * any product module is imported, and the drawing exists before the reading of it is recorded.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, ROLE_MIGRATE, TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { ident, lit, run, withSession } from "../../../db/__tests__/support/live-sql";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { SHomePage } from "../pages/s-home.page";
import { ShellPage } from "../pages/shell.page";
import { UploadPage } from "../pages/upload.page";
import { newestMail } from "../support/outbox";
import { e2eDatabaseUrl } from "../support/scratch-db";

/** The journeys' own database, stated before a product module opens a pool. */
process.env["DATABASE_URL"] = e2eDatabaseUrl();

/** The names the two seams read their stand-ins from (SEAM-CAD, L-AI-01). */
const CAD_COMMAND_VAR = "CUBIT_CAD_COMMAND";
const FIXTURE_ROOT_VAR = "CUBIT_MODEL_FIXTURE_ROOT";

/** The drawing bytes are only sniffed for format — the reading of them is the artifact below. */
const DRAWING_BYTES = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n";

/** A marker no two runs collide on. */
const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/** The spaces the built artifact carries, spelled as the ingest seam spells them. */
export const MODEL_SPACE = "Model";
const PAPER_SPACE = "SHEET-1";

/** The text heights a caption and a grid label are drawn at (L-CAD-06/07's evidence). */
const CAPTION_HEIGHT = 5;
const LABEL_HEIGHT = 1;

/** The type spellings this journey leans on, as L-CAD-06's closed vocabulary spells them. */
export const UNTYPED = "UNTYPED";
export const DETAIL = "DETAIL";
export const LEGEND_NOTES = "LEGEND_NOTES";

/** The two captions the shipped grammar reads, and the three no rule of it reads. */
const CAPTION_PLAN = "TYPICAL FLOOR PLAN";
const CAPTION_SCHEDULE = "COLUMN SCHEDULE";
export const SILENT_CAPTIONS: readonly string[] = Object.freeze(["XQZ 77", "XQZ 78", "XQZ 79"]);

/** What each silent caption is proposed as: two of one class, one of another — so two groups stand. */
export const PROPOSED_AS: Readonly<Record<string, string>> = Object.freeze({
  "XQZ 77": DETAIL,
  "XQZ 78": DETAIL,
  "XQZ 79": LEGEND_NOTES,
});

/** The layers the artifact draws on — census data, never environment names (L-CAD-07). */
const LAYER_CAPTIONS = "CAPTIONS";
const LAYER_BUBBLES = "GRID-BUBBLES";
const LAYER_LABELS = "GRID-LABELS";
const LAYER_LINES = "GRID-LINES";

/** The DXF types the artifact is built from. */
const TYPE_TEXT = "TEXT";
const TYPE_LINE = "LINE";
const TYPE_RING = "LWPOLYLINE";

/** A colour every built entity carries: channels, never a spelled colour. */
const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" };

/** The bubble radius the plan draws, and how many vertices a round ring is flattened into. */
const RADIUS = 3;
const VERTICES = 16;

/** Where each cluster stands: far enough apart that no caption reaches another's geometry. */
const PLAN_AT: readonly [number, number] = [0, 0];
const SCHEDULE_AT: readonly [number, number] = [600, 0];
const BARE_PLAN_AT: readonly [number, number] = [1200, 0];
const SILENT_AT: readonly (readonly [number, number])[] = [
  [1800, 0],
  [2400, 0],
  [3000, 0],
];

/** The lawful bubbles of the bubbled plan: three letters spread along x, two numerals along y. */
const PLAN_BUBBLES: readonly { text: string; centre: readonly [number, number] }[] = [
  { text: "A", centre: [0, -30] },
  { text: "B", centre: [20, -30] },
  { text: "C", centre: [50, -30] },
  { text: "1", centre: [-30, -10] },
  { text: "2", centre: [-30, -25] },
];

/** One drawn record of the built artifact, in the shape the seam's mirror validates (L-CAD-05). */
type Drawn = {
  key: string;
  type: string;
  space: string;
  layer: string;
  colour: typeof CHANNELS;
  text?: string;
  height?: number;
  points?: number[][];
  closed?: boolean;
};

/** What the built artifact carries, so a journey derives its expectations from it (B-19). */
type BuiltArtifact = { json: string; anchorOf: ReadonlyMap<string, string> };

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/** A closed ring of evenly spaced points about a centre — a circle, as the seam carries one. */
function ringPoints(centre: readonly [number, number], radius: number, vertices: number): number[][] {
  return Array.from({ length: vertices }, (_unused, index) => {
    const angle = (2 * Math.PI * index) / vertices;
    return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
  });
}

/**
 * The `viewer-partition-plan` artifact: a model space carrying a layout plan with lawful grid
 * bubbles, a schedule (a view no grid may be read off), a second layout plan nobody bubbled (the
 * georeference that defers), and three captions the grammar cannot read — plus a paper layout,
 * which L-CAD-06 does not partition at all.
 */
function buildPartitionPlan(): BuiltArtifact {
  let ordinal = 0;
  const next = (): string => handle((ordinal += 1));
  const entities: Drawn[] = [];
  const anchorOf = new Map<string, string>();

  const caption = (text: string, at: readonly [number, number]): void => {
    const key = next();
    if (!anchorOf.has(text)) anchorOf.set(text, key);
    entities.push({ key, type: TYPE_TEXT, space: MODEL_SPACE, layer: LAYER_CAPTIONS, colour: CHANNELS, text, height: CAPTION_HEIGHT, points: [[at[0], at[1]]] });
  };

  const bubble = (spec: { text: string; centre: readonly [number, number] }): void => {
    entities.push({ key: next(), type: TYPE_RING, space: MODEL_SPACE, layer: LAYER_BUBBLES, colour: CHANNELS, closed: true, points: ringPoints(spec.centre, RADIUS, VERTICES) });
    entities.push({ key: next(), type: TYPE_TEXT, space: MODEL_SPACE, layer: LAYER_LABELS, colour: CHANNELS, text: spec.text, height: LABEL_HEIGHT, points: [[spec.centre[0], spec.centre[1]]] });
  };

  const line = (from: readonly [number, number], to: readonly [number, number]): void => {
    entities.push({ key: next(), type: TYPE_LINE, space: MODEL_SPACE, layer: LAYER_LINES, colour: CHANNELS, points: [[from[0], from[1]], [to[0], to[1]]] });
  };

  caption(CAPTION_PLAN, PLAN_AT);
  for (const spec of PLAN_BUBBLES) bubble(spec);
  line([-5, -30], [55, -30]);
  line([-30, -5], [-30, -30]);
  line([0, -35], [0, -5]);

  caption(CAPTION_SCHEDULE, SCHEDULE_AT);
  line([595, -5], [640, -5]);
  line([595, -15], [640, -15]);

  caption(CAPTION_PLAN, BARE_PLAN_AT);
  line([1195, -5], [1250, -5]);
  line([1195, -15], [1250, -15]);
  line([1210, -25], [1210, -3]);

  SILENT_CAPTIONS.forEach((text, at) => {
    const spot = SILENT_AT[at] ?? [3600 + at * 600, 0];
    caption(text, spot);
    line([spot[0] - 5, spot[1] - 5], [spot[0] + 25, spot[1] - 5]);
    line([spot[0] - 5, spot[1] - 15], [spot[0] + 25, spot[1] - 15]);
  });

  entities.push({ key: next(), type: TYPE_TEXT, space: PAPER_SPACE, layer: "TITLEBLOCK", colour: CHANNELS, text: "S-101 GENERAL ARRANGEMENT", height: 3, points: [[5, 5]] });
  entities.push({ key: next(), type: TYPE_LINE, space: PAPER_SPACE, layer: "TITLEBLOCK", colour: CHANNELS, points: [[0, 0], [297, 210]] });

  const graph = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-journey", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: { min: [-60, -140], max: [3700, 20] }, strays_rejected: 0 },
      { name: PAPER_SPACE, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 },
    ],
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: [],
    counters: [],
  };

  return { json: JSON.stringify(graph), anchorOf };
}

/** Import a product module by repo-relative path, saying which file is missing when one is. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(process.cwd(), relative);
  if (!existsSync(absolute)) throw new Error(`${relative} is missing from the checkout — the product does not provide it yet`);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/** A stand-in for the `cad/` CLI that emits a prepared artifact at the path behind `--out`. */
function standInExtractor(artifact: string): string {
  const home = mkdtempSync(join(tmpdir(), "cubit-partition-cad-"));
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

/** Run `body` with an environment name replaced, and put the environment back afterwards. */
async function withEnv<T>(name: string, value: string, body: () => Promise<T>): Promise<T> {
  const held = process.env[name];
  process.env[name] = value;
  try {
    return await body();
  } finally {
    if (held === undefined) delete process.env[name];
    else process.env[name] = held;
  }
}

/** The reason every statement this stage reads under is recorded with — attributable, like any other. */
const STAGE_REASON = "test: read the partition J-021 walks";

/** The journeys' own database, addressed as its owner — the role a stage speaks as (SEAM-TENANT). */
function ownerUrl(): string {
  const url = new URL(BOOTSTRAP_URL);
  url.username = ROLE_MIGRATE;
  url.password = ROLE_MIGRATE;
  url.pathname = `/${new URL(e2eDatabaseUrl()).pathname.replace(/^\//, "")}`;
  return url.toString();
}

/** One read of the lane database, as one session — the journey's audit read of what the job stored. */
export function laneRows(script: string): string[][] {
  return run(ownerUrl(), withSession({ [GUC_SYSTEM_REASON]: STAGE_REASON }, script));
}

/** One stored view, as `partition_views` holds it and as the panel must show it (AC-2, AC-3). */
export type StoredView = {
  viewKey: string;
  type: string;
  reason: string | null;
  caption: string;
  proposedType: string | null;
};

/** One stored axis, as `grids` holds it and as the panel must list it (AC-2). */
export type StoredAxis = { viewKey: string; family: string; label: string; axis: string; bubbleKey: string };

/** What a staged partitioned sheet is, as this journey addresses it. */
export type StagedPartitionedSheet = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  layoutName: string;
  ingestId: string;
  views: StoredView[];
  axes: StoredAxis[];
};

/** Every `partition_views` row of one ingest, in view-key order — the store's own word (B-19). */
export function storedViews(tenantId: string, ingestId: string): StoredView[] {
  return laneRows(
    `select view_key, type, coalesce(reason, ''), caption, coalesce(proposed_type, '')
       from partition_views
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
      order by view_key;`,
  ).map((row) => ({
    viewKey: row[0] ?? "",
    type: row[1] ?? "",
    reason: (row[2] ?? "") === "" ? null : (row[2] as string),
    caption: row[3] ?? "",
    proposedType: (row[4] ?? "") === "" ? null : (row[4] as string),
  }));
}

/** Every `grids` row of one ingest, in bubble-key order. */
export function storedAxes(tenantId: string, ingestId: string): StoredAxis[] {
  return laneRows(
    `select view_key, family, label, axis, bubble_key from grids
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
      order by bubble_key;`,
  ).map((row) => ({ viewKey: row[0] ?? "", family: row[1] ?? "", label: row[2] ?? "", axis: row[3] ?? "", bubbleKey: row[4] ?? "" }));
}

/** Every `grid_deferrals` row of one ingest, in view-key order. */
export function storedDeferrals(tenantId: string, ingestId: string): { viewKey: string; reason: string }[] {
  return laneRows(
    `select view_key, reason from grid_deferrals
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
      order by view_key;`,
  ).map((row) => ({ viewKey: row[0] ?? "", reason: row[1] ?? "" }));
}

/** Every `view_type_confirmations` row a confirmation left, by the view it names. */
export function confirmationsOf(tenantId: string, ingestId: string): { viewKey: string; type: string; actId: string }[] {
  return laneRows(
    `select view_key, type, act_id::text from view_type_confirmations
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
      order by view_key;`,
  ).map((row) => ({ viewKey: row[0] ?? "", type: row[1] ?? "", actId: row[2] ?? "" }));
}

/**
 * A member of a fresh workspace, a project of theirs, a drawing whose recorded reading is the
 * `viewer-partition-plan` artifact, and a partition rebuilt over that reading — with a recorded
 * answer minted for each caption the grammar could not read, filed under the request the product
 * itself composes for that caption on that anchor (L-AI-01: nothing here knows how one is built).
 */
export async function stagePartitionedSheet(page: Page, options: { label?: string } = {}): Promise<StagedPartitionedSheet> {
  const auth = new SAuthPage(page);
  const shell = new ShellPage(page);
  const home = new SHomePage(page);
  const uploads = new UploadPage(page);

  // Per call, not per module: a worker that kept this module between two specs would otherwise
  // enrol the same address twice.
  const mark = `${RUN}${randomUUID().slice(0, 6)}`;
  const label = options.label ?? "partition";
  const email = `j021-${mark}@cubit.test`;
  const password = `partition-journey-${mark}`;
  const project = `Sattva Partition ${mark}`;

  /* --- this journey's own identity, so its sheet never lands in another spec's workspace --- */
  await auth.open(S_AUTH.signUp);
  await auth.signUpWith(email, password, `Partition ${RUN}`);
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
  await home.createWith({ name: project, code: `SPC-${RUN.slice(0, 4)}`, client: "Sattva Holdings", district: "Dhaka", buildingType: 1, storeys: "12" });
  const card = home.cardNamed(project);
  await expect(card, "the created project stands on S-Home").toBeVisible();
  const projectId = (await card.getAttribute("data-project")) ?? "";
  expect(projectId, "the card names the project it is for").not.toBe("");

  /* --- a drawing, through the shipped upload door, in the browser's own session --- */
  const bytes = new TextEncoder().encode(`${DRAWING_BYTES}; ${label} ${mark}\n`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const created = await uploads.create({ projectId, name: `partition-${mark}.dxf`, size: bytes.length, sha256 });
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

  /* --- the reading of it: the shipped ingest job, with the plan artifact standing in for cad/ --- */
  const artifact = buildPartitionPlan();
  const storage = (await productModule<{ uploadStorage: () => unknown }>("src/modules/spine/uploads/index.ts")).uploadStorage();
  const ingestJob = await productModule<{ runIngestJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> }>(
    "src/modules/takeoff/ingest/job.ts",
  );
  await withEnv(CAD_COMMAND_VAR, standInExtractor(artifact.json), async () => {
    await ingestJob.runIngestJob(
      { tenantId, drawingId, requestedBy: randomUUID(), declared: null },
      { jobId: randomUUID(), tempDir: mkdtempSync(join(tmpdir(), "cubit-partition-ingest-")), step: async () => undefined },
      { storage },
    );
  });

  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(
    "src/modules/takeoff/ingest/index.ts",
  );
  const record = await records.ingestRecordOf({ tenantId, drawingId });
  expect(record, "staging the sheet left an ingest record — a partition is a reading of a recorded one").not.toBeNull();
  const ingestId = (record as { ingestId: string }).ingestId;

  /* --- the partition of it: the shipped job, over recorded answers for the silent captions --- */
  const model = await productModule<{ requestHash: (request: unknown) => string }>("src/core/model/index.ts");
  const captions = await productModule<{ viewCaptionRequest: (caption: string, anchorKey: string) => unknown; VIEW_CAPTION_MODEL: string }>(
    "src/modules/ai/view-captions/index.ts",
  );
  const root = mkdtempSync(join(tmpdir(), "cubit-partition-captions-"));
  for (const caption of SILENT_CAPTIONS) {
    const anchorKey = artifact.anchorOf.get(caption) ?? "";
    expect(anchorKey, `the staged artifact carries an entity for the caption ${JSON.stringify(caption)}`).not.toBe("");
    const hash = model.requestHash(captions.viewCaptionRequest(caption, anchorKey));
    writeFileSync(
      join(root, `${hash}.json`),
      JSON.stringify({
        requestHash: hash,
        modelId: captions.VIEW_CAPTION_MODEL,
        payload: { payload: { type: PROPOSED_AS[caption] as string }, sources: [anchorKey] },
        inputTokens: 120,
        outputTokens: 12,
      }),
    );
  }

  const rebuild = await productModule<{ runPartitionJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> }>(
    "src/modules/takeoff/partition/rebuild.ts",
  );
  await withEnv(FIXTURE_ROOT_VAR, root, async () => {
    await rebuild.runPartitionJob(
      { tenantId, drawingId, ingestId, requestedBy: randomUUID() },
      { jobId: randomUUID(), tempDir: mkdtempSync(join(tmpdir(), "cubit-partition-job-")), step: async () => undefined },
      { storage },
    );
  });

  const views = storedViews(tenantId, ingestId);
  const axes = storedAxes(tenantId, ingestId);
  expect(views.length, "the partition job stored the views of this reading").toBeGreaterThan(0);
  expect(axes.length, "and the grid it could lawfully read off the bubbled plan").toBeGreaterThan(0);

  return { tenantId, projectId, drawingId, layoutName: MODEL_SPACE, ingestId, views, axes };
}

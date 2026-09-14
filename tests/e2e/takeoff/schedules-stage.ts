/**
 * The stage J-032's schedules walk stands on (test contract: `stageSchedules`).
 *
 * Mechanics only — nothing here judges the product. A drawing is uploaded through the shipped door in
 * the browser's own session, its reading is recorded in-process by the shipped ingest job over a
 * stand-in for the `cad/` extractor, the shipped partition job reconstructs the schedule it carries,
 * the set is pinned through the one act seam, and a second MEASURER's LAP reading is committed
 * through that same seam. No table is written by hand except the second person's account, which is
 * seeded exactly as the lane seeds its own tenants.
 *
 * The drawing carries two sheets, which is what makes the rail a rail:
 *   - model space, where a `COLUMN SCHEDULE` reconstructs into a table with its member types, and a
 *     second schedule caption stands over no header at all, so that view defers (AC-7, AC-8);
 *   - a paper layout, whose text entities are F-RCC6-BNBC's four general notes verbatim — the sheet
 *     the grammar proposes off and the walk transcribes (AC-6).
 *
 * The note strings are imported from the roster that declares them once (B-19); that file is free of
 * `vitest` for this reason — a unit lane's `expect` has no runner to bind to inside a Playwright
 * process (the viewer-partition stage's own precedent).
 *
 * `DATABASE_URL` is pointed at the journeys' database by the stage this file builds on, BEFORE any
 * product module here opens a pool — hence the import order below.
 */
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { laneRows } from "../viewer/viewer-partition-stage";
import { BNBC_GENERAL_NOTES } from "../../takeoff/notes/support/bnbc-notes";
import { SHomePage } from "../pages/s-home.page";
import { ShellPage } from "../pages/shell.page";
import { UploadPage } from "../pages/upload.page";
import { heldAttribute } from "../support/retrying-read";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";

/** The names the two seams read their stand-ins from (SEAM-CAD). */
const CAD_COMMAND_VAR = "CUBIT_CAD_COMMAND";

/** The drawing bytes are only sniffed for format — the reading of them is the artifact below. */
const DRAWING_BYTES = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n";

/** A marker no two runs collide on. */
const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/** The two sheets of the staged drawing: model space, and the paper layout the notes stand on. */
export const SCHEDULE_LAYOUT = "Model";
export const NOTES_LAYOUT = "S-01";

/** The captions the shipped grammar reads deterministically — no recorded model answer is needed. */
const CAPTION_SCHEDULE = "COLUMN SCHEDULE";

/** The heights a caption and a cell text are drawn at (L-CAD-06: a caption is the big text). */
const CAPTION_HEIGHT = 8;
const TEXT_HEIGHT = 2.5;

/** The row spacing the schedule's bands are stacked at. */
const PITCH = 10;

/** The six columns the schedule is drawn at, and the headers standing over them. */
const COLUMNS: readonly number[] = [600, 630, 660, 690, 720, 750];
const HEADERS: readonly string[] = ["MARK", "GF TO 3RD", "4TH TO ROOF", "MAIN BAR", "TIES END ZONE", "TIES MID ZONE"];

/** The three data bands the schedule carries — three marks, each with its bands and its rebar. */
const ROWS: readonly (readonly string[])[] = [
  ["C-1", '12"x15"', '10"x12"', "8-16Ø", '10Ø @ 4" c/c', '10Ø @ 6" c/c'],
  ["C2", '15"x15"', '12"x12"', "6-16Ø", '10Ø @ 4" c/c', '10Ø @ 6" c/c'],
  ["C3", `1'-0"x1'-3"`, "12X12", "4-20Ø", '10Ø @ 4" c/c', '10Ø @ 6" c/c'],
];

/** The notes the leading and trailing lines of the table say — aside bands, never rows. */
const LEADING_NOTE = "ALL DIMENSIONS ARE IN INCH";
const TRAILING_NOTE = "NOTE: TIES AS PER DETAIL";

/** The layers the artifact draws on — census data, never a name anything reads a role off. */
const LAYER_CAPTIONS = "CAPTIONS";
const LAYER_TEXT = "SCHEDULE-TEXT";
const LAYER_LINES = "GRID-LINES";
const LAYER_NOTES = "NOTES";

/** A colour every built entity carries: channels, never a spelled colour. */
const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" };

/** The reading the second MEASURER already stands on, which the walk's own then disagrees with. */
export const OTHER_ACTOR_READING = Object.freeze({ kind: "LAP", valueAsWritten: "40", unitAsWritten: "d" } as const);

/** The act, and the role its actor holds (L-ACT-03). */
const TRANSCRIBE_SHEET_NOTES = "TRANSCRIBE_SHEET_NOTES";
const MEASURER = "MEASURER";

/** One drawn record of the built artifact, in the shape the seam's mirror validates (L-CAD-05). */
type Drawn = { key: string; type: string; space: string; layer: string; colour: typeof CHANNELS; text?: string; height?: number; points?: number[][] };

/** What the walk is driven against (test contract). */
export type StagedSchedules = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  ingestId: string;
  /** The sheet the reconstructed table and the deferral stand on. */
  scheduleLayout: string;
  /** The sheet the general notes stand on. */
  notesLayout: string;
  /** The stored schedule the walk reads, and how many rows the store holds for it. */
  scheduleKey: string;
  rowCount: number;
  /** The mark families the registry pane must list, as the store holds them. */
  families: string[];
  /** The source key of each note sentence, by the kind the grammar reads off it. */
  noteKeys: Record<string, string>;
  /** The second MEASURER's standing reading, which the walk's own LAP reading disagrees with. */
  otherActorReading: { kind: string; valueAsWritten: string; unitAsWritten: string; userId: string };
};

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
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
  const home = mkdtempSync(join(tmpdir(), "cubit-schedules-cad-"));
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

/**
 * The artifact this journey's drawing is read as: a gridless column schedule that reconstructs, a
 * second schedule caption standing over no header (which defers), and a paper sheet carrying the
 * four general notes at the source keys the acceptance names them by.
 */
function buildSchedulesArtifact(): { json: string } {
  let ordinal = 0x9000;
  const next = (): string => handle((ordinal += 1));
  const entities: Drawn[] = [];

  const text = (layer: string, space: string, said: string, at: readonly [number, number], height: number, key = next()): string => {
    entities.push({ key, type: "TEXT", space, layer, colour: CHANNELS, text: said, height, points: [[at[0], at[1]]] });
    return key;
  };
  const line = (from: readonly [number, number], to: readonly [number, number]): void => {
    entities.push({ key: next(), type: "LINE", space: SCHEDULE_LAYOUT, layer: LAYER_LINES, colour: CHANNELS, points: [[from[0], from[1]], [to[0], to[1]]] });
  };

  /* --- the schedule that reconstructs: caption, leading note, header, three rows, trailing note --- */
  text(LAYER_CAPTIONS, SCHEDULE_LAYOUT, CAPTION_SCHEDULE, [COLUMNS[0] as number, 0], CAPTION_HEIGHT);
  text(LAYER_TEXT, SCHEDULE_LAYOUT, LEADING_NOTE, [COLUMNS[0] as number, -PITCH], TEXT_HEIGHT);
  HEADERS.forEach((header, column) => text(LAYER_TEXT, SCHEDULE_LAYOUT, header, [COLUMNS[column] as number, -2 * PITCH], TEXT_HEIGHT));
  ROWS.forEach((row, index) => {
    row.forEach((said, column) => text(LAYER_TEXT, SCHEDULE_LAYOUT, said, [COLUMNS[column] as number, -(3 + index) * PITCH], TEXT_HEIGHT));
  });
  text(LAYER_TEXT, SCHEDULE_LAYOUT, TRAILING_NOTE, [COLUMNS[0] as number, -(2 + ROWS.length) * PITCH - 4 * PITCH], TEXT_HEIGHT);
  line([595, -5], [760, -5]);

  /* --- the schedule that defers: a caption over two bands, neither of them a header --- */
  const deferred = 1500;
  text(LAYER_CAPTIONS, SCHEDULE_LAYOUT, CAPTION_SCHEDULE, [deferred, 0], CAPTION_HEIGHT);
  text(LAYER_TEXT, SCHEDULE_LAYOUT, '12"x15"', [deferred, -2 * PITCH], TEXT_HEIGHT);
  text(LAYER_TEXT, SCHEDULE_LAYOUT, "8-16Ø", [deferred + 30, -2 * PITCH], TEXT_HEIGHT);
  text(LAYER_TEXT, SCHEDULE_LAYOUT, '10"x12"', [deferred, -3 * PITCH], TEXT_HEIGHT);
  text(LAYER_TEXT, SCHEDULE_LAYOUT, "6-16Ø", [deferred + 30, -3 * PITCH], TEXT_HEIGHT);
  line([deferred - 5, -5], [deferred + 60, -5]);

  /* --- the notes sheet: the fixture's own sentences, at the keys the acceptance names --- */
  BNBC_GENERAL_NOTES.forEach((note, index) => {
    text(LAYER_NOTES, NOTES_LAYOUT, note.text, [10, 200 - index * 8], 3, note.sourceKey);
  });
  entities.push({ key: next(), type: "LINE", space: NOTES_LAYOUT, layer: "TITLEBLOCK", colour: CHANNELS, points: [[0, 0], [297, 210]] });

  const graph = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-journey", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: SCHEDULE_LAYOUT, kind: "model", bbox: { min: [560, -140], max: [1600, 20] }, strays_rejected: 0 },
      { name: NOTES_LAYOUT, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 },
    ],
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: [],
    counters: [],
  };
  return { json: JSON.stringify(graph) };
}

/**
 * A project of the signed-in workspace, made through the shipped screen — and nothing in it. The
 * empty cell of this screen's state matrix is a project no drawing has been read on (AC-7).
 */
export async function stageBareProject(page: Page, options: { label?: string } = {}): Promise<{ tenantId: string; projectId: string }> {
  const shell = new ShellPage(page);
  const home = new SHomePage(page);
  const mark = `${RUN}${randomUUID().slice(0, 6)}`;

  await shell.workspaceDoor.click();
  await page.waitForURL(/\/t\/[0-9a-f-]{36}$/);
  const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
  expect(tenantId, "the workspace door leads to the workspace this person holds").not.toBe("");

  const project = `Sattva ${options.label ?? "bare"} ${mark}`;
  await home.createWith({ name: project, code: `BAR-${mark.slice(0, 4)}`, client: "Sattva Holdings", district: "Dhaka", buildingType: 1, storeys: "8" });
  const card = home.cardNamed(project);
  await expect(card, "the created project stands on S-Home").toBeVisible();
  const projectId = (await heldAttribute(card, "data-project")) ?? "";
  expect(projectId, "the card names the project it is for").not.toBe("");
  return { tenantId, projectId };
}

/** The signed-in person, as the shell states them. */
async function userIdOf(page: Page): Promise<string> {
  const userId = await heldAttribute(page.locator(testIdSelector(TESTIDS.shell.user)), "data-user-id");
  expect(userId, "the journey is signed in, so the shell names the person acting").toBeTruthy();
  return userId as string;
}

/** A second person on this project, holding MEASURER — seeded as the lane seeds its own tenants. */
function seedSecondMeasurer(tenantId: string, projectId: string, mark: string): string {
  const userId = randomUUID();
  laneRows(
    [
      `insert into users (user_id, email, password_hash, email_verified_at, created_at)`,
      `  values ('${userId}', 'second-measurer-${mark}@cubit.test', 'x', now(), now());`,
      `insert into memberships (tenant_id, user_id, workspace_role) values ('${tenantId}', '${userId}', 'MEMBER') on conflict do nothing;`,
      `insert into participants (tenant_id, project_id, user_id) values ('${tenantId}', '${projectId}', '${userId}') on conflict do nothing;`,
      `insert into participant_roles (tenant_id, project_id, user_id, role) values ('${tenantId}', '${projectId}', '${userId}', '${MEASURER}') on conflict do nothing;`,
      `select '${userId}';`,
    ].join("\n"),
  );
  return userId;
}

/** Every stored schedule of one ingest, with how many rows its cells stand in. */
function storedSchedules(tenantId: string, ingestId: string): { scheduleKey: string; rowCount: number }[] {
  return laneRows(
    `select s.schedule_key, (select count(distinct c.row_index) from schedule_cells c
        where c.tenant_id = s.tenant_id and c.ingest_id = s.ingest_id and c.schedule_key = s.schedule_key)
       from schedules s where s.tenant_id = '${tenantId}' and s.ingest_id = '${ingestId}' order by s.schedule_key;`,
  ).map((row) => ({ scheduleKey: row[0] ?? "", rowCount: Number(row[1] ?? "0") }));
}

/** Every mark family the stored registry holds for one ingest. */
function storedFamilies(tenantId: string, ingestId: string): string[] {
  return laneRows(`select family from member_types where tenant_id = '${tenantId}' and ingest_id = '${ingestId}' order by family;`).map((row) => row[0] ?? "");
}

/**
 * A project of the signed-in workspace holding one partitioned drawing — a reconstructed schedule
 * with its member types, a schedule view that defers, and a notes sheet — pinned as a drawing-set
 * revision, with one LAP reading already standing under a second MEASURER's name.
 */
export async function stageSchedules(page: Page, options: { label?: string } = {}): Promise<StagedSchedules> {
  const shell = new ShellPage(page);
  const home = new SHomePage(page);
  const uploads = new UploadPage(page);
  const mark = `${RUN}${randomUUID().slice(0, 6)}`;
  const label = options.label ?? "schedules";

  await shell.workspaceDoor.click();
  await page.waitForURL(/\/t\/[0-9a-f-]{36}$/);
  const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
  expect(tenantId, "the workspace door leads to the workspace this person holds").not.toBe("");
  const userId = await userIdOf(page);

  /* --- a project of that workspace, made through the shipped screen --- */
  const project = `Sattva Schedules ${mark}`;
  await home.createWith({ name: project, code: `SCH-${mark.slice(0, 4)}`, client: "Sattva Holdings", district: "Dhaka", buildingType: 1, storeys: "12" });
  const card = home.cardNamed(project);
  await expect(card, "the created project stands on S-Home").toBeVisible();
  const projectId = (await heldAttribute(card, "data-project")) ?? "";
  expect(projectId, "the card names the project it is for").not.toBe("");

  /* --- a drawing, through the shipped upload door, in the browser's own session --- */
  const bytes = Buffer.from(`${DRAWING_BYTES}; ${label} ${mark}\n`, "utf8");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const created = await uploads.create({ projectId, name: `schedules-${mark}.dxf`, size: bytes.length, sha256 });
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

  /* --- the reading of it, and the partition over that reading: both the shipped jobs --- */
  const storage = (await productModule<{ uploadStorage: () => unknown }>("src/modules/spine/uploads/index.ts")).uploadStorage();
  const ingestJob = await productModule<{ runIngestJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> }>(
    "src/modules/takeoff/ingest/job.ts",
  );
  await withEnv(CAD_COMMAND_VAR, standInExtractor(buildSchedulesArtifact().json), async () => {
    await ingestJob.runIngestJob(
      { tenantId, drawingId, requestedBy: userId, declared: null },
      { jobId: randomUUID(), tempDir: mkdtempSync(join(tmpdir(), "cubit-schedules-ingest-")), step: async () => undefined },
      { storage },
    );
  });

  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(
    "src/modules/takeoff/ingest/index.ts",
  );
  const record = await records.ingestRecordOf({ tenantId, drawingId });
  expect(record, "staging the sheet left an ingest record — a partition is a reading of a recorded one").not.toBeNull();
  const ingestId = (record as { ingestId: string }).ingestId;

  const rebuild = await productModule<{ runPartitionJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> }>(
    "src/modules/takeoff/partition/rebuild.ts",
  );
  await rebuild.runPartitionJob(
    { tenantId, drawingId, ingestId, requestedBy: userId },
    { jobId: randomUUID(), tempDir: mkdtempSync(join(tmpdir(), "cubit-schedules-partition-")), step: async () => undefined },
    { storage },
  );

  const schedules = storedSchedules(tenantId, ingestId);
  expect(schedules.length, `the partition reconstructed the drawing's schedule: ${JSON.stringify(schedules)}`).toBeGreaterThan(0);
  const table = schedules.find((one) => one.rowCount > 1) ?? (schedules[0] as { scheduleKey: string; rowCount: number });
  const families = storedFamilies(tenantId, ingestId);
  expect(families.length, `and the member types its marks name: ${JSON.stringify(families)}`).toBeGreaterThan(0);

  /* --- the pinned revision, which is what opens the campaign (L-REG-07) --- */
  const scope = { tenantId, projectId };
  const acts = await productModule<{
    preview: (ctx: unknown, input: unknown) => Promise<Record<string, unknown>>;
    commit: (ctx: unknown, input: unknown, digest: string) => Promise<Record<string, unknown>>;
    consequenceDigest: (consequence: Record<string, unknown>) => string;
  }>("src/core/acts/index.ts");
  const perform = async (actor: { tenantId: string; userId: string; actorKind: string }, input: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const consequence = await acts.preview(actor, input);
    return acts.commit(actor, input, acts.consequenceDigest(consequence));
  };
  const principal = { tenantId, userId, actorKind: "human" };

  const sets = await productModule<{
    createSet: (scope: unknown, by: { userId: string }, name: string) => Promise<Record<string, unknown>>;
    toggleMember: (scope: unknown, setId: string, drawingId: string) => Promise<Record<string, unknown>>;
  }>("src/modules/takeoff/sets/index.ts");
  const createdSet = await sets.createSet(scope, { userId }, `${label}-set-${mark.slice(0, 8)}`);
  const setId = String(createdSet["setId"]);
  await sets.toggleMember(scope, setId, drawingId);
  await perform(principal, { type: "PIN_DRAWING_SET", projectId, setId });

  /* --- one LAP reading already standing, by somebody else: what the walk's own disagrees with --- */
  const secondUserId = seedSecondMeasurer(tenantId, projectId, mark);
  const notes = await productModule<{ sheetTextsOf: (scope: unknown, layoutName: string) => Promise<readonly { sourceKey: string; text: string }[]> }>(
    "src/modules/takeoff/notes/index.ts",
  );
  const texts = await notes.sheetTextsOf({ tenantId, projectId, drawingId }, NOTES_LAYOUT);
  const grammar = await productModule<{ proposeNotes: (texts: readonly { sourceKey: string; text: string }[]) => Record<string, unknown>[] }>(
    "src/modules/takeoff/notes/grammar.ts",
  );
  const proposals = grammar.proposeNotes(texts);
  const noteKeys = Object.fromEntries(proposals.map((proposal) => [String(proposal["kind"]), String(proposal["sourceKey"])]));
  const lapKey = noteKeys[OTHER_ACTOR_READING.kind];
  expect(lapKey, `the notes sheet proposes a ${OTHER_ACTOR_READING.kind} reading: ${JSON.stringify(noteKeys)}`).toBeTruthy();

  await perform(
    { tenantId, userId: secondUserId, actorKind: "human" },
    {
      type: TRANSCRIBE_SHEET_NOTES,
      projectId,
      drawingId,
      layoutName: NOTES_LAYOUT,
      readings: [{ kind: OTHER_ACTOR_READING.kind, sourceKey: lapKey, valueAsWritten: OTHER_ACTOR_READING.valueAsWritten, unitAsWritten: OTHER_ACTOR_READING.unitAsWritten }],
    },
  );

  return {
    tenantId,
    projectId,
    drawingId,
    ingestId,
    scheduleLayout: SCHEDULE_LAYOUT,
    notesLayout: NOTES_LAYOUT,
    scheduleKey: table.scheduleKey,
    rowCount: table.rowCount,
    families,
    noteKeys,
    otherActorReading: { ...OTHER_ACTOR_READING, userId: secondUserId },
  };
}

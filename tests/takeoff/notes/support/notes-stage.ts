/**
 * The live stage the note-reading criteria are graded on (R-TO-034, L-ACT-02, L-QTY-01, AM-03(h)).
 *
 * Mechanics only — nothing here judges the product. The database, the accounts, the projects, the
 * drawings and the pinned set revision come from the stages the register and the sets already run on
 * (`../../register/support/register-stage`, `../../sets/support/sets-stage`): one invariant, one home
 * (B-17, ARCH-02). What this file adds is what a NOTE READING needs beyond them — a sheet whose text
 * entities are F-RCC6-BNBC's general notes, recorded by the shipped ingest pipeline, and the act pair
 * as the seam is given it.
 *
 * Product modules are loaded by path, so a file the Builder has not written yet fails as an
 * assertion naming it rather than as a collection death that reads as a defect in the acceptance.
 * Every type of a not-yet-written surface is a loose local shape.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { lit } from "../../../../db/__tests__/support/live-sql";
import { actsSeam as setActsSeam, codeOf, pinning, setRevisionRows, setsSeam } from "../../sets/support/sets-stage";
import { stageDrawing, stubCli, withCadCommand } from "../../support/ingest-stage";
import { enrol, joinWorkspace, rejection, storageOf, tempDir } from "../../support/sheets-stage";
import {
  PRINCIPAL,
  actRows,
  actorOf,
  closeStage,
  field,
  grantRole,
  openSheetsStage,
  productModule,
  rowsOf,
  sql,
  stagePerson,
  unique,
  type Person,
  type StoreRow,
} from "../../register/support/register-stage";
import {
  ACTS_LAW_MODULE,
  ACTS_MODULE,
  BNBC_SHEET_TEXTS,
  MEASURER,
  NOTES_GRAMMAR_MODULE,
  NOTES_MODULE,
  NOTES_READINGS_TABLE,
  NOTES_STANDING_MODULE,
  SCHEDULES_ERRORS_MODULE,
  TRANSCRIBE_ACT_MODULE,
  TRANSCRIBE_SHEET_NOTES,
  type SheetText,
} from "./bnbc-notes";

export { closeStage, codeOf, field, grantRole, joinWorkspace, productModule, rejection, rowsOf, sql, unique };
export type { Person, StoreRow };

/* ------------------------------------------------------------------ the shapes the act takes */

/** Which workspace and project a note reading is scoped to. */
export type NotesScope = { tenantId: string; projectId: string };

/** The sheet a reading is made on — (drawingId, layoutName), as the register and the viewer key one. */
export type SheetRef = { drawingId: string; layoutName: string };

/** A human actor, as SEAM-ACT is given one. */
export type ActorCtx = { tenantId: string; userId: string; actorKind: string };

/** One reading as the act is given one (interfaces: `TranscribeSheetNotesInput.readings`). */
export type ProposedReading = { kind: string; sourceKey: string; valueAsWritten: string; unitAsWritten: string } & Record<string, unknown>;

/** What TRANSCRIBE_SHEET_NOTES asks for, as the seam is given it. */
export type TranscribeInput = {
  type: string;
  projectId: string;
  drawingId: string;
  layoutName: string;
  readings: readonly ProposedReading[];
};

/** One subject of a Consequence, as L-ACT-02 renders one (C-05: a shape is free to carry more). */
export type SubjectLike = { subjectId?: unknown; subjectLabel?: unknown; before?: unknown; after?: unknown } & Record<string, unknown>;

/** What an act would do, as the seam answers it. */
export type ConsequenceLike = { actType?: unknown; rendering?: unknown; subjects?: readonly SubjectLike[]; effects?: unknown } & Record<string, unknown>;

/** SEAM-ACT, as this acceptance drives it. */
export type ActsSeam = {
  preview: (ctx: ActorCtx, input: TranscribeInput) => Promise<ConsequenceLike>;
  commit: (ctx: ActorCtx, input: TranscribeInput, carriedDigest: string) => Promise<Record<string, unknown>>;
  consequenceDigest: (consequence: ConsequenceLike) => string;
  ACT_MAP?: Record<string, unknown>;
};

/** The act law, where the type and its permission stand (L-ACT-03, AC-2). */
export type ActsLaw = { ACT_TYPES: readonly string[]; ACT_PERMISSION: Readonly<Record<string, string>> };

/** How a kind stands over the readings made of it (interfaces: `NoteStanding`). */
export type StandingLike = {
  standing?: unknown;
  canonical?: unknown;
  unitAsWritten?: unknown;
  code?: unknown;
  current?: readonly unknown[];
  superseded?: readonly unknown[];
} & Record<string, unknown>;

/** The notes door, as the goal and the criteria name its calls. */
export type NotesDoor = {
  appliedDetailingValuesOf: (scope: { tenantId: string; projectId: string; setRevisionId: string }) => Promise<Record<string, unknown>>;
  sheetTextsOf: (scope: { tenantId: string; projectId: string; drawingId: string }, layoutName: string) => Promise<readonly SheetText[]>;
  noteReadingKey: (ref: { drawingId: string; layoutName: string; kind: string; actorId: string; sourceKey: string }) => string;
  noteStanding: (readings: readonly Record<string, unknown>[]) => StandingLike;
  proposeNotes: (texts: readonly SheetText[]) => Record<string, unknown>[];
};

/** Where each call of the door may lawfully be spelled: the barrel first, then the file that owns it. */
const DOOR_HOMES: Readonly<Record<keyof NotesDoor & string, readonly string[]>> = Object.freeze({
  appliedDetailingValuesOf: [NOTES_MODULE, "src/modules/takeoff/notes/store.ts"],
  sheetTextsOf: [NOTES_MODULE, "src/modules/takeoff/notes/texts.ts"],
  noteReadingKey: [NOTES_MODULE, NOTES_STANDING_MODULE],
  noteStanding: [NOTES_MODULE, NOTES_STANDING_MODULE],
  proposeNotes: [NOTES_MODULE, NOTES_GRAMMAR_MODULE],
});

/* ------------------------------------------------------------------ loading the doors */

/** One call of the notes door, from the barrel that publishes it or the file that owns it. */
async function callOf(name: keyof NotesDoor & string): Promise<unknown> {
  const homes = DOOR_HOMES[name] as readonly string[];
  for (const home of homes) {
    const module = (await productModule<Record<string, unknown>>(home).catch(() => null)) as Record<string, unknown> | null;
    const call = module?.[name];
    if (typeof call === "function") return call;
  }
  expect.fail(`no module of ${homes.join(" or ")} publishes \`${name}\` — a door this increment's goal names`);
}

let door: Promise<NotesDoor> | undefined;

/** The notes door, with every call this acceptance drives asserted by name. */
export function notesDoor(): Promise<NotesDoor> {
  return (door ??= (async () => {
    const entries = await Promise.all((Object.keys(DOOR_HOMES) as (keyof NotesDoor & string)[]).map(async (name) => [name, await callOf(name)] as const));
    return Object.fromEntries(entries) as unknown as NotesDoor;
  })());
}

/** SEAM-ACT, with the pair this increment appends behind it. */
export async function actsSeam(): Promise<ActsSeam> {
  const seam = await productModule<Record<string, unknown>>(ACTS_MODULE);
  for (const call of ["preview", "commit", "consequenceDigest"]) {
    expect(typeof seam[call], `${ACTS_MODULE} publishes \`${call}\` (SEAM-ACT)`).toBe("function");
  }
  return seam as unknown as ActsSeam;
}

/** The act law, where the type and the permission it moves stand. */
export async function actsLaw(): Promise<ActsLaw> {
  return productModule<ActsLaw>(ACTS_LAW_MODULE);
}

/** The act's own rendering, as `ACT_MAP` must hold it (AC-2). */
export async function transcribeRendering(): Promise<unknown> {
  const module = await productModule<Record<string, unknown>>(TRANSCRIBE_ACT_MODULE);
  const rendering = module["transcribeSheetNotes"];
  expect(rendering, `${TRANSCRIBE_ACT_MODULE} publishes \`transcribeSheetNotes\` (interfaces)`).toBeTruthy();
  return rendering;
}

/** The area's refusal register, read from its one home so nothing here re-spells a code (Q-07). */
export async function schedulesRefusals(): Promise<Record<string, unknown>> {
  const module = await productModule<Record<string, unknown>>(SCHEDULES_ERRORS_MODULE);
  const registered = Object.values(module).find((value) => typeof value === "object" && value !== null && !Array.isArray(value));
  expect(registered, `${SCHEDULES_ERRORS_MODULE} publishes the area's registered refusals`).toBeTruthy();
  return registered as Record<string, unknown>;
}

/* ------------------------------------------------------------------ the lane's own doors */

/** The lane file this increment lands, and the root that mounts it (goal, AC-3). */
export const SCHEDULES_ROUTER_MODULE = "src/server/routers/takeoff-schedules.ts";
export const ROOT_MODULE = "src/server/root.ts";

/** The three procedures the lane publishes (test contract). */
export type SchedulesCaller = {
  schedules: (input: unknown) => Promise<unknown>;
  previewTranscribeSheetNotes: (input: unknown) => Promise<unknown>;
  commitTranscribeSheetNotes: (input: unknown) => Promise<unknown>;
};

/** The context a signed-in caller carries, as the lane's own tests give one. */
function callerContext(person: Person): Record<string, unknown> {
  const here = "http://127.0.0.1";
  return {
    requestId: randomUUID(),
    actor: "an-account",
    origin: here,
    statedOrigin: null,
    requestOrigin: here,
    deviceLabel: "acceptance",
    client: "an unobserved caller",
    session: { sessionId: randomUUID(), userId: person.userId },
    secureCookies: false,
    cookies: [],
  };
}

/**
 * A caller of the takeoff-schedules lane, acting as one staged person — mounted the way the app
 * mounts it: `lanes.takeoffSchedules` of `src/server/root.ts`, which is the lane file itself carried
 * through by the root's own table (AC-3).
 */
export async function schedulesCaller(person: Person): Promise<SchedulesCaller> {
  const root = await productModule<{ lanes?: Record<string, { createCaller?: (ctx: unknown) => Record<string, (input: unknown) => Promise<unknown>> }> }>(ROOT_MODULE);
  const lane = root.lanes?.["takeoffSchedules"];
  expect(typeof lane?.createCaller, `${ROOT_MODULE} mounts the lane \`takeoffSchedules\` (goal: a registry append)`).toBe("function");
  const caller = (lane as { createCaller: (ctx: unknown) => Record<string, (input: unknown) => Promise<unknown>> }).createCaller(callerContext(person));
  for (const procedure of ["schedules", "previewTranscribeSheetNotes", "commitTranscribeSheetNotes"]) {
    expect(typeof caller[procedure], `the lane publishes \`${procedure}\` (test contract)`).toBe("function");
  }
  return caller as unknown as SchedulesCaller;
}

/* ------------------------------------------------------------------ the artifact the sheet is read from */

/** A colour every built entity carries: channels, never a spelled colour (the artifact's own shape). */
const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" };

/** The spaces the built artifact carries, as the ingest seam spells them. */
export const MODEL_SPACE = "Model";
const PAPER_SPACE = "SHEET-1";

/** The caption the notes stand under — a string the shipped caption corpus already classifies. */
export const NOTES_CAPTION = "GENERAL NOTES";

/** The caption a reconstructable schedule stands under, and the sheet the notes stand on beside it. */
export const SCHEDULE_CAPTION = "COLUMN SCHEDULE";
export const NOTES_LAYOUT = "S-01";

/** The heights a caption and a note line are drawn at (L-CAD-06: a caption is the big text). */
const CAPTION_HEIGHT = 8;
const NOTE_HEIGHT = 2.5;

/**
 * An EntityGraph v2 whose model space carries a general-notes block: one caption, and beneath it one
 * TEXT entity per sentence, each standing at the source key the acceptance names it by. The keys are
 * the artifact's own, which is what makes a reading's `sourceKey` a key of this sheet.
 */
export function buildNotesArtifact(texts: readonly SheetText[] = BNBC_SHEET_TEXTS): { json: string; captionKey: string } {
  const entities: Record<string, unknown>[] = [];
  const captionKey = "DXF_HANDLE:1F3F";

  entities.push({ key: captionKey, type: "TEXT", space: MODEL_SPACE, layer: "CAPTIONS", colour: CHANNELS, text: NOTES_CAPTION, height: CAPTION_HEIGHT, points: [[0, 0]] });
  texts.forEach((one, index) => {
    entities.push({
      key: one.sourceKey,
      type: "TEXT",
      space: MODEL_SPACE,
      layer: "NOTES",
      colour: CHANNELS,
      text: one.text,
      height: NOTE_HEIGHT,
      points: [[0, -5 - index * 5]],
    });
  });
  entities.push({ key: "DXF_HANDLE:1F3D", type: "LINE", space: MODEL_SPACE, layer: "NOTES", colour: CHANNELS, points: [[-2, -2], [60, -2]] });
  entities.push({ key: "DXF_HANDLE:1F3B", type: "TEXT", space: PAPER_SPACE, layer: "TITLEBLOCK", colour: CHANNELS, text: "S-01 GENERAL NOTES", height: 3, points: [[5, 5]] });

  const graph = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: { min: [-10, -80], max: [80, 10] }, strays_rejected: 0 },
      { name: PAPER_SPACE, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 },
    ],
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: [],
    counters: [],
  };
  return { json: JSON.stringify(graph), captionKey };
}

/** The row spacing the staged schedule's bands are stacked at, and the columns they stand in. */
const PITCH = 10;
const COLUMNS: readonly number[] = [600, 630, 660, 690, 720, 750];
const HEADERS: readonly string[] = ["MARK", "GF TO 3RD", "4TH TO ROOF", "MAIN BAR", "TIES END ZONE", "TIES MID ZONE"];
const ROWS: readonly (readonly string[])[] = [
  ["C-1", '12"x15"', '10"x12"', "8-16Ø", '10Ø @ 4" c/c', '10Ø @ 6" c/c'],
  ["C2", '15"x15"', '12"x12"', "6-16Ø", '10Ø @ 4" c/c', '10Ø @ 6" c/c'],
  ["C3", `1'-0"x1'-3"`, "12X12", "4-20Ø", '10Ø @ 4" c/c', '10Ø @ 6" c/c'],
];

/**
 * The whole workspace on one drawing: model space carrying a `COLUMN SCHEDULE` that reconstructs
 * beside a second schedule caption standing over no header at all (which defers), and a paper sheet
 * whose text entities are the general notes. Two sheets, which is what makes a rail a rail.
 */
export function buildWorkspaceArtifact(texts: readonly SheetText[] = BNBC_SHEET_TEXTS): { json: string } {
  let ordinal = 0x9000;
  const next = (): string => `DXF_HANDLE:${(ordinal += 1).toString(16).toUpperCase()}`;
  const entities: Record<string, unknown>[] = [];
  const write = (space: string, layer: string, said: string, at: readonly [number, number], height: number, key = next()): void => {
    entities.push({ key, type: "TEXT", space, layer, colour: CHANNELS, text: said, height, points: [[at[0], at[1]]] });
  };

  write(MODEL_SPACE, "CAPTIONS", SCHEDULE_CAPTION, [COLUMNS[0] as number, 0], CAPTION_HEIGHT);
  write(MODEL_SPACE, "SCHEDULE-TEXT", "ALL DIMENSIONS ARE IN INCH", [COLUMNS[0] as number, -PITCH], NOTE_HEIGHT);
  HEADERS.forEach((header, column) => write(MODEL_SPACE, "SCHEDULE-TEXT", header, [COLUMNS[column] as number, -2 * PITCH], NOTE_HEIGHT));
  ROWS.forEach((row, index) => row.forEach((said, column) => write(MODEL_SPACE, "SCHEDULE-TEXT", said, [COLUMNS[column] as number, -(3 + index) * PITCH], NOTE_HEIGHT)));
  write(MODEL_SPACE, "SCHEDULE-TEXT", "NOTE: TIES AS PER DETAIL", [COLUMNS[0] as number, -(6 + ROWS.length) * PITCH], NOTE_HEIGHT);
  entities.push({ key: next(), type: "LINE", space: MODEL_SPACE, layer: "GRID-LINES", colour: CHANNELS, points: [[595, -5], [760, -5]] });

  const deferred = 1500;
  write(MODEL_SPACE, "CAPTIONS", SCHEDULE_CAPTION, [deferred, 0], CAPTION_HEIGHT);
  write(MODEL_SPACE, "SCHEDULE-TEXT", '12"x15"', [deferred, -2 * PITCH], NOTE_HEIGHT);
  write(MODEL_SPACE, "SCHEDULE-TEXT", "8-16Ø", [deferred + 30, -2 * PITCH], NOTE_HEIGHT);
  write(MODEL_SPACE, "SCHEDULE-TEXT", '10"x12"', [deferred, -3 * PITCH], NOTE_HEIGHT);
  write(MODEL_SPACE, "SCHEDULE-TEXT", "6-16Ø", [deferred + 30, -3 * PITCH], NOTE_HEIGHT);
  entities.push({ key: next(), type: "LINE", space: MODEL_SPACE, layer: "GRID-LINES", colour: CHANNELS, points: [[deferred - 5, -5], [deferred + 60, -5]] });

  texts.forEach((one, index) => write(NOTES_LAYOUT, "NOTES", one.text, [10, 200 - index * 8], 3, one.sourceKey));
  entities.push({ key: next(), type: "LINE", space: NOTES_LAYOUT, layer: "TITLEBLOCK", colour: CHANNELS, points: [[0, 0], [297, 210]] });

  const graph = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: { min: [560, -140], max: [1600, 20] }, strays_rejected: 0 },
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

/* ------------------------------------------------------------------ staging the sheet and its people */

/** A drawing of the built artifact, recorded by the shipped ingest pipeline. */
export type StagedSheet = { drawingId: string; ingestId: string; layoutName: string };

/** The whole live stage one criterion runs on. */
export type StagedNotes = {
  person: Person;
  actor: ActorCtx;
  tenantId: string;
  projectId: string;
  scope: NotesScope;
  setId: string;
  setRevisionId: string;
  sheet: StagedSheet;
  /** The sheet the pinned revision does NOT hold a reading on — the door's empty answer (AC-4). */
  measurer: { person: Person; actor: ActorCtx };
  second: { person: Person; actor: ActorCtx };
};

/**
 * A drawing whose recorded reading is the notes artifact: the bytes are seeded into the store (the
 * upload door would refuse a hand-written stub) and the shipped ingest job is run over a stand-in
 * for the `cad/` extractor. What lands is a real `ingests` row, written by the product's own
 * pipeline (B-17).
 */
export async function stageNotesSheet(
  person: Person,
  projectId: string,
  label: string,
  texts: readonly SheetText[] = BNBC_SHEET_TEXTS,
  options: { graph?: string; layoutName?: string; partition?: boolean } = {},
): Promise<StagedSheet> {
  const job = await productModule<{ runIngestJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> }>("src/modules/takeoff/ingest/job.ts");
  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(
    "src/modules/takeoff/ingest/index.ts",
  );
  const artifact = options.graph === undefined ? buildNotesArtifact(texts) : { json: options.graph };
  const bytes = new TextEncoder().encode(`0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; ${label}\n`);
  const drawing = await stageDrawing(person, projectId, bytes, { name: unique(`${label}.dxf`), format: "dxf" });
  const stub = stubCli({ artifact: artifact.json, stderr: "", exitCode: 0 });

  await withCadCommand(stub.command, async () => {
    await job.runIngestJob(
      { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
      { jobId: unique(`ingest-${label}`), tempDir: tempDir("notes-ingest"), step: async () => undefined },
      { storage: await storageOf() },
    );
  });

  const record = await records.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
  expect(record, `staging ${label} left no ingest record — a sheet's texts are read off a recorded one`).not.toBeNull();
  const ingestId = (record as { ingestId: string }).ingestId;

  if (options.partition === true) {
    const rebuild = await productModule<{ runPartitionJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> }>(
      "src/modules/takeoff/partition/rebuild.ts",
    );
    await rebuild.runPartitionJob(
      { tenantId: person.tenantId, drawingId: drawing.drawingId, ingestId, requestedBy: person.userId },
      { jobId: unique(`partition-${label}`), tempDir: tempDir("notes-partition"), step: async () => undefined },
      { storage: await storageOf() },
    );
  }

  return { drawingId: drawing.drawingId, ingestId, layoutName: options.layoutName ?? MODEL_SPACE };
}

/** A second (third…) person on the SAME project, holding one role there (L-ACT-03). */
export async function stageActor(staged: { tenantId: string; projectId: string }, label: string, role: string): Promise<{ person: Person; actor: ActorCtx }> {
  const person = await enrol(`notes-${label}`);
  joinWorkspace(staged.tenantId, person.userId);
  grantRole(staged.tenantId, staged.projectId, person.userId, role);
  return { person, actor: { tenantId: staged.tenantId, userId: person.userId, actorKind: "human" } };
}

/**
 * A project whose pinned revision holds one sheet, and whose text entities are the fixture's general
 * notes: the whole ground every note-reading criterion stands on. Two MEASURERs are enrolled on it,
 * because a reading is keyed by the actor who made it and a disagreement needs two.
 */
export async function stageNotes(label: string, texts: readonly SheetText[] = BNBC_SHEET_TEXTS, options: { workspace?: boolean } = {}): Promise<StagedNotes> {
  await openSheetsStage();
  const { person, projectId } = await stagePerson(`notes-${label}`);
  grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
  const tenantId = person.tenantId;
  const scope = { tenantId, projectId };

  const sheet =
    options.workspace === true
      ? await stageNotesSheet(person, projectId, `notes-${label}`, texts, { graph: buildWorkspaceArtifact(texts).json, layoutName: NOTES_LAYOUT, partition: true })
      : await stageNotesSheet(person, projectId, `notes-${label}`, texts);

  /* --- the pinned revision, which is what a campaign's applied values are read over (L-REG-07) --- */
  const sets = await setsSeam();
  const created = await sets.createSet(scope, { userId: person.userId }, unique(`${label} set`));
  expect(created.created, `the set for ${label} was created: ${JSON.stringify(created)}`).toBe(true);
  const setId = (created as { created: true; setId: string }).setId;
  const toggled = await sets.toggleMember(scope, setId, sheet.drawingId);
  expect(toggled.toggled, `the staged sheet was toggled into the set: ${JSON.stringify(toggled)}`).toBe(true);

  const acts = await setActsSeam();
  const pin = pinning(projectId, setId);
  const consequence = await acts.preview(actorOf(person), pin);
  await acts.commit(actorOf(person), pin, acts.consequenceDigest(consequence));
  const revisions = setRevisionRows(tenantId, setId);
  expect(revisions.length, `pinning the set added one revision to the ledger: ${JSON.stringify(revisions)}`).toBe(1);

  const measurer = await stageActor({ tenantId, projectId }, `${label}-measurer`, MEASURER);
  const second = await stageActor({ tenantId, projectId }, `${label}-second`, MEASURER);

  return {
    person,
    actor: actorOf(person) as ActorCtx,
    tenantId,
    projectId,
    scope,
    setId,
    setRevisionId: (revisions[0] as { setRevisionId: string }).setRevisionId,
    sheet,
    measurer,
    second,
  };
}

/**
 * A SECOND sheet of the same project, on a drawing no set of this stage holds: the ground for the
 * rule that a reading is applied by the revision that holds the sheet it was made on, and by no
 * other (AC-4). It is staged exactly as the first one is — the same artifact, the same pipeline.
 */
export async function stageSheetOutsideRevision(staged: StagedNotes, label: string, texts: readonly SheetText[] = BNBC_SHEET_TEXTS): Promise<StagedSheet> {
  return stageNotesSheet(staged.person, staged.projectId, `outside-${label}`, texts);
}

/**
 * A further revision of the same project, pinning a set that holds exactly the drawings named — the
 * second half of that rule: the same store, the same tenant, another manifest, another answer.
 */
export async function stageRevisionHolding(staged: StagedNotes, label: string, drawingIds: readonly string[]): Promise<string> {
  const sets = await setsSeam();
  const created = await sets.createSet(staged.scope, { userId: staged.person.userId }, unique(`${label} set`));
  expect(created.created, `the set for ${label} was created: ${JSON.stringify(created)}`).toBe(true);
  const setId = (created as { created: true; setId: string }).setId;
  for (const drawingId of drawingIds) {
    const toggled = await sets.toggleMember(staged.scope, setId, drawingId);
    expect(toggled.toggled, `${drawingId} was toggled into the ${label} set: ${JSON.stringify(toggled)}`).toBe(true);
  }

  const acts = await setActsSeam();
  const pin = pinning(staged.projectId, setId);
  const consequence = await acts.preview(actorOf(staged.person), pin);
  await acts.commit(actorOf(staged.person), pin, acts.consequenceDigest(consequence));
  const revisions = setRevisionRows(staged.tenantId, setId);
  expect(revisions.length, `pinning the ${label} set added one revision to the ledger: ${JSON.stringify(revisions)}`).toBe(1);
  return (revisions[0] as { setRevisionId: string }).setRevisionId;
}

/* ------------------------------------------------------------------ the act, as the seam is given it */

/** One TRANSCRIBE_SHEET_NOTES over N readings of one sheet (AC-2). */
export function transcription(staged: { projectId: string; sheet: SheetRef }, readings: readonly ProposedReading[]): TranscribeInput {
  return { type: TRANSCRIBE_SHEET_NOTES, projectId: staged.projectId, drawingId: staged.sheet.drawingId, layoutName: staged.sheet.layoutName, readings };
}

/** One reading, as a person hands the door one. */
export function reading(kind: string, sourceKey: string, valueAsWritten: string, unitAsWritten: string, extra: Record<string, unknown> = {}): ProposedReading {
  return { kind, sourceKey, valueAsWritten, unitAsWritten, ...extra };
}

/** The reading a proposal is, handed back to the door exactly as the grammar proposed it. */
export function asProposed(proposal: Record<string, unknown>): ProposedReading {
  return reading(String(proposal["kind"]), String(proposal["sourceKey"]), String(proposal["valueAsWritten"]), String(proposal["unitAsWritten"]));
}

/** What performing one act left behind: what it said it would do, and the act row it wrote. */
export type Performed = { consequence: ConsequenceLike; actId: string };

/** Preview an act, exactly as a surface would (L-ACT-02: the digest is carried, never assembled). */
export async function previewOf(actor: ActorCtx, input: TranscribeInput): Promise<ConsequenceLike> {
  const acts = await actsSeam();
  return acts.preview(actor, input);
}

/** Preview an act and commit the digest it answered — the whole L-ACT-02 pair, once. */
export async function performAct(actor: ActorCtx, input: TranscribeInput): Promise<Performed> {
  const acts = await actsSeam();
  const consequence = await acts.preview(actor, input);
  const written = await acts.commit(actor, input, acts.consequenceDigest(consequence));
  const actId = written["actId"];
  expect(typeof actId === "string" && actId.length > 0, `committing ${input.type} answered the act it wrote: ${JSON.stringify(written)}`).toBe(true);
  return { consequence, actId: String(actId) };
}

/** The code an act refused with, whichever half of the pair refused it. */
export async function refusalOfPerforming(actor: ActorCtx, input: TranscribeInput): Promise<string | null> {
  const failure = await rejection(performAct(actor, input));
  expect(failure, `${input.type} was expected to refuse, and the act went through instead`).not.toBeNull();
  return codeOf(failure);
}

/** The code a PREVIEW refused with — the half of the pair that judges before anything is written. */
export async function refusalOfPreviewing(actor: ActorCtx, input: TranscribeInput): Promise<string | null> {
  const failure = await rejection(previewOf(actor, input));
  expect(failure, `previewing ${input.type} was expected to refuse, and it answered a Consequence instead`).not.toBeNull();
  return codeOf(failure);
}

/* ------------------------------------------------------------------ reading a Consequence */

/** The subjects a Consequence carries, in the order it carries them. */
export function subjectsOf(consequence: ConsequenceLike): SubjectLike[] {
  const subjects = consequence.subjects;
  expect(Array.isArray(subjects), `a Consequence carries its subjects: ${JSON.stringify(consequence)}`).toBe(true);
  return [...(subjects as readonly SubjectLike[])];
}

/** One subject's `before` / `after`, as lists of what they say. */
export function movedTo(subject: SubjectLike): { before: string[]; after: string[] } {
  return { before: ((subject.before as string[] | undefined) ?? []).map(String), after: ((subject.after as string[] | undefined) ?? []).map(String) };
}

/** What a Consequence says it moves elsewhere (L-ACT-02's effects). */
export function effectsOf(consequence: ConsequenceLike): Record<string, unknown> {
  return (consequence.effects ?? {}) as Record<string, unknown>;
}

/* ------------------------------------------------------------------ reading the store directly */

/** Does the migrated database hold this table at all? */
export function tableStands(table: string): boolean {
  return (
    sql(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = ${lit(table)};`,
    ).length > 0
  );
}

/** Every `notes_readings` row of one workspace, whole — the acceptance's audit read. */
export function readingRows(tenantId: string): StoreRow[] {
  expect(tableStands(NOTES_READINGS_TABLE), `the product's migration lane lands public.${NOTES_READINGS_TABLE} (AC-2, V-DB)`).toBe(true);
  return rowsOf(NOTES_READINGS_TABLE, tenantId);
}

/** One stored reading reduced to the facts the criteria state about it. */
export function readingFacts(row: StoreRow): Record<string, string> {
  const of = (camel: string, snake: string): string => String(field(row, camel, snake) ?? "");
  return {
    readingKey: of("readingKey", "reading_key"),
    drawingId: of("drawingId", "drawing_id"),
    layoutName: of("layoutName", "layout_name"),
    kind: of("kind", "kind"),
    actorId: of("actorId", "actor_id"),
    sourceKey: of("sourceKey", "source_key"),
    valueAsWritten: of("valueAsWritten", "value_as_written"),
    unitAsWritten: of("unitAsWritten", "unit_as_written"),
    canonical: of("canonical", "canonical"),
    basis: of("basis", "basis"),
    acceptance: of("acceptance", "acceptance"),
    actId: of("actId", "act_id"),
  };
}

/** How many rows one table holds in one workspace, whatever the table is (AC-4's edition count). */
export function rowCount(table: string, tenantId: string): number {
  return tableStands(table) ? rowsOf(table, tenantId).length : 0;
}

/** How many act rows of one type one project holds — the "one act, never two" reading (L-ACT-01). */
export function actsOfType(tenantId: string, projectId: string, actType: string): { actId: string }[] {
  return actRows(tenantId, projectId).filter((row) => row.actType === actType);
}

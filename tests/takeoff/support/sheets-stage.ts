/**
 * The mechanics the sheet-index acceptance runs on (R-TO-004, R-TO-001, L-ACT-01/02, L-REG-03).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts and
 * the projects come from the upload seam's own stage; the recorded drawing and the stand-in for the
 * `cad/` CLI come from the ingest pipeline's; the artifact reader and the raster shapes come from the
 * thumbnails increment's. One invariant, one home (B-17, ARCH-02). What this file adds is what a
 * sheet index needs beyond a raster — the committed `fixtures/rcc6` corpus carried through the real
 * extractor once, a project a person may actually act on, and the readers the criteria derive their
 * expectations with.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance.
 *
 * Nothing here reads product source: every name below is one the increment's interface list, its
 * test contract or a committed Design Decision publishes.
 */
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { expect } from "vitest";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { closeStage, enrol, openStage, sql, sqlValue, stageProject, type Person } from "../../spine/uploads/support/upload-stage";
import {
  corpusBytes,
  productModule,
  REPO_ROOT,
  stageDrawing,
  stubCli,
  tempDir,
  unique,
  withCadCommand,
  INGEST_MODULE,
  type IngestRecord,
  type IngestSeam,
  type JsonValue,
  type StagedDrawing,
} from "./ingest-stage";
import { artifactOf, storageOf, THUMBNAILS_MODULE, type ArtifactGraph, type ArtifactLayout, type SheetRasters, type StorageLike, type ThumbnailsSeam } from "./thumbnails-stage";

export { closeStage, enrol, stageProject, artifactOf, storageOf, productModule, tempDir, unique, REPO_ROOT, THUMBNAILS_MODULE, INGEST_MODULE };
export type { ArtifactGraph, ArtifactLayout, IngestRecord, JsonValue, Person, SheetRasters, StagedDrawing, StorageLike, ThumbnailsSeam };

/* ------------------------------------------------------------------ the homes the spec names */

/** The module doors this increment publishes (increment interfaces). */
export const SHEETS_MODULE = "src/modules/takeoff/sheets/index.ts";
export const CORE_SHEETS_MODULE = "src/core/sheets/index.ts";
export const ACTS_MODULE = "src/core/acts/index.ts";
export const ERRORS_MODULE = "src/core/errors.ts";
export const TAKEOFF_ROUTER_MODULE = "src/server/routers/takeoff.ts";
export const INGEST_HANDLER_MODULE = "src/worker/handlers/ingest.ts";
export const JOBS_MODULE = "src/core/jobs/index.ts";
export const OFFERED_GROUP_BARREL = "src/ui/patterns/offered-group/index.ts";

/** The route directory the ownership list and the Design Decision spell (S-Drawings §1). */
export const ROUTE_DIR = "src/app/(app)/t/[tenant]/p/[project]/drawings";

/** The act type, the permission it moves and the refusal this increment registers. */
export const CONFIRM_DISCIPLINE = "CONFIRM_DISCIPLINE";
export const MEASURE = "MEASURE";
export const GROUP_NOT_OFFERED = "GROUP_NOT_OFFERED";
export const CONSEQUENCES_NOT_CARRIED = "CONSEQUENCES_NOT_CARRIED";

/** The role that carries every permission, so a staged actor may act at all (L-ACT-03). */
export const PRINCIPAL = "PRINCIPAL";

/** The committed corpus AC-1 names, and the format a stored `.dxf` is recorded under. */
export const RCC6_DXF = join("fixtures", "rcc6", "rcc6.dxf");
export const RCC6_MANIFEST = join("fixtures", "rcc6", "manifest.json");
export const RCC6_FORMAT = "dxf";

/* ------------------------------------------------------------------ the shapes the seams answer in */

/** What the title-block grammar answers for one sheet (increment interfaces: `SheetProposal`). */
export type SheetProposal = {
  number: string | null;
  title: string;
  discipline: string;
  basis: string;
  cited: string[];
};

/** One card of the index (increment interfaces: `SheetCard`). */
export type SheetCard = {
  sheetId: string;
  drawingId: string;
  ingestId: string;
  layoutName: string;
  kind: string;
  format: string;
  scheme: string;
  thumbnail: { url: string; width: number; height: number } | null;
  proposal: SheetProposal;
  confirmed: { discipline: string; actId: string } | null;
  scaleState: string;
  viewCount: number | null;
  facts: Record<string, number | boolean>;
};

/** The typed grouping key over a closed enum (L-ACT-02, increment interfaces: `OfferedGroupKey`). */
export type OfferedGroupKey = {
  kind: string;
  discipline: string;
  drawingId?: string;
  sheetId?: string;
};

/** One group the machine offers, with its membership resolved server-side (R-UI-023). */
export type OfferedGroup = { key: OfferedGroupKey; label: string; members: string[] };

/** The door src/modules/takeoff/sheets publishes. */
export type SheetsSeam = {
  sheetIndexOf: (scope: { tenantId: string; projectId: string }) => Promise<SheetCard[]>;
  offeredGroupsOf: (scope: { tenantId: string; projectId: string }) => Promise<OfferedGroup[]>;
};

/** The pure core the grammar and the sheet identity live in (increment interfaces). */
export type CoreSheetsSeam = {
  DISCIPLINES: readonly string[];
  SCALE_STATES: readonly string[];
  PROPOSAL_BASES: readonly string[];
  FIDELITY_FACTS: readonly string[];
  readTitleBlock: (graph: unknown, layoutName: string) => SheetProposal;
  sheetIdOf: (ingestId: string, layoutName: string) => string;
  parseSheetId: (sheetId: string) => { ingestId: string; layoutName: string } | null;
};

/** L-ACT-02's Consequence, as a caller of the seam reads one. */
export type ConsequenceLike = {
  actType: string;
  tenantId: string;
  projectId: string;
  rendering: string;
  subjects: { subjectId: string; subjectLabel?: string; before: readonly string[]; after: readonly string[] }[];
};

/** Who is acting (SEAM-ACT: `ActorCtx`). */
export type ActorCtx = { tenantId: string; userId: string; actorKind: string };

/** What a confirmation asks for (increment interfaces: `ConfirmDisciplineInput`). */
export type ConfirmDisciplineInput = { type: string; projectId: string; group: OfferedGroupKey };

/** SEAM-ACT through the surface this acceptance drives it by. */
export type ActsSeam = {
  ACT_TYPES: readonly string[];
  ACT_PERMISSION: Record<string, string>;
  consequenceDigest: (consequence: ConsequenceLike) => string;
  preview: (ctx: ActorCtx, input: ConfirmDisciplineInput) => Promise<ConsequenceLike>;
  commit: (ctx: ActorCtx, input: ConfirmDisciplineInput, carriedDigest: string) => Promise<{ actId: string; consequenceDigest: string; consequence: ConsequenceLike }>;
};

/** One registered refusal, as src/core/errors.ts publishes it. */
export type RefusalEntryShape = { code: string; message: string; remedy: string; severity: string; surface: string };

/** The register itself. */
export type ErrorsSeam = { REFUSALS: Record<string, RefusalEntryShape | undefined> };

/** SEAM-JOBS through the surface a chained job is observed by. */
export type JobsLike = {
  registerJobHandler: (kind: string, handler: (payload: unknown, progress: unknown) => Promise<void>) => void;
  startJobsRuntime: (databaseUrl: string) => Promise<unknown>;
  stopJobsRuntime: () => Promise<unknown>;
};

/** The composition root the worker calls before it consumes (increment interfaces). */
export type IngestHandlerModule = { registerIngestHandler: () => void };

/* ------------------------------------------------------------------ the stage */

/** The scratch database and the scratch storage root every suite of this increment runs over. */
export async function openSheetsStage(): Promise<{ urlMigrate: string; urlApp: string; root: string }> {
  const { db, root } = await openStage();
  return { urlMigrate: db.urlMigrate, urlApp: db.urlApp, root };
}

/** A person with a project of their own, made through the shipped sign-up door and the store. */
export async function stagePerson(label: string): Promise<{ person: Person; projectId: string }> {
  const person = await enrol(label);
  return { person, projectId: stageProject(person.tenantId, `Sheets ${label}`) };
}

/**
 * Put a person on a project holding a role. The act seam reads what somebody holds out of
 * `participant_roles` minus the withdrawals that countermand it (L-ACT-03), so a staged actor is
 * staged there — never by loosening a guard.
 */
export function grantRole(tenantId: string, projectId: string, userId: string, role: string): void {
  sql(
    `insert into ${ident("participants")} (${ident(TENANT_COLUMN)}, project_id, user_id)
       values (${lit(tenantId)}::uuid, ${lit(projectId)}::uuid, ${lit(userId)}::uuid) on conflict do nothing;`,
  );
  sql(
    `insert into ${ident("participant_roles")} (${ident(TENANT_COLUMN)}, project_id, user_id, role)
       values (${lit(tenantId)}::uuid, ${lit(projectId)}::uuid, ${lit(userId)}::uuid, ${lit(role)});`,
  );
}

/**
 * Put a person on somebody else's workspace, so two real accounts can act on one project. The
 * roster is `memberships`, and the workspace role lives in its own column (the members increment's
 * `workspace_role`).
 */
export function joinWorkspace(tenantId: string, userId: string, role = "MEMBER"): void {
  sql(
    `insert into ${ident("memberships")} (${ident(TENANT_COLUMN)}, user_id, ${ident("workspace_role")})
       values (${lit(tenantId)}::uuid, ${lit(userId)}::uuid, ${lit(role)}) on conflict do nothing;`,
  );
}

/** A human actor, as SEAM-ACT is given one. */
export function actorOf(person: Person): ActorCtx {
  return { tenantId: person.tenantId, userId: person.userId, actorKind: "human" };
}

/* ------------------------------------------------------------------ the corpus, through the extractor */

let extracted: Promise<string> | undefined;

/**
 * `fixtures/rcc6/rcc6.dxf` as EntityGraph v2, produced by the product's own `cad/` CLI.
 *
 * Run once per file and memoised: the sheets a card is made of, the title-block text a proposal is
 * read from and the counters a fidelity fact reports are all facts OF THIS CORPUS, and the only
 * honest way to hold the product to them is to let the shipped extractor state them. Every
 * expectation below is derived from the artifact this returns, so a corpus or an extractor that
 * changes changes the expectations with it rather than leaving a transcription behind (B-19).
 */
export async function rcc6Artifact(): Promise<string> {
  return (extracted ??= (async () => {
    const ingest = await productModule<IngestSeam>(INGEST_MODULE);
    const bytes = corpusBytes(RCC6_DXF);
    const outcome = await withCadCommand(undefined, async () => ingest.ingestDrawing(bytes, RCC6_FORMAT, { tempDir: tempDir("rcc6") }));
    expect(outcome.ok, `the shipped cad CLI read ${RCC6_DXF}: ${outcome.ok ? "" : `${outcome.refusal} — ${outcome.detail}`}`).toBe(true);
    return new TextDecoder().decode((outcome as { artifact: Uint8Array }).artifact);
  })());
}

/**
 * A stored drawing of the rcc6 corpus with an ingest record beside it, written by the shipped ingest
 * job over the artifact the real extractor produced.
 *
 * The CLI is stood in for on the second and later drawings rather than re-run: the artifact is the
 * same bytes either way, and a `uv run` per staged drawing would spend minutes proving nothing this
 * increment is about (the thumbnails increment's `stageIngested` precedent).
 */
export async function stageSheets(person: Person, projectId: string, label = "rcc6"): Promise<{ drawing: StagedDrawing; record: IngestRecord; graph: ArtifactGraph }> {
  const ingest = await productModule<IngestSeam>(INGEST_MODULE);
  const artifact = await rcc6Artifact();
  const drawing = await stageDrawing(person, projectId, corpusBytes(RCC6_DXF), { name: unique(`${label}.dxf`), format: RCC6_FORMAT });
  const stub = stubCli({ artifact, stderr: "", exitCode: 0 });

  await withCadCommand(stub.command, async () => {
    await ingest.runIngestJob(
      { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
      { jobId: unique(`ingest-${label}`), tempDir: tempDir("ingest"), step: async () => undefined },
      { storage: await storageOf() },
    );
  });

  const record = await ingest.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
  expect(record, `staging ${label}.dxf left no ingest record — a sheet card is a reading of a record`).not.toBeNull();
  const graph = await artifactOf(await storageOf(), person.tenantId, record as IngestRecord);
  return { drawing, record: record as IngestRecord, graph };
}

/** One run of the shipped raster job over a staged drawing, so its sheets have thumbnails. */
export async function renderRasters(person: Person, drawing: StagedDrawing, record: IngestRecord): Promise<void> {
  const thumbnails = await productModule<ThumbnailsSeam>(THUMBNAILS_MODULE);
  await thumbnails.runThumbnailsJob(
    { tenantId: person.tenantId, drawingId: drawing.drawingId, ingestId: record.ingestId, requestedBy: person.userId },
    { jobId: unique("raster-job"), tempDir: tempDir("rasters"), step: async () => undefined },
    { storage: await storageOf() },
  );
}

/** What the raster seam serves for a drawing — the tiers a card's thumbnail is one of. */
export async function rastersOf(person: Person, drawingId: string): Promise<SheetRasters[]> {
  const thumbnails = await productModule<ThumbnailsSeam>(THUMBNAILS_MODULE);
  return thumbnails.sheetRastersOf({ tenantId: person.tenantId, drawingId });
}

/* ------------------------------------------------------------------ reading the corpus */

/** The sheet names the committed manifest declares — the fixture identity, imported, never retyped. */
export function manifestSheetNames(): string[] {
  const path = join(REPO_ROOT, RCC6_MANIFEST);
  expect(existsSync(path), `${RCC6_MANIFEST} is part of the declared fixture corpus`).toBe(true);
  const manifest = JSON.parse(readFileSync(path, "utf8")) as { sheets?: { name?: unknown }[] };
  const names = (manifest.sheets ?? []).map((sheet) => String(sheet.name ?? ""));
  expect(names.length, `${RCC6_MANIFEST} declares the sheets this corpus carries`).toBeGreaterThan(0);
  return names;
}

/** One text record of the artifact, as the grammar's clause describes them (TEXT/MTEXT). */
export type TextRecord = { key: string; text: string; height: number; layer: string; space: string };

/** Every text the artifact puts on one sheet, in artifact order. */
export function textsOf(graph: ArtifactGraph, layoutName: string): TextRecord[] {
  const records = (graph.entities ?? []) as { type?: unknown; space?: unknown; text?: unknown; height?: unknown; layer?: unknown; key?: unknown }[];
  return records
    .filter((record) => (record.type === "TEXT" || record.type === "MTEXT") && record.space === layoutName)
    .map((record) => ({
      key: String(record.key ?? ""),
      text: String(record.text ?? "").replace(/%%\w?/g, ""),
      height: Number(record.height ?? 0),
      layer: String(record.layer ?? ""),
      space: String(record.space ?? ""),
    }));
}

/** Every entity key the artifact carries — what a cited key has to be one of (R-TO-004). */
export function entityKeysOf(graph: ArtifactGraph): Set<string> {
  const keys = new Set<string>();
  for (const record of [...((graph.entities ?? []) as { key?: unknown }[]), ...((graph.derived ?? []) as { key?: unknown }[])]) {
    if (typeof record.key === "string") keys.add(record.key);
  }
  return keys;
}

/**
 * The sheet number the title block of one layout states, read out of the corpus itself: the `n` of
 * its `SHEET n OF m` line. AC-1's expectation is derived here rather than transcribed, so a corpus
 * that renumbers its sheets renumbers the expectation with it (B-19).
 */
export function sheetNumberOnSheet(graph: ArtifactGraph, layoutName: string): string | null {
  for (const record of textsOf(graph, layoutName)) {
    const said = /\bSHEET\s+(\d+)\s+OF\s+(\d+)\b/i.exec(record.text);
    if (said !== null && said[1] !== undefined) return said[1];
  }
  return null;
}

/**
 * Which layout of the artifact IS the sheet the manifest names: the layout of that name, or — where
 * a corpus names its layouts differently — the one whose largest text is that title, which is the
 * grammar's own rule for what a sheet is called. Deliberately not "any layout carrying that text":
 * model space carries every sheet's annotations, so a text search there answers the wrong sheet.
 */
export function layoutBearing(graph: ArtifactGraph, title: string): ArtifactLayout | null {
  const named = graph.layouts.find((layout) => layout.name === title);
  if (named !== undefined) return named;
  for (const layout of graph.layouts) {
    const texts = textsOf(graph, layout.name);
    const tallest = [...texts].sort((left, right) => right.height - left.height)[0];
    if (tallest !== undefined && tallest.text.trim() === title) return layout;
  }
  return null;
}

/** The bounding box a layout declares, or null where it declares none (the raster stage's reading). */
export function bboxOfLayout(layout: ArtifactLayout): unknown {
  const bbox = layout.bbox;
  return bbox === null || bbox === undefined || typeof bbox !== "object" || Array.isArray(bbox) ? null : bbox;
}

/** The drawing unit the artifact states, or null when it states none (`insunits.unit`). */
export function drawingUnitOf(graph: ArtifactGraph): string | null {
  const insunits = (graph as { insunits?: unknown }).insunits;
  if (insunits === null || insunits === undefined || typeof insunits !== "object") return null;
  const unit = (insunits as { unit?: unknown }).unit;
  return typeof unit === "string" && unit !== "" ? unit : null;
}

/**
 * Whether a fidelity counter the record holds says anything was lost at all. The record states
 * `explode_losses` and `flatten_capped` as maps and `strays_rejected` as a number, and a card carries
 * one number or one boolean per name — so what a card may be held to across those shapes is whether
 * it agrees with the record about there being something to report.
 */
export function reportsSomething(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value !== null && typeof value === "object") return Object.keys(value as object).length > 0;
  return false;
}

/** The same question of a card's own fact value. */
export function factReportsSomething(value: number | boolean): boolean {
  return typeof value === "boolean" ? value : value > 0;
}

/** The counters row the record holds for one sheet, or an empty reading where it holds none. */
export function countersFor(record: IngestRecord, layoutName: string): { explode_truncated?: unknown; explode_losses?: unknown; flatten_capped?: unknown } {
  return record.facts.counters.find((row) => row.space === layoutName) ?? {};
}

/** The strays the record says it rejected on one sheet. */
export function straysOn(record: IngestRecord, layoutName: string): number {
  return Number(record.facts.layouts.find((row) => row.name === layoutName)?.strays_rejected ?? 0);
}

/**
 * The fidelity facts a card OWES, derived from the record itself rather than from the roster the
 * product publishes.
 *
 * R-TO-001 shows the extractor's loss counters on the sheet card as named facts, and this
 * increment's own scope note says the roster is derived from what the record's facts carry. So the
 * names owed are the counter fields of the record: a layouts row minus the identity it is a row FOR
 * (`name`, `kind`), a counters row minus the space it is a row FOR (`space`), and the record-level
 * losses — a root field reported as a plain list of names, which is what a dropped layout is. The
 * unit reading (`insunits`) and the two inventories are structure, not loss, and are excluded by
 * name.
 *
 * Judging `FIDELITY_FACTS` against THIS rather than against the cards it feeds is the whole point: a
 * roster that stopped naming a counter the extractor still reports would otherwise agree with cards
 * that dropped it too, and a corpus that never trips that counter would never notice. A counter the
 * extractor starts reporting becomes a fact the index owes with no edit here (B-19).
 */
export function factNamesOfRecord(record: IngestRecord): string[] {
  const names = new Set<string>();

  const layouts = record.facts.layouts as unknown as Record<string, unknown>[];
  expect(layouts.length, "the record inventoried the layouts it read, so its per-layout counters can be named").toBeGreaterThan(0);
  for (const row of layouts) for (const key of Object.keys(row)) if (key !== "name" && key !== "kind") names.add(key);

  const counters = record.facts.counters as unknown as Record<string, unknown>[];
  expect(counters.length, "the record holds a counters row per space it read, so its per-space counters can be named").toBeGreaterThan(0);
  for (const row of counters) for (const key of Object.keys(row)) if (key !== "space") names.add(key);

  for (const [key, value] of Object.entries(record.facts as unknown as Record<string, unknown>)) {
    if (key === "layouts" || key === "counters" || key === "insunits") continue;
    if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) names.add(key);
  }

  expect(names.size, "the record names counters a fidelity fact reports — with none there is no roster to hold anything to").toBeGreaterThan(0);
  return byCodePoint([...names]);
}

/**
 * What the record itself states about one fact on one sheet: the per-layout counter where a layouts
 * row carries that name, the per-space counter where a counters row does, else the record-level
 * field. The counterpart of `factNamesOfRecord` — the value the card's own fact is held to.
 */
export function recordFactValue(record: IngestRecord, layoutName: string, name: string): unknown {
  const layout = (record.facts.layouts as unknown as Record<string, unknown>[]).find((row) => row["name"] === layoutName);
  if (layout !== undefined && name in layout) return layout[name];
  const counter = (record.facts.counters as unknown as Record<string, unknown>[]).find((row) => row["space"] === layoutName);
  if (counter !== undefined && name in counter) return counter[name];
  return (record.facts as unknown as Record<string, unknown>)[name];
}

/** The law itself, as the one authority outside the product a closed enum can be judged against. */
export const BIBLE = join("docs", "specs", "cubit.bible.xml");

/**
 * The disciplines R-TO-004 names, read out of the Bible clause that names them.
 *
 * A chip roster or a proposal enum checked against the product's own `DISCIPLINES` export compares
 * two values the same build controls; a truncated enum agrees with a correspondingly truncated
 * screen. The clause is immutable in sessions (CLAUDE.md's Law), and it spells the roster in the
 * parenthesis after "discipline proposal" — so this is a derivation from the law, not a list typed
 * here (B-19, the R-UI-001 colour-table precedent).
 */
export function disciplinesFromBible(): string[] {
  const path = join(REPO_ROOT, BIBLE);
  expect(existsSync(path), `${BIBLE} is the law a closed enum is read from`).toBe(true);
  const clause = /<requirement id="R-TO-004"[^>]*>([\s\S]*?)<\/requirement>/.exec(readFileSync(path, "utf8"));
  expect(clause, "R-TO-004 is a clause of the Bible").not.toBeNull();
  const named = /discipline proposal \(([^)]+)\)/.exec((clause as RegExpExecArray)[1] ?? "");
  expect(named, "R-TO-004 names the disciplines a sheet's discipline may be proposed at").not.toBeNull();
  const values = ((named as RegExpExecArray)[1] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
  expect(values.length, "R-TO-004's discipline roster carries more than one name").toBeGreaterThan(1);
  return values;
}

/* ------------------------------------------------------------------ reading the store */

/** Every act row of one project, newest last, as the acceptance's own audit read. */
export function actRows(tenantId: string, projectId: string): { actId: string; actType: string; subjects: string[] }[] {
  const rows = sql(
    `select act_id::text, act_type, subjects::text from ${ident("acts")}
       where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and project_id = ${lit(projectId)}::uuid
       order by occurred_at;`,
  );
  return rows.map((row) => ({ actId: row[0] ?? "", actType: row[1] ?? "", subjects: JSON.parse(row[2] ?? "[]") as string[] }));
}

/** Every confirmation row this increment's table holds for one project. */
export function disciplineRows(tenantId: string, projectId: string): { ingestId: string; layoutName: string; discipline: string; actId: string }[] {
  const rows = sql(
    `select ingest_id::text, layout_name, discipline, act_id::text from ${ident("sheet_disciplines")}
       where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and project_id = ${lit(projectId)}::uuid
       order by created_at;`,
  );
  return rows.map((row) => ({ ingestId: row[0] ?? "", layoutName: row[1] ?? "", discipline: row[2] ?? "", actId: row[3] ?? "" }));
}

/** How many rows a table holds for one workspace — the "nothing was written" reading. */
export function rowCount(table: string, tenantId: string): number {
  return Number(sqlValue(`select count(*)::text from ${ident(table)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid;`));
}

/** The workspace a project belongs to, read as data so no screen is walked to learn it. */
export function tenantOfWorkspace(name: string): string {
  return sqlValue(`select ${ident(TENANT_COLUMN)}::text from ${ident("tenants")} where name = ${lit(name)} limit 1;`);
}

/* ------------------------------------------------------------------ small helpers */

/** The value a call rejected with, or null when it resolved — a resolution is its own failure. */
export async function rejection(call: Promise<unknown>): Promise<unknown> {
  return call.then(
    () => null,
    (failure: unknown) => failure,
  );
}

/** Sorted by code point: `localeCompare` is not available to this tree (L-REG-05). */
export function byCodePoint(values: readonly string[]): string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** The address part of a signed URL — everything a lifetime and a signature do not decide. */
export function addressOf(url: string): string {
  const parsed = new URL(url, "http://sheets.invalid");
  return `${parsed.pathname}`;
}

/* ------------------------------------------------------------------ the served product */

/** A built product answering on a port of its own. */
export type ServedApp = { origin: string; stop: () => void };

let served: ServedApp | undefined;
let child: ChildProcess | undefined;

/** A free port, taken by asking the kernel for one and giving it straight back. */
async function freePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => (address !== null && typeof address === "object" ? resolve(address.port) : reject(new Error("no port"))));
    });
  });
}

/**
 * Build the product once into a dist directory of its own (so `git status` stays clean) and serve it
 * on a free port against this file's scratch database and storage root — the deployment stating its
 * own address, which is what a cookie-authenticated mutation's origin check is judged against
 * (R-SPINE-006). The members increment's `serveApp` is the shape; this one inherits the storage root
 * and the signing secret the stage already published, so a signed raster URL minted in the server
 * verifies in the suite and the other way round.
 */
export async function serveStagedApp(distDir: string): Promise<ServedApp> {
  if (served !== undefined) return served;
  expect(typeof process.env["DATABASE_URL"], "the scratch database is open before the product is served").toBe("string");

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const next = join(REPO_ROOT, "node_modules", ".bin", "next");
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  env["NEXT_DIST_DIR"] = distDir;
  env["CUBIT_PUBLIC_ORIGIN"] = origin;
  // NODE_ENV=test makes `next build` skip devDependency paths; the built product is production.
  delete env["NODE_ENV"];
  const childEnv = env as unknown as NodeJS.ProcessEnv;

  const built = spawnSync(next, ["build"], { cwd: REPO_ROOT, env: childEnv, encoding: "utf8", timeout: 420_000 });
  expect(built.status, `next build failed:\n${(built.stderr || built.stdout || "").slice(-1500)}`).toBe(0);

  const started = spawn(next, ["start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: REPO_ROOT, env: childEnv, stdio: "ignore" });
  child = started;
  const startedAt = Date.now();
  for (;;) {
    try {
      const answer = await fetch(origin, { signal: AbortSignal.timeout(2000) });
      if (answer.status < 500) break;
    } catch {
      /* not answering yet */
    }
    if (Date.now() - startedAt > 120_000) {
      started.kill("SIGKILL");
      throw new Error("next start did not answer within 120s");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  served = { origin, stop: () => started.kill("SIGKILL") };
  return served;
}

/** Stop whatever this file started. */
export function stopStagedApp(): void {
  child?.kill("SIGKILL");
  child = undefined;
  served = undefined;
}

/** One page, fetched as a person holding this session, following the redirects a browser follows. */
export async function fetchPage(origin: string, path: string, cookie: string | null): Promise<{ status: number; url: string; html: string }> {
  const headers: Record<string, string> = { accept: "text/html" };
  if (cookie !== null) headers["cookie"] = cookie;
  const answer = await fetch(`${origin}${path}`, { headers, redirect: "follow" });
  return { status: answer.status, url: answer.url, html: await answer.text() };
}

/** The address of the screen under test (increment interfaces: `drawingsRoute`). */
export function drawingsPath(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/drawings`;
}

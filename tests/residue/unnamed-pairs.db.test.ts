/**
 * I-613, through the store: the pairs F-RCC6-BNBC's plans draw as a beam and no mark names are
 * written with the partition (`placement_unnamed_pairs`, migration 0068) and read back by the residue
 * for the record the campaign's pin measured — each by the plan that draws it and the sheet that plan
 * stands on — so the certificate can ENUMERATE them (L-QTY-04, L-QTY-07).
 *
 * WHAT IS READ AND NOTHING IS STAGED FROM A MODEL: the drawing is read by the shipped `cad/` CLI and
 * the partition's pure stages, recorded as the pinned drawing's record by the shipped ingest job over a
 * stand-in CLI answering exactly that artifact, and written by `rewritePartition` — the partition's one
 * transaction — exactly as `channels-layout.db.test.ts` stages it. Every expectation is read off the
 * stages' own answer (B-19).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ident, lit } from "../../db/__tests__/support/live-sql";
import { TENANT_COLUMN } from "../../db/__tests__/support/fixtures";
import { COLUMN_CONCRETE_PAIR, closeStage, productModule, stageCampaign, type StagedCampaign } from "../takeoff/rails/support/column-rail-stage";
import { INGEST_JOB_MODULE, INGEST_MODULE, UPLOADS_MODULE, stubCli, tempDir, withCadCommand } from "../takeoff/support/ingest-stage";
import { BNBC_DXF, stagesOver, type StagesRead } from "../takeoff/partition/support/bnbc-stages";
import { sql } from "../spine/uploads/support/upload-stage";

const BUDGET_MS = 600_000;
const RESIDUE_MODULE = "src/core/residue/index.ts";
const PARTITION_STORE_MODULE = "src/modules/takeoff/partition/store.ts";

type UnnamedRow = { drawingId: string; viewKey: string; caption: string; layoutName: string; edgeKeys: [string, string]; width: string; gridLetter: string | null; gridNumeral: string | null };
type ResidueDoor = { residueOf: (scope: { tenantId: string; projectId: string }) => Promise<{ input: { unnamed?: UnnamedRow[] } }> };
type PartitionStore = { rewritePartition: (write: Record<string, unknown>) => Promise<unknown> };
type IngestJobDoor = { runIngestJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> };
type IngestDoor = { ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> };
type UploadsDoor = { uploadStorage: () => unknown };

let read: StagesRead;
let staged: StagedCampaign;
let drawingId: string;
let ingestId: string;
let store: PartitionStore;

/** The partition of the pinned record, written by its one transaction with the placements handed. */
async function rewrite(placed: StagesRead["placed"]): Promise<void> {
  await store.rewritePartition({
    tenantId: staged.tenantId,
    projectId: staged.projectId,
    drawingId,
    ingestId,
    views: read.evidence.views,
    assignments: read.evidence.assignments,
    proposals: new Map(),
    conventions: null,
    grid: null,
    schedules: null,
    placements: placed,
    expansion: null,
    proposal: null,
  });
}

/** The rows the store holds for the record, as `view first-edge width`. */
function storedRows(): string[] {
  return sql(
    `select view_key, edge_key_a, width::text from placement_unnamed_pairs
      where ${ident(TENANT_COLUMN)} = ${lit(staged.tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid order by view_key, edge_key_a;`,
  ).map((row) => `${row[0] ?? ""} ${row[1] ?? ""} ${row[2] ?? ""}`);
}

beforeAll(async () => {
  read = await stagesOver(BNBC_DXF);
  staged = await stageCampaign("frm4ad-unnamed", { methods: [COLUMN_CONCRETE_PAIR], objects: 0 });
  const held = sql(`select manifest::text from drawing_set_revisions where ${ident(TENANT_COLUMN)} = ${lit(staged.tenantId)}::uuid and set_revision_id = ${lit(staged.setRevisionId)}::uuid;`);
  const manifest = JSON.parse(held[0]?.[0] ?? "[]") as { drawingId: string }[];
  drawingId = (manifest[0] as { drawingId: string }).drawingId;

  const stub = stubCli({ artifact: JSON.stringify(read.graph), stderr: "", exitCode: 0 });
  const job = await productModule<IngestJobDoor>(INGEST_JOB_MODULE);
  const storage = (await productModule<UploadsDoor>(UPLOADS_MODULE)).uploadStorage();
  await withCadCommand(stub.command, () =>
    job.runIngestJob(
      { tenantId: staged.tenantId, drawingId, requestedBy: staged.person.userId, declared: null },
      { jobId: randomUUID(), tempDir: tempDir("frm4ad-unnamed"), step: async () => undefined },
      { storage },
    ),
  );
  const record = await (await productModule<IngestDoor>(INGEST_MODULE)).ingestRecordOf({ tenantId: staged.tenantId, drawingId });
  ingestId = (record as { ingestId: string }).ingestId;
  store = await productModule<PartitionStore>(PARTITION_STORE_MODULE);
  await rewrite(read.placed);
}, BUDGET_MS);

afterAll(async () => {
  await closeStage();
}, 120_000);

describe("I-613: the unnamed pairs are stored with the partition and enumerated by the residue", () => {
  test("the store holds exactly the pairs the stage enumerated, key for key", () => {
    const expected = (read.placed.unnamed ?? []).map((pair) => `${pair.viewKey} ${pair.edgeKeys[0]} ${pair.width}`).sort();
    expect(expected.length, "the stage enumerates F-RCC6-BNBC's unnamed pairs (runs-sides-and-chains.test.ts grades which)").toBeGreaterThan(0);
    expect(storedRows().sort()).toEqual(expected);
  });

  test("the residue reads them for the pinned record, each by its plan's caption and the sheet it stands on", async () => {
    const door = await productModule<ResidueDoor>(RESIDUE_MODULE);
    const residue = await door.residueOf({ tenantId: staged.tenantId, projectId: staged.projectId });
    const unnamed = residue.input.unnamed ?? [];
    expect(unnamed.map((pair) => `${pair.viewKey} ${pair.edgeKeys[0]}`).sort(), "every stored pair of the record, and no other").toEqual(
      (read.placed.unnamed ?? []).map((pair) => `${pair.viewKey} ${pair.edgeKeys[0]}`).sort(),
    );
    const captionOf = new Map(read.evidence.views.map((view) => [`v:${view.viewKey}`, view.caption]));
    expect(unnamed.every((pair) => pair.caption === captionOf.get(pair.viewKey)), "each named by its plan's own caption").toBe(true);
    expect(new Set(unnamed.map((pair) => pair.drawingId)), "on the pinned drawing").toEqual(new Set([drawingId]));
    const tg1 = unnamed.find((pair) => pair.edgeKeys[0] === "DXF_HANDLE:D38");
    expect(tg1?.layoutName, "S-13's TG1 stands on the sheet its plan does").not.toBe("");
  });

  test("a rebuild that reads none leaves none: the rows are rewritten with the partition (L-REG-04)", async () => {
    await rewrite({ ...read.placed, unnamed: [] });
    expect(storedRows()).toEqual([]);
    await rewrite(read.placed);
    expect(storedRows().length).toBe((read.placed.unnamed ?? []).length);
  });
});

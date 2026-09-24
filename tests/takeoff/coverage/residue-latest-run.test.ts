/**
 * A run's observation stands until a later run of the campaign answers the same question otherwise
 * (s-coverage I-615; L-QTY-05, L-ACT-01) — walk-1 N1, staged whole through the product's doors.
 *
 * WHY. `rail_observations` is append-only per campaign: a report is written once, under what it
 * says, and nothing ever retires it. The residue read ALL of a campaign's reports, so the first run's
 * "nobody has affirmed the scale of COLUMN LAYOUT PLAN" outlived the affirmation that ended it: the
 * walker affirmed S-10's view at Dimension ratio, measured again, and the register's
 * deferred-and-refused region still named the view — after a reload too. The second run DID read the
 * view at its affirmed scale; it answered its columns with another reason, and that answer was the one
 * the reader never chose.
 *
 * The walker's path, in the product's own doors: F-RCC6-BNBC's DWG read by the shipped `cad/` CLI, the
 * shipped ingest and partition jobs, every proposed discipline confirmed, the set pinned (no level
 * stack authored — a fresh project), measured by the shipped job over the shipped rails and gate;
 * then S-10's COLUMN LAYOUT PLAN affirmed at Dimension ratio and measured again; then the two pile
 * layouts affirmed and measured a third time, which is where lines publish — piles stand in the
 * FOUNDATION slot and want no storey, while the columns of a project with no stack stand on no level
 * and are reported for the range of floors nobody stated (TYPICAL_RANGE_UNSTATED, against the view;
 * I-667), which the second run now says.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { INGEST_JOB_MODULE, corpusBytes, tempDir, withCadCommand } from "../support/ingest-stage";
import { actsSeam } from "../sets/support/sets-stage";
import { storageOf } from "../partition/support/partition-stage";
import {
  closeStage,
  field,
  pinRevisionNaming,
  productModule,
  registerObjectRows,
  runPlacementPartition,
  said,
  stageArtifactIngest,
  stagePlacementProject,
  storeRows,
  type PlacementStage,
  type StoreRow,
} from "../partition/support/placement-stage";

/** A cold `uv run` over the DWG, the partition, and three measurements. */
const BUDGET_MS = 600_000;

/** The drawing the walker uploaded (walk-1 N1's repro). */
const BNBC_DWG = "fixtures/rcc6-bnbc/rcc6-bnbc.dwg";

/** The reason a member of an unaffirmed view is reported under (L-MEA-05). */
const SCALE = "VIEW_SCALE_UNAFFIRMED";

/** The rank the walker affirmed at ("Affirm at Dimension ratio"). */
const DIMENSION_RATIO = "DIMENSION_RATIO";

/** The views the walk names, by the caption a QS knows them by. */
const COLUMN_PLAN = "COLUMN LAYOUT PLAN";
const PILE_PLAN = "PILE LAYOUT PLAN";
const PILE_CAP_PLAN = "PILE CAP LAYOUT";

type Acts = {
  preview: (actor: unknown, input: unknown) => Promise<unknown>;
  commit: (actor: unknown, input: unknown, digest: string) => Promise<{ actId: string }>;
  consequenceDigest: (consequence: unknown) => string;
};

/** One view as the scale door answers it. */
type ViewScale = { viewKey: string; caption: string; proposals: readonly { rank: string }[] };

/** One row of the register's deferred-and-refused region. */
type Refusal = { code: string; objectKey: string; kind: string | null; deferral?: { subject: string; name: string } };

/** One observation as the residue reads it. */
type Absence = { class: string; kind: string; code: string | null; objectKey: string | null; source: string | null; view: string | null };

/** Preview and commit one act through the seam, as the dialog's Confirm does (L-ACT-02). */
async function perform(stage: PlacementStage, input: unknown): Promise<void> {
  const acts = (await actsSeam()) as unknown as Acts;
  const consequence = await acts.preview(stage.actor, input);
  await acts.commit(stage.actor, input, acts.consequenceDigest(consequence));
}

/** The re-expansion the lane's doors run after every act that moves the resolver's inputs. */
async function reexpand(stage: PlacementStage): Promise<void> {
  const seam = await productModule<{ reexpandProject: (scope: { tenantId: string; projectId: string }) => Promise<unknown> }>("src/modules/takeoff/partition/expansion/reexpand.ts");
  await seam.reexpandProject({ tenantId: stage.person.tenantId, projectId: stage.projectId });
}

/** One run of the shipped measure job with the production wiring (`measureDeps`: RAILS and the gate). */
async function measure(stage: PlacementStage, campaignId: string): Promise<void> {
  const job = await productModule<{ runMeasureJob: (payload: unknown, progress: unknown, deps: unknown) => Promise<void> }>("src/modules/takeoff/measure/job.ts");
  const handler = await productModule<{ measureDeps: () => unknown }>("src/worker/handlers/measure.ts");
  await job.runMeasureJob(
    { tenantId: stage.person.tenantId, projectId: stage.projectId, campaignId, requestedBy: stage.person.userId },
    { jobId: "residue-latest-run", step: async () => undefined },
    handler.measureDeps(),
  );
}

afterAll(async () => {
  await closeStage();
});

describe("an affirmed view is never reported unaffirmed: the residue reads each question's latest answer (I-615)", () => {
  let stage: PlacementStage;
  let scope: { tenantId: string; projectId: string };
  let drawingId: string;
  let setRevisionId: string;
  let campaignId: string;
  let views: ViewScale[];

  /** The view the scale door names under this caption. */
  function viewCaptioned(caption: string): ViewScale {
    const found = views.filter((view) => view.caption.startsWith(caption));
    expect(found.length, `the drawing carries exactly one view captioned ${caption}`).toBe(1);
    return found[0] as ViewScale;
  }

  /** The captions the register's deferred-and-refused region names a scale deferral under. */
  async function deferredViews(): Promise<string[]> {
    const register = await productModule<{ registerViewOf: (scope: unknown) => Promise<{ refusals: Refusal[] }> }>("src/modules/takeoff/register-ui/server.ts");
    return (await register.registerViewOf(scope)).refusals.filter((row) => row.code === SCALE && row.deferral?.subject === "VIEW").map((row) => row.deferral?.name ?? "");
  }

  /** What the residue reads as standing for this campaign. */
  async function absences(): Promise<Absence[]> {
    const residue = await productModule<{ reportedAbsencesOf: (scope: unknown, campaign: unknown) => Promise<{ observations: Absence[] }> }>("src/core/residue/index.ts");
    return (await residue.reportedAbsencesOf(scope, { campaignId, setRevisionId })).observations;
  }

  /** The register's members of one class sighted in one view (by its address, which ends in the view's key). */
  function membersIn(elementType: string, view: ViewScale): string[] {
    return registerObjectRows(scope.tenantId, setRevisionId)
      .filter((row) => said(row, "elementType", "element_type") === elementType && said(row, "viewKey", "view_key").endsWith(view.viewKey))
      .map((row) => said(row, "objectKey", "object_key"));
  }

  /** The campaign's quantity lines. */
  function lines(): StoreRow[] {
    return storeRows("quantity_lines", scope.tenantId).filter((row) => said(row, "campaignId", "campaign_id") === campaignId);
  }

  /** The campaign's stored reports, whole — the append-only table itself. */
  function reports(): StoreRow[] {
    return storeRows("rail_observations", scope.tenantId).filter((row) => said(row, "campaignId", "campaign_id") === campaignId);
  }

  beforeAll(async () => {
    stage = await stagePlacementProject("residue-latest-run");
    scope = { tenantId: stage.person.tenantId, projectId: stage.projectId };

    // The DWG, read by the shipped CLI (LibreDWG, then the extractor) and written by the shipped job.
    const ingest = await productModule<{
      ingestDrawing: (bytes: Uint8Array, format: string, options: { tempDir: string }) => Promise<{ ok: boolean; artifact?: Uint8Array; refusal?: string; detail?: string }>;
    }>(INGEST_JOB_MODULE);
    const outcome = await withCadCommand(undefined, async () => ingest.ingestDrawing(corpusBytes(BNBC_DWG), "dwg", { tempDir: tempDir("residue-latest-run") }));
    expect(outcome.ok, `the shipped cad CLI read ${BNBC_DWG}: ${outcome.ok ? "" : `${outcome.refusal} — ${outcome.detail}`}`).toBe(true);
    const staged = await stageArtifactIngest(stage, new TextDecoder().decode(outcome.artifact as Uint8Array), "residue-latest-run");
    drawingId = staged.drawingId;
    await runPlacementPartition(stage, staged, "residue-latest-run");

    // "Confirm the disciplines": every group the drawings screen offers for this drawing.
    const sheets = await productModule<{ offeredGroupsOf: (scope: unknown) => Promise<{ key: { kind: string; drawingId?: string } }[]> }>("src/modules/takeoff/sheets/index.ts");
    const groups = (await sheets.offeredGroupsOf(scope)).filter((group) => group.key.kind === "PROPOSED_DISCIPLINE" && group.key.drawingId === drawingId);
    expect(groups.length, "the drawing offers its proposed disciplines to confirm").toBeGreaterThan(0);
    for (const group of groups) await perform(stage, { type: "CONFIRM_DISCIPLINE", projectId: stage.projectId, group: group.key });

    setRevisionId = await pinRevisionNaming(stage, drawingId);
    await reexpand(stage);
    const campaigns = await productModule<{ campaignsOf: (scope: unknown) => Promise<StoreRow[]> }>("src/core/campaigns/index.ts");
    const campaign = (await campaigns.campaignsOf(scope)).find((row) => said(row, "setRevisionId", "set_revision_id") === setRevisionId);
    expect(campaign, "pinning the set opened its campaign").toBeTruthy();
    campaignId = String(field(campaign as StoreRow, "campaignId", "campaign_id"));

    const scale = await productModule<{ scaleProposalsOf: (scope: unknown, deps: unknown) => Promise<ViewScale[]> }>("src/modules/takeoff/scale/index.ts");
    views = await scale.scaleProposalsOf({ ...scope, drawingId }, { storage: await storageOf() });

    await measure(stage, campaignId);
  }, BUDGET_MS);

  test(
    "the first run measures nothing and defers every placed layout plan for want of a scale, each by its caption",
    async () => {
      expect(lines(), "no view has a scale of record, so nothing is measured").toEqual([]);
      const named = await deferredViews();
      for (const caption of [COLUMN_PLAN, PILE_PLAN, PILE_CAP_PLAN]) {
        expect(named.some((name) => name.startsWith(caption)), `the region names ${caption} (it names ${named.join(" | ")})`).toBe(true);
      }
      expect(membersIn("column", viewCaptioned(COLUMN_PLAN)).length, "S-10's columns stand in the register").toBeGreaterThan(0);
    },
    BUDGET_MS,
  );

  test(
    "S-10 affirmed at Dimension ratio: the second run answers its columns otherwise, and nothing reads them as unaffirmed",
    async () => {
      const column = viewCaptioned(COLUMN_PLAN);
      expect(column.proposals.map((proposal) => proposal.rank), "the scale door offers S-10's view at Dimension ratio").toContain(DIMENSION_RATIO);
      const columns = new Set(membersIn("column", column));
      const firstRunScale = reports().filter((row) => said(row, "code", "code") === SCALE && columns.has(said(row, "objectKey", "object_key"))).length;
      expect(firstRunScale, "the first run reported S-10's columns unaffirmed").toBeGreaterThan(0);

      await perform(stage, { type: "AFFIRM_SCALE", projectId: stage.projectId, drawingId, rank: DIMENSION_RATIO, viewKeys: [column.viewKey] });
      await measure(stage, campaignId);

      const named = await deferredViews();
      expect(named.some((name) => name.startsWith(COLUMN_PLAN)), `the region no longer names ${COLUMN_PLAN} (it names ${named.join(" | ")})`).toBe(false);
      expect(named.some((name) => name.startsWith(PILE_PLAN)), "a view nobody affirmed is still named: its answer stands").toBe(true);

      const standing = (await absences()).filter((row) => row.objectKey !== null && columns.has(row.objectKey) && row.kind === "rcc.concrete");
      expect(standing.filter((row) => row.code === SCALE), "no column of the affirmed view is read as standing unaffirmed").toEqual([]);
      // Measure less, and say so: the columns are still explained, by what the second run said of them.
      expect(new Set(standing.map((row) => row.objectKey)), "every column of S-10 still carries the reason it was not measured").toEqual(columns);
      expect(lines().filter((row) => columns.has(said(row, "objectKey", "object_key"))), "a project with no level stack measures no column: a member on no storey waits for its range (I-667)").toEqual([]);

      // The table is still append-only: the first run's words are kept, and the reader chose.
      expect(reports().filter((row) => said(row, "code", "code") === SCALE && columns.has(said(row, "objectKey", "object_key"))).length, "the first run's reports are still stored (L-ACT-01)").toBe(firstRunScale);
    },
    BUDGET_MS,
  );

  test(
    "the pile layouts affirmed: the third run publishes the piles, and neither pile view is named again",
    async () => {
      const piles = viewCaptioned(PILE_PLAN);
      const caps = viewCaptioned(PILE_CAP_PLAN);
      await perform(stage, { type: "AFFIRM_SCALE", projectId: stage.projectId, drawingId, rank: DIMENSION_RATIO, viewKeys: [piles.viewKey, caps.viewKey] });
      await measure(stage, campaignId);

      const pileKeys = new Set(membersIn("pile", piles));
      expect(pileKeys.size, "the pile layout places piles").toBeGreaterThan(0);
      const bored = lines().filter((row) => said(row, "class", "class") === "pile" && said(row, "kind", "kind") === "piling.bored");
      expect(new Set(bored.map((row) => said(row, "objectKey", "object_key"))), "every pile of the affirmed layout publishes its bored length").toEqual(pileKeys);

      const named = await deferredViews();
      expect(named.some((name) => name.startsWith(PILE_PLAN) || name.startsWith(PILE_CAP_PLAN)), `the region names neither pile view (it names ${named.join(" | ")})`).toBe(false);
      const capKeys = new Set(membersIn("pile_cap", caps));
      expect((await absences()).filter((row) => row.code === SCALE && row.objectKey !== null && capKeys.has(row.objectKey)), "no cap of the affirmed layout is read as unaffirmed").toEqual([]);
    },
    BUDGET_MS,
  );
});

/**
 * An affirmed scale on a fresh DWG measures its view, and a registered member that publishes no line
 * says why (I-667, I-668, I-669; L-MEA-05, L-CAD-07) — walk-2 BD-3, staged whole through the
 * product's doors.
 *
 * WHY. The walker made a fresh project from F-RCC6-BNBC's DWG, confirmed the disciplines, pinned the
 * set, measured (six views refused unaffirmed), affirmed S-10's COLUMN LAYOUT PLAN at Dimension
 * ratio, measured (the refusal went, 0 lines), inserted the proposed level stack and measured again:
 * still 0 lines, and the register's reasons named six view scales and ROOF's storey height — nothing
 * about the 27 columns of the view it had just affirmed. The coverage grid blamed "No band of this
 * member's schedule covers the level it stands on".
 *
 * What the store read back (project 4e6e12a1 in cubit_e2e): the affirmation was sound — a 64-hex
 * incoming calibration, and the outgoing `""` that is the stored spelling of "none" for a view no
 * earlier act named (I-564). The columns stood in the UNRESOLVED slot: the column plan's caption
 * ("COLUMN LAYOUT PLAN") states no range of floors, so the expansion deferred TYPICAL_RANGE_UNSTATED
 * and nobody had authored one. The column rail asked the band of a banded schedule about a member on
 * no storey, got nothing, and reported SECTION_BAND_UNCOVERED — sending the QS to the schedule — and
 * the register showed no rail report at all.
 *
 * And behind the range stood a second silence: with the range authored, every column still reported
 * SECTION_UNIT_UNSTATED. The DWG carries S-01's general notes cut to their last clause, so no
 * original declares the unit, and the title panel that prints `ALL DIMENSIONS IN mm U.N.O.` on every
 * sheet is paint of its INSERT, which the census never read (I-669).
 *
 * The walker's path, then the step the reason now names: the range of floors S-10 is typical of,
 * authored (GF to 6F, as the J-000 walk authors it), and a fourth run publishes S-10's columns.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { INGEST_JOB_MODULE, corpusBytes, tempDir, withCadCommand } from "../support/ingest-stage";
import { actsSeam } from "../sets/support/sets-stage";
import { storageOf } from "../partition/support/partition-stage";
import {
  PLACEMENT_DOOR_MODULE,
  closeStage,
  expansionDeferralRows,
  field,
  levelRowsOf,
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

/** A cold `uv run` over the DWG, the partition, and four measurements. */
const BUDGET_MS = 600_000;

/** The drawing the walker uploaded (walk-2 BD-3's repro). */
const BNBC_DWG = "fixtures/rcc6-bnbc/rcc6-bnbc.dwg";

/** The codes this walk turns on, by name. */
const SCALE = "VIEW_SCALE_UNAFFIRMED";
const RANGE = "TYPICAL_RANGE_UNSTATED";
const BAND = "SECTION_BAND_UNCOVERED";

/** The rank the walker affirmed at ("Affirm at Dimension ratio"). */
const DIMENSION_RATIO = "DIMENSION_RATIO";

/** The view the walk names, by the caption a QS knows it by. */
const COLUMN_PLAN = "COLUMN LAYOUT PLAN";

/** The range the J-000 walk authors for S-10's column plan (bb1a7b83's `typical_ranges`). */
const RANGE_FROM = "GF";
const RANGE_TO = "6F";

/** A calibration's content address: 64 lowercase hex. */
const CALIBRATION_KEY = /^[0-9a-f]{64}$/;

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

/** The key the partition offers a proposed level stack under (`LevelStackGroupKey`). */
type StackKey = { kind: string; drawingId: string; ingestId: string };

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
    { jobId: "fresh-dwg-affirmed-columns", step: async () => undefined },
    handler.measureDeps(),
  );
}

afterAll(async () => {
  await closeStage();
});

describe("a fresh DWG: S-10 affirmed measures its columns once its floors are stated, and every unlined member says why (walk-2 BD-3)", () => {
  let stage: PlacementStage;
  let scope: { tenantId: string; projectId: string };
  let drawingId: string;
  let ingestId: string;
  let setRevisionId: string;
  let campaignId: string;
  let column: ViewScale;

  /** The register's deferred-and-refused region, as the screen reads it. */
  async function refusals(): Promise<Refusal[]> {
    const register = await productModule<{ registerViewOf: (scope: unknown) => Promise<{ refusals: Refusal[] }> }>("src/modules/takeoff/register-ui/server.ts");
    return (await register.registerViewOf(scope)).refusals;
  }

  /** What the residue reads as standing for this campaign. */
  async function absences(): Promise<Absence[]> {
    const residue = await productModule<{ reportedAbsencesOf: (scope: unknown, campaign: unknown) => Promise<{ observations: Absence[] }> }>("src/core/residue/index.ts");
    return (await residue.reportedAbsencesOf(scope, { campaignId, setRevisionId })).observations;
  }

  /** The register's rows, whole. */
  function objects(): StoreRow[] {
    return registerObjectRows(scope.tenantId, setRevisionId);
  }

  /** The register's columns sighted in S-10's view (by the view address each row names). */
  function s10Columns(): StoreRow[] {
    return objects().filter((row) => said(row, "elementType", "element_type") === "column" && said(row, "viewKey", "view_key").endsWith(column.viewKey));
  }

  /** The campaign's quantity lines. */
  function lines(): StoreRow[] {
    return storeRows("quantity_lines", scope.tenantId).filter((row) => said(row, "campaignId", "campaign_id") === campaignId);
  }

  /** A level of the live stack, by its label. */
  function levelId(label: string): string {
    const found = levelRowsOf(scope.tenantId).filter((row) => said(row, "projectId", "project_id") === stage.projectId && said(row, "label", "label") === label);
    expect(found.length, `the stack holds one level ${label}`).toBe(1);
    return said(found[0] as StoreRow, "levelId", "level_id");
  }

  /**
   * Every registered object that published no line, and what the register's region names it by:
   * its own row, the row of the view it was placed in, or the row of the storey it stands on.
   * Answers the objects the region leaves silent.
   */
  async function silent(): Promise<string[]> {
    const region = await refusals();
    const byObject = new Set(region.map((row) => row.objectKey));
    const lined = new Set(lines().map((row) => said(row, "objectKey", "object_key")));
    return objects()
      .filter((row) => !lined.has(said(row, "objectKey", "object_key")))
      .filter((row) => {
        const key = said(row, "objectKey", "object_key");
        const view = said(row, "viewKey", "view_key");
        const level = field(row, "levelId", "level_id");
        return !byObject.has(key) && !byObject.has(view) && !(level !== null && byObject.has(String(level)));
      })
      .map((row) => said(row, "objectKey", "object_key"));
  }

  beforeAll(async () => {
    stage = await stagePlacementProject("fresh-dwg-affirmed-columns");
    scope = { tenantId: stage.person.tenantId, projectId: stage.projectId };

    // The DWG, read by the shipped CLI (LibreDWG, then the extractor) and written by the shipped job.
    const ingest = await productModule<{
      ingestDrawing: (bytes: Uint8Array, format: string, options: { tempDir: string }) => Promise<{ ok: boolean; artifact?: Uint8Array; refusal?: string; detail?: string }>;
    }>(INGEST_JOB_MODULE);
    const outcome = await withCadCommand(undefined, async () => ingest.ingestDrawing(corpusBytes(BNBC_DWG), "dwg", { tempDir: tempDir("fresh-dwg-affirmed-columns") }));
    expect(outcome.ok, `the shipped cad CLI read ${BNBC_DWG}: ${outcome.ok ? "" : `${outcome.refusal} — ${outcome.detail}`}`).toBe(true);
    const staged = await stageArtifactIngest(stage, new TextDecoder().decode(outcome.artifact as Uint8Array), "fresh-dwg-affirmed-columns");
    drawingId = staged.drawingId;
    ingestId = staged.ingestId;
    await runPlacementPartition(stage, staged, "fresh-dwg-affirmed-columns");

    // 1-2. Confirm the disciplines, pin the set.
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
    const views = await scale.scaleProposalsOf({ ...scope, drawingId }, { storage: await storageOf() });
    const found = views.filter((view) => view.caption.startsWith(COLUMN_PLAN));
    expect(found.length, `the drawing carries exactly one view captioned ${COLUMN_PLAN}`).toBe(1);
    column = found[0] as ViewScale;

    // 3. Measure: every placed view is refused unaffirmed.
    await measure(stage, campaignId);
    // 4-5. S-10 affirmed at Dimension ratio, measured again.
    await perform(stage, { type: "AFFIRM_SCALE", projectId: stage.projectId, drawingId, rank: DIMENSION_RATIO, viewKeys: [column.viewKey] });
    await measure(stage, campaignId);
    // 6. The level stack the drawing proposes, previewed and confirmed whole by its key — resolved
    // against the offer that stands, as the router's `insertionOf` resolves it — and measured again.
    const partition = await productModule<{
      proposedLevelStackOf: (scope: unknown) => Promise<{ group: StackKey } | null>;
      levelsOfferedUnder: (scope: unknown, group: StackKey) => Promise<unknown[] | null>;
    }>(PLACEMENT_DOOR_MODULE);
    const stack = await partition.proposedLevelStackOf({ ...scope, drawingId });
    expect(stack, "the drawing proposes a level stack").not.toBeNull();
    const levels = await partition.levelsOfferedUnder(scope, (stack as NonNullable<typeof stack>).group);
    expect(levels, "the offer stands under its key").not.toBeNull();
    await perform(stage, { type: "INSERT_LEVEL", projectId: stage.projectId, levels });
    await reexpand(stage);
    await measure(stage, campaignId);
  }, BUDGET_MS);

  test(
    "the affirmation stands on a real calibration, and its outgoing key is the stored spelling of none — a first affirmation moves a view from nothing",
    () => {
      const rows = storeRows("scale_affirmations", scope.tenantId).filter((row) => said(row, "projectId", "project_id") === stage.projectId);
      expect(rows.length, "one affirmation").toBe(1);
      const row = rows[0] as StoreRow;
      expect(field(row, "viewKeys", "view_keys"), "it names S-10's view").toEqual([column.viewKey]);
      const incoming = field(row, "incomingKeys", "incoming_keys") as string[];
      expect(incoming.length, "one incoming key per view").toBe(1);
      expect(incoming[0], "the incoming key is a calibration's content address").toMatch(CALIBRATION_KEY);
      expect(field(row, "outgoingKeys", "outgoing_keys"), "no earlier act named the view, so it moved from none").toEqual([""]);
    },
    BUDGET_MS,
  );

  test(
    "after the stack: S-10's columns stand on no storey, and each is reported for the range nobody stated — never an uncovered band",
    async () => {
      const columns = s10Columns();
      expect(columns.length, "S-10's columns stand in the register").toBeGreaterThan(0);
      expect(new Set(columns.map((row) => field(row, "levelSlot", "level_slot"))), "the column plan's caption states no range, so they stand UNRESOLVED").toEqual(new Set(["UNRESOLVED"]));
      expect(
        expansionDeferralRows(scope.tenantId, ingestId).filter((row) => said(row, "viewKey", "view_key").endsWith(column.viewKey)).map((row) => said(row, "reason", "reason")),
        "the expansion deferred the view for want of a range",
      ).toEqual([RANGE]);

      const keys = new Set(columns.map((row) => said(row, "objectKey", "object_key")));
      const reported = await absences();
      const concrete = reported.filter((row) => row.objectKey !== null && keys.has(row.objectKey) && row.kind === "rcc.concrete");
      expect(new Set(concrete.map((row) => row.objectKey)), "every column of S-10 carries a standing report").toEqual(keys);
      expect(new Set(concrete.map((row) => row.code)), "each is reported for the range, against the view").toEqual(new Set([RANGE]));
      expect(concrete.filter((row) => row.code === BAND), "no column on no storey is sent to its schedule's bands").toEqual([]);
      // The bars too (I-667, every rail): a column on no storey is never sent to its bar schedule.
      const rebar = reported.filter((row) => row.objectKey !== null && keys.has(row.objectKey) && row.kind === "rcc.rebar");
      expect(new Set(rebar.map((row) => row.objectKey)), "every column of S-10 carries a standing report for its bars").toEqual(keys);
      expect(new Set(rebar.map((row) => row.code)), "each is reported for the range, never as a schedule unread").toEqual(new Set([RANGE]));

      const named = (await refusals()).filter((row) => row.code === RANGE && row.deferral?.subject === "VIEW");
      expect(named.map((row) => row.deferral?.name ?? ""), "the register names the view whose floors nobody stated, by its caption").toEqual([expect.stringMatching(new RegExp(`^${COLUMN_PLAN}`))]);
      expect(lines().filter((row) => keys.has(said(row, "objectKey", "object_key"))), "and measures none of them").toEqual([]);
      expect(await silent(), "every registered object that published no line is named by the register").toEqual([]);
    },
    BUDGET_MS,
  );

  test(
    "S-10's floors stated GF to 6F: the next run publishes its columns, the view is no longer deferred, and nothing unlined is silent",
    async () => {
      const deferred = expansionDeferralRows(scope.tenantId, ingestId).find((row) => said(row, "viewKey", "view_key").endsWith(column.viewKey));
      expect(deferred, "the view the range is authored for").toBeTruthy();
      await perform(stage, {
        type: "AUTHOR_TYPICAL_RANGE",
        projectId: stage.projectId,
        viewKey: said(deferred as StoreRow, "viewKey", "view_key"),
        fromLevelId: levelId(RANGE_FROM),
        toLevelId: levelId(RANGE_TO),
      });
      await reexpand(stage);
      await measure(stage, campaignId);

      const columns = s10Columns();
      expect(columns.filter((row) => field(row, "levelSlot", "level_slot") === "UNRESOLVED"), "no column of S-10 stands on no storey").toEqual([]);
      const keys = new Set(columns.map((row) => said(row, "objectKey", "object_key")));
      const concrete = lines().filter((row) => keys.has(said(row, "objectKey", "object_key")) && said(row, "kind", "kind") === "rcc.concrete");
      expect(concrete.length, "S-10's columns publish their concrete").toBeGreaterThan(0);
      expect(concrete.every((row) => said(row, "class", "class") === "column"), "as columns").toBe(true);

      const region = await refusals();
      expect(region.filter((row) => row.code === RANGE), "no view is deferred for want of a range it now has").toEqual([]);
      expect(region.filter((row) => row.code === SCALE && row.objectKey.endsWith(column.viewKey)), "nor for a scale it has").toEqual([]);
      expect(await silent(), "every registered object that published no line is named by the register").toEqual([]);
    },
    BUDGET_MS,
  );
});

/**
 * A silent caption Jev answers "none of these" for: a proposal of no class, which the rebuild
 * excludes — the view stays honestly untyped with nothing beside it, the call stands in the ledger as
 * the proposal it was, and the job says which call answered none (R-TO-030, L-AI-02, L-CAD-06,
 * I-408).
 *
 * DB LANE. What is graded is what the store and the ledger hold after the SHIPPED partition job ran:
 * `partition_views` (nothing proposed beside the view), `model_calls` (one proposed row, refused by
 * nothing — the AI audit's source, which booked this answer MALFORMED before I-408) and the job's
 * own step log. The model is reached only through a recorded answer minted under a temporary fixture
 * root and filed under the request the product itself builds, so the suite is network-free by
 * construction (L-AI-01) and the answer is Jev's own no-match spelling: the arm tells Jev to choose
 * the untyped member where a caption names no class.
 */
import { afterAll, describe, expect, test } from "vitest";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import {
  CAPTION_UNCLASSIFIABLE,
  PRINCIPAL,
  VIEW_CAPTION_MODEL,
  closeStage,
  grantRole,
  keyOf,
  mintFixture,
  openSheetsStage,
  partitionDoor,
  requestHash,
  runPartition,
  sql,
  stageIngested,
  stagePerson,
  tempFixtureRoot,
  viewCaptionsDoor,
  withFixtureRoot,
  type CaptionSpec,
  type PartitionSeam,
  type Person,
  type StagedIngest,
  type StepRecord,
  type ViewRow,
} from "./support/partition-stage";

/** How long a staged case may take: an ingest recorded and a partition rebuilt over it. */
const BUDGET_MS = 600_000;

/** The type a view the grammar could not read carries — and the answer Jev is told to give for "none of these". */
const UNTYPED = "UNTYPED";

/** The captions the staged model space carries — the last of which says nothing the grammar reads. */
const CAPTIONS: readonly CaptionSpec[] = [
  { caption: "TYPICAL FLOOR PLAN", at: [0, 0] },
  { caption: "COLUMN SCHEDULE", at: [200, 0] },
  { caption: "XQZ 77", at: [400, 0] },
];

/** The caption no grammar rule reads, and so the one a model is asked about. */
const SILENT = "XQZ 77";

/** The step a run records where the rebuild excluded a "none of these" (rebuild.ts). */
const STEP_NO_CLASS = "caption-proposal-no-class";

/** The step a run records where the model's answer was refused. */
const STEP_REFUSED = "caption-proposal-refused";

type Call = { callId: string; modelId: string; outcome: string; refusalCode: string | null; question: string | null; requestHash: string };

interface Staged {
  partition: PartitionSeam;
  person: Person;
  projectId: string;
  ingested: StagedIngest;
  hash: string;
  steps: StepRecord[];
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const partition = await partitionDoor();
    const captions = await viewCaptionsDoor();
    const hashOf = await requestHash();

    await openSheetsStage();
    const { person, projectId } = await stagePerson("caption-none");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const ingested = await stageIngested(person, projectId, CAPTIONS, 7, "caption-none");
    const anchorKey = ingested.artifact.anchorOf.get(SILENT) ?? "";
    expect(anchorKey, `the staged artifact carries an entity for the caption ${JSON.stringify(SILENT)}`).not.toBe("");

    // Jev's "none of these", cited to the caption's own entity, filed under the request the product
    // composes for this caption on this anchor.
    const root = tempFixtureRoot("caption-none");
    const hash = hashOf(captions.viewCaptionRequest(SILENT, anchorKey));
    mintFixture(root, hash, { payload: { type: UNTYPED }, sources: [anchorKey] });

    const steps = await withFixtureRoot(root, async () => runPartition(person, ingested, "caption-none"));
    return { partition, person, projectId, ingested, hash, steps };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** Every model call one workspace made, with how it ended — this suite's own audit read. */
function callsOf(tenantId: string): Call[] {
  return sql(
    `select call_id::text, model_id, outcome, coalesce(refusal_code, ''), coalesce(question, ''), request_hash from ${ident("model_calls")}
       where ${ident("tenant_id")} = ${lit(tenantId)}::uuid;`,
  ).map((row) => ({
    callId: row[0] ?? "",
    modelId: row[1] ?? "",
    outcome: row[2] ?? "",
    refusalCode: row[3] === "" || row[3] === undefined ? null : row[3],
    question: row[4] === "" || row[4] === undefined ? null : row[4],
    requestHash: row[5] ?? "",
  }));
}

/** The one view the grammar could not read. */
async function silentView(stage: Staged): Promise<ViewRow> {
  const views = await stage.partition.viewsOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: stage.ingested.drawing.drawingId });
  const found = views.filter((view) => view.type === UNTYPED);
  expect(found.length, "the staged drawing carries exactly one view the grammar could not read").toBe(1);
  return found[0] as ViewRow;
}

describe("a caption Jev reads as no class", () => {
  test("is one proposed call in the ledger — never refused MALFORMED — pinned to Jev and filed under the caption question", async () => {
    const stage = await staged();
    const own = callsOf(stage.person.tenantId).filter((call) => call.requestHash === stage.hash);
    expect(
      own.map((call) => ({ outcome: call.outcome, refusalCode: call.refusalCode, modelId: call.modelId, question: call.question })),
      "the answer the question itself offered is booked as what it is: a proposal (I-408)",
    ).toEqual([{ outcome: "proposed", refusalCode: null, modelId: VIEW_CAPTION_MODEL, question: "view-caption" }]);
  }, BUDGET_MS);

  test("leaves the view untyped with nothing proposed beside it — the exclusion is the rebuild's decision", async () => {
    const stage = await staged();
    const view = await silentView(stage);
    expect(view.reason, "the view is untyped because the grammar could not read its caption, and it still says so").toBe(CAPTION_UNCLASSIFIABLE);
    expect(view.proposed, "a proposal of no class stands nowhere: there is nothing a person could confirm").toBeNull();
    expect(view.confirmed, "and nobody has confirmed anything").toBeNull();
  }, BUDGET_MS);

  test("is said on the job — which view was asked and which call answered none — and nothing is recorded as refused", async () => {
    const stage = await staged();
    const view = await silentView(stage);
    const said = stage.steps.map((entry) => entry.step);
    expect(said, `a 'none of these' is not a refusal; the log reads: ${said.join(" → ")}`).not.toContain(STEP_REFUSED);

    const own = callsOf(stage.person.tenantId).filter((call) => call.requestHash === stage.hash);
    const noted = stage.steps.filter((entry) => entry.step === STEP_NO_CLASS);
    expect(
      noted.map((entry) => entry.detail),
      `the run names the view and the ledger call that answered none of these; the log reads: ${said.join(" → ")}`,
    ).toEqual([{ view_key: keyOf(view), call_id: own[0]?.callId }]);
  }, BUDGET_MS);
});

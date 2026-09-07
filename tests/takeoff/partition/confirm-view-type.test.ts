/**
 * AC-4 — a silent caption earns a cited Proposal, held as `proposed` until a person confirms it
 * (L-AI-01, L-AI-02, L-ACT-01, L-ACT-02, R-TO-030).
 *
 * The model is reached only through a recorded answer minted under a temporary fixture root, so the
 * suite is network-free by construction (L-AI-01) and the answer is filed under the request the
 * product itself builds — `requestHash(viewCaptionRequest(caption, anchorKey))` — rather than under
 * a hash typed here. Nothing about the proposal is a conclusion: it stands beside the view, the view
 * stays UNTYPED, and only the act moves anything.
 *
 * The act is driven through the shipped seam and then again on the wire: `preview` answers a
 * Consequence, its digest is carried back to `commit`, and what the store then holds is read as this
 * suite's own audit read. Every subject expected is derived from the partition the product itself
 * wrote for the staged drawing.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  ACTS_MODULE,
  CAPTION_UNCLASSIFIABLE,
  CONFIRM_VIEW_TYPE,
  MEASURE,
  PRINCIPAL,
  PROPOSED_VIEW_TYPE,
  SUBJECTS,
  VIEW_CAPTION_MODEL,
  actorOf,
  byCodePoint,
  closeStage,
  grantRole,
  keyOf,
  mintFixture,
  modelCallRows,
  openSheetsStage,
  partitionDoor,
  productModule,
  requestHash,
  runPartition,
  stageIngested,
  stagePerson,
  takeoffCaller,
  tempFixtureRoot,
  viewCaptionsDoor,
  viewTypeConfirmationRows,
  withFixtureRoot,
  type ActsSeam,
  type CaptionSpec,
  type ConfirmViewTypeInput,
  type ConsequenceLike,
  type PartitionSeam,
  type Person,
  type StagedIngest,
  type ViewRow,
} from "./support/partition-stage";

/** How long a staged case may take: an ingest recorded and a partition rebuilt over it. */
const BUDGET_MS = 600_000;

/** The type the recorded answer proposes for the caption the grammar could not read. */
const DETAIL = "DETAIL";

/** The type a view the grammar could not read carries until somebody confirms otherwise. */
const UNTYPED = "UNTYPED";

/** The captions the staged model space carries — the last of which says nothing the grammar reads. */
const CAPTIONS: readonly CaptionSpec[] = [
  { caption: "TYPICAL FLOOR PLAN", at: [0, 0] },
  { caption: "COLUMN SCHEDULE", at: [200, 0] },
  { caption: "XQZ 77", at: [400, 0] },
];

/** The caption no grammar rule reads, and so the one a model is asked about. */
const SILENT = "XQZ 77";

interface Staged {
  partition: PartitionSeam;
  acts: ActsSeam;
  person: Person;
  projectId: string;
  ingested: StagedIngest;
  anchorKey: string;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const partition = await partitionDoor();
    const acts = await productModule<ActsSeam>(ACTS_MODULE);
    const captions = await viewCaptionsDoor();
    const hashOf = await requestHash();

    await openSheetsStage();
    const { person, projectId } = await stagePerson("confirm-view");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const ingested = await stageIngested(person, projectId, CAPTIONS, 3, "proposed");
    const anchorKey = ingested.artifact.anchorOf.get(SILENT) ?? "";
    expect(anchorKey, `the staged artifact carries an entity for the caption ${JSON.stringify(SILENT)}`).not.toBe("");

    // One recorded answer, filed under the request the product itself composes for this caption on
    // this anchor. `sources` cites the anchor, which is an entity of the artifact — an uncited or
    // unresolvable answer is not a proposal at all (L-AI-02).
    const root = tempFixtureRoot("view-captions");
    mintFixture(root, hashOf(captions.viewCaptionRequest(SILENT, anchorKey)), { payload: { type: DETAIL }, sources: [anchorKey] });

    await withFixtureRoot(root, async () => runPartition(person, ingested, "propose"));
    return { partition, acts, person, projectId, ingested, anchorKey };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The views of the staged drawing, as the module door answers them. */
async function views(): Promise<ViewRow[]> {
  const stage = await staged();
  return stage.partition.viewsOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: stage.ingested.drawing.drawingId });
}

/** The one view the grammar could not read. */
async function silentView(): Promise<ViewRow> {
  const found = (await views()).filter((view) => view.type === UNTYPED);
  expect(found.length, "the staged drawing carries exactly one view the grammar could not read").toBe(1);
  return found[0] as ViewRow;
}

/** What one confirmation asks for. */
function confirming(projectId: string, viewType: string, drawingId: string): ConfirmViewTypeInput {
  return { type: CONFIRM_VIEW_TYPE, projectId, group: { kind: PROPOSED_VIEW_TYPE, drawingId, viewType } };
}

describe("AC-4: the model is asked where the grammar is silent, and answers a cited proposal", () => {
  test("AC-4: the caption module names the model AS-05 pins cheap classification to", async () => {
    const captions = await viewCaptionsDoor();
    expect(captions.VIEW_CAPTION_MODEL, "a view-type classification is cheap work, and AS-05 pins it (L-AI-01 pins the id from a closed const)").toBe(VIEW_CAPTION_MODEL);
  }, BUDGET_MS);

  test("AC-4: the untyped view stands with the proposal beside it, and the call is in the ledger", async () => {
    const stage = await staged();
    const view = await silentView();
    expect(view.reason, "the view is UNTYPED because the grammar could not read its caption, and it says so").toBe(CAPTION_UNCLASSIFIABLE);
    expect(view.confirmed, "nobody has confirmed anything yet").toBeNull();
    expect(view.proposed, "the model's answer stands beside the view — never in it (L-AI-02: nothing in the schema accepts a Proposal)").toBeTruthy();
    expect(view.proposed?.type, "the recorded answer proposed a detail").toBe(DETAIL);

    const calls = modelCallRows(stage.person.tenantId);
    const own = calls.filter((call) => call.callId === view.proposed?.callId);
    expect(own.length, `the proposal's callId names a row of the model-call ledger; the workspace holds ${calls.length} call(s) (L-AI-01)`).toBe(1);
    expect(own[0]?.modelId, "and the call was made against the model the module pins").toBe(VIEW_CAPTION_MODEL);
  }, BUDGET_MS);

  test("AC-4: takeoff.views answers the same view on the wire", async () => {
    const stage = await staged();
    const caller = await takeoffCaller(stage.person);
    const call = caller["views"] as ((input: unknown) => Promise<unknown>) | undefined;
    expect(typeof call, "takeoff.views is on the wire (the increment's test contract)").toBe("function");

    const wire = (await (call as (input: unknown) => Promise<unknown>)({ projectId: stage.projectId, drawingId: stage.ingested.drawing.drawingId })) as ViewRow[];
    const view = await silentView();
    const said = wire.find((row) => keyOf(row) === keyOf(view));
    expect(said, "the wire answers the same view the module door does").toBeTruthy();
    expect(
      { type: said?.type, reason: said?.reason, proposed: said?.proposed, confirmed: said?.confirmed },
      "and it carries the same reading — the transport is a door, not a second opinion (B-21)",
    ).toStrictEqual({ type: view.type, reason: view.reason, proposed: view.proposed, confirmed: view.confirmed });
  }, BUDGET_MS);
});

describe("AC-4: CONFIRM_VIEW_TYPE is offered by group, and confirms by act", () => {
  test("AC-4: the act joins the enum and moves MEASURE", async () => {
    const stage = await staged();
    expect(stage.acts.ACT_TYPES, "CONFIRM_VIEW_TYPE is an act this increment renders (L-ACT-02's map is total over the enum)").toContain(CONFIRM_VIEW_TYPE);
    expect(stage.acts.ACT_PERMISSION[CONFIRM_VIEW_TYPE], "confirming what a view is, is what a measurer does before it can be measured (L-ACT-03)").toBe(MEASURE);
  }, BUDGET_MS);

  test("AC-4: preview answers a SUBJECTS Consequence naming every unconfirmed view proposed at that type", async () => {
    const stage = await staged();
    const wanted = (await views()).filter((view) => view.confirmed === null && view.proposed?.type === DETAIL);
    expect(wanted.length, "the staged drawing carries a view proposed as a detail — with none there is no group to preview").toBeGreaterThan(0);

    const consequence = await stage.acts.preview(actorOf(stage.person), confirming(stage.projectId, DETAIL, stage.ingested.drawing.drawingId));
    expect(consequence.rendering, "the Consequence renders through the shipped SUBJECTS arm (L-ACT-02)").toBe(SUBJECTS);
    expect(consequence.actType, "the Consequence names the act it was computed for").toBe(CONFIRM_VIEW_TYPE);
    expect(
      byCodePoint(consequence.subjects.map((subject) => subject.subjectId)),
      "one subject per unconfirmed view of that drawing whose proposed type is the group's — membership is the machine's, never the caller's (L-ACT-02)",
    ).toEqual(byCodePoint(wanted.map((view) => keyOf(view))));

    for (const subject of consequence.subjects) {
      expect(
        { before: [...subject.before], after: [...subject.after] },
        `the act adds a confirmed type to ${subject.subjectId} and overwrites nothing (L-ACT-01: before-images are rejected)`,
      ).toStrictEqual({ before: [], after: [DETAIL] });
      expect(subject.subjectLabel, `the subject ${subject.subjectId} is recognisable by the caption of the view it is`).toBe(SILENT);
    }
  }, BUDGET_MS);

  test("AC-4: commit writes one confirmation per subject naming the act, and the view then reads confirmed while its type stays UNTYPED", async () => {
    const stage = await staged();
    const input = confirming(stage.projectId, DETAIL, stage.ingested.drawing.drawingId);
    const consequence = await stage.acts.preview(actorOf(stage.person), input);
    const subjects = byCodePoint(consequence.subjects.map((subject) => subject.subjectId));

    const written = await stage.acts.commit(actorOf(stage.person), input, stage.acts.consequenceDigest(consequence));
    const rows = viewTypeConfirmationRows(stage.person.tenantId).filter((row) => row.actId === written.actId);
    expect(byCodePoint(rows.map((row) => row.viewKey)), "one view_type_confirmations row per subject — the state change and the act row land together or neither (L-ACT-01)").toEqual(subjects);
    for (const row of rows) {
      expect(row.type, `the confirmation of ${row.viewKey} carries the type that was confirmed`).toBe(DETAIL);
    }

    const view = await silentView();
    expect(view.confirmed, "the view now reports what was confirmed and the act it came from").toStrictEqual({ type: DETAIL, actId: written.actId });
    expect(view.type, "and the view's own type is still what the grammar read — a confirmation is a fact beside the reading, never a rewrite of it").toBe(UNTYPED);
    expect(view.reason, "the reason the grammar was silent does not stop being true").toBe(CAPTION_UNCLASSIFIABLE);
  }, BUDGET_MS);

  test("AC-4: takeoff.previewConfirmViewType and takeoff.confirmViewType carry the same Consequence, digest and act to the wire", async () => {
    const stage = await staged();
    // A second drawing of the same shape, so this case confirms a view of its own rather than one
    // the seam case above has already moved.
    const ingested = await stageIngested(stage.person, stage.projectId, CAPTIONS, 4, "wire");
    const anchorKey = ingested.artifact.anchorOf.get(SILENT) ?? "";
    const captions = await viewCaptionsDoor();
    const hashOf = await requestHash();
    const root = tempFixtureRoot("view-captions-wire");
    mintFixture(root, hashOf(captions.viewCaptionRequest(SILENT, anchorKey)), { payload: { type: DETAIL }, sources: [anchorKey] });
    await withFixtureRoot(root, async () => runPartition(stage.person, ingested, "wire"));

    const caller = await takeoffCaller(stage.person);
    const previewCall = caller["previewConfirmViewType"] as ((input: unknown) => Promise<unknown>) | undefined;
    const commitCall = caller["confirmViewType"] as ((input: unknown) => Promise<unknown>) | undefined;
    expect(typeof previewCall, "takeoff.previewConfirmViewType is on the wire (the increment's test contract)").toBe("function");
    expect(typeof commitCall, "takeoff.confirmViewType is on the wire (the increment's test contract)").toBe("function");

    const input = confirming(stage.projectId, DETAIL, ingested.drawing.drawingId);
    const consequence = (await (previewCall as (input: unknown) => Promise<unknown>)({ input })) as ConsequenceLike;
    expect(consequence.rendering, "the wire's Consequence renders through the same SUBJECTS arm").toBe(SUBJECTS);
    const digest = stage.acts.consequenceDigest(consequence);

    const written = (await (commitCall as (input: unknown) => Promise<unknown>)({ input, consequenceDigest: digest })) as { actId: string; consequenceDigest: string };
    expect(written.consequenceDigest, "the wire carries back the digest of the consequence it committed").toBe(digest);

    const rows = viewTypeConfirmationRows(stage.person.tenantId).filter((row) => row.actId === written.actId);
    expect(byCodePoint(rows.map((row) => row.viewKey)), "the act the wire performed wrote the same one row per subject").toEqual(
      byCodePoint(consequence.subjects.map((subject) => subject.subjectId)),
    );

    const after = await stage.partition.viewsOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: ingested.drawing.drawingId });
    const confirmed = after.filter((view) => view.confirmed !== null);
    expect(confirmed.map((view) => view.confirmed), "and the views read back confirmed, naming the act that carried it").toStrictEqual(
      confirmed.map(() => ({ type: DETAIL, actId: written.actId })),
    );
    expect(confirmed.length, "the wire's commit confirmed the view it previewed").toBe(consequence.subjects.length);
  }, BUDGET_MS);
});

/**
 * The stored partition, driven OUT OF PROCESS and reported as data.
 *
 * Why this exists: the held-out mount carries no `@/` alias, so a set mounted outside the checkout
 * cannot import a product module that spells its own layers that way (every module under
 * `src/modules/**` does). `tsx` run from the checkout resolves the alias natively, so a held-out
 * criterion drives the product through this script and asserts over the JSON it prints. It is
 * MECHANICS ONLY — it stages, it runs, it reads the store back, and it judges nothing: every
 * expectation lives in the set that spawned it.
 *
 * It is public on purpose (B-12/C-04): a Builder may read every literal it uses, and the staging it
 * does is the same staging the public suites do, through the same stage module (B-17).
 *
 *   node_modules/.bin/tsx tests/takeoff/partition/support/partition-probe.mts <scenario> <outFile>
 *
 * Scenarios: `determinism` (a partition rebuilt twice, with a confirmation across the two) and
 * `refusals` (every door of this increment asked something it must refuse). The report is written to
 * `<outFile>` as JSON; anything printed on stdout is progress a human might want.
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  CONFIRM_VIEW_TYPE,
  PARTITION_KIND,
  PRINCIPAL,
  actorOf,
  actsDoor,
  claimedJobFor,
  closeStage,
  codeOf,
  grammar,
  grantRole,
  mintFixture,
  modelCallRows,
  openSheetsStage,
  partitionDoor,
  partitionViewRows,
  requestHash,
  runPartition,
  stageIngested,
  stagePerson,
  tempFixtureRoot,
  unique,
  viewAssignmentRows,
  viewCaptionsDoor,
  viewTypeConfirmationRows,
  withFixtureRoot,
  type CaptionSpec,
  type JsonValue,
  type StagedIngest,
  type ViewRow,
} from "./partition-stage.ts";
import { stageDrawing } from "../../support/ingest-stage.ts";

/** The captions every scenario stages: two the grammar reads, one it cannot. */
const CAPTIONS: readonly CaptionSpec[] = [
  { caption: "TYPICAL FLOOR PLAN", at: [0, 0] },
  { caption: "COLUMN SCHEDULE", at: [200, 0] },
  { caption: "XQZ 77", at: [400, 0] },
];

/** The caption no grammar rule reads — the only one a model is ever asked about. */
const SILENT = "XQZ 77";

/** The type the recorded answers of the lawful case propose. */
const DETAIL = "DETAIL";

/** Some bytes a drawing row can be seeded from; what they say decides nothing. */
const BYTES = new TextEncoder().encode("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n");

/** The value a rejected call carries, or null when it resolved — a resolution is its own finding. */
async function refusedWith(call: Promise<unknown>): Promise<{ refused: true; code: string | null } | { refused: false; answer: JsonValue }> {
  return call.then(
    async (answer) => ({ refused: false as const, answer: JSON.parse(JSON.stringify(answer ?? null)) as JsonValue }),
    async (failure: unknown) => ({ refused: true as const, code: await codeOf(failure) }),
  );
}

/** A view as this report carries one: the door's own reading, flattened to plain JSON. */
function viewReport(view: ViewRow): Record<string, JsonValue> {
  return {
    viewKey: String(view.viewKey ?? view.view_key ?? ""),
    type: view.type,
    reason: view.reason,
    proposed: view.proposed === null || view.proposed === undefined ? null : { type: view.proposed.type, callId: view.proposed.callId },
    confirmed: view.confirmed === null || view.confirmed === undefined ? null : { type: view.confirmed.type, actId: view.confirmed.actId },
  };
}

/** Everything the store holds about one ingest's partition, plus what the door answers for it. */
async function snapshot(tenantId: string, projectId: string, drawingId: string, ingestId: string): Promise<Record<string, JsonValue>> {
  const door = await partitionDoor();
  return {
    views: partitionViewRows(tenantId, ingestId) as unknown as JsonValue,
    assignments: viewAssignmentRows(tenantId, ingestId) as unknown as JsonValue,
    answered: (await door.viewsOf({ tenantId, projectId, drawingId })).map(viewReport) as unknown as JsonValue,
    modelCalls: modelCallRows(tenantId) as unknown as JsonValue,
    confirmations: viewTypeConfirmationRows(tenantId) as unknown as JsonValue,
  };
}

/** What the captions of a staged artifact amount to: the anchor, the grammar's answer, the hash. */
async function captionFacts(staged: StagedIngest): Promise<Record<string, JsonValue>[]> {
  const seam = await grammar();
  const captions = await viewCaptionsDoor();
  const hashOf = await requestHash();
  return CAPTIONS.map((spec) => {
    const anchor = staged.artifact.anchorOf.get(spec.caption) ?? "";
    const said = seam.classifyCaption(spec.caption);
    return { caption: spec.caption, anchor, type: said.type, reason: said.reason, requestHash: hashOf(captions.viewCaptionRequest(spec.caption, anchor)) };
  });
}

/* ------------------------------------------------------------------ the scenarios */

/**
 * A partition rebuilt twice over one ingest, with a confirmation written between the two runs, and
 * a lawful recorded answer for the one caption the grammar cannot read.
 */
async function determinism(): Promise<Record<string, JsonValue>> {
  await openSheetsStage();
  const { person, projectId } = await stagePerson("determinism");
  grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);

  const staged = await stageIngested(person, projectId, CAPTIONS, 11, "determinism");
  const captions = await captionFacts(staged);
  const silent = captions.find((entry) => entry["caption"] === SILENT) ?? {};
  const anchor = String(silent["anchor"] ?? "");

  const root = tempFixtureRoot("determinism");
  mintFixture(root, String(silent["requestHash"] ?? ""), { payload: { type: DETAIL }, sources: [anchor] });

  const first = await withFixtureRoot(root, async () => runPartition(person, staged, "first"));
  const afterFirst = await snapshot(person.tenantId, projectId, staged.drawing.drawingId, staged.ingestId);

  // A person confirms the proposal, and only then is the partition rebuilt: what a person said must
  // survive a rebuild that never asked them (L-ACT-01).
  const acts = await actsDoor();
  const input = { type: CONFIRM_VIEW_TYPE, projectId, group: { kind: "PROPOSED_VIEW_TYPE", drawingId: staged.drawing.drawingId, viewType: DETAIL } };
  const consequence = await acts.preview(actorOf(person), input);
  const written = await acts.commit(actorOf(person), input, acts.consequenceDigest(consequence));
  const afterConfirm = await snapshot(person.tenantId, projectId, staged.drawing.drawingId, staged.ingestId);

  const second = await withFixtureRoot(root, async () => runPartition(person, staged, "second"));
  const afterSecond = await snapshot(person.tenantId, projectId, staged.drawing.drawingId, staged.ingestId);

  return {
    captions: captions as unknown as JsonValue,
    silentCaption: SILENT,
    modelKeys: staged.artifact.modelKeys,
    paperKeys: staged.artifact.paperKeys,
    derivedSources: staged.artifact.derivedSources,
    actId: written.actId,
    subjects: consequence.subjects.map((subject) => subject.subjectId),
    first: { steps: first as unknown as JsonValue, state: afterFirst as unknown as JsonValue },
    afterConfirm: afterConfirm as unknown as JsonValue,
    second: { steps: second as unknown as JsonValue, state: afterSecond as unknown as JsonValue },
  };
}

/** Every door of this increment, asked something it must refuse. */
async function refusals(): Promise<Record<string, JsonValue>> {
  await openSheetsStage();
  const { person, projectId } = await stagePerson("refusals");
  grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
  const door = await partitionDoor();
  const acts = await actsDoor();

  // Answers a proposal may not carry: a type outside the classifiable set, and a well-typed answer
  // with a key nobody asked for.
  const answers: { label: string; answer: { payload: JsonValue; sources: string[] } | null }[] = [
    { label: "unassigned", answer: { payload: { type: "UNASSIGNED" }, sources: [] } },
    { label: "untyped", answer: { payload: { type: "UNTYPED" }, sources: [] } },
    { label: "kebab", answer: { payload: { type: "layout-plan" }, sources: [] } },
    { label: "extra-key", answer: { payload: { type: DETAIL, confidence: 0.9 }, sources: [] } },
    { label: "missing", answer: null },
  ];
  const runs: Record<string, JsonValue>[] = [];
  let salt = 20;
  for (const { label, answer } of answers) {
    salt += 1;
    // The anchor is only known after staging, so a case that cites one mints its sources there.
    const staged = await stageIngested(person, projectId, CAPTIONS, salt, `refusal-${label}`);
    const captions = await captionFacts(staged);
    const silent = captions.find((entry) => entry["caption"] === SILENT) ?? {};
    const anchor = String(silent["anchor"] ?? "");
    const root = tempFixtureRoot(`refusals-${label}`);
    if (answer !== null) mintFixture(root, String(silent["requestHash"] ?? ""), { payload: answer.payload, sources: [anchor] });

    let ended = "succeeded";
    let steps: JsonValue = [];
    const ran = await refusedWith(withFixtureRoot(root, async () => runPartition(person, staged, `refusal-${label}`)));
    if (ran.refused) ended = `refused:${ran.code ?? "unmarked"}`;
    else steps = ran.answer;

    runs.push({
      label,
      ended,
      steps,
      silentAnchor: anchor,
      grammarTypes: captions.map((entry) => entry["type"] ?? null) as unknown as JsonValue,
      state: (await snapshot(person.tenantId, projectId, staged.drawing.drawingId, staged.ingestId)) as unknown as JsonValue,
    });
  }

  // A lawful partition to ask the act about — and then the groups the state does not offer.
  const lawful = await stageIngested(person, projectId, CAPTIONS, 40, "lawful");
  const captions = await captionFacts(lawful);
  const silent = captions.find((entry) => entry["caption"] === SILENT) ?? {};
  const root = tempFixtureRoot("refusals-lawful");
  mintFixture(root, String(silent["requestHash"] ?? ""), { payload: { type: DETAIL }, sources: [String(silent["anchor"] ?? "")] });
  await withFixtureRoot(root, async () => runPartition(person, lawful, "lawful"));

  const offered = { type: CONFIRM_VIEW_TYPE, projectId, group: { kind: "PROPOSED_VIEW_TYPE", drawingId: lawful.drawing.drawingId, viewType: DETAIL } };
  const consequence = await acts.preview(actorOf(person), offered);
  const staleDigest = "0".repeat(64);
  const confirmationsBeforeStale = viewTypeConfirmationRows(person.tenantId).length;
  const stale = await refusedWith(acts.commit(actorOf(person), offered, staleDigest));
  const confirmationsAfterStale = viewTypeConfirmationRows(person.tenantId).length;

  const groups = [
    { label: "no-view-proposed-at-that-type", group: { kind: "PROPOSED_VIEW_TYPE", drawingId: lawful.drawing.drawingId, viewType: "SCHEDULE" } },
    { label: "not-a-member", group: { kind: "PROPOSED_VIEW_TYPE", drawingId: lawful.drawing.drawingId, viewType: "layout-plan" } },
    { label: "drawing-of-no-partition", group: { kind: "PROPOSED_VIEW_TYPE", drawingId: randomUUID(), viewType: DETAIL } },
  ];
  const unoffered: Record<string, JsonValue>[] = [];
  for (const { label, group } of groups) {
    const before = viewTypeConfirmationRows(person.tenantId).length;
    const previewed = await refusedWith(acts.preview(actorOf(person), { type: CONFIRM_VIEW_TYPE, projectId, group }));
    unoffered.push({
      label,
      previewed: previewed as unknown as JsonValue,
      confirmationsBefore: before,
      confirmationsAfter: viewTypeConfirmationRows(person.tenantId).length,
    });
  }

  // A drawing nothing ingested, and a drawing of somebody else's workspace.
  const uningested = await stageDrawing(person, projectId, BYTES, { name: unique("uningested.dxf"), format: "dxf" });
  const keyBefore = claimedJobFor(PARTITION_KIND, `${PARTITION_KIND}:${person.tenantId}:${uningested.drawingId}`);
  const noRecord = await refusedWith(door.requestPartition({ tenantId: person.tenantId, drawingId: uningested.drawingId, requestedBy: person.userId }));

  const stranger = await stagePerson("stranger");
  grantRole(stranger.person.tenantId, stranger.projectId, stranger.person.userId, PRINCIPAL);
  const theirs = await stageIngested(stranger.person, stranger.projectId, CAPTIONS, 50, "stranger");
  const outsider = await refusedWith(door.requestPartition({ tenantId: person.tenantId, drawingId: theirs.drawing.drawingId, requestedBy: person.userId }));

  return {
    runs: runs as unknown as JsonValue,
    lawful: {
      subjects: consequence.subjects.map((subject) => subject.subjectId),
      staleCommit: stale as unknown as JsonValue,
      confirmationsBeforeStale,
      confirmationsAfterStale,
    },
    unoffered: unoffered as unknown as JsonValue,
    uningested: { answer: noRecord as unknown as JsonValue, claimBefore: keyBefore, claimAfter: claimedJobFor(PARTITION_KIND, `${PARTITION_KIND}:${person.tenantId}:${uningested.drawingId}`) },
    outsider: { answer: outsider as unknown as JsonValue },
  };
}

/* ------------------------------------------------------------------ the entry point */

const [scenario, outFile] = process.argv.slice(2);
if (scenario === undefined || outFile === undefined) throw new Error("usage: partition-probe.mts <determinism|refusals> <outFile>");

const report = scenario === "determinism" ? await determinism() : scenario === "refusals" ? await refusals() : null;
if (report === null) throw new Error(`no such scenario: ${scenario}`);

writeFileSync(outFile, JSON.stringify(report, null, 2));
await closeStage();
process.stdout.write(`${scenario}: wrote ${outFile}\n`);

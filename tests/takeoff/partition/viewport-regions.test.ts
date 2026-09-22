/**
 * The S-10 shape, through the rebuild door: a plan a paper sheet's own WINDOW frames and titles
 * becomes that window's view, and stops being whatever distant model caption reached furthest
 * (L-CAD-06, L-CAD-05, R-TO-030).
 *
 * F-RCC6-BNBC titles S-10's column layout only on the paper. Before frames were read, all 71 of the
 * entities in that window landed in COLUMN SCHEDULE — whose caption reached 206,989 drawing units —
 * and the M3 leg of J-000 placed no column at all. The staged artifact here is that shape in
 * miniature: two clusters in model space, one of them captioned in model space and one of them not,
 * and a sheet with a window over each.
 *
 * Every expectation is derived from the grammar's own answer and from the artifact the ingest really
 * recorded — no view key, type or count is transcribed (B-19). Nothing here reads product source: it
 * drives the shipped partition job and reads the rows it wrote.
 *
 * The model is asked from an EMPTY fixture root, so a caption the grammar cannot read earns no guess
 * and nothing leaves this suite for a network (L-AI-01).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  PRINCIPAL,
  UNASSIGNED,
  VIEWS_STAGE,
  byCodePoint,
  closeStage,
  grammar,
  grantRole,
  openSheetsStage,
  partitionViewRows,
  runPartition,
  stageIngested,
  stagePerson,
  tempFixtureRoot,
  viewAssignmentRows,
  withFixtureRoot,
  type CaptionSpec,
  type FrameSpec,
  type GrammarSeam,
  type Person,
  type StagedIngest,
} from "./support/partition-stage";

/** How long a staged case may take: one ingest consumed and one partition run. */
const BUDGET_MS = 600_000;

/**
 * The model space: one cluster the draughtsman captioned in the drawing itself, and one he did not
 * — its only text is a mark the grammar cannot read, which is S-12's "C1" and S-14's floor note.
 */
const CAPTIONS: readonly CaptionSpec[] = [
  { caption: "COLUMN SCHEDULE", at: [0, 0] },
  { caption: "XQZ 77", at: [200, 0] },
];

/** The sheet's two windows: one over each cluster, each titled the way a drawing sheet titles one. */
const SCHEDULE_FRAME = "1ST FLOOR BEAM LAYOUT  SCALE 1:100";
const PLAN_FRAME = "COLUMN LAYOUT PLAN  SCALE 1:100";
const FRAMES: readonly FrameSpec[] = [
  { handle: "VP1", model: [-20, -20, 60, 20], title: SCHEDULE_FRAME },
  { handle: "VP2", model: [180, -20, 260, 20], title: PLAN_FRAME },
];

interface Staged {
  grammar: GrammarSeam;
  person: Person;
  projectId: string;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const seam = await grammar();
    await openSheetsStage();
    const { person, projectId } = await stagePerson("regions");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    return { grammar: seam, person, projectId };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** One partition run over an artifact of these captions and these windows, with the steps it recorded. */
async function partitioned(salt: number, label: string, frames: readonly FrameSpec[]): Promise<{ staged: StagedIngest; steps: { step: string; detail: Record<string, unknown> }[] }> {
  const stage = await staged();
  const ingested = await stageIngested(stage.person, stage.projectId, CAPTIONS, salt, label, frames);
  const steps = await withFixtureRoot(tempFixtureRoot("regions-empty"), async () => runPartition(stage.person, ingested, label));
  return { staged: ingested, steps };
}

let framed: Promise<{ staged: StagedIngest; steps: { step: string; detail: Record<string, unknown> }[] }> | undefined;
const withFrames = (): Promise<{ staged: StagedIngest; steps: { step: string; detail: Record<string, unknown> }[] }> => (framed ??= partitioned(41, "framed", FRAMES));

let unframed: Promise<{ staged: StagedIngest; steps: { step: string; detail: Record<string, unknown> }[] }> | undefined;
const withoutFrames = (): Promise<{ staged: StagedIngest; steps: { step: string; detail: Record<string, unknown> }[] }> => (unframed ??= partitioned(42, "unframed", []));

describe("a window's title captions the model space that window frames", () => {
  test("the untitled cluster becomes the view its own sheet titles, anchored on the paper text", async () => {
    const stage = await staged();
    const { staged: ingested } = await withFrames();
    const views = new Map(partitionViewRows(stage.person.tenantId, ingested.ingestId).map((view) => [view.viewKey, view]));
    const assigned = new Map(viewAssignmentRows(stage.person.tenantId, ingested.ingestId).map((row) => [row.entityKey, row.viewKey]));

    const titleKey = ingested.artifact.titleOf.get(PLAN_FRAME) ?? "";
    expect(titleKey, "the staged sheet letters the title this case is about").not.toBe("");
    const said = stage.grammar.classifyCaption(PLAN_FRAME);
    const key = `${said.type}:${titleKey}`;

    expect(views.get(key), `the window titled ${JSON.stringify(PLAN_FRAME)} is a view keyed ${key}; the partition holds ${[...views.keys()].join(", ")}`).toBeTruthy();
    expect(views.get(key)?.type, "of the class the grammar read off the sheet's own words").toBe(said.type);
    expect(views.get(key)?.caption, "captioned in the artifact's own words, the scale note and all").toBe(PLAN_FRAME);
    expect(views.get(key)?.anchorKey, "and anchored on the paper text that letters it (L-CAD-03: an original entity is the atom a key names)").toBe(titleKey);

    // Everything the window frames is that view's, which is the whole of the S-10 finding: the
    // cluster's mark, its labels and its lines, not one of them left to a distant caption's reach.
    const inWindow = ingested.artifact.modelKeys.filter((entityKey) => (assigned.get(entityKey) ?? "") === key);
    expect(inWindow.length, "the window's contents belong to the window's view — every one of them").toBeGreaterThanOrEqual(5);
    expect(
      inWindow.some((entityKey) => entityKey === ingested.artifact.anchorOf.get("XQZ 77")),
      "including the mark the grammar cannot read, which types nothing and so is content of whatever frames it",
    ).toBe(true);
  }, BUDGET_MS);

  test("a mark the grammar cannot read anchors no view of its own once a frame titles the region it stands in", async () => {
    const stage = await staged();
    const { staged: ingested } = await withFrames();
    const views = partitionViewRows(stage.person.tenantId, ingested.ingestId);
    const unreadable = ingested.artifact.anchorOf.get("XQZ 77") ?? "";

    expect(
      views.filter((view) => view.anchorKey === unreadable).map((view) => view.viewKey),
      "an unclassifiable caption TYPES nothing; inside a titled region it anchors nothing either (L-CAD-06)",
    ).toEqual([]);
  }, BUDGET_MS);

  test("a typed model caption inside a window keeps the view key it already had", async () => {
    const stage = await staged();
    const { staged: ingested } = await withFrames();
    const views = new Map(partitionViewRows(stage.person.tenantId, ingested.ingestId).map((view) => [view.viewKey, view]));

    const anchor = ingested.artifact.anchorOf.get("COLUMN SCHEDULE") ?? "";
    const said = stage.grammar.classifyCaption("COLUMN SCHEDULE");
    const key = `${said.type}:${anchor}`;

    expect(views.get(key), `the caption drawn in model space still anchors its own view, keyed ${key}; the partition holds ${[...views.keys()].join(", ")}`).toBeTruthy();
    expect(views.get(key)?.caption, "and is still captioned by its own words, not by the sheet's title over it").toBe("COLUMN SCHEDULE");

    const titleKey = ingested.artifact.titleOf.get(SCHEDULE_FRAME) ?? "";
    expect(
      [...views.values()].filter((view) => view.anchorKey === titleKey).map((view) => view.viewKey),
      "the sheet's title over a region the drawing already titles anchors nothing: the frame decides how far the caption carries, never what it says",
    ).toEqual([]);
  }, BUDGET_MS);

  test("every model-space original still lands in exactly one view of this ingest, and the stray in none", async () => {
    const stage = await staged();
    const { staged: ingested } = await withFrames();
    const assignments = viewAssignmentRows(stage.person.tenantId, ingested.ingestId);
    const views = new Set(partitionViewRows(stage.person.tenantId, ingested.ingestId).map((view) => view.viewKey));

    expect(byCodePoint(assignments.map((row) => row.entityKey)), "every model-space original entity belongs to exactly one view — no more, no fewer (L-CAD-06)").toEqual(
      byCodePoint(ingested.artifact.modelKeys),
    );
    expect(assignments.filter((row) => !views.has(row.viewKey)).map((row) => `${row.entityKey} → ${row.viewKey}`), "an assignment names a view this partition does not hold").toEqual([]);
    expect(views.has(UNASSIGNED), "the line standing far from every cluster and inside no window is what the anchorless view is for").toBe(true);
  }, BUDGET_MS);

  test("the views stage reports how many of its views a frame captioned", async () => {
    const { steps } = await withFrames();
    const detail = steps.find((entry) => entry.step === VIEWS_STAGE)?.detail ?? {};
    expect(detail["framed"], `the stage says which reading the drawing partitioned by; it recorded ${JSON.stringify(detail)}`).toBe(FRAMES.length);
    expect(Number(detail["views"]), "and it read more views than it framed, because the view no caption anchors is not a frame's").toBeGreaterThan(FRAMES.length);
  }, BUDGET_MS);
});

describe("AM-01: the same drawing with no windows partitions as it always has", () => {
  test("every view of a frameless artifact is anchored in model space, and the stage frames none", async () => {
    const stage = await staged();
    const { staged: ingested, steps } = await withoutFrames();
    const views = partitionViewRows(stage.person.tenantId, ingested.ingestId);
    const modelKeys = new Set(ingested.artifact.modelKeys);

    expect(
      views.filter((view) => view.anchorKey !== null && !modelKeys.has(view.anchorKey)).map((view) => view.viewKey),
      "a drawing whose paper layouts open no window onto model space is partitioned by its own captions alone — F-RCC6 is exactly such a drawing (AM-01)",
    ).toEqual([]);

    for (const spec of CAPTIONS) {
      const anchor = ingested.artifact.anchorOf.get(spec.caption) ?? "";
      const said = stage.grammar.classifyCaption(spec.caption);
      expect(
        views.find((view) => view.viewKey === `${said.type}:${anchor}`),
        `the caption ${JSON.stringify(spec.caption)} anchors its own view, as it always did; the partition holds ${views.map((view) => view.viewKey).join(", ")}`,
      ).toBeTruthy();
    }

    const detail = steps.find((entry) => entry.step === VIEWS_STAGE)?.detail ?? {};
    expect(detail["framed"], `nothing was framed, and the stage says so; it recorded ${JSON.stringify(detail)}`).toBe(0);
  }, BUDGET_MS);
});

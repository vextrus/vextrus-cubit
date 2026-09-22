/**
 * AUTHOR_TYPICAL_RANGE writes the ONE resolver's rows (L-CAD-07, L-REG-04, I-303, L-QTY-04).
 *
 * WHY. The act used to expand the placeholders itself: it re-keyed each `@UNRESOLVED` row onto the
 * range's first storey, first-registered the rest, cut them by the schedule's band with a cut of its
 * own — and never read a placement's note. The router re-expands right after it, but the resolver's
 * answer for a NOTED member differs (a note stating no range keeps its member on the storey the plan
 * draws; `STARTS AT <storey>` stands it from there up), every key the act had written already stood,
 * and the register is append-only (0029): the rebuild could only report the act's extra rows as
 * stale. On F-RCC6-BNBC that was C5@GF and C7@1F..6F — seven column lines, 94.196 m³ where the doors
 * give 90.834 (session 7 ledger).
 *
 * The drawing here is that shape in miniature: the placement stage's NOTED plan — nine typical
 * columns, a member its own mark tags with a sentence stating a shape and no range, and a ring nobody
 * tags whose only evidence is a sentence stating `STARTS AT 3RD` — under a caption stating NO range,
 * so every member waits in the unresolved slot until a person states one. The act is committed once
 * through SEAM-ACT and once through the router's door, and what is graded is the register itself:
 * each member on the storeys its own evidence names, no placeholder left, and a re-expansion that
 * finds nothing to add and nothing stale.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { door, takeoffCaller } from "../../levels-ui/support/levels-ui-stage";
import {
  ACTS_MODULE,
  AUTHOR_TYPICAL_RANGE,
  DERIVED,
  MEASURED,
  NOTED_BAND_FROM,
  NOTED_BINDING_MARK,
  NOTED_MINTING_MARK,
  SCENARIO,
  STACK_LABELS,
  UNRESOLVED,
  closeStage,
  expansionDeferralRows,
  levelNamed,
  levelsOfProject,
  pinRevisionNaming,
  placementRows,
  productModule,
  registerObjectRows,
  runPlacementPartition,
  said,
  stagePlacementIngest,
  stagePlacementProject,
  stageStack,
  type ActorCtx,
  type ConsequenceLike,
  type PlacementStage,
  type StagedPlacementIngest,
} from "../support/placement-stage";

/** SEAM-ACT, as this suite drives it (L-ACT-02). */
type ActsSeam = {
  consequenceDigest: (consequence: ConsequenceLike) => string;
  preview: (ctx: ActorCtx, input: Record<string, unknown>) => Promise<ConsequenceLike>;
  commit: (ctx: ActorCtx, input: Record<string, unknown>, carried: string) => Promise<{ actId: string }>;
};

/** The re-expansion, as the router calls it after the act (L-REG-06). */
type Reexpand = {
  reexpandProject: (scope: { tenantId: string; projectId: string }) => Promise<{ drawingId: string; registered: number; stale: readonly string[] }[]>;
};

/** One subject of a SUBJECTS Consequence (L-ACT-02). */
type Subject = { subjectId?: unknown; subjectLabel?: unknown; before?: readonly unknown[]; after?: readonly unknown[] };

/** The nine members the plan tags, three marks of three — the plan's typical (placement stage). */
const TYPICAL_MARKS: readonly string[] = ["C1", "C2", "C3"];

/** One staged NOTED_BARE project: the drawing partitioned under a pinned revision, and its view. */
type Staged = { stage: PlacementStage; ingest: StagedPlacementIngest; setRevisionId: string; viewKey: string };

async function stageNotedBare(label: string, salt: number): Promise<Staged> {
  const stage = await stagePlacementProject(label);
  await stageStack(stage, STACK_LABELS);
  const ingest = await stagePlacementIngest(stage, SCENARIO.NOTED_BARE, salt);
  const setRevisionId = await pinRevisionNaming(stage, ingest.drawingId);
  await runPlacementPartition(stage, ingest, label);
  // The view the act is addressed at is the one the run itself deferred — read back, never guessed.
  const deferrals = expansionDeferralRows(stage.person.tenantId, ingest.ingestId);
  expect(deferrals.length, "a bare typical caption left exactly one deferral for its view").toBe(1);
  return { stage, ingest, setRevisionId, viewKey: said(deferrals[0] as Record<string, unknown>, "viewKey", "view_key") };
}

/** The act's input: the whole stack, first storey to last (by surrogate, L-REG-02). */
function wholeStack(staged: Staged): { projectId: string; viewKey: string; fromLevelId: string; toLevelId: string } {
  const levels = levelsOfProject(staged.stage);
  return {
    projectId: staged.stage.projectId,
    viewKey: staged.viewKey,
    fromLevelId: levelNamed(levels, STACK_LABELS[0] as string).levelId,
    toLevelId: levelNamed(levels, STACK_LABELS[STACK_LABELS.length - 1] as string).levelId,
  };
}

/** The mark each placement of the drawing stands under, by its placement key. */
function marksByPlacement(staged: Staged): Map<string, string> {
  return new Map(placementRows(staged.stage.person.tenantId, staged.ingest.ingestId).map((row) => [said(row, "placementKey", "placement_key"), said(row, "mark", "mark")]));
}

/** `<label>:<standing>` per register row of the revision, grouped by the placement's mark and sorted. */
function standingByMark(staged: Staged): Map<string, string[]> {
  const marks = marksByPlacement(staged);
  const labels = new Map(levelsOfProject(staged.stage).map((level) => [level.levelId, level.label]));
  const byMark = new Map<string, string[]>();
  for (const row of registerObjectRows(staged.stage.person.tenantId, staged.setRevisionId)) {
    const mark = marks.get(said(row, "placementKey", "placement_key"));
    if (mark === undefined) continue;
    const at = said(row, "levelId", "level_id");
    const where = at === "" ? `@${said(row, "levelSlot", "level_slot")}` : (labels.get(at) ?? "?");
    byMark.set(mark, [...(byMark.get(mark) ?? []), `${where}:${said(row, "standing", "standing")}`].sort());
  }
  return byMark;
}

/** What every member of the NOTED plan stands on once the range is the whole stack (I-303). */
function owedByMark(): Map<string, string[]> {
  const owed = new Map<string, string[]>();
  const typical = STACK_LABELS.map((label, index) => `${label}:${index === 0 ? MEASURED : DERIVED}`);
  // Three placements under each typical mark, each over the whole range, measured where it was drawn.
  for (const mark of TYPICAL_MARKS) owed.set(mark, [...typical, ...typical, ...typical].sort());
  // A note stating no range: the storey the plan draws, alone.
  owed.set(NOTED_BINDING_MARK, [`${STACK_LABELS[0]}:${MEASURED}`]);
  // `STARTS AT 3RD`: measured there, derived above it, and never below.
  const from = STACK_LABELS.indexOf(NOTED_BAND_FROM);
  owed.set(NOTED_MINTING_MARK, STACK_LABELS.slice(from).map((label, index) => `${label}:${index === 0 ? MEASURED : DERIVED}`).sort());
  return owed;
}

/** The labels a subject's `after` names, for the placement a mark stands under. */
function afterLabelsOf(staged: Staged, subjects: readonly Subject[], mark: string): string[][] {
  const marks = marksByPlacement(staged);
  const labels = new Map(levelsOfProject(staged.stage).map((level) => [level.levelId, level.label]));
  return subjects
    .filter((subject) => [...marks].some(([placement, held]) => held === mark && String(subject.subjectId).startsWith(`${placement}@`)))
    .map((subject) => (subject.after ?? []).map((key) => labels.get(String(key).slice(String(key).lastIndexOf("@") + 1)) ?? String(key)));
}

/** The register's placeholders for the revision — keys still standing in the unresolved slot. */
function placeholdersOf(staged: Staged): string[] {
  return registerObjectRows(staged.stage.person.tenantId, staged.setRevisionId)
    .map((row) => said(row, "objectKey", "object_key"))
    .filter((key) => key.endsWith(`@${UNRESOLVED}`));
}

async function reexpandSeam(): Promise<Reexpand> {
  return (await import("@/modules/takeoff/partition/expansion/reexpand")) as unknown as Reexpand;
}

afterAll(async () => {
  await closeStage();
});

describe("AUTHOR_TYPICAL_RANGE through SEAM-ACT: the noted members stand where their own notes say", () => {
  let staged: Staged;
  let acts: ActsSeam;

  beforeAll(async () => {
    staged = await stageNotedBare("typical-range-noted-seam", 0x2f10);
    acts = await productModule<ActsSeam>(ACTS_MODULE);
  }, 240_000);

  test("before the act every member waits in the unresolved slot", () => {
    const byMark = standingByMark(staged);
    expect([...byMark.keys()].sort(), "all five marks are registered").toEqual([...TYPICAL_MARKS, NOTED_MINTING_MARK, NOTED_BINDING_MARK].sort());
    for (const [mark, rows] of byMark) expect(new Set(rows), `${mark} stands only as a placeholder`).toEqual(new Set([`@${UNRESOLVED}:${MEASURED}`]));
  });

  test("the preview names, per placeholder, the keys the resolver derives — the noted two included", async () => {
    const consequence = await acts.preview(staged.stage.actor, { type: AUTHOR_TYPICAL_RANGE, ...wholeStack(staged) });
    const subjects = (consequence.subjects ?? []) as readonly Subject[];
    expect(subjects.map((subject) => String(subject.subjectId)).sort(), "one subject per placeholder the act retires (L-ACT-02)").toEqual(placeholdersOf(staged).sort());
    expect(afterLabelsOf(staged, subjects, NOTED_BINDING_MARK), "the porch column becomes one key, on the storey the plan draws").toEqual([[STACK_LABELS[0]]]);
    expect(afterLabelsOf(staged, subjects, NOTED_MINTING_MARK), "the floating column becomes the keys from its note's storey up").toEqual([
      STACK_LABELS.slice(STACK_LABELS.indexOf(NOTED_BAND_FROM)),
    ]);
  });

  test("committed, the register holds each member on the storeys its own evidence names, and no placeholder", async () => {
    const input = { type: AUTHOR_TYPICAL_RANGE, ...wholeStack(staged) };
    const consequence = await acts.preview(staged.stage.actor, input);
    await acts.commit(staged.stage.actor, input, acts.consequenceDigest(consequence));

    expect(placeholdersOf(staged), "no member is left in the unresolved slot").toEqual([]);
    expect(standingByMark(staged), "each member stands where the resolver places it (I-303, L-QTY-04)").toEqual(owedByMark());
  });

  test("the re-expansion after it finds every key standing: nothing to register, nothing stale", async () => {
    const before = standingByMark(staged);
    const answered = (await (await reexpandSeam()).reexpandProject({ tenantId: staged.stage.person.tenantId, projectId: staged.stage.projectId })).find(
      (one) => one.drawingId === staged.ingest.drawingId,
    );
    expect(answered?.registered, "the act already wrote every row the resolver derives").toBe(0);
    expect(answered?.stale, "and wrote none the resolver does not").toEqual([]);
    expect(standingByMark(staged), "the register did not move").toEqual(before);
  });
});

describe("AUTHOR_TYPICAL_RANGE through the router's door: the same rows, and the door's own re-expansion adds none", () => {
  let staged: Staged;

  beforeAll(async () => {
    staged = await stageNotedBare("typical-range-noted-door", 0x2f20);
  }, 240_000);

  test("committed through commitAuthorTypicalRange, the register holds each member where its own evidence says", async () => {
    const caller = await takeoffCaller(staged.stage.person);
    const input = wholeStack(staged);
    const previewed = (await door(caller, "previewAuthorTypicalRange")({ input })) as { consequenceDigest: string };
    await door(caller, "commitAuthorTypicalRange")({ input, consequenceDigest: previewed.consequenceDigest });

    expect(placeholdersOf(staged), "no member is left in the unresolved slot").toEqual([]);
    expect(standingByMark(staged), "the door re-expanded after the act and nothing it derives stands beside what the act wrote").toEqual(owedByMark());

    const again = (await (await reexpandSeam()).reexpandProject({ tenantId: staged.stage.person.tenantId, projectId: staged.stage.projectId })).find(
      (one) => one.drawingId === staged.ingest.drawingId,
    );
    expect(again?.registered, "nothing left to register").toBe(0);
    expect(again?.stale, "and nothing stale").toEqual([]);
  });
});

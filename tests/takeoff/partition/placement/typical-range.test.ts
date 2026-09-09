/**
 * AC-5: `AUTHOR_TYPICAL_RANGE` — the act that states and commits the one-to-many expansion.
 *
 * The state it acts on is the one a bare typical caption leaves: nine placeholders standing in the
 * unresolved slot and one deferral for the view. The act is driven through SEAM-ACT's own pair, and
 * what it moved is read off the register, the ledger and the store the job itself wrote.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  ACTS_MODULE,
  AUTHOR_TYPICAL_RANGE,
  DERIVED,
  LEVEL_RANGE_ENDPOINT_UNMAPPED,
  MEASURE,
  MEASURED,
  MEASURER,
  PERMISSION_NOT_HELD,
  REVIEWER,
  SCENARIO,
  STACK_LABELS,
  TRANSPORT_VOCABULARY_MODULE,
  TYPICAL_RANGES,
  UNRESOLVED,
  actRowsOf,
  closeStage,
  codeOf,
  expansionDeferralRows,
  levelNamed,
  ordered,
  pinRevisionNaming,
  placementRows,
  productModule,
  refusedSightingRows,
  registerObjectRows,
  rejection,
  runPlacementPartition,
  said,
  stageColleague,
  stagePlacementIngest,
  stagePlacementProject,
  stageStack,
  tableStands,
  typicalRangeRows,
  type ActorCtx,
  type ConsequenceLike,
  type PlacementStage,
  type StackedLevel,
  type StagedPlacementIngest,
} from "../support/placement-stage";

/** SEAM-ACT, as this acceptance drives it (L-ACT-02). */
type ActsSeam = {
  ACT_TYPES: readonly string[];
  ACT_PERMISSION: Readonly<Record<string, string>>;
  consequenceDigest: (consequence: ConsequenceLike) => string;
  preview: (ctx: ActorCtx, input: Record<string, unknown>) => Promise<ConsequenceLike>;
  commit: (ctx: ActorCtx, input: Record<string, unknown>, carried: string) => Promise<{ actId: string }>;
};

/** One vocabulary of the transport register (Q-07). */
type Vocabulary = { vocabulary: string; codes: readonly string[] };

let stage: PlacementStage;
let staged: StagedPlacementIngest;
let levels: StackedLevel[];
let setRevisionId: string;
let acts: ActsSeam;
let measurer: ActorCtx;
let reviewer: ActorCtx;
let viewKey: string;

/** The act, as the seam is given it (AC-5). */
function authoring(from: string, to: string): Record<string, unknown> {
  return { type: AUTHOR_TYPICAL_RANGE, projectId: stage.projectId, viewKey, fromLevelId: from, toLevelId: to };
}

/** The keys the nine placements become over the six levels of the range. */
function expectedKeys(): string[] {
  const placements = placementRows(stage.person.tenantId, staged.ingestId).map((row) => said(row, "placementKey", "placement_key"));
  return ordered(placements.flatMap((placement) => levels.map((level) => `${placement}@${level.levelId}`)));
}

/** The object keys standing for the pinned revision. */
function standingKeys(): string[] {
  return ordered(registerObjectRows(stage.person.tenantId, setRevisionId).map((row) => said(row, "objectKey", "object_key")));
}

beforeAll(async () => {
  stage = await stagePlacementProject("typical-range");
  levels = await stageStack(stage, STACK_LABELS);
  staged = await stagePlacementIngest(stage, SCENARIO.TYPICAL_BARE, 0x25);
  setRevisionId = await pinRevisionNaming(stage, staged.drawingId);
  await runPlacementPartition(stage, staged, "typical-range");

  acts = await productModule<ActsSeam>(ACTS_MODULE);
  measurer = (await stageColleague(stage, "measurer", MEASURER)).actor;
  reviewer = (await stageColleague(stage, "reviewer", REVIEWER)).actor;

  // The view the act is addressed at is the one the run itself deferred — read back, never guessed.
  const deferrals = expansionDeferralRows(stage.person.tenantId, staged.ingestId);
  expect(deferrals.length, "a bare typical caption left exactly one deferral for its view (AC-4)").toBe(1);
  viewKey = said(deferrals[0] as Record<string, unknown>, "viewKey", "view_key");
}, 600_000);

afterAll(async () => {
  await closeStage();
});

describe("AC-5: AUTHOR_TYPICAL_RANGE", () => {
  test("AC-5: the act stands in the closed law and in the transport vocabulary", async () => {
    expect(acts.ACT_TYPES, "the act type is a member of the closed enum (L-ACT-03)").toContain(AUTHOR_TYPICAL_RANGE);
    expect(acts.ACT_PERMISSION[AUTHOR_TYPICAL_RANGE], "the act moves MEASURE (L-ACT-03)").toBe(MEASURE);

    const transport = await productModule<{ TRANSPORT_VOCABULARY: readonly Vocabulary[] }>(TRANSPORT_VOCABULARY_MODULE);
    // The vocabulary the act types travel in is the one that carries them — found by an act type
    // that already stood, so nothing here re-spells the vocabulary's own name (Q-07).
    const carrying = transport.TRANSPORT_VOCABULARY.filter((entry) => entry.codes.includes("INSERT_LEVEL"));
    expect(carrying.length, "one vocabulary carries the act types").toBe(1);
    expect(ordered((carrying[0] as Vocabulary).codes), "every act type has a line in it, this one included").toEqual(ordered(acts.ACT_TYPES));
  });

  test("AC-5: a MEASURER's preview states one subject per placeholder, each naming the six keys it becomes", async () => {
    const from = levelNamed(levels, STACK_LABELS[0] as string);
    const to = levelNamed(levels, STACK_LABELS[STACK_LABELS.length - 1] as string);
    const consequence = await acts.preview(measurer, authoring(from.levelId, to.levelId));

    const placeholders = registerObjectRows(stage.person.tenantId, setRevisionId)
      .map((row) => said(row, "objectKey", "object_key"))
      .filter((key) => key.endsWith(`@${UNRESOLVED}`));
    const subjects = (consequence.subjects ?? []) as readonly { subjectId?: unknown; before?: readonly string[]; after?: readonly string[] }[];
    expect(subjects.length, "one subject per placeholder the act retires (L-ACT-02)").toBe(placeholders.length);
    expect(ordered(subjects.map((subject) => String(subject.subjectId))), "each subject is one of the placeholders").toEqual(ordered(placeholders));

    const owed = new Set(expectedKeys());
    for (const subject of subjects) {
      const named = [...(subject.before ?? []), ...(subject.after ?? [])].map(String).filter((value) => owed.has(value));
      expect(named.length, `the subject ${String(subject.subjectId)} names the six keys it becomes`).toBe(levels.length);
    }
    const namedAll = new Set(subjects.flatMap((subject) => [...(subject.before ?? []), ...(subject.after ?? [])].map(String).filter((value) => owed.has(value))));
    expect(ordered([...namedAll]), "between them the subjects name every key the act first-registers").toEqual(ordered([...owed]));
  });

  test("AC-5: a REVIEWER may not, and an endpoint no live level carries refuses at preview", async () => {
    const from = levelNamed(levels, STACK_LABELS[0] as string);
    const to = levelNamed(levels, STACK_LABELS[STACK_LABELS.length - 1] as string);

    const refused = await rejection(acts.preview(reviewer, authoring(from.levelId, to.levelId)));
    expect(refused, "a REVIEWER holds REVIEW, not MEASURE (L-ACT-03)").not.toBeNull();
    expect(await codeOf(refused), "the door names the permission that was not held").toBe(PERMISSION_NOT_HELD);

    const unmapped = await rejection(acts.preview(measurer, authoring(from.levelId, randomUUID())));
    expect(unmapped, "an endpoint the stack does not carry is refused before anything is written").not.toBeNull();
    expect(await codeOf(unmapped), "and it is refused under the reason the expansion defers by").toBe(LEVEL_RANGE_ENDPOINT_UNMAPPED);
  });

  test("AC-5: committing it registers all N, retires the placeholders and writes one authored range", async () => {
    const from = levelNamed(levels, STACK_LABELS[0] as string);
    const to = levelNamed(levels, STACK_LABELS[STACK_LABELS.length - 1] as string);
    const input = authoring(from.levelId, to.levelId);
    const consequence = await acts.preview(measurer, input);
    const written = await acts.commit(measurer, input, acts.consequenceDigest(consequence));
    expect(typeof written.actId, "committing answered the act it wrote").toBe("string");

    expect(standingKeys(), "the view's placements now stand on every level of the authored range").toEqual(expectedKeys());
    const rows = registerObjectRows(stage.person.tenantId, setRevisionId);
    const onDrawn = rows.filter((row) => said(row, "levelId", "level_id") === from.levelId);
    expect(new Set(onDrawn.map((row) => said(row, "standing", "standing"))), "the range's first level carries the measured rows").toEqual(new Set([MEASURED]));
    expect(onDrawn.length, "one measured row per placement").toBe(rows.length / levels.length);
    expect(
      new Set(rows.filter((row) => said(row, "levelId", "level_id") !== from.levelId).map((row) => said(row, "standing", "standing"))),
      "the undrawn levels carry derived rows",
    ).toEqual(new Set([DERIVED]));
    expect(rows.filter((row) => said(row, "objectKey", "object_key").endsWith(`@${UNRESOLVED}`)), "no placeholder stands for the view any more").toEqual([]);

    expect(tableStands(TYPICAL_RANGES), `the product's migration lane lands public.${TYPICAL_RANGES}`).toBe(true);
    const authored = typicalRangeRows(stage.person.tenantId);
    expect(authored.length, "exactly one authored range stands for the view").toBe(1);
    const range = authored[0] as Record<string, unknown>;
    expect(said(range, "viewKey", "view_key"), "the range names the view it was authored for").toBe(viewKey);
    expect(said(range, "fromLevelId", "from_level_id"), "and the level it runs from").toBe(from.levelId);
    expect(said(range, "toLevelId", "to_level_id"), "and the level it runs to").toBe(to.levelId);
    expect(said(range, "actId", "act_id"), "and the act that authored it").toBe(written.actId);

    const acted = actRowsOf(stage.person.tenantId).filter((row) => said(row, "type", "type") === AUTHOR_TYPICAL_RANGE);
    expect(acted.length, "one act of this type stands in the ledger").toBe(1);
  });

  test("AC-5: a re-run of the partition leaves the identical keys, no deferral and no new refusal", async () => {
    const before = standingKeys();
    const refusedBefore = refusedSightingRows(stage.person.tenantId).length;
    expect(before.length, "the authored range stands before the re-run").toBe(expectedKeys().length);

    await runPlacementPartition(stage, staged, "typical-range-again");

    expect(standingKeys(), "a re-derivation reproduces the identical key multiset (L-REG-04)").toEqual(before);
    expect(expansionDeferralRows(stage.person.tenantId, staged.ingestId), "the view no longer defers: its range is authored").toEqual([]);
    expect(refusedSightingRows(stage.person.tenantId).length, "re-registering what already stands refuses nothing").toBe(refusedBefore);
  });
});

/**
 * J-021 (partition leg): the three new stages are TOTAL over the real corpus.
 *
 * The journey's own leg is `tests/e2e/viewer-partition.spec.ts`, which this increment neither owns
 * nor changes: it adds no screen, no route and no string. What this leaf can move — and therefore
 * what this file grades — is the partition run the leg stands on: over `fixtures/rcc6`, read by the
 * shipped `cad/` CLI and partitioned by the shipped job, the three new stages record their steps,
 * the expansion says `revisions: 0` where no set revision is pinned, and the views the leg reads are
 * still stored. A stage that threw on a view with no evidence of its kind would take the whole leg
 * down; this is that check, at the level this increment can affect.
 *
 * What the leg RENDERS — the viewer route, the axes drawn on it — is the screen's, and no line this
 * increment may lawfully write moves it, so it is not asserted here.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  artifactWithout,
  bnbcArtifact,
  stageArtifactIngest,
  EXPANSION_STAGE,
  EXPECTED_STAGES,
  GRID_STAGE,
  LEVELS_PROPOSAL_STAGE,
  PLACEMENT_STAGE,
  SCHEDULES_STAGE,
  STORED_STEP,
  VIEWS_STAGE,
  closeStage,
  placementRows,
  proposedLevelRows,
  rowsOfIngest,
  runPlacementPartition,
  stageCorpusIngest,
  stagePlacementProject,
  said,
  stepDetail,
  stepNames,
  type PlacementStage,
  type StepRecord,
  type StoreRow,
} from "../support/placement-stage";

/** The stored partition's own table of views — what the leg's viewer reads a view out of. */
const PARTITION_VIEWS = "partition_views";

let stage: PlacementStage;
let corpus: { drawingId: string; ingestId: string };
let steps: StepRecord[];

beforeAll(async () => {
  stage = await stagePlacementProject("journey");
  corpus = await stageCorpusIngest(stage, "j021-rcc6");
  // The run itself is the assertion of totality: a stage that threw over the corpus fails here.
  steps = await runPlacementPartition(stage, corpus, "j021");
}, 900_000);

afterAll(async () => {
  await closeStage();
});

describe("J-021: the partition leg keeps running over the real corpus", () => {
  test("J-021: every stage of the list records its step over fixtures/rcc6, in order", () => {
    const recorded = stepNames(steps);
    for (const stageName of EXPECTED_STAGES) expect(recorded, `the run over the corpus recorded a \`${stageName}\` step`).toContain(stageName);
    const order = [VIEWS_STAGE, GRID_STAGE, SCHEDULES_STAGE, PLACEMENT_STAGE, EXPANSION_STAGE, LEVELS_PROPOSAL_STAGE, STORED_STEP].map((step) => recorded.indexOf(step));
    expect(order.every((at) => at >= 0), `every step of the order was recorded: ${recorded.join(", ")}`).toBe(true);
    expect(order, `the steps stand in order: ${recorded.join(", ")}`).toEqual([...order].sort((left, right) => left - right));
  });

  test("J-021: nothing is registered where no set revision is pinned", () => {
    const detail = stepDetail(steps, EXPANSION_STAGE);
    expect(Number(detail["revisions"]), "no set of this project is pinned, so no revision names the drawing (L-REG-06)").toBe(0);
    expect(Number(detail["registered"]), "and a drawing nothing has been measured under registers nothing").toBe(0);
  });

  test("J-021: the views the leg reads are still stored, and each new stage stored what it says it read", () => {
    const views = rowsOfIngest(PARTITION_VIEWS, stage.person.tenantId, corpus.ingestId);
    const stored = stepDetail(steps, STORED_STEP);
    expect(views.length, "the partition stores the views it says it stored").toBe(Number(stored["views"]));
    expect(views.length, "the corpus is a drawing set: the leg has views to read").toBeGreaterThan(0);

    // Whatever the corpus gives the two storing stages — evidence or nothing at all — what they say
    // they read is what stands in the store afterwards. A stage that examined nothing writes nothing
    // and says so; it does not throw, and it does not leave rows it never reported (R-UI-050).
    const placement = stepDetail(steps, PLACEMENT_STAGE);
    expect(placementRows(stage.person.tenantId, corpus.ingestId).length, "the placements the placement stage reported are the placements stored").toBe(Number(placement["placements"]));
    const proposal = stepDetail(steps, LEVELS_PROPOSAL_STAGE);
    expect(proposedLevelRows(stage.person.tenantId, corpus.ingestId).length, "and the levels the proposal stage reported are the levels proposed").toBe(Number(proposal["proposed"]));
  });
});

/* ------------------------------------------------------------------ I-303 over the M3 yardstick */

/**
 * THE ONE OVER-MEASUREMENT PATH IN THE WHOLE OF I-303, GRADED WHERE IT LIVES.
 *
 * Binding a note to a member that already stood can only ever NARROW that member's span, and a
 * narrowing is disclosed by L-QTY-06's own band. MINTING is the other direction: a note that reaches
 * the wrong unclaimed ring bills a member the drawing does not have, and L-MEA-09 says an
 * over-measured figure is never a disclosure. So the minting is graded over the REAL corpus, by
 * name, before anything downstream can depend on it.
 *
 * F-RCC6-BNBC's S-10 COLUMN LAYOUT PLAN writes two notes (I-303's own measurement): `C7 %%C450 PORCH
 * COLUMN` over a member its own mark placed, and `C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)` over a
 * rectangle the sheet tags with no mark at all — the sheet tags only its ground-floor columns and
 * mark C5 has no ground-floor member. "Dashed" is invisible to this product (the artifact carries no
 * linetype and that ring's colour is bylayer like every other column's), so the NOTE is the whole of
 * the evidence and the ring is merely what it reaches.
 *
 * The drawing is read TWICE, both times through the shipped pipeline: once as the office drew it,
 * and once with those two sentences taken out of the artifact. Every member that stood without them
 * has to stand, key for key and point for point, WITH them — which is the whole of "minting a member
 * moves no figure of any member that stood before it" (L-MEA-01, L-QTY-06), and it is proved by a
 * second reading of the same drawing rather than by a number anybody transcribed (B-19).
 */
const S10_VIEW = "v:LAYOUT_PLAN:DXF_HANDLE:20B6";

/** The two sentences, and the entities that carry them (I-303's `Measured` paragraph). */
const PORCH_NOTE_KEY = "DXF_HANDLE:9BA";
const FLOATING_NOTE_KEY = "DXF_HANDLE:9BC";
const PORCH_NOTE = "C7 %%C450 PORCH COLUMN";
const FLOATING_NOTE = "C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)";

/** The ring the floating note reaches, and the two entities the porch member was placed off. */
const FLOATING_OUTLINE = "DXF_HANDLE:9BB";
const PORCH_OUTLINE = "DXF_HANDLE:994";
const PORCH_MARK = "DXF_HANDLE:9AF";

/** What the sheet's own marks place on S-10, and therefore what may not move (I-303's mark roster). */
const S10_MARK_PLACEMENTS = 26;

/** One stored placement, in the fields two readings of one drawing are compared on. */
function numerically(row: StoreRow): Record<string, string> {
  return {
    placementKey: said(row, "placementKey", "placement_key"),
    viewKey: said(row, "viewKey", "view_key"),
    mark: said(row, "mark", "mark"),
    markText: said(row, "markText", "mark_text"),
    elementType: said(row, "elementType", "element_type"),
    x: said(row, "x", "x"),
    y: said(row, "y", "y"),
    gridLetter: said(row, "gridLetter", "grid_letter"),
    gridNumeral: said(row, "gridNumeral", "grid_numeral"),
    outlineKey: said(row, "outlineKey", "outline_key"),
    markKey: said(row, "markKey", "mark_key"),
    memberFamily: said(row, "memberFamily", "member_family"),
  };
}

/** Every placement of one ingest, in the key's own order, as the comparison reads them. */
function comparable(tenantId: string, ingestId: string): Record<string, string>[] {
  return placementRows(tenantId, ingestId)
    .map(numerically)
    .sort((left, right) => (left["placementKey"] === right["placementKey"] ? 0 : (left["placementKey"] as string) < (right["placementKey"] as string) ? -1 : 1));
}

describe("I-303 over F-RCC6-BNBC: what the two notes on S-10 place, and what they leave alone", () => {
  let asDrawn: { drawingId: string; ingestId: string };
  let noteless: { drawingId: string; ingestId: string };
  let drawnSteps: StepRecord[];

  beforeAll(async () => {
    const artifact = await bnbcArtifact();
    asDrawn = await stageArtifactIngest(stage, artifact, "bnbc-as-drawn");
    noteless = await stageArtifactIngest(stage, artifactWithout(artifact, [PORCH_NOTE_KEY, FLOATING_NOTE_KEY]), "bnbc-noteless");
    drawnSteps = await runPlacementPartition(stage, asDrawn, "bnbc-as-drawn");
    await runPlacementPartition(stage, noteless, "bnbc-noteless");
  }, 900_000);

  test("the two sentences are read as notes, and they are the only two on the drawing", () => {
    const noted = placementRows(stage.person.tenantId, asDrawn.ingestId).filter((row) => said(row, "noteKey", "note_key") !== "");
    expect(
      noted.map((row) => said(row, "noteText", "note_text")).sort(),
      `exactly two members of this drawing are noted: ${noted.map((row) => `${said(row, "mark", "mark")}=${said(row, "noteText", "note_text")}`).join(" | ")}`,
    ).toEqual([FLOATING_NOTE, PORCH_NOTE].sort());
    const detail = stepDetail(drawnSteps, PLACEMENT_STAGE);
    expect([Number(detail["noted"]), Number(detail["minted"])], "and the step says so: two members named by a note, one of them placed by one").toEqual([2, 1]);
  });

  test("the porch note BINDS to the member its own mark placed, and states the shape (I-304)", () => {
    const porch = placementRows(stage.person.tenantId, asDrawn.ingestId).filter((row) => said(row, "noteKey", "note_key") === PORCH_NOTE_KEY);
    expect(porch.length, "one member carries the porch note").toBe(1);
    const row = porch[0] as StoreRow;
    expect(said(row, "mark", "mark"), "the mark the note names").toBe("C7");
    expect([said(row, "outlineKey", "outline_key"), said(row, "markKey", "mark_key")], "it is still placed off its own ring and its own mark").toEqual([PORCH_OUTLINE, PORCH_MARK]);
    expect(said(row, "noteShape", "note_shape"), "the PLAN states the shape and the schedule the size (I-304)").toBe("ROUND");
    expect(
      [said(row, "noteFromLabel", "note_from_label"), said(row, "noteToLabel", "note_to_label")],
      "and it states no range at all, which I-303 reads as the level the plan DRAWS",
    ).toEqual(["", ""]);
  });

  test("the floating note PLACES its member, on the one ring no mark of this plan anchors", () => {
    const floating = placementRows(stage.person.tenantId, asDrawn.ingestId).filter((row) => said(row, "noteKey", "note_key") === FLOATING_NOTE_KEY);
    expect(floating.length, "one member stands on the floating note").toBe(1);
    const row = floating[0] as StoreRow;
    expect(said(row, "mark", "mark"), "the mark the sentence opens with").toBe("C5");
    expect(said(row, "outlineKey", "outline_key"), "THE RING, BY NAME: the rectangle the sheet draws and tags with no mark").toBe(FLOATING_OUTLINE);
    // L-CAD-03: a placement nobody can trace back to the two entities it was read from is a reading
    // nobody can audit. Here they are the ring and the sentence, and the sentence IS the namer.
    expect(said(row, "markKey", "mark_key"), "and the sentence that named it").toBe(FLOATING_NOTE_KEY);
    expect(said(row, "markText", "mark_text"), "kept as the drawing spelled it").toBe(FLOATING_NOTE);
    expect(
      [said(row, "noteFromLabel", "note_from_label"), said(row, "noteToLabel", "note_to_label"), said(row, "noteShape", "note_shape")],
      "`STARTS AT 1F` is the first floor upwards, with an open top and no shape stated",
    ).toEqual(["1F", "", ""]);
  });

  test("the ring the note reached is a ring NO placement of the noteless reading stands on", () => {
    const without = placementRows(stage.person.tenantId, noteless.ingestId).map((row) => said(row, "outlineKey", "outline_key"));
    expect(without.includes(FLOATING_OUTLINE), "no mark of this drawing anchors it — which is why the note is the whole of the evidence").toBe(false);
  });

  test("EVERY member that stood without the two sentences stands with them, key for key and point for point", () => {
    const without = comparable(stage.person.tenantId, noteless.ingestId);
    const with_ = comparable(stage.person.tenantId, asDrawn.ingestId).filter((row) => row["markKey"] !== FLOATING_NOTE_KEY);
    expect(without.length, "the drawing places members without its notes").toBeGreaterThan(S10_MARK_PLACEMENTS);
    // The note pass runs over a population already closed: the plan's footprint median and the
    // drawing's scale are the mark-anchored candidates', and the minted member joins neither.
    expect(with_, "minting a member moved no figure of any member that stood before it (L-MEA-01, L-QTY-06)").toEqual(without);
    expect(comparable(stage.person.tenantId, asDrawn.ingestId).length, "the drawing gained exactly one member, and it is the minted one").toBe(without.length + 1);
  });

  test("S-10 places the 26 its marks name, and the 27th is the one the note placed", () => {
    const onS10 = placementRows(stage.person.tenantId, asDrawn.ingestId).filter((row) => said(row, "viewKey", "view_key") === S10_VIEW);
    const minted = onS10.filter((row) => said(row, "markKey", "mark_key") === FLOATING_NOTE_KEY);
    expect(onS10.length - minted.length, "the sheet's own mark roster: C2x8, C4x7, C3x6, C1x3, C6x1, C7x1").toBe(S10_MARK_PLACEMENTS);
    expect(minted.length, "and one member nobody tagged, standing on a sentence").toBe(1);
  });
});

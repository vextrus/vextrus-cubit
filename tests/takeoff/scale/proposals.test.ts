/**
 * AC-4 — what the machine PROPOSES for a view, recomputed from the frozen artifact, the stored grid
 * and the file's own header on every read, and what a view with no affirmation is (L-MEA-05,
 * R-TO-020, L-CAD-07).
 *
 * The staged drawing is ingested and partitioned by the shipped pipeline, so the views, the
 * assignments and the grid the proposals stand on are the product's own. Every factor expected below
 * is derived from the artifact's own numbers — a fixture whose dimension moves moves the expectation
 * with it (B-19).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  CALIBRATIONS,
  DIMENSION_RATIO,
  FILE_UNITS,
  GRID_MATCH_TOLERANCE,
  GRID_SPACING,
  MM,
  PRINCIPAL,
  QS_TWO_POINT,
  SCALE_AFFIRMATIONS,
  SCALE_NO_EVIDENCE,
  SCENARIO,
  affirmedOf,
  answerFor,
  closeStage,
  factorOf,
  grantRole,
  matchedBubblesOf,
  metresPerString,
  nearestGapMissOf,
  openSheetsStage,
  proposalsOf,
  rowsHeld,
  scaleCore,
  scaleDoor,
  scopeOf,
  stagePerson,
  stageScaleIngest,
  storageOf,
  unmatchedBubblesOf,
  viewKeyHolding,
  type Cluster,
  type Dimension,
  type Person,
  type ProposalRow,
  type StagedScale,
} from "./support/scale-stage";

/** How long a staged case may take: an ingest recorded and a partition rebuilt over it. */
const BUDGET_MS = 600_000;

interface Staged {
  person: Person;
  projectId: string;
  staged: StagedScale;
  cluster: Cluster;
  viewKey: string;
}

let staging: Promise<Staged> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("scale-proposals");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const ingest = await stageScaleIngest(person, projectId, SCENARIO.GRID_DIMS, 11);
    const cluster = ingest.artifact.clusters[0] as Cluster;
    return { person, projectId, staged: ingest, cluster, viewKey: viewKeyHolding(person, ingest, cluster.captionKey) };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** What the door answers for the staged layout plan, read through the door's own scope. */
async function proposals(): Promise<ProposalRow[]> {
  const stage = await staged();
  const door = await scaleDoor();
  const answered = await door.scaleProposalsOf(scopeOf(stage.person, stage.projectId, stage.staged), { storage: await storageOf() });
  return proposalsOf(answerFor(answered, stage.viewKey));
}

/** The one proposal standing at a rank, asserted present first so a missing rank reds as itself. */
function at(rows: readonly ProposalRow[], rank: string): ProposalRow {
  const found = rows.filter((row) => row.rank === rank);
  expect(found.length, `the machine offers exactly one ${rank} proposal for the staged plan`).toBe(1);
  return found[0] as ProposalRow;
}

/** The dimensions of the staged cluster whose span really matches a gap of the staged grid. */
function spanning(cluster: Cluster): Dimension[] {
  return cluster.dimensions.filter((dimension) => matchedBubblesOf(cluster, dimension) !== null);
}

/** The dimension whose span matches no grid gap at all — a ratio, and nothing a grid vouches for. */
function offGrid(cluster: Cluster): Dimension {
  const found = cluster.dimensions.filter((dimension) => matchedBubblesOf(cluster, dimension) === null);
  expect(found.length, "the staged plan draws exactly one dimension whose span matches no grid spacing").toBe(1);
  return found[0] as Dimension;
}

/** The one dimension of an axis that a grid vouches for. */
function spanningAlong(cluster: Cluster, axis: "x" | "y"): Dimension {
  const found = spanning(cluster).filter((dimension) => dimension.axis === axis);
  expect(found.length, `the staged plan draws exactly one grid-matched dimension along ${axis}`).toBe(1);
  return found[0] as Dimension;
}

describe("AC-4: the machine proposes ranks 2 to 4 from the artifact, the grid and the header", () => {
  test("AC-4: the proposals stand in the precedence order of the ranks that could be read", async () => {
    const core = await scaleCore();
    const rows = await proposals();
    expect(
      rows.map((row) => row.rank),
      "a machine reads ranks 2 to 4 and never rank 1 — a QS observation is a person's, and the list is ranked by the law's own precedence (L-MEA-05, R-TO-020)",
    ).toEqual(core.SCALE_RANKS.filter((rank) => rank !== QS_TWO_POINT));
  }, BUDGET_MS);

  test("AC-4: each rank's factor pair is what its own evidence says, carried into metres by the header", async () => {
    const stage = await staged();
    const cluster = stage.cluster;
    const alongX = spanningAlong(cluster, "x");
    const alongY = spanningAlong(cluster, "y");

    // What the staged plan really draws, before what the product read of it: two dimensions spanning
    // adjacent grid positions, one along each axis, and a third that matches no gap while stating the
    // same metres-per-unit — so the two ranks below agree on the factor and differ only in evidence.
    expect(spanning(cluster).map((dimension) => dimension.axis).sort(), "two dimensions span adjacent grid positions, one along each world axis").toEqual(["x", "y"]);
    expect(offGrid(cluster).axis, "and the third dimension runs along x, where it matches no gap between adjacent grid positions").toBe("x");
    expect(factorOf(offGrid(cluster), MM), "stating the same metres-per-unit as the grid-matched dimension of its own axis").toBe(factorOf(alongX, MM));
    expect(stage.staged.artifact.insunits.unit, "and the header says millimetres, so a ratio can be carried into metres at all").toBe(MM);

    const rows = await proposals();

    for (const rank of [GRID_SPACING, DIMENSION_RATIO]) {
      const proposal = at(rows, rank);
      expect(
        { factorX: proposal.factorX, factorY: proposal.factorY },
        `${rank} reads what each dimension states over what it really spans, per axis, times the metres the header's unit is worth (riskNotes (1) to (3))`,
      ).toStrictEqual({ factorX: factorOf(alongX, MM), factorY: factorOf(alongY, MM) });
    }

    const header = at(rows, FILE_UNITS);
    expect({ factorX: header.factorX, factorY: header.factorY }, "and the header alone says one millimetre of the world per drawing unit, on both axes").toStrictEqual({
      factorX: metresPerString(MM),
      factorY: metresPerString(MM),
    });
  }, BUDGET_MS);

  test("AC-4: each proposal cites the entities it was read off, and no proposal cites a note that merely claims a scale", async () => {
    const stage = await staged();
    const cluster = stage.cluster;
    const alongX = spanningAlong(cluster, "x");
    const alongY = spanningAlong(cluster, "y");
    const matched = [...(matchedBubblesOf(cluster, alongX) ?? []), ...(matchedBubblesOf(cluster, alongY) ?? [])].map((bubble) => bubble.key);
    const unmatched = [...unmatchedBubblesOf(cluster, alongX), ...unmatchedBubblesOf(cluster, alongY)];

    // What makes this fixture able to tell a real gap comparison from a reader that takes the first
    // thing it meets: on each axis the pair the match falls between is not the family's first pair,
    // the dimension a grid vouches for is not the first one drawn along its axis, and the dimension
    // no grid vouches for misses a real gap by more than the tolerance but not by much (B-19). A
    // fixture edit that lost any of these would red HERE rather than quietly hollowing the case.
    expect(unmatched.length, "each family draws a position the match does not fall between, so citing the whole family is visibly not citing the match").toBeGreaterThan(0);
    for (const axis of ["x", "y"] as const) {
      const spanned = spanningAlong(cluster, axis);
      const family = axis === "x" ? "letter" : "numeral";
      const positions = cluster.bubbles.filter((bubble) => bubble.family === family);
      const byPosition = [...positions].sort((left, right) => (axis === "x" ? left.centre[0] - right.centre[0] : left.centre[1] - right.centre[1]));
      const cited = (matchedBubblesOf(cluster, spanned) ?? []).map((bubble) => bubble.key);
      expect(cited, `along ${axis} the match does not fall between the family's first pair as they were drawn — an ordinal cannot stand in for the comparison`).not.toContain(
        positions[0]?.key,
      );
      expect(cited, `nor between its first pair as their positions run, so neither reading order can stand in for it either`).not.toContain(byPosition[0]?.key);
    }
    // And on the axis that carries more than one dimension, the one a grid vouches for is not the one
    // drawn first: a reader that took the first dimension of an axis answers different evidence here.
    const contested = (["x", "y"] as const).filter((axis) => cluster.dimensions.filter((dimension) => dimension.axis === axis).length > 1);
    expect(contested.length, "an axis carries more than one dimension, so which of them a grid vouches for is a question at all").toBeGreaterThan(0);
    for (const axis of contested) {
      expect(cluster.dimensions.filter((dimension) => dimension.axis === axis)[0]?.key, `the first dimension drawn along ${axis} is not the one the grid vouches for`).not.toBe(
        spanningAlong(cluster, axis).key,
      );
    }
    const miss = nearestGapMissOf(cluster, offGrid(cluster));
    expect(miss, "the unmatched dimension really misses every gap — by more than riskNotes (4) allows").toBeGreaterThan(GRID_MATCH_TOLERANCE);
    expect(miss, "and it misses by little enough that a reader comparing loosely would have taken it").toBeLessThan(GRID_MATCH_TOLERANCE * 20);

    const rows = await proposals();

    const grid = at(rows, GRID_SPACING);
    expect(grid.evidence, "a grid match is vouched for by the two bubbles it fell between on each axis, and by the dimensions that spanned them (riskNotes (4))").toEqual(
      expect.arrayContaining([...matched, alongX.key, alongY.key]),
    );
    for (const bubble of unmatched) {
      expect(
        grid.evidence,
        `the bubble at ${bubble.label} is not one of the two ${bubble.family} positions a matched span fell between, so a grid match does not rest on it — evidence is what was compared, not the family it was compared within`,
      ).not.toContain(bubble.key);
    }
    expect(grid.evidence, "the dimension whose span matches no gap vouched for no grid match, so it is not evidence of one").not.toContain(offGrid(cluster).key);

    const ratio = at(rows, DIMENSION_RATIO);
    expect(ratio.evidence, "the ratio rank reads every dimension of the view, the one no grid vouches for included").toEqual(
      expect.arrayContaining(cluster.dimensions.map((dimension) => dimension.key)),
    );

    const note = stage.staged.artifact.noteKey ?? "";
    expect(note, "the staged plan really draws a note that says a scale").not.toBe("");
    for (const row of rows) {
      expect(row.evidence, `${row.rank} cites entities it measured; a text that merely SAYS "1:100" is a claim, and L-MEA-05 ranks no rank on one`).not.toContain(note);
    }
  }, BUDGET_MS);

  test("AC-4: with no act naming it, the view has no scale, says so by name, and nothing was stored", async () => {
    const stage = await staged();
    const door = await scaleDoor();
    const answered = await door.scaleProposalsOf(scopeOf(stage.person, stage.projectId, stage.staged), { storage: await storageOf() });
    const answer = answerFor(answered, stage.viewKey);

    expect(affirmedOf(answer), "proposals are what the machine offers; a scale is what an act affirmed, and no act has (L-MEA-05)").toBeNull();
    expect(answer.refusal, "a view no act names has no scale, and the refusal is declared rather than left silent").toBe(SCALE_NO_EVIDENCE);

    expect(rowsHeld(CALIBRATIONS, stage.person.tenantId), "ranks 2 to 4 are recomputed on every read, never stored: reading them wrote no calibration").toBe(0);
    expect(rowsHeld(SCALE_AFFIRMATIONS, stage.person.tenantId), "and no affirmation either — a proposal is not a fact about the project").toBe(0);
  }, BUDGET_MS);
});

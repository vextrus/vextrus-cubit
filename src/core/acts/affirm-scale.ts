// AFFIRM_SCALE (L-MEA-05: "Scale is established by affirmation acts, each naming the views it covers
// (a scale group is the subject set of one act), the rank it stood on and the source keys under it"),
// rendered as L-ACT-02's pair.
//
// The act names its views and the rank it stands on. What each view moves TO is not the caller's to
// say: the factor pair is derived here, from the state the seam's own transaction read — the
// machine's proposal at that rank (ranks 2 to 4, recomputed from the frozen artifact) or the
// person's own observations judged against it (rank 1) — so the Consequence carries what the
// current state supports and nothing a caller typed (L-ACT-02). A rank the evidence does not carry
// is refused by name, never filled from a weaker one: X and Y derive independently and are averaged
// as nothing, and a view's scale is the rank it stood on (L-MEA-05).
//
// Nothing is overwritten (L-ACT-01): a calibration is content-addressed and an affirmation is a row
// appended naming the act that carried it, so a re-affirmation is a later act rather than an edit.
import { type TenantTx } from "../db";
import { refusal } from "../faults/refusal-marker";
import type { RefusalCode } from "../errors";
import {
  QS_TWO_POINT,
  calibrationKey,
  citeObservation,
  factorPair,
  proposalsFor,
  scaleAbsenceCodeOf,
  scaleNoEvidence,
  scaleObservationUncited,
  scaleUnitUnmapped,
  unitFactor,
  verifyAxis,
  type CitedObservation,
  type FactorPair,
  type ScaleAxis,
  type ScaleProposal,
  type ScaleRank,
  type TwoPointObservation,
} from "../scale";
import { scaleEvidenceOf } from "../scale/evidence";
import { affirmationsOfRecord, writeAffirmation, type ViewCalibrationMove } from "../scale/store";
import { scaleTolerancesOf } from "../scale/tolerances";
import { projectDrawingsOf } from "../sheets";
import { appStorage } from "../storage/app";
import { viewRecordsOf, type ViewRecord } from "../views";
import type { Consequence, ConsequenceEffects } from "./consequence";
import { actChangesNothing } from "./refusals";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const AFFIRM_SCALE = "AFFIRM_SCALE" as const;

/** The answer for a drawing with no stored partition to name views of (R-TO-030, R-SPINE-062). */
const PARTITION_NOT_AVAILABLE: RefusalCode = "PARTITION_NOT_AVAILABLE";

/**
 * The act's input: which project and drawing, the rank the affirmation stands on, the views it
 * names (one scale group) and — at rank QS_TWO_POINT — the observations it stands on. Every
 * observation is still judged by `citeObservation`, which reads each field off it as a person's
 * input crossing a transport and refuses what the law does not admit.
 */
export type AffirmScaleInput = {
  readonly type: typeof AFFIRM_SCALE;
  readonly projectId: string;
  readonly drawingId: string;
  readonly rank: ScaleRank;
  readonly viewKeys: readonly string[];
  readonly observations?: readonly TwoPointObservation[];
};

/**
 * What the act derived from the current state: every named view's move, the source keys the rank
 * stood on, and the observations judged — the whole of what the Consequence shows and the commit writes.
 */
type Derived = {
  readonly drawingId: string;
  readonly ingestId: string;
  readonly moves: readonly ViewCalibrationMove[];
  readonly labels: ReadonlyMap<string, string>;
  readonly sourceKeys: readonly string[];
  readonly observations: readonly CitedObservation[];
};

/** The effects an affirmation previews (R-TO-020) — empty until quantity lines and signatures exist to name. */
function effectsOf(): ConsequenceEffects {
  return { linesRederiving: [], signaturesVoiding: [] };
}

/** R-TO-030's refusal for a drawing whose partition holds nothing this act could name. */
function partitionNotAvailable(detail: string, facts: { readonly drawingId: string; readonly viewKey?: string }): Error {
  return refusal(PARTITION_NOT_AVAILABLE, detail, { actType: AFFIRM_SCALE, ...facts });
}

/** Code-point order, the only order a Consequence's subjects are listed in (L-ACT-02: one state, one digest). */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The act, derived from the state this transaction read. The views are resolved against the
 * drawing's current partition, the tolerances against the project's pinned edition, and the factor
 * pair against the evidence the rank names.
 */
async function derive(ctx: ActorCtx, input: AffirmScaleInput, tx: TenantTx): Promise<Derived> {
  const named = [...new Set(input.viewKeys)].sort(byCodePoint);
  if (named.length === 0) throw actChangesNothing(AFFIRM_SCALE, []);

  const drawings = await projectDrawingsOf(tx, { tenantId: ctx.tenantId, projectId: input.projectId });
  const drawing = drawings.find((candidate) => candidate.drawingId === input.drawingId);
  if (drawing?.record === undefined || drawing.record === null) {
    throw partitionNotAvailable(`drawing ${input.drawingId} has no ingest record in project ${input.projectId}, so it has no views to affirm a scale for`, { drawingId: input.drawingId });
  }
  const record = drawing.record;
  const scope = { tenantId: ctx.tenantId, ingestId: record.ingestId };

  const views = new Map((await viewRecordsOf(tx, scope)).map((view) => [view.viewKey, view]));
  const members: ViewRecord[] = named.map((viewKey) => {
    const view = views.get(viewKey);
    if (view === undefined) throw partitionNotAvailable(`the partition of drawing ${input.drawingId} holds no view ${viewKey}`, { drawingId: input.drawingId, viewKey });
    return view;
  });

  const tolerances = await scaleTolerancesOf({ tenantId: ctx.tenantId, projectId: input.projectId });
  const evidence = await scaleEvidenceOf(tx, { ...scope, viewKeys: named }, record, appStorage(), tolerances);
  const proposals = proposalsFor(evidence);
  const standing = await affirmationsOfRecord(tx, scope);

  const judged = judgeRank(input, named, evidence.unit, evidence.assignments, proposals, tolerances.verification);

  const moves = members.map((view) => {
    const pair = judged.pairs.get(view.viewKey);
    if (pair === undefined) throw new Error(`no factor pair was derived for ${view.viewKey}, which the act named (L-MEA-05)`);
    return {
      viewKey: view.viewKey,
      outgoingKey: standing.get(view.viewKey)?.calibrationKey ?? null,
      incomingKey: calibrationKey(view.viewKey, pair.factorX, pair.factorY),
      factorX: pair.factorX,
      factorY: pair.factorY,
    };
  });

  return {
    drawingId: drawing.drawingId,
    ingestId: record.ingestId,
    moves,
    labels: new Map(members.map((view) => [view.viewKey, view.caption])),
    sourceKeys: judged.sourceKeys,
    observations: judged.observations,
  };
}

/** What judging a rank yields: one pair per named view, and what it stood on. */
type Judged = {
  readonly pairs: ReadonlyMap<string, FactorPair>;
  readonly sourceKeys: readonly string[];
  readonly observations: readonly CitedObservation[];
};

/**
 * The factor pair each named view takes at the rank the act stands on (L-MEA-05's precedence):
 * rank 4 from the header alone, ranks 2 and 3 from the machine's own proposal for the view, rank 1
 * from the person's observations verified against the machine's. Every rank is judged against the
 * evidence it names and none is filled from another — a view whose evidence does not carry the
 * rank is refused by name.
 */
function judgeRank(
  input: AffirmScaleInput,
  named: readonly string[],
  unit: string | null,
  assignments: ReadonlyMap<string, string>,
  proposals: ReadonlyMap<string, readonly ScaleProposal[]>,
  verificationTolerance: string,
): Judged {
  const pairs = new Map<string, FactorPair>();
  const sourceKeys = new Set<string>();

  if (input.rank === "FILE_UNITS") {
    const pair = unitFactor(unit);
    if (pair === null) throw scaleUnitUnmapped(`the header of drawing ${input.drawingId} names no mapped length unit, so rank FILE_UNITS carries no factor`, { unit });
    for (const viewKey of named) pairs.set(viewKey, pair);
    return { pairs, sourceKeys: [], observations: [] };
  }

  if (input.rank === "GRID_SPACING" || input.rank === "DIMENSION_RATIO") {
    const rank = input.rank;
    for (const viewKey of named) {
      const proposal = (proposals.get(viewKey) ?? []).find((candidate) => candidate.rank === rank);
      if (proposal === undefined) {
        // The same absence the door declares for the view: the header where no machine rank could
        // be read at all, the evidence where this rank in particular was not carried (L-MEA-05).
        if (scaleAbsenceCodeOf(unit) === "SCALE_UNIT_UNMAPPED") {
          throw scaleUnitUnmapped(`the header of drawing ${input.drawingId} names no mapped length unit, so no machine rank carries a factor for ${viewKey}`, { unit });
        }
        throw scaleNoEvidence(`${viewKey} carries no evidence at rank ${rank}, and X and Y derive independently`, { viewKey, rank });
      }
      pairs.set(viewKey, { factorX: proposal.factorX, factorY: proposal.factorY });
      for (const key of proposal.evidence) sourceKeys.add(key);
    }
    return { pairs, sourceKeys: [...sourceKeys], observations: [] };
  }

  if (input.rank === QS_TWO_POINT) {
    const observations = (input.observations ?? []).map((raw) => citeObservation(raw));
    const group = new Set(named);
    for (const observation of observations) {
      for (const point of observation.points) {
        // A citation is a key the named views' assignments hold: a point citing an entity of some
        // other view, or of no view, cites nothing this act can stand on (L-MEA-05, L-CAD-06).
        const holder = assignments.get(point.sourceKey);
        if (holder === undefined || !group.has(holder)) {
          throw scaleObservationUncited(`the point citing ${point.sourceKey} cites no entity the named views hold`, { sourceKey: point.sourceKey, field: "sourceKey" });
        }
        sourceKeys.add(point.sourceKey);
      }
    }
    // The machine's own readings along each axis, across the named views, are what verify a single
    // observation — a person's reading is checked against the drawing's, never against itself.
    const corroborating = (axis: ScaleAxis): string[] =>
      named.flatMap((viewKey) => (proposals.get(viewKey) ?? []).map((proposal) => (axis === "x" ? proposal.factorX : proposal.factorY)));
    const observed = (axis: ScaleAxis): string[] => observations.filter((observation) => observation.axis === axis).map((observation) => observation.factor);
    const x = verifyAxis("x", observed("x"), corroborating("x"), verificationTolerance);
    const y = verifyAxis("y", observed("y"), corroborating("y"), verificationTolerance);
    const pair = factorPair(x.factor, y.factor);
    for (const viewKey of named) pairs.set(viewKey, pair);
    return { pairs, sourceKeys: [...sourceKeys], observations };
  }

  return unranked(input.rank);
}

/** The compile error itself: a rank with no arm above arrives here as something other than `never`. */
function unranked(rank: never): never {
  throw new Error(`"${String(rank)}" is not a rank of L-MEA-05's precedence, so nothing can be affirmed at it`);
}

export const affirmScale: ActRendering<AffirmScaleInput> = {
  async preview(ctx: ActorCtx, input: AffirmScaleInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: AFFIRM_SCALE,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      // N views moving from the calibration they stood under (or none) to the one this act takes
      // them to is the shipped SUBJECTS arm: a scale group is the subject set of one act (L-MEA-05).
      rendering: "SUBJECTS",
      subjects: derived.moves.map((move) => ({
        subjectId: move.viewKey,
        // The caption is what a reader recognises a view by; the key is what the act moves.
        subjectLabel: derived.labels.get(move.viewKey),
        before: move.outgoingKey === null ? [] : [move.outgoingKey],
        after: [move.incomingKey],
      })),
      effects: effectsOf(),
    };
  },

  async commit(ctx: ActorCtx, input: AffirmScaleInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const derived = await derive(ctx, input, tx);
    await writeAffirmation(tx, {
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      drawingId: derived.drawingId,
      ingestId: derived.ingestId,
      actId: act.actId,
      rank: input.rank,
      moves: derived.moves,
      sourceKeys: derived.sourceKeys,
      observations: derived.observations,
    });
  },
};

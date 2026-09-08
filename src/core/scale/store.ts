// L-MEA-05's affirmed scale, stored and read back: the affirmation acts of one record and the
// calibrations they filed. Written by the act seam alone (SEAM-ACT), inside the transaction that
// writes the act row (L-ACT-01), and read on the caller's transaction so a Consequence is judged
// against the state its write lands in (L-ACT-02).
//
// Membership is positive, never residual: a view's scale is the calibration the NEWEST affirmation
// naming that view took it to, and a view no affirmation names reads back as nothing at all.
import { and, calibrations, desc, eq, inArray, scaleAffirmations, type TenantTx } from "../db";
import { isScaleRank, type FactorPair, type ScaleRank } from "./law";
import type { CitedObservation } from "./observation";

/** Which record's affirmations are being read, in whose workspace. */
export type ScaleStoreScope = { readonly tenantId: string; readonly ingestId: string };

/** One view's affirmed scale: the calibration it stands under, the rank it stood on and the act that carried it. */
export type AffirmedCalibration = FactorPair & {
  readonly calibrationKey: string;
  readonly rank: ScaleRank;
  readonly actId: string;
};

/** One view's move under an affirmation: from the key it stood under (or none) to the one it takes. */
export type ViewCalibrationMove = FactorPair & {
  readonly viewKey: string;
  readonly outgoingKey: string | null;
  readonly incomingKey: string;
};

/** One affirmation as the seam writes it: the act, the rank, every view it names and what each moves to. */
export type AffirmationWrite = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  readonly actId: string;
  readonly rank: ScaleRank;
  readonly moves: readonly ViewCalibrationMove[];
  readonly sourceKeys: readonly string[];
  readonly observations: readonly CitedObservation[];
};

/** How an outgoing key of "none" is written in the parallel array — arrays hold no null a reader could trust. */
const NO_KEY = "";

/**
 * The affirmed calibration of every view of one record that an affirmation names, by view key —
 * the newest affirmation naming a view is the one it stands under. A calibration row the newest
 * affirmation points at that is not there is an inconsistency of the store, never a silent absence
 * (ARCH-03): the two were written in one transaction.
 */
export async function affirmationsOfRecord(tx: TenantTx, scope: ScaleStoreScope): Promise<Map<string, AffirmedCalibration>> {
  const affirmed = await tx
    .select({
      affirmationId: scaleAffirmations.affirmationId,
      rank: scaleAffirmations.rank,
      viewKeys: scaleAffirmations.viewKeys,
      incomingKeys: scaleAffirmations.incomingKeys,
      actId: scaleAffirmations.actId,
    })
    .from(scaleAffirmations)
    .where(and(eq(scaleAffirmations.tenantId, scope.tenantId), eq(scaleAffirmations.ingestId, scope.ingestId)))
    .orderBy(desc(scaleAffirmations.createdAt), desc(scaleAffirmations.affirmationId));
  if (affirmed.length === 0) return new Map();

  // Calibrations are read by the keys the affirmations name rather than by the record: a key is a
  // content address, so a re-ingest of the same bytes names the same calibration, filed once.
  const named = [...new Set(affirmed.flatMap((row) => row.incomingKeys))];
  const filed = await tx
    .select({ key: calibrations.key, factorX: calibrations.factorX, factorY: calibrations.factorY })
    .from(calibrations)
    .where(and(eq(calibrations.tenantId, scope.tenantId), inArray(calibrations.key, named)));
  const pairs = new Map(filed.map((row) => [row.key, { factorX: row.factorX, factorY: row.factorY }]));

  const standing = new Map<string, AffirmedCalibration>();
  for (const row of affirmed) {
    if (!isScaleRank(row.rank)) throw new Error(`affirmation ${row.affirmationId} stands on "${row.rank}", which is no rank of L-MEA-05's precedence — the store's CHECK should have refused it`);
    row.viewKeys.forEach((viewKey, index) => {
      if (standing.has(viewKey)) return;
      const key = row.incomingKeys[index];
      if (key === undefined) throw new Error(`affirmation ${row.affirmationId} names ${viewKey} and no calibration for it — the parallel arrays disagree (L-MEA-05)`);
      const pair = pairs.get(key);
      if (pair === undefined) throw new Error(`affirmation ${row.affirmationId} takes ${viewKey} to calibration ${key}, which the store does not hold (L-ACT-01)`);
      standing.set(viewKey, { calibrationKey: key, rank: row.rank, factorX: pair.factorX, factorY: pair.factorY, actId: row.actId });
    });
  }
  return standing;
}

/**
 * Write one affirmation and the calibrations it files, on the seam's transaction. A calibration is
 * content-addressed, so one the store already holds is the same reading and is left as the act
 * that first filed it wrote it; the affirmation row is new every time, because an act is.
 */
export async function writeAffirmation(tx: TenantTx, write: AffirmationWrite): Promise<void> {
  const stamp = { tenantId: write.tenantId, projectId: write.projectId, drawingId: write.drawingId, ingestId: write.ingestId, actId: write.actId };

  if (write.moves.length > 0) {
    await tx
      .insert(calibrations)
      .values(write.moves.map((move) => ({ ...stamp, key: move.incomingKey, viewKey: move.viewKey, factorX: move.factorX, factorY: move.factorY })))
      .onConflictDoNothing({ target: [calibrations.tenantId, calibrations.key] });
  }

  await tx.insert(scaleAffirmations).values({
    ...stamp,
    rank: write.rank,
    viewKeys: write.moves.map((move) => move.viewKey),
    incomingKeys: write.moves.map((move) => move.incomingKey),
    outgoingKeys: write.moves.map((move) => move.outgoingKey ?? NO_KEY),
    sourceKeys: [...write.sourceKeys],
    observations: [...write.observations],
    supersedes: null,
  });
}

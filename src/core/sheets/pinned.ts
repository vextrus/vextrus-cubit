// Which RECORD a pinned revision measured each of its drawings on, and where that record's keys stand
// — the one home of that question (L-REG-06, viewer.md I-422, B-17).
//
// What a campaign read, it read on the record its pinned revision names: the ingest of the very bytes
// the pin recorded (the manifest names each drawing's revision by its sha256), the newest such where
// one file was read twice — never the drawing's CURRENT record, which a later upload moves while what
// was read there stands where it was read. The Trace opens a line's sheet over it, and the coverage
// residue names the sheet a sighting stands on over it (s-coverage I-548); both ask here, so one
// key cannot be answered two sheets by two readings of which record it belongs to.
//
// It reads the store and the artifact door, and judges nothing: the sheet a key stands on is
// `./frames`' one pure reading, handed the standing this file composes.
import { and, desc, drawingSetRevisions, eq, ingests, placements, type TenantTx } from "../db";
import { artifactAt } from "../entitygraph/artifact";
import type { Storage } from "../storage";
import { sheetLabelOf, standingOfGraph, type MemberKeys, type RecordStanding } from "./frames";

/** One placement's grid reading on a pinned record, as the partition stored it. */
export type PinnedGrid = { readonly letter: string | null; readonly numeral: string | null };

/** One drawing of a pinned revision, as a reader of its sheets reads it. */
export type PinnedRecord = {
  /** The ingest that read the bytes the pin recorded. */
  readonly ingestId: string;
  /** The content hash of the record's artifact — the address its text index is kept under (SRCH-1). */
  readonly artifactSha256: string;
  /** Where the record's keys stand: its sheets, its spaces, its windows and the members it placed. */
  readonly standing: RecordStanding;
  /** How a reader names one of this record's sheets: its number, or null for model space. */
  readonly labelOf: (layoutName: string) => string | null;
  /**
   * Where one of this record's placements stands on the plan's own grid: the nearest axis of each
   * family as the partition filed it on THIS record, a family the grid carries no axis of null in its
   * place (L-CAD-07). Null where the record holds no such placement. A later upload's partition moves
   * nothing here: the member stands where it stood when it was read (I-422).
   */
  readonly gridOf: (placementKey: string) => PinnedGrid | null;
};

/**
 * The record each named drawing of one pinned revision was measured on, keyed by drawing. A drawing
 * the revision does not name, or whose pinned bytes nobody read, is absent from the answer: what was
 * read on it names no sheet, which is honest rather than a guess (I-181).
 *
 * Read once per drawing, never once per key (R-TO-050's 50 000 lines): the artifact through the one
 * artifact door, which answers once per content hash, and the record's placements — the outline and
 * the mark each member was read off (L-CAD-03) and its grid — in one read of the record's rows.
 */
export async function pinnedRecordsIn(
  tx: TenantTx,
  tenantId: string,
  setRevisionId: string,
  drawingIds: readonly string[],
  storage: Storage,
): Promise<Map<string, PinnedRecord>> {
  const held = new Map<string, PinnedRecord>();
  const wanted = [...new Set(drawingIds)];
  if (wanted.length === 0) return held;

  const revision = await tx
    .select({ manifest: drawingSetRevisions.manifest })
    .from(drawingSetRevisions)
    .where(and(eq(drawingSetRevisions.tenantId, tenantId), eq(drawingSetRevisions.setRevisionId, setRevisionId)))
    .limit(1);
  const pinned = new Map((revision[0]?.manifest ?? []).map((member) => [member.drawingId, member.sha256]));

  for (const drawingId of wanted) {
    const sha256 = pinned.get(drawingId);
    if (sha256 === undefined) continue;
    const rows = await tx
      .select({ ingestId: ingests.ingestId, artifactSha256: ingests.artifactSha256 })
      .from(ingests)
      .where(and(eq(ingests.tenantId, tenantId), eq(ingests.drawingId, drawingId), eq(ingests.sha256, sha256)))
      .orderBy(desc(ingests.createdAt), desc(ingests.ingestId))
      .limit(1);
    const record = rows[0];
    if (record === undefined) continue;

    const graph = await artifactAt(tenantId, record.artifactSha256, storage, `ingest ${record.ingestId}`);
    const placed = await tx
      .select({ placementKey: placements.placementKey, outlineKey: placements.outlineKey, markKey: placements.markKey, gridLetter: placements.gridLetter, gridNumeral: placements.gridNumeral })
      .from(placements)
      .where(and(eq(placements.tenantId, tenantId), eq(placements.ingestId, record.ingestId)));
    const members = new Map<string, MemberKeys>();
    const grids = new Map<string, PinnedGrid>();
    for (const row of placed) {
      members.set(row.placementKey, { outlineKey: row.outlineKey, markKey: row.markKey });
      grids.set(row.placementKey, { letter: row.gridLetter, numeral: row.gridNumeral });
    }
    held.set(drawingId, {
      ingestId: record.ingestId,
      artifactSha256: record.artifactSha256,
      standing: standingOfGraph(graph, members),
      labelOf: (layoutName) => sheetLabelOf(graph, layoutName),
      gridOf: (placementKey) => grids.get(placementKey) ?? null,
    });
  }
  return held;
}

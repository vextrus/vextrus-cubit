// The one read a note is made over: the text entities of ONE sheet of one drawing, as the artifact
// that ingest recorded holds them (R-TO-034, L-CAD-03).
//
// It stands in core rather than in the takeoff module because TRANSCRIBE_SHEET_NOTES judges a
// reading's evidence with it — a reading citing text that is not on the sheet is refused at the
// preview — and an act is core (ARCH-01). The module's notes door re-publishes it, so the grammar
// the screen runs and the grammar the seam re-runs read exactly the same sheet (B-17).
//
// Nothing is stored: the texts are read off the artifact the current ingest record points at, which
// is the same rule `sheetsOfRecord` is written under — a stored copy would be a second answer to a
// question the artifact already answers, and it could disagree with the record it came from.
import { and, desc, drawings, eq, forTenant, ingests, isUuid } from "../db";
import { artifactAt } from "../entitygraph/artifact";
import { appStorage } from "../storage/app";
import type { SheetText } from "./grammar";

export type { SheetText } from "./grammar";

/** Which sheet's texts are being read, in whose workspace: a sheet is (drawing, layout). */
export type NotesSheetScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
};

/** The record types that carry words a person can read a figure out of (L-CAD-05, the sheets' own). */
const TEXT_TYPES: readonly string[] = ["TEXT", "MTEXT"];

/**
 * The texts of one sheet, in the artifact's own order — the order the drawing was written in, which
 * is what makes a proposal list stable between two reads of one sheet.
 *
 * A drawing of another project, a drawing nobody has ingested and a layout the artifact does not
 * hold all answer the empty list: none of them is a sheet a figure could have been read off, and a
 * caller that asked about one is told the same nothing rather than a guess (L-MEA-01).
 */
export async function sheetTextsOf(scope: NotesSheetScope, layoutName: string): Promise<SheetText[]> {
  if (!isUuid(scope.projectId) || !isUuid(scope.drawingId)) return [];
  const record = await currentRecordOf(scope);
  if (record === null) return [];

  const graph = await artifactAt(scope.tenantId, record.artifactSha256, appStorage(), `ingest ${record.ingestId}`);
  return graph.entities
    .filter((entity) => entity.space === layoutName && TEXT_TYPES.includes(entity.type) && (entity.text ?? "").trim() !== "")
    .map((entity) => ({ sourceKey: entity.key, text: entity.text as string }));
}

/**
 * The ingest record that currently stands for this drawing — the newest, since a re-ingest supersedes
 * rather than replaces (R-TO-001) — and only where the drawing really is this project's.
 *
 * The rows are read here rather than through the ingest module's own `ingestRecordOf`, for the reason
 * `projectDrawingsOf` reads them here: the record's home is `src/modules/takeoff/ingest`, which core
 * may not name (ARCH-01). What a record IS stays that seam's; this only asks which one stands.
 */
async function currentRecordOf(scope: NotesSheetScope): Promise<{ ingestId: string; artifactSha256: string } | null> {
  const store = forTenant({ tenantId: scope.tenantId });
  const drawn = await store
    .select({ drawingId: drawings.drawingId })
    .from(drawings)
    .where(and(eq(drawings.tenantId, scope.tenantId), eq(drawings.projectId, scope.projectId), eq(drawings.drawingId, scope.drawingId)))
    .limit(1);
  if (drawn.length === 0) return null;

  const recorded = await store
    .select({ ingestId: ingests.ingestId, artifactSha256: ingests.artifactSha256 })
    .from(ingests)
    .where(and(eq(ingests.tenantId, scope.tenantId), eq(ingests.drawingId, scope.drawingId)))
    .orderBy(desc(ingests.createdAt))
    .limit(1);
  return recorded[0] ?? null;
}

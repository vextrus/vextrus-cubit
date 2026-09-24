// What the plans of the campaign's pinned manifest DRAW as a framed member and no mark names
// (s-coverage I-613): the stored partition's unnamed pairs (`placement_unnamed_pairs`), read over
// the record each manifest drawing was measured on, each said by the plan that draws it and the sheet
// that plan stands on.
//
// It says what the partition SAW and could not name — a drawn pair, never an absence — so it is no
// fourth sighting channel (L-QTY-05's three stand): a pair names no class the residue could cell it
// under, because the stage could not say whose width it is drawn at. It is L-QTY-04's known scope,
// not measured: enumerated on the measurement boundary as a declared exclusion, and never counted
// (L-QTY-07).
import { and, eq, inArray, placementUnnamedPairs, type TenantTx } from "../../db";
import { compareCanonical } from "../../identity";
import type { UnnamedPair } from "../law";
import { sheetOf, type SightingScope } from "./scope";

/**
 * Every pair the manifest's plans draw as a framed member and nobody names, over the record each
 * drawing was measured on, in canonical order of (sheet, caption, grid reference, edge line). A drawing
 * whose pinned record was not read contributes nothing: its pairs would be another record's.
 */
export async function unnamedPairsOf(tx: TenantTx, scope: SightingScope, captions: ReadonlyMap<string, string>): Promise<UnnamedPair[]> {
  const ingests = [...(scope.ingests ?? new Map<string, string>()).entries()].filter(([drawingId]) => scope.sheets.some((sheet) => sheet.drawingId === drawingId));
  if (ingests.length === 0) return [];
  const rows = await tx
    .select({
      drawingId: placementUnnamedPairs.drawingId,
      ingestId: placementUnnamedPairs.ingestId,
      viewKey: placementUnnamedPairs.viewKey,
      edgeKeyA: placementUnnamedPairs.edgeKeyA,
      edgeKeyB: placementUnnamedPairs.edgeKeyB,
      width: placementUnnamedPairs.width,
      gridLetter: placementUnnamedPairs.gridLetter,
      gridNumeral: placementUnnamedPairs.gridNumeral,
    })
    .from(placementUnnamedPairs)
    .where(
      and(
        eq(placementUnnamedPairs.tenantId, scope.tenantId),
        eq(placementUnnamedPairs.projectId, scope.projectId),
        inArray(
          placementUnnamedPairs.ingestId,
          ingests.map(([, ingestId]) => ingestId),
        ),
      ),
    );
  const measuredOn = new Map(ingests);
  return rows
    .filter((row) => measuredOn.get(row.drawingId) === row.ingestId)
    .map((row) => ({
      drawingId: row.drawingId,
      viewKey: row.viewKey,
      caption: captions.get(row.viewKey) ?? "",
      layoutName: sheetOf(scope, row.drawingId, row.viewKey),
      edgeKeys: [row.edgeKeyA, row.edgeKeyB] as const,
      width: row.width,
      gridLetter: row.gridLetter,
      gridNumeral: row.gridNumeral,
    }))
    .sort(
      (left, right) =>
        compareCanonical(left.layoutName, right.layoutName) ||
        compareCanonical(left.caption, right.caption) ||
        compareCanonical(`${left.gridLetter ?? ""}${left.gridNumeral ?? ""}`, `${right.gridLetter ?? ""}${right.gridNumeral ?? ""}`) ||
        compareCanonical(left.edgeKeys[0], right.edgeKeys[0]),
    );
}

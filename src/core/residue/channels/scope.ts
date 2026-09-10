// What a channel reader is asked about: one campaign's pinned manifest, and nothing wider
// (L-QTY-05 — "within the campaign's pinned manifest"). The scope is shared by the three readers so
// the three answer over the very same sheets; a reader that resolved its own manifest would be a
// second answer to which drawings a campaign stands on (B-17).

/** One sheet of the pinned manifest: the drawing it is, and the layout a reader knows it by. */
export type ManifestSheet = {
  readonly drawingId: string;
  readonly layoutName: string;
};

/** The campaign a channel is read within. */
export type SightingScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly setRevisionId: string;
  readonly sheets: readonly ManifestSheet[];
};

/** The layout name of a sheet of this manifest, or an empty name where the manifest holds none. */
export function layoutOf(scope: SightingScope, drawingId: string): string {
  return scope.sheets.find((sheet) => sheet.drawingId === drawingId)?.layoutName ?? "";
}

/** The drawings of the manifest, as a query names them. */
export function drawingIdsOf(scope: SightingScope): string[] {
  return scope.sheets.map((sheet) => sheet.drawingId);
}

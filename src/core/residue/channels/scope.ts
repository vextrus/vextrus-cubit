// What a channel reader is asked about: one campaign's pinned manifest, and nothing wider
// (L-QTY-05 — "within the campaign's pinned manifest"). The scope is shared by the three readers so
// the three answer over the very same sheets; a reader that resolved its own manifest would be a
// second answer to which drawings a campaign stands on (B-17).
//
// And the sheet each sighting stands on. The manifest names DRAWINGS — a file and the bytes the pin
// recorded — and one drawing holds many sheets: F-RCC6-BNBC's one file carries S-00 to S-26, and its
// columns stand on S-10 while its piles stand on S-04. So a sighting's sheet is read per KEY, never
// per drawing: by the key grammar (`../../identity`) and core's one sheet resolver
// (`../../sheets/frames`), over the record the campaign's pinned revision measured
// (`../../sheets/pinned`) — the very reading the Trace opens a line's sheet by (s-coverage I-548).
import type { TenantTx } from "../../db";
import { viewKey, viewRefOf } from "../../identity";
import { traceCitations, type RecordStanding } from "../../sheets/frames";
import { pinnedRecordsIn } from "../../sheets/pinned";
import type { Storage } from "../../storage";

/** One drawing of the pinned manifest, and the name the pin recorded it under. */
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
  /**
   * Where the keys of each manifest drawing stand, by drawing: the record the pin measured it on. A
   * drawing whose pinned bytes nobody read holds no entry, and what was sighted on it names no sheet.
   */
  readonly records: ReadonlyMap<string, RecordStanding>;
  /**
   * The record each manifest drawing was measured on, by drawing: the ingest the pin's bytes were
   * read into. A reader of what ONE record stored (I-613) reads that record and no other of the
   * drawing. Absent, or without a drawing's entry, that drawing's record was not read.
   */
  readonly ingests?: ReadonlyMap<string, string>;
};

/** The drawings of the manifest, as a query names them. */
export function drawingIdsOf(scope: SightingScope): string[] {
  return scope.sheets.map((sheet) => sheet.drawingId);
}

/**
 * The scope one campaign's channels are read in: its manifest, and the record each of the manifest's
 * drawings was measured on. Read once per residue, in the transaction the residue is read in, so the
 * channels place their sightings over one reading of each record.
 */
export async function sightingScopeIn(
  tx: TenantTx,
  campaign: { readonly tenantId: string; readonly projectId: string; readonly setRevisionId: string; readonly sheets: readonly ManifestSheet[] },
  storage: Storage,
): Promise<SightingScope> {
  const pinned = await pinnedRecordsIn(tx, campaign.tenantId, campaign.setRevisionId, campaign.sheets.map((sheet) => sheet.drawingId), storage);
  const records = new Map([...pinned].map(([drawingId, record]) => [drawingId, record.standing] as const));
  const ingests = new Map([...pinned].map(([drawingId, record]) => [drawingId, record.ingestId] as const));
  return { ...campaign, records, ingests };
}

/**
 * The layout one sighted key of one manifest drawing stands on — or an empty name where the drawing's
 * pinned record could not be read or the key stands on no sheet of it, which places the sighting on
 * no sheet rather than on a guessed one.
 *
 * The key is read by the grammar that minted it (L-REG-04): a view key names the view the class was
 * seen in, a placement key the member, a source key the entity itself. A key that opens with a view
 * is asked about together with that view, exactly as a line is traced (I-421): a member stands on its
 * view's sheet where that sheet shows it — a column on the layout plan that placed it, S-10, however
 * many other sheets frame the same model region — else on the sheet its own outline stands on; a
 * view stands where its caption does.
 */
export function sheetOf(scope: SightingScope, drawingId: string, key: string): string {
  const record = scope.records.get(drawingId);
  if (record === undefined || key.length === 0) return "";
  const view = viewRefOf(key);
  const traced = traceCitations({ viewKey: view === null ? "" : viewKey(view), sources: [key] }, record);
  return traced.sheets[key] ?? "";
}

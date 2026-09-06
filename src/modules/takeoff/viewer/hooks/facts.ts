/**
 * What each source key of a sheet is, gathered as the layers arrive: the record's type, the layer
 * holding it, and the world box of everything painted under that key.
 *
 * It is the one home for that reading (B-17): a hover, a selection row, a reveal and the partial
 * cell all ask it, while the index in the worker answers *which* keys are under a point and this
 * answers what they are. A key that paints many pieces is one atom spanning all of them (I-86).
 */
import { unionBox } from "../../viewer-inspector/selection";
import { recordBox, recordKey, type IndexBox } from "../client";
import type { RenderLayer, RenderRecord } from "../types";

/** One source key of the sheet, as everything that reads a selection needs it. */
export type EntityFact = {
  type: string;
  layer: string;
  box: IndexBox;
  records: RenderRecord[];
};

/**
 * Every key the sheet has met so far. A plain map on purpose: what reads it needs `has` and `get`
 * and nothing else, so a sheet's facts and a stand-in for them are the same kind of thing.
 */
export type SheetFacts = Map<string, EntityFact>;

export function createSheetFacts(): SheetFacts {
  return new Map();
}

/**
 * What one arrived layer's records are, filed by the key each is selected under. A key that paints
 * more than one record keeps the first record's type and layer and spans every piece's box, because
 * that is the one thing a reader selected (I-86).
 */
export function learn(facts: SheetFacts, layer: RenderLayer): void {
  for (const record of layer.records) {
    const key = recordKey(record);
    const box = recordBox(record);
    if (key === undefined || box === null) continue;
    const held = facts.get(key);
    if (held === undefined) {
      facts.set(key, { type: record.type, layer: layer.name, box, records: [record] });
      continue;
    }
    held.records.push(record);
    held.box = unionBox([held.box, box]) ?? held.box;
  }
}

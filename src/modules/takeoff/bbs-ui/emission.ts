// The bill of bars as the `bbs` document kind takes it (A-BBS-PDF, SEAM-DOC).
//
// ONE DERIVATION, TWO FACES. The screen and the PDF are drawn from the same `BbsDocument`, so what a
// reader reads and what the document prints cannot differ: this file renames the door's answer into
// the kind's payload and adds nothing — no figure is rounded here, no total is re-summed, and the
// cutting stock crosses exactly as it was packed (I-bbs-2, B-17).
//
// The payload is a STATEMENT: the kind's schema is strict, so a field this file invented would be
// refused at the seam rather than printed (L-FMT-03).
import type { BbsPayload } from "@/core/documents/kinds/bbs";
import type { BbsDocument } from "@/modules/takeoff/rebar";
import { BBS_PLACES, statedAt } from "./present";

/** What the document says about itself, beside the schedule it prints. */
export type BbsPayloadMeta = {
  readonly title: string;
  /** What the schedule is a schedule OF, as a reader names it — the project's name, never its id. */
  readonly project: string;
  readonly setRevisionId: string;
};

/** The campaign's bill of bars, as the `bbs` kind is rendered from it (test contract). */
export function bbsPayloadOf(document_: BbsDocument, meta: BbsPayloadMeta): BbsPayload {
  /* Each figure at the fraction length the document STATES that kind of figure at. The store keeps
     whatever fraction the arithmetic that made a figure left behind — a mass out of a division
     chain, a length out of a ceil — and the kind's schema reads a figure at its stated precision and
     no other, so a bill crossing to the document unwritten would be refused whole for every campaign
     but a hand-composed one. Writing the fraction out is done on the TEXT, by the one seam that does
     it (`statedAt`): nothing here is summed, re-rounded or re-derived (I-bbs-2, B-07, L-FMT-02). */
  const length = (value: string): string => statedAt(value, BBS_PLACES.length);
  const rounded = (value: string): string => statedAt(value, BBS_PLACES.rounded);
  const mass = (value: string): string => statedAt(value, BBS_PLACES.mass);
  const count = (value: string): string => statedAt(value, BBS_PLACES.count);
  return {
    title: meta.title,
    project: meta.project,
    campaignId: document_.campaignId,
    setRevisionId: meta.setRevisionId,
    stockMm: count(document_.stockMm),
    roundingMm: document_.roundingMm,
    rows: document_.rows.map((row) => ({
      objectKey: row.objectKey,
      class: row.class,
      level: row.level,
      mark: row.mark,
      barMark: row.barMark,
      role: row.role,
      diameterMm: row.diameterMm,
      shape: row.shape,
      dimsMm: Object.fromEntries(Object.entries(row.dimsMm).map(([letter, value]) => [letter, length(value)])),
      cuttingRawMm: length(row.cuttingRawMm),
      cuttingRoundedMm: rounded(row.cuttingRoundedMm),
      cuttingIsAdditiveMm: length(row.cuttingIsAdditiveMm),
      piecesPerBar: row.piecesPerBar,
      lapMm: rounded(row.lapMm),
      lapsPerBar: row.lapsPerBar,
      barsPerUnit: row.barsPerUnit,
      parentCount: count(row.parentCount),
      bars: count(row.bars),
      // The rate the row was billed at, as the store holds it: the kg/m table's figure, crossing
      // verbatim so the document states the basis of its own masses (AM-03(b)).
      kgPerMetre: mass(row.kgPerMetre),
      kgNet: mass(row.kgNet),
      kgLap: mass(row.kgLap),
      kg: mass(row.kg),
    })),
    perDiameterKg: Object.fromEntries(Object.entries(document_.perDiameterKg).map(([diameter, kg]) => [diameter, mass(kg)])),
    // The packing's own answer, less the method it recorded: the kind prints what a site cuts, and
    // how the packing was reached is the method's disclosure, not the document's (AM-03(e)).
    cuttingStock: Object.fromEntries(
      Object.entries(document_.cuttingStock).map(([diameter, packed]) => [
        diameter,
        { stockBars: packed.stockBars, pieces: packed.pieces, offcutMm: rounded(packed.offcutMm) },
      ]),
    ),
    grandTotalKg: mass(document_.grandTotalKg),
  };
}

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

/** What the document says about itself, beside the schedule it prints. */
export type BbsPayloadMeta = {
  readonly title: string;
  /** What the schedule is a schedule OF, as a reader names it — the project's name, never its id. */
  readonly project: string;
  readonly setRevisionId: string;
};

/** The campaign's bill of bars, as the `bbs` kind is rendered from it (test contract). */
export function bbsPayloadOf(document_: BbsDocument, meta: BbsPayloadMeta): BbsPayload {
  return {
    title: meta.title,
    project: meta.project,
    campaignId: document_.campaignId,
    setRevisionId: meta.setRevisionId,
    stockMm: document_.stockMm,
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
      dimsMm: { ...row.dimsMm },
      cuttingRawMm: row.cuttingRawMm,
      cuttingRoundedMm: row.cuttingRoundedMm,
      cuttingIsAdditiveMm: row.cuttingIsAdditiveMm,
      piecesPerBar: row.piecesPerBar,
      lapMm: row.lapMm,
      lapsPerBar: row.lapsPerBar,
      barsPerUnit: row.barsPerUnit,
      parentCount: row.parentCount,
      bars: row.bars,
      // The rate the row was billed at, as the store holds it: the kg/m table's figure, crossing
      // verbatim so the document states the basis of its own masses (AM-03(b)).
      kgPerMetre: row.kgPerMetre,
      kgNet: row.kgNet,
      kgLap: row.kgLap,
      kg: row.kg,
    })),
    perDiameterKg: { ...document_.perDiameterKg },
    // The packing's own answer, less the method it recorded: the kind prints what a site cuts, and
    // how the packing was reached is the method's disclosure, not the document's (AM-03(e)).
    cuttingStock: Object.fromEntries(
      Object.entries(document_.cuttingStock).map(([diameter, packed]) => [
        diameter,
        { stockBars: packed.stockBars, pieces: packed.pieces, offcutMm: packed.offcutMm },
      ]),
    ),
    grandTotalKg: document_.grandTotalKg,
  };
}

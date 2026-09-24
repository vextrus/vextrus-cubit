// The bill of bars as the `bbs` kind takes it (A-BBS-PDF, SEAM-DOC; s-bbs I-534, I-535, I-536).
//
// ONE DERIVATION, TWO FACES. The screen and the PDF are drawn from the same `BbsDocument`, so what a
// reader reads and what the document prints cannot differ: this file renames the door's answer into
// the kind's payload and adds nothing — no figure is rounded here, no total is re-summed, no member is
// re-counted, and the cutting stock crosses exactly as it was packed (I-bbs-2, B-17).
//
// The door's lines arrive already stated once per floor (I-534); the payload gathers them under the
// entry each belongs to, in the order the door named them, and carries the entry's member count as
// the door counted it. What the partly declared lines left out crosses in the screen's own words —
// the components as the copy table says them, the reason as the refusal register says it (I-536).
//
// What is NOT a cutting document says so (I-567, I-569): the entries whose laps the
// lines declared missing are marked as storey-height runs and the diameters they touch cross with no
// cutting stock — the SAME reading the screen draws (`cuttingStandingOf`); the total crosses with what
// it covers in words (`totalCoversOf`); and the steel no line was published for crosses in the draft
// BOQ's closing words, as the reading composed them.
//
// The payload is a STATEMENT: the kind's schema is strict, so a field this file invented would be
// refused at the seam rather than printed (L-FMT-03). It carries no campaign id, revision uuid or
// register key: the page is written in words (R-UI-082, I-535), and the issue's ids are the
// documents store's record.
import type { BbsPayload } from "@/core/documents/kinds/bbs";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import type { BbsDocument } from "@/modules/takeoff/rebar";
import { BBS_COMPONENT_SAID } from "./copy";
import { BBS_PLACES, cuttingStandingOf, metresOf, statedAt, totalCoversOf } from "./present";
import type { BbsNotInSchedule, BbsOmission } from "./view";

/** A day as the document states one: wall-clock parts in the document's zone (L-FMT-01). */
export type BbsDay = { readonly year: number; readonly month: number; readonly day: number };

/** What the schedule is ABOUT, as the project and its pinned drawings record it (I-535). */
export type BbsParticulars = {
  readonly code: string | null;
  readonly client: string | null;
  readonly site: string | null;
  /** The drawing set's own name. */
  readonly drawingSet: string;
  /** Which pin of the set the measurement read, counted from the set's first. */
  readonly revision: number;
  readonly pinnedOn: BbsDay;
  readonly issuedOn: BbsDay;
};

/** What the document says about itself, beside the schedule it prints. */
export type BbsPayloadMeta = {
  readonly title: string;
  /** What the schedule is a schedule OF, as a reader names it — the project's name, never its id. */
  readonly project: string;
  readonly particulars: BbsParticulars;
  /** Whether any rebar line under the schedule stands partly declared (L-QTY-02, Decision §2). */
  readonly partial: boolean;
  /** What those lines left out, each code once with its components, as `bbsViewOf` read them. */
  readonly omitted: readonly BbsOmission[];
  /** The members whose lines left a length term out — their running bars are not for cutting (I-567). */
  readonly deferred?: readonly string[];
  /** The steel no line was published for, as `bbsViewOf` said it in the draft's words (I-569). */
  readonly notInSchedule?: readonly BbsNotInSchedule[];
};

/** The registry's entry for a code, or nothing where the registry holds none. */
function registered(code: string): RefusalEntry | undefined {
  return Object.hasOwn(REFUSALS, code) ? (REFUSALS as Readonly<Record<string, RefusalEntry>>)[code] : undefined;
}

/**
 * What the schedule leaves out, in the screen's words: each code's components as the copy table says
 * them and the registry's own message for why — the screen's `Left out of this schedule` list, one
 * face over (I-354, I-536). A code the registry does not hold is left off exactly as the screen
 * leaves it off: a sentence invented for it here would be a reason nobody registered (R-SPINE-062).
 */
function leftOutOf(omitted: readonly BbsOmission[]): BbsPayload["leftOut"] {
  return omitted.flatMap((omission) => {
    const entry = registered(omission.code);
    if (entry === undefined) return [];
    return [{ components: omission.components.map((component) => BBS_COMPONENT_SAID[component] ?? component), reason: entry.message }];
  });
}

/**
 * The bars the door DECLARED rather than scheduled — bent to a shape the roster does not hold — in
 * the door's own order, with the registry's own sentence for why and the mass the door kept out of
 * its totals (I-596). Nothing is summed here: the excluded mass is the door's `declaredKg`.
 * None declared is `null`, and the page then says nothing of it.
 */
function declaredOf(document_: BbsDocument, stated: { length(value: string): string; count(value: string): string; mass(value: string): string }): BbsPayload["declared"] {
  if (document_.declared.length === 0) return null;
  const entry = registered("BAR_SHAPE_NOT_HELD");
  if (entry === undefined) throw new Error("BAR_SHAPE_NOT_HELD is not registered, so a declared bar has no reason to be printed with");
  return {
    reason: entry.message,
    kg: stated.mass(document_.declaredKg),
    bars: document_.declared.map((line) => ({
      level: line.level,
      class: line.class,
      mark: line.mark,
      members: line.members.length,
      barMark: line.barMark,
      role: line.role,
      diameterMm: line.diameterMm,
      shape: line.shape,
      cuttingRawMm: stated.length(line.cuttingRawMm),
      bars: stated.count(line.bars),
      kg: stated.mass(line.kg),
    })),
  };
}

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

  // The door's lines under the entry each belongs to — its first member names it — in the order the
  // door first names each entry, and the lines of an entry in the door's own order (L-REG-04).
  const standing = cuttingStandingOf(document_, meta.deferred ?? []);
  const notInSchedule = meta.notInSchedule ?? [];
  const order: string[] = [];
  const byEntry = new Map<string, BbsDocument["rows"][number][]>();
  for (const line of document_.rows) {
    const held = byEntry.get(line.objectKey);
    if (held === undefined) {
      order.push(line.objectKey);
      byEntry.set(line.objectKey, [line]);
    } else held.push(line);
  }
  const schedule = order.flatMap((key) => {
    const lines = byEntry.get(key) ?? [];
    const first = lines[0];
    if (first === undefined) return [];
    return [
      {
        level: first.level,
        class: first.class,
        mark: first.mark,
        members: first.members.length,
        notForCutting: standing.runs.has(key),
        bars: lines.map((line) => ({
          barMark: line.barMark,
          role: line.role,
          diameterMm: line.diameterMm,
          shape: line.shape,
          dimsMm: Object.fromEntries(Object.entries(line.dimsMm).map(([letter, value]) => [letter, length(value)])),
          cuttingRawMm: length(line.cuttingRawMm),
          cuttingRoundedMm: rounded(line.cuttingRoundedMm),
          cuttingIsAdditiveMm: length(line.cuttingIsAdditiveMm),
          piecesPerBar: line.piecesPerBar,
          lapMm: rounded(line.lapMm),
          lapsPerBar: line.lapsPerBar,
          barsPerUnit: line.barsPerUnit,
          bars: count(line.bars),
          // The rate the line was billed at, as the store holds it: the kg/m table's figure, crossing
          // verbatim so the document states the basis of its own masses (AM-03(b)).
          kgPerMetre: mass(line.kgPerMetre),
          kgNet: mass(line.kgNet),
          kgLap: mass(line.kgLap),
          kg: mass(line.kg),
        })),
      },
    ];
  });

  return {
    title: meta.title,
    project: meta.project,
    particulars: {
      code: meta.particulars.code,
      client: meta.particulars.client,
      site: meta.particulars.site,
      drawingSet: meta.particulars.drawingSet,
      revision: meta.particulars.revision,
      pinnedOn: { ...meta.particulars.pinnedOn },
      issuedOn: { ...meta.particulars.issuedOn },
    },
    stockMm: count(document_.stockMm),
    roundingMm: document_.roundingMm,
    schedule,
    perDiameterKg: Object.fromEntries(Object.entries(document_.perDiameterKg).map(([diameter, kg]) => [diameter, mass(kg)])),
    // The packing's own answer, less the method it recorded: the kind prints what a site cuts, and
    // how the packing was reached is the method's disclosure, not the document's (AM-03(e)).
    // A diameter whose bars include a run nobody can cut crosses with NO packing at all — named in
    // `stockWithheld` instead — so the document cannot print it (I-567). The offcut crosses
    // in metres, the canon's own conversion of the door's millimetres (I-568).
    cuttingStock: Object.fromEntries(
      Object.entries(document_.cuttingStock)
        .filter(([diameter]) => !standing.withheld.includes(Number(diameter)))
        .map(([diameter, packed]) => [diameter, { stockBars: packed.stockBars, pieces: packed.pieces, offcutM: metresOf(packed.offcutMm) }]),
    ),
    stockWithheld: [...standing.withheld],
    grandTotalKg: mass(document_.grandTotalKg),
    totalCovers: totalCoversOf(document_, { partial: meta.partial, omitted: meta.omitted, notInSchedule: notInSchedule.length }),
    declared: declaredOf(document_, { length, count, mass }),
    partial: meta.partial,
    leftOut: meta.partial ? leftOutOf(meta.omitted) : [],
    notInSchedule: notInSchedule.map((one) => ({ about: one.about, levels: one.levels, why: one.why })),
  };
}

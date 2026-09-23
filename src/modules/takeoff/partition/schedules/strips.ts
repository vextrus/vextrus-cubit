// R-TO-031's member types where a set states them on a LONG-SECTION sheet rather than in a schedule
// (Interpretation I-343).
//
// A floor-by-floor set details every beam as a strip — its elevation, its bars — and labels the strip
// with the beam's mark and, on the same baseline beside it, the beam's section: F-RCC6-BNBC's S-17
// writes `B1` and `300x600` 1500 apart over each of its fifty-three strips, and S-16 writes `1B1` and
// `300x600` over the first floor's. Those two texts ARE the member-type statement a schedule row makes
// — the mark, and the section it carries — and a drawing that makes it this way makes it no less. The
// sheet's own title states the floors the strips are drawn for: `TYPICAL FLOOR BEAM LONG SECTIONS (2ND
// TO 6TH FLOOR)`, `1ST FLOOR BEAM LONG SECTIONS - …`. So each label is a family, and its one variant
// is banded by the sheet.
//
// What a strip label is, read by content and never by a layer or a view's name (L-CAD-07): a text
// whose whole content is a mark of a FRAMED class (`../placement/law`), and — standing on its baseline,
// the nearest text to its right — a text whose whole content is a section. Nothing else is read here:
// the bars under a strip are the rebar reader's (L-FRM-05), and the `SPAN (mm)` a roof schedule prints
// is a centre-to-centre figure of that schedule's, never a strip's and never a clear (L-MEA-09).
//
// Only views that are neither a SCHEDULE — whose tables `./reconstruct` reads — nor a layout plan,
// whose texts are marks and notes about the members it PLACES (`../placement`), are read. Neither
// fixture carries a strip label anywhere else, and F-RCC6 carries none at all.
//
// Pure over the artifact and the stages before it: no store, no clock, no model (L-REG-04).
import { REFUSALS } from "@/core/errors";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { ConventionProfile } from "@/core/rulesets/methods/conventions/resolve";
import { normaliseMark, parseSizePair, sameStorey, type FloorBand, type SizePair } from "../notation";
import { classOfMark, isFramedClass, levelWordsOf } from "../placement/law";
import type { PartitionedView } from "../views/assign";
import { VIEW_TYPE, yieldsInstances } from "../views/law";
import type { ScheduleDeferralRow, ScheduleEvidence } from "./reconstruct";
import { unitOf, variantKeyOf, type MemberFamily, type MemberVariant } from "./registry";

/** One text of a view as this reading sees one: what it says, and where it was drawn. */
type Placed = { readonly key: string; readonly text: string; readonly x: number; readonly y: number; readonly height: number };

/** One strip's label: the mark, the section written beside it, and what that section reads as. */
type Label = { readonly mark: Placed; readonly size: Placed; readonly section: SizePair };

/** The floors a strip sheet states its strips are drawn for, and the texts that state it. */
type SheetBand = { readonly band: FloorBand; readonly text: string; readonly sourceKeys: readonly string[] };

/** The key an unbanded strip's one variant stands under — the registry's own fallback key. */
const UNBANDED_KEY = "SECTION";

/** What the strip sheets of one artifact named: the families, and the sheets that named none. */
export type StripSections = {
  readonly families: MemberFamily[];
  readonly deferrals: ScheduleDeferralRow[];
};

/**
 * The member types one artifact's long-section sheets state (I-343): one family per strip label, in
 * the order the sheet is read — top down, then left to right — with one variant carrying the section
 * the label states, in the unit the label, else the drawing's declaration, states it in (I-302), over
 * the floors the sheet's own title states.
 *
 * A sheet whose texts state two DIFFERENT bands of floors has not said which its strips are drawn
 * for: it contributes nothing and says so (SCHEDULE_VIEW_CONTRIBUTED_NOTHING), because a band chosen
 * between two statements would put a section on floors it was never drawn for (L-QTY-01). A sheet
 * that states none stands unbanded, as a schedule with no band column does.
 */
export function readSectionStrips(evidence: ScheduleEvidence, conventions?: ConventionProfile | null): StripSections {
  const declared = conventions?.dimensionUnit ?? null;
  const families: MemberFamily[] = [];
  const deferrals: ScheduleDeferralRow[] = [];

  for (const view of evidence.views) {
    if (view.anchorKey === null || view.type === VIEW_TYPE.SCHEDULE || yieldsInstances(view.type)) continue;
    const texts = textsOf(evidence.graph, evidence.assignments, view);
    const labels = labelsIn(texts);
    if (labels.length === 0) continue;

    const band = sheetBandOf(view, texts, labels);
    if (band === "contested") {
      deferrals.push({ viewKey: view.viewKey, reason: REFUSALS.SCHEDULE_VIEW_CONTRIBUTED_NOTHING.code });
      continue;
    }

    const minted = new Set<string>();
    for (const [index, label] of labels.entries()) {
      const family = normaliseMark(label.mark.text);
      // One label per family: a mark labelled twice on one sheet is one member type, read from the
      // first strip that labels it (riskNotes (3)) — T-SCHED-CONTD's `CONTD. ON S-18` beside `B9` is a
      // note, and B9 is counted once.
      if (minted.has(family)) continue;
      minted.add(family);
      families.push({
        scheduleKey: view.anchorKey,
        family,
        markText: label.mark.text,
        rowIndex: index + 1,
        sourceKeys: [label.mark.key],
        variants: [variantOf(label, band, declared)],
      });
    }
  }

  return { families, deferrals };
}

/** The one variant a strip label states: its section, over the sheet's band, cited to what said each. */
function variantOf(label: Label, band: SheetBand | null, declared: ConventionProfile["dimensionUnit"] | null): MemberVariant {
  // The label writes its section alone, under no column head: its own unit where it wrote one, else
  // the one the drawing declares — the registry's one reading of the three statements (I-302).
  const measured = unitOf(label.section, "", declared ?? null);
  return {
    variantKey: band === null ? UNBANDED_KEY : variantKeyOf(band.band),
    bandText: band === null ? "" : band.text,
    bandFrom: band === null ? null : band.band.from,
    bandTo: band === null ? null : band.band.to,
    sectionText: label.size.text,
    sectionWidth: label.section.width,
    sectionDepth: label.section.depth,
    sectionUnit: measured.unit,
    sourceKeys: [label.size.key, ...(band?.sourceKeys ?? []), ...measured.cited],
    zones: [],
  };
}

/** The texts one view holds, in the artifact's own order. */
function textsOf(graph: EntityGraph, assignments: ReadonlyMap<string, string>, view: PartitionedView): Placed[] {
  return graph.entities.flatMap((entity) => {
    const at = (entity.points ?? [])[0];
    if (assignments.get(entity.key) !== view.viewKey || entity.text === undefined || entity.text === "" || at === undefined) return [];
    return [{ key: entity.key, text: entity.text, x: at[0] ?? 0, y: at[1] ?? 0, height: entity.height ?? 0 }];
  });
}

/**
 * The strip labels of one view, in reading order: each framed mark with the nearest text to its right
 * standing on its baseline — within half the mark's own height of it, a share of the text and never a
 * distance spelled in drawing units (L-MEA-01) — where that text is a section and nothing else.
 */
function labelsIn(texts: readonly Placed[]): Label[] {
  const labels: Label[] = [];
  for (const mark of texts) {
    if (!isFramedClass(classOfMark(mark.text))) continue;
    let size: Placed | undefined;
    for (const other of texts) {
      if (other.key === mark.key || other.x <= mark.x || Math.abs(other.y - mark.y) > mark.height / 2) continue;
      // Ties go to the lower source key, so one drawing labels one way every time (L-REG-04).
      if (size === undefined || other.x < size.x || (other.x === size.x && other.key < size.key)) size = other;
    }
    const section = size === undefined ? null : parseSizePair(size.text);
    if (size !== undefined && section !== null) labels.push({ mark, size, section });
  }
  return inReadingOrder(labels);
}

/**
 * The labels as a person reads the sheet: row by row down it, left to right along each row. A row is
 * the labels standing within one label's height of the first label of it — S-17 writes `B19` 150 below
 * `B20`…`B24` on the same row of strips, and reading by the exact y would put it after them.
 */
function inReadingOrder(labels: readonly Label[]): Label[] {
  const downward = [...labels].sort((left, right) => right.mark.y - left.mark.y || left.mark.x - right.mark.x || (left.mark.key < right.mark.key ? -1 : 1));
  const rows: Label[][] = [];
  for (const label of downward) {
    const row = rows[rows.length - 1];
    const first = row?.[0];
    if (row !== undefined && first !== undefined && first.mark.y - label.mark.y <= first.mark.height) row.push(label);
    else rows.push([label]);
  }
  return rows.flatMap((row) => row.sort((left, right) => left.mark.x - right.mark.x || (left.mark.key < right.mark.key ? -1 : 1)));
}

/**
 * The floors one strip sheet states its strips are drawn for (I-343): read off every text of the view
 * that names a level — its title, `… (2ND TO 6TH FLOOR)` — and off the view's caption where that names
 * one too, each read from the first level it names to the last. They must agree, as one storey agrees
 * with another (`sameStorey`: `1ST` is `1F`); a sheet naming none is unbanded, and one naming two
 * different bands is contested.
 *
 * The labels themselves are not asked: `1B12` is the first floor's beam, and what it names is a member
 * and not the floors of the sheet.
 */
function sheetBandOf(view: PartitionedView, texts: readonly Placed[], labels: readonly Label[]): SheetBand | null | "contested" {
  const labelled = new Set(labels.flatMap((label) => [label.mark.key, label.size.key]));
  const stated = texts.flatMap((text) => {
    if (labelled.has(text.key)) return [];
    const band = bandOf(text.text);
    return band === null ? [] : [{ band, text: text.text, key: text.key }];
  });
  const captioned = bandOf(view.caption);
  const all = [...stated.map((one) => one.band), ...(captioned === null ? [] : [captioned])];
  const first = all[0];
  if (first === undefined) return null;
  if (!all.every((band) => sameStorey(band.from, first.from) && sameStorey(band.to, first.to))) return "contested";
  const said = stated[0];
  // The title a sheet states its band in is what the band is read at; the caption answers only where no
  // text of the sheet itself did, and is cited by the view's own anchor (L-CAD-03).
  return said === undefined
    ? { band: first, text: view.caption, sourceKeys: view.anchorKey === null ? [] : [view.anchorKey] }
    : { band: first, text: said.text, sourceKeys: stated.map((one) => one.key) };
}

/** The band one text names: from the first level it names to the last, or null where it names none. */
function bandOf(text: string): FloorBand | null {
  const levels = levelWordsOf(text);
  const from = levels[0];
  const to = levels[levels.length - 1];
  return from === undefined || to === undefined ? null : { from, to };
}

// The `bbs` document kind: a campaign's bill of bars, each mark stated once per floor with its number
// of members, with the shape each bar is bent to drawn beside it (R-TO-054, A-BBS-PDF, AM-01, AM-03,
// AM-05, SEAM-DOC; s-bbs I-534, I-535, I-536).
//
// IT IS A DRAFT AND SAYS SO ON EVERY PAGE. Before M7 nothing here is signed, so the frame prints
// `DRAFT — UNSIGNED` on every leaf, and the document names no surveyor, states no credential and
// carries no certificate (AM-05). The sign-off box at its foot is ruled paper the site completes by
// hand: this kind fills none of it (I-535).
//
// IT IS WRITTEN IN WORDS (R-UI-082, I-535). A reader meets the project, the client, the drawings and
// the day, a mark, a class and a floor — never a campaign id, a revision uuid, a register key or an
// enum word. The payload carries the data; `present()` says it: a class and a role through the same
// one rule the draft's page says a key by (`inWords`), a count through `figure()`, a day through the
// format seam's own `formatDate`. The ids a reader might want to trace are the documents store's
// record of the issue, never the page's text.
//
// THREE LENGTHS, ONE OF THEM ROUNDED (AM-01, L-FRM-05). The raw BS 8666 length prints as it was
// stored, to its full stated precision; the rounded figure is the ONE rounded surface; the
// IS-additive figure stands beside them both and is billed by nothing. This kind rounds none of
// them: every figure of the payload is READ at the precision stated below — the schema offers it to
// `figure()`, which refuses a value that is not already at that precision — so a schedule whose
// figures drifted is a malformed payload, refused whole before a subprocess is reached rather than
// rounded into agreement or failed halfway through a render (SEAM-DOC, L-FMT-02).
//
// A MARK ONCE PER FLOOR (the owner's ruling Q3, BS 8666, I-534). The schedule is a list of ENTRIES —
// one mark on one floor and the number of its members — each over the bars one member takes, stated
// with the number in each and the total. The door counted the members; this kind prints the count.
//
// A LAP IS ITS OWN LINE (AM-03(a), L-BD-02). A bar that laps prints a `Lap` line beneath its own
// carrying the lap's own mass — never a percentage, and never a column of the bar's row: net-of-laps
// and gross-of-laps are both readable because they are two lines.
//
// THE CUTTING STOCK IS INFORMATIONAL (AM-03(e)). What a site cuts from a stock bar is stated per
// diameter beneath the schedule and is billed by nothing. And WHAT IS LEFT OUT IS SAID (L-QTY-02,
// I-536): a schedule over partly declared lines closes with what it leaves out, in the screen's own
// words, and its total says it is the measured scope only.
import { z } from "zod";
import { formatDate } from "../../format";
import { refusalCodeOf } from "../../faults/refusal-marker";
import { SHAPE_CODES } from "../../rulesets/methods/rebar/bs8666";
import { figure } from "../figures";
import { inWords } from "./boq-draft-law";
import { kindTemplate, type DocumentKind } from "./law";

/** The key this kind is asked for by, and the key the barrel files it under. */
export const BBS = "bbs";

/** What the document calls itself (A-BBS-PDF). */
export const BBS_TITLE = "Bar bending schedule";

/**
 * The precisions this kind states, once (L-FMT-02). A length is stated to the thousandth of a
 * millimetre because BS 8666's raw length is; the ONE rounded surface is a whole millimetre; a mass
 * is a kilogramme to the gramme; and a count of bars, pieces, members or laps is a whole number.
 */
const LENGTH_PLACES = 3;
const ROUNDED_PLACES = 0;
const MASS_PLACES = 3;
const COUNT_PLACES = 0;

/** What a line of the schedule is: the bar itself, or the lap beside it (AM-03(a)). */
const NET = "NET";
const LAP = "LAP";

/* ------------------------------------------------------------------ the payload, parsed once */

/**
 * A figure this kind states at exactly `places` fraction digits, judged AT THE SCHEMA.
 *
 * The precision is not a second grammar written here: the value is offered to `figure()`, the one
 * seam that groups a figure and counts the fraction it was handed, and a figure that seam will not
 * take is a payload this kind cannot read. Judging it here rather than in `present()` is what makes
 * a schedule whose figures drifted a MALFORMED PAYLOAD — refused whole, by name, before a directory
 * is staged or a subprocess reached — instead of a render that fails halfway through a document
 * (SEAM-DOC, L-FMT-02). Anything that is not that seam's refusal is nothing this predicate may
 * swallow, so it is raised on (ARCH-03).
 */
function decimal(places: number) {
  return z
    .string()
    .min(1)
    .refine(
      (value) => {
        try {
          figure(value, places);
          return true;
        } catch (cause) {
          if (refusalCodeOf(cause) === null) throw cause;
          return false;
        }
      },
      { message: `this kind states the figure as an ungrouped decimal at ${String(places)} fraction digits (L-FMT-02)` },
    );
}

/**
 * A day, as wall-clock parts in the document's zone (L-FMT-01). The page writes it through the format
 * seam's `formatDate`, which refuses a day that is not a day, so a payload never carries a date
 * already written in somebody's own spelling.
 */
const day = z.object({ year: z.number().int(), month: z.number().int(), day: z.number().int() }).strict();

/** One bar of an entry, as ONE member takes it and as the entry's members take it together. */
const barLine = z
  .object({
    barMark: z.string().min(1),
    role: z.string().min(1),
    diameterMm: z.number().int().positive(),
    /** A BS 8666 shape this tree details in — the roster is the product's, never a list here. */
    shape: z.enum(SHAPE_CODES as unknown as [string, ...string[]]),
    /** The legs the shape is dimensioned by, by the letter BS 8666 gives each. */
    dimsMm: z.record(z.string().min(1), decimal(LENGTH_PLACES)),
    cuttingRawMm: decimal(LENGTH_PLACES),
    cuttingRoundedMm: decimal(ROUNDED_PLACES),
    cuttingIsAdditiveMm: decimal(LENGTH_PLACES),
    piecesPerBar: z.number().int().positive(),
    lapMm: decimal(ROUNDED_PLACES),
    lapsPerBar: z.number().int().nonnegative(),
    /** BS 8666's "No. in each": the bars ONE member takes. */
    barsPerUnit: z.number().int().positive(),
    /** BS 8666's "Total no.": the bars the entry's members take together, as the door counted them. */
    bars: decimal(COUNT_PLACES),
    /** The rate this bar was BILLED at — the kg/m table's own figure (AM-03(b), R-TO-054). */
    kgPerMetre: decimal(MASS_PLACES),
    kgNet: decimal(MASS_PLACES),
    kgLap: decimal(MASS_PLACES),
    kg: decimal(MASS_PLACES),
  })
  .strict();

/** One entry of the schedule: a mark on a floor, how many members of it, and the bars each takes. */
const entry = z
  .object({
    /** The level's own label, as a reader reads it, or nothing where the member stands on none. */
    level: z.string().nullable(),
    /** The member's class, as the catalogue keys it — said in words on the page (`inWords`). */
    class: z.string().min(1),
    mark: z.string().min(1),
    /** BS 8666's "No. of members": how many members of the mark on this floor the entry counts. */
    members: z.number().int().positive(),
    bars: z.array(barLine).min(1),
  })
  .strict();

/**
 * What the schedule is ABOUT, as the page states it in words (I-535): the client and the site as the
 * project records them (or nothing, which the page says), the drawing set and which of its pins the
 * measurement read, the day that pin was made, and the day this schedule was issued.
 */
const particulars = z
  .object({
    code: z.string().min(1).nullable(),
    client: z.string().min(1).nullable(),
    site: z.string().min(1).nullable(),
    drawingSet: z.string().min(1),
    /** Which pin of the set the measurement read, counted from the set's first (1 is the first). */
    revision: z.number().int().positive(),
    pinnedOn: day,
    issuedOn: day,
  })
  .strict();

/** One thing the partly declared lines leave out: the components in words, and why (I-536). */
const leftOut = z.object({ components: z.array(z.string().min(1)), reason: z.string().min(1) }).strict();

/** What one diameter's stock came to: the bars ordered, the pieces cut, and the offcut left. */
const cuttingStock = z
  .object({ stockBars: z.number().int().nonnegative(), pieces: z.number().int().nonnegative(), offcutMm: decimal(ROUNDED_PLACES) })
  .strict();

/** What the schedule is rendered from. Unknown keys are refused: a payload is a statement, not a bag. */
export const bbsPayloadSchema = z
  .object({
    title: z.string().min(1),
    /** The project's name, as a reader names it — never its id. */
    project: z.string().min(1),
    particulars,
    /** What the schedule was cut from, and the one surface it rounded to (AM-01). */
    stockMm: decimal(COUNT_PLACES),
    roundingMm: z.number().int().positive(),
    schedule: z.array(entry),
    /** The kg/m table's mass per diameter, and the campaign's own total — never a figure derived here. */
    perDiameterKg: z.record(z.string().min(1), decimal(MASS_PLACES)),
    cuttingStock: z.record(z.string().min(1), cuttingStock),
    grandTotalKg: decimal(MASS_PLACES),
    /** Whether any rebar line under the schedule stands partly declared (L-QTY-02). */
    partial: z.boolean(),
    leftOut: z.array(leftOut),
  })
  .strict();

/** The schedule's payload, as the schema reads it. */
export type BbsPayload = z.output<typeof bbsPayloadSchema>;

/** One entry of a payload, as the schema reads it. */
export type BbsPayloadEntry = z.output<typeof entry>;

/** One bar of an entry, as the schema reads it. */
export type BbsPayloadBar = z.output<typeof barLine>;

/* ------------------------------------------------------- the payload, as the template reads it */

/** What the page says where the project records nothing for a particular. */
const NOT_RECORDED = "Not recorded";

/** A count as the page writes it: a whole number, grouped by the one figure seam. */
const counted = (value: number): string => figure(String(value), COUNT_PLACES);

/** `1 member`, `8 members` — the entry's count, said as BS 8666's "No. of members" reads. */
function membersSaid(count: number): string {
  return count === 1 ? "1 member" : `${counted(count)} members`;
}

/** The legs a shape is dimensioned by, each as `A 1,850.000` — the letters in the payload's order. */
function dimensionsOf(bar: BbsPayloadBar): string[] {
  return Object.entries(bar.dimsMm).map(([letter, value]) => `${letter} ${figure(value, LENGTH_PLACES)}`);
}

/**
 * One bar's line, and — where the bar laps — the `Lap` line that belongs to it.
 *
 * The lap line states no cutting length of its own: a lap is not cut to a length, and repeating the
 * bar's there would print the one surface BS 8666 rounds twice (AM-01, AM-03(a)). Its dimensions say
 * how long a lap is and how many each bar carries; its mass is the lap's own over every bar the line
 * counts.
 */
function linesOf(bar: BbsPayloadBar): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [
    {
      component: NET,
      barMark: bar.barMark,
      role: inWords(bar.role),
      shape: bar.shape,
      diameter: counted(bar.diameterMm),
      dimensions: dimensionsOf(bar).join(",  "),
      cuttingRaw: figure(bar.cuttingRawMm, LENGTH_PLACES),
      cuttingRounded: figure(bar.cuttingRoundedMm, ROUNDED_PLACES),
      cuttingIs: figure(bar.cuttingIsAdditiveMm, LENGTH_PLACES),
      each: counted(bar.barsPerUnit),
      total: figure(bar.bars, COUNT_PLACES),
      // The bar's own mass, LAP EXCLUDED: a net mass that already held its lap would make the line
      // beneath it a double count (AM-03(a), L-BD-02).
      kg: figure(bar.kgNet, MASS_PLACES),
    },
  ];
  if (bar.lapsPerBar > 0) {
    lines.push({
      component: LAP,
      barMark: "",
      role: "",
      shape: "",
      diameter: counted(bar.diameterMm),
      dimensions: `${figure(bar.lapMm, ROUNDED_PLACES)} × ${counted(bar.lapsPerBar)} per bar`,
      cuttingRaw: "",
      cuttingRounded: "",
      cuttingIs: "",
      each: "",
      total: "",
      kg: figure(bar.kgLap, MASS_PLACES),
    });
  }
  return lines;
}

/**
 * The schedule's entries, in the order the payload names them (the door's reading order, L-REG-04):
 * each headed by its mark, its class and its floor in words — `C2 · Column · 1F` — with its number of
 * members beside, and never a register key (R-UI-082, I-535).
 */
function entriesOf(payload: BbsPayload): Record<string, unknown>[] {
  return payload.schedule.map((one) => ({
    heading: [one.mark, inWords(one.class), ...(one.level === null || one.level === "" ? [] : [one.level])].join(" · "),
    members: membersSaid(one.members),
    lines: one.bars.flatMap((bar) => linesOf(bar)),
  }));
}

/**
 * The cutting stock, one line per diameter in ascending numeric order — 8 before 10, which the keys'
 * own string order would not give. Informational, and billed by nothing (AM-03(e)).
 */
function stockOf(payload: BbsPayload): Record<string, unknown>[] {
  return Object.keys(payload.cuttingStock)
    .map((diameter) => Number(diameter))
    .sort((left, right) => left - right)
    .map((diameterMm) => {
      const packed = payload.cuttingStock[String(diameterMm)];
      const kg = payload.perDiameterKg[String(diameterMm)];
      return {
        diameter: counted(diameterMm),
        kg: kg === undefined ? "" : figure(kg, MASS_PLACES),
        stockBars: counted(packed?.stockBars ?? 0),
        pieces: counted(packed?.pieces ?? 0),
        offcut: figure(packed?.offcutMm ?? "0", ROUNDED_PLACES),
      };
    });
}

/**
 * The particulars block, in words: whose and where down the first column, read from what, when and
 * cut from what down the second (the block sets two pairs to a row, so the list alternates the two
 * columns). A particular the project does not record is said to be not recorded, never left blank as
 * if it were nothing and never filled with an id (I-535).
 */
function particularsOf(payload: BbsPayload): { label: string; value: string }[] {
  const about = payload.particulars;
  const project = about.code === null ? payload.project : `${payload.project} (${about.code})`;
  const revision = `${about.drawingSet}, revision ${counted(about.revision)}, pinned ${formatDate(about.pinnedOn)}`;
  const stock = `Stock bars of ${figure(payload.stockMm, COUNT_PLACES)} mm; each length rounded once, up to the next ${counted(payload.roundingMm)} mm`;
  return [
    { label: "Project", value: project },
    { label: "Drawings", value: revision },
    { label: "Client", value: about.client ?? NOT_RECORDED },
    { label: "Issued", value: formatDate(about.issuedOn) },
    { label: "Site", value: about.site ?? NOT_RECORDED },
    { label: "Cut from", value: stock },
  ];
}

/**
 * The payload as the template receives it: plain JSON, every figure already written at this kind's
 * stated precision, every key already said in words, and nothing left for the template to decide but
 * where to draw a shape.
 */
function present(payload: unknown): Record<string, unknown> {
  const schedule = payload as BbsPayload;
  return {
    title: schedule.title,
    project: schedule.project,
    runningTitle: `${schedule.project} · ${schedule.title}`,
    particulars: particularsOf(schedule),
    entries: entriesOf(schedule),
    stock: stockOf(schedule),
    grandTotalKg: figure(schedule.grandTotalKg, MASS_PLACES),
    partial: schedule.partial,
    leftOut: schedule.leftOut.map((one) => ({ what: one.components.join(" · "), why: one.reason })),
  };
}

/** The kind itself, as the barrel enumerates it (AM-11: the barrel never re-declares this). */
export const BBS_KIND: DocumentKind = Object.freeze({
  kind: BBS,
  payloadSchema: bbsPayloadSchema,
  template: kindTemplate("bbs.typ"),
  present,
});

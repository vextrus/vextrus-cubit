// The `bbs` document kind: a campaign's bill of bars, by member and bar mark, with the shape each
// bar is bent to drawn beside it (R-TO-054, A-BBS-PDF, AM-01, AM-03, AM-05, SEAM-DOC).
//
// IT IS A DRAFT AND SAYS SO ON EVERY PAGE. Before M7 nothing here is signed, so the frame prints
// `DRAFT — UNSIGNED` on every leaf, and the document carries no surveyor, no credential and no
// certificate (AM-05).
//
// THREE LENGTHS, ONE OF THEM ROUNDED (AM-01, L-FRM-05). The raw BS 8666 length prints as it was
// stored, to its full stated precision; the rounded figure is the ONE rounded surface; the
// IS-additive figure stands beside them both and is billed by nothing. This kind rounds none of
// them: every figure of the payload is READ at the precision stated below — the schema offers it to
// `figure()`, which refuses a value that is not already at that precision — so a schedule whose
// figures drifted is a malformed payload, refused whole before a subprocess is reached rather than
// rounded into agreement or failed halfway through a render (SEAM-DOC, L-FMT-02).
//
// A LAP IS ITS OWN LINE (AM-03(a), L-BD-02). A bar that laps prints a `LAP` component line beneath
// its own row carrying the lap's own mass — never a percentage, and never a column of the bar's row:
// net-of-laps and gross-of-laps are both readable because they are two lines.
//
// THE RATE THE BILL WAS TAKEN AT IS STATED (AM-03(b), R-TO-054). Every row carries the kg/m table's
// own figure for its diameter beside the mass it produced, so a reader can reconcile a printed mass
// against the table that billed it. d²/162 only checks a rate and bills nothing, and no mass on this
// schedule is ever reckoned from the IS-additive length — that figure is printed and billed by
// nothing (AM-03(c)).
//
// THE CUTTING STOCK IS INFORMATIONAL (AM-03(e)). What a site cuts from a stock bar is stated per
// diameter beneath the schedule and is billed by nothing.
import { z } from "zod";
import { refusalCodeOf } from "../../faults/refusal-marker";
import { SHAPE_CODES } from "../../rulesets/methods/rebar/bs8666";
import { figure } from "../figures";
import { kindTemplate, type DocumentKind } from "./law";

/** The key this kind is asked for by, and the key the barrel files it under. */
export const BBS = "bbs";

/** What the document calls itself (A-BBS-PDF). */
export const BBS_TITLE = "Bar bending schedule";

/**
 * The precisions this kind states, once (L-FMT-02). A length is stated to the thousandth of a
 * millimetre because BS 8666's raw length is; the ONE rounded surface is a whole millimetre; a mass
 * is a kilogramme to the gramme; and a count of bars, pieces or laps is a whole number.
 */
const LENGTH_PLACES = 3;
const ROUNDED_PLACES = 0;
const MASS_PLACES = 3;
const COUNT_PLACES = 0;

/** The component a line stands for: the bar itself, or the lap beside it (AM-03(a)). */
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

/** One bar of the schedule. Every figure is an exact decimal as text (B-07). */
const barRow = z
  .object({
    /** The member this bar belongs to, and how a reader names that member. */
    objectKey: z.string().min(1),
    class: z.string().min(1),
    /** The level's own label, as a reader reads it, or nothing where the member stands on none. */
    level: z.string().nullable(),
    mark: z.string().min(1),
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
    /** How the bar count was reached: the bars one member takes, and how many members take them. */
    barsPerUnit: z.number().int().positive(),
    parentCount: decimal(COUNT_PLACES),
    bars: decimal(COUNT_PLACES),
    /** The rate this bar was BILLED at — the kg/m table's own figure (AM-03(b), R-TO-054). */
    kgPerMetre: decimal(MASS_PLACES),
    kgNet: decimal(MASS_PLACES),
    kgLap: decimal(MASS_PLACES),
    kg: decimal(MASS_PLACES),
  })
  .strict();

/** What one diameter's stock came to: the bars ordered, the pieces cut, and the offcut left. */
const cuttingStock = z
  .object({ stockBars: z.number().int().nonnegative(), pieces: z.number().int().nonnegative(), offcutMm: decimal(ROUNDED_PLACES) })
  .strict();

/** What the schedule is rendered from. Unknown keys are refused: a payload is a statement, not a bag. */
export const bbsPayloadSchema = z
  .object({
    title: z.string().min(1),
    project: z.string().min(1),
    campaignId: z.string().min(1),
    setRevisionId: z.string().min(1),
    /** What the schedule was cut from, and the one surface it rounded to (AM-01). */
    stockMm: decimal(COUNT_PLACES),
    roundingMm: z.number().int().positive(),
    rows: z.array(barRow),
    /** The kg/m table's mass per diameter, and the campaign's own total — never a figure derived here. */
    perDiameterKg: z.record(z.string().min(1), decimal(MASS_PLACES)),
    cuttingStock: z.record(z.string().min(1), cuttingStock),
    grandTotalKg: decimal(MASS_PLACES),
  })
  .strict();

/** The schedule's payload, as the schema reads it. */
export type BbsPayload = z.output<typeof bbsPayloadSchema>;

/** One bar of a payload, as the schema reads it. */
export type BbsPayloadRow = z.output<typeof barRow>;

/* ------------------------------------------------------- the payload, as the template reads it */

/** The legs a shape is dimensioned by, each as `A 1,850.000` — the letters in the payload's order. */
function dimensionsOf(row: BbsPayloadRow): string[] {
  return Object.entries(row.dimsMm).map(([letter, value]) => `${letter} ${figure(value, LENGTH_PLACES)}`);
}

/**
 * One bar's line, and — where the bar laps — the LAP component line that belongs to it.
 *
 * The lap line states no cutting length of its own: a lap is not cut to a length, and repeating the
 * bar's there would print the one surface BS 8666 rounds twice (AM-01, AM-03(a)).
 */
function linesOf(row: BbsPayloadRow): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [
    {
      component: NET,
      barMark: row.barMark,
      role: row.role,
      shape: row.shape,
      diameter: figure(String(row.diameterMm), COUNT_PLACES),
      dimensions: dimensionsOf(row),
      cuttingRaw: figure(row.cuttingRawMm, LENGTH_PLACES),
      cuttingRounded: figure(row.cuttingRoundedMm, ROUNDED_PLACES),
      cuttingIs: figure(row.cuttingIsAdditiveMm, LENGTH_PLACES),
      bars: figure(row.bars, COUNT_PLACES),
      // The bar's own mass, LAP EXCLUDED: a net mass that already held its lap would make the line
      // beneath it a double count (AM-03(a), L-BD-02).
      kg: figure(row.kgNet, MASS_PLACES),
    },
  ];
  if (row.lapsPerBar > 0) {
    lines.push({
      component: LAP,
      barMark: "",
      role: "",
      shape: "",
      diameter: figure(String(row.diameterMm), COUNT_PLACES),
      dimensions: [`${figure(String(row.lapsPerBar), COUNT_PLACES)} x ${figure(row.lapMm, ROUNDED_PLACES)}`],
      cuttingRaw: "",
      cuttingRounded: "",
      cuttingIs: "",
      bars: figure(String(row.lapsPerBar), COUNT_PLACES),
      kg: figure(row.kgLap, MASS_PLACES),
    });
  }
  return lines;
}

/** The schedule grouped by member, in the order the payload names its members (L-REG-04). */
function membersOf(payload: BbsPayload): Record<string, unknown>[] {
  const order: string[] = [];
  const byMember = new Map<string, BbsPayloadRow[]>();
  for (const row of payload.rows) {
    const held = byMember.get(row.objectKey);
    if (held === undefined) {
      order.push(row.objectKey);
      byMember.set(row.objectKey, [row]);
    } else held.push(row);
  }
  return order.map((objectKey) => {
    const rows = byMember.get(objectKey) ?? [];
    const first = rows[0] as BbsPayloadRow;
    return {
      objectKey,
      mark: first.mark,
      class: first.class,
      level: first.level ?? "",
      lines: rows.flatMap((row) => linesOf(row)),
    };
  });
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
        diameter: figure(String(diameterMm), COUNT_PLACES),
        kg: kg === undefined ? "" : figure(kg, MASS_PLACES),
        stockBars: figure(String(packed?.stockBars ?? 0), COUNT_PLACES),
        pieces: figure(String(packed?.pieces ?? 0), COUNT_PLACES),
        offcut: figure(packed?.offcutMm ?? "0", ROUNDED_PLACES),
      };
    });
}

/**
 * The payload as the template receives it: plain JSON, every figure already written at this kind's
 * stated precision, and nothing left for the template to decide but where to draw a shape.
 */
function present(payload: unknown): Record<string, unknown> {
  const schedule = payload as BbsPayload;
  return {
    title: schedule.title,
    project: schedule.project,
    campaignId: schedule.campaignId,
    setRevisionId: schedule.setRevisionId,
    stockMm: figure(schedule.stockMm, COUNT_PLACES),
    roundingMm: figure(String(schedule.roundingMm), COUNT_PLACES),
    members: membersOf(schedule),
    stock: stockOf(schedule),
    grandTotalKg: figure(schedule.grandTotalKg, MASS_PLACES),
  };
}

/** The kind itself, as the barrel enumerates it (AM-11: the barrel never re-declares this). */
export const BBS_KIND: DocumentKind = Object.freeze({
  kind: BBS,
  payloadSchema: bbsPayloadSchema,
  template: kindTemplate("bbs.typ"),
  present,
});

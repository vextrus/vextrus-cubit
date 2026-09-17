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
// them — `figure()` refuses a value that is not already at the precision stated below, so a schedule
// whose figures drifted is refused before a subprocess is reached rather than rounded into agreement.
//
// A LAP IS ITS OWN LINE (AM-03(a), L-BD-02). A bar that laps prints a `LAP` component line beneath
// its own row carrying the lap's own mass — never a percentage, and never a column of the bar's row:
// net-of-laps and gross-of-laps are both readable because they are two lines.
//
// THE CUTTING STOCK IS INFORMATIONAL (AM-03(e)). What a site cuts from a stock bar is stated per
// diameter beneath the schedule and is billed by nothing.
import { z } from "zod";
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
    dimsMm: z.record(z.string().min(1), z.string().min(1)),
    cuttingRawMm: z.string().min(1),
    cuttingRoundedMm: z.string().min(1),
    cuttingIsAdditiveMm: z.string().min(1),
    piecesPerBar: z.number().int().positive(),
    lapMm: z.string().min(1),
    lapsPerBar: z.number().int().nonnegative(),
    bars: z.string().min(1),
    kgNet: z.string().min(1),
    kgLap: z.string().min(1),
    kg: z.string().min(1),
  })
  .strict();

/** What one diameter's stock came to: the bars ordered, the pieces cut, and the offcut left. */
const cuttingStock = z
  .object({ stockBars: z.number().int().nonnegative(), pieces: z.number().int().nonnegative(), offcutMm: z.string().min(1) })
  .strict();

/** What the schedule is rendered from. Unknown keys are refused: a payload is a statement, not a bag. */
export const bbsPayloadSchema = z
  .object({
    title: z.string().min(1),
    project: z.string().min(1),
    campaignId: z.string().min(1),
    setRevisionId: z.string().min(1),
    /** What the schedule was cut from, and the one surface it rounded to (AM-01). */
    stockMm: z.string().min(1),
    roundingMm: z.number().int().positive(),
    rows: z.array(barRow),
    perDiameterKg: z.record(z.string().min(1), z.string().min(1)),
    cuttingStock: z.record(z.string().min(1), cuttingStock),
    grandTotalKg: z.string().min(1),
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

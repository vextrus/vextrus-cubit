// How far a pile's head stands into the cap it carries, as a set's own words state it — the one
// reading the pile cap's owned sentence names `e` (L-MEA-09, I-544; Interpretation I-597).
//
// A pile is cut off above the cap's soffit, so its head stands inside the cap and is the pile's: the
// cap nets `n × π × d² × e ÷ 4` out of its prism. Nothing in a plan or a schedule states `e`; a note
// does, in one of two shapes a Bangladeshi set writes:
//
//   · the HEAD's own clause — `PILE HEAD TO BE EMBEDDED 75mm INTO THE PILE CAP`, `PILES SHALL PROJECT
//     3" INTO CAP`: the subject is the pile, and the figure is how far it stands into the cap;
//   · the BARS' clause read with its cut-off — `MAIN BARS EXTENDED 3" INTO THE CAP` beside `AND 40d
//     (800) ABOVE THE CUT-OFF` (F-RCC6-BNBC's S-05, Rev C). The bars run inside the pile to its
//     cut-off and then 40d beyond it, so the only point at which a bar "3 inches into the cap" is not
//     contradicted by its own 40d is the cut-off itself: the pile's top stands 3" above the soffit.
//     A bars clause with NO run above the cut-off beside it says where the bars end and nothing about
//     where the concrete does — a column's starter bars are "extended into the cap" too — so it is
//     read as nothing.
//
// A clause stating only a MINIMUM (`NOT LESS THAN 75`, `75mm (MIN)`, `75mm MINIMUM INTO`, `… INTO THE CAP
// (MIN.)`) is read as nothing — the bound is read wherever the clause writes it, before the figure,
// after it, bracketed or not, or after the cap —: deducting the head at its
// minimum leaves in the cap whatever more of it stands there, which is a figure over (L-QTY-04). A
// MAXIMUM (`NOT MORE THAN 100`) is a bound the cap is deducted at, the figure then under, and the
// reading says so (BOUNDED, I-544). A figure with no unit of its own is in the unit the drawing
// declares its dimensions in (I-302), and in none where it declares none (L-MEA-01).
//
// Pure and total, like the notation beside it: texts in, one reading or a named decline out. The
// figure is carried as the drawing wrote it, in the unit it wrote it, and cited to the clause's own
// entity; the canon is reached at the gate (B-17, L-FRM-06).
import type { SectionUnit } from "@/core/db";
import { normaliseNotation } from "@/core/entitygraph/notation";
import { MM_PER_INCH, plainly } from "./grammar";
import { parseFigure } from "./index";

/** One text of one view, as a reader is handed it: the entity it is, and what it says. */
export type ViewText = { readonly sourceKey: string; readonly text: string };

/** What a head clause stood at: outright, or at a bound the drawing states as the most it can be. */
export type PileHeadStanding = "RESOLVED" | "BOUNDED";

/** The head's height into the cap, as a note stated it. */
export type PileHeadStated = {
  readonly stated: true;
  readonly standing: PileHeadStanding;
  /** The figure as the drawing wrote it, in `unit` — never converted here. */
  readonly value: string;
  readonly unit: SectionUnit;
  /** The clause that states it first, then the cut-off clause that makes a bars clause the head's. */
  readonly sourceKeys: readonly string[];
  /** The clause, verbatim (L-CAD-03). */
  readonly clause: string;
};

/** Why a clause that speaks of a length into the cap was not read as the head's height. */
export type PileHeadDeclineReason =
  /** The bars' clause, with no run above the cut-off beside it: it states the bars, not the concrete. */
  | "BARS_ONLY"
  /** A minimum: deducting at it would leave the rest of the head in the cap (L-QTY-04). */
  | "MINIMUM_ONLY"
  /** A bare figure on a drawing that declares no unit (L-MEA-01). */
  | "UNIT_UNSTATED"
  /** A subject that is neither the pile nor its bars. */
  | "NOT_THE_PILE";

export type PileHeadDeclined = {
  readonly stated: false;
  readonly reason: PileHeadDeclineReason;
  readonly sourceKey: string;
  readonly clause: string;
};

export type PileHeadClause = PileHeadStated | PileHeadDeclined;

/**
 * Where one clause of a note ends: a paragraph mark's line break, a semicolon, a sentence's stop — but
 * never the stop of an abbreviated bound (`75mm MIN. INTO THE CAP` is one clause, its bound in it).
 */
const CLAUSE_BREAK = /\n|;|(?<!\b(?:MIN|MAX))\.(?=\s|$)/i;

/** A length as a note writes one: feet and inches, inches, or a figure with or without its `MM`. */
const LENGTH = String.raw`\d+(?:\.\d+)?\s*'\s*-?\s*\d+(?:\.\d+)?\s*"|\d+(?:\.\d+)?\s*"|\d+(?:\.\d+)?\s*'|\d+(?:\.\d+)?(?:\s*MM\b)?`;

/** The words a bound is stated in, and which side of the head it bounds. */
const MINIMUM = String.raw`MIN(?:IMUM)?|NOT\s+LESS\s+THAN|AT\s+LEAST`;
const MAXIMUM = String.raw`MAX(?:IMUM)?|NOT\s+MORE\s+THAN|AT\s+MOST|UP\s+TO`;

const BOUND_WORD = new RegExp(String.raw`(?:${MINIMUM}|${MAXIMUM})\b`);
const MINIMUM_WORD = new RegExp(String.raw`\b(?:${MINIMUM})\b`);
const MAXIMUM_WORD = new RegExp(String.raw`\b(?:${MAXIMUM})\b`);

/**
 * `<subject> [SHALL BE|TO BE|…] EXTENDED|EMBEDDED|PROJECTED … [<bound>] <length> [(<aside>)] [<bound>]
 * INTO [THE] [PILE] CAP [<tail>]`, read off one clause once its codes are resolved, its marks written
 * plainly and its words upper-cased. The aside and the tail are captured, never swallowed: a bound
 * written in either is the clause's bound.
 */
const INTO_THE_CAP = new RegExp(
  String.raw`^(?<subject>.*?)\b(?:EXTEND(?:ED|S)?|EMBED(?:DED|S)?|PROJECT(?:ED|ING|S)?|ENTER(?:ED|ING|S)?)\s+(?:BY\s+)?(?:(?<before>${MINIMUM}|${MAXIMUM})\s+)?(?<length>${LENGTH})\s*(?:\((?<aside>[^)]*)\)\s*)?(?:(?<after>${BOUND_WORD.source})\s*)?INTO\s+(?:THE\s+)?(?:PILE\s+)?CAPS?\b(?<tail>.*)$`,
);

/** A subject naming the bars rather than the concrete. */
const BARS = /\b(?:BARS?|REINF(?:ORCEMENT)?|RODS?)\b/;

/**
 * A subject naming ANOTHER member's bars or body: a column's starters and a wall's stand in the cap
 * too, and are "extended into the cap" on the same sheets — never the pile's head. Dowels and the
 * cap's own bars (`PILE CAP BARS …`) are the same: a run of them into the cap says nothing of the
 * pile's concrete, whatever cut-off clause stands beside it.
 */
const ANOTHER_MEMBER = /\b(?:COLUMNS?|COLS?|WALLS?|BEAMS?|STARTERS?|STUMPS?|NECKS?|DOWELS?|CAPS?)\b/;

/** A subject naming the pile itself — the pile, the piles, its head. */
const PILE = /\bPILES?\b/;

/** A run of the bars ABOVE the pile's cut-off, stated with a figure or a multiple of the bar. */
const ABOVE_THE_CUT_OFF = new RegExp(String.raw`(?:\d+(?:\.\d+)?\s*D\b|${LENGTH})\s*(?:\([^)]*\)\s*)?ABOVE\s+(?:THE\s+)?(?:PILE\s+)?CUT\s*-?\s*OFF\b`);

/** The clauses one text carries, in the drawing's own order, each as the grammar reads words. */
function clausesOf(text: string): string[] {
  return normaliseNotation(text)
    .split(CLAUSE_BREAK)
    .map((clause) => plainly(clause))
    .filter((clause) => clause !== "");
}

/**
 * What one view's texts state of the head's height into the cap: one entry per clause that speaks of
 * a length into the cap, stated or declined by name, in the drawing's order. A view that speaks of
 * none answers an empty list.
 *
 * A bars clause is the head's only where a clause OF THE SAME VIEW states the bars' run above the
 * cut-off — the same text or another line of the note: the two lines of one note are routinely two
 * TEXT entities, and a view is one detail.
 */
export function pileHeadClausesOf(texts: readonly ViewText[], declaredUnit: SectionUnit | null): PileHeadClause[] {
  const clauses = texts.flatMap((one) => clausesOf(one.text).map((clause) => ({ sourceKey: one.sourceKey, clause })));
  const cutOff = clauses.find((one) => ABOVE_THE_CUT_OFF.test(one.clause));
  const read: PileHeadClause[] = [];
  for (const { sourceKey, clause } of clauses) {
    const match = INTO_THE_CAP.exec(clause);
    if (match === null || match.groups === undefined) continue;
    const { subject = "", before = "", length = "", aside = "", after = "", tail = "" } = match.groups;
    // the bound, wherever the clause writes it: a minimum anywhere in it declines (over is a block),
    // a maximum beside the figure or the cap bounds it
    const bounds = [before, aside, after, tail].join(" ");
    const min = MINIMUM_WORD.test(bounds);
    const max = MAXIMUM_WORD.test(bounds);
    const declined = (reason: PileHeadDeclineReason): PileHeadDeclined => ({ stated: false, reason, sourceKey, clause });
    const bars = BARS.test(subject);
    if (ANOTHER_MEMBER.test(subject) || (!bars && !PILE.test(subject))) {
      read.push(declined("NOT_THE_PILE"));
      continue;
    }
    if (bars && cutOff === undefined) {
      read.push(declined("BARS_ONLY"));
      continue;
    }
    if (min) {
      read.push(declined("MINIMUM_ONLY"));
      continue;
    }
    const figure = parseFigure(length);
    const unit = figure?.unit ?? declaredUnit;
    if (figure === null || unit === null || !(figure.value > 0)) {
      read.push(declined("UNIT_UNSTATED"));
      continue;
    }
    const cited = bars && cutOff !== undefined && cutOff.sourceKey !== sourceKey ? [sourceKey, cutOff.sourceKey] : [sourceKey];
    read.push({ stated: true, standing: max ? "BOUNDED" : "RESOLVED", value: String(figure.value), unit, sourceKeys: cited, clause });
  }
  return read;
}

/** A stated head, in millimetres, settled to the micron — for comparing two statements, never billed. */
function millimetresOf(head: PileHeadStated): number {
  const mm = Number(head.value) * (head.unit === "in" ? MM_PER_INCH : 1);
  return Math.round(mm * 1e6) / 1e6;
}

/**
 * The ONE head height a revision states, over every view of every drawing that speaks of it: the
 * first statement in the order handed in where every statement agrees (same standing, same figure),
 * and none where two disagree — a disagreement resolved in silence is a guess (L-REG-03), and the cap
 * then keeps its row naming the head it lacks.
 */
export function pileHeadOf(clauses: readonly PileHeadClause[]): PileHeadStated | null {
  const stated = clauses.filter((one): one is PileHeadStated => one.stated);
  const first = stated[0];
  if (first === undefined) return null;
  const agree = stated.every((one) => one.standing === first.standing && millimetresOf(one) === millimetresOf(first));
  return agree ? first : null;
}

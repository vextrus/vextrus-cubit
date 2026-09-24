// The bill of bars, arranged for reading — and reckoned nowhere (R-TO-054, AM-03(a), I-bbs-2).
//
// THIS FILE COMPUTES NOTHING. Every figure it hands on is a stored decimal of `bbsOf`'s document,
// carried across as the string the door stored it as: no length is re-rounded, no mass is re-summed,
// no total is re-derived. A screen that re-summed would print a figure nobody measured, and the
// third decimal of a campaign's grand total is exactly where that would show (B-17, L-QTY-05).
//
// What it DOES is three arrangements the domain itself states:
//   - a mark is stated once per floor with its number of members (BS 8666, the owner's ruling Q3):
//     the door already counted the members (I-534), and every row carries that count so the group
//     row can say it — the count is the door's figure, carried, never re-counted here;
//   - a lap is its own row beside the net bar, never a column and never a percentage of it — so a
//     bar that laps yields two rows, and a reader can read net-of-laps and gross-of-laps off the
//     same grid (AM-03(a), L-BD-02, I-bbs-3);
//   - the cutting stock is one line per diameter, in ascending numeric order — 8 before 10, which
//     the keys' own string order would not give (R-TO-054, AM-03(e)).
//
// The figures leave here UNGROUPED. Grouping is SEAM-FORMAT's one home (`formatUserFigure`) and it
// happens in the CELL, so the attribute a machine reads stays the stored decimal (R-UI-083).
import { inWords } from "@/core/documents/kinds/boq-draft-law";
import { isLinkRole } from "@/core/rulesets/rebar-roles";
import { convert } from "@/core/units/canon";
import type { BbsDocument } from "@/modules/takeoff/rebar";
import { BBS_COMPONENT_SAID, BBS_COPY, fillCopy } from "./copy";
import type { BbsEntryCoverage, BbsOmission } from "./view";

/**
 * The fraction length this schedule states each kind of figure at: a length to the thousandth of a
 * millimetre because BS 8666's raw length is, the one rounded surface to the whole millimetre, a
 * mass to the gramme, and a count whole (AM-01, L-FMT-02).
 *
 * The `bbs` document kind states the same four, and states them for the payload it parses. They are
 * mirrored here rather than imported because that file reaches the filesystem to find its template
 * and this one is read by a client component — the same reason `copy.ts` mirrors the string table.
 */
export const BBS_PLACES = Object.freeze({ length: 3, rounded: 0, mass: 3, count: 0 });

/**
 * A stored decimal as this schedule STATES it: the same figure, written to the fraction length the
 * document states that kind of figure at (`BBS_PLACES`).
 *
 * The store keeps whatever fraction the arithmetic that made a figure left behind — a mass out of a
 * division chain, a length out of a ceil — and both the schedule and the document it is printed in
 * state a mass to the gramme and a length to the thousandth. Writing the fraction out to that length
 * is FORMATTING: it is done on the text, digit by digit, so no float ever touches a stored figure and
 * nothing here re-sums, re-rounds or re-derives anything (B-07, L-FMT-02, I-bbs-2). What a row
 * publishes on its `data-*` is still the stored string, untouched.
 */
export function statedAt(value: string, places: number): string {
  const sign = value.startsWith("-") ? "-" : "";
  const [whole = "", fraction = ""] = (sign === "" ? value : value.slice(1)).split(".");
  if (whole === "") return value;
  if (fraction.length <= places) return places === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction.padEnd(places, "0")}`;

  // More digits than the document states: the figure is STATED at that length, never cut short of
  // it. A cut would write every figure toward zero — '9.8645' as '9.864', an offcut '68050.7' as
  // '68050' — and a document that understated a mass by a gramme a row would understate the
  // campaign. So the digits are carried half-up, on the text (L-FMT-02, B-07).
  const kept = `${whole}${fraction.slice(0, places)}`;
  const lifted = fraction.charAt(places) >= "5" ? carried(kept) : kept;
  const head = lifted.slice(0, lifted.length - places);
  return places === 0 ? `${sign}${head}` : `${sign}${head}.${lifted.slice(lifted.length - places)}`;
}

/** One added to a string of digits, digit by digit — the carry a half-up statement needs. */
function carried(digits: string): string {
  const out = [...digits];
  for (let at = out.length - 1; at >= 0; at -= 1) {
    if (out[at] !== "9") {
      out[at] = String(Number(out[at]) + 1);
      return out.join("");
    }
    out[at] = "0";
  }
  return `1${out.join("")}`;
}

/** Which component of a bar a row stands for: the bar itself, or the lap beside it (AM-03(a)). */
export type BbsComponent = "NET" | "LAP";

/**
 * One row of the grid the workspace draws. A NET row is a stored bar row renamed; a LAP row is the
 * same bar's lap, standing on its own beneath it and carrying the lap's own mass.
 *
 * The three cutting lengths are EMPTY on a LAP row: a lap has no cutting length of its own, and
 * repeating the bar's there would print the one surface BS 8666 rounds twice (I-bbs-3, I-bbs-4).
 */
export type BbsGridRow = {
  /** This row's own identity in the grid — one bar yields at most two, so the component is in it. */
  readonly key: string;
  /** The entry the line belongs to: its first member's key, which names the group row (I-534). */
  readonly objectKey: string;
  readonly mark: string;
  readonly class: string;
  readonly level: string | null;
  /** How many members of the mark on this floor the line counts — the door's own count (I-534). */
  readonly members: number;
  /** How many of the bar ONE member takes; `bars` is that times `members` (BS 8666's "in each"). */
  readonly barsPerUnit: number;
  readonly component: BbsComponent;
  readonly barKey: string;
  readonly barMark: string;
  readonly role: string;
  readonly diameterMm: number;
  readonly shape: string;
  readonly dimsMm: Readonly<Record<string, string>>;
  readonly cuttingRawMm: string;
  readonly cuttingRoundedMm: string;
  readonly cuttingIsAdditiveMm: string;
  readonly piecesPerBar: number;
  readonly bars: string;
  readonly lapMm: string;
  readonly lapsPerBar: number;
  /** The mass this component carries: `kgNet` on a NET row, `kgLap` on a LAP row (AM-03(a)). */
  readonly kg: string;
};

/**
 * One line of the cutting-stock summary: a diameter, its mass, and what a site cuts it from — or,
 * where the diameter's bars include storey-height runs whose laps are not stated, `withheld`: the
 * packing is not a plan anybody can cut to, and the line says so instead of printing it
 * (I-567). `offcutMm` is the door's stored figure; `offcutM` is how a reader reads it.
 */
export type BbsSummaryRow = {
  readonly diameterMm: number;
  readonly kg: string;
  readonly stockBars: number;
  readonly pieces: number;
  readonly offcutMm: string;
  /** The offcut in metres, stated to the millimetre (`BBS_PLACES.length`): a length of steel is read in metres. */
  readonly offcutM: string;
  readonly withheld: boolean;
};

/** The summary beneath the grid, closed by the total the DOOR answered (I-bbs-2). */
export type BbsSummary = {
  readonly rows: readonly BbsSummaryRow[];
  readonly grandTotalKg: string;
  readonly stockMm: string;
  readonly roundingMm: number;
};

/** What a cutting-stock line says where the document packed that diameter; zeroes where it did not. */
const NOTHING_PACKED = Object.freeze({ stockBars: 0, pieces: 0, offcutMm: "0" });

/** A lap's three cutting-length cells: a lap is not cut to a length of its own (I-bbs-3). */
const NO_CUTTING_LENGTH = "";

/**
 * The door's lines in the order the grid draws them: `document.rows`, gathered under the entry each
 * belongs to — the mark on its floor, named by its first member (I-534). The entries keep the order
 * the document first names them in, and the lines inside an entry keep the document's own order —
 * this sorts nothing, because the door already answered in the one order a bill is read in (L-REG-04).
 */
function groupedByMember(document: BbsDocument): BbsDocument["rows"][number][] {
  const byMember = new Map<string, BbsDocument["rows"][number][]>();
  for (const row of document.rows) {
    const held = byMember.get(row.objectKey);
    if (held === undefined) byMember.set(row.objectKey, [row]);
    else held.push(row);
  }
  return [...byMember.values()].flat();
}

/**
 * The grid's rows: one NET row per line the door answered, and — immediately beneath it, and only
 * where the bar in fact laps — one LAP row carrying that lap's own mass (AM-03(a), L-BD-02).
 */
export function bbsRowsOf(document: BbsDocument): readonly BbsGridRow[] {
  const rows: BbsGridRow[] = [];
  for (const bar of groupedByMember(document)) {
    const member = { objectKey: bar.objectKey, mark: bar.mark, class: bar.class as string, level: bar.level, members: bar.members.length, barsPerUnit: bar.barsPerUnit };
    rows.push({
      ...member,
      key: `${bar.barKey}|NET`,
      component: "NET",
      barKey: bar.barKey,
      barMark: bar.barMark,
      role: bar.role,
      diameterMm: bar.diameterMm,
      shape: bar.shape,
      dimsMm: bar.dimsMm,
      cuttingRawMm: bar.cuttingRawMm,
      cuttingRoundedMm: bar.cuttingRoundedMm,
      cuttingIsAdditiveMm: bar.cuttingIsAdditiveMm,
      piecesPerBar: bar.piecesPerBar,
      bars: bar.bars,
      lapMm: bar.lapMm,
      lapsPerBar: bar.lapsPerBar,
      // The NET row's mass is the bar's own, LAP EXCLUDED: a net mass that already held its lap
      // would make the pair beneath it a double count (AM-03(a), L-BD-02).
      kg: bar.kgNet,
    });
    if (bar.lapsPerBar <= 0) continue;
    rows.push({
      ...member,
      key: `${bar.barKey}|LAP`,
      component: "LAP",
      barKey: bar.barKey,
      barMark: bar.barMark,
      role: bar.role,
      diameterMm: bar.diameterMm,
      shape: bar.shape,
      dimsMm: bar.dimsMm,
      cuttingRawMm: NO_CUTTING_LENGTH,
      cuttingRoundedMm: NO_CUTTING_LENGTH,
      cuttingIsAdditiveMm: NO_CUTTING_LENGTH,
      piecesPerBar: bar.piecesPerBar,
      // A lap's count is how many laps the bar carries — the Bars cell of a lap row (Decision §1).
      bars: String(bar.lapsPerBar),
      lapMm: bar.lapMm,
      lapsPerBar: bar.lapsPerBar,
      kg: bar.kgLap,
    });
  }
  return rows;
}

/**
 * Which of a schedule's bars are storey-height RUNS rather than lengths to cut, and which diameters'
 * cutting stock is therefore withheld (I-567).
 *
 * A member whose line declared a length term missing (`deferred`: its laps, or its run) holds
 * running bars cut to nothing but its storey height — no lap, no starter, no anchorage. A packing of
 * those lengths into stock bars is a cutting plan no fabricator could follow, so every diameter such a
 * bar is of has its cutting stock withheld, and every entry holding one is labelled. A link (a tie,
 * a stirrup, a spiral) takes its length from the section, not the run, and is not a run. Read, never
 * judged: the members are the published lines' own declaration, and this computes no length.
 */
export function cuttingStandingOf(document: BbsDocument, deferred: readonly string[]): { readonly runs: ReadonlySet<string>; readonly withheld: readonly number[] } {
  const held = new Set(deferred);
  const runs = new Set<string>();
  const withheld = new Set<number>();
  for (const line of document.rows) {
    if (isLinkRole(line.role) || !line.members.some((member) => held.has(member))) continue;
    runs.add(line.objectKey);
    withheld.add(line.diameterMm);
  }
  return { runs, withheld: [...withheld].sort((left, right) => left - right) };
}

/** One published rebar line as an entry's standing reads it: whose it is, its coverage, what it left out. */
export type BbsLineStanding = {
  readonly objectKey: string;
  readonly coverage: string;
  readonly omitted: readonly { readonly code: string; readonly variable: string | null }[];
};

/** The coverage a line states when it measured the whole of what its kind asks (L-QTY-02). */
const WHOLE = "COMPLETE";
/** The coverage an entry stands at wherever any member's line is not known whole (L-QTY-02). */
const PARTLY = "PARTIAL_DECLARED";

/**
 * Each entry's standing, by the entry's key (s-bbs I-655): COMPLETE only where every member the
 * entry counts published a line and every such line is COMPLETE; otherwise PARTIAL_DECLARED, with the
 * codes those lines state, each once, in the order the lines (handed in their published order) first
 * state it, and the components each was stated for.
 *
 * A member with no line is not whole: nothing was published that says it is, and an entry is never
 * told COMPLETE by default (L-QTY-02). Read, never judged — this joins the door's entries to the
 * lines' own statements and computes no figure.
 */
export function entryCoverageOf(document: Pick<BbsDocument, "rows">, lines: readonly BbsLineStanding[]): Record<string, BbsEntryCoverage> {
  const entries: Record<string, BbsEntryCoverage> = {};
  for (const line of document.rows) {
    if (line.objectKey in entries) continue;
    const members = new Set(line.members.length > 0 ? line.members : [line.objectKey]);
    const own = lines.filter((one) => members.has(one.objectKey));
    const published = new Set(own.map((one) => one.objectKey));
    const whole = [...members].every((member) => published.has(member)) && own.every((one) => one.coverage === WHOLE);
    const byCode = new Map<string, string[]>();
    for (const one of own) {
      for (const { code, variable } of one.omitted) {
        const held = byCode.get(code) ?? [];
        if (!byCode.has(code)) byCode.set(code, held);
        if (variable !== null && !held.includes(variable)) held.push(variable);
      }
    }
    entries[line.objectKey] = { coverage: whole ? WHOLE : PARTLY, omitted: [...byCode.entries()].map(([code, components]) => ({ code, components })) };
  }
  return entries;
}

/**
 * A stored millimetre figure as metres, stated to the millimetre — the canon's own conversion, so no
 * factor is spelled here (L-FRM-06), and the text is then stated at three places (`statedAt`).
 */
export function metresOf(millimetres: string): string {
  const carried = convert(millimetres, "mm", "m");
  return carried.ok ? statedAt(carried.value, BBS_PLACES.length) : millimetres;
}

/** A list said as prose: `laps`, `laps and ties`, `bars, laps and ties`. */
export function listed(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} ${BBS_COPY.bbs_scope_and} ${words.at(-1) ?? ""}`;
}

/**
 * What the schedule's total covers, in words, wherever it is not the whole of the steel — the
 * classes it schedules, whether its bars are the main bars alone, and the components its lines left
 * out: `Column main bars only — laps and ties not counted` (I-567, I-569). Empty where
 * the schedule is the campaign's whole reinforcement: nothing is partly declared and no steel is
 * outside it.
 */
export function totalCoversOf(document: BbsDocument, reading: { readonly partial: boolean; readonly omitted: readonly BbsOmission[]; readonly notInSchedule: number }): string {
  if (!reading.partial && reading.notInSchedule === 0) return "";
  const classes = [...new Set(document.rows.map((line) => line.class as string))].map((klass) => inWords(klass).toLowerCase());
  const bars = document.rows.some((line) => isLinkRole(line.role)) ? BBS_COPY.bbs_scope_bars : BBS_COPY.bbs_scope_main_bars;
  const said = `${listed(classes)} ${bars}`.trim();
  const scope = `${said.slice(0, 1).toUpperCase()}${said.slice(1)}`;
  const missing = [...new Set(reading.omitted.flatMap((omission) => omission.components))].map((component) => (BBS_COMPONENT_SAID[component] ?? component).toLowerCase());
  return missing.length === 0 ? fillCopy("bbs_total_covers_whole", { scope }) : fillCopy("bbs_total_covers", { scope, missing: listed(missing) });
}

/**
 * The cutting-stock summary: one line per diameter the document totals, in ASCENDING NUMERIC order,
 * carrying that diameter's own packing answer and closed by the grand total the door stated.
 *
 * The total is the document's, never a sum made here: a figure is rounded once, where it is printed
 * (L-QTY-05), so a re-summed total and the door's own differ in the last decimal — and the one a
 * reader must be able to check against the bill is the door's (B-17, I-bbs-2).
 */
export function bbsSummaryOf(document: BbsDocument, withheld: readonly number[] = []): BbsSummary {
  const rows = Object.keys(document.perDiameterKg)
    .map((diameter) => Number(diameter))
    .sort((left, right) => left - right)
    .map((diameterMm) => {
      const packed = document.cuttingStock[String(diameterMm)] ?? NOTHING_PACKED;
      return {
        diameterMm,
        kg: document.perDiameterKg[String(diameterMm)] ?? "0",
        stockBars: packed.stockBars,
        pieces: packed.pieces,
        offcutMm: packed.offcutMm,
        offcutM: metresOf(packed.offcutMm),
        withheld: withheld.includes(diameterMm),
      };
    });
  return { rows, grandTotalKg: document.grandTotalKg, stockMm: document.stockMm, roundingMm: document.roundingMm };
}

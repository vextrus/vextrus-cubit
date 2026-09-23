// What every S-Ask query reads the same way (docs/design/s-ask.md I-398, I-399, I-404): which rows
// stand under a question, the exact sum of the COMPLETE ones, the places their evidence stands, and
// what an answer leaves out. One home, so no two intents sum, place or disclose differently (B-17).
import { isElementType, type ElementType } from "@/core/catalogue/classes";
import { isKind, type Kind } from "@/core/catalogue/kinds";
import { BEARS } from "@/core/catalogue/bears";
import { WORK_ITEM_CATALOGUE } from "@/core/catalogue/catalogue";
import { placesOf } from "@/core/documents/kinds/boq-draft-law";
import { mtextLines, normaliseNotation } from "@/core/entitygraph/notation";
import { viewKey, viewRefOf } from "@/core/identity";
import { COVERAGES } from "@/core/offers/law";
import { exact } from "@/core/units/canon";
import { markOrder } from "@/modules/takeoff/register-ui/order";
import { FOUNDATION_LABELS } from "../vocabulary";
import {
  FOUNDATION_SLOT,
  type AskCodeCount,
  type AskFigure,
  type AskLevel,
  type AskLine,
  type AskLineRecord,
  type AskObject,
  type AskObjectRecord,
  type AskPartial,
  type AskPlace,
  type AskReading,
  type AskRecords,
  type AskSources,
} from "../law";

/** L-QTY-02's COMPLETE, read off the coverage roster rather than spelled again. */
export const COMPLETE = COVERAGES[0];

/** The register's corroboration word for an object a person struck (I-173). */
const REPUDIATED = "REPUDIATED";

/** An answer that rests on no record of a kind. */
export const NO_RECORDS: AskRecords = Object.freeze({ lines: [], objects: [], readings: [], cells: [], sheets: [] });

/** A class of the catalogue, or null for a register row naming none. */
export function classOf(name: string): ElementType | null {
  return isElementType(name) ? name : null;
}

/** A kind of the catalogue, or null. */
export function kindOf(name: string): Kind | null {
  return isKind(name) ? name : null;
}

/** The places a kind's figure is written at — the register's and the draft BOQ's own (I-398). */
export function placesOfKind(kind: string): number | null {
  return isKind(kind) ? placesOf(kind) : null;
}

/** The unit the catalogue measures a kind in — the one every line of that kind is published in. */
export function unitOfKind(kind: Kind): string {
  return WORK_ITEM_CATALOGUE[kind].canonicalUnit;
}

/**
 * The exact sum of decimal strings, in the canon's one exact arithmetic — never a float, never
 * rounded before the screen states it (B-07, I-398). Written out whole, never in exponent form.
 */
export function exactSum(values: readonly string[]): string {
  return values.reduce((held, value) => held.plus(exact(value)), exact(0)).toFixed();
}

/** How many fraction digits a decimal string is written to — the places a reading was written at. */
export function placesWritten(value: string): number {
  const fraction = /\.(\d+)$/u.exec(value.trim());
  return fraction === null ? 0 : (fraction[1] as string).length;
}

/** One figure. */
export function figure(value: string, unit: string | null, kind: Kind | null, places: number, at: readonly AskPlace[]): AskFigure {
  return { value, unit, kind, places, at };
}

/** A whole count as a figure: no unit, no places. */
export function countFigure(count: number, at: readonly AskPlace[]): AskFigure {
  return figure(String(count), null, null, 0, at);
}

/**
 * The places evidence stands on, one per (drawing, layout), each with every key cited there, in the
 * order they were first met — so the members' sheets come first where they are handed in first (I-404).
 */
export function placesFrom(places: readonly (AskPlace | null)[]): AskPlace[] {
  const held: { drawingId: string; layoutName: string; sheetLabel: string | null; keys: string[] }[] = [];
  for (const place of places) {
    if (place === null) continue;
    const same = held.find((one) => one.drawingId === place.drawingId && one.layoutName === place.layoutName);
    if (same === undefined) held.push({ drawingId: place.drawingId, layoutName: place.layoutName, sheetLabel: place.sheetLabel, keys: [...new Set(place.keys)] });
    else for (const key of place.keys) if (!same.keys.includes(key)) same.keys.push(key);
  }
  return held;
}

/** Where one line's Trace stands: its sheet and what it selects there (I-421), or null. */
export function placeOfLine(line: AskLine): AskPlace | null {
  if (line.drawingId === null || line.layoutName === null) return null;
  return { drawingId: line.drawingId, layoutName: line.layoutName, sheetLabel: line.sheetLabel, keys: line.traceKeys };
}

/** Whether a person struck this object (I-173): it is never counted and its lines are never summed. */
export function isStruck(object: AskObject): boolean {
  return object.corroboration === REPUDIATED;
}

/**
 * Whether a register row stands on the level a question names. The foundation is read beside the
 * stack's own foundation level: an object filed under the lawful-null slot answers to it (I-400).
 */
export function onLevel(rowLevel: string, asked: string | null): boolean {
  if (asked === null) return true;
  if (rowLevel === asked) return true;
  const foundation = asked === FOUNDATION_SLOT || FOUNDATION_LABELS.includes(asked.toUpperCase());
  return foundation && (rowLevel === FOUNDATION_SLOT || FOUNDATION_LABELS.includes(rowLevel.toUpperCase()));
}

/**
 * How levels are read, from the ground up (§1.1 3): the foundation slot below the whole stack, then
 * the stack by ordinal, then anything the stack does not place.
 */
export function levelRankOf(stack: readonly AskLevel[]): (level: string) => number {
  const ranks = new Map(stack.map((level) => [level.label, level.ordinal]));
  return (level) => (level === FOUNDATION_SLOT ? Number.NEGATIVE_INFINITY : (ranks.get(level) ?? Number.POSITIVE_INFINITY));
}

/** Levels in reading order, each once. */
export function levelsInOrder(levels: Iterable<string>, stack: readonly AskLevel[]): string[] {
  const rank = levelRankOf(stack);
  return [...new Set(levels)].sort((left, right) => rank(left) - rank(right) || (left < right ? -1 : left > right ? 1 : 0));
}

/** Marks in the order a QS counts them. */
export function marksInOrder(marks: Iterable<string>): string[] {
  return [...new Set(marks)].sort(markOrder);
}

/** The view key a placement key opens with, or null for a key of no view. */
export function viewOfPlacement(placementKey: string): string | null {
  const ref = viewRefOf(placementKey);
  return ref === null ? null : viewKey(ref);
}

/** The objects of a campaign by their key. */
export function objectsByKey(sources: Pick<AskSources, "objects">): ReadonlyMap<string, AskObject> {
  return new Map(sources.objects.map((object) => [object.objectKey, object]));
}

/** Whether an object stands under a reading's class, mark and level. */
export function objectUnder(object: AskObject, reading: AskReading): boolean {
  if (reading.class !== null && object.class !== reading.class) return false;
  if (reading.mark !== null && object.mark !== reading.mark) return false;
  return onLevel(object.level, reading.level);
}

/**
 * The lines under a reading's class, kind, mark and level, never a line whose object a person struck
 * (I-173, I-399): a repudiated line is withheld from every figure and every count of what is left out.
 */
export function linesUnder(sources: Pick<AskSources, "lines" | "objects">, reading: AskReading, byKey = objectsByKey(sources)): AskLine[] {
  return sources.lines.filter((line) => {
    if (line.repudiated) return false;
    if (reading.class !== null && line.class !== reading.class) return false;
    if (reading.kind !== null && line.kind !== reading.kind) return false;
    if (reading.mark !== null && byKey.get(line.objectKey)?.mark !== reading.mark) return false;
    return onLevel(line.level, reading.level);
  });
}

/** A line whose figure may be summed: COMPLETE, and carrying one (L-QTY-02). */
export function isComplete(line: AskLine): boolean {
  return line.coverage === COMPLETE && line.value !== null;
}

/** One line as the Rows state it. */
export function lineRecord(line: AskLine, byKey: ReadonlyMap<string, AskObject>): AskLineRecord {
  return {
    lineId: line.lineId,
    objectKey: line.objectKey,
    level: line.level,
    mark: byKey.get(line.objectKey)?.mark ?? "",
    class: line.class,
    kind: line.kind,
    value: line.value,
    unit: line.unit,
    places: placesOfKind(line.kind),
    coverage: line.coverage,
    omitted: line.omitted ?? [],
    drawingId: line.drawingId,
    layoutName: line.layoutName,
    sheetLabel: line.sheetLabel,
    traceKeys: line.traceKeys,
  };
}

/** One object as the Rows state it, with where its member stands (I-404). */
export function objectRecord(object: AskObject, sources: Pick<AskSources, "memberAt">): AskObjectRecord {
  return { objectKey: object.objectKey, level: object.level, class: object.class, mark: object.mark, sourceKey: object.sourceKey, place: sources.memberAt(object.objectKey) };
}

/**
 * Group rows by the codes each states into counts of ROWS, in first-met order, carrying the variables
 * each code omitted: a formwork line omitting `t_left` and `t_right` under one code is one line under
 * that code, never two.
 */
function countsOf(rows: readonly { codes: readonly { code: string | null; variable: string | null }[] }[]): AskCodeCount[] {
  const held: { code: string | null; count: number; variables: string[] }[] = [];
  for (const row of rows) {
    const counted = new Set<string | null>();
    for (const entry of row.codes) {
      let same = held.find((one) => one.code === entry.code);
      if (same === undefined) {
        same = { code: entry.code, count: 0, variables: [] };
        held.push(same);
      }
      if (!counted.has(entry.code)) {
        same.count += 1;
        counted.add(entry.code);
      }
      if (entry.variable !== null && !same.variables.includes(entry.variable)) same.variables.push(entry.variable);
    }
  }
  return held;
}

/**
 * What an answer leaves out (I-399): every PARTIAL line under the question, counted and grouped by
 * each code it omits under (a line omitting two components counts under each), and every registered
 * object under the question that holds no line of what was asked, grouped by the reason its sighting
 * was deferred or refused (none where the register recorded none). Null where nothing is left out.
 */
export function partialOf(
  sources: Pick<AskSources, "lines" | "objects" | "refusals">,
  reading: AskReading,
  under: readonly AskLine[],
): { partial: AskPartial | null; partialLines: AskLine[]; lineless: AskObject[] } {
  const partialLines = under.filter((line) => !isComplete(line));
  const withLine = new Set(sources.lines.filter((line) => reading.kind === null || line.kind === reading.kind).map((line) => line.objectKey));
  // A kind asked of no class reads only the objects of the classes the catalogue measures it on: a
  // column holds no blinding line because a column bears no blinding, not because it is left out.
  const bears = (klass: string): boolean => reading.kind === null || BEARS.some((row) => row.class === klass && row.kind === reading.kind);
  const lineless = sources.objects.filter((object) => !isStruck(object) && objectUnder(object, reading) && !withLine.has(object.objectKey) && bears(object.class));
  const codes = countsOf(
    partialLines.map((line) => {
      const omitted = line.omitted ?? [];
      return { codes: omitted.length === 0 ? [{ code: null, variable: null }] : omitted.map((one) => ({ code: one.code, variable: one.variable })) };
    }),
  );
  const reasonOf = (objectKey: string): string | null =>
    sources.refusals.find((row) => row.objectKey === objectKey && (reading.kind === null || row.kind === null || row.kind === reading.kind))?.code ?? null;
  const reasons = countsOf(lineless.map((object) => ({ codes: [{ code: reasonOf(object.objectKey), variable: null }] })));
  const partial = partialLines.length === 0 && lineless.length === 0 ? null : { lines: partialLines.length, codes, objects: lineless.length, reasons };
  return { partial, partialLines, lineless };
}

/** A clause as a reader reads it: an MTEXT's lines joined, its notation normalised (I-401). */
export function clauseOf(text: string | null): string | null {
  if (text === null) return null;
  return normaliseNotation(mtextLines(text).join(" ")).replace(/\s+/gu, " ").trim();
}

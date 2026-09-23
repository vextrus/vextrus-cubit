// QUANTITY (§1.2): "What is the column concrete?" — the COMPLETE lines of one class and one kind
// (optionally one level or one mark), summed exactly (I-398); every PARTIAL line under the question
// counted beside the figure with its omitted codes, and every registered object with no line counted
// with its reason — never summed, never hidden (I-399). A subject whose lines are all PARTIAL states no
// figure at all. Asked by level or by mark, a breakdown follows, from the ground up or in mark order.
//
// `concrete` is reinforced concrete; blinding under the same classes, in the same unit, is stated
// APART and never added (§1.2's word two kinds answer to), so the register footer — which adds every
// m³ of a visible set — and this answer never read as a contradiction.
import type { Kind } from "@/core/catalogue/kinds";
import type { AskApart, AskBreakdownRow, AskLine, AskReading, AskSources } from "../law";
import {
  exactSum,
  figure,
  isComplete,
  levelsInOrder,
  lineRecord,
  linesUnder,
  marksInOrder,
  objectRecord,
  objectsByKey,
  partialOf,
  placeOfLine,
  placesFrom,
  placesOfKind,
  unitOfKind,
  NO_RECORDS,
} from "./common";
import { notMeasured, type AskQuery } from "./registry-law";

/** Reinforced concrete: the word two kinds answer to. */
const RCC_CONCRETE: Kind = "rcc.concrete";

/** Blinding: the other kind `concrete` might mean, stated apart and never added. */
const PCC_BLINDING: Kind = "pcc.blinding";

/** The figure a set of lines of one kind sums to, or null where none of them is COMPLETE. */
export function sumOf(lines: readonly AskLine[], kind: Kind): { figure: ReturnType<typeof figure> | null; complete: AskLine[] } {
  const complete = lines.filter(isComplete);
  if (complete.length === 0) return { figure: null, complete };
  const value = exactSum(complete.map((line) => line.value as string));
  return { figure: figure(value, unitOfKind(kind), kind, placesOfKind(kind) ?? 0, placesFrom(complete.map(placeOfLine))), complete };
}

/**
 * Blinding under the classes a concrete answer stands on, where they hold COMPLETE blinding in the
 * same unit — stated apart, never added (§1.2).
 */
export function apartOf(kind: Kind | null, reading: AskReading, sources: AskSources, classes: readonly string[]): AskApart | null {
  if (kind !== RCC_CONCRETE) return null;
  const blinding = linesUnder(sources, { ...reading, kind: PCC_BLINDING, class: null }).filter((line) => classes.includes(line.class) && line.unit === unitOfKind(RCC_CONCRETE));
  const summed = sumOf(blinding, PCC_BLINDING);
  if (summed.figure === null) return null;
  return { kind: PCC_BLINDING, classes: [...new Set(summed.complete.map((line) => line.class))], figure: summed.figure, lines: summed.complete.length };
}

/** A breakdown row over the lines standing on one level or one mark. */
function rowOf(lines: readonly AskLine[], kind: Kind, level: string | null, mark: string | null, klass: string | null): AskBreakdownRow {
  const summed = sumOf(lines, kind);
  return { level, mark, class: klass, count: summed.complete.length, figure: summed.figure, partial: lines.length - summed.complete.length };
}

export const QUANTITY_QUERY: AskQuery = {
  intent: "QUANTITY",
  basis: "REGISTER",
  needs: ["members"],
  answer(reading: AskReading, sources: AskSources) {
    const kind = reading.kind;
    if (sources.campaign === null || kind === null) return notMeasured(reading);
    const byKey = objectsByKey(sources);
    const under = linesUnder(sources, reading, byKey);
    const { partial, lineless } = partialOf(sources, reading, under);
    if (under.length === 0 && lineless.length === 0) return notMeasured(reading);

    const summed = sumOf(under, kind);
    let breakdown: AskBreakdownRow[] | null = null;
    if (reading.by === "LEVEL") {
      breakdown = levelsInOrder(
        under.map((line) => line.level),
        sources.stack,
      ).map((level) => rowOf(under.filter((line) => line.level === level), kind, level, null, reading.class));
    } else if (reading.by === "MARK") {
      const markOf = (line: AskLine): string => byKey.get(line.objectKey)?.mark ?? "";
      breakdown = marksInOrder(under.map(markOf)).map((mark) => rowOf(under.filter((line) => markOf(line) === mark), kind, null, mark, reading.class));
    }
    const records = { ...NO_RECORDS, lines: under.map((line) => lineRecord(line, byKey)), objects: lineless.map((object) => objectRecord(object, sources)) };
    return {
      statement: {
        intent: "QUANTITY",
        figure: summed.figure,
        lines: summed.complete.length,
        breakdown,
        apart: apartOf(kind, reading, sources, reading.class === null ? [] : [reading.class]),
      },
      partial,
      places: placesFrom([...under.map(placeOfLine), ...records.objects.map((record) => record.place)]),
      records,
      basis: "REGISTER",
    };
  },
};

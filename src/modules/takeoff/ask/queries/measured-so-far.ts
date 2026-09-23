// MEASURED_SO_FAR (§1.2, I-399): "What is the total concrete for the building?" — the COMPLETE lines
// of one kind across the classes (or of every kind), summed WITHIN a kind only: two kinds are two
// trades a bill states apart, even where their unit agrees (I-398). It is never a total: every
// (class, kind) group standing without a figure is named, every class the catalogue measures the kind
// on that holds no line in this campaign is named, and the screen states "This is not a total for the
// building" over every answer of this intent.
import { BEARS } from "@/core/catalogue/bears";
import { ELEMENT_TYPES, type ElementType } from "@/core/catalogue/classes";
import { KINDS, type Kind } from "@/core/catalogue/kinds";
import type { AskBreakdownRow, AskReading, AskSources, AskTrade, AskWithout } from "../law";
import { classOf, isComplete, kindOf, lineRecord, linesUnder, objectsByKey, partialOf, placeOfLine, placesFrom, unitOfKind, NO_RECORDS } from "./common";
import { apartOf, sumOf } from "./quantity";
import { notMeasured, type AskQuery } from "./registry-law";

export const MEASURED_SO_FAR_QUERY: AskQuery = {
  intent: "MEASURED_SO_FAR",
  basis: "REGISTER",
  needs: [],
  answer(reading: AskReading, sources: AskSources) {
    if (sources.campaign === null) return notMeasured(reading);
    const across: AskReading = { ...reading, class: null, mark: null };
    const byKey = objectsByKey(sources);
    const under = linesUnder(sources, across, byKey);
    if (under.length === 0) return notMeasured(reading);
    const { partial } = partialOf(sources, across, under);

    const kinds = KINDS.filter((kind) => under.some((line) => line.kind === kind));
    const trades: AskTrade[] = [];
    const without: AskWithout[] = [];
    for (const kind of kinds) {
      const ofKind = under.filter((line) => line.kind === kind);
      const summed = sumOf(ofKind, kind);
      const classes: AskBreakdownRow[] = [];
      for (const klass of ELEMENT_TYPES) {
        const ofClass = ofKind.filter((line) => line.class === klass);
        if (ofClass.length === 0) continue;
        const one = sumOf(ofClass, kind);
        classes.push({ level: null, mark: null, class: klass, count: one.complete.length, figure: one.figure, partial: ofClass.length - one.complete.length });
        if (one.figure === null) without.push({ class: klass, kind, count: ofClass.length });
      }
      const measuredOn = new Set(ofKind.map((line) => line.class));
      const absent = BEARS.filter((row) => row.kind === kind && !measuredOn.has(row.class)).map((row) => row.class);
      trades.push({ kind, unit: unitOfKind(kind), figure: summed.figure, lines: summed.complete.length, classes, absent: [...new Set(absent)] });
    }
    // A kind asked that no line of this campaign is of: nothing is measured for it (I-399).
    const asked: Kind | null = reading.kind === null ? null : kindOf(reading.kind);
    const concreteClasses = [...new Set(under.filter((line) => isComplete(line) && line.kind === asked).map((line) => classOf(line.class)).filter((klass): klass is ElementType => klass !== null))];
    return {
      statement: { intent: "MEASURED_SO_FAR", trades, without, apart: apartOf(asked, across, sources, concreteClasses) },
      partial,
      places: placesFrom(under.filter(isComplete).map(placeOfLine)),
      records: { ...NO_RECORDS, lines: under.map((line) => lineRecord(line, byKey)) },
      basis: "REGISTER",
    };
  },
};

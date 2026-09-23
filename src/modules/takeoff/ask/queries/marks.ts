// MARKS (§1.2): "How many pile caps of each type?" — the registered objects of a class (and a level),
// grouped by mark in the order a QS counts them, with the total. Never a struck object (I-173).
import type { AskBreakdownRow, AskReading, AskSources } from "../law";
import { countFigure, isStruck, marksInOrder, objectRecord, objectUnder, placesFrom, NO_RECORDS } from "./common";
import { notMeasured, type AskQuery } from "./registry-law";

export const MARKS_QUERY: AskQuery = {
  intent: "MARKS",
  basis: "REGISTER",
  needs: ["members"],
  answer(reading: AskReading, sources: AskSources) {
    if (sources.campaign === null) return notMeasured(reading);
    const counted = sources.objects.filter((object) => !isStruck(object) && objectUnder(object, { ...reading, mark: null }));
    const records = counted.map((object) => objectRecord(object, sources));
    const rows: AskBreakdownRow[] = [];
    for (const mark of marksInOrder(counted.map((object) => object.mark))) {
      const bearing = records.filter((record) => record.mark === mark);
      const classes = [...new Set(bearing.map((record) => record.class))];
      rows.push({
        level: null,
        mark,
        class: classes.length === 1 ? (classes[0] as string) : null,
        count: bearing.length,
        figure: countFigure(bearing.length, placesFrom(bearing.map((record) => record.place))),
        partial: 0,
      });
    }
    const at = placesFrom(records.map((record) => record.place));
    return {
      statement: { intent: "MARKS", total: countFigure(counted.length, at), marks: rows },
      partial: null,
      places: at,
      records: { ...NO_RECORDS, objects: records },
      basis: "REGISTER",
    };
  },
};

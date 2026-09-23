// WHY_NOT_MEASURED (§1.2): "Why do the beams have no quantity?" — the PARTIAL lines under a class, a
// kind, a mark or a level, counted and grouped by each registered code they omit under (the screen says
// each code's registered message, never the code), and every registered object under the question
// with no line, counted and named by the reason its sighting was deferred or refused. Where neither
// holds, the facts say every line has its figure; where the campaign holds nothing under the question
// at all, nothing is measured for it — by name (I-399).
import type { AskReading, AskSources } from "../law";
import { lineRecord, linesUnder, objectRecord, objectsByKey, partialOf, placeOfLine, placesFrom, NO_RECORDS } from "./common";
import { notMeasured, type AskQuery } from "./registry-law";

export const WHY_NOT_MEASURED_QUERY: AskQuery = {
  intent: "WHY_NOT_MEASURED",
  basis: "REGISTER",
  needs: ["members"],
  answer(reading: AskReading, sources: AskSources) {
    if (sources.campaign === null) return notMeasured(reading);
    const byKey = objectsByKey(sources);
    const under = linesUnder(sources, reading, byKey);
    const { partial, partialLines, lineless } = partialOf(sources, reading, under);
    if (under.length === 0 && lineless.length === 0) return notMeasured(reading);
    const records = { ...NO_RECORDS, lines: partialLines.map((line) => lineRecord(line, byKey)), objects: lineless.map((object) => objectRecord(object, sources)) };
    return {
      statement: { intent: "WHY_NOT_MEASURED", lines: partialLines.length, complete: under.length - partialLines.length },
      partial,
      places: placesFrom([...partialLines.map(placeOfLine), ...records.objects.map((record) => record.place)]),
      records,
      basis: "REGISTER",
    };
  },
};

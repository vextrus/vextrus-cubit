// COUNT (§1.2): "How many C3 columns are on 5F?" — the registered objects of a class, a mark and a
// level, never one a person struck (I-173). The figure selects the members counted (I-404); where the
// members counted for one level are the members counted for others — a typical plan — the facts say
// so, naming the levels, rather than let the answer imply storey-specific entities.
import type { AskObject, AskReading, AskSources, AskTypical } from "../law";
import { countFigure, isStruck, levelsInOrder, objectRecord, objectUnder, placesFrom, viewOfPlacement, NO_RECORDS } from "./common";
import { notMeasured, type AskQuery } from "./registry-law";

/**
 * The typical plan the counted members were drawn on, where one stands for more than one level: the
 * same placements registered on several storeys are one member drawn once. Null where every member
 * counted stands on its own level's plan.
 */
function typicalOf(counted: readonly AskObject[], sources: AskSources): AskTypical | null {
  if (counted.length === 0) return null;
  const placements = new Set(counted.map((object) => object.sourceKey));
  const sharing = sources.objects.filter((object) => !isStruck(object) && placements.has(object.sourceKey));
  const levels = levelsInOrder(
    sharing.map((object) => object.level),
    sources.stack,
  );
  if (levels.length < 2) return null;
  const views = [...new Set(counted.map((object) => viewOfPlacement(object.sourceKey)).filter((view): view is string => view !== null))];
  return { views, levels, members: placements.size };
}

export const COUNT_QUERY: AskQuery = {
  intent: "COUNT",
  basis: "REGISTER",
  needs: ["members"],
  answer(reading: AskReading, sources: AskSources) {
    if (sources.campaign === null) return notMeasured(reading);
    const under = sources.objects.filter((object) => objectUnder(object, reading));
    const counted = under.filter((object) => !isStruck(object));
    const records = counted.map((object) => objectRecord(object, sources));
    const at = placesFrom(records.map((record) => record.place));
    return {
      statement: { intent: "COUNT", count: countFigure(counted.length, at), struck: under.length - counted.length, typical: typicalOf(counted, sources) },
      partial: null,
      places: at,
      records: { ...NO_RECORDS, objects: records },
      basis: "REGISTER",
    };
  },
};

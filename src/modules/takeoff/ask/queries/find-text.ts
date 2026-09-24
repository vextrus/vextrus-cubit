// FIND_TEXT (§1.2): "Where is the lift core shown?" · "Find TENSION 50d" — SRCH-1's text index over
// the pinned revision's sheets: whole words, case-insensitive, in order and adjacent inside one
// paragraph, one hit per (drawing, key). The count is a figure; each (drawing, layout) the hits stand
// on is a place with its own count, selecting every hit there. Nothing found is an ANSWER, never a
// refusal: the sheets were read and do not say it (I-676).
import type { AskFindPlace, AskPlace, AskReading, AskSources, AskTextHit } from "../law";
import { countFigure, NO_RECORDS } from "./common";
import { notMeasured, type AskQuery } from "./registry-law";

/**
 * The places a find's hits stand on, one per (drawing, layout) in the order first met — the set's
 * order, each drawing's sheets in its own — each selecting every hit there. A hit core's resolver
 * stands on no sheet is left out here and stands in the Rows with its key whole (I-404).
 */
export function findPlacesOf(hits: readonly AskTextHit[]): AskFindPlace[] {
  const held: { place: { drawingId: string; layoutName: string; sheetLabel: string | null; keys: string[] } }[] = [];
  for (const hit of hits) {
    if (hit.layoutName === null) continue;
    const same = held.find((one) => one.place.drawingId === hit.drawingId && one.place.layoutName === hit.layoutName);
    if (same === undefined) held.push({ place: { drawingId: hit.drawingId, layoutName: hit.layoutName, sheetLabel: hit.sheetLabel, keys: [hit.sourceKey] } });
    else if (!same.place.keys.includes(hit.sourceKey)) same.place.keys.push(hit.sourceKey);
  }
  return held.map(({ place }): AskFindPlace => {
    const stated: AskPlace = { ...place, keys: [...place.keys] };
    return { place: stated, count: countFigure(place.keys.length, [stated]) };
  });
}

export const FIND_TEXT_QUERY: AskQuery = {
  intent: "FIND_TEXT",
  basis: "TEXT",
  needs: ["texts"],
  answer(reading: AskReading, sources: AskSources) {
    if (sources.campaign === null) return notMeasured(reading);
    const text = reading.text ?? "";
    const hits = sources.findText(text);
    const places = findPlacesOf(hits);
    const at = places.map((one) => one.place);
    return {
      statement: { intent: "FIND_TEXT", text, count: countFigure(hits.length, at), places },
      partial: null,
      places: at,
      records: { ...NO_RECORDS, texts: hits },
      basis: "TEXT",
    };
  },
};

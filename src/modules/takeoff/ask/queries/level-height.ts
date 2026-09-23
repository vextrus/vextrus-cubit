// LEVEL_HEIGHT (§1.2): "What is the ground floor's floor-to-floor height?" — the storey height's
// STANDING, stated where the levels grid states it, to the millimetre (`HEIGHT_PLACES`, I-398), and
// each of its current readings as a FIGURE at the places it was written to with the unit it names
// (I-401): a storey-height reading is a height worked out between two level marks, never characters
// the drawing wrote, so it is never quoted — the mark it was read from stands beside it as its clause.
// F-RCC6-BNBC's GF reads `3.353 m` floor to floor, on two readings: `132 in` at 1D90 (`P.L= +0'-0"`)
// and `3.353 m` at 1D4C (`1F EL +3.353`) — one storey in two notations (D-001).
import { HEIGHT_PLACES } from "@/core/levels/law";
import { unitNamed } from "@/core/units/canon";
import type { AskHeight, AskLevel, AskReading, AskReadingRecord, AskSources } from "../law";
import { heldLevels } from "../grammar";
import { ASK_REFUSAL_CODES } from "../law";
import { vocabularyOf } from "../vocabulary";
import { clauseOf, figure, placesFrom, placesWritten, NO_RECORDS } from "./common";
import type { AskQuery } from "./registry-law";

/** The unit a height is stated in: the canon's metre. */
const METRE = "m";

/** One storey height, its standing figure and its readings. */
function heightOf(level: AskLevel, sources: AskSources): AskHeight {
  const readings: AskReadingRecord[] = level.height.current.map((one) => {
    const entity = one.sourceKey === null ? null : sources.entityAt(null, one.sourceKey);
    const place = one.sourceKey === null || entity === null || entity.layoutName === null ? null : { drawingId: entity.drawingId, layoutName: entity.layoutName, sheetLabel: entity.sheetLabel, keys: [one.sourceKey] };
    return {
      readingKey: one.readingKey,
      what: level.label,
      sourceKey: one.sourceKey,
      drawingId: entity?.drawingId ?? null,
      layoutName: entity?.layoutName ?? null,
      sheetLabel: entity?.sheetLabel ?? null,
      quote: null,
      figure: figure(one.valueAsWritten, unitNamed(one.unitAsWritten) ?? one.unitAsWritten, null, placesWritten(one.valueAsWritten), place === null ? [] : [place]),
      clause: clauseOf(entity?.text ?? null),
    };
  });
  const standing = level.height.canonicalMetres === null ? null : figure(level.height.canonicalMetres, METRE, null, HEIGHT_PLACES, placesFrom(readings.flatMap((one) => one.figure?.at ?? [])));
  return { level: level.label, standing: level.height.standing, figure: standing, readings };
}

export const LEVEL_HEIGHT_QUERY: AskQuery = {
  intent: "LEVEL_HEIGHT",
  basis: "LEVELS",
  needs: ["entities"],
  answer(reading: AskReading, sources: AskSources) {
    const stack = [...sources.stack].sort((left, right) => left.ordinal - right.ordinal);
    const levels = reading.level === null ? stack : stack.filter((level) => level.label === reading.level);
    if (levels.length === 0) return { outcome: "REFUSED", code: ASK_REFUSAL_CODES.subjectUnknown, reading, held: heldLevels(vocabularyOf(sources)) };
    const heights = levels.map((level) => heightOf(level, sources));
    const readings = heights.flatMap((height) => height.readings);
    return {
      statement: { intent: "LEVEL_HEIGHT", heights },
      partial: null,
      places: placesFrom(readings.flatMap((one) => one.figure?.at ?? [])),
      records: { ...NO_RECORDS, readings },
      basis: "LEVELS",
    };
  },
};

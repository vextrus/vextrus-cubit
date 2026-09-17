// A gesture nobody has finished is not a refused observation (R-UI-050, Q-07, L-MEA-05).
import { describe, expect, it } from "vitest";
import { observationOf } from "./two-point";
import type { SnapPick } from "@/modules/takeoff/viewer-snap/snap";

/** One pick as the snap region takes one: where it stands, and what it stands on. */
function pick(index: 1 | 2, sourceKey: string, at: [string, string]): SnapPick {
  return { index, point: [Number(at[0]), Number(at[1])], sourceKeys: sourceKey === "" ? [] : [sourceKey], keyPoint: at };
}

const ENTERED = { value: "5", unit: "m" } as const;
const FROM = pick(1, "S-102:e:7", ["0.0", "0.0"]);
const TO = pick(2, "S-102:e:9", ["100.0", "0.0"]);

describe("observationOf", () => {
  it("answers pending until both marks are taken", () => {
    expect(observationOf([], ENTERED), "a reader who has taken no mark has claimed nothing").toEqual({ pending: true });
    expect(observationOf([FROM], ENTERED), "and one mark is half a gesture, not a point standing on nothing").toEqual({ pending: true });
  });

  it("refuses a pick that cites nothing of the drawing", () => {
    expect(observationOf([pick(1, "", ["0.0", "0.0"]), TO], ENTERED), "a free click cites no entity, which is what the code says (L-MEA-05)").toEqual({
      refusal: "SCALE_OBSERVATION_UNCITED",
    });
  });

  it("reads two cited marks into the observation they make", () => {
    const answered = observationOf([FROM, TO], ENTERED);
    expect("observation" in answered && answered.observation.points.map((point) => point.sourceKey), "each point cites the entity its mark stood on").toEqual([
      "S-102:e:7",
      "S-102:e:9",
    ]);
    expect("observation" in answered && answered.observation.distanceBasis, "and the distance is the one a person entered (L-QTY-01)").toBe("ENTERED");
  });
});

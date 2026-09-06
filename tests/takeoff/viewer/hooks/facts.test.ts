/**
 * What a sheet knows about each of its source keys, gathered as the layers arrive (I-86): one key is
 * one atom, however many pieces are painted under it, and it spans all of them.
 *
 * The box a key covers is `recordBox`/`unionBox`'s own answer, never a box transcribed here (B-17,
 * B-19), so a change to how a record is measured is a change to both sides at once.
 */
import { describe, expect, test } from "vitest";
import { unionBox } from "../../../../src/modules/takeoff/viewer-inspector/selection";
import { recordBox } from "../../../../src/modules/takeoff/viewer/client";
import type { RenderRecord } from "../../../../src/modules/takeoff/viewer/types";
import { createSheetFacts, learn } from "../../../../src/modules/takeoff/viewer/hooks/facts";
import { layerOf, sourceKey } from "./hook-support";

const KEY = sourceKey("1A");

/** One drawn piece under a key: two ends, which is all a box is read from. */
function line(key: string | undefined, from: [number, number], to: [number, number], type = "LINE"): RenderRecord {
  return { key, type, rgb: [1, 2, 3], points: [from, to] };
}

describe("learn: one key, one atom, spanning every piece painted under it", () => {
  test("an arrived layer files each key with its type, its layer and the box the seam measures", () => {
    const facts = createSheetFacts();
    const record = line(KEY, [0, 0], [10, 20]);

    learn(facts, layerOf("GRID", [record]));

    expect(facts.get(KEY)?.type, "the record's own type").toBe("LINE");
    expect(facts.get(KEY)?.layer, "and the layer it arrived on").toBe("GRID");
    expect(facts.get(KEY)?.box, "and the box the seam measures for it").toEqual(recordBox(record));
  });

  test("a key that paints many pieces stays one atom, keeping the first type and spanning them all", () => {
    const facts = createSheetFacts();
    const first = line(KEY, [0, 0], [10, 10]);
    const second = line(KEY, [40, 60], [80, 90], "ARC");

    learn(facts, layerOf("GRID", [first, second]));

    expect(facts.size, "two pieces under one key are one thing a reader selected (I-86)").toBe(1);
    expect(facts.get(KEY)?.type, "which is what the first piece said it was").toBe("LINE");
    expect(facts.get(KEY)?.records, "with every piece kept, in the order they arrived").toEqual([first, second]);
    expect(facts.get(KEY)?.box, "over a box that reaches every one of them").toEqual(unionBox([recordBox(first) ?? { min: [0, 0], max: [0, 0] }, recordBox(second) ?? { min: [0, 0], max: [0, 0] }]));
  });

  test("a piece that names no key is painted but is nothing a reader can select", () => {
    const facts = createSheetFacts();

    learn(facts, layerOf("GRID", [line(undefined, [0, 0], [10, 10])]));

    expect(facts.size, "a record with no source key is not an atom of this sheet").toBe(0);
  });
});

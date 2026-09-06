/**
 * AC-4's algebra — the address is the whole state, so the module that reads and writes the `s`
 * parameter is judged on its own before any screen is (increment interfaces:
 * `src/modules/takeoff/viewer-inspector/selection.ts`).
 *
 * The keys are minted by the one fixture identity the viewer lane already declares
 * (`syntheticKey`, tests/takeoff/viewer/support/synthetic-graph.ts) rather than typed out here, so a
 * corpus whose keys are spelled differently is carried without an edit (B-19). The malformed values
 * are the shape errors the Design Decision names — a key that is not `DXF_HANDLE:HEX` at all.
 */
import { describe, expect, test } from "vitest";
import { syntheticKey } from "../viewer/support/synthetic-graph";
import { centreOf, selectionModule, type IndexBox } from "./support/inspector-support";

/** Three keys of the declared corpus shape, in an order the address must keep. */
const KEYS = [syntheticKey(3), syntheticKey(17), syntheticKey(129)];

/** Values that are not of the `DXF_HANDLE:HEX` shape at all (Decision I-88's `FOO:1` class). */
const MALFORMED = ["FOO:1", "DXF_HANDLE:", "DXF_HANDLE:ZZZ"];

/** A box the union is taken over — three of them, deliberately overlapping and out of order. */
const BOXES: IndexBox[] = [
  { min: [10, -4], max: [20, 6] },
  { min: [-30, 12], max: [-10, 40] },
  { min: [5, 5], max: [7, 7] },
];

describe("AC-4: the selection is read from and written to the address, in selection order", () => {
  test("AC-4: SELECTION_PARAM is the parameter the address carries the selection in", async () => {
    const selection = await selectionModule();
    expect(selection.SELECTION_PARAM, "the selection lives under `s` on the viewer's address (R-UI-031, test contract)").toBe("s");
  });

  test("AC-4: serialising then parsing answers exactly the keys given, in the order they were given", async () => {
    const selection = await selectionModule();
    const written = selection.serialiseSelection(KEYS);
    expect(written, "a selection of keys is written as the comma-joined keys, in selection order").toBe(KEYS.join(","));

    const read = selection.parseSelection(written);
    expect(read.keys, "and reading that address back answers the same keys in the same order").toEqual(KEYS);
    expect(read.malformed, "none of the corpus's own keys is malformed").toEqual([]);
  });

  test("AC-4: an empty selection is written as no parameter at all, and no parameter reads as no keys", async () => {
    const selection = await selectionModule();
    expect(selection.serialiseSelection([]), "`s` is absent at count 0 — an empty selection is not an empty parameter").toBeNull();

    const read = selection.parseSelection(null);
    expect({ keys: read.keys, malformed: read.malformed }, "an address carrying no `s` names no keys and refuses none").toStrictEqual({ keys: [], malformed: [] });
  });

  test("AC-4: a key named twice is held once, at its first occurrence", async () => {
    const selection = await selectionModule();
    const [first, second] = KEYS as [string, string];

    expect(selection.parseSelection([first, second, first].join(",")).keys, "duplicates collapse to their first occurrence (Decision §7)").toEqual([first, second]);
    expect(selection.serialiseSelection([first, second, first]), "and the address is written the same way, so one selection has one spelling").toBe([first, second].join(","));
  });

  test("AC-4: a key that is not of the source-key shape is separated out, and the keys that are stay", async () => {
    const selection = await selectionModule();
    const offered = [KEYS[0] as string, MALFORMED[0] as string, KEYS[1] as string, MALFORMED[1] as string, MALFORMED[2] as string];

    const read = selection.parseSelection(offered.join(","));
    expect(read.keys, "the well-formed keys are still read, in the order the address named them (R-UI-050's partial: shown, not hidden)").toEqual([KEYS[0], KEYS[1]]);
    expect(read.malformed, "and every value that is not `DXF_HANDLE:HEX` is named as one this sheet cannot hold").toEqual(MALFORMED);
  });
});

describe("AC-4: the union of the selected boxes is what a reveal is framed on", () => {
  test("AC-4: unionBox spans every box it is given, whatever order they arrive in", async () => {
    const selection = await selectionModule();
    const union = selection.unionBox(BOXES);
    expect(union, "boxes were given, so a union was answered").not.toBeNull();

    const expected: IndexBox = {
      min: [Math.min(...BOXES.map((box) => box.min[0])), Math.min(...BOXES.map((box) => box.min[1]))],
      max: [Math.max(...BOXES.map((box) => box.max[0])), Math.max(...BOXES.map((box) => box.max[1]))],
    };
    expect({ min: [...(union as IndexBox).min], max: [...(union as IndexBox).max] }, "the union is the least box holding every box given").toStrictEqual(expected);
    expect(centreOf(union as IndexBox), "so its centre is the centre a reveal flies to").toStrictEqual(centreOf(expected));
  });

  test("AC-4: one box unions to itself, and no box unions to nothing", async () => {
    const selection = await selectionModule();
    const only = BOXES[1] as IndexBox;

    const single = selection.unionBox([only]);
    expect({ min: [...(single as IndexBox).min], max: [...(single as IndexBox).max] }, "a selection of one is framed on its own box").toStrictEqual({ min: only.min, max: only.max });
    expect(selection.unionBox([]), "nothing selected has no box — a reveal has nowhere to go, and says so").toBeNull();
  });
});

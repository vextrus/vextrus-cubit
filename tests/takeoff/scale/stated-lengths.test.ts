/**
 * I-295 — what a dimension's measurement text states in a unit the text itself names, as the takeoff
 * door reads it for L-MEA-05's engine (T-INSUNITS-0).
 *
 * The reading crosses the seam already parsed: the feet-and-inches grammar is this module's one home
 * (`partition/notation`) and core may not reach a module (ARCH-01), so `statedLengthsOf` is where the
 * engine's question meets the drawing's own words. What it must get right is what the grammar says —
 * a length in a unit the text names, in metres — and what it must refuse: a bare number, which names
 * no unit at all, and a dimension carrying two lengths, which names no one length.
 *
 * Pure: a handmade artifact, no store, no drawing on disk.
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { statedLengthReader } from "@/core/scale/evidence";
import { statedLengthsOf } from "@/modules/takeoff/scale";

/** The colour every record of this graph carries — a fact about paint, and the same for all of them. */
const COLOUR = { rgb: [0, 0, 0] as [number, number, number], source: "LAYER" };

/** One dimension of the drawing: its key, and the measurement texts its paint carries. */
type Drawn = { readonly key: string; readonly type: string; readonly texts: readonly string[] };

/** A graph of the given originals, each text arriving as a derived record naming its parent (L-CAD-03). */
function graphOf(drawn: readonly Drawn[]): EntityGraph {
  return {
    entities: drawn.map((entity) => ({ key: entity.key, type: entity.type, space: "Model", layer: "DIM", colour: COLOUR })),
    derived: drawn.flatMap((entity) =>
      entity.texts.map((text) => ({ src: entity.key, type: "MTEXT", space: "Model", layer: "DIM", colour: COLOUR, text, height: 2.5, points: [[0, 0] as [number, number]] })),
    ),
  } as unknown as EntityGraph;
}

describe("the lengths a drawing's dimension texts state in their own units", () => {
  test("feet and inches state metres, exactly 25.4 millimetres to the inch", () => {
    const stated = statedLengthsOf(graphOf([{ key: "DXF_HANDLE:2A0", type: "DIMENSION", texts: [`15'-0"`] }, { key: "DXF_HANDLE:2A1", type: "DIMENSION", texts: [`9'-0"`] }, { key: "DXF_HANDLE:2A2", type: "DIMENSION", texts: [`4572"`] }]));

    expect(stated.get("DXF_HANDLE:2A0"), "fifteen feet is 4.572 metres, and the words it was read from ride with it").toEqual({ text: `15'-0"`, metres: "4.572" });
    expect(stated.get("DXF_HANDLE:2A1")?.metres, "nine feet is 2.7432 metres").toBe("2.7432");
    expect(stated.get("DXF_HANDLE:2A2")?.metres, "and a length written in inches alone states its unit just as plainly").toBe("116.1288");
  });

  test("a bare number states no unit, so this reads nothing from it", () => {
    const stated = statedLengthsOf(graphOf([{ key: "DXF_HANDLE:2A0", type: "DIMENSION", texts: ["4572"] }, { key: "DXF_HANDLE:2A1", type: "DIMENSION", texts: ["450.5"] }]));

    expect([...stated.keys()], "4572 of something unnamed is a number; the header is what carries a number into metres, not this").toEqual([]);
  });

  test("a dimension carrying two lengths states no one length, and a text on anything else is not a dimension's", () => {
    const stated = statedLengthsOf(
      graphOf([
        { key: "DXF_HANDLE:2A0", type: "DIMENSION", texts: [`15'-0"`, `9'-0"`] },
        { key: "DXF_HANDLE:2A1", type: "DIMENSION", texts: [`15'-0"`, "SEE PLAN"] },
        { key: "DXF_HANDLE:2A2", type: "MTEXT", texts: [`15'-0"`] },
      ]),
    );

    expect(stated.has("DXF_HANDLE:2A0"), "which of two lengths the draughtsman measured by is not this function's to decide").toBe(false);
    expect(stated.get("DXF_HANDLE:2A1")?.metres, "but words that state no length at all leave the one that does standing").toBe("4.572");
    expect(stated.has("DXF_HANDLE:2A2"), "a note reading like a length is not a dimension's measurement text (L-CAD-03)").toBe(false);
  });

  /**
   * I-295b — and the act seam reads the same words. AFFIRM_SCALE is rendered in core, gathers its own
   * evidence inside the transaction it writes in, and may not reach this module for the grammar
   * (ARCH-01); so this module hands its reading down at its own import, and core's gatherer answers a
   * caller that brought none with it. Were it otherwise, the panel would offer a rank on a unitless
   * header that the act behind it refused SCALE_UNIT_UNMAPPED.
   */
  test("the reading crosses to core once, at this module's import, so the act seam derives over the same evidence the door does", () => {
    expect(statedLengthReader(), "core's gatherer answers a caller that brought no reader with the takeoff module's own — one function, not a second spelling of it (B-17)").toBe(
      statedLengthsOf,
    );
  });
});

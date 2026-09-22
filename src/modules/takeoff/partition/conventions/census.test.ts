// What the census counts a drawn thing AS (L-CAD-08's geometry statistics, L-CAD-03's atoms).
//
// The whole question this suite grades is where a kind is read from: an entity whose own record
// answers is read from that record, and an entity whose record answers nothing — a block instance,
// which carries no text, no closing flag and no points — is read from the paint it came out of. The
// drawing that draws its grid bubbles as blocks says exactly as much about its own conventions as
// the drawing that draws them as circles, and a census that declined to read the second would leave
// that layer at four zeroes and out of every role (L-QTY-04).
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { censusOf, type CensusView } from "./census";

const MODEL_SPACE = "Model";
const PAPER_SPACE = "S-13";
const LAYER = "Grid Circle";
const ELSEWHERE = "0";

const CHANNELS = { rgb: [0, 0, 0], source: "bylayer" };

/** An artifact of these originals and this paint, with one model layout and one paper layout. */
function graphOf(entities: readonly Record<string, unknown>[], derived: readonly Record<string, unknown>[] = []): EntityGraph {
  return {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "hand", tool_version: "1", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: null, strays_rejected: 0 },
      { name: PAPER_SPACE, kind: "paper", bbox: null, strays_rejected: 0 },
    ],
    dropped_layouts: [],
    entities,
    derived,
    block_attributes: [],
    counters: [],
  } as unknown as EntityGraph;
}

/** A block instance: an original that carries no geometry of its own (L-CAD-03). */
function instance(key: string, layer: string = LAYER, space: string = MODEL_SPACE): Record<string, unknown> {
  return { key, type: "INSERT", space, layer, colour: CHANNELS };
}

/** One piece of paint, carried by the original it came out of. */
function painted(src: string, record: Record<string, unknown>, layer: string = LAYER): Record<string, unknown> {
  return { src, space: MODEL_SPACE, layer, colour: CHANNELS, ...record };
}

/** The tallies of one layer, or nulls where the census never met it. */
function tallyOf(graph: EntityGraph, layer: string, views: readonly CensusView[] = []): Record<string, number> | null {
  const row = censusOf(graph, views)?.layers.find((one) => one.layer === layer);
  return row === undefined || row === null ? null : { paths: row.paths, rings: row.rings, texts: row.texts, dimensions: row.dimensions };
}

describe("L-CAD-03: an entity whose own record says nothing is counted as what it DREW", () => {
  test("an instance whose paint holds a closed ring is a ring on the layer the instance stands on", () => {
    const graph = graphOf(
      [instance("i:1"), instance("i:2")],
      [
        // The paint of a block is drawn on layers of the block's own — the instance is what the
        // drawing put on `Grid Circle`, and the tally is against the instance.
        painted("i:1", { type: "CIRCLE", points: [[0, 0]], closed: true, area: 1 }, ELSEWHERE),
        painted("i:2", { type: "CIRCLE", points: [[9, 0]], closed: true, area: 1 }, ELSEWHERE),
      ],
    );

    expect(tallyOf(graph, LAYER), "two block-drawn bubbles are two rings on their own layer, not a layer nothing was drawn on").toEqual({
      paths: 0,
      rings: 2,
      texts: 0,
      dimensions: 0,
    });
    expect(tallyOf(graph, ELSEWHERE), "the paint is carried by the entity it came out of, so counting it under its own layer would tally one drawn thing twice").toBeNull();
  });

  test("paint that holds no closed figure is read down the same order: a text, else a path", () => {
    const graph = graphOf(
      [instance("t:1"), instance("p:1")],
      [
        painted("t:1", { type: "TEXT", text: "C1", height: 2, points: [[0, 0]] }),
        painted("p:1", { type: "LINE", points: [[0, 0], [10, 0]] }),
      ],
    );

    expect(tallyOf(graph, LAYER), "a block that paints lettering is text on its layer; one that paints only open geometry is linework").toEqual({
      paths: 1,
      rings: 0,
      texts: 1,
      dimensions: 0,
    });
  });

  test("a block that paints an outline AND annotates it is an outline", () => {
    const graph = graphOf(
      [instance("i:1")],
      [painted("i:1", { type: "CIRCLE", points: [[0, 0]], closed: true, area: 1 }), painted("i:1", { type: "TEXT", text: "A", height: 2, points: [[0, 0]] })],
    );

    expect(tallyOf(graph, LAYER), "many records rather than one: the closed figure is what the block put on the layer, and its lettering annotates that figure").toEqual({
      paths: 0,
      rings: 1,
      texts: 0,
      dimensions: 0,
    });
  });

  test("an instance that painted nothing is counted as nothing, and its layer stands at four zeroes", () => {
    const graph = graphOf([instance("i:1")]);

    expect(tallyOf(graph, LAYER), "a layer of zero tallies is the drawing saying it carries no role — a reading, not a guess").toEqual({
      paths: 0,
      rings: 0,
      texts: 0,
      dimensions: 0,
    });
  });
});

describe("L-CAD-08: an entity whose own record answers is never re-read off its paint", () => {
  test("a dimension that exploded into lines and a text is still one dimension", () => {
    const graph = graphOf(
      [{ key: "d:1", type: "DIMENSION", space: MODEL_SPACE, layer: LAYER, colour: CHANNELS, points: [[0, 0], [10, 0]] }],
      [painted("d:1", { type: "LINE", points: [[0, 0], [10, 0]] }), painted("d:1", { type: "MTEXT", text: "3000", height: 2, points: [[5, 1]] })],
    );

    expect(tallyOf(graph, LAYER), "reading the paint first would tally one dimension as linework and lose the dimensions role the drawing plainly carries").toEqual({
      paths: 0,
      rings: 0,
      texts: 0,
      dimensions: 1,
    });
  });

  test("an original ring whose paint says otherwise is still a ring", () => {
    const graph = graphOf(
      [{ key: "r:1", type: "LWPOLYLINE", space: MODEL_SPACE, layer: LAYER, colour: CHANNELS, points: [[0, 0], [1, 0], [1, 1]], closed: true, area: 1 }],
      [painted("r:1", { type: "TEXT", text: "A", height: 2, points: [[0, 0]] })],
    );

    expect(tallyOf(graph, LAYER), "the atom is the original, and the original said what it is").toEqual({ paths: 0, rings: 1, texts: 0, dimensions: 0 });
  });

  test("a block instance standing on a paper layout is no part of the drawing's conventions", () => {
    const graph = graphOf(
      [instance("i:1", LAYER, PAPER_SPACE)],
      [painted("i:1", { type: "CIRCLE", space: PAPER_SPACE, points: [[0, 0]], closed: true, area: 1 })],
    );

    expect(tallyOf(graph, LAYER), "a sheet's own furniture is the sheet's, and L-CAD-06 partitions model space").toBeNull();
  });
});

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
import { resolve } from "@/core/rulesets/methods/conventions/resolve";
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

/** One text of the drawing, said where the drawing said it. */
function said(key: string, text: string, space: string = MODEL_SPACE): Record<string, unknown> {
  return { key, type: "MTEXT", space, layer: LAYER, colour: CHANNELS, text, height: 3, points: [[0, 0]] };
}

/** The declared unit the census counts and the method beside it resolves — the whole reading (I-302). */
function declaredIn(graph: EntityGraph): { unit: string; sourceKey: string } | null {
  const census = censusOf(graph, []);
  return census === null ? null : (resolve(census).dimensionUnit ?? null);
}

describe("I-302: the unit the drawing DECLARES its dimensions in", () => {
  /** F-RCC6-BNBC's S-01, clause 4 and clause 5, as its general-notes MTEXT really carries them. */
  const GENERAL_NOTES =
    "{\\fSwis721 Cn BT|b1|i0|c0|p34;\\LGENERAL NOTES}\\P" +
    "\\A1;1. THESE DRAWINGS SHALL BE READ WITH THE ARCHITECTURAL AND MEP DRAWINGS.\\P" +
    "4. ALL DIMENSIONS ARE IN MILLIMETRES UNLESS FIGURED IN FEET AND INCHES. LEVELS ARE IN METRES ABOVE P.L.\\P" +
    "5. {\\LDO NOT SCALE THIS DRAWING} - FIGURED DIMENSIONS GOVERN.\\P";

  test("the general-notes clause declares millimetres, and the exception it states is not a second declaration", () => {
    expect(
      declaredIn(graphOf([said("n:1", GENERAL_NOTES)])),
      "the clause is read out of the MTEXT paragraph it stands in; `UNLESS FIGURED IN FEET AND INCHES` is that clause's own exception, and a reading that took it would measure a 400 mm column in inches",
    ).toEqual({ unit: "mm", sourceKey: "n:1" });
  });

  test("`LEVELS ARE IN METRES` standing in the same sentence declares nothing about a section", () => {
    expect(
      declaredIn(graphOf([said("n:1", "LEVELS ARE IN METRES ABOVE P.L.")])),
      "only the clause that speaks of the DIMENSIONS declares the unit a size is figured in — a level is not a section (L-MEA-05)",
    ).toBeNull();
  });

  test("a declaration standing on a PAPER sheet is the drawing speaking about itself", () => {
    expect(
      declaredIn(graphOf([said("n:1", GENERAL_NOTES, PAPER_SPACE)])),
      "every office prints its general notes on a notes sheet — F-RCC6-BNBC's stands on `S-01 GENERAL NOTES (1 OF 2)`. A layer's ROLE is a fact about what model space was drawn with; a note is the drawing's own word about the whole of it, and reading model space alone would make a drawing that declares its unit where a drawing declares it a drawing that declares none",
    ).toEqual({ unit: "mm", sourceKey: "n:1" });
  });

  test("two texts declaring the same unit are one declaration, cited at the first of them in code-point order", () => {
    expect(
      declaredIn(graphOf([said("n:9", "ALL DIMENSIONS ARE IN MM"), said("n:1", "ALL DIMENSIONS IN MILLIMETRES")])),
      "the copula is the draughtsman's style and `MM` his shorthand; the same sheet note printed twice has said one thing, and the citation is the same however the artifact's entities were ordered (L-REG-04)",
    ).toEqual({ unit: "mm", sourceKey: "n:1" });
  });

  test("two texts declaring DIFFERENT units leave the drawing with no declared unit at all", () => {
    expect(
      declaredIn(graphOf([said("n:1", "ALL DIMENSIONS ARE IN MILLIMETRES"), said("n:2", "ALL DIMENSIONS ARE IN INCHES")])),
      "a disagreement is not a reading, and a section measured off the wrong one of the two is wrong by a factor of twenty-five (L-QTY-04)",
    ).toBeNull();
  });

  test("a header that merely names a unit is the COLUMN's word and not the drawing's", () => {
    expect(
      declaredIn(graphOf([said("h:1", "X (mm)"), said("h:2", "DIA (mm)"), said("h:3", "SPAN (mm)")])),
      "`DIA (mm)` states the unit of the bar diameters beneath it and says nothing about how a column schedule two sheets away figures its sections; the head of a column is read where a section is read under it (`sectionUnitOfHeader`), and promoting it to the whole drawing's convention would let a rebar table state a column's unit (L-MEA-05)",
    ).toBeNull();
  });

  /** The title panel every sheet of F-RCC6-BNBC prints, as the paint of the sheet's title-block INSERT. */
  const TITLE_PANEL = "ALL DIMENSIONS IN mm U.N.O.";

  test("where no original declares a unit, the title panel's paint does, cited at the INSERT that draws it (I-669)", () => {
    // The DWG minted from the DXF carries S-01's general notes truncated to their last clause, so no
    // original declares anything, and a fresh upload read every column section unitless (walk-2 BD-3).
    expect(
      declaredIn(graphOf([instance("tb:2", LAYER, PAPER_SPACE), instance("tb:1", LAYER, PAPER_SPACE), said("n:1", "5. DO NOT SCALE THIS DRAWING - FIGURED DIMENSIONS GOVERN.")], [painted("tb:2", { type: "TEXT", text: TITLE_PANEL }), painted("tb:1", { type: "TEXT", text: TITLE_PANEL })])),
      "the title panel is the drawing speaking about itself on every sheet, as a general note is — and it is cited by the entity a reader can select (L-QTY-03)",
    ).toEqual({ unit: "mm", sourceKey: "tb:1" });
  });

  test("an original that declares a unit is the last word: the paint is never asked beside it", () => {
    expect(
      declaredIn(graphOf([said("n:1", "ALL DIMENSIONS ARE IN MILLIMETRES"), instance("tb:1", LAYER, PAPER_SPACE)], [painted("tb:1", { type: "TEXT", text: "ALL DIMENSIONS ARE IN INCHES" })])),
      "a drawing whose notes declare its unit reads exactly as it did — the panel's word is asked only where the originals are silent (L-CAD-08)",
    ).toEqual({ unit: "mm", sourceKey: "n:1" });
  });

  test("paint declaring two different units is no convention either", () => {
    expect(
      declaredIn(graphOf([instance("tb:1", LAYER, PAPER_SPACE), instance("tb:2", LAYER, PAPER_SPACE)], [painted("tb:1", { type: "TEXT", text: TITLE_PANEL }), painted("tb:2", { type: "TEXT", text: "ALL DIMENSIONS ARE IN INCHES" })])),
      "a disagreement is not a reading, whether the originals or the paint state it (L-QTY-04)",
    ).toBeNull();
  });

  test("a unit outside the roster a section may be measured in declares nothing", () => {
    expect(
      declaredIn(graphOf([said("n:1", "ALL DIMENSIONS ARE IN METRES")])),
      "the roster is the store's own (`SECTION_UNITS`); a drawing figured in metres is a drawing this product cannot state a section for, and it is left unitless for the rail to refuse by name rather than measured in a unit nobody can store (L-QTY-04)",
    ).toBeNull();
  });
});

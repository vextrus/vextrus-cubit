/**
 * viewer.md Part 6 — the quantity overlay's pure half: one placement's lines read into its figures,
 * a sheet's placements read into a legend keyed by condition, and the placements mapped through the
 * sheet's own camera into what the third canvas paints.
 *
 * Every figure here is recomputed from the lines the case states, with decimal.js — the exact sum
 * is what the legend's `data-value` must carry (B-07), and a PARTIAL line is never in it (L-QTY-07).
 * Every screen quantity is judged by mapping it back through the viewer's own `worldAt` (B-17).
 */
import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";
import { createCamera, worldAt } from "../../../src/modules/takeoff/viewer/client";
import { chestCondition, classCondition, figuresOf, legendOf, quantityCounts, quantityScene, type PlacementLine } from "../../../src/modules/takeoff/viewer-quantity-overlay/scene";
import type { QuantityOverlay, QuantityPlacement } from "../../../src/modules/takeoff/viewer-quantity-overlay/types";
import { ELEMENT_TYPES } from "../../../src/core/catalogue/classes";
import { CONDITION_COLOURS, CONDITION_HATCHES } from "../../../src/core/manual/law";

const CONCRETE = "rcc.concrete" as const;
const FORMWORK = "rcc.formwork" as const;

function line(over: Partial<PlacementLine>): PlacementLine {
  return { kind: CONCRETE, coverage: "COMPLETE", value: "1.000000", unit: "m3", quantityBasis: "MEASURED", omitted: [], ...over };
}

/** A placement of the given condition, with the figures its lines amount to. */
function placement(key: string, klass: "column" | "beam", lines: readonly PlacementLine[], box: QuantityPlacement["box"] = { min: [0, 0], max: [1, 1] }): QuantityPlacement {
  return { key, source: "rail", class: klass, mark: key, condition: classCondition(klass), keys: [`${key}:outline`], box, rings: [], ...figuresOf(lines) };
}

describe("one placement's figures", () => {
  test("COMPLETE lines add exactly per kind; a PARTIAL line is never added and is stated with what it omitted", () => {
    const lines = [
      line({ value: "0.4515" }),
      line({ value: "0.4515" }),
      line({ value: "0.000001" }),
      line({ kind: FORMWORK, unit: "m2", value: "3.3" }),
      line({ kind: FORMWORK, coverage: "PARTIAL_DECLARED", value: null, unit: "m2", omitted: [{ variable: "t_slab", code: "SLAB_THICKNESS_UNSTATED" }] }),
    ];
    const figures = figuresOf(lines);
    const concrete = figures.sums.find((sum) => sum.kind === CONCRETE);
    expect(concrete?.value, "the exact sum of the concrete lines, not a float's").toBe(new Decimal("0.4515").plus("0.4515").plus("0.000001").toFixed());
    expect(concrete?.lines).toBe(3);
    expect(figures.sums.find((sum) => sum.kind === FORMWORK)?.value, "the partial formwork line is not in the formwork sum").toBe("3.3");
    expect(figures.unmeasured).toEqual([{ kind: FORMWORK, codes: ["SLAB_THICKNESS_UNSTATED"], variables: ["t_slab"] }]);
  });

  test("the basis is the weakest of the COMPLETE lines (L-QTY-01), and null where nothing was measured", () => {
    expect(figuresOf([line({ quantityBasis: "MEASURED" }), line({ quantityBasis: "DERIVED" })]).basis).toBe("DERIVED");
    expect(figuresOf([line({ coverage: "PARTIAL_DECLARED", value: null, quantityBasis: "MEASURED" })]).basis).toBeNull();
  });

  test("a queue item is a kind seen and not billed, by its registered cause", () => {
    const figures = figuresOf([], [{ kind: CONCRETE, cause: "INTERPRETED_UNCORROBORATED" }]);
    expect(figures.sums).toEqual([]);
    expect(figures.unmeasured).toEqual([{ kind: CONCRETE, codes: ["INTERPRETED_UNCORROBORATED"], variables: [] }]);
  });
});

describe("conditions (I-634)", () => {
  test("every rail class is read as a condition, in a chest colour and a chest hatch", () => {
    const worn = new Set<string>();
    for (const klass of ELEMENT_TYPES) {
      const condition = classCondition(klass);
      expect(CONDITION_COLOURS, `${klass} wears a chest colour`).toContain(condition.colour);
      expect(CONDITION_HATCHES, `${klass} wears a chest hatch`).toContain(condition.hatch);
      expect(condition.key).toBe(`class:${klass}`);
      worn.add(`${condition.colour}/${condition.hatch}`);
    }
    expect(worn.size, "no two classes wear the same colour AND hatch — colour is never the only channel (R-UI-060)").toBe(ELEMENT_TYPES.length);
  });

  test("a hand measurement stands under its chest condition, by name; one gone from the chest wears the generic colour", () => {
    expect(chestCondition({ name: "Plaster 12", class: "surface", colour: "wall", hatch: "dots" })).toMatchObject({ key: "condition:Plaster 12", source: "manual", colour: "wall", hatch: "dots" });
    expect(chestCondition({ name: "Old", class: "slab", colour: null, hatch: null })).toMatchObject({ colour: "generic", hatch: "solid" });
  });
});

describe("the legend (R-TO-044), keyed by condition", () => {
  const columns = [
    placement("C1", "column", [line({ value: "0.5" }), line({ value: "0.25" })]),
    placement("C2", "column", [line({ value: "0.125" })]),
  ];
  const beam = placement("B1", "beam", [line({ coverage: "PARTIAL_DECLARED", value: null, omitted: [{ variable: "depth", code: "BEAM_DEPTH_UNSTATED" }] })]);
  const overlay: QuantityOverlay = { campaignId: "c", placements: [...columns, beam], elsewhere: [] };

  test("a condition's row counts its measured placements and states each kind's exact measured-scope sum", () => {
    const legend = legendOf(overlay, { quantities: true, unmeasured: false });
    const column = legend.rows.find((row) => row.condition.key === "class:column");
    expect(column?.measured).toBe(2);
    expect(column?.totals).toEqual([{ kind: CONCRETE, unit: "m3", value: new Decimal("0.5").plus("0.25").plus("0.125").toFixed(), lines: 3 }]);
    expect(legend.rows.map((row) => row.condition.key), "with the unmeasured hidden, a condition nothing measured has no row").toEqual(["class:column"]);
    expect(legend.bases).toEqual(["MEASURED"]);
  });

  test("with the unmeasured shown, the beams stand with their count and reason, and no total", () => {
    const legend = legendOf(overlay, { quantities: true, unmeasured: true });
    const beams = legend.rows.find((row) => row.condition.key === "class:beam");
    expect(beams).toMatchObject({ measured: 0, totals: [], unmeasured: 1, codes: ["BEAM_DEPTH_UNSTATED"], variables: ["depth"] });
  });
});

describe("the scene", () => {
  const VIEWPORT = { width: 1000, height: 800 };
  const camera = createCamera({ min: [0, 0], max: [100, 80] }, VIEWPORT);
  const measured = placement("C1", "column", [line({})], { min: [10, 10], max: [20, 30] });
  const partial = placement("B1", "beam", [line({ coverage: "PARTIAL_DECLARED", value: null })], { min: [40, 40], max: [60, 45] });
  const overlay: QuantityOverlay = { campaignId: "c", placements: [measured, partial], elsewhere: [] };

  test("the switch off paints nothing", () => {
    expect(quantityScene(overlay, { quantities: false, unmeasured: true }, camera).fills).toEqual([]);
  });

  test("a measured placement is filled at its own box, in its condition, wearing its basis", () => {
    const scene = quantityScene(overlay, { quantities: true, unmeasured: false }, camera);
    expect(scene.fills.map((fill) => fill.key), "the partial beam is not painted while the unmeasured are hidden").toEqual(["C1"]);
    const fill = scene.fills[0];
    const corners = [worldAt(camera, { x: fill?.rect.x ?? 0, y: (fill?.rect.y ?? 0) + (fill?.rect.height ?? 0) }), worldAt(camera, { x: (fill?.rect.x ?? 0) + (fill?.rect.width ?? 0), y: fill?.rect.y ?? 0 })];
    expect(corners[0]?.[0]).toBeCloseTo(10, 6);
    expect(corners[0]?.[1]).toBeCloseTo(10, 6);
    expect(corners[1]?.[0]).toBeCloseTo(20, 6);
    expect(corners[1]?.[1]).toBeCloseTo(30, 6);
    expect(fill).toMatchObject({ colour: "column", hatch: "solid", basis: "MEASURED", unmeasured: false });
  });

  test("the unmeasured are hatched, never filled, and counted apart", () => {
    const scene = quantityScene(overlay, { quantities: true, unmeasured: true }, camera);
    expect(scene.fills.find((fill) => fill.key === "B1")).toMatchObject({ basis: null, unmeasured: true });
    expect(quantityCounts(scene)).toEqual({ filled: 1, hatched: 1 });
  });
});

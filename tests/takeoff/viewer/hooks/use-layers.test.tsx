// @vitest-environment jsdom
/**
 * The layers' posture as a hook (R-TO-010, Decision § 1): the rows a head publishes, what hiding,
 * isolating and locking do to them, and a layer whose geometry never arrived staying marked across
 * the posture a new head rebuilds (I-81).
 *
 * Every expectation is taken from the roster this file states rather than from a count written out
 * beside it (B-19), and the posture is read through the hook's own rows, so a change to what a row
 * means is a change to both sides at once.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { productModule } from "../support/viewer-support";

/** The module AC-2 names for this concern. */
const USE_LAYERS_MODULE = "src/modules/takeoff/viewer/hooks/use-layers.ts";

/** The sheet the posture is read off: three layers, so isolation has something to leave out. */
const ROSTER = [
  { name: "GRID", rgb: [11, 22, 33], entityCount: 3 },
  { name: "WALLS", rgb: [44, 55, 66], entityCount: 5 },
  { name: "TEXT", rgb: [77, 88, 99], entityCount: 2 },
] as const;

/** Which layer of the roster each reading acts on. */
const ACTED_ON = 1;

type LayerRow = { name: string; visible: boolean; drawn: boolean; locked: boolean; isolated: boolean; failed: boolean; entityCount: number };
type LayersHook = {
  useLayers: (options: { head: unknown }) => {
    rows: LayerRow[];
    revision: number;
    failedCount: number;
    drawnLayers: string;
    openLayers: () => string[];
    shutLayers: (takeable: boolean) => string[];
    markFailed: (name: string, failed: boolean) => void;
    setVisible: (name: string, visible: boolean) => void;
    isolate: (name: string) => void;
    lock: (name: string, locked: boolean) => void;
    state: { entityCount: () => number; drawnEntityCount: () => number };
  };
};

/** A head carrying this roster — a fresh object each time, so "a new head" is one. */
function head(): unknown {
  return {
    kind: "manifest",
    cache: "miss",
    facts: {},
    manifest: {
      version: 1,
      layoutName: "SHEET ONE",
      extents: { min: [0, 0], max: [400, 200] },
      insunits: { code: 0, unit: null, unmapped: true },
      digest: "sheet-one",
      layers: ROSTER.map((layer) => ({ name: layer.name, rgb: [...layer.rgb], entityCount: layer.entityCount, records: [] })),
    },
  };
}

/** The layer each reading acts on, by name. */
const acted = (ROSTER[ACTED_ON] as (typeof ROSTER)[number]).name;

async function mount() {
  const { useLayers } = await productModule<LayersHook>(USE_LAYERS_MODULE);
  return renderHook(({ given }: { given: unknown }) => useLayers({ head: given }), { initialProps: { given: head() } });
}

afterEach(() => {
  cleanup();
});

describe("the layers' posture", () => {
  test("the rows are the head's own roster, all of them drawn and none of them failed", async () => {
    const { result } = await mount();

    expect(
      result.current.rows.map((row) => [row.name, row.entityCount]),
      "every layer the head published is a row, in the roster's order",
    ).toEqual(ROSTER.map((layer) => [layer.name, layer.entityCount]));
    expect(result.current.drawnLayers.split("\n"), "a sheet nobody has touched is drawn whole").toEqual(ROSTER.map((layer) => layer.name));
    expect(result.current.openLayers(), "and every layer of it may be taken from").toEqual(ROSTER.map((layer) => layer.name));
    expect(result.current.shutLayers(true), "with nothing shut out of a question").toEqual([]);
    expect(result.current.state.entityCount(), "the sheet counts what its roster says it holds").toBe(
      ROSTER.reduce((total, layer) => total + layer.entityCount, 0),
    );
  });

  test("hiding a layer stops it being drawn, and isolating one leaves the rest standing but unpainted", async () => {
    const { result } = await mount();

    act(() => result.current.setVisible(acted, false));
    expect(result.current.rows.find((row) => row.name === acted)?.drawn, "a hidden layer is not painted").toBe(false);
    expect(result.current.drawnLayers.split("\n"), "and is not among the drawn").toEqual(ROSTER.filter((layer) => layer.name !== acted).map((layer) => layer.name));

    act(() => result.current.setVisible(acted, true));
    act(() => result.current.isolate(acted));
    expect(
      result.current.rows.filter((row) => row.drawn).map((row) => row.name),
      "an isolation paints one layer and leaves every other row where it was",
    ).toEqual([acted]);
    expect(result.current.rows, "the rows themselves are not taken away by an isolation").toHaveLength(ROSTER.length);

    act(() => result.current.isolate(acted));
    expect(result.current.rows.filter((row) => row.drawn), "isolating the isolated layer lets the sheet back").toHaveLength(ROSTER.length);
  });

  test("a locked layer is painted and out of a taking, and answers a question that takes nothing", async () => {
    const { result } = await mount();

    act(() => result.current.lock(acted, true));
    expect(result.current.rows.find((row) => row.name === acted)?.drawn, "a locked layer is still painted").toBe(true);
    expect(result.current.openLayers(), "but a rectangle may not take from it").not.toContain(acted);
    expect(result.current.shutLayers(true), "and a click is told so").toContain(acted);
    expect(result.current.shutLayers(false), "while a question that takes nothing may still read it").not.toContain(acted);
  });

  test("a layer that never arrived stays marked across the posture a new head rebuilds", async () => {
    const { result, rerender } = await mount();

    act(() => result.current.markFailed(acted, true));
    expect(result.current.rows.find((row) => row.name === acted)?.failed, "the row says the geometry is missing").toBe(true);
    expect(result.current.failedCount, "and the sheet knows one layer short of settled").toBe(1);

    const before = result.current.revision;
    rerender({ given: head() });
    expect(result.current.rows.find((row) => row.name === acted)?.failed, "a rebuilt posture does not forget it (I-81)").toBe(true);

    act(() => result.current.markFailed(acted, false));
    expect(result.current.rows.find((row) => row.name === acted)?.failed, "and a layer that arrives after all stops saying so").toBe(false);
    expect(result.current.failedCount, "with nothing left short").toBe(0);
    expect(result.current.revision, "every posture change is one the panel can be keyed on").toBeGreaterThan(before);
  });
});

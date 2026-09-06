// @vitest-environment jsdom
/**
 * What is held on a sheet (R-UI-031, R-UI-050, I-86, I-88): the facts a layer's arrival teaches, the
 * keys a reader takes, the reading of the address's own `s`, and the partial cell a link that named
 * keys this sheet does not hold is answered with.
 *
 * The box a selected key spans is `recordBox` and `unionBox`'s own answer for the records this file
 * hands over, never a rectangle written out beside them (B-19, B-17), and the address is spelled
 * from the keys rather than the keys from the address.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { VIEWER_CLIENT_MODULE, productModule } from "../support/viewer-support";

/** The module AC-2 names for this concern, and the one the key shape belongs to. */
const USE_SELECTION_MODULE = "src/modules/takeoff/viewer/hooks/use-selection.ts";
const SELECTION_MODULE = "src/modules/takeoff/viewer-inspector/selection.ts";

/** Two keys this sheet holds and one it does not — all three of the shape the address accepts. */
const HELD_KEY = "DXF_HANDLE:1A";
const OTHER_KEY = "DXF_HANDLE:2B";
const ABSENT_KEY = "DXF_HANDLE:FF";

/** A value that is no key at all: the other half of the partial cell (I-88). */
const NONSENSE = "not-a-key";

/** The layer this sheet holds, whose key paints two pieces — one atom spanning both (I-86). */
const LAYER = {
  name: "GRID",
  rgb: [11, 22, 33],
  entityCount: 2,
  records: [
    { key: HELD_KEY, type: "LINE", rgb: [11, 22, 33], points: [[0, 0], [10, 4]] },
    { key: HELD_KEY, type: "LINE", rgb: [11, 22, 33], points: [[20, 30], [24, 36]] },
    { key: OTHER_KEY, type: "LINE", rgb: [11, 22, 33], points: [[100, 100], [110, 104]] },
  ],
};

type Options = {
  head: unknown;
  drawingId: string;
  layoutName: string;
  initialSelection: string | null;
  initialViewport: string | null;
  loadedLayers: number;
  failedCount: number;
  /** The store the facts are read from, where the caller keeps one of its own. */
  facts?: { get: (key: string) => unknown; has: (key: string) => boolean };
  reveal?: (keys: readonly string[]) => void;
  /** The collaborators a sheet draws *through* — every one of them optional (ARCH-01). */
  revision?: number;
  drawnLayers?: string;
  painterRef?: { current: unknown };
  cameraRef?: { current: unknown };
  draw?: (camera: unknown) => void;
  republish?: () => void;
};
type SelectionHook = {
  useSelection: (options: Options) => {
    selection: string[];
    missing: string[];
    selected: { key: string; type: string; layer: string; box: unknown }[];
    facts: { has: (key: string) => boolean; get: (key: string) => unknown };
    learn: (layer: unknown) => void;
    hold: (keys: string[] | ((held: string[]) => string[])) => void;
    toggleKey: (key: string) => void;
  };
};

let useSelection: SelectionHook["useSelection"];
let recordBox: (record: unknown) => unknown;
let unionBox: (boxes: readonly unknown[]) => unknown;
let republish: ReturnType<typeof vi.fn>;
let reveal: ReturnType<typeof vi.fn>;

/** A head carrying this one layer's roster. */
const SHEET = {
  kind: "manifest",
  cache: "miss",
  facts: {},
  manifest: {
    version: 1,
    layoutName: "SHEET ONE",
    extents: { min: [0, 0], max: [400, 200] },
    insunits: { code: 0, unit: null, unmapped: true },
    digest: "sheet-one",
    layers: [{ name: LAYER.name, rgb: LAYER.rgb, entityCount: LAYER.entityCount, records: [] }],
  },
};

/** The options this mount opens with, and the ones a rerender may change. */
function opened(given: Partial<Options> = {}): Options {
  return {
    head: SHEET,
    drawingId: "33333333-3333-4333-8333-333333333333",
    layoutName: "SHEET%20ONE",
    initialSelection: null,
    initialViewport: null,
    loadedLayers: 0,
    failedCount: 0,
    revision: 0,
    drawnLayers: LAYER.name,
    painterRef: { current: null },
    cameraRef: { current: null },
    draw: () => undefined,
    republish,
    reveal,
    ...given,
  };
}

async function mount(given: Partial<Options> = {}) {
  ({ useSelection } = await productModule<SelectionHook>(USE_SELECTION_MODULE));
  ({ recordBox } = await productModule<{ recordBox: typeof recordBox }>(VIEWER_CLIENT_MODULE));
  ({ unionBox } = await productModule<{ unionBox: typeof unionBox }>(SELECTION_MODULE));
  return renderHook((props: Options) => useSelection(props), { initialProps: opened(given) });
}

/** A roster of two layers, so "the sheet is not whole yet" is a state it can actually be in. */
const TWO_LAYERS = {
  ...SHEET,
  manifest: { ...SHEET.manifest, layers: [...SHEET.manifest.layers, { name: "WALLS", rgb: [44, 55, 66], entityCount: 1, records: [] }] },
};

/** The box a key's records span, as the tree's own two functions state it (B-17). */
function spanOf(key: string): unknown {
  return unionBox(LAYER.records.filter((record) => record.key === key).map((record) => recordBox(record)));
}

beforeEach(() => {
  republish = vi.fn();
  reveal = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("what is held on a sheet", () => {
  test("a key that paints many pieces is one row spanning all of them, and one nobody has met is no row", async () => {
    const { result } = await mount();

    act(() => result.current.learn(LAYER));
    act(() => result.current.hold([HELD_KEY, ABSENT_KEY]));

    expect(result.current.selection, "what the address carries is what the reader took, all of it").toEqual([HELD_KEY, ABSENT_KEY]);
    expect(result.current.selected.map((entity) => entity.key), "and the rows are the keys this sheet has met").toEqual([HELD_KEY]);
    expect(result.current.selected[0], "the row is the record's own type and layer, spanning every piece (I-86)").toMatchObject({
      key: HELD_KEY,
      type: "LINE",
      layer: LAYER.name,
      box: spanOf(HELD_KEY),
    });
    expect(republish, "what is held is part of the address exactly as the camera is (R-UI-031)").toHaveBeenCalled();
  });

  test("Shift's arithmetic adds a key and takes it away again", async () => {
    const { result } = await mount();
    act(() => result.current.learn(LAYER));

    act(() => result.current.toggleKey(HELD_KEY));
    act(() => result.current.toggleKey(OTHER_KEY));
    expect(result.current.selection, "each key toggled in is held, in the order it was taken").toEqual([HELD_KEY, OTHER_KEY]);

    act(() => result.current.toggleKey(HELD_KEY));
    expect(result.current.selection, "and toggling a held key lets go of that one alone").toEqual([OTHER_KEY]);
  });

  test("the address's own keys are read once the sheet has settled, and what it named and this sheet lacks is reported", async () => {
    const { result, rerender } = await mount({ initialSelection: `${HELD_KEY},${NONSENSE},${ABSENT_KEY}` });

    expect(result.current.selection, "a link copied while the sheet is still arriving carries nothing yet").toEqual([]);
    expect(reveal, "and nothing has been flown to").not.toHaveBeenCalled();

    act(() => result.current.learn(LAYER));
    rerender(opened({ initialSelection: `${HELD_KEY},${NONSENSE},${ABSENT_KEY}`, loadedLayers: SHEET.manifest.layers.length }));

    expect(result.current.selection, "every key the address named and this sheet holds is held").toEqual([HELD_KEY]);
    expect(result.current.missing, "and what it named and this sheet has not is the partial cell (I-88)").toEqual([NONSENSE, ABSENT_KEY]);
    expect(reveal.mock.calls, "a link that names keys and no viewport asks for the travel, once (I-85)").toEqual([[[HELD_KEY]]]);
  });

  test("a link that states a viewport is not flown anywhere (I-85)", async () => {
    const { result } = await mount({
      initialSelection: HELD_KEY,
      initialViewport: "0,0,1",
      loadedLayers: SHEET.manifest.layers.length,
    });

    act(() => result.current.learn(LAYER));
    expect(reveal, "the camera the address states is the camera the reader gets").not.toHaveBeenCalled();
  });

  test("the hook stands on the sheet's own facts alone: no painter, no camera, no address to write", async () => {
    // Everything this hook draws *through* — the painter, the camera, the address, the layers'
    // revision — is a collaborator and not a fact of what is held, so a mount that has none of them
    // still reads `s` and still says what the sheet does not hold (ARCH-01: the hook owes an answer
    // to whoever composes it, not a set of preconditions).
    const { useSelection } = await productModule<SelectionHook>(USE_SELECTION_MODULE);
    const supplied = {
      get: (key: string) => (key === HELD_KEY ? { type: "LINE", layer: LAYER.name, box: spanOf(HELD_KEY), records: [] } : undefined),
      has: (key: string) => key === HELD_KEY,
    };
    const travelled = vi.fn();
    const roster = TWO_LAYERS.manifest.layers.length;

    const view = renderHook(({ failed }: { failed: number }) =>
      useSelection({
        head: TWO_LAYERS,
        drawingId: "33333333-3333-4333-8333-333333333333",
        layoutName: "SHEET%20ONE",
        initialSelection: `${HELD_KEY},${ABSENT_KEY}`,
        initialViewport: null,
        loadedLayers: roster - 1,
        failedCount: failed,
        facts: supplied,
        reveal: travelled,
      }), { initialProps: { failed: 0 } });

    expect(view.result.current.selection, "a sheet still arriving is not a reading of the link yet").toEqual([]);
    expect(travelled, "and nothing has been asked to travel").not.toHaveBeenCalled();

    // The last layer fails rather than arrives: the sheet is as whole as it will get (I-81, I-88).
    view.rerender({ failed: 1 });
    expect(view.result.current.selection, "the keys the sheet does hold are held").toEqual([HELD_KEY]);
    expect(view.result.current.missing, "and the one it does not is the partial cell").toEqual([ABSENT_KEY]);
    expect(travelled.mock.calls, "the travel is asked for once, with what was found (I-85)").toEqual([[[HELD_KEY]]]);

    act(() => view.result.current.hold([HELD_KEY]));
    expect(view.result.current.selection, "a gesture over the same key holds it").toEqual([HELD_KEY]);
    expect(view.result.current.missing, "and ends the news the link brought").toEqual([]);
  });

  test("a sheet whose last layer failed is settled too, and a gesture ends the news the link brought", async () => {
    const { result, rerender } = await mount({ initialSelection: ABSENT_KEY });

    expect(result.current.missing, "nothing is reported while the sheet may still hold the key").toEqual([]);

    // The last layer of the roster fails rather than arrives: `loadedLayers` never moves again, and
    // the reading is owed to the reader all the same (I-81).
    rerender(opened({ initialSelection: ABSENT_KEY, failedCount: SHEET.manifest.layers.length, revision: 1 }));
    expect(result.current.missing, "a sheet that is as whole as it will get answers the link").toEqual([ABSENT_KEY]);

    act(() => result.current.hold([]));
    expect(result.current.missing, "and a reader who picks for themselves is no longer reading that link").toEqual([]);
  });
});

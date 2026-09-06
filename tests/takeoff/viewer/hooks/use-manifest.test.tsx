// @vitest-environment jsdom
/**
 * AC-3 — the sheet feed as a hook: the head first, then one layer at a time in the roster's order,
 * the next never asked for before the last has answered, one `onLayer` per arrival, a layer that
 * answers 500 left standing on its own row, and a retry that takes it back.
 *
 * Every request is answered by hand, so "one at a time" is judged rather than hoped for: the stub
 * hands back a promise the test settles, and what has been asked for is read between settlements.
 * Nothing here transcribes a roster — the roster is this file's own fixture, and every total is
 * derived from it (B-19).
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { productModule } from "../support/viewer-support";

/** The module AC-2 names for this concern, and the hook it publishes. */
const USE_MANIFEST_MODULE = "src/modules/takeoff/viewer/hooks/use-manifest.ts";

/** The sheet the feed answers with: three layers, so "in roster order" has an order to be in. */
const ROSTER = [
  { name: "GRID", rgb: [11, 22, 33], entityCount: 3 },
  { name: "WALLS", rgb: [44, 55, 66], entityCount: 5 },
  { name: "TEXT", rgb: [77, 88, 99], entityCount: 2 },
] as const;

/** Which layer of the roster the failure test lets fall over: one that is neither first nor last. */
const FALLS_OVER = 1;

/** The address this mount's feed is asked at — the hook is handed the feed, so this is the contract. */
const feed = (query: string): string => `/api/viewer/33333333-3333-4333-8333-333333333333/SHEET%20ONE?tenant=t&${query}`;

type ManifestHook = {
  useManifest: (options: {
    supplied?: unknown;
    feed: (query: string) => string;
    onLayer: (layer: { name: string; entityCount: number }) => void;
    onLayerFailed: (name: string, failed: boolean) => void;
  }) => { loadedLayers: number; retryLayer: (index: number, name: string) => void };
};

/** One request the hook has made and nobody has answered yet. */
type InFlight = { url: string; settle: (answer: Response) => void };

let useManifest: ManifestHook["useManifest"];
let inFlight: InFlight[] = [];
let asked: string[] = [];
let fetched: ReturnType<typeof vi.fn>;
let onLayer: ReturnType<typeof vi.fn>;
let onLayerFailed: ReturnType<typeof vi.fn>;

/** The head as the feed answers one: the roster with its swatches and counts, and no geometry. */
function headBody(): unknown {
  return {
    kind: "manifest",
    cache: "miss",
    facts: {},
    version: 1,
    layoutName: "SHEET ONE",
    extents: { min: [0, 0], max: [400, 200] },
    insunits: { code: 0, unit: null, unmapped: true },
    digest: "sheet-one",
    layers: ROSTER.map((layer) => ({ name: layer.name, rgb: [...layer.rgb], entityCount: layer.entityCount })),
  };
}

/** One layer's geometry as the feed answers it, by its place in the roster. */
function layerBody(index: number): unknown {
  const layer = ROSTER[index] as (typeof ROSTER)[number];
  return { index, name: layer.name, rgb: [...layer.rgb], entityCount: layer.entityCount, records: [] };
}

/** Let every promise the hook is waiting on run out, inside React's own work loop. */
async function settled(): Promise<void> {
  await act(async () => {
    await new Promise((resume) => setTimeout(resume, 0));
  });
}

/** Answer the oldest request nobody has answered yet, and let the hook run on from it. */
async function answerNext(body: unknown, status = 200): Promise<void> {
  const next = inFlight.shift();
  expect(next, "the hook has a request in flight to answer").toBeDefined();
  (next as InFlight).settle(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  await settled();
}

/**
 * The hook mounted over the stubbed feed, with the callbacks AC-3 names. The module is loaded here
 * rather than in a hook, so a module the split has not written yet fails the test that needed it
 * instead of leaving it reported as one nobody ran.
 */
async function mount(supplied?: unknown) {
  ({ useManifest } = await productModule<ManifestHook>(USE_MANIFEST_MODULE));
  return renderHook(() => useManifest(supplied === undefined ? { feed, onLayer, onLayerFailed } : { supplied, feed, onLayer, onLayerFailed }));
}

beforeEach(() => {
  inFlight = [];
  asked = [];
  onLayer = vi.fn();
  onLayerFailed = vi.fn();
  fetched = vi.fn((input: unknown) => {
    const url = String(input);
    asked.push(url);
    return new Promise<Response>((settle) => {
      inFlight.push({ url, settle });
    });
  });
  vi.stubGlobal("fetch", fetched);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AC-3: the head, then the layers, one at a time", () => {
  test("AC-3: the head first, then every layer in roster order, each asked for only once the last answered", async () => {
    const { result } = await mount();
    await settled();

    expect(asked, "the head is what a sheet is opened with").toEqual([feed("part=head")]);

    await answerNext(headBody());

    for (const [index, layer] of ROSTER.entries()) {
      expect(asked, `layer ${index} is asked for only once layer ${index - 1} has answered`).toHaveLength(index + 2);
      expect(asked.at(-1), "each layer is asked for by its place in the roster").toBe(feed(`part=layer&index=${index}`));

      await answerNext(layerBody(index));

      expect(onLayer, "one arrival, one hand-off").toHaveBeenCalledTimes(index + 1);
      expect(onLayer.mock.calls.at(-1)?.[0], "the layer handed over is the one that arrived").toMatchObject({
        name: layer.name,
        entityCount: layer.entityCount,
      });
    }

    expect(result.current.loadedLayers, "every layer of the roster arrived").toBe(ROSTER.length);
    expect(onLayerFailed.mock.calls.filter((call) => call[1] === true), "nothing failed on the way").toEqual([]);
    expect(asked, "the sheet is the head and its layers, and nothing else").toHaveLength(ROSTER.length + 1);
  });

  test("AC-3: a layer that answers 500 stops one short and is reported, and a retry takes it back", async () => {
    const failing = ROSTER[FALLS_OVER] as (typeof ROSTER)[number];
    const { result } = await mount();
    await settled();
    await answerNext(headBody());

    for (const index of ROSTER.keys()) {
      expect(asked.at(-1), "the roster is walked in order however a layer answers").toBe(feed(`part=layer&index=${index}`));
      if (index === FALLS_OVER) await answerNext({ faultId: "a fault of ours" }, 500);
      else await answerNext(layerBody(index));
    }

    expect(result.current.loadedLayers, "the layers that arrived are counted, and the one that did not is not").toBe(ROSTER.length - 1);
    expect(onLayerFailed, "the row of the layer that did not arrive is told so").toHaveBeenCalledWith(failing.name, true);

    await act(async () => {
      result.current.retryLayer(FALLS_OVER, failing.name);
      await new Promise((resume) => setTimeout(resume, 0));
    });
    expect(asked.at(-1), "a retry asks for that layer's own place in the roster").toBe(feed(`part=layer&index=${FALLS_OVER}`));

    await answerNext(layerBody(FALLS_OVER));

    expect(onLayerFailed, "the row stops saying the layer is missing once it is not").toHaveBeenCalledWith(failing.name, false);
    expect(result.current.loadedLayers, "and the sheet is whole again").toBe(ROSTER.length);
  });

  test("AC-3: a mount handed a supplied head fetches nothing and hands over every layer it was given", async () => {
    const supplied = {
      kind: "manifest",
      cache: "hit",
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

    await mount(supplied);
    await settled();

    expect(fetched, "a sheet it was handed is a sheet it does not ask for").not.toHaveBeenCalled();
    expect(
      onLayer.mock.calls.map((call) => (call[0] as { name: string }).name),
      "every supplied layer is handed over, in the roster's order",
    ).toEqual(ROSTER.map((layer) => layer.name));
  });
});

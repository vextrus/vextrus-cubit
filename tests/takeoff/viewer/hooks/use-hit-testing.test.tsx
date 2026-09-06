// @vitest-environment jsdom
/**
 * The spatial index as a hook (R-UI-040, PB-3): the sheet posted to the worker a layer at a time as
 * it arrives, one waiter per question so two questions in flight are never answered with each
 * other's keys, the round trip published on the readout, and a screen that leaves settling every
 * waiter with nothing rather than leaving a promise nobody will ever keep (ARCH-03).
 *
 * The thread is handed in through the hook's own `spawn` seam, so what is judged here is the
 * conversation the hook holds rather than a worker jsdom does not have. Nothing is transcribed: the
 * tolerance is compared against the hook's own `HIT_TOLERANCE_PX` over this camera's own scale.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { productModule } from "../support/viewer-support";

/** The module AC-2 names for this concern. */
const USE_HIT_TESTING_MODULE = "src/modules/takeoff/viewer/hooks/use-hit-testing.ts";

/** The camera the questions are asked through — a scale of one would hide a division by it. */
const CAMERA = { centre: [0, 0], scale: 4, viewport: { width: 800, height: 600 } };

/** The layers this sheet holds, and the one the reader has locked. */
const ROSTER = ["GRID", "WALLS"] as const;
const LOCKED = "WALLS";

/** The point a question is asked about, and the keys the index answers it with. */
const POINT: [number, number] = [12, 34];
const FOUND = ["GRID/1", "GRID/2"];

type Posted = { id: number; kind: string; layers?: { name: string }[]; tolerance?: number; lockedLayers?: readonly string[]; point?: [number, number] };
type HitTestingHook = {
  HIT_TOLERANCE_PX: number;
  useHitTesting: (options: {
    head: unknown;
    cameraRef: { current: unknown };
    statusRef: { current: HTMLElement | null };
    stateRef: { current: unknown };
    spawn?: () => Worker;
  }) => {
    ask: (request: unknown) => Promise<string[]>;
    keysUnder: (world: [number, number], takeable?: boolean) => Promise<string[]>;
    take: (layer: unknown) => void;
    terminate: () => void;
  };
};

/** The index's own thread, as this file stands one up: what it was told, and what it answers with. */
function standUpIndex() {
  const listeners = new Set<(event: { data: unknown }) => void>();
  const thread = {
    posted: [] as Posted[],
    terminated: 0,
    addEventListener: (_kind: string, listener: (event: { data: unknown }) => void) => listeners.add(listener),
    removeEventListener: (_kind: string, listener: (event: { data: unknown }) => void) => listeners.delete(listener),
    postMessage: (message: Posted) => thread.posted.push(message),
    terminate: () => {
      thread.terminated += 1;
    },
    /** One answer from the index's thread, for the question that carried this id. */
    answer: (id: number, kind: string, keys: string[]) => {
      for (const listener of [...listeners]) listener({ data: { id, kind, keys } });
    },
  };
  return thread;
}

/** One layer as the feed hands it over. */
const layerOf = (name: string) => ({ name, rgb: [1, 2, 3], entityCount: 1, records: [] });

/** A head carrying this roster, or nothing at all while the sheet is still in flight. */
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
      layers: ROSTER.map((name) => layerOf(name)),
    },
  };
}

let HIT_TOLERANCE_PX: number;
let index: ReturnType<typeof standUpIndex>;
let status: HTMLDivElement;
let spawn: () => Worker;
/** The posture the questions are asked under: one layer of the roster is locked, none is hidden. */
const stateRef = {
  current: {
    layerRows: () => ROSTER.map((name) => ({ name, drawn: true, locked: name === LOCKED, visible: true, isolated: false, failed: false })),
  },
};

/** The one head the sheet settles on, made once so a re-render is not a second sheet. */
const SHEET = head();

async function mount() {
  const module = await productModule<HitTestingHook>(USE_HIT_TESTING_MODULE);
  HIT_TOLERANCE_PX = module.HIT_TOLERANCE_PX;
  return renderHook(({ given }: { given: unknown }) => module.useHitTesting({ head: given, cameraRef: { current: CAMERA }, statusRef: { current: status }, stateRef, spawn }), {
    initialProps: { given: null as unknown },
  });
}

/** What the index was told to index, in the order it was told. */
function indexed(): string[] {
  return index.posted.filter((message) => message.kind === "index").flatMap((message) => (message.layers ?? []).map((layer) => layer.name));
}

/** The last question that was not an indexing. */
function lastAsk(): Posted {
  return index.posted.filter((message) => message.kind !== "index").at(-1) as Posted;
}

beforeEach(() => {
  index = standUpIndex();
  status = document.createElement("div");
  document.body.append(status);
  spawn = () => index as unknown as Worker;
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("the index, in a worker", () => {
  test("the layers that arrived before the thread did are posted once it exists, one message each and once only", async () => {
    const { result, rerender } = await mount();

    for (const name of ROSTER) result.current.take(layerOf(name));
    expect(indexed(), "there is no thread yet, so nothing has been said to one").toEqual([]);

    rerender({ given: SHEET });
    expect(indexed(), "every layer that arrived is indexed, in the order it arrived").toEqual([...ROSTER]);

    const first = ROSTER[0] as string;
    result.current.take(layerOf(first));
    expect(indexed(), "and a layer the index already holds is not posted a second time").toEqual([...ROSTER]);
  });

  test("two questions in flight are each answered with their own keys", async () => {
    const { result, rerender } = await mount();
    rerender({ given: SHEET });

    let hit: string[] | null = null;
    let rect: string[] | null = null;
    void result.current.ask({ kind: "hit", point: POINT, tolerance: 1 }).then((keys) => (hit = keys));
    void result.current.ask({ kind: "rect", bbox: { min: [0, 0], max: [1, 1] }, layers: [] }).then((keys) => (rect = keys));

    const asks = index.posted.filter((message) => message.kind !== "index");
    expect(asks, "both questions reached the index").toHaveLength(2);
    expect(new Set(asks.map((ask) => ask.id)).size, "each under an id of its own").toBe(2);

    // The rectangle is answered first, so an implementation that hands an answer to whoever asked
    // last — or to whoever asked first — is caught rather than flattered.
    await act(async () => {
      index.answer((asks[1] as Posted).id, "rect", ["RECT/1"]);
      index.answer((asks[0] as Posted).id, "hit", FOUND);
      await Promise.resolve();
    });

    expect(hit, "the point's question is answered with the point's keys").toEqual(FOUND);
    expect(rect, "and the rectangle's with the rectangle's").toEqual(["RECT/1"]);
  });

  test("a point carries the tolerance the camera makes of it, the shut layers, and its round trip to the readout", async () => {
    const { result, rerender } = await mount();
    rerender({ given: SHEET });

    let answered: string[] | null = null;
    void result.current.keysUnder(POINT).then((keys) => (answered = keys));

    const asked = lastAsk();
    expect(asked.kind, "a point is a hit-test").toBe("hit");
    expect(asked.point, "asked about where the pointer is").toEqual(POINT);
    expect(asked.tolerance, "how near counts is a distance on the paper, not on the screen (PB-3)").toBe(HIT_TOLERANCE_PX / CAMERA.scale);
    expect(asked.lockedLayers, "and the posture travels with the question (Decision § 1)").toEqual([LOCKED]);

    await act(async () => {
      index.answer(asked.id, "hit", FOUND);
      await Promise.resolve();
    });

    expect(answered, "the caller gets the keys the index found").toEqual(FOUND);
    expect(status.getAttribute("data-hit-keys"), "and the readout carries how many there were (Decision § 7)").toBe(String(FOUND.length));
    expect(Number(status.getAttribute("data-hit-ms")), "and how long the round trip took").toBeGreaterThanOrEqual(0);
  });

  test("a question asked with no thread to answer it is answered with nothing rather than left hanging", async () => {
    const { result } = await mount();

    await expect(result.current.ask({ kind: "hit", point: POINT, tolerance: 1 }), "no index, no keys — and no promise nobody keeps").resolves.toEqual([]);
  });

  test("a screen that leaves lets the thread go and settles everyone still waiting", async () => {
    const { result, rerender, unmount } = await mount();
    rerender({ given: SHEET });

    let waiting: string[] | null = null;
    void result.current.ask({ kind: "hit", point: POINT, tolerance: 1 }).then((keys) => (waiting = keys));

    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(index.terminated, "the index's thread is not left running behind a screen nobody is on").toBe(1);
    expect(waiting, "and a caller who was owed an answer is given one (ARCH-03)").toEqual([]);
  });
});

// @vitest-environment jsdom
/**
 * The index in its worker (R-UI-040, PB-3): every question carries its own id and its own waiter, the
 * layer posture travels with a hit, the round trip is published on the readout, and a screen that
 * leaves owes its callers an answer.
 *
 * jsdom has no `Worker`, so the thread is handed in through `spawn` — the seam the hook publishes for
 * exactly this. Nothing is transcribed: which layers a question shuts out is derived from the posture
 * this mount states (B-19).
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { LayerRow, ViewerState } from "../../../../src/modules/takeoff/viewer/client";
import type { SpatialAnswer, SpatialRequest } from "../../../../src/modules/takeoff/viewer/spatial.worker";
import { useHitTesting, type WorkerLike } from "../../../../src/modules/takeoff/viewer/hooks/use-hit-testing";
import { layerOf, sheetHead } from "./hook-support";

/** The posture this mount states: one layer locked, one not drawn, one open to any question. */
const ROWS: readonly LayerRow[] = [
  { name: "GRID", rgb: [1, 2, 3], entityCount: 1, visible: true, drawn: true, locked: false, isolated: false, failed: false },
  { name: "WALLS", rgb: [1, 2, 3], entityCount: 1, visible: true, drawn: true, locked: true, isolated: false, failed: false },
  { name: "TEXT", rgb: [1, 2, 3], entityCount: 1, visible: false, drawn: false, locked: false, isolated: false, failed: false },
];

const head = sheetHead(ROWS.map((row) => layerOf(row.name)));
const WORLD: [number, number] = [12, 34];

/** A thread that records what it was asked and answers only when this test says so. */
function fakeWorker() {
  const posted: SpatialRequest[] = [];
  const listeners: ((event: { data: SpatialAnswer }) => void)[] = [];
  let terminated = 0;
  const worker: WorkerLike = {
    postMessage: (message) => void posted.push(message),
    addEventListener: (_kind, listener) => void listeners.push(listener),
    removeEventListener: (_kind, listener) => void listeners.splice(listeners.indexOf(listener), 1),
    terminate: () => void (terminated += 1),
  };
  return {
    worker,
    posted,
    terminations: () => terminated,
    answer: (data: SpatialAnswer) => {
      for (const listener of [...listeners]) listener({ data });
    },
  };
}

/** The posture as a hook reads one, standing in for the state the panel drives. */
const posture = { layerRows: () => [...ROWS] } as ViewerState;

let thread: ReturnType<typeof fakeWorker>;
let status: HTMLDivElement;

/** The hit requests the worker was handed, in the order they were asked. */
function hits(): Extract<SpatialRequest, { kind: "hit" }>[] {
  return thread.posted.filter((message): message is Extract<SpatialRequest, { kind: "hit" }> => message.kind === "hit");
}

function mount() {
  return renderHook(() =>
    useHitTesting({
      head,
      spawn: () => thread.worker,
      stateRef: { current: posture },
      statusRef: { current: status },
    }),
  );
}

beforeEach(() => {
  thread = fakeWorker();
  status = document.createElement("div");
  document.body.append(status);
});

afterEach(() => {
  cleanup();
  status.remove();
});

describe("useHitTesting: one question, one id, one answer", () => {
  test("two questions in flight carry distinct ids and settle with their own answers, in any order", async () => {
    const { result } = mount();

    const first = result.current.ask({ kind: "layer", layer: "GRID" });
    const second = result.current.ask({ kind: "layer", layer: "WALLS" });
    const [askedFirst, askedSecond] = thread.posted;

    expect(askedFirst?.id === askedSecond?.id, "two questions are never asked under one id").toBe(false);

    // Answered the other way round: an answer belongs to the question it carries the id of.
    act(() => thread.answer({ id: askedSecond?.id ?? -1, kind: "layer", keys: ["second"] }));
    act(() => thread.answer({ id: askedFirst?.id ?? -1, kind: "layer", keys: ["first"] }));

    expect(await first, "each caller is answered with what it asked for").toEqual(["first"]);
    expect(await second, "and never with the other's keys").toEqual(["second"]);
  });

  test("a hit carries the posture: locked or undrawn where a reader may take, undrawn alone where they may not", () => {
    const { result } = mount();

    void result.current.keysUnder(WORLD);
    expect(hits().at(-1)?.lockedLayers, "a layer that is locked or not there answers nothing a reader may take (I-87)").toEqual(
      ROWS.filter((row) => row.locked || !row.drawn).map((row) => row.name),
    );

    void result.current.keysUnder(WORLD, false);
    expect(hits().at(-1)?.lockedLayers, "asked what is merely under the point, only what is not drawn is shut out").toEqual(
      ROWS.filter((row) => !row.drawn).map((row) => row.name),
    );
    expect(hits().at(-1)?.point, "and the question is about the point it was asked at").toEqual(WORLD);
  });

  test("a hit answer publishes its round trip and its count on the readout (Decision § 7)", () => {
    const { result } = mount();

    void result.current.keysUnder(WORLD);
    act(() => thread.answer({ id: hits().at(-1)?.id ?? -1, kind: "hit", keys: ["a", "b"] }));

    expect(Number(status.getAttribute("data-hit-ms")), "the round trip is a figure an operator can read").not.toBeNaN();
    expect(status.getAttribute("data-hit-keys"), "and so is how many keys it found").toBe("2");
  });

  test("a screen that leaves ends its thread and settles every question nobody will answer", async () => {
    const { result, unmount } = mount();

    const pending = result.current.ask({ kind: "layer", layer: "GRID" });
    unmount();

    expect(thread.terminations(), "the index's thread is not left running behind a screen nobody is on").toBe(1);
    expect(await pending, "a question nobody will answer is settled with nothing, never left pending (ARCH-03)").toEqual([]);
  });
});

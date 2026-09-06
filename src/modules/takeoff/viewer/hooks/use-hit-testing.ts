/**
 * Hit-testing through a spatial index held in a worker (R-UI-040, PB-3). The main thread never walks
 * the sheet to answer "what is under this point": it asks, and paints while it waits.
 *
 * Each question carries its own id and its own waiter, so a hover asked twice while a rectangle is
 * in flight is never answered with the other's keys — and a screen that leaves settles every waiter
 * with nothing rather than leaving a promise nobody will ever keep (ARCH-03).
 */
import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { ViewerState } from "../client";
import type { SpatialAnswer, SpatialAsk, SpatialRequest } from "../spatial.worker";
import type { Camera, RenderLayer, ViewerHead } from "../types";
import { useHandedRef } from "./use-handed-ref";

/** How near the pointer a record counts as under it, in pixels, when the index is asked. */
const HIT_TOLERANCE_PX = 4;

/** What the index is reached through — a Worker, or a stand-in for one where there is no Worker. */
export type WorkerLike = {
  postMessage: (message: SpatialRequest) => void;
  addEventListener: (kind: "message", listener: (event: { data: SpatialAnswer }) => void) => void;
  /** A thread that cannot be unsubscribed from is still ended, so this one is not required of it. */
  removeEventListener?: (kind: "message", listener: (event: { data: SpatialAnswer }) => void) => void;
  terminate: () => void;
};

export type UseHitTestingOptions = {
  head: ViewerHead | null;
  /** Every layer whose geometry has arrived, by name — what the index is built from. */
  layers?: RefObject<Map<string, RenderLayer>>;
  /** How many layers have arrived: one more of them is one more message to the index. */
  loadedLayers?: number;
  /** The layer posture the question travels with (Decision § 1). */
  stateRef?: RefObject<ViewerState | null>;
  /** The readout the round trip and the number of keys are published on (Decision § 7). */
  statusRef?: RefObject<HTMLElement | null>;
  cameraRef?: RefObject<Camera | null>;
  /** How the index's thread is started. Injected where there is no `Worker` to start one with. */
  spawn?: () => WorkerLike;
};

export type UseHitTesting = {
  /** One question put to the index, answered from the worker's thread. */
  ask: (request: SpatialAsk) => Promise<string[]>;
  /** The keys under a world point, nearest first, with the layer posture travelling with it. */
  keysUnder: (world: [number, number], takeable?: boolean) => Promise<string[]>;
};

export function useHitTesting({ head, layers, loadedLayers = 0, stateRef, statusRef, cameraRef, spawn }: UseHitTestingOptions): UseHitTesting {
  const sheet = useHandedRef<Map<string, RenderLayer> | null>(layers, null);
  const posture = useHandedRef(stateRef, null);
  const status = useHandedRef(statusRef, null);
  const held = useHandedRef(cameraRef, null);
  const workerRef = useRef<WorkerLike | null>(null);
  /** The next id a question is asked under, and who is waiting for each answer. */
  const nextAskRef = useRef(0);
  const waitingRef = useRef<Map<number, (keys: string[]) => void>>(new Map());
  const postedRef = useRef<Set<string>>(new Set());
  /** When the index was last asked about a point, so its answer can be timed against PB-3. */
  const askedAtRef = useRef(0);

  const ask = useCallback((request: SpatialAsk): Promise<string[]> => {
    const worker = workerRef.current;
    if (worker === null) return Promise.resolve([]);
    const id = nextAskRef.current++;
    return new Promise<string[]>((settle) => {
      waitingRef.current.set(id, settle);
      worker.postMessage({ ...request, id } as SpatialRequest);
    });
  }, []);

  /**
   * Every layer that has arrived and not yet been posted to the index, one message each. The whole
   * sheet in one message is a structured clone of every record of every layer on this thread, paid
   * for in one lump the moment the last layer lands; a layer at a time spreads it across the feed
   * and lets the index answer for what has arrived (R-UI-040, PB-3).
   */
  const indexLayers = useCallback((): void => {
    const worker = workerRef.current;
    if (worker === null) return;
    for (const [name, layer] of sheet.current ?? []) {
      if (postedRef.current.has(name)) continue;
      postedRef.current.add(name);
      worker.postMessage({ id: nextAskRef.current++, kind: "index", layers: [layer] });
    }
  }, [sheet]);

  useEffect(() => {
    if (head?.kind !== "manifest") return;
    // The default path names the worker's own module, which only a runtime that has `Worker` can be
    // asked to start; a mount that hands `spawn` in never reaches it.
    if (spawn === undefined && typeof Worker === "undefined") return;
    const worker: WorkerLike =
      spawn === undefined ? new Worker(new URL("../spatial.worker.ts", import.meta.url), { type: "module" }) : spawn();

    // What the index answers is read here, or the question was never asked: the round trip and the
    // number of keys it found are published on the readout the way the frame ledger is, so PB-3's
    // hit-test budget is a figure a journey and an operator can read (Decision § 7).
    const onAnswer = (event: { data: SpatialAnswer }): void => {
      const waiting = waitingRef.current.get(event.data.id);
      waitingRef.current.delete(event.data.id);
      if (event.data.kind === "hit") {
        const readout = status.current;
        readout?.setAttribute("data-hit-ms", String(performance.now() - askedAtRef.current));
        readout?.setAttribute("data-hit-keys", String(event.data.keys.length));
      }
      waiting?.(event.data.keys);
    };
    worker.addEventListener("message", onAnswer);
    workerRef.current = worker;
    postedRef.current.clear();
    indexLayers();

    return () => {
      worker.removeEventListener?.("message", onAnswer);
      worker.terminate();
      workerRef.current = null;
      postedRef.current.clear();
      // A question nobody will answer is settled with nothing rather than left pending: a screen
      // that left owes its callers an answer, and "no keys" is one (ARCH-03).
      for (const waiting of waitingRef.current.values()) waiting([]);
      waitingRef.current.clear();
    };
  }, [head, indexLayers, spawn, status]);

  // One more layer on the paper is one more layer the index can answer for.
  useEffect(() => {
    indexLayers();
  }, [indexLayers, loadedLayers]);

  const keysUnder = useCallback(
    (world: [number, number], takeable = true): Promise<string[]> => {
      askedAtRef.current = performance.now();
      // The postures travel with the question (Decision § 1): the index holds the whole sheet, and
      // a layer the reader locked or is not looking at may not answer for it. A locked layer is
      // painted and out of the hit-test; a layer that is not drawn is not there to point at, and a
      // selection a reader cannot see is a copyable list of ghosts (I-87).
      const shut = (posture.current?.layerRows() ?? [])
        .filter((row) => (takeable && row.locked) || !row.drawn)
        .map((row) => row.name);
      const scale = held.current?.scale ?? 1;
      return ask({ kind: "hit", point: world, tolerance: HIT_TOLERANCE_PX / scale, lockedLayers: shut });
    },
    [ask, held, posture],
  );

  return { ask, keysUnder };
}

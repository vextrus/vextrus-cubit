/**
 * What is under a point, answered by the spatial index in a worker (R-UI-040, PB-3): the sheet is
 * posted a layer at a time as it arrives, and every question carries its own id and its own waiter,
 * so a hover asked twice while a rectangle is in flight is never answered with the other's keys.
 *
 * A screen that leaves settles every waiter with nothing rather than leaving a promise nobody will
 * ever keep: a caller is owed an answer, and "no keys" is one (ARCH-03).
 */
import { useCallback, useEffect, useRef } from "react";
import type { ViewerState } from "../client";
import type { SpatialAnswer, SpatialAsk, SpatialRequest } from "../spatial.worker";
import type { Camera, RenderLayer, ViewerHead } from "../types";
import { shutLayersOf } from "./use-layers";

/** How near the pointer a record counts as under it, in pixels, when the index is asked. */
export const HIT_TOLERANCE_PX = 4;

export interface HitTestingOptions {
  head: ViewerHead | null;
  cameraRef: { current: Camera | null };
  /** The readout the round trip and the number of keys are published on (Decision § 7). */
  statusRef: { current: HTMLElement | null };
  /** The layers' posture: which of them may answer a question travels with it (Decision § 1). */
  stateRef: { current: ViewerState };
  /**
   * The index's own thread. It is handed in where there is no `Worker` to make one from — a hook
   * under jsdom — and made here otherwise, so the sheet's own worker is the one thing this seam is.
   */
  spawn?: () => Worker;
}

export interface HitTesting {
  /** One question put to the index, answered from the worker's thread. */
  ask: (request: SpatialAsk) => Promise<string[]>;
  /** The keys under a point, nearest first. */
  keysUnder: (world: [number, number], takeable?: boolean) => Promise<string[]>;
  /** One arrived layer posted to the index — the whole sheet in one message is a lump nobody pays. */
  take: (layer: RenderLayer) => void;
  /** The index's thread let go of, and every waiter settled with nothing. */
  terminate: () => void;
}

export function useHitTesting({ head, cameraRef, statusRef, stateRef, spawn }: HitTestingOptions): HitTesting {
  const workerRef = useRef<Worker | null>(null);
  /** Every layer that has arrived, and the ones the index has already been told about. */
  const arrivedRef = useRef<Map<string, RenderLayer>>(new Map());
  const postedRef = useRef<Set<string>>(new Set());
  /** When the index was last asked about a point, so its answer can be timed against PB-3. */
  const askedAtRef = useRef(0);
  /** The next id a question is asked under, and who is waiting for each answer. */
  const nextAskRef = useRef(0);
  const waitingRef = useRef<Map<number, (keys: string[]) => void>>(new Map());

  /**
   * Every layer that has arrived and not yet been posted to the index, one message each. The whole
   * sheet in one message is a structured clone of every record of every layer on this thread, paid
   * for in one lump the moment the last layer lands; a layer at a time spreads it across the feed
   * and lets the index answer for what has arrived (R-UI-040, PB-3).
   */
  const indexLayers = useCallback((): void => {
    const worker = workerRef.current;
    if (worker === null) return;
    for (const [name, layer] of arrivedRef.current) {
      if (postedRef.current.has(name)) continue;
      postedRef.current.add(name);
      worker.postMessage({ id: nextAskRef.current++, kind: "index", layers: [layer] });
    }
  }, []);

  const take = useCallback(
    (layer: RenderLayer): void => {
      arrivedRef.current.set(layer.name, layer);
      indexLayers();
    },
    [indexLayers],
  );

  const ask = useCallback((request: SpatialAsk): Promise<string[]> => {
    const worker = workerRef.current;
    if (worker === null) return Promise.resolve([]);
    const id = nextAskRef.current++;
    return new Promise<string[]>((settle) => {
      waitingRef.current.set(id, settle);
      worker.postMessage({ ...request, id } as SpatialRequest);
    });
  }, []);

  const keysUnder = useCallback(
    (world: [number, number], takeable = true): Promise<string[]> => {
      const at = cameraRef.current;
      if (at === null) return Promise.resolve([]);
      askedAtRef.current = performance.now();
      // How near counts is a distance on the paper, not on the screen, so the tolerance is the
      // camera's own (PB-3); which layers may answer is the posture's own (B-17).
      return ask({ kind: "hit", point: world, tolerance: HIT_TOLERANCE_PX / at.scale, lockedLayers: shutLayersOf(stateRef.current, takeable) });
    },
    [ask, cameraRef, stateRef],
  );

  const terminate = useCallback((): void => {
    const worker = workerRef.current;
    workerRef.current = null;
    postedRef.current.clear();
    worker?.terminate();
    // A question nobody will answer is settled with nothing rather than left pending: a screen that
    // left owes its callers an answer, and "no keys" is one (ARCH-03).
    for (const waiting of waitingRef.current.values()) waiting([]);
    waitingRef.current.clear();
  }, []);

  useEffect(() => {
    if (head?.kind !== "manifest") return;
    if (spawn === undefined && typeof Worker === "undefined") return;
    const worker = spawn === undefined ? new Worker(new URL("../spatial.worker.ts", import.meta.url), { type: "module" }) : spawn();
    // What the index answers is read here, or the question was never asked: the round trip and the
    // number of keys it found are published on the readout the way the frame ledger is, so PB-3's
    // hit-test budget is a figure a journey and an operator can read (Decision § 7).
    const onAnswer = (event: MessageEvent<SpatialAnswer>): void => {
      const waiting = waitingRef.current.get(event.data.id);
      waitingRef.current.delete(event.data.id);
      if (event.data.kind === "hit") {
        const status = statusRef.current;
        status?.setAttribute("data-hit-ms", String(performance.now() - askedAtRef.current));
        status?.setAttribute("data-hit-keys", String(event.data.keys.length));
      }
      waiting?.(event.data.keys);
    };
    worker.addEventListener("message", onAnswer);
    workerRef.current = worker;
    postedRef.current.clear();
    indexLayers();
    return () => {
      worker.removeEventListener("message", onAnswer);
      terminate();
    };
  }, [head, indexLayers, spawn, terminate]);

  return { ask, keysUnder, take, terminate };
}

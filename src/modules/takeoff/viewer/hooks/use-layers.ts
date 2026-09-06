/**
 * The layers' posture for one open sheet (R-TO-010, Decision § 1): what the panel renders, what the
 * painter draws and what a hit-test may answer from — visibility, isolation, the lock, and the rows
 * whose geometry never arrived.
 *
 * The posture is rebuilt whenever the head changes, so what the feed learned is held here rather
 * than inside it: a failure recorded before the roster rendered would otherwise be forgotten by the
 * render that would have shown it (I-81).
 */
import { useCallback, useMemo, useReducer, useRef } from "react";
import { createViewerState, type LayerRow, type ViewerState } from "../client";
import type { ViewerHead } from "../types";

export interface LayerPostureOptions {
  head: ViewerHead | null;
}

export interface LayerPosture {
  state: ViewerState;
  /**
   * The posture the painter and the feed read: they run outside React's render, and a posture read
   * from a stale closure would draw a layer a reader has already hidden.
   */
  stateRef: { current: ViewerState };
  rows: LayerRow[];
  /** Bumped whenever a layer's posture or arrival changes outside React's own state. */
  revision: number;
  /** How many of the roster's layers did not arrive — a sheet is settled at loaded plus failed. */
  failedCount: number;
  /** The layers being painted right now, as one value an effect can be keyed on. */
  drawnLayers: string;
  /** The layers a rectangle or a click may take from: drawn, and not locked out of the hit-test. */
  openLayers: () => string[];
  /** The layers that may not answer a question: locked where it is takeable, and undrawn always. */
  shutLayers: (takeable: boolean) => string[];
  /** A layer's geometry did not arrive, or arrived after all: the row says so, and stays (I-81). */
  markFailed: (name: string, failed: boolean) => void;
  setVisible: (name: string, visible: boolean) => void;
  isolate: (name: string) => void;
  lock: (name: string, locked: boolean) => void;
}

export function useLayers({ head }: LayerPostureOptions): LayerPosture {
  const [revision, bump] = useReducer((count: number) => count + 1, 0);
  /** Every layer whose geometry did not arrive, kept across the postures the head rebuilds (I-81). */
  const failedRef = useRef<Set<string>>(new Set());

  const state = useMemo(() => {
    const made = createViewerState(head ?? { kind: "absent", reason: "not-ingested" });
    for (const name of failedRef.current) made.markLayerFailed(name, true);
    return made;
  }, [head]);

  const stateRef = useRef(state);
  stateRef.current = state;

  const rows = state.layerRows();

  const openLayers = useCallback(
    (): string[] =>
      stateRef.current
        .layerRows()
        .filter((row) => row.drawn && !row.locked)
        .map((row) => row.name),
    [],
  );

  const shutLayers = useCallback(
    (takeable: boolean): string[] =>
      // The postures travel with the question (Decision § 1): the index holds the whole sheet, and a
      // layer the reader locked or is not looking at may not answer for it. A locked layer is
      // painted and out of the hit-test; a layer that is not drawn is not there to point at, and a
      // selection a reader cannot see is a copyable list of ghosts (I-87).
      stateRef.current
        .layerRows()
        .filter((row) => (takeable && row.locked) || !row.drawn)
        .map((row) => row.name),
    [],
  );

  const markFailed = useCallback((name: string, failed: boolean): void => {
    if (failed) failedRef.current.add(name);
    else failedRef.current.delete(name);
    stateRef.current.markLayerFailed(name, failed);
    bump();
  }, []);

  const setVisible = useCallback((name: string, visible: boolean): void => {
    stateRef.current.setLayerVisible(name, visible);
    bump();
  }, []);

  const isolate = useCallback((name: string): void => {
    stateRef.current.isolateLayer(stateRef.current.isolatedLayer() === name ? null : name);
    bump();
  }, []);

  const lock = useCallback((name: string, locked: boolean): void => {
    stateRef.current.lockLayer(name, locked);
    bump();
  }, []);

  const drawnLayers = rows
    .filter((row) => row.drawn)
    .map((row) => row.name)
    .join("\n");

  return {
    state,
    stateRef,
    rows,
    revision,
    failedCount: failedRef.current.size,
    drawnLayers,
    openLayers,
    shutLayers,
    markFailed,
    setVisible,
    isolate,
    lock,
  };
}

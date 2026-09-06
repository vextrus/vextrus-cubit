/**
 * The layer posture of the open sheet: what the panel renders, what the painter draws and what the
 * hit-test may answer for (R-TO-010's layers panel, Decision § 1).
 *
 * The posture is rebuilt whenever the head changes, so what the feed learned about a layer that did
 * not arrive is held here rather than inside it — otherwise a failure recorded before the roster
 * rendered would be forgotten by the render that would have shown it (I-81).
 */
import { useCallback, useMemo, useReducer, useRef } from "react";
import type { RefObject } from "react";
import { createViewerState, type LayerRow, type ViewerState } from "../client";
import type { ViewerHead } from "../types";

export type UseLayersOptions = {
  head: ViewerHead | null;
};

export type UseLayers = {
  state: ViewerState;
  /** The posture the painter and the hit-test read: they run outside React's render. */
  stateRef: RefObject<ViewerState>;
  rows: LayerRow[];
  /** Bumped whenever a layer's posture or arrival changes outside React's own state. */
  revision: number;
  /** The layers being painted right now, as one value an effect can be keyed on. */
  drawnLayers: string;
  /** How many layers of this roster did not arrive — a reading the address settles on (I-88). */
  failedCount: number;
  markFailed: (name: string, failed: boolean) => void;
  /** The layers a rectangle or a click may take from: drawn, and not locked out of the hit-test. */
  openLayers: () => string[];
  setVisible: (name: string, visible: boolean) => void;
  isolate: (name: string) => void;
  setLocked: (name: string, locked: boolean) => void;
};

export function useLayers({ head }: UseLayersOptions): UseLayers {
  const [revision, bump] = useReducer((count: number) => count + 1, 0);
  const failedRef = useRef<Set<string>>(new Set());

  const state = useMemo(() => {
    const made = createViewerState(head ?? { kind: "absent", reason: "not-ingested" });
    for (const name of failedRef.current) made.markLayerFailed(name, true);
    return made;
  }, [head]);

  const stateRef = useRef(state);
  stateRef.current = state;

  /** A layer's geometry did not arrive, or arrived after all: the row says so, and stays (I-81). */
  const markFailed = useCallback((name: string, failed: boolean): void => {
    if (failed) failedRef.current.add(name);
    else failedRef.current.delete(name);
    stateRef.current.markLayerFailed(name, failed);
    bump();
  }, []);

  const openLayers = useCallback(
    (): string[] =>
      stateRef.current
        .layerRows()
        .filter((row) => row.drawn && !row.locked)
        .map((row) => row.name),
    [],
  );

  const setVisible = useCallback((name: string, visible: boolean): void => {
    stateRef.current.setLayerVisible(name, visible);
    bump();
  }, []);

  const isolate = useCallback((name: string): void => {
    stateRef.current.isolateLayer(stateRef.current.isolatedLayer() === name ? null : name);
    bump();
  }, []);

  const setLocked = useCallback((name: string, locked: boolean): void => {
    stateRef.current.lockLayer(name, locked);
    bump();
  }, []);

  // Read on every render rather than remembered: a posture change bumps the revision above, which is
  // what brings this render about, so the rows are always the posture as it now stands.
  const rows = state.layerRows();
  const drawnLayers = rows
    .filter((row) => row.drawn)
    .map((row) => row.name)
    .join("\n");

  return {
    state,
    stateRef,
    rows,
    revision,
    drawnLayers,
    failedCount: failedRef.current.size,
    markFailed,
    openLayers,
    setVisible,
    isolate,
    setLocked,
  };
}

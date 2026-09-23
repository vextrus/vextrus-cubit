"use client";
/**
 * Whether a control stands inside a grid cell — the one fact a control needs to take its part in an
 * aria grid's roving focus (R-UI-012, Design Direction 00 §5 rule 6).
 *
 * A grid is ONE Tab stop: the cell under the cursor. A control a cell holds — an IdChip's value and
 * its copy, an EvidenceLink — is reached by moving the cursor to its cell and pressing Enter or F2
 * (the DataTable's own cell keys), never by a Tab stop of its own: the served register put a copy
 * control on every one of its 424 lines, and every one was a Tab stop between the reader and the
 * screen after the grid (craft look, session 7). The DataTable's body cell states the scope; a
 * control outside any grid never hears it and keeps its own place in the Tab order.
 *
 * Not published by the barrel: it is a rule the primitives are built from, not a primitive (see
 * `index.ts`), read by the controls that need it straight from this file.
 */
import { createContext, useContext } from "react";

const GridCellContext = createContext(false);

/** Stated by the grid's body cell around what it renders, and by nothing else. */
export const GridCellScope = GridCellContext.Provider;

/** True inside a grid's body cell: the control is reached through the cell, not by Tab. */
export function useInGridCell(): boolean {
  return useContext(GridCellContext);
}

/**
 * The tabindex a control takes inside a grid cell, or `undefined` where it keeps its own: out of the
 * Tab order, still focusable — by the cell's Enter/F2, by a pointer, and by a screen that puts focus
 * back where a reader left it.
 */
export function cellControlTabIndex(inGridCell: boolean): -1 | undefined {
  return inGridCell ? -1 : undefined;
}

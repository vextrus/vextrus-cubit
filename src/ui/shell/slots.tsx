"use client";
/**
 * THE FRAME'S TWO REMAINING SLOTS — the 32 px tool row and the 24 px readout (Direction §1, §3.1).
 *
 * `AppShell` is rendered by the route's server layout and every screen is its `children`, so a
 * screen cannot hand the frame a prop: props travel down, and the tools belong to the screen that
 * is three levels below the frame that draws them. The inspector settled this shape already
 * (`inspector.tsx`) — the frame publishes a slot, the screen mounts through a hook — and these are
 * the same slot twice more, so the frame has ONE way of being filled rather than three.
 *
 * Why a slot at all, and not a region each screen draws for itself: the tool row and the readout
 * are CHROME. Their height is the grid's (`--toolbar-h`, `--status-h`) and the work-surface law is
 * arithmetic over that grid (tests/ui/shell/work-surface-share.test.ts). A screen that drew its own
 * 32 px strip inside `shell-main` would spend the canvas's height on it and the law would read as
 * kept while the canvas shrank — which is exactly the fault §8 scores the viewer 1 on C1 for.
 *
 * The prop on `AppShell` stays what it was: a frame mounted without a screen (the gallery's
 * evidence renderer) still states a readout, and a screen that mounts through the hook overrides it
 * for as long as that screen is on. Leaving the screen puts the frame's own back.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface Slots {
  readonly toolbar: ReactNode | null;
  readonly setToolbar: (node: ReactNode | null) => void;
  readonly status: ReactNode | null;
  readonly setStatus: (node: ReactNode | null) => void;
}

const SlotsContext = createContext<Slots | null>(null);

export function ShellSlotsProvider({ children }: { children: ReactNode }) {
  const [toolbar, setToolbar] = useState<ReactNode | null>(null);
  const [status, setStatus] = useState<ReactNode | null>(null);
  const slots = useMemo<Slots>(() => ({ toolbar, setToolbar, status, setStatus }), [toolbar, status]);
  return <SlotsContext.Provider value={slots}>{children}</SlotsContext.Provider>;
}

/**
 * What a screen mounts its tool row through. Hand it the groups; hand it `null` and the track
 * collapses to zero rather than standing as an empty strip — the inspector's own law (R-UI-080).
 * A screen rendered outside the frame finds no provider and this is a no-op, so no component is
 * ever made to know whether it is inside the shell.
 */
export function useShellToolbar(toolbar: ReactNode | null): void {
  const set = useContext(SlotsContext)?.setToolbar;
  useEffect(() => {
    if (set === undefined) return;
    set(toolbar);
    return () => set(null);
  }, [set, toolbar]);
}

/** The same, for the readout: the screen owns the cells, the frame owns the line (§3.1). */
export function useShellStatus(status: ReactNode | null): void {
  const set = useContext(SlotsContext)?.setStatus;
  useEffect(() => {
    if (set === undefined) return;
    set(status);
    return () => set(null);
  }, [set, status]);
}

/** The slots as the frame reads them. Absent provider = both empty, which is the frame's default. */
export function useShellSlots(): { toolbar: ReactNode | null; status: ReactNode | null } {
  const slots = useContext(SlotsContext);
  if (slots === null) return { toolbar: null, status: null };
  return { toolbar: slots.toolbar, status: slots.status };
}

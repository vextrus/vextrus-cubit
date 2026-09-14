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
 *
 * BOTH HOOKS ANSWER WHETHER THE FRAME TOOK THE REGION, and that answer is the whole of their
 * contract with a screen rendered outside one. A screen mounted without the frame — a jsdom test of
 * the viewer, the gallery's evidence renderer — handed its readout to a no-op and lost it: the
 * region simply did not exist, and the first thing that noticed was an assertion looking for a
 * readout that a person would also have looked for and not found. `useInspector` may answer nothing
 * because an inspector with no frame has nowhere to be; a READOUT and a TOOL ROW are the screen's own
 * content and always have somewhere to be, which is where they stand when no frame claims them.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface Slots {
  readonly toolbar: ReactNode | null;
  readonly setToolbar: (node: ReactNode | null) => void;
  readonly status: ReactNode | null;
  readonly setStatus: (node: ReactNode | null) => void;
  /** The name of the screen inside the area — the breadcrumb's last crumb (R-UI-084). */
  readonly page: string | null;
  readonly setPage: (name: string | null) => void;
}

const SlotsContext = createContext<Slots | null>(null);

export function ShellSlotsProvider({ children }: { children: ReactNode }) {
  const [toolbar, setToolbar] = useState<ReactNode | null>(null);
  const [status, setStatus] = useState<ReactNode | null>(null);
  const [page, setPage] = useState<string | null>(null);
  const slots = useMemo<Slots>(() => ({ toolbar, setToolbar, status, setStatus, page, setPage }), [toolbar, status, page]);
  return <SlotsContext.Provider value={slots}>{children}</SlotsContext.Provider>;
}

/**
 * What a screen mounts its tool row through. Hand it the groups; hand it `null` and the track
 * collapses to zero rather than standing as an empty strip — the inspector's own law (R-UI-080).
 * A screen rendered outside the frame finds no provider and this is a no-op, so no component is
 * ever made to know whether it is inside the shell.
 */
export function useShellToolbar(toolbar: ReactNode | null): boolean {
  const set = useContext(SlotsContext)?.setToolbar;
  useEffect(() => {
    if (set === undefined) return;
    set(toolbar);
    return () => set(null);
  }, [set, toolbar]);
  return set !== undefined;
}

/**
 * The same, for the readout: the screen owns the cells, the frame owns the line (§3.1).
 * Answers whether a frame took it; `false` means the screen renders it where it stands.
 */
export function useShellStatus(status: ReactNode | null): boolean {
  const set = useContext(SlotsContext)?.setStatus;
  useEffect(() => {
    if (set === undefined) return;
    set(status);
    return () => set(null);
  }, [set, status]);
  return set !== undefined;
}

/**
 * The same again, for the crumb R-UI-084 makes every screen declare: "the breadcrumb always names
 * workspace, project, area and page". The frame draws the trail above every area and a screen is its
 * `children`, so the page a reader is on reaches the top bar the way its tool row and its readout
 * already do — through the slot, rather than by the frame guessing at the address (B-17).
 */
export function useShellPage(page: string | null): boolean {
  const set = useContext(SlotsContext)?.setPage;
  useEffect(() => {
    if (set === undefined) return;
    set(page);
    return () => set(null);
  }, [set, page]);
  return set !== undefined;
}

/** The slots as the frame reads them. Absent provider = all empty, which is the frame's default. */
export function useShellSlots(): { toolbar: ReactNode | null; status: ReactNode | null; page: string | null } {
  const slots = useContext(SlotsContext);
  if (slots === null) return { toolbar: null, status: null, page: null };
  return { toolbar: slots.toolbar, status: slots.status, page: slots.page };
}

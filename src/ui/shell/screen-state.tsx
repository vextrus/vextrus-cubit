"use client";
/**
 * What the screen root publishes about itself, and what makes the whole journey suite deterministic:
 * `settled()` waits for `[data-testid="shell-main"]` to carry a `data-state` that is not `loading`,
 * so a capture is never taken of a frame mid-flight (V-E2E, AM-09 §4).
 *
 * The five values are R-UI-050's own states as a screen root can report them: `loading` while the
 * screen is still fetching, then one of `ready` (it has what it asked for), `empty` (it asked and
 * there is nothing), `error` (a fault the boundary owns) or `refused` (a registered refusal,
 * R-SPINE-062). The clause's `partial`, `offline` and `permission-denied` are read by the region
 * that renders them and are not a state of the whole screen — `permission-denied` arrives here as
 * `refused`, which is what it is: the door said no by name.
 *
 * A screen that declares nothing is `ready`. That is the honest default for every screen the product
 * already ships: they are server-rendered and hold what they render by the time the frame paints.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** The five a screen root can be in. One home, so the suite and the shell read the same word. */
export const SCREEN_ROOT_STATES = ["loading", "ready", "empty", "error", "refused"] as const;

export type ScreenRootState = (typeof SCREEN_ROOT_STATES)[number];

/** What the frame paints when no screen has declared anything. */
export const SCREEN_ROOT_DEFAULT: ScreenRootState = "ready";

interface ScreenStateSlot {
  readonly state: ScreenRootState;
  readonly declare: (state: ScreenRootState | null) => void;
}

const ScreenStateContext = createContext<ScreenStateSlot | null>(null);

/** The frame's own publication of the state; the shell mounts exactly one of these. */
export function ScreenStateProvider({ children }: { children: ReactNode }) {
  const [declared, setDeclared] = useState<ScreenRootState | null>(null);
  return (
    <ScreenStateContext.Provider value={{ state: declared ?? SCREEN_ROOT_DEFAULT, declare: setDeclared }}>
      {children}
    </ScreenStateContext.Provider>
  );
}

/**
 * What a screen says about itself. A screen outside the frame — the gallery's evidence renderer is
 * one — finds no provider and this is a no-op, so no component has to know where it is mounted.
 */
export function useDeclareScreenState(state: ScreenRootState): void {
  const slot = useContext(ScreenStateContext);
  const declare = slot?.declare;
  useEffect(() => {
    if (declare === undefined) return;
    declare(state);
    // Leaving puts the frame back to its default rather than leaving the last screen's word standing
    // over the next one — a stale `empty` would settle a suite on a screen that is still loading.
    return () => declare(null);
  }, [declare, state]);
}

/** What the frame publishes right now — read by `shell-main`, and by nothing else. */
export function useScreenState(): ScreenRootState {
  return useContext(ScreenStateContext)?.state ?? SCREEN_ROOT_DEFAULT;
}

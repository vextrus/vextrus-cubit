"use client";
/**
 * The app's clock, injected (Design Direction 00 §9.1 item 7's frozen picture tenant).
 *
 * `Date.now()` inside a render makes a component that cannot be photographed and cannot be tested:
 * the same props produce a different tree every millisecond, and the evidence suite's frozen clock
 * has nothing to freeze. So the reading of "now" is a value the app supplies — once, at the top —
 * and a component that needs it either takes an explicit `now` prop or reads this.
 *
 * There is no default. A tree with no clock in it has no "now", and `RelativeTime` says the date
 * instead of inventing one.
 */
import { createContext, useContext, type ReactNode } from "react";

/** A reading of the present, or a function that takes one on demand. */
export type Clock = Date | (() => Date);

const ClockContext = createContext<Clock | null>(null);

export interface ClockProviderProps {
  now: Clock;
  children?: ReactNode;
}

export function ClockProvider({ now, children }: ClockProviderProps): ReactNode {
  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

/** The present as this tree was told it, or `null` where nobody told it (B-17). */
export function useClock(): Date | null {
  const clock = useContext(ClockContext);
  if (clock === null) return null;
  return typeof clock === "function" ? clock() : clock;
}

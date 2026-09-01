"use client";
// How a shell screen hands a failed action to the error boundary (ARCH-03, B-21).
//
// A client component cannot answer an outage where it happens: the rejection arrives inside a
// transition callback, long after the render that could have thrown it. Closing over it and saying
// nothing is the shrug the law forbids — the control stops being busy and the screen claims nothing
// happened. So the rejection is held in state and re-thrown while rendering, which is the one way a
// client component reaches the boundary the shell's state matrix names as its `error` home
// (src/app/error.tsx): a report id and a retry.
//
// It lives here, once, because both shell screens that take an action need it — the top bar's
// sign-out and the projects screen's SAMPLE offer — and a second copy of a failure discipline is
// how the two drift apart (B-17).
import { useCallback, useState } from "react";

/**
 * Wraps the work an action does so a rejection reaches the error boundary instead of being lost.
 * Call it inside the transition: `start(() => handing(async () => { … }))`.
 */
export function useFailureHandOff(): (work: () => Promise<void>) => Promise<void> {
  const [failure, setFailure] = useState<unknown>(null);
  // Re-thrown during render, which is what the boundary observes; state is what carries it there.
  if (failure !== null) throw failure;

  return useCallback(async (work: () => Promise<void>): Promise<void> => {
    try {
      await work();
    } catch (cause) {
      setFailure(cause);
    }
  }, []);
}

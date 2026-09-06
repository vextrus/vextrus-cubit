/**
 * A ref handed to a hook as an option, read and written through one object of that hook's own.
 *
 * A caller may spell a ref inline — `stageRef: { current: stage }` — which is a *new object every
 * render*. An effect or a callback that lists the handed ref among its dependencies would then be
 * rebuilt on every render, and an effect that sets state would never stop. Nothing here copies the
 * value: reads and writes both go straight through to whatever ref is held right now, so a camera
 * written by one hook is the camera another hook reads on the same tick. Every hook under this
 * directory reads a handed ref through this, so the answer to it has one home (B-17).
 */
import { useRef } from "react";
import type { RefObject } from "react";

export function useHandedRef<T>(handed: RefObject<T> | undefined, initial: T): RefObject<T> {
  const latest = useRef(handed);
  latest.current = handed;
  const own = useRef<T>(initial);
  const held = useRef<RefObject<T> | null>(null);
  held.current ??= {
    get current(): T {
      const outer = latest.current;
      return outer === undefined ? own.current : outer.current;
    },
    set current(value: T) {
      const outer = latest.current;
      if (outer === undefined) own.current = value;
      else outer.current = value;
    },
  };
  return held.current;
}

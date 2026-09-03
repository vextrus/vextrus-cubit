// "At most once a window, per process", in its one home (ARCH-02, B-17). Three things this tree does
// are due on that schedule and nothing finer — the outage an unconfigured deployment stands in, the
// hygiene pass over the auth tables, and the outbox's retention sweep — and each of them was once its
// own hand-rolled `Symbol.for` memo with its own subtly different bookkeeping. One memo answers all
// three, and every one of them can be armed again by a caller that needs to (`reset`).

/**
 * A schedule something is due on. `due` is the whole decision: it answers whether the caller is the
 * one to do the work *and* records that it was asked, in the same synchronous step, so two callers
 * inside one window can never both be told yes — an asynchronous check followed by a later stamp is
 * exactly the race a burst wins.
 */
export interface OncePerWindow {
  due(now: number): boolean;
  reset(): void;
}

/** What one schedule remembers: the window it runs on, and when it last said yes. */
interface Stamp {
  windowMs: number;
  at: number;
}

/**
 * The schedule named `name`, held on the process rather than in the module.
 *
 * A module loaded twice — a test's own graph beside the server's, a bundler's two copies — is two
 * sets of module-level state and therefore two allowances of one window. The stamp is anchored on a
 * `Symbol.for` key instead, which is the process's own registry, so both instances share the one
 * memo and the window means what it says.
 *
 * The window is anchored with the stamp, because it is part of the same one schedule: two callers
 * opening one name over different periods would share a stamp while each enforcing its own idea of
 * how long it lasts, which is two schedules wearing one name. That is a mistake in the caller, and
 * the primitive says so at the point it is made rather than letting the name silently mean two things.
 * Every caller opens its schedule at module scope, so that throw aborts module evaluation at boot —
 * deliberately, since a programmer error in the schedule's own definition has no request to be
 * reported against and no user-facing answer to map to (ARCH-03 governs failures on the request path).
 */
export function oncePerWindow(name: string, windowMs: number): OncePerWindow {
  const key = Symbol.for(`vextrus.cubit.server.auth.once-per-window:${name}`);
  const scope = globalThis as typeof globalThis & Record<symbol, Stamp | undefined>;
  const stamp: Stamp = (scope[key] ??= { windowMs, at: Number.NEGATIVE_INFINITY });
  if (stamp.windowMs !== windowMs) {
    throw new Error(
      `the schedule "${name}" is already open on a ${stamp.windowMs} ms window and cannot also run on ${windowMs} ms: one name is one schedule (B-17)`,
    );
  }

  return {
    due(now: number): boolean {
      if (now - stamp.at < stamp.windowMs) return false;
      stamp.at = now;
      return true;
    },
    reset(): void {
      stamp.at = Number.NEGATIVE_INFINITY;
    },
  };
}

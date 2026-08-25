// SEAM-TENANT: `runAsSystem`'s reason is recorded and attributable, never validated-then-discarded.
// The recorder is a hook rather than a direct call because ARCH-03's fault seam is not built yet:
// when it is, it is pointed at from here once, and no caller of runAsSystem changes.

/** What a system-scoped handle was opened for, and when it was opened. */
export type SystemReasonRecord = { readonly reason: string; readonly openedAt: Date };

/** Where a system reason is recorded. ARCH-03's fault seam becomes this. */
export type SystemReasonRecorder = (record: SystemReasonRecord) => void;

/** The recorder in force. Undefined until something is listening — never a swallowed value. */
let recorder: SystemReasonRecorder | undefined;

/**
 * Point every system reason at `next`. One home for the wiring, so the fault seam is reached from
 * the seam and from nowhere else (ARCH-02).
 */
export function recordSystemReasonsWith(next: SystemReasonRecorder): void {
  recorder = next;
}

/**
 * The reason a system-scoped handle may be opened for: a non-empty one, recorded as it is taken.
 * A reason that is only whitespace attributes nothing, so no handle is made from it at all.
 */
export function attributableReason(reason: string): string {
  const attributed = reason.trim();
  if (attributed === "") {
    throw new Error("runAsSystem(reason) needs a reason that attributes the work — an empty reason names nobody (SEAM-TENANT)");
  }
  recorder?.({ reason: attributed, openedAt: new Date() });
  return attributed;
}

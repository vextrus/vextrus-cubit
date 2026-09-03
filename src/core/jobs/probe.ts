// The built-in `probe` kind (R-SPINE-030). It exists so that every path a job can take — steps
// with timings, a retry to exhaustion, a named refusal, a clean success — can be driven from
// outside by an operator or by a test, before any real kind exists to drive them with.
import { refusal } from "../faults/refusal-marker";
import type { JobPayloads } from "./kinds";

/** What a running job is given: its own temp dir, and the way to say where it has got to. */
export type JobProgress = {
  /** Which job this attempt is of, so a handler's own writes can be idempotent on it (SEAM-JOBS). */
  readonly jobId: string;
  /** Per invocation, made before the attempt starts and taken away after it ends (R-SPINE-031). */
  readonly tempDir: string;
  /** One step, recorded durably before the next one begins. */
  step: (name: string, detail?: Record<string, unknown>) => Promise<void>;
};

/** Wait, without holding a connection or a slot open for anything else while waiting. */
function pause(ms: number): Promise<void> {
  return new Promise((settle) => setTimeout(settle, ms));
}

/**
 * Walk the steps the payload names, recording each one as it completes. A step named by
 * `failAtStep` throws a plain failure — which the seam retries and finally reports as a fault — and
 * `refuseWith` ends the whole run as the named refusal, which is an answer rather than a fault, so
 * it is never retried.
 */
export async function runProbe(payload: JobPayloads["probe"], progress: JobProgress): Promise<void> {
  const stepDelayMs = payload.stepDelayMs ?? 0;
  for (const step of payload.steps) {
    if (stepDelayMs > 0) await pause(stepDelayMs);
    await progress.step(step);
    if (step === payload.failAtStep) throw new Error(`the probe was told to fail at step "${step}"`);
  }
  if (payload.refuseWith !== undefined) {
    throw refusal(payload.refuseWith, `the probe was told to answer ${payload.refuseWith}`);
  }
}

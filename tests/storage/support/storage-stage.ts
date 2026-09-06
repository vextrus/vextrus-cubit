/**
 * The mechanics the app storage acceptance runs on (AC-1, AC-2).
 *
 * Mechanics only — nothing here judges the product. Every name below is one the increment's
 * interface list or its test contract publishes: the environment names, the fault record's route,
 * actor, request id and cause prefix. No product source is read; the seam is driven through the
 * doors it publishes.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setFaultSink, type FaultRecord } from "../../../src/core/faults/report";

/** The environment names this acceptance states or withholds (C-05). */
export const ROOT_VAR = "STORAGE_ROOT";
export const SECRET_VAR = "CUBIT_STORAGE_SIGNING_SECRET";
export const MODE_VAR = "NODE_ENV";

/** The fault record a minted secret is warned about under (C-05, ARCH-03). */
export const SIGNING_ROUTE = "storage: signing secret";
export const STORAGE_ACTOR = "storage";
export const STORAGE_REQUEST_ID = "storage";
export const WARNING_PREFIX = "warning: ";

/** A tenant prefix the seam will touch the filesystem for: a canonical lowercase UUID. */
export function aTenant(): string {
  return randomUUID();
}

/** An address as the seam spells one: exactly 64 lowercase hex characters. */
export function addressOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** A directory no earlier case has stored anything under, so `appStorage()` is rebuilt on it. */
export function freshRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "cubit-storage-secret-"));
}

/** The fault sink swapped in for one file, and what it heard. */
export interface CollectedFaults {
  /** Every record the seam reported while this sink was in place. */
  all(): FaultRecord[];
  /** Just the records filed under the signing-secret route. */
  signingWarnings(): FaultRecord[];
  /** Put back the sink that was in place before (never leave a host's sink swapped out). */
  restore(): void;
}

/** Swap the one fault sink for a collector, answering with what it hears and how to put it back. */
export function collectFaults(): CollectedFaults {
  const records: FaultRecord[] = [];
  const previous = setFaultSink((record) => {
    records.push(record);
  });
  return {
    all: () => [...records],
    signingWarnings: () => records.filter((record) => record.route === SIGNING_ROUTE),
    restore: () => {
      setFaultSink(previous);
    },
  };
}

/**
 * What a synchronous call threw, for a criterion that judges the thrown value rather than the mere
 * fact of a throw. A call that answers instead of throwing is itself the failure, and it is raised
 * with what it answered so the case reads as what it is.
 */
export function thrownBy(act: () => unknown): unknown {
  let answered: unknown;
  try {
    answered = act();
  } catch (thrown) {
    return thrown;
  }
  throw new Error(`the call was expected to refuse and answered ${String(answered)} instead`);
}

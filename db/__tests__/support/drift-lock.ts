// The schema-drift lane's lock. Two suites reach the drift lane: tenancy-base.migration runs
// `scripts/db-drift.mjs --scratch` over the committed seam, and drift-lane-breaker MUTATES the seam
// (src/core/db.ts, db/schema.ts) to prove the lane cannot exit 0 over drift. Run at once — the
// database lane's files run four at a time — the breaker's mutation is what the drift run reads,
// and a pure tree reads as drift. One lock, held by whoever touches the seam or reads it through
// the lane; every other file in the lane keeps its own scratch database and runs beside them.
//
// Atomic `mkdir` on a directory under the OS temp dir keyed by the repo root; a lock older than ten
// minutes is a dead holder's and is taken over. Synchronous (the callers use spawnSync inside `it`).
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const LOCK = join(tmpdir(), `cubit-drift-lock-${createHash("sha1").update(ROOT).digest("hex").slice(0, 10)}`);
const STALE_MS = 10 * 60_000;
const WAIT_MS = 5 * 60_000;

const sleep = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

export function acquireDriftLock(): void {
  const startedAt = Date.now();
  for (;;) {
    try {
      mkdirSync(LOCK);
      return;
    } catch {
      let age: number;
      try {
        age = Date.now() - statSync(LOCK).mtimeMs;
      } catch {
        continue; // released between our attempt and the stat
      }
      if (age > STALE_MS) {
        rmSync(LOCK, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - startedAt > WAIT_MS) throw new Error(`the schema-drift lock at ${LOCK} was held for over ${WAIT_MS / 60_000} minutes`);
      sleep(200);
    }
  }
}

export function releaseDriftLock(): void {
  rmSync(LOCK, { recursive: true, force: true });
}

export function withDriftLock<T>(fn: () => T): T {
  acquireDriftLock();
  try {
    return fn();
  } finally {
    releaseDriftLock();
  }
}

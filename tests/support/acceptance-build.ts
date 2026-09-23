/**
 * ONE BUILD OF THE PRODUCT FOR EVERY LIVE ACCEPTANCE SUITE (V-DB, ARCH-02, B-19).
 *
 * The suites that serve the BUILT product against a scratch database — members, invitations, the
 * sheets route — each compiled the whole tree into a dist directory of their own, concurrently, in
 * the middle of the database lane. Three compiles of one tree; three rewrites of the shared
 * `next-env.d.ts` shim and of `tsconfig.json`'s include list while each other's type-check read
 * them; and, under load, one of them red. The tree is one tree: it is built once, by the first
 * process that asks, into `.next-acceptance`, and every later asker in the same run finds it current
 * and serves it — the journeys' server's own `build-if-stale` reading of the tree
 * (scripts/lib/build-currency.mjs), so what "current" means has one home.
 *
 * The lock is a directory, made atomically (`mkdir` either makes it or fails EEXIST) and holding
 * the pid of the process that made it, so a lock a dead process left behind is taken over rather
 * than waited on forever. The wait is synchronous on purpose: a suite's staging is `await`ed at the
 * top of its first case, and a build is a thing to wait for, not to interleave with.
 *
 * `next start` from several processes over one dist directory is read-only over it, and each suite
 * still serves on a port of its own with its own scratch database and public origin.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { withDriftLock } from "../../db/__tests__/support/drift-lock";
import { buildIsCurrent } from "../../scripts/lib/build-currency.mjs";
import { writeBuildStamp } from "../../scripts/lib/build-stamp.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

/** The one dist directory every live acceptance suite serves from. `.next*` — the ignores cover it. */
export const ACCEPTANCE_DIST = ".next-acceptance";

/** Where the lock stands: beside the dist directory, itself under the `.next*` ignore. */
export function lockPathOf(root: string): string {
  return join(root, `${ACCEPTANCE_DIST}.lock`);
}

/** How long an asker waits on a live holder before it gives up: a compile of this tree is under two minutes. */
const DEFAULT_WAIT_MS = 10 * 60_000;
const POLL_MS = 250;

export interface EnsureBuildOptions {
  /** The checkout. The repository root unless a test says otherwise. */
  readonly root?: string;
  /** The build step: the exit status of `next build`. Injected by the unit test; the real one below. */
  readonly build?: (root: string, env: NodeJS.ProcessEnv) => number;
  /** The environment the real build runs under (NEXT_DIST_DIR is set here regardless). */
  readonly env?: NodeJS.ProcessEnv;
  readonly waitMs?: number;
}

export interface EnsuredBuild {
  readonly distDir: string;
  readonly built: boolean;
  readonly why: string;
}

/** Sleep without a promise: the wait sits inside a lock this synchronous function holds nothing for yet. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function holderOf(lock: string): number | null {
  try {
    const pid = Number(readFileSync(join(lock, "pid"), "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/** Take the lock, waiting on a live holder and taking over a dead one's leavings. */
function acquire(lock: string, waitMs: number): void {
  const started = Date.now();
  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, "pid"), `${process.pid}\n`);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const holder = holderOf(lock);
    if (holder === null || !isAlive(holder)) {
      rmSync(lock, { recursive: true, force: true });
      continue;
    }
    if (Date.now() - started > waitMs) {
      throw new Error(`another process has held the acceptance build lock at ${lock} (pid ${holder}) for over ${Math.round(waitMs / 1000)}s`);
    }
    sleepSync(POLL_MS);
  }
}

/**
 * The real build step: `next build` into the acceptance dist directory, the product's own compile.
 *
 * It compiles UNDER THE DRIFT LOCK (db/__tests__/support/drift-lock.ts). drift-lane-breaker proves
 * the schema-drift lane by rewriting tracked source in place: it renames `tenants.name` in
 * `src/core/db/schema-tenants.ts`, which is valid TypeScript, then restores it. A compile that read
 * the seam inside that window succeeded, and it served a product that queried `tenants.title`. Every
 * page answered 500. Session 7 saw it once in the whole db lane (sheets/route-render, "expected 500 to
 * be 200" three times, green alone). It was reproduced exactly by renaming the column only while this
 * build held its lock. The stamp is taken at the build's start, so the breaker's restore always made
 * the next asker rebuild. Only the suite served from the window went red.
 */
function nextBuild(root: string, env: NodeJS.ProcessEnv): number {
  const next = join(root, "node_modules", ".bin", "next");
  const result = withDriftLock(() => spawnSync(next, ["build"], { cwd: root, env, encoding: "utf8", timeout: 420_000 }));
  if (result.status !== 0) {
    const said = `${result.stdout ?? ""}${result.stderr ?? ""}`.slice(-1500);
    process.stderr.write(`acceptance build: next build exited ${String(result.status)}\n${said}\n`);
  }
  return result.status ?? 1;
}

/**
 * The built product this run serves, made if this tree has not been built since it last changed.
 * Synchronous and serialised across processes by the lock; answers what it did and why.
 */
export function ensureAcceptanceBuild(options: EnsureBuildOptions = {}): EnsuredBuild {
  const root = options.root ?? REPO_ROOT;
  const build = options.build ?? nextBuild;
  const lock = lockPathOf(root);
  acquire(lock, options.waitMs ?? DEFAULT_WAIT_MS);
  try {
    const verdict = buildIsCurrent(root, ACCEPTANCE_DIST);
    if (verdict.current) return { distDir: ACCEPTANCE_DIST, built: false, why: verdict.why };

    const env: NodeJS.ProcessEnv = { ...(options.env ?? process.env), NEXT_DIST_DIR: ACCEPTANCE_DIST };
    // Taken BEFORE the build reads anything, and written only once it has succeeded: an edit made
    // while the build ran is at-or-after this instant, so the next asker rebuilds.
    const startedMs = Date.now();
    const status = build(root, env);
    if (status !== 0) throw new Error(`next build failed with exit ${status} (${verdict.why})`);
    mkdirSync(join(root, ACCEPTANCE_DIST), { recursive: true });
    writeBuildStamp(join(root, ACCEPTANCE_DIST), startedMs);
    if (!existsSync(join(root, ACCEPTANCE_DIST, "BUILD_ID"))) throw new Error(`next build exited 0 but left no ${ACCEPTANCE_DIST}/BUILD_ID behind`);
    return { distDir: ACCEPTANCE_DIST, built: true, why: verdict.why };
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

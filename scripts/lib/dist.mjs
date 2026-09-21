// The journey lane's build output: where it is, and how a live server says it is holding it
// (ARCH-02 — one home, because two scripts have to agree about it or one of them deletes the other's
// bundle).
//
// `pnpm e2e:clean` matched every `.next*` directory, which includes the default distDir the
// journeys' own server builds into AND SERVES FROM: a sweep run beside a live journey run deleted
// the bundle out from under the process answering requests from it. So the server now writes a lock
// while it serves, and the sweep reads it.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The distDir the product builds into by default — the one `next start` serves, and the one
 * scripts/e2e-server.mjs reuses when it is current. NEXT_DIST_DIR overrides it for a stage that
 * wants its own (next.config.ts takes the same reading, and `next build` locks `<distDir>/lock`, so
 * two stages sharing one make the second exit rather than wait).
 */
export const DEFAULT_DIST_DIR = process.env["NEXT_DIST_DIR"] ?? ".next-cubit";

/** The distDir dedicated to the dev lane, kept separate from the built product and e2e. */
export const DEV_DIST_DIR = ".next-dev";

/** The file a serving process writes inside the dist directory it is serving from. */
export const SERVER_LOCK = ".e2e-server.lock";

/** The file a dev server writes inside its dist directory while running. */
export const DEV_SERVER_LOCK = ".dev-server.lock";

/**
 * The pid of the process serving from this directory, if one says it is — or null. A lock naming a
 * pid that is not running holds nothing: a server killed without cleanup must not lock a directory
 * forever.
 * @param {string} dir the dist directory, as an absolute path
 * @param {string} [lockName=SERVER_LOCK] the lock file name
 * @returns {number|null}
 */
export function heldBy(dir, lockName = SERVER_LOCK) {
  let pid;
  try {
    pid = Number(/** @type {{pid?: unknown}} */ (JSON.parse(readFileSync(join(dir, lockName), "utf8"))).pid);
  } catch {
    return null;
  }
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    // Signal 0 asks whether the process exists without touching it.
    process.kill(pid, 0);
    return pid;
  } catch (error) {
    // EPERM means it exists and is somebody else's — which is still a live server.
    return /** @type {NodeJS.ErrnoException} */ (error).code === "EPERM" ? pid : null;
  }
}

/**
 * Say, inside the dist directory, that this process is serving from it — and take it back when the
 * process ends, however it ends. A sweep reads this and keeps the directory (scripts/e2e-clean.mjs);
 * a lock left by a process that died holds nothing, because `heldBy` asks the operating system
 * whether the pid is still there.
 * @param {string} dir the dist directory, as an absolute path
 * @param {number} port the port being served
 * @param {string} [lockName=SERVER_LOCK]
 * @returns {() => void} release it
 */
export function holdDistDir(dir, port, lockName = SERVER_LOCK) {
  const lock = join(dir, lockName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(lock, `${JSON.stringify({ pid: process.pid, port, at: new Date().toISOString() })}\n`);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    rmSync(lock, { force: true });
  };
  process.on("exit", release);
  return release;
}

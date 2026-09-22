// The journey lane's build output: where it is, and how a live server says it is holding it
// (ARCH-02 — one home, because two scripts have to agree about it or one of them deletes the other's
// bundle).
//
// `pnpm e2e:clean` matched every `.next*` directory, which includes the default distDir the
// journeys' own server builds into AND SERVES FROM: a sweep run beside a live journey run deleted
// the bundle out from under the process answering requests from it. So the server now writes a lock
// while it serves, and the sweep reads it.
//
// ONE FILE PER HOLDER (session 7, the demo). Two servers may serve one build at once — `next start`
// is read-only over its distDir — and since `pnpm demo` serves the journeys' build on a port of its
// own, a journey run in the same checkout now does exactly that beside it. With one lock file per
// directory the second server overwrote the first's claim, and whichever ended first deleted the
// file: the other server was then serving from a directory nothing said was held, which
// `pnpm e2e:clean --all` takes. Each holder now writes `<lock>.<pid>` and removes only its own, and
// the bare `<lock>` an older server wrote is still read.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
 * Is this pid a running process? Signal 0 asks without touching it; EPERM means it exists and is
 * somebody else's — which is still a live server.
 * @param {number} pid
 * @returns {boolean}
 */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return /** @type {NodeJS.ErrnoException} */ (error).code === "EPERM";
  }
}

/**
 * Every live process that says it is serving from this directory, with the port it said it serves,
 * in the order of their lock files' names. A lock naming a pid that is not running holds nothing: a
 * server killed without cleanup must not lock a directory forever.
 * @param {string} dir the dist directory, as an absolute path
 * @param {string} [lockName=SERVER_LOCK] the lock file name
 * @returns {{pid: number, port: number | null}[]}
 */
export function holdersOf(dir, lockName = SERVER_LOCK) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  /** @type {{pid: number, port: number | null}[]} */
  const holders = [];
  for (const name of names.filter((entry) => entry === lockName || entry.startsWith(`${lockName}.`)).sort()) {
    let said;
    try {
      said = /** @type {{pid?: unknown, port?: unknown}} */ (JSON.parse(readFileSync(join(dir, name), "utf8")));
    } catch {
      continue;
    }
    const pid = Number(said.pid);
    if (!Number.isInteger(pid) || pid <= 0 || !isAlive(pid)) continue;
    const port = Number(said.port);
    holders.push({ pid, port: Number.isInteger(port) && port > 0 ? port : null });
  }
  return holders;
}

/**
 * The pid of a process serving from this directory, if one says it is — or null.
 * @param {string} dir the dist directory, as an absolute path
 * @param {string} [lockName=SERVER_LOCK] the lock file name
 * @returns {number|null}
 */
export function heldBy(dir, lockName = SERVER_LOCK) {
  return holdersOf(dir, lockName)[0]?.pid ?? null;
}

/**
 * Say, inside the dist directory, that this process is serving from it — and take it back when the
 * process ends, however it ends. A sweep reads this and keeps the directory (scripts/e2e-clean.mjs);
 * a lock left by a process that died holds nothing, because `heldBy` asks the operating system
 * whether the pid is still there. The claim is this process's own file, so another server's claim
 * on the same directory is neither overwritten nor released by it.
 * @param {string} dir the dist directory, as an absolute path
 * @param {number} port the port being served
 * @param {string} [lockName=SERVER_LOCK]
 * @returns {() => void} release it
 */
export function holdDistDir(dir, port, lockName = SERVER_LOCK) {
  const lock = join(dir, `${lockName}.${process.pid}`);
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

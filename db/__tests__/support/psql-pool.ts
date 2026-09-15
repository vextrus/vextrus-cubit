// One psql PROCESS per connection string, kept alive and fed script after script — the cure for a
// lane that spent its wall time starting processes rather than running SQL (62 files, thousands of
// `spawnSync("psql", …)`, each one a fork, an exec, a TCP connect and an auth handshake before the
// first statement is parsed).
//
// SEAM-TENANT is untouched by this. The law says raw SQL is spoken through psql and never through a
// driver import, and every statement here still leaves the process through psql's own stdin: the
// pool changes HOW MANY psql processes a file starts, not what speaks to the server. Nothing in this
// module imports a driver, an ORM or the schema (cubit/no-db-outside-seam binds this file like the
// rest of the tree), and `db/__tests__/support/live-sql.ts` keeps `psql()` as the one public door.
//
// The contract the pool has to keep, because 62 files already lean on it:
//   · ONE SCRIPT IS ONE SESSION. A GUC set by a script is visible to the rest of THAT script and to
//     nothing after it (`withSession()` puts GUCs "on the session it runs in"). `discard all`
//     between scripts is what a fresh process used to give for free: RESET ALL, session
//     authorisation back to default, temp objects, prepared statements, advisory locks and cursors
//     all gone.
//   · ON_ERROR_STOP HOLDS PER SCRIPT. psql non-interactive exits on the first error when
//     ON_ERROR_STOP is on, and that is kept literally: the process dies with the script, its exit
//     status is read from a marker its wrapper prints, and the next script gets a new process. So a
//     refused script leaves exactly what it left before — the statements ahead of the error
//     committed, the rest never run.
//   · THE SAME SqlResult. `ok`, `rows`, `stderr`, `sqlstate` are built by the same code for the
//     pooled path and the spawned one, from the same psql flags.
//
// The one place `discard all` is not a new connection, and why it is admissible: RESET ALL gives a
// custom GUC back its EMPTY default rather than making the parameter unrecognised again, so a
// script that follows one which set `cubit.tenant_id` reads '' where a never-scoped process reads
// NULL. Every policy this tree writes reads those GUCs as `nullif(current_setting(guc, true), '')`
// (db/migrations/*.sql), which cannot tell '' from NULL — an unscoped session is unscoped either
// way — and psql-pool.test.ts holds that reading to both paths so a migration that ever stopped
// spelling it that way fails here.
//
// How a script's output is delimited, given one stdout for many scripts: psql prints `\echo` to
// stdout and `\warn` to stderr, so each script is followed by a marker on BOTH streams, carrying a
// 128-bit random token minted per process. Nothing a test can put in a row can be mistaken for it —
// and if the process dies first, the wrapper's `…-EXIT-<status>` line on stdout says so instead.
//
// Measured 2026-09-12 against a local scratch database (PostgreSQL 16.15, 127.0.0.1:5544), 200
// scripts each way, one after another: a trivial `select n` cost 25.4 ms a script spawned and
// 0.77 ms pooled (33x); a catalogue read shaped like the suite's own seeding cost 28.5 ms spawned
// and 1.70 ms pooled (17x). About 25 ms of every script the lane ran was a process it started.
//
// A pool that cannot answer is never an answer: a process that dies before it has spoken, a stdin
// that will not take the script, a wrapper that will not start — each falls back to a fresh
// `spawnSync` psql for that one script and says so in `stderr`. Set CUBIT_PSQL_POOL=0 to run every
// script the old way.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { closeSync, constants as FS, mkdtempSync, openSync, readSync, rmSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A column separator no catalogue value can contain. */
export const SEP = "\u0001";

/** What one psql script answered. One script is one session, so GUCs set in it hold for it alone. */
export type SqlResult = { ok: boolean; rows: string[][]; stderr: string; sqlstate: string | null };

/** How long one script may take before the process running it is abandoned — the spawned path's own. */
const SCRIPT_TIMEOUT_MS = 120_000;

/**
 * The same, as this run measures it. A deadline shorter than the spawned path's would red a slow
 * test that was never wrong, so the lane keeps the full two minutes; an override exists so the
 * deadline itself can be proven in a test rather than in two minutes (psql-pool.test.ts).
 */
function deadlineMs(): number {
  const named = Number(process.env["CUBIT_PSQL_TIMEOUT_MS"]);
  return Number.isFinite(named) && named > 0 ? named : SCRIPT_TIMEOUT_MS;
}

/**
 * What every psql this module starts calls itself on the cluster, pooled or spawned.
 *
 * A pooled session outlives the script it answered, so a suite that counts the backends on its own
 * database — or terminates them — now finds the lane's own tooling sitting there where a spawned
 * psql used to be gone before the next statement asked. The name is how such a suite tells the
 * store's connections from the lane's (src/core/jobs/__tests__/jobs-edges.acceptance.test.ts): the
 * lane's psql is not the thing under test, and it never was.
 */
export const PSQL_APP_NAME = "cubit-psql-pool";

/** The temp table the leavings script makes and the leavings reading looks for. */
const LEAVINGS_TABLE = "leftovers";

/** A script that leaves all three of them behind on the session it ran in — the reading's other half. */
export const SESSION_LEAVINGS_MADE = `create temp table ${LEAVINGS_TABLE} (n int); prepare left_over as select 1; select pg_advisory_lock(4242);`;

/**
 * The one spelling of "does this session still carry the last script's leavings" — three answers, in
 * order: no temp table, no prepared statement, no advisory lock. It is the reading of the contract
 * above ("ONE SCRIPT IS ONE SESSION"), published here so the question has one home and one scope.
 *
 * The scope is the point. `pg_temp` resolves per session and `pg_prepared_statements` shows the
 * asking session's own, but `pg_locks` is a view over the WHOLE CLUSTER: an advisory lock is listed
 * there with the database it belongs to, so a reader that does not name the session it means counts
 * every other backend's locks as this session's leavings. The database lane runs eight files at a
 * time, each on a scratch database of its own, and the seams take advisory locks as they work
 * (src/core/db/jobs.ts's key lock, the tenant trigger's state lock, the drift lock) — so asking the
 * cluster made the answer depend on what some unrelated file happened to be doing, which is a red
 * that moves between files and cannot be reproduced alone (B-20).
 */
export const SESSION_LEAVINGS = [
  `select to_regclass('pg_temp.${LEAVINGS_TABLE}') is null;`,
  "select count(*) = 0 from pg_prepared_statements;",
  "select count(*) = 0 from pg_locks where locktype = 'advisory';",
].join("\n");

/** How many connection strings this process keeps a live psql for. A file speaks to two or three. */
const MAX_SESSIONS = 4;

/**
 * The wrapper: psql reads the script stream from the fifo, and its exit status is printed after it.
 *
 * The token comes through the ENVIRONMENT, never argv. A command line is world-readable
 * (`ps -eo args`), and the token is what says where one script's output ends — anything that can
 * read it can print a marker of its own and truncate a script's answer to a green one.
 */
const WRAPPER = 'psql "$1" -X -q -A -t -F "$2" -v ON_ERROR_STOP=1 -f - < "$3"; printf "\\n%s-EXIT-%d\\n" "$CUBIT_PSQL_POOL_TOKEN" "$?"';

/** A stream being read a piece at a time, by offset, out of the file the wrapper writes it to. */
type Reader = { fd: number; offset: number; seen: Buffer };

type Session = {
  url: string;
  child: ChildProcess;
  dir: string;
  stdin: number;
  out: Reader;
  err: Reader;
  token: string;
  /** The serial of a reset already sent and not yet collected, so the wait for it costs nothing. */
  pendingReset: number | null;
  scripts: number;
};

/** Live psql processes, keyed by the connection string each one is connected with. */
const sessions = new Map<string, Session>();

/** Sleeping without turning the event loop: every caller of this module is synchronous. */
const SLEEPER = new Int32Array(new SharedArrayBuffer(4));
function nap(ms: number): void {
  if (ms > 0) Atomics.wait(SLEEPER, 0, 0, ms);
}

/** Is the pool armed at all? */
function pooling(): boolean {
  return process.env["CUBIT_PSQL_POOL"] !== "0";
}

/** The one shape both paths answer with. */
function shape(ok: boolean, stdout: string, stderr: string): SqlResult {
  const rows = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => line.split(SEP));
  // psql prefixes each diagnostic with its source position, so the state is matched in the line
  // rather than at the start of it.
  return { ok, rows, stderr, sqlstate: /\bERROR:\s+([0-9A-Z]{5}):/.exec(stderr)?.[1] ?? null };
}

/** A fresh psql process for exactly one script — the path this tree ran on before the pool. */
export function spawnPsql(url: string, script: string): SqlResult {
  const result = spawnSync("psql", [url, "-X", "-q", "-A", "-t", "-F", SEP, "-v", "ON_ERROR_STOP=1", "-f", "-"], {
    input: `\\set VERBOSITY verbose\n${script}\n`,
    encoding: "utf8",
    timeout: SCRIPT_TIMEOUT_MS,
    env: { ...process.env, PGAPPNAME: PSQL_APP_NAME },
  });
  const stderr = `${result.stderr ?? ""}${result.error === undefined ? "" : `\n${String(result.error)}`}`;
  return shape(result.status === 0, result.stdout ?? "", stderr);
}

/** Everything written to this stream since it was last read. */
function pull(reader: Reader): void {
  const buffer = Buffer.allocUnsafe(1 << 16);
  for (;;) {
    const read = readSync(reader.fd, buffer, 0, buffer.length, reader.offset);
    if (read <= 0) break;
    reader.offset += read;
    reader.seen = reader.seen.length === 0 ? Buffer.from(buffer.subarray(0, read)) : Buffer.concat([reader.seen, buffer.subarray(0, read)]);
  }
}

/** Is this process gone, or a corpse nobody has reaped? The event loop is not turning to tell us. */
function departed(child: ChildProcess): boolean {
  const pid = child.pid;
  if (pid === undefined) return true;
  try {
    const fd = openSync(`/proc/${pid}/stat`, "r");
    const buffer = Buffer.allocUnsafe(512);
    const read = readSync(fd, buffer, 0, buffer.length, 0);
    closeSync(fd);
    // "<pid> (<comm>) <state> …" — a Z is a process that has exited and not yet been waited for.
    const line = buffer.toString("utf8", 0, read);
    const state = line.slice(line.lastIndexOf(")") + 2, line.lastIndexOf(")") + 3);
    return state === "Z" || state === "X";
  } catch {
    return true;
  }
}

/** Write the whole script into the fifo, however small the pipe's window happens to be. */
function writeAll(fd: number, text: string): void {
  const buffer = Buffer.from(text, "utf8");
  const deadline = Date.now() + 30_000;
  for (let written = 0; written < buffer.length; ) {
    try {
      written += writeSync(fd, buffer, written, buffer.length - written);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EAGAIN" || Date.now() > deadline) throw error;
      nap(0.5);
    }
  }
}

/** What ended the wait for a marker. */
type Awaited = { how: "marked" | "exited" | "timeout" | "died"; stdout: string; stderr: string; status: number | null };

/**
 * Wait for this script's two markers — one on each stream — or for the wrapper's exit line, which is
 * what ON_ERROR_STOP leaves behind. Polled rather than awaited: the callers of `psql()` are
 * synchronous, so the event loop is not turning and no 'exit' event can arrive.
 */
function awaitMarker(session: Session, marker: string, deadline: number): Awaited {
  const exit = `${session.token}-EXIT-`;
  const answer = (how: Awaited["how"], status: number | null): Awaited => ({
    how,
    status,
    stdout: session.out.seen.toString("utf8"),
    stderr: session.err.seen.toString("utf8"),
  });
  for (let poll = 0; ; poll += 1) {
    pull(session.out);
    pull(session.err);
    const stdout = session.out.seen.toString("utf8");
    if (stdout.includes(marker) && session.err.seen.toString("utf8").includes(marker)) return answer("marked", 0);
    const died = stdout.indexOf(exit);
    if (died >= 0) {
      // psql is gone; its stderr is unbuffered and was written before the wrapper's line, so one
      // more read collects all of it.
      pull(session.err);
      return answer("exited", Number.parseInt(stdout.slice(died + exit.length), 10));
    }
    if (Date.now() > deadline) return answer("timeout", null);
    if (poll % 64 === 63 && departed(session.child)) {
      pull(session.out);
      pull(session.err);
      return session.out.seen.toString("utf8").includes(exit) ? answer("exited", null) : answer("died", null);
    }
    nap(poll < 16 ? 0 : poll < 256 ? 0.2 : poll < 4096 ? 2 : 10);
  }
}

/** Forget everything read so far: each script reads its own stream from an empty slate. */
function rewind(session: Session): void {
  session.out.seen = Buffer.alloc(0);
  session.err.seen = Buffer.alloc(0);
}

/** Start a psql for this connection string, with its two output files and its script fifo. */
function open(url: string): Session {
  const dir = mkdtempSync(join(tmpdir(), "cubit-psql-pool-"));
  const fifo = join(dir, "in");
  const madeFifo = spawnSync("mkfifo", [fifo]);
  if (madeFifo.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`the pool could not make its script fifo: ${String(madeFifo.stderr ?? madeFifo.error ?? "")}`);
  }
  const outPath = join(dir, "out");
  const errPath = join(dir, "err");
  const outWrite = openSync(outPath, "w");
  const errWrite = openSync(errPath, "w");
  const token = randomBytes(16).toString("hex");
  const child = spawn("bash", ["-c", WRAPPER, PSQL_APP_NAME, url, SEP, fifo], {
    stdio: ["ignore", outWrite, errWrite],
    env: { ...process.env, PGAPPNAME: PSQL_APP_NAME, CUBIT_PSQL_POOL_TOKEN: token },
  });
  closeSync(outWrite);
  closeSync(errWrite);

  // The fifo's write end cannot be opened until the wrapper has opened the read end; O_NONBLOCK
  // turns "nobody is reading yet" into ENXIO to try again rather than a block with no way out.
  let stdin: number | undefined;
  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      stdin = openSync(fifo, FS.O_WRONLY | FS.O_NONBLOCK);
      break;
    } catch (error) {
      if (Date.now() > deadline) {
        child.kill("SIGKILL");
        rmSync(dir, { recursive: true, force: true });
        throw error;
      }
      nap(1);
    }
  }
  return {
    url,
    child,
    dir,
    stdin,
    out: { fd: openSync(outPath, "r"), offset: 0, seen: Buffer.alloc(0) },
    err: { fd: openSync(errPath, "r"), offset: 0, seen: Buffer.alloc(0) },
    token,
    pendingReset: null,
    scripts: 0,
  };
}

/** Take a live psql away: the fifo closing is psql's EOF, which is how it is asked to leave. */
function close(session: Session): void {
  sessions.delete(session.url);
  try {
    closeSync(session.stdin);
  } catch {
    /* already gone */
  }
  try {
    session.child.kill("SIGKILL");
  } catch {
    /* already gone */
  }
  for (const reader of [session.out, session.err]) {
    try {
      closeSync(reader.fd);
    } catch {
      /* already gone */
    }
  }
  rmSync(session.dir, { recursive: true, force: true });
}

/**
 * Take away the psql this process keeps for a connection string — or for all of them.
 *
 * A live connection is a reason Postgres refuses to drop a database or to clone a template
 * (`drop database` without FORCE, `create database … template …`), so the harness closes the
 * sessions it opened onto a database before taking that database away.
 */
export function closePsqlPool(url?: string): void {
  for (const session of [...sessions.values()]) {
    if (url === undefined || session.url === url) close(session);
  }
}

let bound = false;
/** However a worker leaves, it leaves no psql behind. */
function bindExit(): void {
  if (bound) return;
  bound = true;
  process.on("exit", () => closePsqlPool());
}

/** The oldest sessions go when a file has spoken to more connection strings than the pool keeps. */
function evict(): void {
  while (sessions.size > MAX_SESSIONS) {
    const oldest = sessions.values().next().value;
    if (oldest === undefined) return;
    close(oldest);
  }
}

/** The reset that makes the next script's session look freshly connected. */
function sendReset(session: Session): void {
  const serial = session.scripts + 1;
  writeAll(
    session.stdin,
    [
      "\\set ON_ERROR_STOP 0",
      // A script that opened a transaction and never closed it used to be rolled back by psql
      // exiting; outside one, this is a warning and nothing else.
      "rollback;",
      "discard all;",
      `\\echo ${session.token}-R-${serial}`,
      `\\warn ${session.token}-R-${serial}`,
      "",
    ].join("\n"),
  );
  session.pendingReset = serial;
}

/** Collect the reset sent after the last script. Anything but a clean one retires the process. */
function collectReset(session: Session): boolean {
  if (session.pendingReset === null) return true;
  const marker = `${session.token}-R-${session.pendingReset}`;
  const done = awaitMarker(session, marker, Date.now() + deadlineMs());
  session.pendingReset = null;
  rewind(session);
  // `discard all` refusing is a session this pool can no longer promise anything about.
  return done.how === "marked" && !done.stderr.includes("ERROR:");
}

/** The script as psql is told it: verbose diagnostics, stop at the first error, then say you are done. */
function scriptBlock(session: Session, script: string, serial: number): string {
  return [
    "\\set VERBOSITY verbose",
    "\\set ON_ERROR_STOP 1",
    script,
    // What a fresh process got from EOF and a pooled one never will. psql sends its query buffer
    // when a semicolon closes it or when the input ENDS — and 62 files write `run(url, "select 1")`
    // with no terminator, trusting the second. A backslash command does not flush that buffer: it
    // runs and leaves the statement sitting there unsent, so the script would answer no rows and
    // call itself good (`create table` that never ran, `count(*)` that came back empty). A lone
    // semicolon closes whatever is open and is an empty query when nothing is.
    ";",
    `\\echo ${session.token}-S-${serial}`,
    `\\warn ${session.token}-S-${serial}`,
    "",
  ].join("\n");
}

/** Everything the script printed, up to but not including its own marker. */
function upToMarker(text: string, marker: string): string {
  const at = text.indexOf(marker);
  return at < 0 ? text : text.slice(0, at);
}

/** What the caller is told when the process running its script went away under it. */
const DIED_MID_SCRIPT = "the pooled psql died mid-script — the script's effects are unknown, nothing was re-run (v22 R3)";

/** What the caller is told when the script never ended. Its process is killed and never re-used. */
function didNotEnd(): string {
  return `the script did not end in ${deadlineMs() / 1000} s — an unclosed comment, string, dollar-quote or \\if? nothing re-run`;
}

/** Say, in the stderr the caller reads, that this answer came from a fresh process after all. */
function noteFallback(result: SqlResult, why: string): SqlResult {
  return { ...result, stderr: `${result.stderr}\n[psql-pool] ${why}; this script was run in a fresh psql process instead.\n` };
}


/** What the pool needs to know about a script before it dares put it on a shared process. */
type Reading = { meta: string | null; open: string | null; copyFromStdin: boolean };

/** Does a COPY in this script read its data from the same stream the script arrived on? */
const COPY_FROM_STDIN = /\bcopy\b[^;]*\bfrom\s+stdin/i;

/** The tag a dollar-quoted body opens with. */
const DOLLAR_TAG = /^\$([A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*)?\$/;

/**
 * Read the script the way psql's own lexer will: strings, quoted identifiers, line and block
 * comments and dollar-quoted bodies stepped over, so what is left is the SQL itself.
 *
 * Two findings send a script to a fresh process instead of the pool, and one is a fault of this
 * module—s own making:
 *
 *  — A META-COMMAND. `rollback; discard all;` resets the SERVER session and NOTHING of psql—s own:
 *    `\\connect` moves the process to another database and every later script runs there;
 *    `\\o` sends every later script—s rows to a file, so `count()` reads nothing and calls it green;
 *    `\\pset`, `\\f`, `\\a`, `\\t`, `\\timing` re-cut the output this module parses by column;
 *    `\\set` and `\\gset` leave variables the next script can read where a fresh psql refuses;
 *    `\\!` hands the script a shell inside the pool—s own process tree.
 *    All of them were green and wrong (v22 R3 adversary A1a—A1f). The pool—s preamble is now the only
 *    backslash text a pooled process is ever fed.
 *  — A COPY THAT READS STDIN. The fifo carries the scripts; a `copy ... from stdin` with no `\\.`
 *    eats the pool—s own markers as data and commits them as rows (adversary B3).
 *  — A CONSTRUCT LEFT OPEN at the end of the script — an unclosed `/*`, quote or dollar-body —
 *    swallows the marker and the script cannot be told it has finished; a fresh process meets EOF
 *    and refuses at once (adversary B1/B2).
 *
 * The meta-command reading is deliberately conservative: a backslash that opens a LINE is read as a
 * meta-command, which is what psql does, and a line inside a string or a body is stepped over first.
 * A script this misreads costs one fresh process (25 ms) and gets the same answer either way — the
 * error this cannot afford is the other one.
 */
export function readScript(script: string): Reading {
  let index = 0;
  let atLineStart = true;
  let plain = "";
  while (index < script.length) {
    const here = script[index] ?? "";
    const next = script[index + 1] ?? "";
    if (here === "\n") {
      plain += "\n";
      atLineStart = true;
      index += 1;
      continue;
    }
    if (atLineStart && (here === " " || here === "\t" || here === "\r")) {
      plain += here;
      index += 1;
      continue;
    }
    if (atLineStart && here === "\\") {
      const ends = script.indexOf("\n", index);
      const line = script.slice(index, ends < 0 ? script.length : ends).trim();
      return { meta: line.split(/\s/)[0] ?? "\\", open: null, copyFromStdin: false };
    }
    atLineStart = false;
    if (here === "-" && next === "-") {
      const ends = script.indexOf("\n", index);
      index = ends < 0 ? script.length : ends;
      continue;
    }
    if (here === "/" && next === "*") {
      let depth = 1;
      index += 2;
      while (index < script.length && depth > 0) {
        if (script[index] === "/" && script[index + 1] === "*") {
          depth += 1;
          index += 2;
        } else if (script[index] === "*" && script[index + 1] === "/") {
          depth -= 1;
          index += 2;
        } else index += 1;
      }
      if (depth > 0) return { meta: null, open: "a block comment", copyFromStdin: false };
      plain += " ";
      continue;
    }
    if (here === "'" || here === '"') {
      // A string written E'...' takes backslash escapes; every other quoted run only doubles.
      const before = script[index - 1] ?? "";
      const beforeThat = script[index - 2] ?? "";
      const escapes = here === "'" && (before === "e" || before === "E") && !/[A-Za-z0-9_]/.test(beforeThat);
      index += 1;
      for (;;) {
        if (index >= script.length) return { meta: null, open: here === "'" ? "a quoted string" : "a quoted identifier", copyFromStdin: false };
        const at = script[index];
        if (escapes && at === "\\") {
          index += 2;
          continue;
        }
        if (at === here) {
          if (script[index + 1] === here) {
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        index += 1;
      }
      plain += " ";
      continue;
    }
    if (here === "$") {
      const tag = DOLLAR_TAG.exec(script.slice(index))?.[0];
      if (tag !== undefined) {
        const closes = script.indexOf(tag, index + tag.length);
        if (closes < 0) return { meta: null, open: "a dollar-quoted body", copyFromStdin: false };
        index = closes + tag.length;
        plain += " ";
        continue;
      }
    }
    plain += here;
    index += 1;
  }
  return { meta: null, open: null, copyFromStdin: COPY_FROM_STDIN.test(plain) };
}

/**
 * Run one script through the process this connection string already has — starting one if it has
 * none — and answer exactly what a fresh psql would have answered.
 */
export function pooledPsql(url: string, script: string): SqlResult {
  if (!pooling()) return spawnPsql(url, script);
  // A script the pool cannot keep to itself gets the process the whole lane used to get: a fresh
  // psql, fed on stdin, ended by EOF. The answer is the same one; only the 25 ms is different.
  const reading = readScript(script);
  if (reading.meta !== null || reading.copyFromStdin || reading.open !== null) return spawnPsql(url, script);
  bindExit();

  let session = sessions.get(url);
  if (session !== undefined && !collectReset(session)) {
    close(session);
    session = undefined;
  }
  if (session === undefined) {
    try {
      session = open(url);
    } catch (error) {
      return noteFallback(spawnPsql(url, script), `no pooled psql could be started (${String(error)})`);
    }
    // Most recently opened last: `evict()` takes the oldest.
    sessions.set(url, session);
    evict();
  } else {
    // Keep the map ordered by use, so the session a file is working through is never the one evicted.
    sessions.delete(url);
    sessions.set(url, session);
  }

  session.scripts += 1;
  const serial = session.scripts;
  const marker = `${session.token}-S-${serial}`;
  rewind(session);
  try {
    writeAll(session.stdin, scriptBlock(session, script, serial));
  } catch (error) {
    // Part of the script may already have gone down the fifo and run. Same law as a death: no re-run.
    close(session);
    return { ok: false, rows: [], stderr: `[psql-pool] ${DIED_MID_SCRIPT} (${String(error)})\n`, sqlstate: null };
  }

  const done = awaitMarker(session, marker, Date.now() + deadlineMs());
  if (done.how === "marked") {
    const answer = shape(true, upToMarker(done.stdout, marker), upToMarker(done.stderr, marker));
    // The answer is already in hand: a reset this process will not take costs it its place in the
    // pool and nothing else.
    try {
      sendReset(session);
    } catch {
      close(session);
    }
    return answer;
  }

  // Anything else ends this process: ON_ERROR_STOP means psql has already exited, and a process that
  // stopped answering cannot be trusted with the next script either.
  close(session);
  if (done.how === "exited") {
    // The refusal a fresh psql would have given, with the wrapper's own line kept out of the rows.
    return shape(false, upToMarker(done.stdout, `${session.token}-EXIT-`), done.stderr);
  }
  if (done.how === "timeout") {
    return { ok: false, rows: [], stderr: `${done.stderr}\n[psql-pool] ${didNotEnd()}\n`, sqlstate: null };
  }
  // The process vanished. What the script did before it went is UNKNOWABLE from here: psql is -q, so
  // an insert, an update, a create — everything this lane writes — prints nothing, and a script
  // that committed and then lost its process looks exactly like one that never started. The old
  // spelling re-ran it through a fresh psql and wrote the row twice (v22 R3 adversary C1/C2). A
  // second write is a worse answer than no answer, so nothing is re-run and the caller is told
  // plainly that the pool does not know; a test reading this reds honestly.
  return { ok: false, rows: [], stderr: `${done.stderr}\n[psql-pool] ${DIED_MID_SCRIPT}\n`, sqlstate: null };
}

/** What the pool is holding right now — how a test proves one process served many scripts. */
export function psqlPoolStats(): { sessions: number; scripts: number } {
  let scripts = 0;
  for (const session of sessions.values()) scripts += session.scripts;
  return { sessions: sessions.size, scripts };
}

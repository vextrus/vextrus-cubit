// Is a port held? — asked ONE way, by binding it (ARCH-02). The gate, the checkup and the dev lane
// each carried a probe of their own: the gate read `ss -ltn`, the checkup bound 127.0.0.1, the dev
// lane bound 0.0.0.0. Under WSL2 mirrored networking Windows and WSL share one loopback port space,
// and `ss` sees only Linux's listeners: it read the journeys' port free while `node` got EADDRINUSE
// on it (a stale Windows `netsh portproxy` rule held it), so the served lanes died 20–37 s in instead of being
// refused at once. A bind is the question the lane itself will ask, so it is the one asked here.
//
// `ss` is still read, but only to say WHO holds a port the bind found busy — never whether it is.
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { servedPorts } from "./ports.mjs";

/** @typedef {"free" | "busy"} PortState */
/** @typedef {(port: number) => PortState | Promise<PortState>} PortProbe */

/**
 * Bind the port and give it straight back. A port that cannot be bound is "busy", whoever holds it —
 * a Linux listener, a Windows one, or a portproxy rule.
 * @param {number} port
 * @param {string} [host] where the lane that asks will bind; 127.0.0.1 unless it binds elsewhere
 * @returns {Promise<PortState>}
 */
export function portState(port, host = "127.0.0.1") {
  return new Promise((done) => {
    const server = createServer();
    server.once("error", () => done("busy"));
    server.listen(port, host, () => server.close(() => done("free")));
  });
}

/** What a busy port is attributed to when Linux cannot see its holder. */
export const HELD_OUTSIDE_LINUX =
  "not visible to ss — held outside Linux (mirrored networking: see netstat.exe -ano and netsh interface portproxy show all)";

/**
 * Who holds a port, as `ss -ltnp` tells it: a Linux listener by process name and pid, or — when no
 * Linux listener has the port — a holder outside Linux.
 * @param {number} port
 * @param {(command: string, args: string[], options: {encoding: "utf8", timeout: number}) => {status: number | null, stdout?: string | null, error?: Error}} [run] injected, so the reading is provable without a socket
 * @returns {string}
 */
export function attribution(port, run = spawnSync) {
  const result = run("ss", ["-ltnp"], { encoding: "utf8", timeout: 2_000 });
  if (result.error !== undefined || result.status !== 0 || typeof result.stdout !== "string") {
    return `unattributed — ss could not be read${result.error === undefined ? "" : ` (${result.error.message})`}`;
  }
  for (const line of result.stdout.split("\n")) {
    const local = line.trim().split(/\s+/)[3];
    if (local === undefined || !local.endsWith(`:${port}`)) continue;
    // The name is quoted as ss quotes it: ss cuts a process name at 15 characters, so a name such as
    // `next-server (v1` arrives with a parenthesis of its own.
    const holder = /"([^"]+)",pid=(\d+)/.exec(line);
    return `a Linux listener (${holder === null ? "process not readable by this user" : `"${holder[1]}" pid=${holder[2]}`})`;
  }
  return HELD_OUTSIDE_LINUX;
}

/**
 * The ports that are held, in the order asked, each asked once and one at a time — two binds of one
 * port from this process would read each other as busy.
 * @param {number[]} [ports]
 * @param {PortProbe} [probe]
 * @returns {Promise<number[]>}
 */
export async function heldPorts(ports = servedPorts(), probe = portState) {
  /** @type {number[]} */
  const held = [];
  for (const port of new Set(ports)) {
    if ((await probe(port)) === "busy") held.push(port);
  }
  return held;
}

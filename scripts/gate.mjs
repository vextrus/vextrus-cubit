#!/usr/bin/env node
// THE GATE, AS ONE COMMAND. Every lane the session must leave green, run one after another — never
// two heavy lanes on one box, never the db lane while a served product holds a port — each lane's
// whole output kept in its own log, and one summary of the lanes' own verdict lines at the end.
//
//   pnpm gate                      every lane, in the order below
//   pnpm gate --only verify,e2e    a subset, in the same order
//   pnpm gate --out <dir>          where the logs go (default test-results/gate)
//
// The lanes and their order (docs/handoff/fable-5.1-session-3.md § 5): verify → checkup → golden →
// db → e2e → e2e J-000 → perf. The e2e lanes serve the product on port 3211; the db lane is refused
// while anything holds 3210 or 3211, because a served product and the lane's template copies share
// one cluster (V-DB). A red lane does not stop the chain — the session wants every verdict — but the
// exit code is the first red's.
//
// Session 3 ran these seven by hand, one background command at a time, and read each log by hand;
// the order and the port discipline are the part worth keeping (C-06).
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

/** @typedef {{id: string, argv: string[], verdicts: RegExp, servesProduct?: boolean, needsPortsFree?: boolean}} GateLane */

/** @type {ReadonlyArray<GateLane>} */
export const GATE_LANES = Object.freeze([
  { id: "verify", argv: ["pnpm", "verify"], verdicts: /^(RUN|SKIP|LANE|FAIL|cad:|verify) / },
  { id: "checkup", argv: ["pnpm", "checkup"], verdicts: /^(RUN | {2}.*(FAIL|drift)|checkup )/ },
  { id: "golden", argv: ["pnpm", "test:golden"], verdicts: /(Test Files|Tests |passed in|failed|golden exit)/ },
  { id: "db", argv: ["pnpm", "test:db"], verdicts: /(Test Files|Tests |Duration|test:db|FAIL {2})/, needsPortsFree: true },
  { id: "e2e", argv: ["pnpm", "e2e"], verdicts: /(^\s+✘|passed|failed|flaky|skipped|JOURNEY|e2e exit|wall-time)/, servesProduct: true },
  { id: "e2e-j000", argv: ["pnpm", "e2e", "--journeys", "J-000"], verdicts: /(^\s+✘|passed|failed|skipped|JOURNEY|e2e exit|wall-time)/, servesProduct: true },
  { id: "perf", argv: ["pnpm", "test:perf"], verdicts: /(^\s+[✓✘]|passed|failed|e2e exit|wall-time|test:perf exit)/, servesProduct: true },
]);

/** The ports a served product holds (scripts/lib/ports.mjs): the dev lane's and the journeys'. */
export const SERVED_PORTS = Object.freeze([3210, 3211]);

/**
 * Which of the ports are held, by asking the kernel (Linux `ss`); an unanswerable box reads as free.
 * @param {(argv: string[]) => {status: number | null, stdout: string}} [run] injected, so the reading is provable without a socket
 * @returns {number[]}
 */
export function heldPorts(run = (argv) => spawnSync(argv[0] ?? "ss", argv.slice(1), { encoding: "utf8" })) {
  const result = run(["ss", "-ltn"]);
  if (result.status !== 0 || typeof result.stdout !== "string") return [];
  return SERVED_PORTS.filter((port) => new RegExp(`[:.]${port}\\s`).test(result.stdout));
}

/**
 * The lanes a `--only` list names, in the roster's own order; an unknown name is a refusal.
 * @param {ReadonlyArray<GateLane>} roster
 * @param {string | undefined} only
 */
export function selectLanes(roster, only) {
  if (only === undefined || only.trim() === "") return [...roster];
  const wanted = only.split(",").map((name) => name.trim()).filter((name) => name !== "");
  const unknown = wanted.filter((name) => !roster.some((lane) => lane.id === name));
  if (unknown.length > 0) throw new Error(`gate knows no lane named ${unknown.join(", ")} — the roster is ${roster.map((lane) => lane.id).join(", ")}`);
  return roster.filter((lane) => wanted.includes(lane.id));
}

/**
 * Run one lane: its output to a log file and, line by line, its verdict lines to `write`.
 * @param {GateLane} lane
 * @param {{logDir: string, write: (line: string) => void, cwd?: string}} io
 * @returns {Promise<number>}
 */
export function runLane(lane, io) {
  return new Promise((resolveExit) => {
    const log = createWriteStream(join(io.logDir, `${lane.id}.log`));
    const [command, ...args] = lane.argv;
    if (command === undefined) throw new Error(`lane ${lane.id} names no command`);
    const child = spawn(command, args, { cwd: io.cwd ?? ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let rest = "";
    /** @param {Buffer | string} chunk */
    const onChunk = (chunk) => {
      const text = rest + chunk.toString("utf8");
      const lines = text.split("\n");
      rest = lines.pop() ?? "";
      for (const line of lines) {
        log.write(`${line}\n`);
        if (lane.verdicts.test(line)) io.write(`  ${line}\n`);
      }
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
    child.on("close", (code) => {
      if (rest !== "") log.write(rest);
      log.end();
      resolveExit(code ?? 1);
    });
  });
}

/**
 * The whole gate. Refuses the db lane while a product is served; runs the rest in order; answers
 * the first red's exit code.
 * @param {{only?: string, out?: string, write?: (line: string) => void, run?: typeof runLane, ports?: () => number[]}} [options]
 */
export async function gate(options = {}) {
  const write = options.write ?? ((line) => process.stdout.write(line));
  const run = options.run ?? runLane;
  const ports = options.ports ?? heldPorts;
  const logDir = resolve(ROOT, options.out ?? join("test-results", "gate"));
  mkdirSync(logDir, { recursive: true });
  const lanes = selectLanes(GATE_LANES, options.only);
  const startedAt = Date.now();
  let first = 0;
  const summary = [];
  for (const lane of lanes) {
    if (lane.needsPortsFree) {
      const held = ports();
      if (held.length > 0) {
        write(`GATE ${lane.id} REFUSED — a served product holds port ${held.join(", ")}; the db lane never runs beside one (V-DB)\n`);
        summary.push(`${lane.id}: refused (port ${held.join(", ")} held)`);
        if (first === 0) first = 1;
        continue;
      }
    }
    write(`GATE ${lane.id}: ${lane.argv.join(" ")}\n`);
    const laneStarted = Date.now();
    const code = await run(lane, { logDir, write });
    const seconds = ((Date.now() - laneStarted) / 1000).toFixed(2);
    write(`GATE ${lane.id} ${code === 0 ? "green" : `RED exit=${code}`} ${seconds}s (log ${join(logDir, `${lane.id}.log`)})\n`);
    summary.push(`${lane.id}: ${code === 0 ? "green" : `RED exit=${code}`} ${seconds}s`);
    if (code !== 0 && first === 0) first = code;
  }
  write(`GATE summary — ${summary.join(" · ")}\n`);
  write(`GATE wall-time ${((Date.now() - startedAt) / 1000).toFixed(2)}s exit ${first}\n`);
  return first;
}

/** @param {string} name */
function argument(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = await gate({ only: argument("--only"), out: argument("--out") });
  process.exit(code);
}

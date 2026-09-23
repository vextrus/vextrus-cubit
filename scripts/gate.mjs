#!/usr/bin/env node
// THE GATE, AS ONE COMMAND. Every lane the session must leave green, run one after another — never
// two heavy lanes on one box, never the db lane while a served product holds a port — each lane's
// whole output kept in its own log, and one summary of the lanes' own verdict lines at the end.
//
//   pnpm gate                      every lane, in the order below
//   pnpm gate --only verify,e2e    a subset, in the same order
//   pnpm gate --out <dir>          where the logs go (default node_modules/.cache/cubit/gate)
//
// The lanes and their order (docs/handoff/fable-5.1-session-3.md § 5): verify → checkup → golden →
// db → e2e → e2e J-000 → perf. The e2e lanes serve the product on the journeys' port
// (`portFor("e2e")`); the db lane is refused while anything holds a served port (`servedPorts()`,
// scripts/lib/ports.mjs), because a served product and the lane's template copies share one cluster
// (V-DB). A red lane does not stop the chain — the session wants every verdict — but the exit code
// is the first red's.
//
// "HELD" IS ASKED BY BINDING (scripts/lib/port-probe.mjs). The gate read `ss -ltn`, which under WSL2
// mirrored networking cannot see a port Windows holds: it read the journeys' port free while the
// served lanes then died on `listen EADDRINUSE` on it 20–37 s in. So each served lane is
// pre-flighted the same way the db lane is — its port bound and given back first — and refused BY
// NAME at once, with who holds the port, instead of dying late.
//
// THE LOGS SURVIVE THE GATE (docs/handoff/fable-5.1-session-4.md § 7 item 6, C-06). They were
// written under `test-results/gate/`, the directory the e2e lanes that follow clean: by the time the
// gate printed its summary the verify, checkup, golden and db logs that summary cites were gone, and
// a red db lane had to be run again alone to be read at all. The default is now the tree's own cache
// home, `node_modules/.cache/cubit/gate` (beside cad-regeneration.json) — git-ignored, and no lane
// cleans it — so every lane's log is still there when the summary names it. `--out` still overrides,
// and the GATE lines still print each log's path exactly as they did.
//
// THE e2e LANE IS THE REGRESSION SWEEP; THE GOLDEN PATH IS THE e2e-j000 LANE'S (§ 7 item 8,
// AM-10 §1). The plain lane selected every spec, J-000's legs among them, and `e2e-j000` then walked
// J-000 a second time: 1,263 s at four workers against V-E2E's 12 min ceiling, which AM-10 §1 calls a
// defect with an owner rather than a new normal. `pnpm e2e` with no journey named now excludes J-000
// (scripts/e2e.mjs), so each journey is walked exactly once per gate and the golden path is answered
// for by the lane whose roster it is.
//
// Session 3 ran these seven by hand, one background command at a time, and read each log by hand;
// the order and the port discipline are the part worth keeping (C-06).
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { attribution, heldPorts, portState } from "./lib/port-probe.mjs";
import { portFor, servedPorts } from "./lib/ports.mjs";

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

/**
 * Where the logs go when `--out` names nowhere: the tree's own cache home, which is git-ignored and
 * which NO lane cleans — `pnpm e2e:clean` takes test-results/, playwright-report/, blob-report/ and
 * .vitest-reports/, and the e2e lanes take test-results/ as they start (§ 7 item 6).
 */
export const DEFAULT_LOG_DIR = join("node_modules", ".cache", "cubit", "gate");

/**
 * The held ports, each with who holds it: `<port> [a Linux listener ("node" pid=4242)]`.
 * @param {number[]} held
 * @param {(port: number) => string} attribute
 */
function heldBy(held, attribute) {
  return held.map((port) => `${port} [${attribute(port)}]`).join(", ");
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
    // The log directory is made again before every lane's log is opened: the default one is outside
    // anything a lane cleans, but `--out test-results/…` is still a lawful ask and the e2e lanes
    // clean that tree as they start — a lane that followed an e2e lane once crashed here on ENOENT
    // and took the gate down with it (session 4).
    mkdirSync(io.logDir, { recursive: true });
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
 * The whole gate. Refuses the db lane while a product is served, and a served lane whose port is
 * already held; runs the rest in order; answers the first red's exit code.
 * @param {{only?: string, out?: string, write?: (line: string) => void, run?: typeof runLane, probe?: import("./lib/port-probe.mjs").PortProbe, attribute?: (port: number) => string}} [options]
 *   `probe` answers whether one port is free (default: bind it, scripts/lib/port-probe.mjs); `attribute` says who holds a busy one (default: `ss -ltnp`)
 */
export async function gate(options = {}) {
  const write = options.write ?? ((line) => process.stdout.write(line));
  const run = options.run ?? runLane;
  const probe = options.probe ?? portState;
  const attribute = options.attribute ?? attribution;
  const logDir = resolve(ROOT, options.out ?? DEFAULT_LOG_DIR);
  mkdirSync(logDir, { recursive: true });
  const lanes = selectLanes(GATE_LANES, options.only);
  const startedAt = Date.now();
  let first = 0;
  const summary = [];
  for (const lane of lanes) {
    // Asked right before each lane, never once up front: a lane before this one may have left a
    // server behind, or given its port back.
    if (lane.needsPortsFree) {
      const held = await heldPorts(servedPorts(), probe);
      if (held.length > 0) {
        write(`GATE ${lane.id} REFUSED — a served product holds port ${heldBy(held, attribute)}; the db lane never runs beside one (V-DB)\n`);
        summary.push(`${lane.id}: refused (port ${held.join(", ")} held)`);
        if (first === 0) first = 1;
        continue;
      }
    }
    if (lane.servesProduct) {
      const held = await heldPorts([portFor("e2e")], probe);
      if (held.length > 0) {
        write(`GATE ${lane.id} REFUSED — the lane serves the product on port ${heldBy(held, attribute)}, which is not bindable; it would die on EADDRINUSE (E2E_PORT moves the port)\n`);
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
  const verdict = `GATE summary — ${summary.join(" · ")}`;
  const wall = `GATE wall-time ${((Date.now() - startedAt) / 1000).toFixed(2)}s exit ${first}`;
  write(`${verdict}\n`);
  write(`${wall}\n`);
  // The last verdict, kept beside the lane logs it cites, so a session starting later reads what the
  // gate said rather than re-running it (scripts/harness/state.mjs prints it at session start).
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout?.trim() ?? "?";
  writeFileSync(join(logDir, "summary.txt"), `${new Date().toISOString()} on ${head}${options.only === undefined ? "" : ` (--only ${options.only})`}\n${verdict}\n${wall}\n`);
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

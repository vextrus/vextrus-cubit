#!/usr/bin/env node
// `pnpm checkup` — the machine's report (V-CHECKUP), run at session start. It prints every pinned
// tool beside the version this machine actually has, then the database, the ports, the storage
// root and the environment. It probes what the tree needs *today*: a tool or probe only a stub
// lane would need is reported and forgiven, one an armed lane needs is a failure (B-23).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { Socket, createServer } from "node:net";
import { join, resolve } from "node:path";
import { LANE_PROBES, LANE_TOOLS, deriveLaneRoster } from "./lanes.mjs";

const rootDir = resolve(process.cwd());
const read = (rel) => readFileSync(join(rootDir, rel), "utf8");
const bare = (version) => String(version).replace(/^v/, "");

/** The pins, each from the file the contract puts it in. */
function pins() {
  const pkg = JSON.parse(read("package.json"));
  const extra = JSON.parse(read("scripts/pins.json"));
  return {
    node: read(".nvmrc").trim(),
    pnpm: String(pkg.packageManager).replace(/^pnpm@/, "").replace(/\+.*$/, ""),
    uv: String(extra.uv),
    typst: String(extra.typst),
    libredwg: String(extra.libredwg),
  };
}

/** The first dotted version in a tool's own `--version` chatter, or ABSENT if it will not run. */
function probeVersion(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 20_000 });
  if (result.error || result.status !== 0) return "ABSENT";
  const found = /\d+\.\d+(\.\d+)?/.exec(`${result.stdout ?? ""}${result.stderr ?? ""}`);
  return found ? found[0] : "ABSENT";
}

const FOUND = {
  node: () => process.version,
  pnpm: () => probeVersion("pnpm"),
  uv: () => probeVersion("uv"),
  typst: () => probeVersion("typst"),
  // libredwg ships no `libredwg` binary; `dwgread` is the tool the CAD lane actually calls.
  libredwg: () => probeVersion("dwgread"),
};

function reachable(host, port) {
  return new Promise((done) => {
    const socket = new Socket();
    const settle = (answer) => {
      socket.destroy();
      done(answer);
    };
    socket.setTimeout(3000);
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
    socket.connect(port, host);
  });
}

function bindable(port) {
  return new Promise((done) => {
    const server = createServer();
    server.once("error", () => done(false));
    server.once("listening", () => server.close(() => done(true)));
    server.listen(port, "127.0.0.1");
  });
}

const roster = deriveLaneRoster(rootDir);
const armed = roster.filter((entry) => entry.armed).map((entry) => entry.lane);
const needed = (map, key) => armed.filter((lane) => (map[lane] ?? []).includes(key));

const failures = [];
const want = pins();

for (const [tool, pin] of Object.entries(want)) {
  const found = FOUND[tool]();
  process.stdout.write(`pin ${tool} want=${pin} found=${found}\n`);
  const agrees = found !== "ABSENT" && bare(found).startsWith(bare(pin));
  const lanes = needed(LANE_TOOLS, tool);
  if (!agrees && lanes.length > 0) failures.push(`${tool} (armed lane${lanes.length > 1 ? "s" : ""}: ${lanes.join(", ")})`);
}

const PG_PORT = 5544;
const pgUp = await reachable("127.0.0.1", PG_PORT);
process.stdout.write(`postgres 127.0.0.1:${PG_PORT} ${pgUp ? "reachable" : "unreachable"}\n`);
if (!pgUp && needed(LANE_PROBES, "postgres").length > 0) failures.push("postgres 5544");

const ports = [Number(process.env.PORT) || 3210, Number(process.env.E2E_PORT) || 3211];
for (const port of ports) {
  const free = await bindable(port);
  process.stdout.write(`port ${port} ${free ? "bindable" : "occupied"}\n`);
  if (!free && needed(LANE_PROBES, "ports").length > 0) failures.push(`port ${port}`);
}

const storageRoot = process.env.STORAGE_ROOT?.trim() || join(rootDir, ".storage");
process.stdout.write(`storage root ${storageRoot} ${existsSync(storageRoot) ? "present" : "absent"}\n`);

// The environment the tree reads today. Nothing armed needs one yet, so this reports and forgives.
for (const name of ["DATABASE_URL", "STORAGE_ROOT"]) {
  process.stdout.write(`env ${name} ${process.env[name] ? "set" : "unset"}\n`);
}

process.stdout.write(`armed lanes: ${armed.join(", ") || "none"}\n`);
if (failures.length > 0) {
  process.stdout.write(`checkup: fail — ${failures.join("; ")}\n`);
  process.exit(1);
}
process.stdout.write("checkup: ok\n");

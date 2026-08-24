#!/usr/bin/env node
// `pnpm checkup` — the machine's report (V-CHECKUP), run at session start. It prints every pinned
// tool beside the version this machine actually has, then the database, the ports, the storage
// root and the environment. It probes what the tree needs *today*: a tool or probe only a stub
// lane would need is reported and forgiven, one an armed lane needs is a failure (B-23).
//
// Owed, and deliberately absent today (B-23: this header states what the file does *now*):
//   · database roles and ledger drift — V-CHECKUP names both; both read the database, which
//     inc-000 scopes out. They land with the increment that delivers src/server/db/schema.
//   · tool hashes beside the pins — scripts/pins.json holds bare version strings; hashes need a
//     provenance source this tree does not have yet.
// Amending this file is a `toolchain`-tagged increment's business (C-06).
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

const VERSION = /\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?/;

/**
 * The version in a tool's own `--version` chatter, or ABSENT if it will not run. Tools name
 * themselves first (`uv 0.12.5 (…)`, `Typst 0.13.1`), so the token right after the command's own
 * name is preferred; only when the banner does not name it do we fall back to the first dotted
 * number, and a banner leading with some other dotted number (a date, a bundled Python) no longer
 * silently becomes the version.
 */
function probeVersion(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 20_000 });
  if (result.error || result.status !== 0) return "ABSENT";
  const chatter = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const named = new RegExp(`\\b${command}\\b\\s+v?(${VERSION.source})`, "i").exec(chatter);
  if (named) return named[1];
  const found = VERSION.exec(chatter);
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
  // A pin a wrong version satisfies is not a pin: 0.12.50 must not pass for 0.12.5, so the
  // comparison is equality on the bare version, never a prefix.
  const agrees = found !== "ABSENT" && bare(found) === bare(pin);
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

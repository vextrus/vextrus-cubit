#!/usr/bin/env node
// V-CHECKUP: the machine's report. It states the Node and pnpm pins and what this machine actually
// has, and it probes only what the tree needs — the same input roots the lane roster probes
// (ARCH-02), so a tool the tree has no use for yet is recorded as a skip naming that input root
// rather than passed over in silence (B-23). A check whose input exists but whose tool or service
// is absent fails the report.
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { connect } from "node:net";
import { accessSync, constants, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveMachineChecks } from "./lib/lanes.mjs";
import { portFor } from "./lib/ports.mjs";
import { announce, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

/** @typedef {{ok: boolean, detail: string}} Result */

/**
 * @param {string} relative
 * @returns {string}
 */
function readRoot(relative) {
  return readFileSync(resolve(ROOT, relative), "utf8");
}

/**
 * The pinned Node version, from .nvmrc — the same file the CI workflow reads.
 * @returns {string}
 */
function nodePin() {
  return readRoot(".nvmrc").trim().replace(/^v/, "");
}

/**
 * The pinned pnpm version, from package.json's packageManager field.
 * @returns {string}
 */
function pnpmPin() {
  const manifest = /** @type {{packageManager?: string}} */ (JSON.parse(readRoot("package.json")));
  return (manifest.packageManager ?? "").replace(/^pnpm@/, "").split("+")[0] ?? "";
}

/**
 * A tool's version string, or null when the tool is not on PATH.
 * @param {string} command
 * @param {string[]} args
 * @returns {string | null}
 */
function toolVersion(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 20_000 });
  if (result.error !== undefined || result.status !== 0) return null;
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split(/\r?\n/)[0] ?? "";
}

/**
 * @param {string} host
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function reachable(host, port) {
  return new Promise((done) => {
    const socket = connect({ host, port });
    const settle = (/** @type {boolean} */ value) => {
      socket.destroy();
      done(value);
    };
    socket.setTimeout(3_000);
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });
}

/**
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function bindable(port) {
  return new Promise((done) => {
    const server = createServer();
    server.once("error", () => done(false));
    server.listen(port, "127.0.0.1", () => server.close(() => done(true)));
  });
}

/**
 * The system tool pins C-06 orders, from package.json — the same file that pins pnpm.
 * @param {string} tool
 * @returns {string}
 */
function toolPin(tool) {
  const manifest = /** @type {{cubit?: {tools?: Record<string, string>}}} */ (JSON.parse(readRoot("package.json")));
  const pin = manifest.cubit?.tools?.[tool];
  if (pin === undefined) throw new Error(`package.json states no pin for ${tool} — C-06 pins Node, pnpm, uv and typst`);
  return pin;
}

/**
 * A pinned tool: present is not enough, it must be the version the tree pins (C-06).
 * @param {string} tool
 * @param {string[]} args
 * @returns {Result}
 */
function pinnedTool(tool, args) {
  const pin = toolPin(tool);
  const reported = toolVersion(tool, args);
  const actual = reported === null ? null : (/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/.exec(reported)?.[0] ?? reported);
  return { ok: actual === pin, detail: `${tool} ${actual ?? "absent"} (pin ${pin})` };
}

/**
 * The database the tree is configured to reach.
 * @returns {string}
 */
function databaseUrl() {
  return process.env["DATABASE_URL"] ?? "postgres://postgres@127.0.0.1:5544/postgres";
}

/**
 * The database the tree is configured to reach, as host and port.
 * @returns {{host: string, port: number}}
 */
function databaseAddress() {
  const parsed = new URL(databaseUrl());
  return { host: parsed.hostname, port: Number(parsed.port === "" ? "5432" : parsed.port) };
}

/**
 * The roles the database actually has, or null when they cannot be read at all.
 * @returns {string[] | null}
 */
function queryRoles() {
  const result = spawnSync("psql", [databaseUrl(), "-tAc", "select rolname from pg_roles order by 1"], { encoding: "utf8", timeout: 20_000 });
  if (result.error !== undefined || result.status !== 0) return null;
  return (result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/**
 * What each armed check asks of this machine.
 * @type {Record<string, () => Result | Promise<Result>>}
 */
const CHECKS = {
  node: () => {
    const pin = nodePin();
    const actual = process.versions.node;
    return { ok: actual === pin, detail: `node ${actual} (pin ${pin})` };
  },
  pnpm: () => {
    const pin = pnpmPin();
    const actual = toolVersion("pnpm", ["--version"]);
    return { ok: actual === pin, detail: `pnpm ${actual ?? "absent"} (pin ${pin})` };
  },
  postgres: async () => {
    const { host, port } = databaseAddress();
    const up = await reachable(host, port);
    return { ok: up, detail: `postgres ${host}:${port} ${up ? "reachable" : "unreachable"}` };
  },
  "db-roles": () => {
    // V-CHECKUP asks for roles, so this asks the database for its roles — a probe that only proved
    // psql is installed could not fail for the reason it is named after (B-23).
    const roles = queryRoles();
    if (roles === null) return { ok: false, detail: `db roles unreadable at ${databaseUrl()} — psql ${toolVersion("psql", ["--version"]) ?? "absent"}` };
    const connecting = new URL(databaseUrl()).username;
    const present = connecting === "" || roles.includes(connecting);
    return { ok: roles.length > 0 && present, detail: `db roles ${roles.length > 0 ? roles.join(" ") : "none"}${present ? "" : ` — ${connecting} is not among them`}` };
  },
  uv: () => pinnedTool("uv", ["--version"]),
  typst: () => pinnedTool("typst", ["--version"]),
  libredwg: () => {
    const version = toolVersion("dwgread", ["--version"]);
    return { ok: version !== null, detail: `libredwg ${version ?? "absent"}` };
  },
  ports: async () => {
    // The port set comes from the tree's one home, never from the environment alone: a check whose
    // list an unset variable can empty is a check that cannot fail (C-06, B-23).
    const ports = [portFor("app"), portFor("e2e")];
    const states = await Promise.all(ports.map(async (port) => `${port}:${(await bindable(port)) ? "free" : "busy"}`));
    return { ok: states.every((state) => state.endsWith("free")), detail: `ports ${states.join(" ")}` };
  },
  "storage-root": () => {
    const root = process.env["STORAGE_ROOT"] ?? resolve(ROOT, "storage");
    try {
      accessSync(root, constants.W_OK);
      return { ok: true, detail: `storage root ${root} writable` };
    } catch {
      return { ok: false, detail: `storage root ${root} not writable` };
    }
  },
};

const startedAt = performance.now();
const checks = deriveMachineChecks(ROOT);

const unrunnable = checks.filter((check) => CHECKS[check.id] === undefined).map((check) => check.id);
if (unrunnable.length > 0) {
  process.stdout.write(`checkup has no probe for ${unrunnable.join(", ")}\n`);
  process.exit(1);
}

let failed = 0;
for (const check of checks) {
  if (!announce(check)) continue;
  const result = await /** @type {() => Result | Promise<Result>} */ (CHECKS[check.id])();
  process.stdout.write(`  ${result.detail}${result.ok ? "" : " — FAIL"}\n`);
  if (!result.ok) failed = 1;
}

process.stdout.write(`checkup wall-time ${wallTime(startedAt)}\n`);
process.exit(failed);

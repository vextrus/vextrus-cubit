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
 * The database the tree is configured to reach, as host and port.
 * @returns {{host: string, port: number}}
 */
function databaseAddress() {
  const url = process.env["DATABASE_URL"];
  if (url === undefined) return { host: "127.0.0.1", port: 5544 };
  const parsed = new URL(url);
  return { host: parsed.hostname, port: Number(parsed.port === "" ? "5432" : parsed.port) };
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
    const version = toolVersion("psql", ["--version"]);
    return { ok: version !== null, detail: `psql ${version ?? "absent"}` };
  },
  uv: () => {
    const version = toolVersion("uv", ["--version"]);
    return { ok: version !== null, detail: `uv ${version ?? "absent"}` };
  },
  typst: () => {
    const version = toolVersion("typst", ["--version"]);
    return { ok: version !== null, detail: `typst ${version ?? "absent"}` };
  },
  libredwg: () => {
    const version = toolVersion("dwgread", ["--version"]);
    return { ok: version !== null, detail: `libredwg ${version ?? "absent"}` };
  },
  ports: async () => {
    const ports = [process.env["PORT"], process.env["E2E_PORT"]].map((value) => Number(value ?? "0")).filter((value) => value > 0);
    const states = await Promise.all(ports.map(async (port) => `${port}:${(await bindable(port)) ? "free" : "busy"}`));
    return { ok: states.every((state) => state.endsWith("free")), detail: `ports ${states.join(" ") || "none configured"}` };
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

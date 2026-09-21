#!/usr/bin/env node
// Supervised local development lane for Vextrus Cubit (ARCH-02, AM-19).
// Provisions isolated native-Postgres database (cubit_dev), seeds founder & SAMPLE project,
// and supervises Next.js dev server (.next-dev) and worker with isolated storage (storage/dev).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEV_DIST_DIR, DEV_SERVER_LOCK, holdDistDir, heldBy } from "./lib/dist.mjs";
import { portFor } from "./lib/ports.mjs";
import { devDatabaseUrl, provisionDevDatabase, ROLE_APP } from "./lib/pg-database.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

/**
 * Parses CLI arguments.
 * Supports: --port <num>, --host [ip], --no-worker, --reset
 */
export function parseArgs(argv = process.argv.slice(2)) {
  let port = portFor("app");
  let host = "127.0.0.1";
  let hostSpecified = false;
  let worker = true;
  let reset = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--port") {
      const next = argv[++i];
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
        process.stderr.write(`REFUSE dev: invalid port ${next}\n`);
        process.exit(1);
      }
      port = parsed;
    } else if (arg.startsWith("--port=")) {
      const parsed = Number(arg.split("=")[1]);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
        process.stderr.write(`REFUSE dev: invalid port ${arg}\n`);
        process.exit(1);
      }
      port = parsed;
    } else if (arg === "--host") {
      hostSpecified = true;
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        host = next;
        i++;
      } else {
        host = "0.0.0.0";
      }
    } else if (arg.startsWith("--host=")) {
      hostSpecified = true;
      host = arg.split("=")[1] || "0.0.0.0";
    } else if (arg === "--no-worker") {
      worker = false;
    } else if (arg === "--reset") {
      reset = true;
    }
  }

  return { port, host, hostSpecified, worker, reset };
}

/**
 * Checks whether a TCP port is bindable on the given host.
 * @param {number} port
 * @param {string} [host="0.0.0.0"]
 * @returns {Promise<boolean>}
 */
export function isPortBindable(port, host = "0.0.0.0") {
  return new Promise((resolveDone) => {
    const server = createServer();
    server.once("error", () => resolveDone(false));
    server.listen(port, host, () => {
      server.close(() => resolveDone(true));
    });
  });
}

/**
 * Attempts to identify the PID occupying a TCP port.
 * @param {number} port
 * @returns {number | null}
 */
export function findHoldingPid(port) {
  // 1. Check existing dist lockfiles
  const devHolder = heldBy(join(ROOT, DEV_DIST_DIR), DEV_SERVER_LOCK);
  if (devHolder !== null) return devHolder;

  // 2. Try fuser
  try {
    const r = spawnSync("fuser", [`${port}/tcp`], { encoding: "utf8", timeout: 2000 });
    const match = (r.stdout || r.stderr || "").trim().split(/\s+/)[0];
    const pid = Number(match);
    if (Number.isInteger(pid) && pid > 0) return pid;
  } catch {
    // ignore
  }

  // 3. Try lsof
  try {
    const r = spawnSync("lsof", ["-i", `:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8", timeout: 2000 });
    const pid = Number((r.stdout || "").trim().split(/\s+/)[0]);
    if (Number.isInteger(pid) && pid > 0) return pid;
  } catch {
    // ignore
  }

  // 4. Try ss
  try {
    const r = spawnSync("ss", ["-lptn", `sport = :${port}`], { encoding: "utf8", timeout: 2000 });
    const match = /pid=(\d+)/.exec(r.stdout || "");
    if (match) return Number(match[1]);
  } catch {
    // ignore
  }

  return null;
}

/**
 * Resolves a non-internal IPv4 address for WSL2 external reachability.
 * @returns {string}
 */
export function resolveExternalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

/**
 * Polls an HTTP endpoint until it answers or timeout is reached.
 * @param {string} url
 * @param {number} [timeoutMs=60_000]
 * @returns {Promise<boolean>}
 */
export async function waitForHttp(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(1500) });
      if (res.status > 0) return true;
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const { port, hostSpecified, worker, reset } = options;

  process.stdout.write("STAGE [ports]: checking port availability...\n");

  // Check dev server lock in .next-dev
  const devDistPath = join(ROOT, DEV_DIST_DIR);
  const existingHolder = heldBy(devDistPath, DEV_SERVER_LOCK);
  if (existingHolder !== null) {
    process.stderr.write(`REFUSE dev: another dev server is already running (PID ${existingHolder})\n`);
    process.exit(1);
  }

  // Determine bind host and public origin
  const bindHost = hostSpecified ? "0.0.0.0" : "127.0.0.1";
  const externalIp = hostSpecified ? resolveExternalIp() : "127.0.0.1";
  const publicOrigin = `http://${hostSpecified ? externalIp : "127.0.0.1"}:${port}`;

  // Verify port bindability
  const portFree = await isPortBindable(port, bindHost);
  if (!portFree) {
    const holdingPid = findHoldingPid(port);
    if (holdingPid !== null) {
      process.stderr.write(`REFUSE dev: port ${port} is occupied by PID ${holdingPid} — refuse to start\n`);
    } else {
      process.stderr.write(`REFUSE dev: port ${port} is occupied — refuse to start\n`);
    }
    process.exit(1);
  }
  process.stdout.write(`  port ${port} is free\n`);

  // Verify worker health port if worker enabled
  const workerHealthPort = port + 2;
  if (worker) {
    const workerPortFree = await isPortBindable(workerHealthPort, "127.0.0.1");
    if (!workerPortFree) {
      const holdingPid = findHoldingPid(workerHealthPort);
      if (holdingPid !== null) {
        process.stderr.write(`REFUSE dev: worker health port ${workerHealthPort} is occupied by PID ${holdingPid} — refuse to start\n`);
      } else {
        process.stderr.write(`REFUSE dev: worker health port ${workerHealthPort} is occupied — refuse to start\n`);
      }
      process.exit(1);
    }
    process.stdout.write(`  worker health port ${workerHealthPort} is free\n`);
  }

  // Prepare storage/dev
  process.stdout.write("STAGE [storage]: ensuring dev storage root...\n");
  const storageRoot = join(ROOT, "storage", "dev");
  mkdirSync(storageRoot, { recursive: true });
  process.stdout.write(`  storage/dev ready at ${storageRoot}\n`);

  // Provision dev database
  process.stdout.write("STAGE [database]: provisioning cubit_dev...\n");
  let dbResult;
  try {
    dbResult = provisionDevDatabase({ reset, rootDir: ROOT });
  } catch (err) {
    process.stderr.write(`REFUSE dev: database provisioning failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
  process.stdout.write(`  cubit_dev ready at ${dbResult.url}\n`);

  // Acquire dev dist lock
  const releaseLock = holdDistDir(devDistPath, port, DEV_SERVER_LOCK);

  // TypeSafe Jev System One model integration for dev
  const typeSafeKey = process.env["TYPESAFE_API_KEY"] || process.env["TYPESAFE_AI_API_KEY"] || "apikey_244bc7cb2167849415daea3891d1fe190e1_deb194f2845d07cc1667124eefea300c2747e6f5e98806752ee1ff17eea8b174";
  const fixtureRoot = typeSafeKey ? "" : (process.env["CUBIT_MODEL_FIXTURE_ROOT"] || resolve(ROOT, "fixtures/rcc6"));

  // Common environment for child processes
  const childEnv = {
    ...process.env,
    DATABASE_URL: devDatabaseUrl(ROLE_APP),
    NEXT_DIST_DIR: DEV_DIST_DIR,
    STORAGE_ROOT: storageRoot,
    CUBIT_PUBLIC_ORIGIN: publicOrigin,
    WORKER_HEALTH_PORT: String(workerHealthPort),
    CUBIT_STORAGE_SIGNING_SECRET: process.env["CUBIT_STORAGE_SIGNING_SECRET"] || "dev-insecure-storage-signing-secret",
    CUBIT_CAD_COMMAND: process.env["CUBIT_CAD_COMMAND"] || "",
    CUBIT_MODEL_FIXTURE_ROOT: fixtureRoot,
    TYPESAFE_API_KEY: typeSafeKey,
    PORT: String(port),
  };

  /** @type {import("node:child_process").ChildProcess[]} */
  const runningProcesses = [];

  // Supervise worker
  if (worker) {
    process.stdout.write("STAGE [worker]: starting worker process...\n");
    const workerProc = spawn(process.execPath, ["--import", "tsx", "src/worker/main.ts"], {
      cwd: ROOT,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    runningProcesses.push(workerProc);

    workerProc.stdout?.on("data", (data) => {
      const text = data.toString();
      for (const line of text.split("\n")) {
        if (line.trim()) process.stdout.write(`[worker] ${line}\n`);
      }
    });

    workerProc.stderr?.on("data", (data) => {
      const text = data.toString();
      for (const line of text.split("\n")) {
        if (line.trim()) process.stderr.write(`[worker:err] ${line}\n`);
      }
    });

    workerProc.on("exit", (code, signal) => {
      if (code !== 0 && signal === null) {
        process.stderr.write(`[worker] exited unexpectedly with code ${code}\n`);
      }
    });
  }

  // Supervise Next.js dev server
  process.stdout.write("STAGE [web]: starting Next.js dev server...\n");
  const nextBin = join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const nextProc = spawn(process.execPath, [nextBin, "dev", "--hostname", bindHost, "--port", String(port)], {
    cwd: ROOT,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  runningProcesses.push(nextProc);

  nextProc.stdout?.on("data", (data) => {
    process.stdout.write(data);
  });
  nextProc.stderr?.on("data", (data) => {
    process.stderr.write(data);
  });

  // Signal forwarding and cleanup
  /**
   * @param {import("node:child_process").ChildProcess} proc
   * @param {NodeJS.Signals | number} sig
   */
  const killProcTree = (proc, sig) => {
    if (!proc || !proc.pid) return;
    try {
      spawnSync("pkill", ["-P", String(proc.pid)], { timeout: 1000 });
    } catch {
      // ignore
    }
    try {
      proc.kill(sig);
    } catch {
      // ignore
    }
  };

  let shuttingDown = false;
  /** @param {NodeJS.Signals} [signal="SIGTERM"] */
  const shutdown = (signal = "SIGTERM") => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write(`\nShutting down dev lane (${signal})...\n`);
    for (const proc of runningProcesses) {
      killProcTree(proc, signal);
    }
    releaseLock();
    setTimeout(() => {
      for (const proc of runningProcesses) {
        killProcTree(proc, "SIGKILL");
      }
      process.exit(0);
    }, 2000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));

  nextProc.on("exit", (code, signal) => {
    shutdown(signal || "SIGTERM");
    process.exit(code ?? 0);
  });

  // Wait for web server readiness
  const ready = await waitForHttp(`http://127.0.0.1:${port}`);
  if (ready) {
    const banner = [
      "",
      "======================================================================",
      " VEXTRUS CUBIT — Dev Server Ready",
      "======================================================================",
      ` Web App URL:     http://${hostSpecified ? externalIp : "127.0.0.1"}:${port}`,
      ` Public Origin:   ${publicOrigin}`,
      ` Dist Directory:  ${DEV_DIST_DIR}`,
      ` Storage Root:    storage/dev`,
      ` Database:        cubit_dev (Postgres 127.0.0.1:5544)`,
      ` AI Model:        TypeSafe System One (Jev)`,
      "",
      " Founder Account:",
      "   Email:         founder@cubit.dev",
      "   Password:      cubit-dev-founder-password",
      "",
      " Workspace:       Founder Works (d3e00000-0000-4000-8000-000000000001)",
      " Sample Project:  SAMPLE: six-storey RCC residential building (SAMPLE-RCC6)",
      "",
    ];

    if (hostSpecified) {
      banner.push(" WSL2 Port Forwarding Hint (run in elevated Windows PowerShell):");
      banner.push(`   netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=${externalIp}`);
      banner.push("");
    } else {
      banner.push(" WSL2 localhost forwarding makes this reachable from Windows Edge/Chrome");
      banner.push(` at http://127.0.0.1:${port}`);
      banner.push("");
    }
    banner.push("======================================================================");
    banner.push("");

    process.stdout.write(banner.join("\n"));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`dev lane fatal error: ${err.message}\n`);
    process.exit(1);
  });
}

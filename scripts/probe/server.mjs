#!/usr/bin/env node
// The probe's stage: the same built product the journey lane serves (scripts/e2e-server.mjs,
// build-if-stale start), on the journeys' own database and roots, plus the shipped worker. Nothing
// here is a dev server (V-E2E). Writes pids to <scratch>/probe/server.pids; `--stop` kills them.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HERE = dirname(fileURLToPath(import.meta.url));
const PIDS = join(HERE, "server.pids");
const PORT = Number(process.env["PROBE_PORT"] ?? "3211");
export const ORIGIN = `http://127.0.0.1:${PORT}`;
export const DATABASE_URL = "postgres://cubit_app:cubit_app@127.0.0.1:5544/cubit_e2e";
export const MIGRATE_URL = "postgres://cubit_migrate:cubit_migrate@127.0.0.1:5544/cubit_e2e";

export const ENV = {
  ...process.env,
  DATABASE_URL,
  CUBIT_PUBLIC_ORIGIN: ORIGIN,
  CUBIT_STORAGE_SIGNING_SECRET: "the-journeys-stage-signing-key",
  CUBIT_UI_INSTRUMENT: "1",
  STORAGE_ROOT: join(ROOT, "storage"),
  CUBIT_MODEL_FIXTURE_ROOT: join(ROOT, "fixtures", "model"),
  WORKER_HEALTH_PORT: "0",
};
delete ENV.NODE_ENV;

function stop() {
  if (!existsSync(PIDS)) return;
  const pids = JSON.parse(readFileSync(PIDS, "utf8"));
  for (const pid of pids) {
    try { process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
  }
  rmSync(PIDS, { force: true });
  console.log(`stopped ${pids.join(",")}`);
}

/** @param {string} url @param {number} ms */
async function waitHttp(url, ms) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    try {
      const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(1500) });
      if (r.status > 0) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

if (process.argv.includes("--stop")) {
  stop();
} else {
  stop();
  const logs = { server: join(HERE, "server.log"), worker: join(HERE, "worker.log") };
  const serverOut = (await import("node:fs")).openSync(logs.server, "w");
  const workerOut = (await import("node:fs")).openSync(logs.worker, "w");
  const server = spawn(process.execPath, ["scripts/e2e-server.mjs", "--next", "node_modules/next/dist/bin/next", "build-if-stale", "start", "--port", String(PORT)], { cwd: ROOT, env: ENV, stdio: ["ignore", serverOut, serverOut], detached: true });
  const worker = spawn(process.execPath, ["--import", "tsx", "src/worker/main.ts"], { cwd: ROOT, env: ENV, stdio: ["ignore", workerOut, workerOut], detached: true });
  writeFileSync(PIDS, JSON.stringify([server.pid, worker.pid]));
  server.unref();
  worker.unref();
  const ready = await waitHttp(ORIGIN, 300_000);
  const workerReady = (() => {
    const started = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        const text = existsSync(logs.worker) ? readFileSync(logs.worker, "utf8") : "";
        if (text.includes("worker: ready")) return resolve(true);
        if (Date.now() - started > 60_000) return resolve(false);
        setTimeout(tick, 300);
      };
      tick();
    });
  })();
  console.log(`server ${ready ? "ready" : "NOT READY"} at ${ORIGIN} (pid ${server.pid}); worker ${(await workerReady) ? "ready" : "NOT READY"} (pid ${worker.pid}); logs ${logs.server} ${logs.worker}`);
  process.exit(ready ? 0 : 1);
}

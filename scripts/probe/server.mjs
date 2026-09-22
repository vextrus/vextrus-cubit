#!/usr/bin/env node
// The probe's stage: the same built product the journey lane serves (scripts/e2e-server.mjs,
// build-if-stale start), on the journeys' own database and roots, plus the shipped worker. Nothing
// here is a dev server (V-E2E). Writes its record to scripts/probe/server.pids and its logs to
// scripts/probe/{server,worker}.log (all git-ignored); `--stop` stops what that record names and
// nothing else. It serves on the journeys' port (`portFor("e2e")`, scripts/lib/ports.mjs; E2E_PORT
// moves it) — the one probe.mjs reads its origin from.
//
// How a stage is served has one home, scripts/lib/stage.mjs, which `pnpm demo` serves through too
// (on its own port, with its own record): this file only names the probe's stage and speaks for it.
// It acts only when it is the process's entry point, so a suite can read the stage it names.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIsCurrent } from "../lib/build-currency.mjs";
import { DEFAULT_DIST_DIR, holdersOf } from "../lib/dist.mjs";
import { attribution, portState } from "../lib/port-probe.mjs";
import { portFor } from "../lib/ports.mjs";
import { startStage, stopStage } from "../lib/stage.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

/** The probe's stage: the journeys' port, the worker beside it, the evidence instrument armed. */
export const PROBE_STAGE = Object.freeze({
  name: "probe",
  which: /** @type {const} */ ("e2e"),
  worker: true,
  instrument: true,
  record: join(HERE, "server.pids"),
  logs: { server: join(HERE, "server.log"), worker: join(HERE, "worker.log") },
});

/** @returns {number[]} the pids this call signalled */
function stop() {
  const result = stopStage(PROBE_STAGE);
  if (result.foreign !== null) console.log(`left ${PROBE_STAGE.record} alone — it belongs to ${result.foreign}, not to this checkout's probe`);
  else if (result.stopped.length > 0) console.log(`stopped ${result.stopped.join(",")}`);
  return result.stopped;
}

/** Is this file the process's entry point, rather than a module a suite is reading? */
function isEntryPoint() {
  const entry = process.argv[1];
  return entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url);
}

/** Stop an earlier probe stage, refuse a held port by name, then serve. */
async function serve() {
  const stopped = stop();
  // The build is shared: `pnpm demo` may be serving `.next-cubit` from this checkout on its own port.
  // Serving beside it is read-only and harmless; REBUILDING under it deletes the bundle it answers
  // from. So a stale build with another live server on it is refused by name (docs/demo.md).
  const others = holdersOf(join(ROOT, DEFAULT_DIST_DIR)).filter((holder) => !stopped.includes(holder.pid));
  const build = buildIsCurrent(ROOT, DEFAULT_DIST_DIR);
  if (!build.current && others.length > 0) {
    const who = others.map((holder) => `pid ${holder.pid}${holder.port === null ? "" : ` on port ${holder.port}`}`).join("; ");
    console.error(`REFUSE probe:server — ${DEFAULT_DIST_DIR} must be rebuilt (${build.why}) and a live server serves from it (${who}); a build would pull the bundle out from under it. Stop that server first (\`pnpm demo --stop\` stops a demo).`);
    process.exit(1);
  }
  const port = portFor(PROBE_STAGE.which);
  // A port held by anything else — a journey lane, a Windows listener under mirrored networking —
  // would let the readiness wait call THAT server ready. Refuse by name instead, asked the tree's one
  // way (scripts/lib/port-probe.mjs).
  if ((await portState(port)) !== "free") {
    console.error(`REFUSE probe:server — port ${port} is held (${attribution(port)}); stop its holder or move the stage with E2E_PORT`);
    process.exit(1);
  }
  const served = await startStage(PROBE_STAGE);
  const pidOf = (/** @type {string} */ role) => served.processes.find((entry) => entry.role === role)?.pid ?? "none";
  console.log(
    `server ${served.ready ? "ready" : "NOT READY"} at ${served.origin} (pid ${pidOf("server")}); worker ${served.workerReady === true ? "ready" : "NOT READY"} (pid ${pidOf("worker")}); logs ${PROBE_STAGE.logs.server} ${PROBE_STAGE.logs.worker}`,
  );
  process.exit(served.ready ? 0 : 1);
}

if (isEntryPoint()) {
  if (process.argv.includes("--stop")) stop();
  else await serve();
}

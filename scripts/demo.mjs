#!/usr/bin/env node
// `pnpm demo` — ONE command that serves a measured M3 project to the owner's browser, with its
// sign-in printed (session 7, the owner's ruling: shown "on my screen"). docs/demo.md is the runbook.
//
//   pnpm demo              find the project, prove its sign-in, serve, print one block, open the browser
//   pnpm demo --no-open    the same, without opening a browser
//   pnpm demo --stop       stop what `pnpm demo` started in this checkout, and nothing else
//
// WHAT IT SERVES. The built product the journeys walk (`.next-cubit`, reused when current and built
// first when not), on the demo's OWN port (`portFor("demo")`, scripts/lib/ports.mjs) so it never
// holds the journeys' port, bound to 127.0.0.1 only, against the journeys' database `cubit_e2e` —
// the one place a measured M3 project lives, because only a J-000 run walking the M3 legs makes one.
// How a stage is served has one home, scripts/lib/stage.mjs; this file names the demo's stage.
//
// WHICH PROJECT. The newest "Bashundhara G+6" (J-000's M3 prologue) whose newest campaign published
// COMPLETE column concrete lines — preferring one that also holds an issued bill of quantities and
// bar rows (the bill leg's), and saying which it found. It must have been made by J-000's legs
// account and keep its drawings in this checkout's store, or the sheets would answer "the store holds
// no object". Every query is read-only, names its system reason first, and is scoped by the project
// name and then by the chosen tenant: the database holds every earlier run of every checkout.
//
// WHICH SIGN-IN. J-000's legs sign up as `j000-legs-<stamp>@cubit.test` with `golden-path-legs-<stamp>`
// (tests/e2e/journeys/j-000/golden-run.ts, `establish`). The run file that records the address is
// deleted by the next Playwright run, so the database is the lasting record: the address is read off
// the account (through the product's own fold, `presentedValue`), the password derived from it, and
// the derivation PROVED against the stored hash with the product's own `verifyPassword` before a
// byte is served. The hash is never printed; the password — a derivable test credential of a journey
// account — is printed once, in the final block.
//
// THE WORKER. The demo runs the shipped worker beside the served product, as the probe does, so
// Measure and "Draft the bill" do their work in front of the owner (the orchestrator's session-7
// ruling). That worker takes jobs from every tenant in `cubit_e2e`, so no journey may run while the
// demo stands: it refuses to start while the journeys' port is held, and docs/demo.md says so for
// the reverse. It serves only once the worker has said "worker: ready".
//
// WHAT IT NEVER DOES. It never builds under a server: when a live server in this checkout serves
// `.next-cubit` — a journey run or the probe — it refuses by name instead of starting.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { presentedValue } from "../src/server/auth/folded-key";
import { verifyPassword } from "../src/server/auth/secrets";
import { buildIsCurrent } from "./lib/build-currency.mjs";
import { DEFAULT_DIST_DIR, holdersOf } from "./lib/dist.mjs";
import { e2eDatabaseUrl, runSql } from "./lib/pg-database.mjs";
import { attribution, portState } from "./lib/port-probe.mjs";
import { portFor } from "./lib/ports.mjs";
import { READY_BUDGET_MS, liveStageProcesses, stageStorageRoot, startStage, stopStage } from "./lib/stage.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

/** Where the demo keeps its record and its log: the tree's own cache home, git-ignored, cleaned by no lane. */
const DEMO_HOME = join(ROOT, "node_modules", ".cache", "cubit", "demo");

/**
 * The demo's stage: its own port, the shipped worker beside it, no evidence instrument (the owner
 * sees what a customer sees), and a record of its own — never the probe's `scripts/probe/server.pids`.
 */
export const DEMO_STAGE = Object.freeze({
  name: "demo",
  which: /** @type {const} */ ("demo"),
  worker: true,
  instrument: false,
  record: join(DEMO_HOME, "stage.json"),
  logs: { server: join(DEMO_HOME, "server.log"), worker: join(DEMO_HOME, "worker.log") },
});

/** J-000's M3 project, as its prologue names it (golden-run.ts, BNBC_PROJECT_NAME). */
export const M3_PROJECT_NAME = "Bashundhara G+6";

/** What "measured" is read as: the newest campaign published COMPLETE column concrete lines. */
export const MEASURED = Object.freeze({ class: "column", kind: "rcc.concrete", coverage: "COMPLETE" });

/** The document an issued bill is (src/core/documents/kinds/boq-draft-law.ts, BOQ_DRAFT). */
export const BILL_KIND = "boq-draft";

/** The address J-000's legs sign up with (golden-run.ts, `establish`); the stamp is the capture. */
export const LEGS_ADDRESS = /^j000-legs-([0-9a-z]+)@cubit\.test$/;

/** The reason every read here names before it reads (SEAM-TENANT's system scope). */
export const SYSTEM_REASON = "pnpm demo: choose the measured M3 project to serve, and prove its sign-in (read-only)";

/** The Windows shell a WSL process opens the owner's browser through. */
export const WINDOWS_CMD = "/mnt/c/Windows/System32/cmd.exe";

/** Where cmd.exe is run from: a Windows directory, so it never complains about a UNC working directory. */
const WINDOWS_CWD = "/mnt/c";

/** A uuid as the store writes one — the only shape an id read back is ever interpolated in. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * @typedef {{ user_id: string, key: string }} MemberRow
 * @typedef {{ tenant_id: string, project_id: string, created_at: string, column_lines: number, live_bills: number, bar_rows: number, members: MemberRow[] }} CandidateRow
 * @typedef {{ userId: string, email: string, password: string }} LegsAccount
 * @typedef {{ tier: "billed" | "measured", row: CandidateRow, account: LegsAccount }} Choice
 * @typedef {{ projects: number, measured: number, billed: number, noAccount: number, elsewhere: number }} Tally
 */

/**
 * Two keys in code-unit order: ids and stored keys are compared as the store holds them, never by locale.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function byCodeUnits(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The password J-000's legs sign up with, for the stamp their address carries.
 * @param {string} stamp
 * @returns {string}
 */
export function legsPassword(stamp) {
  return `golden-path-legs-${stamp}`;
}

/**
 * The legs account among a workspace's members, read through the product's own fold: the stored key
 * is the address "as presented", and only a key that carries one can be a J-000 address.
 * @param {readonly MemberRow[]} members
 * @param {(key: string) => string | null} [presented]
 * @returns {LegsAccount | null}
 */
export function legsAccount(members, presented = presentedValue) {
  for (const member of [...members].sort((a, b) => byCodeUnits(a.key, b.key))) {
    const email = presented(member.key);
    const stamp = email === null ? undefined : LEGS_ADDRESS.exec(email)?.[1];
    if (email !== null && stamp !== undefined) return { userId: member.user_id, email, password: legsPassword(stamp) };
  }
  return null;
}

/**
 * Newest first: by when the project was made, then by its id so two made in one instant still order.
 * @param {CandidateRow} a
 * @param {CandidateRow} b
 * @returns {number}
 */
function newestFirst(a, b) {
  const byTime = Date.parse(b.created_at) - Date.parse(a.created_at);
  return byTime !== 0 && Number.isFinite(byTime) ? byTime : byCodeUnits(b.project_id, a.project_id);
}

/**
 * THE CHOICE. Of the M3 projects, the newest that is measured, was made by J-000's legs account and
 * keeps its drawings in this checkout's store — preferring the newest that is also BILLED (a live
 * issued bill of quantities and bar rows). The tally says what was passed over and why.
 * @param {readonly CandidateRow[]} rows
 * @param {{ stored?: (tenantId: string) => boolean, presented?: (key: string) => string | null }} [options]
 * @returns {{ choice: Choice | null, tally: Tally }}
 */
export function chooseProject(rows, options = {}) {
  const stored = options.stored ?? (() => true);
  /** @type {Tally} */
  const tally = { projects: rows.length, measured: 0, billed: 0, noAccount: 0, elsewhere: 0 };
  /** @type {Choice | null} */
  let billed = null;
  /** @type {Choice | null} */
  let measured = null;
  for (const row of [...rows].sort(newestFirst)) {
    if (!(Number(row.column_lines) > 0)) continue;
    tally.measured += 1;
    const account = legsAccount(row.members, options.presented);
    if (account === null) {
      tally.noAccount += 1;
      continue;
    }
    if (!stored(row.tenant_id)) {
      tally.elsewhere += 1;
      continue;
    }
    const isBilled = Number(row.live_bills) > 0 && Number(row.bar_rows) > 0;
    if (isBilled) tally.billed += 1;
    if (isBilled && billed === null) billed = { tier: "billed", row, account };
    if (measured === null) measured = { tier: "measured", row, account };
  }
  return { choice: billed ?? measured, tally };
}

/**
 * A string literal for SQL, quoted so nothing read can be read as syntax.
 * @param {string} value
 * @returns {string}
 */
function lit(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * The candidates, one JSON line: every M3 project that is not archived, with its newest campaign's
 * measured column lines and bar rows, its live bills, and its members' stored keys. No hash is read.
 * @returns {string}
 */
export function candidatesSql() {
  return [
    "begin read only;",
    `set local cubit.system_reason = ${lit(SYSTEM_REASON)};`,
    "select coalesce(jsonb_agg(to_jsonb(candidate) order by candidate.created_at desc, candidate.project_id desc), '[]'::jsonb) from (",
    "  select p.tenant_id, p.project_id, p.created_at,",
    "    (select count(*) from quantity_lines ql where ql.tenant_id = p.tenant_id and ql.campaign_id = newest.campaign_id",
    `       and ql.class = ${lit(MEASURED.class)} and ql.kind = ${lit(MEASURED.kind)} and ql.coverage = ${lit(MEASURED.coverage)})::int as column_lines,`,
    `    (select count(*) from documents d where d.tenant_id = p.tenant_id and d.project_id = p.project_id and d.kind = ${lit(BILL_KIND)} and d.superseded_by is null)::int as live_bills,`,
    "    (select count(*) from bar_rows b where b.tenant_id = p.tenant_id and b.campaign_id = newest.campaign_id)::int as bar_rows,",
    "    (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'key', u.email) order by u.email), '[]'::jsonb)",
    "       from memberships m join users u on u.user_id = m.user_id where m.tenant_id = p.tenant_id) as members",
    "  from projects p",
    "  left join lateral (select c.campaign_id from campaigns c where c.tenant_id = p.tenant_id and c.project_id = p.project_id",
    "     order by c.opened_at desc, c.campaign_id desc limit 1) newest on true",
    `  where p.name = ${lit(M3_PROJECT_NAME)} and p.archived_at is null`,
    ") candidate;",
    "commit;",
  ].join("\n");
}

/**
 * The one account's stored hash, scoped to the chosen workspace and member. Both ids were read from
 * the store and are refused here unless they are uuids.
 * @param {string} tenantId
 * @param {string} userId
 * @returns {string}
 */
export function hashSql(tenantId, userId) {
  if (!UUID.test(tenantId) || !UUID.test(userId)) throw new Error(`not an id the store writes: ${JSON.stringify({ tenantId, userId })}`);
  return [
    "begin read only;",
    `set local cubit.system_reason = ${lit(SYSTEM_REASON)};`,
    "select jsonb_build_object('hash', u.password_hash) from memberships m join users u on u.user_id = m.user_id",
    `  where m.tenant_id = ${lit(tenantId)} and m.user_id = ${lit(userId)};`,
    "commit;",
  ].join("\n");
}

/**
 * The JSON psql answered, out of its transcript (BEGIN, SET and COMMIT each print their tag).
 * @param {string} stdout
 * @returns {unknown}
 */
export function jsonOf(stdout) {
  const line = stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("[") || entry.startsWith("{"))
    .pop();
  return line === undefined ? null : /** @type {unknown} */ (JSON.parse(line));
}

/**
 * The register of a project, where the demo sends the owner (src/app/(app)/t/[tenant]/p/[project]/takeoff/register).
 * @param {string} origin
 * @param {string} tenantId
 * @param {string} projectId
 * @returns {string}
 */
export function registerUrl(origin, tenantId, projectId) {
  return `${origin}/t/${tenantId}/p/${projectId}/takeoff/register`;
}

/** The refusals, by name: each says what was found, what it would have cost, and what to do. */
export const REFUSE = Object.freeze({
  /** @param {number} port @param {string} holder */
  portHeld: (port, holder) =>
    `REFUSE demo — port ${port} is held (${holder}). If it is a demo this checkout started, \`pnpm demo --stop\`; otherwise stop its holder, or move the demo with DEMO_PORT.`,
  /** @param {readonly number[]} pids */
  alreadyServing: (pids) => `REFUSE demo — a demo this checkout started is still starting or serving (pid ${pids.join(", ")}); \`pnpm demo --stop\` first.`,
  /** @param {number} port @param {string} holder */
  journeyRunning: (port, holder) =>
    `REFUSE demo — the journeys' port ${port} is held (${holder}): a journey run or the probe is standing. The demo's worker takes jobs from every tenant in cubit_e2e and would take that run's; run \`pnpm demo\` once it has ended.`,
  /** @param {string} dist @param {readonly {pid: number, port: number | null}[]} holders */
  buildHeld: (dist, holders) =>
    `REFUSE demo — ${dist} is being served by a live server (${holders.map((h) => `pid ${h.pid}${h.port === null ? "" : ` on port ${h.port}`}`).join("; ")}): a journey run or the probe in this checkout. The demo serves that same build and would rebuild it under that server if it were stale — run \`pnpm demo\` once that server has ended (\`pnpm probe:server --stop\` ends the probe's).`,
  /** @param {string} detail */
  noDatabase: (detail) => `REFUSE demo — cubit_e2e could not be read (${detail}). Is the cluster up? \`pnpm checkup\` says.`,
  /** @param {Tally} tally */
  noProject: (tally) => {
    if (tally.measured === 0) {
      return `REFUSE demo — no measured "${M3_PROJECT_NAME}" project stands in cubit_e2e (${tally.projects} found, none with COMPLETE column concrete lines on its newest campaign). Walk the M3 legs first: \`pnpm e2e --journeys J-000\`.`;
    }
    const why = [
      tally.noAccount > 0 ? `${tally.noAccount} not made by J-000's legs account` : "",
      tally.elsewhere > 0 ? `${tally.elsewhere} keeping their drawings in another checkout's store (run \`pnpm demo\` in the checkout whose J-000 run made them)` : "",
    ].filter((part) => part !== "");
    return `REFUSE demo — ${tally.measured} measured "${M3_PROJECT_NAME}" project(s) in cubit_e2e, none servable from here: ${why.join("; ")}.`;
  },
  /** @param {string} email */
  unproved: (email) =>
    `REFUSE demo — the password J-000's legs derive for ${email} does not verify against that account's stored hash, so the sign-in cannot be printed as true. Nothing was served.`,
  /** @param {string} origin @param {string} log @param {boolean} exited */
  notReady: (origin, log, exited) =>
    exited
      ? `FAIL demo — the served product exited before it answered at ${origin} (a failed build ends it); nothing is left running. Its log: ${log}`
      : `FAIL demo — the product did not answer at ${origin} within ${READY_BUDGET_MS / 1000}s; stopped what was started. Its log: ${log}`,
  /** @param {string} log */
  workerNotReady: (log) =>
    `FAIL demo — the worker never said "worker: ready", so Measure and "Draft the bill" would hang in front of the owner; stopped what was started. Its log: ${log}`,
});

/**
 * Open the owner's Windows browser on a URL — `cmd.exe /c start "" <url>` from a Windows directory.
 * The empty argument is start's window title: without it a quoted URL would be taken for one.
 * @param {string} url
 * @param {{ exists?: (path: string) => boolean, run?: typeof spawnSync }} [deps]
 * @returns {{ opened: boolean, why: string }}
 */
export function openInWindows(url, deps = {}) {
  const exists = deps.exists ?? existsSync;
  const run = deps.run ?? spawnSync;
  if (!exists(WINDOWS_CMD)) return { opened: false, why: `not opened: ${WINDOWS_CMD} is absent (not WSL, or CI) — paste the address into a browser` };
  const result = run(WINDOWS_CMD, ["/c", "start", "", url], { cwd: WINDOWS_CWD, stdio: "ignore", timeout: 15_000 });
  if (result.error === undefined && result.status === 0) return { opened: true, why: "opened in your Windows browser" };
  return { opened: false, why: `not opened: cmd.exe answered ${result.error?.message ?? `exit ${result.status}`} — paste the address into a browser` };
}

/**
 * What the chosen project is, in one line of the block.
 * @param {Choice} choice
 * @returns {string}
 */
export function tierLine(choice) {
  const lines = `${choice.row.column_lines} column concrete lines`;
  return choice.tier === "billed"
    ? `measured and billed — ${lines}, an issued bill of quantities, ${choice.row.bar_rows} bar rows`
    : `measured only — ${lines}; no issued bill with bar rows yet (the bill leg has not run on it)`;
}

/**
 * THE BLOCK the owner reads — printed once, and the only place the password is printed.
 * @param {{ origin: string, url: string, choice: Choice, opened: string }} served
 * @returns {string}
 */
export function demoBlock(served) {
  const { choice } = served;
  const rule = "─".repeat(78);
  return [
    rule,
    `DEMO ready — Vextrus Cubit at ${served.origin} (127.0.0.1 only; nothing listens beyond this machine)`,
    "",
    `  Project   ${M3_PROJECT_NAME} — ${tierLine(choice)}`,
    `            made ${choice.row.created_at} by J-000's M3 legs`,
    `  Open      ${served.url}`,
    `  Sign in   ${choice.account.email}`,
    `  Password  ${choice.account.password}`,
    "            The address asks you to sign in first and then lands on the product's home: open it again.",
    "  Worker    ready — it takes jobs from every tenant in cubit_e2e: run no journey while the demo stands",
    "  Stop      pnpm demo --stop",
    "",
    `  Browser   ${served.opened}`,
    rule,
  ].join("\n");
}

/**
 * @param {string} line
 * @param {number} [code]
 * @returns {never}
 */
function refuse(line, code = 1) {
  process.stderr.write(`${line}\n`);
  process.exit(code);
}

/** `pnpm demo --stop`: what this checkout's demo started, and nothing else. */
async function stop() {
  const port = portFor(DEMO_STAGE.which);
  const result = stopStage(DEMO_STAGE);
  if (result.foreign !== null) refuse(`REFUSE demo --stop — ${DEMO_STAGE.record} belongs to ${result.foreign}, not to this checkout's demo; nothing was signalled.`);
  if (!result.had) {
    const state = await portState(port);
    process.stdout.write(`demo: nothing to stop — this checkout started no demo; port ${port} is ${state === "free" ? "free" : `held (${attribution(port)})`}\n`);
    return;
  }
  const started = Date.now();
  while ((await portState(port)) !== "free" && Date.now() - started < 15_000) await new Promise((settle) => setTimeout(settle, 250));
  const state = await portState(port);
  process.stdout.write(
    `demo: stopped ${result.stopped.length === 0 ? "nothing still running" : `pid ${result.stopped.join(", ")}`}; port ${port} is ${state === "free" ? "free" : `still held (${attribution(port)})`}\n`,
  );
}

/** `pnpm demo [--no-open]`. */
async function start(/** @type {boolean} */ open) {
  const port = portFor(DEMO_STAGE.which);
  if ((await portState(port)) !== "free") refuse(REFUSE.portHeld(port, attribution(port)));
  const journeys = portFor("e2e");
  if ((await portState(journeys)) !== "free") refuse(REFUSE.journeyRunning(journeys, attribution(journeys)));
  const live = liveStageProcesses(DEMO_STAGE);
  if (live.length > 0) refuse(REFUSE.alreadyServing(live.map((entry) => entry.pid)));
  const holders = holdersOf(join(ROOT, DEFAULT_DIST_DIR));
  if (holders.length > 0) refuse(REFUSE.buildHeld(DEFAULT_DIST_DIR, holders));

  const database = e2eDatabaseUrl();
  /** @type {CandidateRow[]} */
  let rows;
  try {
    rows = /** @type {CandidateRow[]} */ (jsonOf(runSql(database, candidatesSql())) ?? []);
  } catch (error) {
    refuse(REFUSE.noDatabase(/** @type {Error} */ (error).message.split("\n").slice(-1)[0] ?? "psql failed"));
  }
  const { choice, tally } = chooseProject(rows, { stored: (tenantId) => existsSync(join(stageStorageRoot(), tenantId)) });
  if (choice === null) refuse(REFUSE.noProject(tally));

  const answered = /** @type {{hash?: unknown} | null} */ (jsonOf(runSql(database, hashSql(choice.row.tenant_id, choice.account.userId))));
  const hash = typeof answered?.hash === "string" ? answered.hash : null;
  if (hash === null || !(await verifyPassword(choice.account.password, hash))) refuse(REFUSE.unproved(choice.account.email));

  const build = buildIsCurrent(ROOT, DEFAULT_DIST_DIR);
  process.stdout.write(
    `demo: project ${choice.row.project_id} — ${choice.tier} (${tally.billed} billed of ${tally.measured} measured, ${tally.projects} "${M3_PROJECT_NAME}" in cubit_e2e); sign-in proved against the stored hash\n`,
  );
  process.stdout.write(`demo: ${build.current ? "serving the built product" : "building the product first (a minute or two)"} — ${build.why}; log ${DEMO_STAGE.logs.server}\n`);

  const served = await startStage(DEMO_STAGE);
  if (!served.ready) {
    stopStage(DEMO_STAGE);
    refuse(REFUSE.notReady(served.origin, DEMO_STAGE.logs.server, served.exited));
  }
  if (served.workerReady !== true) {
    stopStage(DEMO_STAGE);
    refuse(REFUSE.workerNotReady(DEMO_STAGE.logs.worker));
  }
  const workerPid = served.processes.find((entry) => entry.role === "worker")?.pid;
  process.stdout.write(`demo: served at ${served.origin}; worker: ready (pid ${workerPid ?? "none"}); log ${DEMO_STAGE.logs.worker}\n`);
  const url = registerUrl(served.origin, choice.row.tenant_id, choice.row.project_id);
  const opened = open ? openInWindows(url).why : "not opened (--no-open)";
  process.stdout.write(`${demoBlock({ origin: served.origin, url, choice, opened })}\n`);
}

/** Is this file the process's entry point, rather than a module a suite is reading? */
function isEntryPoint() {
  const entry = process.argv[1];
  return entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isEntryPoint()) {
  const argv = process.argv.slice(2);
  if (argv.includes("--stop")) await stop();
  else await start(!argv.includes("--no-open"));
  // The stage runs detached; nothing of this process is left to wait for (a fetch's keep-alive socket
  // would otherwise hold the prompt for a few seconds after the block).
  process.exit(0);
}

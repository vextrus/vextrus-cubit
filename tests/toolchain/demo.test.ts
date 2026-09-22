// `pnpm demo` (scripts/demo.mjs, docs/demo.md; session 7, slice C1): ONE command that serves a
// measured M3 project to the owner's browser, on its own port, with its sign-in printed. What is
// provable without a database or a server is proved here: the port it takes and that it spells none;
// that the db lane's guard counts it and the journeys' lanes do not; which project it chooses over
// rows it is handed; the account and password it derives, and that the derivation is the one J-000's
// legs sign up with; the URL it prints; the refusals; and that a probe session and a demo session can
// never stop each other's processes. The served path itself is the live smoke's (docs/demo.md).
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  BILL_KIND,
  DEMO_STAGE,
  M3_PROJECT_NAME,
  MEASURED,
  REFUSE,
  SYSTEM_REASON,
  WINDOWS_CMD,
  candidatesSql,
  chooseProject,
  demoBlock,
  hashSql,
  jsonOf,
  legsAccount,
  legsPassword,
  openInWindows,
  registerUrl,
} from "../../scripts/demo.mjs";
import { gate } from "../../scripts/gate.mjs";
import { PORTS, originFor, portFor, servedPorts } from "../../scripts/lib/ports.mjs";
import { ROLE_MARKS, liveStageProcesses, readStageRecord, stageEnv, stageStorageRoot, startStage, stopStage } from "../../scripts/lib/stage.mjs";
import { PROBE_STAGE } from "../../scripts/probe/server.mjs";
import { ELEMENT_TYPES } from "../../src/core/catalogue/classes";
import { KINDS } from "../../src/core/catalogue/kinds";
import { BOQ_DRAFT } from "../../src/core/documents/kinds/boq-draft-law";
import { COVERAGES } from "../../src/core/offers/law";
import { foldedKey } from "../../src/server/auth/folded-key";
import { hashPassword, verifyPassword } from "../../src/server/auth/secrets";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (file: string): string => readFileSync(join(ROOT, file), "utf8");

/** A served port as source spells one (the same pattern tests/toolchain/ports-one-home.test.ts scans for). */
const SERVED_PORT = /\b32(1[0-3])\b/;

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";

type Row = Parameters<typeof chooseProject>[0][number];

/** One candidate row, as the candidates query answers it, measured and made by a legs account unless told otherwise. */
function row(overrides: Partial<Row> & { stamp?: string } = {}): Row {
  const stamp = overrides.stamp ?? "mud8l396l8lf";
  return {
    tenant_id: TENANT,
    project_id: PROJECT,
    created_at: "2026-09-23T04:19:31.40053+06:00",
    column_lines: 182,
    live_bills: 0,
    bar_rows: 0,
    members: [{ user_id: USER, key: foldedKey(`j000-legs-${stamp}@cubit.test`, true) }],
    ...overrides,
  };
}

const NAMES = ["PORT", "E2E_PORT", "DEMO_PORT"] as const;
const saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
afterEach(() => {
  for (const name of NAMES) {
    const value = saved[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("the port: the demo's own, from the one home, never the journeys'", () => {
  test("the demo serves on portFor('demo') — 3213 unless DEMO_PORT moves it — and at 127.0.0.1, never localhost", () => {
    for (const name of NAMES) delete process.env[name];
    expect(DEMO_STAGE.which).toBe("demo");
    expect(portFor(DEMO_STAGE.which)).toBe(PORTS.demo);
    expect(PORTS.demo, "the demo's port is not one a lane serves on").not.toBe(PORTS.e2e);
    expect(PORTS.demo).not.toBe(PORTS.app);
    expect(stageEnv(DEMO_STAGE)["CUBIT_PUBLIC_ORIGIN"]).toBe(`http://127.0.0.1:${PORTS.demo}`);
    process.env["DEMO_PORT"] = "4213";
    expect(originFor(DEMO_STAGE.which)).toBe("http://127.0.0.1:4213");
  });

  test("scripts/demo.mjs and the stage it serves through spell no served port, and ask the one home for theirs", () => {
    for (const file of ["scripts/demo.mjs", "scripts/lib/stage.mjs", "scripts/probe/server.mjs"]) {
      const spelled = read(file)
        .split("\n")
        .flatMap((line, at) => (SERVED_PORT.test(line) ? [`${file}:${at + 1}: ${line.trim()}`] : []));
      expect(spelled, `${file} spells a served port — ask portFor/originFor`).toEqual([]);
    }
    expect(read("scripts/demo.mjs")).toMatch(/from "\.\/lib\/ports\.mjs"/);
    expect(read("scripts/lib/stage.mjs")).toMatch(/from "\.\/ports\.mjs"/);
  });

  test("the db lane's guard counts the demo's port (a served product and the db lane share one cluster, V-DB) — and the journeys' lanes are not held up by it", async () => {
    for (const name of NAMES) delete process.env[name];
    expect(servedPorts()).toContain(portFor("demo"));
    const demo = portFor("demo");
    const ran: string[] = [];
    const lines: string[] = [];
    const code = await gate({
      only: "db,e2e",
      out: "test-results/gate-test",
      write: (line) => lines.push(line.trimEnd()),
      probe: async (port) => (port === demo ? "busy" : "free"),
      attribute: () => "the demo (stand-in)",
      run: async (lane) => {
        ran.push(lane.id);
        return 0;
      },
    });
    const refusal = lines.find((line) => line.startsWith("GATE db REFUSED")) ?? "";
    expect(refusal, "the db lane is refused while the demo is up, naming its port").toMatch(new RegExp(`\\b${demo}\\b.*V-DB`));
    expect(ran, "the journeys' lane runs beside a demo — the demo never holds their port (the owner's ruling)").toEqual(["e2e"]);
    expect(code).toBe(1);
  });
});

describe("the stage: the demo's own record, its worker, and a --stop that signals only its own processes", () => {
  test("the demo and the probe keep separate records, on separate ports; both run the worker, and the demo arms no instrument", () => {
    expect(DEMO_STAGE.record).not.toBe(PROBE_STAGE.record);
    expect(DEMO_STAGE.logs.server).not.toBe(PROBE_STAGE.logs.server);
    expect(DEMO_STAGE.name).not.toBe(PROBE_STAGE.name);
    expect(DEMO_STAGE.which).not.toBe(PROBE_STAGE.which);
    expect(PROBE_STAGE.record.replace(/\\/g, "/")).toMatch(/scripts\/probe\/server\.pids$/);
    expect(DEMO_STAGE.record.replace(/\\/g, "/"), "the demo's record lives where git ignores it and no lane cleans it").toMatch(/node_modules\/\.cache\/cubit\/demo\//);
    expect(DEMO_STAGE.worker, "the demo's Measure and Draft-the-bill doors need a worker (the orchestrator's ruling)").toBe(true);
    expect(PROBE_STAGE.worker).toBe(true);
    expect(DEMO_STAGE.logs.worker).not.toBe(PROBE_STAGE.logs.worker);
    const demoEnv = stageEnv(DEMO_STAGE, { NODE_ENV: "production", CUBIT_UI_INSTRUMENT: "1" });
    expect(demoEnv["CUBIT_UI_INSTRUMENT"], "the owner sees what a customer sees").toBeUndefined();
    expect(demoEnv["NODE_ENV"]).toBeUndefined();
    expect(stageEnv(PROBE_STAGE)["CUBIT_UI_INSTRUMENT"]).toBe("1");
    for (const env of [demoEnv, stageEnv(PROBE_STAGE)]) expect(new URL(env["DATABASE_URL"] ?? "").pathname, "both stages serve the journeys' database").toBe("/cubit_e2e");
  });

  test("the store a stage serves is the one the journeys wrote to: STORAGE_ROOT where stated, else the checkout's own", () => {
    expect(stageStorageRoot({})).toBe(join(ROOT, "storage"));
    expect(stageStorageRoot({ STORAGE_ROOT: "/elsewhere/storage" })).toBe("/elsewhere/storage");
    expect(stageEnv(DEMO_STAGE, { STORAGE_ROOT: "/elsewhere/storage" })["STORAGE_ROOT"], "the served product is handed the root the choice was read against").toBe("/elsewhere/storage");
  });

  let scratch: string | null = null;
  afterEach(() => {
    if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
    scratch = null;
  });
  /** The demo's stage with its record in a scratch directory. */
  function scratchStage(): typeof DEMO_STAGE {
    scratch = mkdtempSync(join(tmpdir(), "cubit-demo-stage-"));
    return { ...DEMO_STAGE, record: join(scratch, "stage.json") };
  }

  test("a record another stage wrote is never signalled on, and never deleted", () => {
    const stage = scratchStage();
    writeFileSync(stage.record, JSON.stringify({ stage: "probe", port: 1, startedAt: "", processes: [{ role: "server", pid: 4242 }] }));
    const kill = vi.fn();
    const result = stopStage(stage, { kill, readCommandLine: () => `node ${ROLE_MARKS.server}` });
    expect(result.foreign).toBe("the probe stage");
    expect(kill).not.toHaveBeenCalled();
    expect(existsSync(stage.record)).toBe(true);
    expect(liveStageProcesses(stage, () => `node ${ROLE_MARKS.server}`)).toEqual([]);
  });

  test("the same stage started from another checkout is not this checkout's to stop — a worktree reaches the main node_modules/.cache through a symlink", () => {
    const stage = scratchStage();
    writeFileSync(stage.record, JSON.stringify({ stage: "demo", root: "/home/someone/other-checkout", port: 1, startedAt: "", processes: [{ role: "server", pid: 4343 }] }));
    const kill = vi.fn();
    const result = stopStage(stage, { kill, readCommandLine: () => `node ${ROLE_MARKS.server}` });
    expect(result.foreign).toBe("the demo stage started from /home/someone/other-checkout");
    expect(kill).not.toHaveBeenCalled();
    expect(existsSync(stage.record)).toBe(true);
    expect(liveStageProcesses(stage, () => `node ${ROLE_MARKS.server}`), "a second `pnpm demo` here is refused by the port, never by another checkout's record").toEqual([]);
    writeFileSync(stage.record, JSON.stringify({ stage: "demo", root: ROOT.replace(/\/$/, ""), port: 1, startedAt: "", processes: [{ role: "server", pid: 4343 }] }));
    expect(liveStageProcesses(stage, () => `node ${ROLE_MARKS.server}`).map((entry) => entry.pid), "this checkout's own record is its own").toEqual([4343]);
  });

  test("a recorded pid is signalled — as its process group — only while it still runs the role's script; a recycled pid is left alone", () => {
    const stage = scratchStage();
    writeFileSync(
      stage.record,
      JSON.stringify({ stage: "demo", port: 1, startedAt: "", processes: [{ role: "server", pid: 101 }, { role: "server", pid: 102 }, { role: "server", pid: 103 }] }),
    );
    const lines: Record<number, string | null> = { 101: `node ${ROLE_MARKS.server} --port 1`, 102: "/usr/bin/vim notes.txt", 103: null };
    const kill = vi.fn();
    const result = stopStage(stage, { kill, readCommandLine: (pid) => lines[pid] ?? null });
    expect(kill.mock.calls, "the live stage process's group, and nobody else").toEqual([[-101, "SIGTERM"]]);
    expect(result.stopped).toEqual([101]);
    expect(existsSync(stage.record), "the record goes once its processes are stopped").toBe(false);
  });

  test("the demo stage starts the worker beside the served product, records it, waits for its ready line — and --stop signals it", async () => {
    scratch = mkdtempSync(join(tmpdir(), "cubit-demo-stage-"));
    const stage = { ...DEMO_STAGE, record: join(scratch, "stage.json"), logs: { server: join(scratch, "server.log"), worker: join(scratch, "worker.log") } };
    const spawned: { command: string; args: string[]; detached: boolean | undefined; env: NodeJS.ProcessEnv | undefined }[] = [];
    let nextPid = 7100;
    const spawn = (command: string, args: string[], options: { detached?: boolean; env?: NodeJS.ProcessEnv }) => {
      spawned.push({ command, args, detached: options.detached, env: options.env });
      nextPid += 1;
      return { pid: nextPid, on: () => undefined, unref: () => undefined };
    };
    const askedWorkerLog: string[] = [];
    const served = await startStage(stage, {
      spawn,
      answers: async () => true,
      workerSaysReady: async (log) => {
        askedWorkerLog.push(log);
        return true;
      },
    });

    expect(spawned.map((entry) => entry.args.find((arg) => arg === ROLE_MARKS.server || arg === ROLE_MARKS.worker)), "the served product, then the worker").toEqual([ROLE_MARKS.server, ROLE_MARKS.worker]);
    expect(spawned.every((entry) => entry.detached === true), "each is its own process group, so --stop can signal the group").toBe(true);
    expect(spawned[1]?.args).toEqual(["--import", "tsx", ROLE_MARKS.worker]);
    expect(new URL(spawned[1]?.env?.["DATABASE_URL"] ?? "").pathname, "the worker drains the database the product serves").toBe("/cubit_e2e");
    expect(askedWorkerLog, "readiness is read off the worker's own log").toEqual([stage.logs.worker]);
    expect(served.workerReady).toBe(true);
    expect(served.processes).toEqual([
      { role: "server", pid: 7101 },
      { role: "worker", pid: 7102 },
    ]);
    expect(readStageRecord(stage.record)?.processes, "the record names the worker, so --stop can find it").toEqual(served.processes);

    const running: Record<number, string> = { 7101: `node ${ROLE_MARKS.server} --port 1`, 7102: `node --import tsx ${ROLE_MARKS.worker}` };
    const kill = vi.fn();
    const stopped = stopStage(stage, { kill, readCommandLine: (pid) => running[pid] ?? null });
    expect(kill.mock.calls, "--stop signals the server's group and the worker's group").toEqual([
      [-7101, "SIGTERM"],
      [-7102, "SIGTERM"],
    ]);
    expect(stopped.stopped).toEqual([7101, 7102]);
  });

  test("the probe's pre-stage record (a bare array of pids) is still read, and still checked against the scripts before a signal", () => {
    const stage = { ...scratchStage(), name: "probe" };
    writeFileSync(stage.record, JSON.stringify([201, 202]));
    expect(readStageRecord(stage.record)?.processes.map((entry) => entry.role)).toEqual(["unknown", "unknown"]);
    const live = liveStageProcesses(stage, (pid) => (pid === 201 ? `node --import tsx ${ROLE_MARKS.worker}` : "bash"));
    expect(live.map((entry) => entry.pid)).toEqual([201]);
  });
});

describe("the choice: the newest measured M3 project, preferring one that is billed", () => {
  const older = "2026-09-22T20:20:27+06:00";
  const newer = "2026-09-23T04:19:31+06:00";
  const newest = "2026-09-23T04:29:59+06:00";

  test("a billed project (a live issued bill AND bar rows) is preferred over a newer project that is only measured", () => {
    const billed = row({ project_id: "b0000000-0000-4000-8000-000000000001", created_at: older, live_bills: 1, bar_rows: 182, stamp: "billed1" });
    const measured = row({ project_id: "a0000000-0000-4000-8000-000000000001", created_at: newer, stamp: "measured1" });
    const unmeasured = row({ project_id: "c0000000-0000-4000-8000-000000000001", created_at: newest, column_lines: 0, stamp: "fresh1" });
    const { choice, tally } = chooseProject([measured, unmeasured, billed]);
    expect(choice?.tier).toBe("billed");
    expect(choice?.row.project_id).toBe(billed.project_id);
    expect(choice?.account).toEqual({ userId: USER, email: "j000-legs-billed1@cubit.test", password: "golden-path-legs-billed1" });
    expect(tally).toEqual({ projects: 3, measured: 2, billed: 1, noAccount: 0, elsewhere: 0 });
  });

  test("with nothing billed, the newest measured project — and a bill without bar rows (or bar rows without a bill) is not billed", () => {
    const billOnly = row({ project_id: "a0000000-0000-4000-8000-000000000002", created_at: older, live_bills: 1, bar_rows: 0 });
    const barsOnly = row({ project_id: "a0000000-0000-4000-8000-000000000003", created_at: older, live_bills: 0, bar_rows: 182 });
    const newestMeasured = row({ project_id: "a0000000-0000-4000-8000-000000000004", created_at: newer });
    const { choice } = chooseProject([billOnly, barsOnly, newestMeasured]);
    expect(choice?.tier).toBe("measured");
    expect(choice?.row.project_id).toBe(newestMeasured.project_id);
  });

  test("two projects made in one instant still choose one way: the greater id", () => {
    const a = row({ project_id: "a0000000-0000-4000-8000-000000000005", created_at: newer });
    const b = row({ project_id: "b0000000-0000-4000-8000-000000000005", created_at: newer });
    expect(chooseProject([a, b]).choice?.row.project_id).toBe(b.project_id);
    expect(chooseProject([b, a]).choice?.row.project_id).toBe(b.project_id);
  });

  test("a project not made by J-000's legs, or whose drawings are in another checkout's store, is passed over and counted", () => {
    const stranger = row({ project_id: "a0000000-0000-4000-8000-000000000006", created_at: newest, members: [{ user_id: USER, key: foldedKey("owner@example.com", true) }] });
    const elsewhere = row({ tenant_id: "44444444-4444-4444-8444-444444444444", project_id: "a0000000-0000-4000-8000-000000000007", created_at: newer });
    const here = row({ project_id: "a0000000-0000-4000-8000-000000000008", created_at: older });
    const { choice, tally } = chooseProject([stranger, elsewhere, here], { stored: (tenantId) => tenantId === TENANT });
    expect(choice?.row.project_id).toBe(here.project_id);
    expect(tally).toMatchObject({ measured: 3, noAccount: 1, elsewhere: 1 });
    const none = chooseProject([stranger, elsewhere], { stored: (tenantId) => tenantId === TENANT });
    expect(none.choice).toBeNull();
    expect(REFUSE.noProject(none.tally)).toMatch(/1 not made by J-000's legs account; 1 keeping their drawings in another checkout's store/);
  });

  test("nothing measured is a refusal that names the command that makes a measured project", () => {
    const { choice, tally } = chooseProject([row({ column_lines: 0 })]);
    expect(choice).toBeNull();
    expect(REFUSE.noProject(tally)).toMatch(/^REFUSE demo — no measured "Bashundhara G\+6" project .*`pnpm e2e --journeys J-000`/);
  });
});

describe("the account: J-000's legs address, read through the product's fold, and a password PROVED against a hash", () => {
  test("the derivation is the one golden-run.ts signs up with — the address, the password, the stamp's alphabet and the project's name", () => {
    const run = read("tests/e2e/journeys/j-000/golden-run.ts");
    expect(run).toContain("const email = `j000-legs-${stamp}@cubit.test`;");
    expect(run).toContain("const password = `golden-path-legs-${stamp}`;");
    expect(run, "the stamp is base 36 — the alphabet the demo's address pattern captures").toMatch(/const stamp = `\$\{Date\.now\(\)\.toString\(36\)\}\$\{Math\.floor\(Math\.random\(\) \* 1e6\)\.toString\(36\)\}`;/);
    expect(run).toContain(`export const BNBC_PROJECT_NAME = ${JSON.stringify(M3_PROJECT_NAME)};`);
    expect(legsPassword("mud8l396l8lf")).toBe("golden-path-legs-mud8l396l8lf");
  });

  test("the stored key is unfolded by the product's own presentedValue; a digest-folded key or another address is no legs account", () => {
    expect(legsAccount([{ user_id: USER, key: foldedKey("j000-legs-abc123@cubit.test", true) }])).toEqual({
      userId: USER,
      email: "j000-legs-abc123@cubit.test",
      password: "golden-path-legs-abc123",
    });
    expect(legsAccount([{ user_id: USER, key: foldedKey("j000-legs-abc123@cubit.test", false) }])).toBeNull();
    expect(legsAccount([{ user_id: USER, key: foldedKey("j000-abc123@cubit.test", true) }])).toBeNull();
    expect(legsAccount([{ user_id: USER, key: "j000-legs-abc123@cubit.test" }]), "an unfolded key is not what the store holds").toBeNull();
  });

  test("the derived password verifies against a hash the product made for it, and a neighbour's does not", async () => {
    const account = legsAccount([{ user_id: USER, key: foldedKey("j000-legs-abc123@cubit.test", true) }]);
    const stored = await hashPassword("golden-path-legs-abc123");
    expect(await verifyPassword(account?.password ?? "", stored)).toBe(true);
    expect(await verifyPassword(legsPassword("abc124"), stored)).toBe(false);
  });
});

describe("the reads: read-only, reasoned first, scoped, and of the product's own vocabulary", () => {
  test("the candidates query opens a read-only transaction, names its system reason before it reads, and is scoped by the project's name", () => {
    const sql = candidatesSql();
    const lines = sql.split("\n");
    expect(lines[0]).toBe("begin read only;");
    expect(lines[1]).toBe(`set local cubit.system_reason = '${SYSTEM_REASON}';`);
    expect(lines.at(-1)).toBe("commit;");
    expect(sql).toContain(`p.name = '${M3_PROJECT_NAME}'`);
    expect(sql, "no hash is read to choose").not.toMatch(/password_hash/);
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|drop|alter)\b/i);
  });

  test("the hash is read for exactly one member of one workspace, and only for ids the store writes", () => {
    const sql = hashSql(TENANT, USER);
    expect(sql.split("\n")[0]).toBe("begin read only;");
    expect(sql).toContain(`m.tenant_id = '${TENANT}' and m.user_id = '${USER}'`);
    expect(() => hashSql("x' or '1'='1", USER)).toThrow(/not an id the store writes/);
  });

  test("what 'measured' and 'billed' are read as are the product's own names", () => {
    expect(ELEMENT_TYPES).toContain(MEASURED.class);
    expect(KINDS).toContain(MEASURED.kind);
    expect(COVERAGES).toContain(MEASURED.coverage);
    expect(BILL_KIND).toBe(BOQ_DRAFT);
  });

  test("psql's transcript is read for its one JSON line", () => {
    expect(jsonOf('BEGIN\nSET\n[{"project_id": "p", "members": []}]\nCOMMIT\n')).toEqual([{ project_id: "p", members: [] }]);
    expect(jsonOf("BEGIN\nSET\nCOMMIT\n")).toBeNull();
  });
});

describe("what the owner is shown", () => {
  test("the URL is the project's takeoff register at the demo's origin, and the app has that route", () => {
    for (const name of NAMES) delete process.env[name];
    const url = registerUrl(originFor("demo"), TENANT, PROJECT);
    expect(url).toBe(`http://127.0.0.1:${PORTS.demo}/t/${TENANT}/p/${PROJECT}/takeoff/register`);
    const route = new URL(url).pathname.replace(TENANT, "[tenant]").replace(PROJECT, "[project]");
    expect(existsSync(join(ROOT, "src", "app", "(app)", route, "page.tsx")), `no page at ${route}`).toBe(true);
  });

  test("ONE block carries the URL, the sign-in and the stop command — the password exactly once", () => {
    for (const name of NAMES) delete process.env[name];
    const choice = chooseProject([row({ live_bills: 1, bar_rows: 182 })]).choice;
    expect(choice).not.toBeNull();
    if (choice === null) return;
    const url = registerUrl(originFor("demo"), TENANT, PROJECT);
    const block = demoBlock({ origin: originFor("demo"), url, choice, opened: "opened in your Windows browser" });
    expect(block).toContain(url);
    expect(block).toContain("j000-legs-mud8l396l8lf@cubit.test");
    expect(block.split("golden-path-legs-mud8l396l8lf").length - 1, "the password is printed once").toBe(1);
    expect(block).toContain("pnpm demo --stop");
    expect(block, "the block says the worker stands and what that forbids").toMatch(/Worker {4}ready — it takes jobs from every tenant in cubit_e2e: run no journey while the demo stands/);
    expect(block).toMatch(/measured and billed/);
    expect(block).not.toMatch(/localhost/);
  });

  test("the browser opens through cmd.exe `start \"\" <url>` from a Windows directory — and where there is no cmd.exe it says so", () => {
    const url = registerUrl(originFor("demo"), TENANT, PROJECT);
    const run = vi.fn(() => ({ status: 0, error: undefined }));
    expect(openInWindows(url, { exists: () => true, run: run as never })).toEqual({ opened: true, why: "opened in your Windows browser" });
    expect(run).toHaveBeenCalledWith(WINDOWS_CMD, ["/c", "start", "", url], expect.objectContaining({ cwd: "/mnt/c" }));
    const absent = openInWindows(url, { exists: () => false, run: run as never });
    expect(absent.opened).toBe(false);
    expect(absent.why).toContain(`${WINDOWS_CMD} is absent`);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("the refusals name what was found and what to do", () => {
    expect(REFUSE.portHeld(PORTS.demo, "a Linux listener")).toMatch(new RegExp(`^REFUSE demo — port ${PORTS.demo} is held \\(a Linux listener\\).*pnpm demo --stop.*DEMO_PORT`));
    expect(REFUSE.alreadyServing([7, 8])).toMatch(/^REFUSE demo — .*pid 7, 8.*pnpm demo --stop/);
    expect(REFUSE.buildHeld(".next-cubit", [{ pid: 9, port: PORTS.e2e }])).toMatch(new RegExp(`^REFUSE demo — \\.next-cubit is being served by a live server \\(pid 9 on port ${PORTS.e2e}\\).*rebuild`));
    expect(REFUSE.unproved("j000-legs-x@cubit.test")).toMatch(/^REFUSE demo — .*j000-legs-x@cubit\.test.*Nothing was served\./);
    expect(REFUSE.noDatabase("connection refused")).toMatch(/^REFUSE demo — cubit_e2e could not be read \(connection refused\)/);
    expect(REFUSE.notReady("http://127.0.0.1:1", "/x/server.log", true), "a build that failed is said at once, not after the whole budget").toMatch(/exited before it answered.*\/x\/server\.log/);
    expect(REFUSE.notReady("http://127.0.0.1:1", "/x/server.log", false)).toMatch(/did not answer .* within \d+s/);
    expect(REFUSE.journeyRunning(PORTS.e2e, "a Linux listener")).toMatch(new RegExp(`^REFUSE demo — the journeys' port ${PORTS.e2e} is held.*worker takes jobs from every tenant in cubit_e2e`));
    expect(REFUSE.workerNotReady("/x/worker.log")).toMatch(/^FAIL demo — the worker never said "worker: ready".*\/x\/worker\.log/);
  });
});

describe("the runbook and the command surface", () => {
  test("package.json runs the demo under tsx (it reads the product's own fold and verifier)", () => {
    const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;
    expect(scripts["demo"]).toBe("node --import tsx scripts/demo.mjs");
  });

  test("docs/demo.md names the command, the stop, the prerequisite and the networking check — and the port ports.mjs names", () => {
    const doc = read("docs/demo.md");
    for (const phrase of ["pnpm demo", "pnpm demo --stop", "pnpm demo --no-open", "pnpm e2e --journeys J-000", "netsh interface portproxy show all", "127.0.0.1"]) {
      expect(doc, `docs/demo.md does not say ${phrase}`).toContain(phrase);
    }
    const ports = [...doc.matchAll(new RegExp(SERVED_PORT.source, "g"))].map((match) => Number(match[0]));
    expect(new Set(ports), "the runbook states a port other than the demo's").toEqual(new Set([PORTS.demo]));
    expect(doc).not.toMatch(/localhost:/);
  });
});

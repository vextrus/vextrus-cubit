// @vitest-environment node
/**
 * AC-2 of the src/core debt sweep: the seam's lock hand-back, its queue open, its pools and its
 * scope predicate (SEAM-JOBS, SEAM-TENANT, R-SPINE-030, R-SPINE-031, ARCH-03, B-21).
 *
 * (a) is a property of the file's TEXT: "parks no transaction body" is a body that never exits, and
 * a body that never exits has no runtime observable to assert on. The BEHAVIOUR of the redesigned
 * hand-back — the guarded failure rethrown as the same object, exactly one record on `jobs/lock`,
 * and a `close()` that then resolves — is already pinned by the merged
 * src/core/jobs/__tests__/jobs-edges.acceptance.test.ts AC-6, which terminates every other backend
 * inside the work; re-deriving it here would exercise one code path twice under two labels (Q-17,
 * ARCH-02), so this file scans the text and leaves the behaviour to the acceptance that owns it.
 *
 * (b) substitutes the `pg-boss` module rather than failing a live start: a live failed start fights
 * postgres.js's own timers, and what is being judged is which calls the seam makes on the instance
 * and in which order.
 *
 * (c) drives a real socket that accepts and never answers, so the outstanding query cannot settle
 * on its own — the only thing that can end the pool is the timeout the seam passes.
 *
 * (d) is live: the predicate is SQL, and SQL that no server has ever parsed is SQL nobody has
 * judged. The harness reads DATABASE_URL at module load for its bootstrap connection, so it is
 * imported before this process is repointed.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type AddressInfo, type Server, type Socket } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../db/__tests__/harness";
import { closePools, forTenant, inCurrentScope, jobsStore, projects, runAsSystem, tenants, type QueueShape, type TenantDb } from "./db";
import { setFaultSink, type FaultRecord, type FaultSink } from "./faults/report";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const SEAM_MODULE = "src/core/db.ts";
const QUEUE_ROUTE = "jobs/queue";

/** What the substituted library says when its `start()` refuses, and when its `stop()` refuses too. */
const STARTUP_REFUSED = "the queue library would not start";
const STOP_REFUSED = "stopping an instance whose start failed";

/** The bound AC-2(c) reads `closePools()` against: `{ timeout: 5 }` settles in five seconds. */
const CLOSE_BUDGET_MS = 10_000;

/** The sentinel a promise that resolved is reported as, so a case can say "expected a rejection". */
const RESOLVED: unique symbol = Symbol("resolved");

/** The value a promise rejected with, or RESOLVED — no catch clause, so ARCH-03's lint has nothing to read. */
const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => RESOLVED,
    (reason: unknown) => reason,
  );

/**
 * What the substituted `pg-boss` did, in the order it happened. The fault sink writes into the same
 * list, so "stopped before the fault was recorded" is one comparison rather than two clocks.
 */
const boss = vi.hoisted(() => ({
  timeline: [] as string[],
  started: [] as object[],
  stopped: [] as object[],
}));

vi.mock("pg-boss", () => {
  class FakeBoss {
    /** The plan string the seam reads its version out of; 24 is what db/migrations/0018 installs. */
    static getConstructionPlans(): string {
      return "insert into version (version) values ('24');";
    }
    on(): this {
      return this;
    }
    getDb(): { close: () => Promise<void> } {
      return {
        close: async (): Promise<void> => {
          boss.timeline.push("db-close");
        },
      };
    }
    async start(): Promise<never> {
      boss.timeline.push("start");
      boss.started.push(this);
      throw new Error(STARTUP_REFUSED);
    }
    async stop(): Promise<never> {
      boss.timeline.push("stop");
      boss.stopped.push(this);
      throw new Error(STOP_REFUSED);
    }
  }
  return { default: FakeBoss };
});

const SHAPE: QueueShape = { concurrency: 1, retryLimit: 0, retryDelaySeconds: 1, retryBackoff: false, expireSeconds: 60 };

const faults: FaultRecord[] = [];
let previousSink: FaultSink | undefined;

beforeAll(() => {
  previousSink = setFaultSink((record) => {
    faults.push(record);
    boss.timeline.push(`fault:${record.route}`);
  });
});

afterAll(() => {
  if (previousSink !== undefined) setFaultSink(previousSink);
});

describe("AC-2: the lock's hand-back, the queue's open and the pools", () => {
  test("AC-2(a): the lock transaction holds nothing but the advisory lock — no hand rollback, no parked body", () => {
    // white-box: AC-2(a) — the criterion is itself a source scan ("finds neither `unsafe(\"rollback\")`
    // nor `setImmediate`"): a body that never exits has no runtime observable to assert on. The
    // BEHAVIOUR of the redesigned hand-back is pinned by the merged
    // src/core/jobs/__tests__/jobs-edges.acceptance.test.ts AC-6, which terminates every other
    // backend inside the guarded work — re-deriving it here would be ARCH-02's duplication.
    const absolute = join(REPO_ROOT, SEAM_MODULE);
    expect(existsSync(absolute), `${SEAM_MODULE} is missing from the checkout — the product does not provide SEAM-JOBS yet`).toBe(true);
    const source = readFileSync(absolute, "utf8");
    // Matched as issued STATEMENTS, never as bare words: a comment explaining why neither construct
    // is here any more must not be graded as the construct itself.
    expect(source, `${SEAM_MODULE} still issues a hand ROLLBACK on the lock's connection — the driver's COMMIT is the hand-back (SEAM-JOBS)`).not.toMatch(
      /\.unsafe\(\s*["'`]\s*rollback/i,
    );
    expect(source, `${SEAM_MODULE} still parks its transaction body across a setImmediate gap — nothing may outlive the lock transaction (ARCH-03)`).not.toMatch(
      /\bsetImmediate\s*\(/,
    );
  });

  test("AC-2(b): a start that rejects is stopped on that same instance, its own rejection swallowed, before the fault is recorded", async () => {
    boss.timeline.length = 0;
    boss.started.length = 0;
    boss.stopped.length = 0;
    const before = faults.length;

    // A store that manages nothing reaches the queue on its first declaration: no database is
    // touched on the way, so what is judged here is only what the seam does with the instance.
    const store = jobsStore(`postgres://cubit_app:cubit_app@127.0.0.1:1/queue-open-${randomUUID()}`);
    const rejection = await rejectionOf(store.declareQueue("probe", SHAPE));

    expect(rejection, "a queue that would not start is a failure the caller hears").not.toBe(RESOLVED);
    expect((rejection as Error).message, "…as this seam's own fault, naming the record").toContain("recorded as fault");
    expect(((rejection as Error).cause as Error | undefined)?.message, "…caused by the start's refusal, never by the stop's").toBe(STARTUP_REFUSED);

    expect(boss.started.length, "the substituted library's start was reached exactly once").toBe(1);
    expect(boss.stopped.length, "a start that rejected is stopped exactly once — no supervisor interval outlives a failed open (R-SPINE-031)").toBe(1);
    expect(boss.stopped[0], "…and stopped on the very instance whose start rejected, not on a fresh one").toBe(boss.started[0]);

    const queueFaults = faults.slice(before).filter((record) => record.route === QUEUE_ROUTE);
    expect(queueFaults.length, `the failed open is recorded exactly once on ${QUEUE_ROUTE} (ARCH-03, B-21)`).toBe(1);
    expect(boss.timeline.indexOf("stop"), "the instance is stopped BEFORE the fault is recorded — the fault is the last word about a closed instance").toBeLessThan(
      boss.timeline.indexOf(`fault:${QUEUE_ROUTE}`),
    );

    await store.close();
  });

  test("AC-2(c): closePools resolves while a query is still outstanding against a server that never answers", async () => {
    const held: Socket[] = [];
    // A socket the server accepts and never writes to: the driver's startup exchange cannot
    // complete, so nothing but the pool's own timeout can end it.
    const blackHole: Server = createServer((socket) => {
      held.push(socket);
    });
    await new Promise<void>((listening) => blackHole.listen(0, "127.0.0.1", listening));
    const { port } = blackHole.address() as AddressInfo;

    const previousUrl = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = `postgres://cubit_app:cubit_app@127.0.0.1:${port}/never-answers`;
    try {
      const outstanding = rejectionOf(forTenant({ tenantId: randomUUID() }).select().from(projects).limit(1));
      // Long enough for the driver to have taken a connection out and sent its startup packet.
      await new Promise((settled) => setTimeout(settled, 500));

      const verdict = await Promise.race([
        closePools().then(() => "closed" as const),
        new Promise<"still holding">((expired) => setTimeout(() => expired("still holding"), CLOSE_BUDGET_MS)),
      ]);
      expect(verdict, `closePools ends every pool with a timeout, so an outstanding query cannot hold the process open past ${CLOSE_BUDGET_MS}ms`).toBe("closed");
      await outstanding;
    } finally {
      process.env["DATABASE_URL"] = previousUrl;
      for (const socket of held) socket.destroy();
      await new Promise<void>((closed) => blackHole.close(() => closed()));
      await closePools();
    }
  }, 60_000);
});

describe("AC-2(d): inCurrentScope, executed against a server", () => {
  let scratch: ScratchDb | undefined;
  let alpha = "";
  let beta = "";
  const REASON = "test: read every workspace's projects to judge the seam's own scope predicate";

  beforeAll(async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    process.env["DATABASE_URL"] = provisioned.urlApp;
    const system = runAsSystem("test: stage two workspaces, each holding a project");
    const [first, second] = await system
      .insert(tenants)
      .values([{ name: `scope-alpha-${randomUUID()}` }, { name: `scope-beta-${randomUUID()}` }])
      .returning({ tenantId: tenants.tenantId });
    alpha = first?.tenantId ?? "";
    beta = second?.tenantId ?? "";
    expect(alpha, "the scenario staged a first workspace").not.toBe("");
    expect(beta, "the scenario staged a second workspace").not.toBe("");
    for (const tenantId of [alpha, beta]) {
      await forTenant({ tenantId })
        .insert(projects)
        .values({ tenantId, name: `project of ${tenantId}` });
    }
  }, 120_000);

  afterAll(async () => {
    await closePools();
    await new Promise((settled) => setTimeout(settled, 500));
    await scratch?.drop();
  }, 120_000);

  test("AC-2(d): a tenant handle's read narrows to that tenant, and the same read under runAsSystem answers both", async () => {
    const scopedRead = async (db: TenantDb): Promise<string[]> => {
      const rows = await db.select({ tenantId: projects.tenantId }).from(projects).where(inCurrentScope(projects.tenantId));
      return [...new Set(rows.map((row) => row.tenantId))].sort();
    };

    const everyTenant = await scopedRead(runAsSystem(REASON));
    expect(everyTenant, "the predicate under a system handle narrows to the row's own tenant, so both staged workspaces answer (SEAM-TENANT)").toEqual([alpha, beta].sort());

    for (const tenantId of [alpha, beta]) {
      expect(await scopedRead(forTenant({ tenantId })), `a read under ${tenantId}'s handle carrying inCurrentScope answers that workspace's rows and no other`).toEqual([tenantId]);
    }
  }, 120_000);
});

// @vitest-environment node
/**
 * Public acceptance for AC-6 of the model seam (L-AI-01, R-AI-005): the shipped ledger adapter
 * writes the real `model_calls` table through the db seam, inc-113a's per-project read answers
 * what was written, the production entry point is wired, and the fixture format is documented.
 *
 * A scratch database from the db lane's own harness. The harness reads DATABASE_URL at module
 * load for its bootstrap connection, so it is imported first and the env is repointed at the
 * scratch app URL only inside staging, before the first `forTenant` query (the seam pools per URL
 * at connection time). `closePools()` runs before `drop()` — the scratch drop races the pool.
 * Staged lazily so a staging failure fails cases rather than skipping them.
 *
 * The production entry is driven for real: CUBIT_MODEL_FIXTURE_ROOT is pointed at a mkdtemp root
 * in the process env before the barrel is first imported (a seam that probes the env at
 * construction and one that probes per call are both bound), the barrel's default `callModel` is
 * called with the seeded tenant, and the scratch database is read back through
 * `modelSpendByProject` — proving the default entry probes the process env and writes through
 * `dbModelLedger` for `ctx.tenantId`, for a fixture hit and for a missing fixture alike. The env
 * var is restored afterwards.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { TENANT_ALPHA } from "../../../../db/__tests__/support/fixtures";
import { seedTenants } from "../../../../db/__tests__/support/live-sql";
import { closePools, forTenant, isUuid, modelSpendByProject } from "../../db";
import { refusalCodeOf } from "../../faults/refusal-marker";
import { modelCallCost } from "../../model-ledger.types";
import { BARREL, REPO_ROOT, RESOLVED, barrel, member, rejectionOf, type Fixture, type Ledger, type LedgerRow, type Request } from "./support/seam";

const SONNET = "claude-sonnet-5";
const FIXTURE_MISSING = "FIXTURE_MISSING";
const ENV_ROOT = "CUBIT_MODEL_FIXTURE_ROOT";
const README = "fixtures/model/README.md";
const FIXTURE_FIELDS = ["requestHash", "modelId", "payload", "inputTokens", "outputTokens"];

type Stage = { tenantId: string; projectId: string; ledger: Ledger; fixtureRoot: string };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;
let previousRoot: string | undefined;
let mintedRoot: string | undefined;

const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantId = seedTenants(provisioned.urlMigrate)[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    process.env["DATABASE_URL"] = provisioned.urlApp;
    // The fixture root goes into the process env before the barrel is first imported.
    previousRoot = process.env[ENV_ROOT];
    mintedRoot = mkdtempSync(join(tmpdir(), "cubit-model-production-entry-"));
    process.env[ENV_ROOT] = mintedRoot;
    const dbModelLedger = await member("dbModelLedger");
    const ledger = dbModelLedger(forTenant({ tenantId }));
    expect(typeof ledger.record, "dbModelLedger(db) answers a ModelLedger with record(row)").toBe("function");
    return { tenantId, projectId: randomUUID(), ledger, fixtureRoot: mintedRoot };
  })());

afterAll(async () => {
  if (previousRoot === undefined) delete process.env[ENV_ROOT];
  else process.env[ENV_ROOT] = previousRoot;
  if (mintedRoot !== undefined) rmSync(mintedRoot, { recursive: true, force: true });
  await closePools();
  await scratch?.drop();
});

/** The spend entries `modelSpendByProject` answers for one project of the tenant. */
async function spendOf(tenantId: string, projectId: string) {
  const spend = await modelSpendByProject(forTenant({ tenantId }));
  return spend.filter((entry) => entry.projectId === projectId);
}

describe("AC-6: the shipped ledger adapter writes the real table", () => {
  test("AC-6: a proposed row and a refused row both land, and modelSpendByProject adds them up", async () => {
    const { tenantId, projectId, ledger } = await staged();
    const proposed: LedgerRow = {
      tenantId,
      projectId,
      modelId: SONNET,
      requestHash: "a".repeat(64),
      transport: "fixture",
      outcome: "proposed",
      refusalCode: null,
      inputTokens: 1000,
      outputTokens: 2000,
      attributedCost: modelCallCost(SONNET, 1000, 2000),
    };
    const first = await ledger.record(proposed);
    expect(typeof first.callId, "record answers the generated callId").toBe("string");
    expect(isUuid(first.callId), `callId ${first.callId} is a uuid`).toBe(true);

    const refused: LedgerRow = {
      tenantId,
      projectId,
      modelId: SONNET,
      requestHash: "b".repeat(64),
      transport: "fixture",
      outcome: "refused",
      refusalCode: FIXTURE_MISSING,
      inputTokens: 0,
      outputTokens: 0,
      attributedCost: "0",
    };
    const second = await ledger.record(refused);
    expect(isUuid(second.callId), "the refused row's callId is a uuid too").toBe(true);
    expect(second.callId, "two rows, two ids").not.toBe(first.callId);

    const spend = await modelSpendByProject(forTenant({ tenantId }));
    const entries = spend.filter((entry) => entry.projectId === projectId);
    expect(entries.length, "one entry for the project the rows named").toBe(1);
    expect(entries[0], "calls 2, proposed 1, refused 1, tokens 1000/2000, the sonnet cost").toEqual({
      projectId,
      calls: 2,
      proposed: 1,
      refused: 1,
      inputTokens: 1000,
      outputTokens: 2000,
      attributedCost: modelCallCost(SONNET, 1000, 2000),
    });
  });

  test("AC-6: the barrel's production callModel takes (ctx, request)", async () => {
    const loaded = await barrel();
    expect(typeof loaded.callModel, `${BARREL} exports no callModel`).toBe("function");
    expect(loaded.callModel?.length, "callModel is a function of two parameters: ctx and request").toBe(2);
  });

  test("AC-6: the barrel's default callModel probes the process env and writes through dbModelLedger for ctx.tenantId — a fixture hit lands as proposed, the deleted fixture as FIXTURE_MISSING refused, both in the project's spend", async () => {
    const { tenantId, fixtureRoot } = await staged();
    const callModel = await member("callModel");
    const requestHash = await member("requestHash");

    const projectId = randomUUID();
    const ctx = { tenantId, projectId, actor: `user:${randomUUID()}`, requestId: randomUUID() };
    const request: Request = {
      modelId: SONNET,
      system: "You classify a bill line.",
      messages: [{ role: "user", content: "RCC M25 in footing — which trade?" }],
      params: { max_tokens: 32, temperature: 0 },
    };
    const hash = requestHash(request);
    const fixture: Fixture = { requestHash: hash, modelId: SONNET, payload: [{ type: "text", text: "Concrete." }], inputTokens: 300, outputTokens: 40 };
    const file = join(fixtureRoot, `${hash}.json`);
    writeFileSync(file, JSON.stringify(fixture));
    expect(await spendOf(tenantId, projectId), "a fresh project has no spend before the call").toEqual([]);

    // The hit: answered from the fixture the process env points at, recorded in the real table.
    const answer = await callModel(ctx, request);
    expect(answer, "the default entry answered from the fixture root named in process.env").toMatchObject({
      transport: "fixture",
      outcome: "proposed",
      modelId: SONNET,
      requestHash: hash,
      inputTokens: fixture.inputTokens,
      outputTokens: fixture.outputTokens,
      attributedCost: modelCallCost(SONNET, fixture.inputTokens, fixture.outputTokens),
    });
    expect(answer.payload, "payload is the fixture's payload").toEqual(fixture.payload);
    expect(isUuid(answer.callId), `callId ${answer.callId} is the uuid the real table generated`).toBe(true);
    expect(await spendOf(tenantId, projectId), "the hit is one proposed row for ctx's tenant and project, with the fixture's tokens and cost").toEqual([
      {
        projectId,
        calls: 1,
        proposed: 1,
        refused: 0,
        inputTokens: fixture.inputTokens,
        outputTokens: fixture.outputTokens,
        attributedCost: modelCallCost(SONNET, fixture.inputTokens, fixture.outputTokens),
      },
    ]);

    // The miss: the same request with its fixture deleted refuses, and the refusal is a row too.
    rmSync(file);
    const rejection = await rejectionOf(callModel(ctx, request));
    expect(rejection, "without the fixture the default entry must reject, never reach the network").not.toBe(RESOLVED);
    expect(refusalCodeOf(rejection), "the missing fixture is FIXTURE_MISSING").toBe(FIXTURE_MISSING);
    expect((rejection as Error).message, "the refusal's detail names the request hash").toContain(hash);
    expect(await spendOf(tenantId, projectId), "the miss is a refused row: calls 2, refused 1, tokens and cost unchanged").toEqual([
      {
        projectId,
        calls: 2,
        proposed: 1,
        refused: 1,
        inputTokens: fixture.inputTokens,
        outputTokens: fixture.outputTokens,
        attributedCost: modelCallCost(SONNET, fixture.inputTokens, fixture.outputTokens),
      },
    ]);
  });

  test("AC-6: fixtures/model/README.md states the <requestHash>.json naming and the ModelFixture fields", () => {
    const file = join(REPO_ROOT, README);
    expect(existsSync(file), `${README} is missing — the fixture format every later F-MODEL fixture is recorded in must be stated`).toBe(true);
    const text = readFileSync(file, "utf8");
    expect(text, "the README names the <requestHash>.json file naming").toMatch(/requestHash[^\n]{0,4}\.json/);
    for (const field of FIXTURE_FIELDS) {
      expect(text.includes(field), `the README lists the ModelFixture field ${field}`).toBe(true);
    }
  });
});

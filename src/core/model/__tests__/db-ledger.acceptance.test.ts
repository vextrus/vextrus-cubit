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
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { TENANT_ALPHA } from "../../../../db/__tests__/support/fixtures";
import { seedTenants } from "../../../../db/__tests__/support/live-sql";
import { closePools, forTenant, isUuid, modelSpendByProject } from "../../db";
import { modelCallCost } from "../../model-ledger.types";
import { BARREL, REPO_ROOT, barrel, member, type Ledger, type LedgerRow } from "./support/seam";

const SONNET = "claude-sonnet-5";
const FIXTURE_MISSING = "FIXTURE_MISSING";
const README = "fixtures/model/README.md";
const FIXTURE_FIELDS = ["requestHash", "modelId", "payload", "inputTokens", "outputTokens"];

type Stage = { tenantId: string; projectId: string; ledger: Ledger };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantId = seedTenants(provisioned.urlMigrate)[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    process.env["DATABASE_URL"] = provisioned.urlApp;
    const dbModelLedger = await member("dbModelLedger");
    const ledger = dbModelLedger(forTenant({ tenantId }));
    expect(typeof ledger.record, "dbModelLedger(db) answers a ModelLedger with record(row)").toBe("function");
    return { tenantId, projectId: randomUUID(), ledger };
  })());

afterAll(async () => {
  await closePools();
  await scratch?.drop();
});

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

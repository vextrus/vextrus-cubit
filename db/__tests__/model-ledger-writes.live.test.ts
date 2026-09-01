// The write half of the ledger's governance, live (SEAM-TENANT, V-DB): a scoped read proves the
// USING clause of each policy; only a write proves its WITH CHECK. So each ledger table is driven as
// the app role with one tenant's scope armed, offered a row belonging to the other tenant, and must
// refuse it — with an own-tenant control beside it, because a refusal that is really "this insert
// could never have worked" proves nothing about the policy.
//
// Beside the policies, the column-level judgements the ledger's money and token counts carry: the
// table is reachable by writers other than the seam's own derivation, and a cost that is not a
// number — postgres' numeric admits 'NaN' and the infinities — would spread through the sum every
// per-project spend read makes.
//
// Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
// rest of the tree.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb } from "./harness";
import { GUC_TENANT, ROLE_APP, TENANT_ALPHA, TENANT_BETA, TENANT_COLUMN } from "./support/fixtures";
import { ident, lit, psql, seedTenants, withSession } from "./support/live-sql";

const MODEL_CALLS = "model_calls";
const MODEL_FIXTURES = "model_fixtures";

/** The model id the probe rows name — any id will do; the ledger stores it as text. */
const PROBE_MODEL = "claude-sonnet-5";

/** A row-level security refusal: "new row violates row-level security policy" (42501). */
const RLS_REFUSAL = "42501";

/** A CHECK violation, and the unique-violation the fixtures' composite key answers with. */
const CHECK_REFUSAL = "23514";
const ALREADY_REGISTERED = "23505";

type Scratch = { urlMigrate: string; urlApp: string; drop(): Promise<void> };

let scratch: Scratch | undefined;

afterAll(async () => {
  await scratch?.drop();
});

type Stage = { urlApp: string; alpha: string; beta: string };

let staging: Promise<Stage> | undefined;

/** Staged lazily and memoised, so a failure here fails cases rather than skipping them. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantIds = seedTenants(provisioned.urlMigrate);
    const alpha = tenantIds[TENANT_ALPHA] ?? "";
    const beta = tenantIds[TENANT_BETA] ?? "";
    expect(alpha, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    expect(beta, `the scenario seeded no ${TENANT_BETA}`).not.toBe("");
    return { urlApp: provisioned.urlApp, alpha, beta };
  })());

/** One model-call row offered as the app role, under `scope`, naming `tenantId` as its owner. */
function offerCall(stage: Stage, scope: string, tenantId: string, cost = "1.5", tokens: [number, number] = [1, 1]): ReturnType<typeof psql> {
  return psql(
    stage.urlApp,
    withSession(
      { [GUC_TENANT]: scope },
      `insert into ${ident(MODEL_CALLS)} (call_id, tenant_id, project_id, model_id, request_hash, transport, outcome, input_tokens, output_tokens, attributed_cost)
         values (gen_random_uuid(), ${lit(tenantId)}::uuid, ${lit(randomUUID())}::uuid, ${lit(PROBE_MODEL)}, ${lit(randomUUID())}, 'live', 'proposed',
                 ${String(tokens[0])}, ${String(tokens[1])}, ${lit(cost)}::numeric);`,
    ),
  );
}

/** One fixture-registry row offered as the app role, under `scope`, naming `tenantId` as its owner. */
function offerFixture(stage: Stage, scope: string, tenantId: string): ReturnType<typeof psql> {
  return psql(
    stage.urlApp,
    withSession(
      { [GUC_TENANT]: scope },
      `insert into ${ident(MODEL_FIXTURES)} (tenant_id, request_hash, fixture_digest)
         values (${lit(tenantId)}::uuid, ${lit(randomUUID())}, ${lit(randomUUID())});`,
    ),
  );
}

describe("AC-2: a cross-tenant write is refused by policy on both ledger tables", () => {
  it(`AC-2: as ${ROLE_APP} under ${TENANT_ALPHA}'s scope, a ${MODEL_CALLS} row naming ${TENANT_BETA} is refused`, async () => {
    const stage = await staged();

    // The control first: the very same statement, differing only in the tenant it names, is admitted
    // — so the refusal below is the policy's WITH CHECK and not some other impossibility.
    const control = offerCall(stage, stage.alpha, stage.alpha);
    expect(control.ok, `a call belonging to the scope it is written under is a lawful row\n${control.stderr.slice(-400)}`).toBe(true);

    const refused = offerCall(stage, stage.alpha, stage.beta);
    expect(refused.ok, `${MODEL_CALLS}: a session scoped to ${TENANT_ALPHA} wrote a row owned by ${TENANT_BETA} — the tenant-scope policy needs a WITH CHECK, not only a USING clause`).toBe(false);
    expect(refused.sqlstate, `the refusal is row-level security's (${RLS_REFUSAL}), not a constraint's`).toBe(RLS_REFUSAL);
  }, 300_000);

  it(`AC-2: as ${ROLE_APP} under ${TENANT_ALPHA}'s scope, a ${MODEL_FIXTURES} row naming ${TENANT_BETA} is refused`, async () => {
    const stage = await staged();

    // On (tenant_id, request_hash) the control can land on a hash the tenant already registered;
    // 23505 is the key refusing a duplicate, which is a refusal the policy had to admit the row to
    // reach — so it counts as admission just as an accepted insert does.
    const control = offerFixture(stage, stage.alpha, stage.alpha);
    expect(
      control.ok || control.sqlstate === ALREADY_REGISTERED,
      `a fixture belonging to the scope it is written under is admitted by policy (accepted, or refused by its own key)\n${control.stderr.slice(-400)}`,
    ).toBe(true);

    const refused = offerFixture(stage, stage.alpha, stage.beta);
    expect(refused.ok, `${MODEL_FIXTURES}: a session scoped to ${TENANT_ALPHA} registered a fixture owned by ${TENANT_BETA}`).toBe(false);
    expect(refused.sqlstate, `the refusal is row-level security's (${RLS_REFUSAL}), not the composite key's`).toBe(RLS_REFUSAL);
  }, 300_000);

  it(`AC-2: with no scope armed at all, ${ROLE_APP} writes nothing to either table`, async () => {
    const stage = await staged();
    for (const [table, offered] of [
      [MODEL_CALLS, psql(stage.urlApp, `insert into ${ident(MODEL_CALLS)} (call_id, ${ident(TENANT_COLUMN)}, project_id, model_id, request_hash, transport, outcome, input_tokens, output_tokens, attributed_cost)
         values (gen_random_uuid(), ${lit(stage.alpha)}::uuid, ${lit(randomUUID())}::uuid, ${lit(PROBE_MODEL)}, ${lit(randomUUID())}, 'live', 'proposed', 1, 1, 1);`)],
      [MODEL_FIXTURES, psql(stage.urlApp, `insert into ${ident(MODEL_FIXTURES)} (${ident(TENANT_COLUMN)}, request_hash, fixture_digest)
         values (${lit(stage.alpha)}::uuid, ${lit(randomUUID())}, ${lit(randomUUID())});`)],
    ] as const) {
      expect(offered.ok, `${table}: a session naming neither a tenant nor a system reason wrote a row`).toBe(false);
      expect(offered.sqlstate, `${table}: the refusal is row-level security's (${RLS_REFUSAL})`).toBe(RLS_REFUSAL);
    }
  }, 300_000);
});

describe("AC-1: the ledger's money and token counts are judged by the column, not only at the seam's edge", () => {
  it(`AC-1: ${MODEL_CALLS}.attributed_cost admits no 'NaN', no infinity and no negative amount`, async () => {
    const stage = await staged();

    const lawful = offerCall(stage, stage.alpha, stage.alpha, "0");
    expect(lawful.ok, `a call that cost nothing is a lawful row\n${lawful.stderr.slice(-400)}`).toBe(true);

    for (const [cost, why] of [
      ["NaN", "sum() spreads a NaN across every row of the tenant, so one such row would make per-project spend unanswerable"],
      ["Infinity", "an infinite cost is not money the ledger can attribute"],
      ["-1", "a negative cost would subtract from what a tenant is attributed"],
    ] as const) {
      const refused = offerCall(stage, stage.alpha, stage.alpha, cost);
      expect(refused.ok, `${MODEL_CALLS}.attributed_cost accepted '${cost}' — ${why}`).toBe(false);
      expect(refused.sqlstate, `'${cost}' is refused by a CHECK (${CHECK_REFUSAL})`).toBe(CHECK_REFUSAL);
    }
  }, 300_000);

  it(`AC-1: ${MODEL_CALLS}'s token counts admit no negative number`, async () => {
    const stage = await staged();
    for (const tokens of [
      [-1, 0],
      [0, -1],
    ] as [number, number][]) {
      const refused = offerCall(stage, stage.alpha, stage.alpha, "1", tokens);
      expect(refused.ok, `${MODEL_CALLS} accepted ${JSON.stringify(tokens)} tokens — a call spends a whole, non-negative number of them`).toBe(false);
      expect(refused.sqlstate, `a negative token count is refused by a CHECK (${CHECK_REFUSAL})`).toBe(CHECK_REFUSAL);
    }
  }, 300_000);
});

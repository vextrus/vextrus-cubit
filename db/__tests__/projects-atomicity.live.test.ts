/**
 * Public acceptance for inc-011-projects AC-2's all-or-nothing half (L-REG-07, R-SPINE-010).
 *
 * The failure is not injected with machinery: the pin forks the platform seed, so a database whose
 * seed row is absent is a database in which `pinRulesetForProject` throws mid-transaction. What the
 * criterion asks is then observable in the store — no project, no participant, no role.
 *
 * It is a file of its own because it needs a database of its own: `forTenant` reads DATABASE_URL
 * when it first reaches the store, so one process cannot hold two deployments (SEAM-TENANT).
 *
 * The seed row is removed as the cluster's bootstrap user with the store's own immutability
 * triggers disabled for the statement — the point is a database that never had a seed, and the
 * triggers exist to stop the PRODUCT taking a row away, which is a posture the rule-set increment's
 * own acceptance grades. Nothing about the projects seam is loosened.
 */
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, TENANT_ALPHA } from "./support/fixtures";
import { count, lit, run, seedTenants } from "./support/live-sql";
import { BUILDING_TYPES, PROJECTS_MODULE, productModule, seamFunction } from "./projects-support";

const SEED_REASON = "test: a workspace whose platform rule-set seed is absent";

type Stage = { bootstrapUrl: string; tenantId: string; userId: string; createProject: (ctx: unknown, draft: unknown) => Promise<unknown> };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantId = seedTenants(provisioned.urlMigrate)[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");

    const url = new URL(BOOTSTRAP_URL);
    url.pathname = new URL(provisioned.urlMigrate).pathname;
    const bootstrapUrl = url.toString();

    const userId = run(
      bootstrapUrl,
      `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};
       insert into users (email, password_hash) values (${lit(`seedless-${Date.now().toString(36)}@cubit.test`)}, ${lit("not-a-real-hash")}) returning user_id;`,
    )[0]?.[0];
    expect(userId, "planting the creator produced no user row").toBeTruthy();
    run(bootstrapUrl, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\ninsert into memberships (tenant_id, user_id) values (${lit(tenantId)}, ${lit(userId ?? "")});`);

    // The fork's head, taken away — so the pin has nothing to copy and throws inside the caller's
    // transaction, which is exactly the failure AC-2 asks to be atomic against.
    run(
      bootstrapUrl,
      `alter table ruleset_editions disable trigger all;
       delete from ruleset_editions;
       alter table ruleset_editions enable trigger all;`,
    );
    expect(count(bootstrapUrl, "select count(*) from ruleset_editions;"), "the platform seed is gone: nothing is left for a pin to fork").toBe(0);

    process.env["DATABASE_URL"] = provisioned.urlApp;
    const seam = await productModule<Record<string, unknown>>(PROJECTS_MODULE);
    return { bootstrapUrl, tenantId, userId: userId ?? "", createProject: seamFunction(seam, "createProject") as Stage["createProject"] };
  })());

afterAll(async () => {
  await scratch?.drop();
});

describe("AC-2: a creation whose pin cannot be made leaves nothing behind", () => {
  it("AC-2: the pin fork failing leaves no project, no participant and no role row", async () => {
    const { bootstrapUrl, tenantId, userId, createProject } = await staged();
    const rows = (table: string): number => count(bootstrapUrl, `select count(*) from ${table} where tenant_id = ${lit(tenantId)};`);
    const before = { projects: rows("projects"), participants: rows("participants"), roles: rows("participant_roles") };

    let answered = false;
    try {
      await createProject({ tenantId, userId, actorKind: "human" }, { name: "AC-2 the creation that cannot pin", buildingType: BUILDING_TYPES[0] });
      answered = true;
    } catch {
      /* the pin has nothing to fork — that is the case */
    }
    expect(
      answered,
      "a project the transaction could not pin must not be created: L-REG-07 makes an unpinned project unrepresentable, so the creation fails rather than committing half of itself",
    ).toBe(false);

    expect({ projects: rows("projects"), participants: rows("participants"), roles: rows("participant_roles") }, "all-or-nothing: the failed creation wrote nothing at all").toStrictEqual(
      before,
    );
  });
});

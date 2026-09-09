/**
 * AC-1(b) — "the earliest membership" has one home.
 *
 * The tenancy module derives it in `roles/store.ts` and the shell derives it again in
 * `server/shell/workspace.ts` (debt-src-modules-1kuc50w): two statements, two spellings of one
 * invariant, and the two can drift into naming different workspaces for one account — which is a
 * person landing in a workspace their frame does not show. The derivation moves to
 * `workspacesBySeniority`, the one statement that reads it, and both callers ask it.
 *
 * The order is judged as a property of that statement, because it is a property of the SQL and not
 * of any one account's rows: what "earliest" means is which columns the order names.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const REPO_ROOT = process.cwd();
const SENIORITY_MODULE = "src/modules/spine/tenancy/roles/seniority.ts";
const ROLES_STORE_MODULE = "src/modules/spine/tenancy/roles/store.ts";
const TENANCY_MODULE = "src/modules/spine/tenancy/index.ts";

/** The one total order every workspace reading owes: the membership's age, tie-broken by tenant. */
const TOTAL_ORDER = ["memberships.createdAt", "memberships.tenantId"];

type Workspace = { tenantId: string; name: string };

async function moduleAt(relative: string): Promise<Record<string, unknown>> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return (await import(absolute)) as Record<string, unknown>;
}

/** The one home, or a loud absence naming what the module owes. */
async function workspacesBySeniority(): Promise<(reason: string, userId: string) => Promise<readonly Workspace[]>> {
  const module = await moduleAt(SENIORITY_MODULE);
  expect(typeof module["workspacesBySeniority"], `${SENIORITY_MODULE} publishes workspacesBySeniority`).toBe("function");
  return module["workspacesBySeniority"] as (reason: string, userId: string) => Promise<readonly Workspace[]>;
}

/** The file with its comments removed, so prose about ordering cannot stand in for the code. */
function shippedCode(relative: string): string {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  // white-box: AC-1(b) — B-17 one home. Which columns an order names is a property of the SQL, and
  // "the derivation is spelled once" can only be told from "it is spelled twice, identically" by
  // reading where each is spelled: two homes answer every behavioural probe the same way.
  return readFileSync(absolute, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** The `asc(table.column)` columns of every `.orderBy(...)` the file states, statement by statement. */
function ordersOf(code: string): string[][] {
  return [...code.matchAll(/\.orderBy\(([\s\S]*?)\)\s*(?:;|\.limit)/g)].map((found) =>
    [...(found[1] ?? "").matchAll(/asc\((\w+)\.(\w+)\)/g)].map((column) => `${column[1] ?? ""}.${column[2] ?? ""}`),
  );
}

test("AC-1(b): the tenancy module publishes the seniority reading, and its index re-exports it", async () => {
  const seniority = await workspacesBySeniority();
  const index = await moduleAt(TENANCY_MODULE);

  expect(index["workspacesBySeniority"], "the tenancy module's index re-exports the one home, so a caller outside it asks by name").toBe(seniority);
});

test("AC-1(b): a user id that names nobody answers an empty list, not a query", async () => {
  const seniority = await workspacesBySeniority();

  await expect(seniority("test: a reading of nobody's memberships", ""), "an empty id is no account").resolves.toEqual([]);
  await expect(seniority("test: a reading of nobody's memberships", "not-a-uuid"), "and a value postgres would raise 22P02 for is no account either").resolves.toEqual([]);
});

test("AC-1(b): the acting workspace is the first workspace of that same reading", async () => {
  const tenancy = await moduleAt(TENANCY_MODULE);
  expect(typeof tenancy["actingWorkspaceOf"], `${TENANCY_MODULE} publishes actingWorkspaceOf`).toBe("function");
  const actingWorkspaceOf = tenancy["actingWorkspaceOf"] as (userId: string) => Promise<string>;

  await expect(actingWorkspaceOf(""), "an account with no membership acts in no workspace").resolves.toBe("");
});

// white-box: AC-1(b) — B-17 one home. Which columns an order names is a property of the statement,
// not of any account's rows: the unit lane has no cluster, and two spellings of one invariant can
// only be told apart by reading where each is spelled.
test("AC-1(b): the seniority reading is ONE statement, ordered by the membership's age then the tenant", () => {
  const seniority = shippedCode(SENIORITY_MODULE);
  const orders = ordersOf(seniority);

  expect(orders.length, `${SENIORITY_MODULE} states one ordered reading of the memberships — the one home`).toBe(1);
  expect(orders[0], "age first, then the tenant uuid — two memberships written in one transaction still order").toEqual(TOTAL_ORDER);
  expect(seniority.includes("tenants"), "joined to the tenants row for the name a switcher shows").toBe(true);
});

// white-box: AC-1(b) — the same reason: the defect the row names is a SECOND spelling of the order,
// and only the text of the file that used to hold it can show it is gone.
test("AC-1(b): the roles store no longer spells an order of its own", () => {
  const store = shippedCode(ROLES_STORE_MODULE);

  const overMemberships = ordersOf(store).filter((order) => order.some((column) => column.startsWith("memberships.")));
  expect(overMemberships, `${ROLES_STORE_MODULE} derives seniority through the one home rather than ordering memberships itself`).toEqual([]);
});

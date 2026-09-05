/**
 * The lifecycle guard and the write it admits both name the workspace they are about.
 *
 * Resting the whole of the scoping on row-level security makes a query that says less than it means:
 * the day a policy is read wrong, or a handle is minted from the wrong context, an archive lands on
 * another workspace's project and nothing in this module ever said it should not. The policy stays —
 * it is the belt — and the predicate is the braces, which is also the only half a reviewer can read.
 *
 * The store is stubbed at SEAM-TENANT's own entry, and the conditions the doors build are walked for
 * the columns they name and the values they are bound to. The query builder itself stays inside
 * `src/core/db`: a suite may not reach past that seam for a dialect to render SQL with.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const store = vi.hoisted(() => ({
  /** Every `where(...)` the two doors built, in the order they built them. */
  conditions: [] as unknown[],
  rows: [] as unknown[],
  tenants: [] as unknown[],
}));

vi.mock("../../../../core/db", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  const handle: Record<string | symbol, unknown> = {};
  const proxy: unknown = new Proxy(handle, {
    get(_target, property) {
      if (property === "then") return (resolve: (value: unknown) => unknown) => resolve([...store.rows]);
      if (property === "transaction") return (work: (tx: unknown) => unknown) => work(proxy);
      return (...args: unknown[]) => {
        if (property === "where") store.conditions.push(args[0]);
        return proxy;
      };
    },
  });
  return { ...original, forTenant: (ctx: unknown) => (store.tenants.push(ctx), proxy) };
});

const { archiveProject } = await import("../lifecycle");

const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const PROJECT = "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d";
const ACTOR = "aaaaaaaa-1111-4222-8333-444444444444";

/**
 * What a recorded condition is written in terms of: the store columns it names and the values it is
 * bound to. The condition is walked rather than rendered, for the reason above.
 */
function boundBy(condition: unknown): { columns: string[]; values: unknown[] } {
  const columns: string[] = [];
  const values: unknown[] = [];
  const seen = new WeakSet<object>();
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const each of node) walk(each);
      return;
    }
    const bag = node as Record<string, unknown>;
    if (typeof bag["name"] === "string" && "columnType" in bag) columns.push(bag["name"] as string);
    if ("value" in bag && !("queryChunks" in bag)) values.push(bag["value"]);
    for (const [key, each] of Object.entries(bag)) {
      // A column knows its table and a table knows all its columns: following that link would put
      // every column of the table in the answer whichever one the condition actually names.
      if (key === "table") continue;
      walk(each);
    }
  };
  walk(condition);
  return { columns, values };
}

beforeEach(() => {
  store.conditions.length = 0;
  store.rows.length = 0;
  store.tenants.length = 0;
  // The guard's read answers with a participation row, so the write beyond it is reached.
  store.rows.push({ userId: ACTOR });
});

afterEach(() => {
  vi.clearAllMocks();
});

test("the participation guard names the workspace as well as the project and the actor", async () => {
  await archiveProject({ tenantId: TENANT, userId: ACTOR }, { projectId: PROJECT });

  const guard = boundBy(store.conditions[0]);
  expect(guard.columns, "the guard is bounded by the workspace the caller named").toContain("tenant_id");
  expect(guard.columns, "and by the project the address names").toContain("project_id");
  expect(guard.columns, "and by the account that is asking").toContain("user_id");
  expect(guard.values, "bound to the caller's own three facts").toEqual(expect.arrayContaining([TENANT, PROJECT, ACTOR]));
});

test("the write names the workspace as well as the project", async () => {
  await archiveProject({ tenantId: TENANT, userId: ACTOR }, { projectId: PROJECT });

  const write = boundBy(store.conditions[1]);
  expect(write.columns, "a lifecycle write says which workspace's project it moves").toContain("tenant_id");
  expect(write.columns, "beside the project it is about").toContain("project_id");
  expect(write.values, "bound to the address's own two segments").toEqual(expect.arrayContaining([TENANT, PROJECT]));
});

test("a project id that is not a uuid is refused before any of it is put to the store", async () => {
  await expect(archiveProject({ tenantId: TENANT, userId: ACTOR }, { projectId: "not-a-uuid" })).rejects.toThrow();

  expect(store.conditions, "a value naming no project of anybody's is answered as the refusal it is").toEqual([]);
});

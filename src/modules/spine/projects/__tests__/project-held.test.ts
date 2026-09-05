/**
 * AC-2(a) — "does this project exist here?", answered in one place.
 *
 * Three screens ask that question and each answers it today by reading the workspace's whole
 * project roster, quick stats and all, to compare one id. The module gets one door for it, and this
 * file judges the door: what it asks the store, how much of the store it asks for, and what it
 * answers when the address cannot name a project at all.
 *
 * The store is stubbed at SEAM-TENANT's own entry (`forTenant`), and the condition the door builds
 * is read for the columns it names and the values it is bound to — the query builder itself stays
 * inside `src/core/db`, which is the only place a driver may be reached for (SEAM-TENANT).
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

/** What one call on the stubbed handle recorded. */
interface Recorded {
  readonly method: string;
  readonly args: readonly unknown[];
}

const store = vi.hoisted(() => ({
  calls: [] as { method: string; args: readonly unknown[] }[],
  rows: [] as unknown[],
  tenants: [] as unknown[],
}));

vi.mock("../../../../core/db", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  // Every builder call lands on one recorder, so the door may spell its query in whatever order
  // drizzle admits and still be judged on what it asked for.
  const handle: Record<string | symbol, unknown> = {};
  const proxy: unknown = new Proxy(handle, {
    get(_target, property) {
      if (property === "then") {
        return (resolve: (value: unknown) => unknown) => resolve([...store.rows]);
      }
      return (...args: unknown[]) => {
        store.calls.push({ method: String(property), args });
        return proxy;
      };
    },
  });
  return { ...original, forTenant: (ctx: unknown) => (store.tenants.push(ctx), proxy) };
});

const projects = await import("../index");

/** The one export this criterion is about, or a loud absence naming what the module still owes. */
function door(): (scope: { tenantId: string }, projectId: string) => Promise<boolean> {
  const held = (projects as Record<string, unknown>)["projectHeld"];
  expect(typeof held, "src/modules/spine/projects exports projectHeld — the one home of \"does this project exist here?\" (B-17, ARCH-02)").toBe("function");
  return held as (scope: { tenantId: string }, projectId: string) => Promise<boolean>;
}

const calls = (method: string): Recorded[] => store.calls.filter((call) => call.method === method);

/**
 * What the recorded condition is written in terms of: the store columns it names and the values it
 * is bound to. The condition is walked rather than rendered — the query builder is `src/core/db`'s
 * to hold and a suite may not reach past it for a dialect (SEAM-TENANT, the `no-db-outside-seam`
 * rule) — so what is read is the shape drizzle already built, whichever operators built it.
 */
function boundBy(): { columns: string[]; values: unknown[] } {
  const where = calls("where")[0];
  expect(where, "the read is bounded by a condition").toBeDefined();

  const columns: string[] = [];
  const values: unknown[] = [];
  const seen = new WeakSet<object>();
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const each of node) walk(each);
      return;
    }
    const bag = node as Record<string, unknown>;
    // A column carries the store's own name for itself; a bound parameter carries its value.
    if (typeof bag["name"] === "string" && "columnType" in bag) columns.push(bag["name"] as string);
    if ("value" in bag && !("queryChunks" in bag)) values.push(bag["value"]);
    for (const [key, each] of Object.entries(bag)) {
      // A column knows its table and a table knows all its columns: following that link would put
      // every column of `projects` in the answer whichever one the condition actually names.
      if (key === "table") continue;
      walk(each);
    }
  };
  walk((where as Recorded).args[0]);
  return { columns, values };
}

const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const PROJECT = "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d";

beforeEach(() => {
  store.calls.length = 0;
  store.rows.length = 0;
  store.tenants.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

test("AC-2(a): a segment that is not a uuid answers false without asking the store anything", async () => {
  const projectHeld = door();

  await expect(projectHeld({ tenantId: TENANT }, "not-a-uuid")).resolves.toBe(false);

  expect(store.calls, "a value that names no project of anybody's is not a question worth putting to the store").toEqual([]);
});

test("AC-2(a): a project the workspace holds answers true, from one bounded read", async () => {
  const projectHeld = door();
  store.rows.push({ projectId: PROJECT });

  await expect(projectHeld({ tenantId: TENANT }, PROJECT)).resolves.toBe(true);

  expect(calls("select").length, "one read answers the question — not a roster, and not one read per screen").toBe(1);
  expect(store.tenants, "the read is scoped to the workspace the address names").toEqual([{ tenantId: TENANT }]);

  const { columns, values } = boundBy();
  expect(columns, "the condition names the workspace column").toContain("tenant_id");
  expect(columns, "the condition names the project column").toContain("project_id");
  expect(values, "both segments of the address are what the condition is bound to").toEqual(expect.arrayContaining([TENANT, PROJECT]));
  expect(new Set(columns), "and nothing else: the interface spells this read as `where tenant_id = $1 and project_id = $2`").toEqual(new Set(["tenant_id", "project_id"]));

  const bounded = calls("limit");
  expect(bounded.length, "the read is bounded: existence needs at most one row").toBe(1);
  expect((bounded[0] as Recorded).args[0], "one row is all an existence answer can use").toBe(1);
});

test("AC-2(a): a uuid the workspace does not hold answers false", async () => {
  const projectHeld = door();

  await expect(projectHeld({ tenantId: TENANT }, PROJECT)).resolves.toBe(false);

  expect(calls("select").length, "the absence is still answered by one read").toBe(1);
});

test("AC-2(a): projectsForHome stays what the workspace's home reads", () => {
  expect(typeof (projects as Record<string, unknown>)["projectsForHome"], "the roster read is unchanged — the new door stands beside it, it does not replace it").toBe("function");
});


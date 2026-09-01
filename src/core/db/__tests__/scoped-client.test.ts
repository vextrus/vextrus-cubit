/**
 * SEAM-TENANT's client, over a stand-in driver: what the seam does with a connection is a property
 * of the calls it makes, so the driver is substituted and every call it receives is recorded. No
 * live server is needed for any of it, and none is reached.
 */
import { describe, expect, test } from "vitest";
import { closePools, scopedClient, type Scope } from "../../db";

/** One statement the driver was asked for, and the connection it arrived on. */
type Issued = { readonly on: string; readonly query: string; readonly params: readonly unknown[] };

const SCOPE: Scope = { tenantId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", systemReason: "" };

/** Rows as a driver answers them, and the same answer as the positional tuples drizzle also asks for. */
const ROWS = [{ one: 1 }];
const VALUES = [[1]];

/**
 * A driver that records rather than dials. `reserve` is present and counted: taking a reserved
 * connection out of the pool for a statement is the cost this seam must not pay, and a stand-in that
 * did not offer the method at all would prove only that it cannot be called.
 */
function stubDriver(): { sql: unknown; issued: Issued[]; reserved: () => number; options: unknown; optionsOn: (on: string) => unknown } {
  const issued: Issued[] = [];
  let reserved = 0;
  const options = { host: ["stub"], port: [5432] };
  // Each handle states its own options object, as a driver that answers a transaction body with a
  // handle of its own does: a client that mirrored some other handle's settings would pass a stub
  // that shared one object between them and still be wrong.
  const perHandle = new Map<string, unknown>();
  const optionsOn = (on: string): unknown => {
    const existing = perHandle.get(on);
    if (existing !== undefined) return existing;
    const own = { host: [on], port: [5432] };
    perHandle.set(on, own);
    return own;
  };
  const pending = (on: string, query: string, params: readonly unknown[]): unknown => ({
    values: () => {
      issued.push({ on, query, params });
      return Promise.resolve(VALUES);
    },
    then: (onRows: (value: unknown) => unknown, onFailure: (reason: unknown) => unknown) => {
      issued.push({ on, query, params });
      return Promise.resolve(ROWS).then(onRows, onFailure);
    },
  });
  const connection = (on: string): unknown => ({
    options: optionsOn(on),
    unsafe: (query: string, params: readonly unknown[] = []) => pending(on, query, params),
    savepoint: (work: (nested: unknown) => Promise<unknown>) => work(connection(`${on}/savepoint`)),
  });
  const sql = {
    options,
    reserve: () => {
      reserved += 1;
      return Promise.resolve(connection("reserved"));
    },
    begin: async (work: (tx: unknown) => Promise<unknown>) => await work(connection("transaction")),
    unsafe: (query: string, params: readonly unknown[] = []) => pending("pool", query, params),
  };
  return { sql, issued, reserved: () => reserved, options, optionsOn };
}

/** The client as drizzle holds one: the three members the postgres-js driver reaches for. */
type Client = {
  options: unknown;
  unsafe: (query: string, params?: readonly unknown[]) => PromiseLike<unknown> & { values: () => PromiseLike<unknown> };
  begin: (work: (tx: Client) => Promise<unknown>) => Promise<unknown>;
  savepoint?: (work: (nested: Client) => Promise<unknown>) => Promise<unknown>;
};

const clientOver = (sql: unknown): Client => scopedClient(sql as never, SCOPE) as unknown as Client;

/** The scope-arming statement, recognised by what it writes rather than by its exact text. */
const arms = (issued: Issued) => /set_config/.test(issued.query);

describe("the scoped client pays for one connection, not two", () => {
  test("a statement outside a transaction never reserves a connection", async () => {
    const driver = stubDriver();
    await clientOver(driver.sql).unsafe("select 1", []);

    expect(driver.reserved(), "the arming and the statement travel on the transaction's own connection, so nothing is taken out of the pool and handed back").toBe(0);
    expect(driver.issued.map((issued) => issued.on), "…and both statements land on that one connection").toEqual(["transaction", "transaction"]);
    expect(driver.issued.map(arms), "the scope is armed before the statement, never after it").toEqual([true, false]);
    expect(driver.issued[0]?.params, "the arming carries the scope's own two values").toEqual([SCOPE.tenantId, SCOPE.systemReason]);
  });

  test("a pending query answers each shape with that shape, not with the first one asked for", async () => {
    const driver = stubDriver();
    const pending = clientOver(driver.sql).unsafe("select 1", []);

    expect(await pending, "drizzle asks a query for row objects").toEqual(ROWS);
    expect(await pending.values(), "…and asks the same query for positional tuples when it maps fields itself — replaying the row objects here would hand back something nothing can read by position").toEqual(VALUES);
  });

  test("the client inside a transaction carries the transaction handle's own options", async () => {
    const driver = stubDriver();
    const client = clientOver(driver.sql);
    let seen: unknown = "the transaction body never ran";
    let seenNested: unknown = "the savepoint body never ran";
    await client.begin(async (tx) => {
      seen = tx.options;
      await tx.savepoint?.(async (nested) => {
        seenNested = nested.options;
        return null;
      });
      await tx.unsafe("select 1", []);
      return null;
    });

    expect(client.options, "the pool-level client states the pool's options, which is where the driver reads its parsers off").toBe(driver.options);
    expect(seen, "drizzle reads a client's options off the handle that client wraps, and inside a transaction that is the transaction's handle").toBe(driver.optionsOn("transaction"));
    expect(seenNested, "…and a savepoint client states the savepoint handle's own options in turn").toBe(driver.optionsOn("transaction/savepoint"));
    expect(driver.issued.map((issued) => issued.on), "and the whole transaction runs on the one connection it opened").toEqual(["transaction", "transaction"]);
  });

  test("a transaction arms after the isolation level it was opened with", async () => {
    const driver = stubDriver();
    await clientOver(driver.sql).begin(async (tx) => {
      await tx.unsafe("set transaction isolation level serializable", []);
      await tx.unsafe("select 1", []);
      return null;
    });

    expect(driver.issued.map((issued) => issued.query.slice(0, 3)), "the configuration statement comes first, or the server refuses it with 25001").toEqual(["set", "sel", "sel"]);
    expect(driver.issued.map(arms), "and the scope is armed once, before the first statement that reads or writes").toEqual([false, true, false]);
  });
});

describe("the seam's pools can be closed", () => {
  test("closing pools that were never built closes nothing and answers cleanly", async () => {
    await expect(closePools(), "a process that only used a substituted driver has no pool of the seam's own to end").resolves.toBeUndefined();
  });
});

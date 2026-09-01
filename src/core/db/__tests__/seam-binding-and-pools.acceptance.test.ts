/**
 * Public acceptance for AC-1 (B-05, SEAM-TENANT, R-SPINE-004): the db seam's typed surface is bound
 * to the schema tree MECHANICALLY rather than by a comment, and the pools it builds can be closed.
 *
 * The seam is loaded by absolute path rather than by a static specifier — the idiom
 * `src/core/acts/__tests__/act-map.acceptance.test.ts` and `src/core/format.test.ts` already use:
 * a member the product does not provide yet must fail as an assertion naming it, never as an
 * unreadable resolution error that kills collection.
 *
 * B-19: nothing here freezes a table roster. The barrel `db/schema.ts` is the denominator on one
 * side and `SEAM_SCHEMA` is the denominator on the other, so a table added to the tree passes this
 * file unchanged — and fails it the moment the two stop agreeing, which is the whole point of the
 * row this increment pays down.
 *
 * No live database: `DATABASE_URL` is pointed at a port nothing listens on, so every query answers
 * from the driver itself. That is what makes "the pool was ended" and "a fresh pool was built"
 * distinguishable — an ended pool answers without dialling, a fresh one dials and is refused.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const SEAM_MODULE = "src/core/db.ts";
const SCHEMA_BARREL = "db/schema.ts";

/** The seam's surface as tsc reads it — a type position, erased before the test transform sees it. */
type Seam = typeof import("../../db");

/**
 * The two members this increment adds. Read off the loaded module through its own optional shape so
 * this file typechecks against today's tree and grades tomorrow's: the red is the assertion below,
 * never a resolution error.
 */
type SweptSeam = {
  SEAM_SCHEMA?: Record<string, unknown>;
  closePools?: () => Promise<void>;
};

/** A tenant uuid the seam admits, so a handle can be taken without a live server. */
const TENANT = "00000000-0000-4000-8000-000000000001";

/** A reachable address with nothing behind it: a dial is refused at once rather than timing out. */
const UNREACHABLE_DATABASE = "postgresql://cubit:cubit@127.0.0.1:1/cubit_acceptance_no_server";

/**
 * Drizzle marks its own table objects with a well-known symbol (drizzle-orm 0.45.2, the pinned
 * version). Reading the mark rather than importing the ORM keeps SEAM-TENANT's rule intact — the
 * driver has one home and this file is not it — and the mark is checked in BOTH directions below,
 * so a mark this reader failed to recognise fails the suite instead of emptying it.
 */
const DRIZZLE_TABLE = "drizzle:IsDrizzleTable";

function isDrizzleTable(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  return Object.getOwnPropertySymbols(value).some((mark) => mark.description === DRIZZLE_TABLE);
}

async function loadModule<T>(relative: string, why: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — ${why}`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

const loadSeam = async (): Promise<Seam & SweptSeam> => await loadModule<Seam & SweptSeam>(SEAM_MODULE, "SEAM-TENANT's one home for the driver and the schema");

const loadBarrel = async (): Promise<Record<string, unknown>> =>
  await loadModule<Record<string, unknown>>(SCHEMA_BARREL, "it is the path drizzle.config.ts and the drift lane pin (ARCH-02)");

/** Whatever the barrel exports that is a drizzle table, keyed by the name it is exported under. */
async function barrelTables(): Promise<Map<string, unknown>> {
  const barrel = await loadBarrel();
  return new Map(Object.entries(barrel).filter(([, value]) => isDrizzleTable(value)));
}

/** The seam's typed surface, asserted to be there at all before anything is derived from it. */
async function seamSchema(): Promise<Record<string, unknown>> {
  const seam = await loadSeam();
  const schema = seam.SEAM_SCHEMA;
  expect(
    typeof schema === "object" && schema !== null,
    `${SEAM_MODULE} must export SEAM_SCHEMA — the object drizzle is handed — so the binding to the schema tree is a check rather than a comment (B-05)`,
  ).toBe(true);
  return schema as Record<string, unknown>;
}

/**
 * The error code a rejected query carries. The ORM wraps a driver failure in a query error of its
 * own, so the chain of causes is walked: the code is the driver's word for what happened, and it is
 * the driver this file is asking about.
 */
function failureCode(failure: unknown): string {
  for (let held: unknown = failure, depth = 0; held !== undefined && held !== null && depth < 8; depth += 1) {
    const code = (held as { code?: unknown }).code;
    if (typeof code === "string") return code;
    held = (held as { cause?: unknown }).cause;
  }
  return String((failure as { message?: unknown })?.message ?? failure);
}

async function queryFailure(run: () => Promise<unknown>): Promise<string> {
  return await Promise.resolve()
    .then(run)
    .then(() => "the query somehow succeeded — nothing is listening on this address", failureCode);
}

/** One read through a handle, issued so the pool behind it has to answer for itself. */
async function readThrough(seam: Seam, handle: ReturnType<Seam["forTenant"]>): Promise<string> {
  return await queryFailure(async () => await handle.select().from(seam.tenants).limit(1));
}

beforeAll(() => {
  process.env["DATABASE_URL"] = UNREACHABLE_DATABASE;
});

afterAll(async () => {
  const seam = await loadSeam();
  if (typeof seam.closePools === "function") await seam.closePools();
});

describe("AC-1: closePools — the seam's pools can be closed", () => {
  // First in the file, and deliberately so: no test above it has taken a handle, so "no pool was
  // ever built" is true of the process this assertion runs in rather than of an emptied registry.
  test("AC-1: closePools resolves cleanly when no pool was ever built", async () => {
    const seam = await loadSeam();
    expect(
      typeof seam.closePools,
      `${SEAM_MODULE} must export closePools(): Promise<void> — without it a process that touched the seam cannot exit`,
    ).toBe("function");
    const closePools = seam.closePools as () => Promise<void>;
    await expect(closePools(), "closing pools that were never opened closes nothing and answers cleanly").resolves.toBeUndefined();
  });

  test("AC-1: closePools ends every pool the seam built and empties the registry", async () => {
    const seam = await loadSeam();
    expect(typeof seam.closePools, `${SEAM_MODULE} must export closePools(): Promise<void>`).toBe("function");
    const closePools = seam.closePools as () => Promise<void>;

    const before = seam.forTenant({ tenantId: TENANT });
    const dialled = await readThrough(seam, before);
    expect(dialled, "a handle taken before the close dials the configured address, so there is a live pool to end").toBe("ECONNREFUSED");

    await closePools();

    // An ended pool answers from the driver without reaching for a socket; a pool that was merely
    // forgotten would dial again. That difference is what "ends every pool the seam built" means.
    const afterClose = await readThrough(seam, before);
    expect(
      afterClose.startsWith("CONNECTION_"),
      `a handle held across closePools() must answer from an ENDED pool — it answered ${afterClose}`,
    ).toBe(true);

    // …and the registry is empty, so the next scoped call builds a fresh pool rather than handing
    // out the ended one: a fresh pool dials, and a dial at this address is refused.
    const fresh = seam.forTenant({ tenantId: TENANT });
    expect(
      await readThrough(seam, fresh),
      "after closePools() a later scoped call must build a fresh pool — the ended one must not be handed out again",
    ).toBe("ECONNREFUSED");

    await closePools();
  });
});

describe("AC-1: SEAM_SCHEMA is bound to the schema tree in both directions (B-05)", () => {
  test("AC-1: SEAM_SCHEMA is the very object the seam hands drizzle", async () => {
    const seam = await loadSeam();
    const schema = await seamSchema();
    const handle = seam.forTenant({ tenantId: TENANT });
    // drizzle builds the handle's typed read surface from the schema it was constructed with, one
    // member per table (drizzle-orm 0.45.2). So the surface a handle exposes is what the seam
    // actually handed over: a SEAM_SCHEMA exported beside a different object handed to drizzle
    // would answer here with different members, which is the drift this row replaces with a check.
    const surfaced = Object.keys((handle as unknown as { query: Record<string, unknown> }).query);
    expect(
      [...surfaced].sort(),
      "SEAM_SCHEMA must be the object drizzle is handed, not a second object beside it — the handle's typed surface is keyed by exactly the members of SEAM_SCHEMA (B-05)",
    ).toEqual(Object.keys(schema).sort());
  });

  test("AC-1: every drizzle table db/schema.ts exports is a value of SEAM_SCHEMA, by identity", async () => {
    const tables = await barrelTables();
    const schema = await seamSchema();
    const held = new Set(Object.values(schema));
    expect(tables.size, `${SCHEMA_BARREL} must export at least one drizzle table, or this check grades nothing`).toBeGreaterThan(0);
    for (const [name, table] of tables) {
      expect(
        held.has(table),
        `${SCHEMA_BARREL} exports the table "${name}", which SEAM_SCHEMA does not hold — a table added to the tree and forgotten in the seam must fail a check, not a comment (B-05)`,
      ).toBe(true);
    }
  });

  test("AC-1: SEAM_SCHEMA holds no table the barrel does not export", async () => {
    const tables = await barrelTables();
    const schema = await seamSchema();
    const exported = new Set(tables.values());
    const entries = Object.entries(schema);
    expect(entries.length, "SEAM_SCHEMA must hold the typed surface, or this check grades nothing").toBeGreaterThan(0);
    for (const [name, value] of entries) {
      expect(
        isDrizzleTable(value),
        `SEAM_SCHEMA's "${name}" is not a drizzle table — the typed surface is the tables the tree defines (SEAM-TENANT)`,
      ).toBe(true);
      expect(
        exported.has(value),
        `SEAM_SCHEMA holds "${name}", which ${SCHEMA_BARREL} does not export — the drift lane and the live suite read the barrel, so a table only the seam knows is a table nothing else can reach (B-05, V-DB)`,
      ).toBe(true);
    }
  });
});

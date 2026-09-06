// @vitest-environment node
/**
 * Public acceptance for AC-1 and AC-2 of the db module split (SEAM-TENANT, ARCH-02, B-17).
 *
 * AC-1 is the "loses nothing" half. EXPORTS_BEFORE is the export roster `git show main:src/core/db.ts`
 * declares — every `export const|function|type|interface|{…}` name, values and types alike. It is
 * frozen here because that roster IS the barrel's contract: every importer in the tree reads these
 * names from `@/core/db`, so a name the split drops is a broken tree, and a name it adds is public
 * surface no spec asked for (the interfaces section: exactly today's names, none new, none dropped).
 * Values are judged by importing the barrel and reading its namespace; a type cannot be read at
 * runtime at all, so the type half is judged where types live — a compile-time reference through
 * `import("../../src/core/db")` that reds `tsc --noEmit` if a name is gone.
 *
 * AC-2 is the "barrel" half: what `src/core/db.ts` may still SAY once the modules are split out.
 * That is a property of the file's text rather than of any call it answers, so it is read through
 * the tree's one lexer with the comments taken out (Q-17 keeps prose out of a code check), and every
 * such read is marked as the white-box it is. Where the moved names now live is judged by import and
 * by identity — the barrel's `forTenant` and `src/core/db/seam.ts`'s must be the same function, not
 * two spellings of one (B-17).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { lex } from "../support/source-lex";

/** The checkout this suite runs against. */
const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** The barrel itself — the one path every importer in the tree names. */
const BARREL = "src/core/db.ts";

/**
 * EXPORTS_BEFORE, value half: every runtime name main's seam exported, with the `typeof` it had
 * there. The eight query operators are included — they are handed out from the seam because the
 * driver is the seam's alone (SEAM-TENANT), so losing them is losing a public name like any other.
 */
const VALUES_BEFORE: Readonly<Record<string, string>> = {
  and: "function",
  asc: "function",
  desc: "function",
  eq: "function",
  gt: "function",
  inArray: "function",
  isNull: "function",
  lt: "function",
  recordSystemReasonsWith: "function",
  tenants: "object",
  projects: "object",
  participants: "object",
  acts: "object",
  participantRoles: "object",
  participantRoleWithdrawals: "object",
  users: "object",
  sessions: "object",
  authTokens: "object",
  authAttempts: "object",
  WORKSPACE_ROLES: "object",
  memberships: "object",
  invitations: "object",
  rulesetScope: "function",
  rulesetEditions: "object",
  tenantRulesetEditions: "object",
  modelCalls: "object",
  userPrefs: "object",
  modelFixtures: "object",
  DISPOSITIONS: "object",
  sheetUnderstandingDispositions: "object",
  workItemCatalogue: "object",
  bears: "object",
  ACCEPTED_FORMATS: "object",
  isAcceptedFormat: "function",
  UPLOAD_STATES: "object",
  SCAN_VERDICTS: "object",
  RASTER_TIERS: "object",
  UPLOAD_MAX_BYTES: "number",
  UPLOAD_CHUNK_BYTES: "number",
  files: "object",
  drawings: "object",
  uploads: "object",
  ingests: "object",
  sheetRasters: "object",
  sheetDisciplines: "object",
  drawingSets: "object",
  drawingSetMembers: "object",
  drawingSetRevisions: "object",
  SEAM_SCHEMA: "object",
  holdStateLock: "function",
  closePools: "function",
  scopedClient: "function",
  isUuid: "function",
  inCurrentScope: "function",
  isStorableText: "function",
  storableText: "function",
  forTenant: "function",
  runAsSystem: "function",
  modelSpendByProject: "function",
  jobsStore: "function",
};

/**
 * EXPORTS_BEFORE, type half: every type name main's seam exported, referenced through the barrel.
 * A type the split drops is not a runtime absence — it is a compile error, and this is where it
 * lands: `tsc --noEmit` reads this file, so a missing member here reds V-VERIFY's type stage.
 */
type TypesBefore = {
  readonly SystemReasonRecord: import("../../src/core/db").SystemReasonRecord;
  readonly SystemReasonRecorder: import("../../src/core/db").SystemReasonRecorder;
  readonly WorkspaceRole: import("../../src/core/db").WorkspaceRole;
  readonly Disposition: import("../../src/core/db").Disposition;
  readonly SheetReadingRecord: import("../../src/core/db").SheetReadingRecord;
  readonly AcceptedFormat: import("../../src/core/db").AcceptedFormat;
  readonly UploadState: import("../../src/core/db").UploadState;
  readonly ScanVerdict: import("../../src/core/db").ScanVerdict;
  readonly RasterTier: import("../../src/core/db").RasterTier;
  readonly TenantDb: import("../../src/core/db").TenantDb;
  readonly TenantTx: import("../../src/core/db").TenantTx;
  readonly SystemDb: import("../../src/core/db").SystemDb;
  readonly Scope: import("../../src/core/db").Scope;
  readonly ModelSpend: import("../../src/core/db").ModelSpend;
  readonly JobEventDraft: import("../../src/core/db").JobEventDraft;
  readonly JobEventRow: import("../../src/core/db").JobEventRow;
  readonly QueuedJob: import("../../src/core/db").QueuedJob;
  readonly QueueShape: import("../../src/core/db").QueueShape;
  readonly LiveClaim: import("../../src/core/db").LiveClaim;
  readonly ClaimCursor: import("../../src/core/db").ClaimCursor;
  readonly QueueState: import("../../src/core/db").QueueState;
  readonly JobsStore: import("../../src/core/db").JobsStore;
};

/** The same roster as values, exact against the mapped type above so the two cannot drift apart. */
const TYPE_NAMES = [
  "SystemReasonRecord",
  "SystemReasonRecorder",
  "WorkspaceRole",
  "Disposition",
  "SheetReadingRecord",
  "AcceptedFormat",
  "UploadState",
  "ScanVerdict",
  "RasterTier",
  "TenantDb",
  "TenantTx",
  "SystemDb",
  "Scope",
  "ModelSpend",
  "JobEventDraft",
  "JobEventRow",
  "QueuedJob",
  "QueueShape",
  "LiveClaim",
  "ClaimCursor",
  "QueueState",
  "JobsStore",
] as const satisfies readonly (keyof TypesBefore)[];

/** A type referenced above but not listed as a value would make this a non-empty union — tsc reds. */
type UnlistedType = Exclude<keyof TypesBefore, (typeof TYPE_NAMES)[number]>;
const UNLISTED_TYPES: readonly UnlistedType[] = [];

/** The eight query operators, which stay a re-export of the driver rather than a moved module. */
const OPERATORS = ["and", "asc", "desc", "eq", "gt", "inArray", "isNull", "lt"] as const;

/** Where the goal says each moved name now lives, and what the barrel must still hand out for it. */
const HOMES = [
  { module: "src/core/db/schema.ts", names: ["tenants", "SEAM_SCHEMA"] },
  { module: "src/core/db/pools.ts", names: ["closePools"] },
  { module: "src/core/db/seam.ts", names: ["forTenant", "runAsSystem", "scopedClient"] },
  { module: "src/core/db/jobs.ts", names: ["jobsStore"] },
] as const;

/** A module of the checkout, asserted to be there first so a file the split owes names itself. */
async function moduleAt(relative: string): Promise<Record<string, unknown>> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the split does not provide it yet`).toBe(true);
  return (await import(abs)) as Record<string, unknown>;
}

describe("AC-1: the barrel loses nothing", () => {
  test("AC-1: every value name main exported is still an own key of the barrel", async () => {
    const barrel = await moduleAt(BARREL);
    const missing = Object.keys(VALUES_BEFORE).filter((name) => !Object.hasOwn(barrel, name));
    expect(missing, `${BARREL} no longer hands out a name main exported — every importer of it reads these`).toEqual([]);
  });

  test("AC-1: every value name keeps the typeof it had on main", async () => {
    const barrel = await moduleAt(BARREL);
    const changed = Object.entries(VALUES_BEFORE)
      .filter(([name]) => Object.hasOwn(barrel, name))
      .filter(([name, kind]) => typeof barrel[name] !== kind)
      .map(([name, kind]) => `${name}: expected ${kind}, got ${typeof barrel[name]}`);
    expect(changed, "a name survived the split as something else — a table re-exported as a type-only shell reads as a drop").toEqual([]);
  });

  test("AC-1: the barrel adds no public name main did not export", async () => {
    const barrel = await moduleAt(BARREL);
    const added = Object.keys(barrel).filter((name) => !Object.hasOwn(VALUES_BEFORE, name));
    expect(added, "the split published a new name — the barrel is exactly today's roster (interfaces: no new public name)").toEqual([]);
  });

  test("AC-1: the type roster is referenced through the barrel, exactly", () => {
    // The reference itself is the assertion and it happens at compile time; what is checked here is
    // that the value roster and the compile-time roster name the same types, so neither can be
    // quietly trimmed on its own.
    expect(UNLISTED_TYPES, "a type is referenced through the barrel but missing from TYPE_NAMES").toEqual([]);
    // A repeated name would let a dropped one hide behind a listing that still looks complete.
    expect(new Set(TYPE_NAMES).size, "the type roster repeats a name").toBe(TYPE_NAMES.length);
  });
});

describe("AC-2: src/core/db.ts is a barrel over src/core/db/", () => {
  // white-box: AC-2 — "the barrel spells nothing but re-exports" is a property of the file's TEXT;
  // no call it answers can tell whether a table was defined here or re-exported from schema.ts.
  const barrelSource = (): string => readFileSync(join(REPO_ROOT, BARREL), "utf8");

  test("AC-2: every statement in the barrel is a re-export", () => {
    const code = lex(barrelSource(), "ts").code;
    const statements = code
      .split(";")
      .map((statement) => statement.replace(/\s+/g, " ").trim())
      .filter((statement) => statement !== "");
    // `export type { … } from` is the same re-export said of types alone, so it is a barrel line too.
    const strays = statements.filter((statement) => !/^export (?:type )?(?:\*|\{[^}]*\}) from$/.test(statement));
    expect(strays, `${BARREL} still does work of its own — a barrel holds re-exports and nothing else`).toEqual([]);
    expect(statements.length, `${BARREL} re-exports nothing at all`).toBeGreaterThan(0);
  });

  test("AC-2: the barrel names only ./db/ modules and the driver", () => {
    // The lexer blanks a literal out of the code mask, so the specifiers are read from the run of
    // strings it collected — in a pure barrel there is nothing else a string could be.
    const specifiers = lex(barrelSource(), "ts").strings;
    const strays = specifiers.filter((specifier) => !/^\.\/db\/[a-z-]+$/.test(specifier) && specifier !== "drizzle-orm");
    expect(strays, `${BARREL} still reaches outside src/core/db/ — the modules it re-exports live there`).toEqual([]);
    expect(
      specifiers.filter((specifier) => specifier === "drizzle-orm").length,
      "the driver is named once, for the query operators, or not at all",
    ).toBe(1);
  });

  test("AC-2: the one drizzle-orm line hands out exactly the eight operators", () => {
    const code = lex(barrelSource(), "ts").code;
    const lists = [...code.matchAll(/export \{([^}]*)\} from/g)].map((match) =>
      (match[1] ?? "")
        .split(",")
        .map((name) => name.replace(/\btype\b/, "").trim())
        .filter((name) => name !== ""),
    );
    const operatorList = lists.find((list) => list.includes("and"));
    expect(operatorList, "no re-export hands out the query operators").toBeDefined();
    expect([...(operatorList ?? [])].sort(), "the operator line is exactly the eight the seam hands out").toEqual([...OPERATORS].sort());
  });

  test("AC-2: the barrel spells none of the work that moved out", () => {
    const source = barrelSource();
    const code = lex(source, "ts").code;
    const spelled = ["pgTable(", "postgres(", "drizzle(", "new PgBoss"].filter((token) => code.includes(token));
    expect(spelled, `${BARREL} still builds tables, pools or a queue — that work lives in src/core/db/ now`).toEqual([]);
    // The lock is spelled inside a SQL literal, which the code mask blanks — so it is looked for in
    // the file as written, where a leftover copy would actually sit.
    expect(source.includes("pg_advisory_xact_lock"), `${BARREL} still spells the advisory lock — it has one home now`).toBe(false);
  });

  test.each(HOMES)("AC-2: $module exports the names the goal gives it, and the barrel hands out those very values", async ({ module, names }) => {
    const home = await moduleAt(module);
    const barrel = await moduleAt(BARREL);
    const missing = names.filter((name) => !Object.hasOwn(home, name));
    expect(missing, `${module} does not export the names the goal puts there`).toEqual([]);
    const strangers = names.filter((name) => home[name] !== barrel[name]);
    expect(strangers, `the barrel hands out a different value than ${module} exports — one name, one home (B-17)`).toEqual([]);
  });
});

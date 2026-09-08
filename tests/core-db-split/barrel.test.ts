// @vitest-environment node
/**
 * Public acceptance for AC-1 and AC-2 of the db module split (SEAM-TENANT, ARCH-02, B-17).
 *
 * AC-1 is the "loses nothing" half. EXPORTS_BEFORE is the export roster `git show main:src/core/db.ts`
 * declares — every `export const|function|type|interface|{…}` name, values and types alike. It is
 * frozen here because that roster IS the barrel's contract: every importer in the tree reads these
 * names from `@/core/db`, so a name the split drops is a broken tree. The other direction is a
 * DERIVATION rather than a second transcription (arbitration, settled): a name the barrel adds is
 * refused unless the schema tree itself publishes that very object, so the tables the Bible
 * schedules — a stored partition stage is a table (R-TO-030, L-CAD-08) — are admitted by
 * `SEAM_SCHEMA` as they land, and a name of the barrel's own invention still is not.
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
 *
 * Arbitration (settled, on this file's AC-2 statement check): no clause speaks to the SYNTACTIC FORM
 * in which a name leaves the barrel — only that it is exported. Registry-loss over this file is
 * therefore state-scoped to RUNTIME names, which the value half above reads off the namespace; a name
 * whose spelling is a type is judged by the compile-time reference and by nothing else, so no
 * assertion here may require it to leave in a shape a scanner happens to lex. What the statement
 * check below reads is the one thing AC-2 does state — that every statement is a re-export and none
 * is work of the barrel's own — and it counts every spelling of one deliberately: `export * from`,
 * `export { v } from`, `export type { T } from`, an inline `type T` specifier inside a value
 * re-export, and the `as` alias in any of them.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
// white-box: AC-2 — "src/core/db.ts holds re-exports and nothing else" is a property of that file's
// TEXT and of nothing it does: a barrel and a 2,264-line seam answer every call identically, which
// is why the criterion names this lexer by path. The tree's one lexer reads it (B-17), so the check
// is on code with comments and literals resolved, never on a regex over prose.
import { lex } from "../support/source-lex";

/** The checkout this suite runs against. */
const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** The barrel itself — the one path every importer in the tree names. */
const BARREL = "src/core/db.ts";

/** Where the tables live, and where the roster the barrel's additions are derived from is published. */
const SCHEMA_MODULE = "src/core/db/schema.ts";

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
  // The stored partition's three tables (inc-200): listed because "the barrel loses nothing" holds
  // the tree to still handing them out. A table that lands LATER needs no line here — the other
  // half derives its admissions from the schema tree.
  partitionViews: "object",
  viewAssignments: "object",
  viewTypeConfirmations: "object",
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

/**
 * One export specifier as any lawful spelling writes it: a name, optionally prefixed `type` (an
 * inline type specifier inside a value re-export), optionally renamed with `as`. Counting the `type`
 * prefix and the alias is the settled reading — a type handed out inline is handed out.
 */
const SPECIFIER = String.raw`(?:type )?[A-Za-z_$][A-Za-z0-9_$]*(?: as [A-Za-z_$][A-Za-z0-9_$]*)?`;

/**
 * A statement that only re-exports: a star, a braced list of specifiers, or the same list said of
 * types alone. Nothing else — a declaration, a call, an import the barrel then re-exports — matches,
 * which is what "a barrel holds re-exports and nothing else" means as a property of the text. The
 * lexer blanks the module specifier's literal, so a lawful statement ends at its `from`.
 */
const RE_EXPORT = new RegExp(String.raw`^export (?:\*|(?:type )?\{ *(?:${SPECIFIER} *, *)*${SPECIFIER} *,? *\}) from$`);

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

  test("AC-1: the barrel adds no public name of its own invention", async () => {
    const barrel = await moduleAt(BARREL);
    const schema = await moduleAt(SCHEMA_MODULE);
    const published = (schema["SEAM_SCHEMA"] ?? {}) as Record<string, unknown>;
    expect(Object.keys(published).length, `${SCHEMA_MODULE} publishes SEAM_SCHEMA — the roster this admission is derived from`).toBeGreaterThan(0);

    // Admitted on IDENTITY, never on spelling: a name the barrel hands out is allowed past this
    // check only where it IS the very object the schema tree publishes under it, so a table the
    // Bible schedules joins the roster as it lands and a name the barrel minted itself cannot.
    const added = Object.keys(barrel).filter((name) => !Object.hasOwn(VALUES_BEFORE, name) && !(Object.hasOwn(published, name) && barrel[name] === published[name]));
    expect(added, "the split published a name that is neither main's nor the schema tree's own — the barrel invents no public surface (ARCH-02, B-17)").toEqual([]);
  });

  test("AC-1: the type roster is referenced through the barrel, exactly", () => {
    // The reference itself is the assertion and it happens at compile time; what is checked here is
    // that the value roster and the compile-time roster name the same types, so neither can be
    // quietly trimmed on its own. This is the WHOLE instrument for the type half (settled): a type is
    // gone when `import("../../src/core/db").<Name>` no longer resolves and `tsc --noEmit` says so,
    // whatever spelling — `export type { … } from`, an inline `type` specifier, a star — carried it
    // out of the barrel.
    expect(UNLISTED_TYPES, "a type is referenced through the barrel but missing from TYPE_NAMES").toEqual([]);
    // A repeated name would let a dropped one hide behind a listing that still looks complete.
    expect(new Set(TYPE_NAMES).size, "the type roster repeats a name").toBe(TYPE_NAMES.length);
  });
});

describe("AC-2: src/core/db.ts is a barrel over src/core/db/", () => {
  // white-box: AC-2 — no call the barrel answers can tell whether a table was defined in it or
  // re-exported from schema.ts, so the criterion is stated about the file as written.
  const barrelSource = (): string => readFileSync(join(REPO_ROOT, BARREL), "utf8");

  test("AC-2: every statement in the barrel is a re-export", () => {
    const code = lex(barrelSource(), "ts").code;
    const statements = code
      .split(";")
      .map((statement) => statement.replace(/\s+/g, " ").trim())
      .filter((statement) => statement !== "");
    // Every spelling of a re-export is a barrel line, by the settled reading: `export type { … } from`
    // is the same re-export said of types alone, and `export { v, type T as U } from` hands out a
    // value and a type on one line. What is asked is whether the statement does work of its own.
    const strays = statements.filter((statement) => !RE_EXPORT.test(statement));
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

    // white-box: AC-2 — `export { closePools } from "./seam"` gives pools.ts the same own key and the
    // same `===` value the real home would, so the two are indistinguishable through any call. What
    // separates them is whether this module DECLARES the name, which only its own code can say.
    const code = lex(readFileSync(join(REPO_ROOT, module), "utf8"), "ts").code;
    const forwarded = names.filter((name) => !new RegExp(`\\b(?:const|let|var|function|class)\\s+${name}\\b`).test(code));
    expect(forwarded, `${module} forwards a name the goal makes it the home of — a re-export shim is not the single-purpose module`).toEqual([]);
  });
});

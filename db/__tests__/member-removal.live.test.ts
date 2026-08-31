/**
 * AC-1: removal refused while the member holds acts, driven live (R-SPINE-003, SEAM-ACT, V-DB).
 *
 * SEAM-ACT puts tenant administration outside the act log's writ "under their own guards plus the
 * MEMBER_HAS_ACTS coupling". This file grades that coupling at the one guarded entry every
 * tenant-administration mutation comes through, against a real database:
 *
 *   * an OWNER removing a MEMBER who has authored a row in the acting tenant's act log is refused,
 *     and the refusal is the registered one — `refusalCodeOf` reads MEMBER_HAS_ACTS off the marker;
 *   * the membership survives the refusal, and the tenant's act log is exactly as long afterwards
 *     as it was before, because tenant administration writes no act row either way;
 *   * structurally, the coupling reaches the log only through the act seam's exported read — no
 *     file of the removal module imports the acts table object or a database driver, and one of
 *     them names `actsHeldBy` off the `src/core/acts` barrel.
 *
 * The people are real accounts through the shipped sign-up door and the act is a real row in the
 * log, staged by db/__tests__/support/removal-stage.ts, which both this suite and the held-out set
 * are driven from — the identities are declared once there and imported here (B-19).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  admitsEveryone,
  guardedEntry,
  MEMBER_HAS_ACTS,
  openStage,
  outcomeOf,
  refusalCode,
  REMOVAL_MODULE,
  REPO_ROOT,
  requestFrom,
  ROLE_MEMBER,
  type Person,
  type Stage,
} from "./support/removal-stage";

/* ------------------------------------------------------------------ the live stage */

type Staged = { stage: Stage; owner: Person; author: Person };

let opened: Stage | undefined;
let staging: Promise<Staged> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Staged> =>
  (staging ??= (async () => {
    const stage = await openStage();
    opened = stage;
    const owner = await stage.enrol("removal-owner");
    const author = await stage.enrol("removal-author");
    stage.join(owner.tenantId, author, ROLE_MEMBER);
    // One act of the acting tenant, authored by the member the case below reaches for.
    await stage.seedAct({ tenantId: owner.tenantId, actorId: author.userId, subjectIds: [] });
    return { stage, owner, author };
  })());

afterAll(async () => {
  await opened?.drop();
});

/* ------------------------------------------------------------------ reading the removal module */

const SOURCE = /\.(?:ts|tsx|mts)$/;

/** Every source file of a directory tree, so a file the module grows is judged the day it lands (B-19). */
function sourceFilesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFilesUnder(path));
    else if (SOURCE.test(entry.name) && !entry.name.endsWith(".d.ts")) found.push(path);
  }
  return found;
}

/** A file's code with its comments taken out, so a mention in prose is never read as an import. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)\/\/[^\n]*/g, "$1");
}

type ImportRef = { specifier: string; names: string[] };

const identifiersIn = (clause: string): string[] => [...clause.matchAll(/[A-Za-z_$][\w$]*/g)].map((match) => match[0]);

/** What a file imports: the specifier, and the names it binds from it. */
function importsOf(source: string): ImportRef[] {
  const refs: ImportRef[] = [];
  for (const match of source.matchAll(/(?:import|export)\s+([^;]*?)\s*from\s*["']([^"']+)["']/g)) {
    refs.push({ specifier: match[2] ?? "", names: identifiersIn(match[1] ?? "") });
  }
  for (const match of source.matchAll(/(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    refs.push({ specifier: match[1] ?? "", names: [] });
  }
  for (const match of source.matchAll(/(?:^|[;{}\s])import\s+["']([^"']+)["']/g)) {
    refs.push({ specifier: match[1] ?? "", names: [] });
  }
  return refs;
}

/**
 * A database driver or ORM entry point, in the same terms the shipped lint rule states the ban in
 * (scripts/eslint/rules/no-db-outside-seam.mjs) — a handle is made inside the seam and nowhere else.
 */
const DRIVER = /^(?:drizzle-orm|pg|pg-native|pg-pool|postgres|postgres-js|node-postgres|knex|kysely|typeorm|prisma|@prisma\/|@neondatabase\/|@vercel\/postgres|@electric-sql\/pglite)(?:\/|$)/;

/** The act seam's barrel, however a file inside `src/` spells its way to it. */
const ACTS_BARREL = /(?:^|\/)core\/acts$/;

/** The act log's table object — importable only from the seam, and not by this module (AC-1). */
const ACTS_TABLE = "acts";

/* ------------------------------------------------------------------ the criterion */

describe("AC-1: a member who holds acts in the acting tenant is not removed", () => {
  it("AC-1: the guarded entry answers MEMBER_HAS_ACTS, keeps the membership and writes no act row", async () => {
    const { stage, owner, author } = await staged();

    expect(stage.membershipCount(owner.tenantId, author.userId), "the subject of this case is on the workspace before it runs").toBe(1);
    expect(
      stage.actIdsHeldBy(owner.tenantId, author.userId).length,
      "the subject has authored at least one row in the acting tenant's act log, so the coupling has something to refuse for",
    ).toBeGreaterThan(0);
    const actsBefore = stage.actCount(owner.tenantId);

    const entry = await guardedEntry(stage, admitsEveryone);
    const outcome = await outcomeOf(
      entry(requestFrom({ tenantId: owner.tenantId, userId: owner.userId }), { kind: "removeMember", subjectUserId: author.userId }),
    );

    expect(
      outcome.rejected,
      `the guarded entry removed a member who holds recorded acts in the acting tenant — R-SPINE-003 refuses that removal, it does not carry it out (answer: ${JSON.stringify(
        outcome.rejected ? null : outcome.answer,
      )})`,
    ).toBe(true);

    const code = outcome.rejected ? await refusalCode(stage, outcome.error) : null;
    expect(
      code,
      `the removal was refused, but not as the registered refusal: refusalCodeOf(...) read ${JSON.stringify(code)} rather than ${MEMBER_HAS_ACTS}. A refusal is an answer the taxonomy holds, marked so the fault seam can tell it from a fault (R-SPINE-062, ARCH-03, B-21) — the error said: ${String(
        outcome.rejected ? ((outcome.error as { message?: unknown })?.message ?? outcome.error) : "",
      ).slice(0, 400)}`,
    ).toBe(MEMBER_HAS_ACTS);

    expect(
      stage.membershipCount(owner.tenantId, author.userId),
      "a refused removal takes nothing off the roster — the member the entry refused to remove still holds their membership",
    ).toBe(1);
    expect(
      stage.actCount(owner.tenantId),
      "SEAM-ACT: tenant administration writes no act row, so a removal it refused left the tenant's act log exactly as long as it found it",
    ).toBe(actsBefore);
  }, 300_000);

  it("AC-1: the coupling reads the act log only through actsHeldBy on the act seam", () => {
    const home = join(REPO_ROOT, REMOVAL_MODULE);
    expect(
      existsSync(home),
      `${REMOVAL_MODULE}/ is missing — the coupling predicate has its own module, whose only view of the act log is the seam's exported read (ARCH-02)`,
    ).toBe(true);

    const files = sourceFilesUnder(home);
    expect(files.length, `${REMOVAL_MODULE}/ holds no source file, so nothing there can hold the coupling`).toBeGreaterThan(0);

    const reaching: string[] = [];
    for (const file of files) {
      const where = relative(REPO_ROOT, file).split("\\").join("/");
      for (const ref of importsOf(code(file))) {
        expect(
          DRIVER.test(ref.specifier),
          `${where} imports "${ref.specifier}" — a database driver. The removal module reads the act log through the seam's exported read and holds no handle of its own (SEAM-TENANT, AC-1)`,
        ).toBe(false);
        expect(
          ref.names,
          `${where} imports the act log's table object from "${ref.specifier}" — the coupling's only view of the log is actsHeldBy on src/core/acts, never the table or a query over it (ARCH-02, AC-1)`,
        ).not.toContain(ACTS_TABLE);
        if (ACTS_BARREL.test(ref.specifier) && ref.names.includes("actsHeldBy")) reaching.push(where);
      }
    }

    expect(
      reaching,
      `no file under ${REMOVAL_MODULE}/ names actsHeldBy off the src/core/acts barrel — the act log has one exported read and the coupling reaches it through that read (ARCH-02, AC-1)`,
    ).not.toEqual([]);
  });
});

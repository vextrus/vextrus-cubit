/**
 * AC-1: one home for invitations (B-17, ARCH-02, R-SPINE-006).
 *
 * The criterion is about WHERE the invariant lives, so the assertions here are about the tree: the
 * barrel that publishes the doors, the module directory that implements them, the guard every
 * mutation is judged by, the one mail home the invitation leaves through, and the refusing tests the
 * module owes each guard the day it ships them.
 *
 * Every rule is derived rather than frozen (B-19): no file list, no export count and no roster of
 * callers is written down here — each assertion asks the tree a question a later increment's honest
 * growth still answers the same way. The behaviour these doors have when a person drives them is
 * graded live, in `invitations-live.test.ts` and by the journeys; what is graded here is that there
 * is exactly one place it can come from.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { isExecutedTest } from "../refusal-register/scan";
import {
  ACCEPT_ROUTE_DIR,
  BARREL_EXPORTS,
  BARREL_TYPE,
  CODE,
  MAIL_KIND,
  MEMBERS_ROUTE_DIR,
  MODULES,
  TENANCY_MODULE_DIR,
  balancedSpanAt,
  callIndices,
  codeOf,
  enclosingBlocks,
  expectStatements,
  importSpecifiersOf,
  importsOf,
  inRepo,
  modulesPublishing,
  productModule,
  repoRelative,
  requireModule,
  resolveSpecifierFile,
  resolvedFrom,
  sourceFilesUnder,
  testFilesUnder,
} from "./support/invitations-contract";

/** The doors that MOVE something — the reads are not guarded mutations, and are not judged as such. */
const MUTATIONS = BARREL_EXPORTS.filter((name) => name !== "pendingInvitations");

/** The guarded entry every tenant-administration mutation comes through (the shipped one). */
const GUARD = "guardTenancyMutation";

/** The four guards R-SPINE-006 and AC-1 name, by the registered code each one refuses with. */
const GUARD_CODES = ["ORIGIN_NOT_VERIFIED", "RATE_LIMITED", "WORKSPACE_PERMISSION_NOT_HELD", CODE] as const;

const srcFiles = (): string[] => sourceFilesUnder(inRepo("src"));

/**
 * Where a file SPENDS the guarded entry: every call it makes to a binding of it. A binding is one
 * bound from `guardTenancyMutation(…)` — in this file, or in a file this one imports the binding
 * from (the shipped seams bind it once at module scope and spend it per move) — and the file that
 * binds it imports the entry from a module that publishes it, so a local function that borrowed the
 * name is not mistaken for the guard, and a comment naming it is not a call.
 */
function guardCalls(file: string, code: string, publishers: Set<string>): number[] {
  const bindsTheEntry = (source: string, from: string): boolean =>
    importsOf(source).some(({ clause, specifier }) => {
      const landed = resolvedFrom(from, specifier);
      return landed !== null && publishers.has(landed) && new RegExp(`\\b${GUARD}\\b`).test(clause);
    });
  const boundNames = (source: string): string[] =>
    [...source.matchAll(new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*=\\s*(?:await\\s+)?${GUARD}\\s*\\(`, "g"))].map((match) => match[1] ?? "").filter((name) => name !== "");

  const names: string[] = [];
  if (bindsTheEntry(code, file)) names.push(...boundNames(code), GUARD);
  for (const { clause, specifier } of importsOf(code)) {
    const home = resolveSpecifierFile(file, specifier);
    if (home === null) continue;
    const homeCode = codeOf(home);
    if (!bindsTheEntry(homeCode, home)) continue;
    for (const name of boundNames(homeCode)) if (new RegExp(`\\b${name}\\b`).test(clause)) names.push(name);
  }

  return [...new Set(names)].flatMap((name) => callIndices(code, name));
}

/**
 * Is a move JUDGED where it is made? Two shapes count, and both are the shipped seams' own: the move
 * is handed to the guarded entry as an argument (`guarded(request, mutationFrom(…))`), or it is made
 * in the same body the entry is spent in — the members seam names its mutation on one line and
 * spends it on the next, and nothing moves until the entry runs. A guard called in some other
 * function, or named only in a comment, judges nothing here.
 */
function judgedAt(code: string, at: number, spends: number[]): boolean {
  const spansOf = (call: number): [number, number][] => {
    const [open, close] = balancedSpanAt(code, call);
    // Spent curried — `guardTenancyMutation({…})(request, move)` — the call after it is the wrap.
    const next = /^\s*\(/.exec(code.slice(close + 1));
    return next === null ? [[open, close]] : [[open, close], balancedSpanAt(code, close + next[0].length)];
  };
  if (spends.flatMap(spansOf).some(([open, close]) => at > open && at < close)) return true;
  const blocks = enclosingBlocks(code, at);
  return spends.some((call) => blocks.some(([open, close]) => call > open && call < close));
}

/** Where each invitation door may be imported FROM, derived from the tree rather than spelled. */
function doorPublishers(): Map<string, Set<string>> {
  return new Map(BARREL_EXPORTS.map((door) => [door, modulesPublishing(door)] as const));
}

/**
 * Where a file CALLS an invitation door: the local name the door was imported under — statically,
 * or destructured off a dynamic import — resolved through the modules that publish it. A local
 * helper that borrowed the name, and a door named in a comment, are not calls to the product.
 */
function doorCalls(file: string, code: string, publishers: Map<string, Set<string>>): number[] {
  const names: string[] = [];
  const bind = (clause: string, landed: string | null): void => {
    if (landed === null) return;
    for (const [door, homes] of publishers) {
      if (!homes.has(landed)) continue;
      const bound = new RegExp(`\\b${door}\\b(?:\\s+as\\s+([A-Za-z_$][\\w$]*))?`).exec(clause);
      if (bound !== null) names.push(bound[1] ?? door);
    }
  };
  for (const { clause, specifier } of importsOf(code)) bind(clause, resolvedFrom(file, specifier));
  for (const match of code.matchAll(/\{([^}]*)\}\s*=\s*(?:await\s+)?(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    bind(match[1] ?? "", resolvedFrom(file, match[2] ?? ""));
  }
  return [...new Set(names)].flatMap((name) => callIndices(code, name));
}

/** The `test(…)`/`it(…)` body an index sits in — the case a refusal has to have been made inside. */
function enclosingCase(code: string, at: number): [number, number] | null {
  const spans = [...code.matchAll(/\b(?:test|it)\s*(?:\.\w+)*\s*\(/g)]
    .map((match) => balancedSpanAt(code, (match.index ?? 0) + match[0].length - 1))
    .filter(([open, close]) => at > open && at < close);
  return spans.length === 0 ? null : spans.reduce((tightest, span) => (span[1] - span[0] < tightest[1] - tightest[0] ? span : tightest));
}

/**
 * Does this assertion grade a VALUE — something the program produced — rather than a literal
 * standing on its own? `expect("RATE_LIMITED").toBe("RATE_LIMITED")` names a refusal and proves
 * none: nothing was asked, so nothing refused.
 */
function gradesAValue(statement: string): boolean {
  const open = statement.indexOf("(");
  if (open < 0) return false;
  const [from, to] = balancedSpanAt(statement, open);
  const subject = statement
    .slice(from + 1, to)
    .replace(/^\s*await\s+/, "")
    .trim();
  return subject !== "" && !/^(["'`])[^"'`]*\1$/.test(subject) && !/^-?\d+(?:\.\d+)?$/.test(subject);
}

describe("AC-1: the invitation invariant has exactly one home, and every mutation is judged there", () => {
  test("AC-1: the tenancy barrel publishes the five doors and the pending-invitation type", async () => {
    const barrel = await productModule<Record<string, unknown>>(MODULES.barrel);
    for (const door of BARREL_EXPORTS) {
      expect(typeof barrel[door], `src/modules/spine/tenancy exports ${door} — every caller reaches invitations through the barrel (ARCH-02)`).toBe("function");
    }
    // A type is not a value: the barrel's own source is where a re-exported type can be seen at all.
    const text = readFileSync(inRepo(MODULES.barrel), "utf8");
    expect(text.includes(BARREL_TYPE), `the barrel re-exports type ${BARREL_TYPE} — the interfaces line publishes it beside the doors`).toBe(true);
  });

  test("AC-1: the doors are implemented under the module's invitations home, and published from there", () => {
    const home = requireModule(MODULES.invitationsHome);
    expect(sourceFilesUnder(home).length, `${MODULES.invitationsHome}/ holds the implementation — a barrel line over an empty directory is not a home (B-17)`).toBeGreaterThan(0);

    const barrel = inRepo(MODULES.barrel);
    const lines = readFileSync(barrel, "utf8").split("\n");
    for (const door of BARREL_EXPORTS) {
      const publishing = lines.filter((line) => line.includes("export") && new RegExp(`\\b${door}\\b`).test(line));
      expect(publishing.length, `the barrel publishes ${door}`).toBeGreaterThan(0);
      const fromHome = publishing.some((line) =>
        [...line.matchAll(/from\s*["']([^"']+)["']/g)].some((match) => {
          const landed = resolvedFrom(barrel, match[1] ?? "");
          return landed !== null && (landed === MODULES.invitationsHome || landed.startsWith(`${MODULES.invitationsHome}/`));
        }),
      );
      expect(fromHome, `${door} is published from ${MODULES.invitationsHome}/ — the invariant is implemented in one place and re-exported, never re-authored beside the barrel (B-17)`).toBe(true);
    }
  });

  test("AC-1: no file outside the tenancy module reaches the invitation store", () => {
    const trespassing: string[] = [];
    for (const file of srcFiles()) {
      const relative = repoRelative(file);
      if (relative.startsWith(`${TENANCY_MODULE_DIR}/`)) continue;
      for (const specifier of importSpecifiersOf(file)) {
        const landed = resolvedFrom(file, specifier);
        if (landed !== null && (landed === MODULES.invitationsHome || landed.startsWith(`${MODULES.invitationsHome}/`))) trespassing.push(`${relative} → ${specifier}`);
      }
    }
    expect(
      trespassing,
      `these files reach inside ${MODULES.invitationsHome}/ — everything outside the module comes through the barrel, so the store has one reader (B-17, ARCH-02)`,
    ).toEqual([]);
  });

  test("AC-1: no file outside the tenancy module mints invitation rows", () => {
    // The store's own table, as the schema names it — derived from db/schema rather than spelled
    // here, so the rule survives whatever the Builder calls the export.
    const schemaSymbols = new Set<string>();
    for (const file of sourceFilesUnder(inRepo("db/schema"))) {
      for (const match of readFileSync(file, "utf8").matchAll(/export\s+const\s+([A-Za-z0-9_]*[Ii]nvitation[A-Za-z0-9_]*)\s*=/g)) {
        if (match[1] !== undefined) schemaSymbols.add(match[1]);
      }
    }
    expect(schemaSymbols.size, "db/schema declares the invitations table — the interfaces line adds it as an append").toBeGreaterThan(0);

    const minting: string[] = [];
    for (const file of srcFiles()) {
      const relative = repoRelative(file);
      if (relative.startsWith(`${TENANCY_MODULE_DIR}/`) || relative.startsWith("db/")) continue;
      const text = readFileSync(file, "utf8");
      for (const symbol of schemaSymbols) if (new RegExp(`\\b${symbol}\\b`).test(text)) minting.push(`${relative} names ${symbol}`);
    }
    expect(minting, `these files outside ${TENANCY_MODULE_DIR}/ name the invitations table — a row is minted in one place or the invariant has two homes (B-17)`).toEqual([]);
  });

  test("AC-1: every seam that moves an invitation holds the guarded entry, and calls it", () => {
    // Where the entry may be imported from, derived from the tree: its own home, and whatever
    // re-publishes it (the barrel does today) — never a path frozen here (B-19).
    const publishers = modulesPublishing(GUARD);
    expect(publishers.size, `${GUARD} is published somewhere under src/ — it is the shipped entry a tenant-administration mutation is judged by (R-SPINE-006)`).toBeGreaterThan(0);

    // A seam is guarded when it CALLS a binding of the entry — a mention of the name in a comment,
    // or a local function that borrowed the name, is not a guard (comments are stripped below).
    const unguarded: string[] = [];
    for (const file of srcFiles()) {
      const relative = repoRelative(file);
      if (relative.startsWith(`${TENANCY_MODULE_DIR}/`)) continue;
      const code = codeOf(file);
      const moves = MUTATIONS.flatMap((door) => callIndices(code, door).map((at) => ({ door, at })));
      if (moves.length === 0) continue;

      const spends = guardCalls(file, code, publishers);
      const doors = (calls: { door: string }[]): string => [...new Set(calls.map((call) => call.door))].join(", ");
      if (spends.length === 0) {
        unguarded.push(`${relative} calls ${doors(moves)} and calls no ${GUARD} binding at all`);
        continue;
      }
      const outside = moves.filter(({ at }) => !judgedAt(code, at, spends));
      if (outside.length > 0) unguarded.push(`${relative} moves ${doors(outside)} where no ${GUARD} binding is spent`);
    }
    expect(
      unguarded,
      `these files move an invitation without spending it inside ${GUARD} — origin verification and the rate window are not optional for a tenant-administration mutation, and a comment saying the guard is applied elsewhere is not a guard (R-SPINE-006, Q-17)`,
    ).toEqual([]);

    // And the seams this increment opens to a browser hold it themselves. Whether the doors are
    // dispatched by the entry's own union or called behind it, the file a submission lands in is
    // where origin and the allowance are judged — so each new mutation seam is asked for a binding
    // it really invokes, which is the part a scan of names cannot see.
    for (const seam of [`${MEMBERS_ROUTE_DIR}/invitations`, ACCEPT_ROUTE_DIR]) {
      const files = sourceFilesUnder(inRepo(seam));
      expect(files.length, `${seam}/ is the invitation seam this increment authors — the panel's moves and the accept move are asked for there (AC-2, AC-3)`).toBeGreaterThan(0);
      const guarded = files.filter((file) => guardCalls(file, codeOf(file), publishers).length > 0).map(repoRelative);
      expect(
        guarded,
        `no file under ${seam}/ calls a binding of ${GUARD} — the seam a browser submits to is where the origin claim and the door's allowance are judged, before anything moves (AC-1, R-SPINE-006)`,
      ).not.toEqual([]);
    }
  });

  test("AC-1: the invitation mail is a kind the one mail home DECLARES, and no second home sends it", async () => {
    const mail = await productModule<Record<string, unknown>>(MODULES.mail);
    expect(typeof mail["deliver"], "src/server/auth/mail.ts is the mail home the invitation leaves through").toBe("function");

    // The kind union is declared in the mail home's own tier; the assertion is that the tier ADMITS
    // the kind, wherever inside it the union is written — and admitting it means standing among the
    // kinds, not being mentioned near them. Two shapes count, and both are declarations: the kind
    // sits beside a sibling kind in the tier's own list of them (a union `|` or a frozen list `,`),
    // or it labels a branch in a file that delivers. Comments are stripped first (`codeOf`), so a
    // line of prose promising the kind admits nothing (Q-17) — which is the whole point: a mail kind
    // the union does not carry cannot be handed to `deliver`, and one written in a comment can.
    const beside = new RegExp(`["']${MAIL_KIND}["']\\s*[|,]\\s*["']|["'][^"']*["']\\s*[|,]\\s*["']${MAIL_KIND}["']`);
    const branch = new RegExp(`case\\s+["']${MAIL_KIND}["']\\s*:`);
    const declaring = sourceFilesUnder(inRepo("src/server/auth"))
      .map((file) => ({ file: repoRelative(file), code: codeOf(file) }))
      .filter(({ code }) => beside.test(code) || (branch.test(code) && callIndices(code, "deliver").length > 0))
      .map(({ file }) => file);
    expect(
      declaring,
      `no file under src/server/auth DECLARES the mail kind "${MAIL_KIND}" — the invitation is mailed as a kind the one mail home carries in its own union of them (standing beside its siblings), or as a branch that delivers; a kind spelled only in prose is not a kind the mail home admits (B-17, R-SPINE-006, Q-17)`,
    ).not.toEqual([]);

    const senders: string[] = [];
    for (const file of srcFiles()) {
      const relative = repoRelative(file);
      if (relative.startsWith("src/server/auth/")) continue;
      for (const specifier of importSpecifiersOf(file)) {
        const landed = resolvedFrom(file, specifier);
        if (landed === "src/server/auth/mail") senders.push(relative);
      }
    }
    expect(senders, "only the mail home writes the outbox — every other tier is handed a sender, so mail leaves through one door (B-17, ARCH-01)").toEqual([]);
  });

  test("AC-1: each guard has a refusing test beside the module that drives the door and grades what came back", () => {
    const testFiles = testFilesUnder(requireModule(MODULES.moduleTests));
    expect(testFiles.length, `${MODULES.moduleTests}/ holds the module's own tests`).toBeGreaterThan(0);

    // A refusal is proved by ASKING and being told no. Three things have to coincide, and the same
    // machinery that judges the seams above judges them here, so a refusing test is held to what a
    // guarded seam is held to:
    //
    //   1. the case DRIVES the product — it calls a binding of the guarded entry, or one of the
    //      invitation doors, imported from a module that publishes it (never a local look-alike);
    //   2. that call stands before the assertion finishes, so the value graded is what came back;
    //   3. the assertion grades a VALUE, not a literal of its own — `expect("RATE_LIMITED")
    //      .toBe("RATE_LIMITED")` names a refusal nobody made (Q-17, TEST_INTEGRITY).
    //
    // Nothing here says which door refuses which way, how many cases a file holds, or what the
    // rejection is shaped like: a thrown entry, a rejected promise and a returned refusal all pass,
    // and a later guard added to the same file passes the same way (B-19).
    const guardHomes = modulesPublishing(GUARD);
    const doors = doorPublishers();

    const asserting = new Map<string, string[]>();
    const inert = new Map<string, string[]>();
    for (const file of testFiles) {
      const source = codeOf(file);
      const relative = repoRelative(file);
      const drives = [...guardCalls(file, source, guardHomes), ...doorCalls(file, source, doors)];
      for (const statement of expectStatements(source)) {
        const at = source.indexOf(statement);
        const named = GUARD_CODES.filter((code) => statement.includes(code));
        if (named.length === 0) continue;
        const span = enclosingCase(source, at);
        const asked = span !== null && drives.some((call) => call > span[0] && call < span[1] && call < at + statement.length);
        const where = asked && gradesAValue(statement) ? asserting : inert;
        for (const code of named) where.set(code, [...(where.get(code) ?? []), relative]);
      }
    }

    for (const code of GUARD_CODES) {
      const named = asserting.get(code) ?? [];
      expect(
        named,
        `no test under ${MODULES.moduleTests}/ REFUSES with ${code} — AC-1 owes every guard (origin, rate limit, permission, unclaimable token) a refusing unit test the day the doors ship, and a refusing test is one that calls ${GUARD} or an invitation door and grades what came back. ${
          (inert.get(code) ?? []).length > 0
            ? `${[...new Set(inert.get(code) ?? [])].join(", ")} names ${code} inside an assertion, but that case asks the product nothing (or grades a literal of its own), so nothing refused (R-SPINE-006, TEST_INTEGRITY)`
            : `nothing names ${code} inside an assertion at all`
        }`,
      ).not.toEqual([]);
      for (const file of new Set(named)) {
        expect(isExecutedTest(inRepo(file)), `${file} asserts ${code} but no armed lane collects it — a refusing test in a lane nothing runs refuses nothing (Q-07)`).toBe(true);
      }
    }
  });
});

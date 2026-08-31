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
  BARREL_EXPORTS,
  BARREL_TYPE,
  CODE,
  MAIL_KIND,
  MODULES,
  TENANCY_MODULE_DIR,
  importSpecifiersOf,
  inRepo,
  productModule,
  repoRelative,
  requireModule,
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

  test("AC-1: every caller of a mutation door is judged by the guarded entry", () => {
    const unguarded: string[] = [];
    for (const file of srcFiles()) {
      const relative = repoRelative(file);
      if (relative.startsWith(`${TENANCY_MODULE_DIR}/`)) continue;
      const text = readFileSync(file, "utf8");
      const calls = MUTATIONS.filter((door) => new RegExp(`\\b${door}\\s*\\(`).test(text));
      if (calls.length > 0 && !text.includes(GUARD)) unguarded.push(`${relative} calls ${calls.join(", ")}`);
    }
    expect(
      unguarded,
      `these files move an invitation without ${GUARD} — origin verification and the rate window are not optional for a tenant-administration mutation (R-SPINE-006)`,
    ).toEqual([]);
  });

  test("AC-1: the invitation mail is a kind the one mail home admits, and no second home sends it", async () => {
    const mail = await productModule<Record<string, unknown>>(MODULES.mail);
    expect(typeof mail["deliver"], "src/server/auth/mail.ts is the mail home the invitation leaves through").toBe("function");

    // The kind union is declared in the mail home's own tier; the assertion is that the tier admits
    // the kind, wherever inside it the union is written.
    const authTier = sourceFilesUnder(inRepo("src/server/auth"));
    const admits = authTier.some((file) => new RegExp(`["']${MAIL_KIND}["']`).test(readFileSync(file, "utf8")));
    expect(admits, `the src/server/auth mail home admits the mail kind "${MAIL_KIND}" — the invitation is mailed as a registered kind, not as a free-form message`).toBe(true);

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

  test("AC-1: each guard has a refusing test beside the module, in a lane that really runs", () => {
    const testFiles = testFilesUnder(requireModule(MODULES.moduleTests));
    expect(testFiles.length, `${MODULES.moduleTests}/ holds the module's own tests`).toBeGreaterThan(0);

    const naming = new Map<string, string[]>();
    for (const file of testFiles) {
      const text = readFileSync(file, "utf8");
      for (const code of GUARD_CODES) if (text.includes(code)) naming.set(code, [...(naming.get(code) ?? []), repoRelative(file)]);
    }
    for (const code of GUARD_CODES) {
      const named = naming.get(code) ?? [];
      expect(
        named,
        `no test under ${MODULES.moduleTests}/ refuses with ${code} — AC-1 owes every guard (origin, rate limit, permission, unclaimable token) a refusing unit test the day the doors ship`,
      ).not.toEqual([]);
      for (const file of named) {
        expect(isExecutedTest(inRepo(file)), `${file} names ${code} but no armed lane collects it — a refusing test in a lane nothing runs refuses nothing (Q-07)`).toBe(true);
      }
    }
  });
});

/**
 * Public acceptance for AC-1 (L-ACT-02, L-ACT-03, SEAM-ACT): the act seam's closed enums and the
 * two total maps that sit beside it.
 *
 * The module is loaded by absolute path rather than by a static specifier — the contract
 * `src/core/errors/taxonomy.test.ts` and `src/core/format.test.ts` already use: a module the
 * product does not provide yet must fail as an assertion naming the file, never as an unreadable
 * resolution error that kills collection.
 *
 * Totality is a COMPILE-TIME fact, so half of this file is types. `typeof import("../index")` is a
 * type position — erased by the test transform, resolved by tsc — which is what lets one `.ts`
 * acceptance file be both a vitest suite and a tsc assertion (tsconfig includes `src/**\/*.ts`).
 *
 * B-19: nothing here freezes the act-type roster. The act-type enum grows increment by increment
 * (this increment's recorded interpretation), so ACT_TYPES is asserted to CONTAIN the one act type
 * this increment ships and is otherwise used as the derivation's own denominator — a later
 * increment that adds an act type passes this file unchanged, and fails it the moment the new
 * member arrives without a rendering or a permission. The permission and role enums are different:
 * L-ACT-03 calls them closed and spells them out, so the exact set IS the rule, not a snapshot.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const ACTS_MODULE = "src/core/acts/index.ts";

/* ------------------------------------------------------------------ *
 * The compile-time half of AC-1: totality over the enum the tree declares.
 * ------------------------------------------------------------------ */

/** The seam's own exported surface, as tsc reads it. Erased before the test transform sees it. */
type Acts = typeof import("../index");

/** The act-type enum as the tree declares it today — the denominator, never a transcription. */
type DeclaredActType = Acts["ACT_TYPES"][number];

/** The permission enum as the tree declares it today. */
type DeclaredPermission = Acts["PERMISSIONS"][number];

/** Wrapped in tuples so a union operand cannot distribute the check into a partial pass. */
type Covers<A, B> = [A] extends [B] ? true : false;

/**
 * L-ACT-02: "The pairs form a total map over the act-type enum (a type without a rendering is a
 * compile error)." If ACT_MAP lacks an entry for any declared act type, `Covers` is `false` and
 * `const … : false = true` is the compile error the law asks for.
 */
export type ActMapIsTotal = Covers<Acts["ACT_MAP"], Record<DeclaredActType, { preview: unknown; commit: unknown }>>;
export const actMapIsTotal: ActMapIsTotal = true;

/** L-ACT-03: "A total map act type → permission sits beside the total act map." */
export type ActPermissionIsTotal = Covers<Acts["ACT_PERMISSION"], Record<DeclaredActType, DeclaredPermission>>;
export const actPermissionIsTotal: ActPermissionIsTotal = true;

/** L-ACT-03: roles bundle permissions, and a role without a bundle is a role nobody can be given. */
export type RolePermissionsIsTotal = Covers<Acts["ROLE_PERMISSIONS"], Record<Acts["ROLES"][number], readonly DeclaredPermission[]>>;
export const rolePermissionsIsTotal: RolePermissionsIsTotal = true;

/* ------------------------------------------------------------------ *
 * The law, spelled as L-ACT-03 spells it.
 * ------------------------------------------------------------------ */

/** L-ACT-03's closed permission enum, in the order the clause cuts it. */
const PERMISSIONS_IN_LAW = [
  "PIN_SET",
  "AUTHOR_LEVEL_STACK",
  "AUTHOR_PROJECT_FACT",
  "MEASURE",
  "SET_BILL_BOUNDARY",
  "ADMINISTER_SAMPLE",
  "ENTER_BLIND_FIGURE",
  "REVIEW",
  "SIGN",
  "ADMINISTER_PROJECT",
  "ADMINISTER_BOOK",
  "PRICE",
  "BID",
] as const;

/** L-ACT-03's shipped roles — "the only thing a human picks". */
const ROLES_IN_LAW = ["MEASURER", "REVIEWER", "LEAD", "ESTIMATOR", "BID_MANAGER", "PRINCIPAL"] as const;

/** The bundles the law fixes by name. PRINCIPAL is derived, not listed: it holds every permission. */
const BUNDLES_IN_LAW: Readonly<Record<string, readonly string[]>> = {
  MEASURER: ["MEASURE", "AUTHOR_PROJECT_FACT", "ENTER_BLIND_FIGURE"],
  REVIEWER: ["REVIEW"],
  LEAD: ["PIN_SET", "AUTHOR_LEVEL_STACK", "SET_BILL_BOUNDARY", "ADMINISTER_SAMPLE", "SIGN"],
  ESTIMATOR: ["PRICE"],
  BID_MANAGER: ["BID"],
};

/** The role the law makes ADMINISTER_PROJECT's only holder. */
const PRINCIPAL = "PRINCIPAL";

/** The one act type this increment ships, and the permission it moves. */
const SHIPPED_ACT_TYPE = "ASSIGN_PARTICIPANT_ROLE";
const SHIPPED_ACT_PERMISSION = "ADMINISTER_PROJECT";

/* ------------------------------------------------------------------ *
 * The runtime half.
 * ------------------------------------------------------------------ */

interface ActsModuleShape {
  ACT_TYPES: readonly string[];
  PERMISSIONS: readonly string[];
  ROLES: readonly string[];
  ACT_PERMISSION: Record<string, string>;
  ROLE_PERMISSIONS: Record<string, readonly string[]>;
  ACT_MAP: Record<string, { preview?: unknown; commit?: unknown } | undefined>;
  preview?: unknown;
  commit?: unknown;
  consequenceDigest?: unknown;
}

async function loadActs(): Promise<ActsModuleShape> {
  const abs = join(REPO_ROOT, ACTS_MODULE);
  expect(
    existsSync(abs) && statSync(abs).isFile(),
    `${ACTS_MODULE} is missing from the checkout — SEAM-ACT's barrel is the sole entry point other increments import`,
  ).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as ActsModuleShape;
}

/** Sorted by code point: cubit/no-raw-intl reads localeCompare as a call into locale machinery. */
const sorted = (values: readonly string[]): string[] => [...values].sort();

describe("AC-1: the act seam's closed enums", () => {
  test("AC-1: src/core/acts/index.ts exports the enums and the maps beside them", async () => {
    const mod = await loadActs();
    expect(Array.isArray(mod.ACT_TYPES), "ACT_TYPES is the act-type enum, as a tuple (L-ACT-02)").toBe(true);
    expect(Array.isArray(mod.PERMISSIONS), "PERMISSIONS is L-ACT-03's closed permission enum").toBe(true);
    expect(Array.isArray(mod.ROLES), "ROLES is L-ACT-03's closed role enum").toBe(true);
    for (const name of ["ACT_PERMISSION", "ROLE_PERMISSIONS", "ACT_MAP"] as const) {
      const held: unknown = mod[name];
      expect(typeof held, `${name} is exported as a map (L-ACT-02, L-ACT-03)`).toBe("object");
      expect(held, `${name} is exported as a map (L-ACT-02, L-ACT-03)`).not.toBeNull();
    }
  });

  test("AC-1: ACT_TYPES contains the act type this increment ships", async () => {
    const mod = await loadActs();
    // Never "equals": the recorded interpretation is that the act-type enum grows increment by
    // increment, so this asserts membership and leaves the roster open (B-19).
    expect(mod.ACT_TYPES, `${SHIPPED_ACT_TYPE} is the act type this increment renders (SEAM-ACT)`).toContain(SHIPPED_ACT_TYPE);
    expect(new Set(mod.ACT_TYPES).size, "ACT_TYPES is an enum: no member appears twice").toBe(mod.ACT_TYPES.length);
  });

  test("AC-1: PERMISSIONS is exactly L-ACT-03's closed permission enum", async () => {
    const mod = await loadActs();
    // Exact, because L-ACT-03 calls this enum closed and spells every member: the set IS the law.
    expect(sorted(mod.PERMISSIONS), "PERMISSIONS must spell L-ACT-03's permission enum verbatim — no more, no fewer").toEqual(sorted(PERMISSIONS_IN_LAW));
  });

  test("AC-1: ROLES is exactly L-ACT-03's shipped roles", async () => {
    const mod = await loadActs();
    expect(sorted(mod.ROLES), "ROLES must spell L-ACT-03's shipped roles verbatim — roles are the only thing a human picks").toEqual(sorted(ROLES_IN_LAW));
  });
});

describe("AC-1: ACT_PERMISSION — the total act type → permission map", () => {
  test("AC-1: ACT_PERMISSION is keyed by exactly the declared act types", async () => {
    const mod = await loadActs();
    expect(sorted(Object.keys(mod.ACT_PERMISSION)), "every declared act type has a permission, and no key names an act type the enum does not hold (L-ACT-03)").toEqual(sorted(mod.ACT_TYPES));
  });

  test("AC-1: every value of ACT_PERMISSION is drawn from the permission enum", async () => {
    const mod = await loadActs();
    for (const actType of Object.keys(mod.ACT_PERMISSION)) {
      expect(mod.PERMISSIONS, `ACT_PERMISSION["${actType}"] must name a permission the closed enum holds`).toContain(mod.ACT_PERMISSION[actType]);
    }
  });

  test(`AC-1: ${SHIPPED_ACT_TYPE} moves ${SHIPPED_ACT_PERMISSION}`, async () => {
    const mod = await loadActs();
    expect(
      mod.ACT_PERMISSION[SHIPPED_ACT_TYPE],
      `L-ACT-03 puts ASSIGN_PARTICIPANT_ROLE under ADMINISTER_PROJECT, and ADMINISTER_PROJECT is deliberately PRINCIPAL-only`,
    ).toBe(SHIPPED_ACT_PERMISSION);
  });
});

describe("AC-1: ROLE_PERMISSIONS — the law's bundles", () => {
  test("AC-1: ROLE_PERMISSIONS is keyed by exactly the declared roles", async () => {
    const mod = await loadActs();
    expect(sorted(Object.keys(mod.ROLE_PERMISSIONS)), "a role without a bundle is a role nobody can be given (L-ACT-03)").toEqual(sorted(mod.ROLES));
  });

  test("AC-1: each named bundle holds exactly the permissions the law bundles into it", async () => {
    const mod = await loadActs();
    for (const [role, bundle] of Object.entries(BUNDLES_IN_LAW)) {
      expect(sorted(mod.ROLE_PERMISSIONS[role] ?? []), `L-ACT-03 bundles ${role} as exactly ${bundle.join(" + ")} — "no shipped role bundles two permissions the law holds apart"`).toEqual(sorted(bundle));
    }
  });

  test("AC-1: PRINCIPAL holds every permission the enum declares", async () => {
    const mod = await loadActs();
    // Derived from PERMISSIONS rather than listed: "PRINCIPAL (all)" must keep meaning "all" as the
    // enum is extended by the book/estimate/bid increments (B-19).
    expect(sorted(mod.ROLE_PERMISSIONS[PRINCIPAL] ?? []), "L-ACT-03: PRINCIPAL holds every permission").toEqual(sorted(mod.PERMISSIONS));
  });

  test(`AC-1: no role other than ${PRINCIPAL} holds ${SHIPPED_ACT_PERMISSION}`, async () => {
    const mod = await loadActs();
    for (const role of Object.keys(mod.ROLE_PERMISSIONS)) {
      if (role === PRINCIPAL) continue;
      expect(
        mod.ROLE_PERMISSIONS[role] ?? [],
        `${role} must not hold ${SHIPPED_ACT_PERMISSION} — L-ACT-03 makes it PRINCIPAL-only so "a project holds at least one PRINCIPAL at every moment" stays load-bearing`,
      ).not.toContain(SHIPPED_ACT_PERMISSION);
    }
  });

  test("AC-1: every bundled permission is drawn from the permission enum", async () => {
    const mod = await loadActs();
    for (const [role, bundle] of Object.entries(mod.ROLE_PERMISSIONS)) {
      for (const permission of bundle) {
        expect(mod.PERMISSIONS, `${role}'s bundle names "${permission}", which the closed permission enum does not hold`).toContain(permission);
      }
    }
  });
});

describe("AC-1: ACT_MAP — the total act map (L-ACT-02)", () => {
  test("AC-1: ACT_MAP is keyed by exactly the declared act types", async () => {
    const mod = await loadActs();
    expect(sorted(Object.keys(mod.ACT_MAP)), "L-ACT-02: the pairs form a total map over the act-type enum").toEqual(sorted(mod.ACT_TYPES));
  });

  test("AC-1: every rendering is a (preview, commit) pair", async () => {
    const mod = await loadActs();
    for (const actType of Object.keys(mod.ACT_MAP)) {
      const rendering = mod.ACT_MAP[actType];
      expect(rendering, `ACT_MAP["${actType}"] holds a rendering`).toBeTruthy();
      expect(typeof rendering?.preview, `L-ACT-02: every act type is a pair, so ACT_MAP["${actType}"].preview is a function`).toBe("function");
      expect(typeof rendering?.commit, `L-ACT-02: every act type is a pair, so ACT_MAP["${actType}"].commit is a function`).toBe("function");
    }
  });

  test("AC-1: the barrel exports the seam's own preview, commit and the one digest home", async () => {
    const mod = await loadActs();
    for (const name of ["preview", "commit", "consequenceDigest"] as const) {
      expect(typeof mod[name], `src/core/acts/index.ts exports ${name} — SEAM-ACT's barrel is the sole entry point, and ARCH-02 puts the consequence digest here and nowhere else`).toBe("function");
    }
  });
});

/**
 * Public acceptance for L-MEA-04's two independent total maps: AC-4.
 *
 * Two things are proved here, in the two ways they are provable. At runtime: each map's key set is
 * exactly KINDS, and neither module reaches for the other — a discipline read out of an algebra (or
 * the reverse) is one map wearing two names, not two independent ones. At compile time: the key
 * sets are checked bidirectionally, so a missing key and an extra key are both `tsc` failures and
 * neither can hide behind `Record<string, string>` (the settled type-level exactness pattern).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ALGEBRA_MODULE, DISCIPLINE_MODULE, REPO_ROOT, loadAlgebra, loadDiscipline, loadKinds, stringRoster } from "./support/wire";

/* ------------------------------------------------------- the compile-time half of AC-4 */

/** A type-level assertion: only `true` satisfies it, so a false answer is a compile error. */
type Expect<T extends true> = T;

/** Exact in both directions — `[A] extends [B]` alone is satisfied by `Record<string, …>` and by `any`. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Kind = import("../kinds").Kind;
type DisciplineMap = (typeof import("../discipline"))["KIND_DISCIPLINE"];
type AlgebraMap = (typeof import("../algebra"))["KIND_ALGEBRA"];

/** KIND_DISCIPLINE's keys are exactly Kind — no kind missing, no key that is not a kind. */
export type DisciplineIsTotalOverKind = Expect<Exact<keyof DisciplineMap, Kind>>;

/** KIND_ALGEBRA's keys are exactly Kind, judged the same way and independently. */
export type AlgebraIsTotalOverKind = Expect<Exact<keyof AlgebraMap, Kind>>;

/* ------------------------------------------------------------ the runtime half of AC-4 */

/** Every module specifier a source file imports from, static and dynamic alike. */
function importSpecifiers(relative: string): string[] {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const source = readFileSync(absolute, "utf8");
  const found: string[] = [];
  for (const match of source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (specifier !== undefined) found.push(specifier);
  }
  return found;
}

/** The last path segment of a specifier, without its extension — how one map would name the other. */
function moduleNameOf(specifier: string): string {
  const tail = specifier.split("/").pop() ?? specifier;
  return tail.replace(/\.(ts|tsx|js|mjs)$/, "");
}

describe("AC-4: kind → discipline and kind → algebra are two independent total maps", () => {
  test("AC-4: KIND_DISCIPLINE is total over Kind and answers a non-empty discipline for each", async () => {
    const { KINDS } = await loadKinds();
    const { KIND_DISCIPLINE } = await loadDiscipline();
    const kinds = [...stringRoster(KINDS, "KINDS")].sort();
    expect(Object.keys(KIND_DISCIPLINE).sort(), "KIND_DISCIPLINE is keyed by exactly the kinds").toEqual(kinds);
    for (const kind of kinds) {
      const discipline = KIND_DISCIPLINE[kind];
      expect(typeof discipline, `KIND_DISCIPLINE[${kind}] names the authoritative discipline as a string`).toBe("string");
      expect(String(discipline).trim(), `KIND_DISCIPLINE[${kind}] must name a discipline`).not.toBe("");
    }
  });

  test("AC-4: KIND_ALGEBRA is total over Kind and answers a non-empty algebra for each", async () => {
    const { KINDS } = await loadKinds();
    const { KIND_ALGEBRA } = await loadAlgebra();
    const kinds = [...stringRoster(KINDS, "KINDS")].sort();
    expect(Object.keys(KIND_ALGEBRA).sort(), "KIND_ALGEBRA is keyed by exactly the kinds").toEqual(kinds);
    for (const kind of kinds) {
      const algebra = KIND_ALGEBRA[kind];
      expect(typeof algebra, `KIND_ALGEBRA[${kind}] names the algebra as a string`).toBe("string");
      expect(String(algebra).trim(), `KIND_ALGEBRA[${kind}] must name an algebra`).not.toBe("");
    }
  });

  test("AC-4: neither map is derived from the other — no import between the two modules", async () => {
    const disciplineImports = importSpecifiers(DISCIPLINE_MODULE).map(moduleNameOf);
    const algebraImports = importSpecifiers(ALGEBRA_MODULE).map(moduleNameOf);
    expect(disciplineImports, `${DISCIPLINE_MODULE} must not import the algebra map — the two are independent (L-MEA-04)`).not.toContain("algebra");
    expect(algebraImports, `${ALGEBRA_MODULE} must not import the discipline map — the two are independent (L-MEA-04)`).not.toContain("discipline");

    const { KIND_DISCIPLINE } = await loadDiscipline();
    const { KIND_ALGEBRA } = await loadAlgebra();
    expect(KIND_DISCIPLINE === KIND_ALGEBRA, "KIND_DISCIPLINE and KIND_ALGEBRA are two exports, not one object under two names").toBe(false);
  });
});

/**
 * AC-3 of the src/core debt sweep: one invariant, one home (B-17, ARCH-02).
 *
 * Five primitives that were spelled twice, or spelled in a place that made a second spelling
 * inevitable: the decimal-figure grammar, the density roster, the edition digest's key grammar, the
 * seed's area unit and the packaging-factor type.
 *
 * "One home" is observable wherever the copy can be told from the original by a call: the two
 * decimal-figure spellings are one home when they are the identical function object, and the seed
 * reads the canon rather than spelling it when a substituted canon moves the seed with it. Only
 * where the second spelling is erased before anything runs — a type alias, an `as const`, a comment
 * — is the text read, and each such read is declared on the line above it.
 *
 * AC-3(a) (the proposal mark) and AC-3(c) (the canonical JSON spelling) live in
 * src/core/model/proposal-and-canonical-homes.test.ts: L-AI-01 makes src/core/model/ the one place
 * the seam's interior may be named, so no suite outside it can load those two modules at all.
 *
 * Every not-yet-existing member is reached through a namespace import and asserted present before
 * it is used, so a home the Builder has not moved yet fails as this file's own assertion naming the
 * module rather than as a link error that takes the whole suite with it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";
import { refusalCodeOf } from "./faults/refusal-marker";
import { formatUserFigure } from "./format";
import { DENSITIES, isDensity, type Density } from "./prefs/density";
import { CANONICAL_UNITS, type ProductFactors } from "./units/canon";
import type { EditionContent } from "./rulesets/editions/content";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

const FORMAT_MODULE = "src/core/format.ts";
const PROJECTS_MODULE = "src/core/projects.ts";
const SEED_MODULE = "src/core/rulesets/seed/index.ts";
const CANON_MODULE = "src/core/units/canon.ts";

/** L-FMT-02's one answer to "nearly right" and "not a number" alike. */
const PRECISION_NOT_APPLIED = "PRECISION_NOT_APPLIED";

/** The seed edition's stored key (L-MEA-01), frozen by db/migrations/0004 — the sweep may not move it. */
const SEED_DIGEST = "5375a56e22eb7fe97646b3eca2d50036c7c7cc1fd3aca7213295ac91d188130e";

/** The two separators the canonical content is joined on, which no key of an edition may carry. */
const SEPARATORS = [String.fromCharCode(0x1e), String.fromCharCode(0x1f)];

/** A unit no canon of this product spells, so a seed following it is following the canon and nothing else. */
const SUBSTITUTED_AREA = "square-nothing";

/* ------------------------------------------------------------------ *
 * Compile-time acceptance (graded by `tsc --noEmit`, which reads src/**\/*.ts). A type is erased
 * before anything runs, so the type checker is the only thing that can observe these two.
 * ------------------------------------------------------------------ */

type Expect<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
/** A roster whose length is `number` is an array of a spelled union; a tuple's length is its own. */
type IsTuple<T extends readonly unknown[]> = number extends T["length"] ? false : true;

/** AC-3(d): the roster is a tuple, so the union can be read off it rather than spelled beside it. */
export type TheDensityRosterIsATuple = Expect<IsTuple<typeof DENSITIES>>;

/** AC-3(d): and the type is that tuple's members — one home, not two kept in step by hand (B-17). */
export type DensityIsDerivedFromTheRoster = Expect<Equal<Density, (typeof DENSITIES)[number]>>;

/** AC-3(g): the packaging factor is a plain number, not a nominal-looking alias standing in for one. */
export type ProductFactorsIsPlain = Expect<Equal<ProductFactors, { factors?: Record<string, number> }>>;

/** A module's text, asserted present so a missing file names itself rather than reading as empty. */
function textOf(relative: string): string {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it`).toBe(true);
  return readFileSync(absolute, "utf8");
}

/** The value a call threw, or undefined — no bare catch clause of the test's own (ARCH-03). */
const thrownBy = (work: () => unknown): unknown => {
  try {
    work();
    return undefined;
  } catch (thrown) {
    return thrown;
  }
};

describe("AC-3: one invariant, one home", () => {
  test("AC-3(b): isDecimalFigure lives beside USER_FIGURE_SHAPE and agrees with formatUserFigure on every candidate", async () => {
    const format = (await import("./format")) as Record<string, unknown>;
    const projects = (await import("./projects")) as Record<string, unknown>;
    expect(typeof format["isDecimalFigure"], `${FORMAT_MODULE} is the one home of the decimal-figure grammar, beside USER_FIGURE_SHAPE (B-17, ARCH-02)`).toBe("function");
    // Identity, not agreement: the same function object under both names is what makes a second
    // spelling of the grammar impossible, and it is the whole of what "re-exported unchanged" means.
    expect(projects["isDecimalFigure"], `${PROJECTS_MODULE} re-exports that one home unchanged — a second implementation that merely agrees today is the defect (B-17)`).toBe(
      format["isDecimalFigure"],
    );

    const isDecimalFigure = format["isDecimalFigure"] as (value: string) => boolean;
    // Every candidate the spec names, each one a shape the two spellings could disagree on.
    for (const candidate of ["0", "-0.5", "12.50", "00", "1.", ".5", "+1", "1e3", "", " 1"]) {
      const refused = thrownBy(() => formatUserFigure(candidate));
      if (refused !== undefined) {
        expect(refusalCodeOf(refused), `formatUserFigure(${JSON.stringify(candidate)}) refuses as a refusal, never an unmarked throw (ARCH-03)`).toBe(PRECISION_NOT_APPLIED);
      }
      expect(isDecimalFigure(candidate), `isDecimalFigure(${JSON.stringify(candidate)}) is true exactly when formatUserFigure does not refuse it — one grammar, one answer`).toBe(refused === undefined);
    }
  });

  test("AC-3(d): DENSITIES is a tuple and Density is read off it", () => {
    // The runtime half of a criterion the spec states as a compile-time one: the roster is real and
    // every member of it is a mode the store can hold. The derivation itself is erased before this
    // runs, and is graded by the two `Expect<…>` aliases above (tsc).
    expect(Array.isArray(DENSITIES) && DENSITIES.length > 0, "the roster is a non-empty list of the modes R-UI-005 names").toBe(true);
    for (const density of DENSITIES) expect(isDensity(density), `${density} is a mode the store can hold`).toBe(true);
    // Mutual assignability with the DataTable's own spelling is pinned by the merged
    // tests/ui/density-prefs/density-toggle.test.ts AC-3, which src/core may not reach (ARCH-01).
  });

  test("AC-3(e): editionDigest refuses a separator-bearing key, rule id or version, and the seed's digest is unmoved", async () => {
    const content = (await import("./rulesets/editions/content")) as { editionDigest: (content: EditionContent) => string };
    const seed = (await import("./rulesets/seed/index")) as { SEED_EDITION_CONTENT: EditionContent };

    expect(content.editionDigest(seed.SEED_EDITION_CONTENT), "every lawful digest is unchanged — db/migrations/0004 stored this one (L-MEA-01)").toBe(SEED_DIGEST);

    for (const separator of SEPARATORS) {
      const spelled = `offending${separator}victim`;
      const offenders: Record<string, EditionContent> = {
        "a parameter key": { parameters: { [spelled]: { value: "1", unit: "ratio" } }, methods: [] },
        "a rule id": { parameters: {}, methods: [{ ruleId: spelled, version: "1" }] },
        "a method version": { parameters: {}, methods: [{ ruleId: "rule", version: spelled }] },
      };
      for (const [what, offering] of Object.entries(offenders)) {
        const refused = thrownBy(() => content.editionDigest(offering));
        expect(refused, `${what} carrying U+${separator.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase()} is refused — two editions must never write one canonical line (L-MEA-01)`).toBeInstanceOf(Error);
        const message = (refused as Error).message;
        expect(message, "…and the refusal names the offending key, whole").toContain("offending");
        expect(message, "…whole, including everything past the separator").toContain("victim");
      }
    }
  });

  test("AC-3(f): the seed's area unit follows the unit canon, and its comment no longer blames the document font", async () => {
    const seed = (await import("./rulesets/seed/index")) as { SEED_EDITION_CONTENT: EditionContent };
    const unitsOf = (content: EditionContent): string[] => Object.values(content.parameters).map((parameter) => parameter.unit);
    const areasNow = unitsOf(seed.SEED_EDITION_CONTENT).filter((unit) => unit === CANONICAL_UNITS.AREA);
    expect(areasNow.length, `the seed states its area parameters in the canon's AREA unit (${CANONICAL_UNITS.AREA})`).toBeGreaterThan(0);

    // "Read from the canon" is observable: move the canon and a seed that reads it moves too, while
    // a seed holding its own literal stays where it is. Only the unit strings are read under the
    // substitution — the stored digest is asserted above, against the canon the product really ships.
    vi.resetModules();
    vi.doMock("./units/canon", async (importOriginal) => {
      const actual = await importOriginal<Record<string, unknown>>();
      return { ...actual, CANONICAL_UNITS: Object.freeze({ ...(actual["CANONICAL_UNITS"] as Record<string, string>), AREA: SUBSTITUTED_AREA }) };
    });
    try {
      const overCanon = (await import("./rulesets/seed/index")) as { SEED_EDITION_CONTENT: EditionContent };
      const followed = unitsOf(overCanon.SEED_EDITION_CONTENT).filter((unit) => unit === SUBSTITUTED_AREA);
      expect(followed.length, `${SEED_MODULE} reads its area unit from ${CANON_MODULE} — a literal of its own is a second spelling that agrees only until the canon moves (B-17, ARCH-02)`).toBe(
        areasNow.length,
      );
    } finally {
      vi.doUnmock("./units/canon");
      vi.resetModules();
    }

    // white-box: AC-3(f) — "the seed's comment no longer claims the font cannot print a squared
    // sign" is a property of the text; a stale explanation is invisible to every call.
    const comments = textOf(SEED_MODULE)
      .split("\n")
      .filter((line) => line.trimStart().startsWith("//") || line.trimStart().startsWith("*") || line.trimStart().startsWith("/*"))
      .join(" ");
    expect(comments, `${SEED_MODULE}'s comment no longer blames the pinned document font — m2 IS the canon's AREA spelling, and cm2 stays as data 0004's digest froze (Q-17)`).not.toMatch(/font|glyph/i);
  });

  test("AC-3(g): CanonicalPerPackagingUnit is gone and the packaging factor's meaning is documented on the property", () => {
    // white-box: AC-3(g) — a type alias is erased before anything runs, and a doc comment is never
    // reached at all: that ProductFactors is a plain `Record<string, number>` is graded by the
    // `Expect<…>` alias above, but "the alias is gone" and "the meaning is stated here" can only be
    // read. Matched as DECLARATIONS, so prose about the removal is not graded as the removal.
    const source = textOf(CANON_MODULE);
    expect(source, `${CANON_MODULE} still declares CanonicalPerPackagingUnit, a nominal-looking alias for a bare number`).not.toMatch(/\btype\s+CanonicalPerPackagingUnit\b/);
    expect(source, `${CANON_MODULE} states the packaging factor as a plain number, not through that alias`).not.toMatch(/factors\?:\s*Record<\s*string\s*,\s*CanonicalPerPackagingUnit/);

    // The meaning is documented ON the property, not somewhere else in a 200-line module: the line
    // above the declaration must itself be a comment.
    const lines = source.split("\n");
    const at = lines.findIndex((line) => /factors\?:\s*Record</.test(line));
    expect(at, `${CANON_MODULE} declares the optional factors property`).toBeGreaterThan(0);
    const above = (lines[at - 1] ?? "").trim();
    expect(above, `${CANON_MODULE} states what a packaging factor MEANS on the property itself — canonical units per one packaging unit (L-FRM-06, Q-17)`).toMatch(/^(\/\*\*|\*|\/\/)/);
  });
});

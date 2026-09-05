/**
 * AC-3 of the src/core debt sweep: one invariant, one home (B-17, ARCH-02).
 *
 * Five primitives that were spelled twice, or spelled in a place that made a second spelling
 * inevitable: the decimal-figure grammar, the density roster, the edition digest's key grammar, the
 * seed's area unit and the packaging-factor type. Each is judged through a call wherever a call can
 * see it; where the defect is a second SPELLING and the two spellings agree today, the text is read
 * instead and the read says so.
 *
 * AC-3(a) (the proposal mark) and AC-3(c) (the canonical JSON spelling) live in
 * src/core/model/proposal-and-canonical-homes.test.ts: L-AI-01 makes src/core/model/ the one place
 * the seam's interior may be named, so no suite outside it can load those two modules at all.
 *
 * Every not-yet-existing member is reached through a namespace import and asserted present before
 * it is used, so a home the Builder has not moved yet fails as this file's own assertion naming the
 * module rather than as a link error that takes the whole suite with it.
 */
import { describe, expect, test } from "vitest";
import { codeOf, commentsOf, sourceOf } from "./__tests__/support/read-source";
import { refusalCodeOf } from "./faults/refusal-marker";
import { formatUserFigure } from "./format";
import { DENSITIES, isDensity, type Density } from "./prefs/density";
import { CANONICAL_UNITS } from "./units/canon";
import type { EditionContent } from "./rulesets/editions/content";

const FORMAT_MODULE = "src/core/format.ts";
const PROJECTS_MODULE = "src/core/projects.ts";
const DENSITY_MODULE = "src/core/prefs/density.ts";
const SEED_MODULE = "src/core/rulesets/seed/index.ts";
const CANON_MODULE = "src/core/units/canon.ts";

/** L-FMT-02's one answer to "nearly right" and "not a number" alike. */
const PRECISION_NOT_APPLIED = "PRECISION_NOT_APPLIED";

/** The seed edition's stored key (L-MEA-01), frozen by db/migrations/0004 — the sweep may not move it. */
const SEED_DIGEST = "5375a56e22eb7fe97646b3eca2d50036c7c7cc1fd3aca7213295ac91d188130e";

/** The two separators the canonical content is joined on, which no key of an edition may carry. */
const SEPARATORS = [String.fromCharCode(0x1e), String.fromCharCode(0x1f)];

/* ------------------------------------------------------------------ *
 * Compile-time acceptance (graded by `tsc --noEmit`, which reads src/**\/*.ts).
 * ------------------------------------------------------------------ */

type Expect<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
/** A roster whose length is `number` is an array of a spelled union; a tuple's length is its own. */
type IsTuple<T extends readonly unknown[]> = number extends T["length"] ? false : true;

/** AC-3(d): the roster is a tuple, so the union can be read off it rather than spelled beside it. */
export type TheDensityRosterIsATuple = Expect<IsTuple<typeof DENSITIES>>;

/** AC-3(d): and the type is that tuple's members — one home, not two kept in step by hand (B-17). */
export type DensityIsDerivedFromTheRoster = Expect<Equal<Density, (typeof DENSITIES)[number]>>;

/** The value a promise rejected with, or undefined — no catch clause of the test's own. */
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
    expect(projects["isDecimalFigure"], `${PROJECTS_MODULE} re-exports that one home unchanged, so its own importers are untouched`).toBe(format["isDecimalFigure"]);

    const isDecimalFigure = format["isDecimalFigure"] as (value: string) => boolean;
    // Every candidate the spec names, each one a shape the two spellings could disagree on.
    for (const candidate of ["0", "-0.5", "12.50", "00", "1.", ".5", "+1", "1e3", "", " 1"]) {
      const refused = thrownBy(() => formatUserFigure(candidate));
      if (refused !== undefined) {
        expect(refusalCodeOf(refused), `formatUserFigure(${JSON.stringify(candidate)}) refuses as a refusal, never an unmarked throw (ARCH-03)`).toBe(PRECISION_NOT_APPLIED);
      }
      expect(isDecimalFigure(candidate), `isDecimalFigure(${JSON.stringify(candidate)}) is true exactly when formatUserFigure does not refuse it — one grammar, one answer`).toBe(refused === undefined);
    }

    // white-box: AC-3(b) — "whose own DECIMAL_FIGURE regex is gone" is a property of the text: a
    // second spelling that agrees with the first today is invisible to every call.
    expect(codeOf(PROJECTS_MODULE, "AC-3(b) reads the module for the second spelling the sweep removes"), `${PROJECTS_MODULE} still spells the grammar a second time as DECIMAL_FIGURE (B-17)`).not.toContain(
      "DECIMAL_FIGURE",
    );
  });

  test("AC-3(d): DENSITIES is a tuple and Density is read off it", () => {
    expect(Array.isArray(DENSITIES) && DENSITIES.length > 0, "the roster is a non-empty list of the modes R-UI-005 names").toBe(true);
    for (const density of DENSITIES) expect(isDensity(density), `${density} is a mode the store can hold`).toBe(true);

    // white-box: AC-3(d) — "the type is derived, not spelled twice" has no runtime observable: an
    // `as const` tuple and a hand-spelled union are the same array at run time. The compile-time
    // half of this criterion is the two `Expect<…>` aliases above, graded by tsc.
    const code = codeOf(DENSITY_MODULE, "AC-3(d) reads the roster's declaration for the derivation");
    expect(code, `${DENSITY_MODULE} still spells the union beside the roster instead of reading it off (B-17)`).toMatch(/export\s+type\s+Density\s*=\s*\(typeof\s+DENSITIES\)\[number\]/);
    expect(code, `${DENSITY_MODULE}'s roster is declared \`as const\`, which is what makes it a tuple the union can be read from`).toMatch(/DENSITIES\s*=\s*\[[^\]]*\]\s*as\s+const/);
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

  test("AC-3(f): the seed's area unit is read from the unit canon, and its comment no longer blames the document font", async () => {
    const seed = (await import("./rulesets/seed/index")) as { SEED_EDITION_CONTENT: EditionContent };
    const areas = Object.entries(seed.SEED_EDITION_CONTENT.parameters).filter(([, parameter]) => parameter.unit === CANONICAL_UNITS.AREA);
    expect(areas.length, `the seed's area parameters spell the canon's AREA unit (${CANONICAL_UNITS.AREA})`).toBeGreaterThan(0);

    // white-box: AC-3(f) — the defect is the SPELLING, not the value: a literal "m2" and
    // CANONICAL_UNITS.AREA are the same string at run time, so only the text can tell them apart.
    const code = codeOf(SEED_MODULE, "AC-3(f) reads the seed for a second spelling of the canon's AREA unit");
    expect(code, `${SEED_MODULE} reads its area unit from ${CANON_MODULE} rather than spelling it (ARCH-02)`).toContain("CANONICAL_UNITS.AREA");
    expect(code, `${SEED_MODULE} spells no area unit of its own beside the canon's`).not.toMatch(/["']m2["']/);

    const comments = commentsOf(SEED_MODULE, "AC-3(f) reads the seed's own explanation of its unit spellings");
    expect(comments, `${SEED_MODULE}'s comment no longer claims the pinned document font cannot print a squared sign — the canon's spelling is m2 (Q-17)`).not.toMatch(/font|glyph/i);
  });

  test("AC-3(g): CanonicalPerPackagingUnit is gone and the packaging factor's meaning is documented on the property", () => {
    // white-box: AC-3(g) — an alias for `number` is erased at run time, so "the alias is gone and the
    // property carries its meaning" is only ever a property of the declaration's text.
    const code = codeOf(CANON_MODULE, "AC-3(g) reads the canon for the alias the sweep removes");
    expect(code, `${CANON_MODULE} still declares CanonicalPerPackagingUnit, a nominal-looking alias for a bare number`).not.toContain("CanonicalPerPackagingUnit");
    expect(code, `${CANON_MODULE} states ProductFactors over a plain Record<string, number>`).toMatch(/ProductFactors\s*=\s*\{[\s\S]{0,200}?factors\?:\s*Record<\s*string\s*,\s*number\s*>/);

    // The meaning is documented ON the property, not somewhere else in a 200-line module: the line
    // above the declaration must itself be a comment.
    const lines = sourceOf(CANON_MODULE, "AC-3(g) reads the declaration to find the property's own doc").split("\n");
    const at = lines.findIndex((line) => /factors\?:\s*Record</.test(line));
    expect(at, `${CANON_MODULE} declares the optional factors property`).toBeGreaterThan(0);
    const above = (lines[at - 1] ?? "").trim();
    expect(above, `${CANON_MODULE} states what a packaging factor MEANS on the property itself — canonical units per one packaging unit (L-FRM-06, Q-17)`).toMatch(/^(\/\*\*|\*|\/\/)/);
  });
});

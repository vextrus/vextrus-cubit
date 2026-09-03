/**
 * AC-1(a)(b): the gallery's sample refusals and the register they are copies of (B-17, ARCH-02).
 *
 * This file is THE drift guard the criterion names — the one place in the tree where the sample
 * table and `REFUSALS` are compared. It lives under `tests/` because `src/ui` may not value-import
 * `src/core` (ARCH-01): the sample module holds the copy, this suite holds the binding, and no
 * sentence is transcribed here — every expected string is read out of the register at run time
 * (B-19).
 *
 * The sample module is loaded by absolute path so that, until it exists, the failure names the file
 * the sweep owes. Its type surface is asserted separately, in type position, where `tsc` grades it.
 */
import { describe, expect, test } from "vitest";
import { codeOf } from "../../../src/core/__tests__/support/read-source";
import { REFUSALS, type RefusalCode, type RefusalEntry, type RefusalSeverity, type RefusalSurface } from "../../../src/core/errors";
import { productModule } from "./support/sources";
import type { Assignable, Equal, Expect, KeyedExactlyBy } from "./support/type-assertions";

const SAMPLE_REFUSALS_MODULE = "src/ui/gallery-derivation/sample-refusals.ts";
const ENTRIES_MODULE = "src/ui/gallery-derivation/entries.tsx";
const WHY = "AC-1(a) names it as the one home of the gallery's sample refusal copy";

/* ------------------------------------------------------------------ the type surface (AC-1a) */

type SampleRefusalCode = import("../../../src/ui/gallery-derivation/sample-refusals").SampleRefusalCode;
type SampleRefusalsModule = typeof import("../../../src/ui/gallery-derivation/sample-refusals");

/** The published code union is the sample table's own key set — the two cannot drift. */
export type SampleCodeIsTheTablesKeySet = Expect<Equal<SampleRefusalCode, keyof SampleRefusalsModule["SAMPLE_REFUSALS"]>>;

/** Every sampled code is a code the register holds; the gallery invents none. */
export type SampledCodesAreRegistered = Expect<Assignable<SampleRefusalCode, RefusalCode>>;

/** One sample per severity the register defines, and no key that is not a severity. */
export type SamplesCoverEverySeverity = Expect<KeyedExactlyBy<SampleRefusalsModule["SAMPLE_REFUSAL_BY_SEVERITY"], RefusalSeverity>>;

/* ------------------------------------------------------------------ the runtime surface */

type SampleFields = Pick<RefusalEntry, "code" | "message" | "remedy" | "severity">;

interface SampleRefusals {
  readonly SAMPLE_REFUSALS: Readonly<Record<string, SampleFields>>;
  readonly SAMPLE_REFUSAL_BY_SEVERITY: Readonly<Record<string, string>>;
  readonly sampleRefusal: (code: string, surface: RefusalSurface) => RefusalEntry;
}

const load = (): Promise<SampleRefusals> => productModule<SampleRefusals>(SAMPLE_REFUSALS_MODULE, WHY);

/** The fields a sample carries, picked out of a registered entry — the shape the criterion names. */
const picked = (code: RefusalCode): SampleFields => {
  const entry = REFUSALS[code];
  return { code: entry.code, message: entry.message, remedy: entry.remedy, severity: entry.severity };
};

/** The severities and surfaces the register itself uses, enumerated rather than listed (B-19). */
const registered = <K extends "severity" | "surface">(field: K): string[] =>
  [...new Set(Object.values(REFUSALS).map((entry) => entry[field] as string))].sort();

describe("AC-1a: the gallery's sample refusals are the register's own entries", () => {
  test("AC-1a: every sample is the registered entry, picked", async () => {
    const sample = await load();
    const codes = Object.keys(sample.SAMPLE_REFUSALS);
    expect(codes.length, "the gallery samples at least one refusal").toBeGreaterThan(0);

    for (const code of codes) {
      expect(Object.prototype.hasOwnProperty.call(REFUSALS, code), `${code} is a code the register holds`).toBe(true);
      expect(sample.SAMPLE_REFUSALS[code], `${code}'s sample carries the register's own code, message, remedy and severity`).toStrictEqual(
        picked(code as RefusalCode),
      );
    }
  });

  test("AC-1a: the by-severity map answers with a sample whose registered severity it is", async () => {
    const sample = await load();
    expect(Object.keys(sample.SAMPLE_REFUSAL_BY_SEVERITY).sort(), "every severity the register uses has a gallery sample").toEqual(
      registered("severity"),
    );

    for (const [severity, code] of Object.entries(sample.SAMPLE_REFUSAL_BY_SEVERITY)) {
      expect(Object.keys(sample.SAMPLE_REFUSALS), `${severity}'s sample is one the table holds`).toContain(code);
      expect(REFUSALS[code as RefusalCode].severity, `${code} stands for ${severity} because that is the severity it is registered at`).toBe(
        severity,
      );
    }
  });

  test("AC-1a: the sample chosen for each severity is the one s-design I-18 fixes", async () => {
    const sample = await load();
    expect(sample.SAMPLE_REFUSAL_BY_SEVERITY, "s-design I-18 names which registered code the gallery shows at each severity").toStrictEqual({
      error: "PRECISION_NOT_APPLIED",
      warning: "RATE_LIMITED",
      info: "ACT_CHANGES_NOTHING",
    });
  });

  test("AC-1a: sampleRefusal answers the registered entry, on the surface it is asked for", async () => {
    const sample = await load();
    for (const code of Object.keys(sample.SAMPLE_REFUSALS)) {
      for (const surface of registered("surface")) {
        expect(sample.sampleRefusal(code, surface as RefusalSurface), `${code} on ${surface}`).toStrictEqual({
          ...picked(code as RefusalCode),
          surface,
        });
      }
    }
  });
});

describe("AC-1b: the sampled copy is spelled once", () => {
  test("AC-1b: entries.tsx spells no sentence the register owns", async () => {
    const sample = await load();
    const code = codeOf(ENTRIES_MODULE, "the catalogue is what AC-1(b) moves the sample copy out of");

    for (const sampled of Object.keys(sample.SAMPLE_REFUSALS)) {
      const entry = REFUSALS[sampled as RefusalCode];
      expect(code, `${sampled}'s message is the register's to spell, and sample-refusals.ts's to read`).not.toContain(entry.message);
      expect(code, `${sampled}'s remedy is the register's to spell, and sample-refusals.ts's to read`).not.toContain(entry.remedy);
    }
  });
});

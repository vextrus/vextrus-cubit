/**
 * AC-3 — ordinals freeze under the one code-unit sort (L-REG-05).
 *
 * The sort is judged as a sort: what `compareCanonical` answers for pairs a locale would order the
 * other way round, and what an array sorted through it comes out as. The ordinal keys are judged
 * over every permutation of a staged mark family, so a reader that kept the order it was handed
 * answers a different map for five of the six orderings.
 *
 * The expected map is stated once in the stage (`MARK_FAMILY_KEYS`) and also re-derived here from
 * the product's OWN `contentSignature` under `compareCanonical`: the family is staged so both
 * readings must agree, and a signature that dropped an authored input moves the derived one (B-19).
 *
 * The lint stage is observed by driving the tree's own `eslint.config.mjs` — what `pnpm exec eslint`
 * would report over the two new homes, never a hand-built config and never a read of their source.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import {
  IDENTITY_DIR,
  MARK_FAMILY,
  MARK_FAMILY_KEYS,
  REGISTER_DIR,
  REPO_ROOT,
  SINGLETON_FAMILY,
  identitySeam,
  ordinalMapOf,
  permutationsOf,
  type FamilyRow,
} from "./support/register-stage";

/** The rule AC-3 names, already armed tree-wide with its own corpus (out of scope: a new rule). */
const NO_RAW_INTL = "cubit/no-raw-intl";
const CONFIG_FILE = "eslint.config.mjs";

/** A locale call the rule refuses, spelled where no product file has to carry it. */
const LOCALE_CALL = ["locale", "Compare"].join("");

interface LintMessage {
  readonly ruleId: string | null;
  readonly message: string;
  readonly line: number;
  readonly severity: number;
}
interface LintResult {
  readonly filePath: string;
  readonly messages: readonly LintMessage[];
}
interface Linter {
  lintText(text: string, options: { filePath: string }): Promise<readonly LintResult[]>;
  lintFiles(patterns: readonly string[]): Promise<readonly LintResult[]>;
}
type LinterCtor = new (options: { cwd: string; overrideConfigFile: boolean; overrideConfig: unknown }) => Linter;

let linter: Linter;

beforeAll(() => {
  const requireFromRoot = createRequire(join(REPO_ROOT, "noop.cjs"));
  const ESLintCtor = (requireFromRoot("eslint") as { ESLint: LinterCtor }).ESLint;
  const config = (requireFromRoot(join(REPO_ROOT, CONFIG_FILE)) as { default: unknown }).default;
  linter = new ESLintCtor({ cwd: REPO_ROOT, overrideConfigFile: true, overrideConfig: config });
}, 120_000);

/** The rows of a family whose ordinal key the product answered, keyed by row id. */
async function keysOfFamily(family: readonly FamilyRow[]): Promise<Record<string, string>> {
  const identity = await identitySeam();
  return ordinalMapOf(identity.ordinalKeys(family));
}

describe("AC-3: the one code-unit sort, and the ordinals it freezes", () => {
  test("AC-3: compareCanonical orders by code unit, and sortCanonical is that order applied", async () => {
    const identity = await identitySeam();

    expect(identity.compareCanonical("a", "B"), "`a` (U+0061) stands after `B` (U+0042) by code unit — a locale would say otherwise").toBeGreaterThan(0);
    expect(identity.compareCanonical("é", "z"), "`é` (U+00E9) stands after `z` (U+007A) by code unit — a locale would collate it with `e`").toBeGreaterThan(0);
    expect(identity.compareCanonical("a", "a"), "a string is equal to itself").toBe(0);
    expect(identity.compareCanonical("B", "a"), "and the comparison is antisymmetric").toBeLessThan(0);
    expect(["b", "A", "a", "B"].sort(identity.compareCanonical), "capitals sort before lowercase, because that is where their code units stand").toEqual(["A", "B", "a", "b"]);

    // `sortCanonical` is that same order, applied to a copy — judged over strings the corpus and the
    // families really carry, plus the pairs above, so it is not asked about a hand-picked list.
    const values = [...MARK_FAMILY.map((row) => row.rowId), ...MARK_FAMILY.map((row) => row.length), "b", "A", "a", "B", "é", "z"];
    const owed = [...values].sort(identity.compareCanonical);
    expect(identity.sortCanonical(values), "`sortCanonical` answers the same order `compareCanonical` puts a copy in").toEqual(owed);
    expect(values[0], "and it sorted a COPY — the list it was handed is untouched").toBe("r10");
  });

  test("AC-3: a singleton keeps its bare mark, and a family is keyed mark#i by content signature, tie-broken by row id", async () => {
    const identity = await identitySeam();

    const singleton = SINGLETON_FAMILY[0] as FamilyRow;
    expect(await keysOfFamily(SINGLETON_FAMILY), "a mark family of one keeps the bare mark — there is no ordinal to state (L-REG-05)").toEqual({ [singleton.rowId]: singleton.mark });

    // What the law says the order is, re-derived through the product's own signature: authored
    // inputs first under `compareCanonical`, row id where two signatures are equal.
    const signatures = new Map(MARK_FAMILY.map((row) => [row.rowId, identity.contentSignature(row)]));
    const derived = [...MARK_FAMILY]
      .sort((left, right) => {
        const bySignature = identity.compareCanonical(signatures.get(left.rowId) as string, signatures.get(right.rowId) as string);
        return bySignature === 0 ? identity.compareCanonical(left.rowId, right.rowId) : bySignature;
      })
      .reduce<Record<string, string>>((map, row, at) => ({ ...map, [row.rowId]: `${row.mark}#${at + 1}` }), {});
    expect(derived, "the family's ordinals, derived from the product's own content signature, are the ones the criterion names").toEqual(MARK_FAMILY_KEYS);

    // Two of the three rows are identical in every authored input, so the signature must tie them —
    // otherwise the row id never decides anything and the tie-break is untested.
    expect(signatures.get("r10"), "two rows with identical authored inputs carry identical content signatures (L-REG-05: authored inputs only)").toBe(signatures.get("r2"));
    expect(signatures.get("r5"), "and the row whose length differs carries another").not.toBe(signatures.get("r10"));

    expect(await keysOfFamily(MARK_FAMILY), "`ordinalKeys` keys the family mark#i in that order, with `r10` before `r2` under the one code-unit sort").toEqual(MARK_FAMILY_KEYS);
  });

  test("AC-3: the ordinals are the same map for every permutation of the rows, so they never move", async () => {
    const orderings = permutationsOf(MARK_FAMILY);
    expect(orderings.length, "all six orderings of a family of three are asked").toBe(6);
    for (const ordering of orderings) {
      expect(await keysOfFamily(ordering), `the order the rows arrive in changes nothing: ${ordering.map((row) => row.rowId).join(",")}`).toEqual(MARK_FAMILY_KEYS);
    }
  });

  test("AC-3: no localeCompare and no Intl — the shipped no-raw-intl rule is armed over both new homes and reports nothing in them", async () => {
    for (const home of [IDENTITY_DIR, REGISTER_DIR]) {
      expect(existsSync(join(REPO_ROOT, home)), `${home} stands in the checkout — this criterion grades what the lint stage says about it`).toBe(true);
    }

    // The rule really binds those paths: a locale call read at a file inside each home is reported
    // by the shipped config. Nothing is written to the tree — the source is the LINTER'S input.
    for (const home of [IDENTITY_DIR, REGISTER_DIR]) {
      const probe = `export const at = (values: string[]): string[] => [...values].sort((a, b) => a.${LOCALE_CALL}(b));\n`;
      const reported = (await linter.lintText(probe, { filePath: join(REPO_ROOT, home, "probe.ts") })).flatMap((result) => [...result.messages]);
      expect(
        reported.map((message) => message.ruleId),
        `${NO_RAW_INTL} is armed at ${home} — the ban is the tree's, and this increment adds no rule of its own`,
      ).toContain(NO_RAW_INTL);
    }

    const results = await linter.lintFiles([join(REPO_ROOT, IDENTITY_DIR), join(REPO_ROOT, REGISTER_DIR)]);
    expect(results.length, "the lint stage really read files under both homes").toBeGreaterThan(0);
    const errors = results.flatMap((result) => result.messages.filter((message) => message.severity === 2).map((message) => `${result.filePath}:${message.line} ${message.ruleId ?? "syntax"} ${message.message}`));
    expect(errors, "`pnpm verify`'s eslint stage is green over both new homes — every sort in them goes through `compareCanonical` (L-REG-05)").toEqual([]);
  }, 180_000);
});

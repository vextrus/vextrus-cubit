/**
 * Public acceptance for AC-1 — `editionDigest` keys rule CONTENT (L-MEA-01).
 *
 * The clause is a set of relations, and every one of them is asserted here as a relation, never as
 * a stored hex string: reordering the content leaves the digest alone, changing any single value or
 * method version moves it, and a verbatim copy digests identically. Nothing in this file spells a
 * digest literal — a Builder who chooses a different hash function passes it unchanged, and a
 * Builder who digests the JSON of an object (order-dependent) fails the first case.
 *
 * The parameters the cases are built over come from the exported seed, so the file grades the
 * relation over the edition the tree actually holds rather than over a roster copied into a test.
 *
 * `.ts`, not `.tsx`: tsconfig includes `tests/**\/*.ts`, so `pnpm verify`'s `tsc` reads the
 * type-level half below — "identity is (scope, name, version)" and "every view the module answers
 * carries identity and digest as separate fields" are statements about types, and the compiler is
 * the runner that can judge them.
 */
import { describe, expect, test } from "vitest";
import {
  EDITIONS_MODULE,
  SEED_MODULE,
  SEED_NAME,
  SEED_VERSION,
  contentWithMethods,
  loadEditionDigest,
  loadSeedContent,
  loadSeedIdentity,
  reversedParameters,
  withDifferentValue,
  type EditionContentLike,
} from "./support/editions";
import type { EditionIdentity } from "../../src/core/rulesets/editions";

/* ------------------------------------------------------------------- the compiler's half */

type Assert<T extends true> = T;

/** The editions module as a type, so the view's shape can be spoken about without importing a value. */
type Editions = typeof import("../../src/core/rulesets/editions");

/** Identity is (scope, name, version) — those three keys, and exactly those. */
type IdentityIsScopeNameVersion = Assert<
  keyof EditionIdentity extends "scope" | "name" | "version" ? ("scope" | "name" | "version" extends keyof EditionIdentity ? true : false) : false
>;

/** …and the scope is the closed three, not an open string. */
type ScopeIsTheClosedThree = Assert<
  EditionIdentity["scope"] extends "platform" | "tenant" | "project" ? ("platform" | "tenant" | "project" extends EditionIdentity["scope"] ? true : false) : false
>;

/** Identity does not carry the digest: L-MEA-01 says neither substitutes for the other. */
type IdentityCarriesNoDigest = Assert<"digest" extends keyof EditionIdentity ? false : true>;

/** The pinned answer of the view: identity and digest, as separate fields. */
type PinnedView = Extract<Awaited<ReturnType<Editions["projectRulesetView"]>>, { pinned: true }>;
type ViewCarriesIdentityAndDigest = Assert<PinnedView extends { identity: EditionIdentity; digest: string } ? true : false>;

const identityIsScopeNameVersion: IdentityIsScopeNameVersion = true;
const scopeIsTheClosedThree: ScopeIsTheClosedThree = true;
const identityCarriesNoDigest: IdentityCarriesNoDigest = true;
const viewCarriesIdentityAndDigest: ViewCarriesIdentityAndDigest = true;

/* ------------------------------------------------------------------------- the runtime half */

/** The seed's parameters under a non-empty method roster: the digest's two axes, both populated. */
async function probeContent(): Promise<EditionContentLike> {
  return contentWithMethods(await loadSeedContent());
}

describe("AC-1: editionDigest digests edition content — parameter values × (rule id, version) pairs", () => {
  test("AC-1: the digest is a stable, non-empty string for one content object", async () => {
    const digest = await loadEditionDigest();
    const content = await probeContent();
    const once = digest(content);
    expect(typeof once, `${EDITIONS_MODULE}: editionDigest must answer a string — the key an edition is stored under`).toBe("string");
    expect(once.length, "a digest of no characters keys nothing").toBeGreaterThan(0);
    expect(digest(content), "the same content must digest the same way twice — a digest that moves between calls keys nothing").toBe(once);
  });

  test("AC-1: reordering the parameter keys leaves the digest unchanged", async () => {
    const digest = await loadEditionDigest();
    const content = await probeContent();
    const reordered = reversedParameters(content);
    expect(Object.keys(reordered.parameters), "the fixture must really be a reordering, not a rewrite").toStrictEqual([...Object.keys(content.parameters)].reverse());
    expect(digest(reordered), "the digest is over parameter VALUES — the order the keys happen to be written in is not content (L-MEA-01)").toBe(digest(content));
  });

  test("AC-1: reordering the method pairs leaves the digest unchanged", async () => {
    const digest = await loadEditionDigest();
    const content = await probeContent();
    expect(content.methods.length, "this case needs at least two method pairs to reorder").toBeGreaterThan(1);
    const reordered: EditionContentLike = { parameters: content.parameters, methods: [...content.methods].reverse() };
    expect(digest(reordered), "the digest is over the SET of (rule id, version) pairs in force — the order they are listed in is not content (L-MEA-01)").toBe(digest(content));
  });

  test("AC-1: changing any single parameter value changes the digest", async () => {
    const digest = await loadEditionDigest();
    const content = await probeContent();
    const baseline = digest(content);
    const keys = Object.keys(content.parameters);
    expect(keys.length, "the seed edition must carry parameters for this case to move one").toBeGreaterThan(0);
    for (const key of keys) {
      const mutated: EditionContentLike = {
        parameters: { ...structuredClone(content.parameters), [key]: withDifferentValue(content.parameters[key]) },
        methods: content.methods,
      };
      expect(digest(mutated), `changing ${key} must change the digest — a digest blind to a threshold is not a content key (L-MEA-01)`).not.toBe(baseline);
    }
  });

  test("AC-1: changing any method version changes the digest", async () => {
    const digest = await loadEditionDigest();
    const content = await probeContent();
    const baseline = digest(content);
    content.methods.forEach((pair, index) => {
      const methods = content.methods.map((each, at) => (at === index ? { ruleId: each.ruleId, version: `${each.version}-bumped` } : { ...each }));
      expect(
        digest({ parameters: content.parameters, methods }),
        `bumping ${pair.ruleId}'s version must change the digest — L-MEA-01: "a version bump moves every edition citing it"`,
      ).not.toBe(baseline);
    });
  });

  test("AC-1: changing a method's rule id changes the digest", async () => {
    const digest = await loadEditionDigest();
    const content = await probeContent();
    const before = digest(content);
    const [first, ...rest] = content.methods;
    expect(first, "this case needs at least one method pair").toBeTruthy();
    const head = first as { ruleId: string; version: string };
    const methods = [{ ruleId: `${head.ruleId}.other`, version: head.version }, ...rest];
    expect(digest({ parameters: content.parameters, methods }), "the digest is over the (rule id, version) PAIRS — a different rule in force is different content").not.toBe(before);
  });

  test("AC-1: adding or removing a parameter changes the digest", async () => {
    const digest = await loadEditionDigest();
    const content = await probeContent();
    const before = digest(content);
    const keys = Object.keys(content.parameters);
    const added: EditionContentLike = { parameters: { ...structuredClone(content.parameters), probeParameterNoEditionHolds: withDifferentValue(undefined) }, methods: content.methods };
    expect(digest(added), "an edition with one more parameter is different content").not.toBe(before);

    const dropped = structuredClone(content.parameters);
    const first = keys[0];
    expect(first, "the seed edition must carry at least one parameter to drop").toBeTruthy();
    delete dropped[first as string];
    expect(digest({ parameters: dropped, methods: content.methods }), "an edition with one fewer parameter is different content").not.toBe(before);
  });

  test("AC-1: a verbatim fork shares its parent's digest by construction", async () => {
    const digest = await loadEditionDigest();
    const parent = await probeContent();
    // A fork copies the content and nothing else: no re-derivation, no new field, no timestamp.
    const fork = structuredClone(parent);
    expect(digest(fork), "a verbatim fork must digest identically to its parent — that sameness is what the lineage on the settings screen shows (L-MEA-01)").toBe(digest(parent));
  });

  test("AC-1: the seed's own content and identity are carried as separate values", async () => {
    const identity = await loadSeedIdentity();
    expect(identity.scope, `${SEED_MODULE}: the seed edition is the platform edition`).toBe("platform");
    expect(identity.name, `${SEED_MODULE}: L-MEA-01 names the seed rule set ${SEED_NAME}`).toBe(SEED_NAME);
    expect(identity.version, `${SEED_MODULE}: L-MEA-01 versions the seed rule set ${SEED_VERSION}`).toBe(SEED_VERSION);
    const content = await loadSeedContent();
    expect(Object.keys(content).sort(), `${SEED_MODULE}: the seed CONTENT is parameters × methods — identity is carried separately, and neither substitutes for the other`).toStrictEqual(["methods", "parameters"]);
  });

  test("AC-1: the type-level contract the compiler judges is stated over a module that exists", async () => {
    // The four assertions above are the compiler's, and `tsc` is their runner: each is an
    // unsatisfiable type unless `EditionIdentity` really is (scope, name, version) over the closed
    // three scopes and the view really carries identity and digest apart. The module they are
    // written against is required here too, so this case is red until it exists rather than
    // standing green over types nothing has declared.
    await loadEditionDigest();
    expect([identityIsScopeNameVersion, scopeIsTheClosedThree, identityCarriesNoDigest, viewCarriesIdentityAndDigest]).toStrictEqual([true, true, true, true]);
  });
});

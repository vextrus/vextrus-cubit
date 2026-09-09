// L-MEA-01's methods, as a registry: "methods (formulas, expansions, resolvers) are versioned code,
// keyed (rule id, version)". An edition cites the PAIRS in force; this file is where a pair meets
// the code that computes it.
//
// The roster is the shards' — one `*.methods.json` per method directory, recorded beside the code it
// declares and digested by `pnpm verify`'s method-hash stage, so a method's declaration cannot drift
// from what the toolchain accepted. `enumerateMethods` reads the shards rather than a second list
// (B-19), and a shard is named here exactly once: a shard nothing maps is a pair an edition could
// cite that nothing can compute, which is what `implementationOf` exists to make impossible.
//
// The shards are imported rather than discovered by walking the tree: what is in force is decided at
// build time, so the roster of a deployed product is the roster its build carried and never what
// happens to be on a disk beside it.
import type { Kind } from "../../catalogue/kinds";
import type { DeductionChannel } from "../../offers/contract";
import type { Dimension, Unit } from "../../units/canon";
import type { MethodPair } from "../editions/content";
import conventionsShard from "./conventions/conventions.methods.json";
import { CONVENTIONS_METHOD, resolve } from "./conventions/resolve";
import memberShard from "./member/member.methods.json";
import { MEMBER_VOLUME_FORMULA, MEMBER_VOLUME_METHOD } from "./member/volume";

/** How a method manifest is spelled — the suffix the toolchain's own stage finds a shard by. */
export const METHOD_MANIFEST_SUFFIX = ".methods.json";

/** One variable a formula declares: the name its template spells, and the dimension it stands in. */
export type MethodVariable = {
  readonly name: string;
  readonly dimension: Dimension;
};

/**
 * The bindings a formula is evaluated over: every declared variable, carried into the canonical unit
 * of its dimension by the gate's one normalisation (L-MEA-08). A method never converts anything.
 */
export type NormalisedBindings = Readonly<Record<string, { readonly value: string; readonly unit: Unit }>>;

/**
 * A formula method: one template, evaluated and rendered from the same declaration (L-QTY-03: "the
 * human-auditable formula string with named variables, rendered from the same registry template the
 * gate evaluates"). `evaluate` answers an exact decimal string in the canonical unit of `dimension`.
 */
export type FormulaMethod = {
  readonly role: "formula";
  readonly ruleId: string;
  readonly version: string;
  readonly kind: Kind;
  readonly dimension: Dimension;
  readonly variables: readonly MethodVariable[];
  readonly deductionChannels: readonly DeductionChannel[];
  readonly template: string;
  readonly evaluate: (bindings: NormalisedBindings) => string;
};

/**
 * A resolver method: versioned code that decides something about a drawing rather than measuring
 * one. It publishes no quantity, so it declares no variables and no template — an offer that cited
 * one would be an offer no line could be rendered from.
 */
export type ResolverMethod = {
  readonly role: "resolver";
  readonly ruleId: string;
  readonly version: string;
  readonly resolve: (...input: never[]) => unknown;
};

/** One implementation the registry maps a pair to. */
export type MethodImplementation = FormulaMethod | ResolverMethod;

/** One shard, as the manifest records it: the pairs in force, and the digest over those entries. */
type MethodShard = {
  readonly methods: Readonly<Record<string, { readonly ruleId: string; readonly version: string; readonly law: string; readonly module: string }>>;
  readonly digest: string;
};

/** Every shard of the tree. A method directory joins the roster by being named here (ARCH-02). */
const SHARDS: readonly MethodShard[] = [conventionsShard, memberShard];

/** How a pair is spelled wherever one is a key: `<ruleId>@<version>` (L-MEA-01). */
export function methodKey(pair: MethodPair): string {
  return `${pair.ruleId}@${pair.version}`;
}

/** L-CAD-08's convention resolver, as the registry holds it: versioned code, keyed by its pair. */
const CONVENTIONS_RESOLVE: ResolverMethod = Object.freeze({
  role: "resolver",
  ruleId: CONVENTIONS_METHOD.ruleId,
  version: CONVENTIONS_METHOD.version,
  resolve,
});

/**
 * Every pair the tree implements. A pair recorded by a shard and missing here is a method an edition
 * could cite that nothing can compute — which is why `implementationOf` answers `undefined` rather
 * than guessing, and the gate refuses `METHOD_IMPLEMENTATION_MISSING` when it does.
 */
const IMPLEMENTATIONS: Readonly<Record<string, MethodImplementation>> = Object.freeze({
  [methodKey(CONVENTIONS_METHOD)]: CONVENTIONS_RESOLVE,
  [methodKey(MEMBER_VOLUME_METHOD)]: MEMBER_VOLUME_FORMULA,
});

/** Code-point order — the only order this tree sorts a roster by (L-REG-05). */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Every (rule id, version) pair the shards record, deduplicated and in code-point order of its key.
 * The shards are the record of what is in force, so a method landed with its manifest is enumerated
 * here without a second list being edited (B-19).
 */
export function enumerateMethods(): readonly MethodPair[] {
  const held = new Map<string, MethodPair>();
  for (const shard of SHARDS) {
    for (const entry of Object.values(shard.methods)) {
      const pair: MethodPair = { ruleId: entry.ruleId, version: entry.version };
      held.set(methodKey(pair), pair);
    }
  }
  return Object.freeze(
    [...held.entries()]
      .sort(([left], [right]) => byCodePoint(left, right))
      .map(([, pair]) => pair),
  );
}

/** The code a pair is computed by, or nothing at all where the tree implements no such version. */
export function implementationOf(pair: MethodPair): MethodImplementation | undefined {
  const key = methodKey(pair);
  return Object.hasOwn(IMPLEMENTATIONS, key) ? IMPLEMENTATIONS[key] : undefined;
}

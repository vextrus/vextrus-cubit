// L-MEA-01's methods, as a registry: "methods (formulas, expansions, resolvers) are versioned code,
// keyed (rule id, version)". An edition cites the PAIRS in force; this file is where a pair meets
// the code that computes it.
//
// The roster is the shards' — one `*.methods.json` per method directory, recorded beside the code it
// declares and digested by `pnpm verify`'s method-hash stage, so a method's declaration cannot drift
// from what the toolchain accepted. `enumerateMethods` reads the shards rather than a second list
// (B-19), and a shard is named exactly once: a shard nothing maps is a pair an edition could cite
// that nothing can compute, which is what `implementationOf` exists to make impossible.
//
// The shards are imported rather than discovered by walking the tree: what is in force is decided at
// build time, so the roster of a deployed product is the roster its build carried and never what
// happens to be on a disk beside it. Each shard states `with { type: "json" }`: an ES module loader
// admits a JSON module only on that attribute, and the registry is reached by loaders that are not
// the bundler's — the acts seam, which imports the gate, is loaded directly under Node by the
// journeys' own staging.
//
// Where a shard is named is this DIRECTORY, not this file (AM-11). Each area names its own shards
// and maps its own pairs in `./registry/<area>.ts`, and this file is the registry: it ENUMERATES
// those areas and reads both halves off them, so `enumerateMethods` and `implementationOf` still
// answer for one roster and every importer still reads it from `@/core/rulesets/methods/registry`.
// An area lands a method by editing its own file and nothing else — two areas written at once never
// touch one list (B-19).

import { BOQ_METHODS } from "./registry/boq";
import { COLUMNS_METHODS } from "./registry/columns";
import { CONVENTIONS_METHODS } from "./registry/conventions";
import { DOCS_METHODS } from "./registry/docs";
import { FOUNDATIONS_METHODS } from "./registry/foundations";
import { FRAME_METHODS } from "./registry/frame";
import { MASONRY_METHODS } from "./registry/masonry";
import { MEMBER_METHODS } from "./registry/member";
import { REBAR_METHODS } from "./registry/rebar";
import { SLABS_METHODS } from "./registry/slabs";
import type { MethodPair } from "../editions/content";
import type { MethodImplementation } from "./law";
import { methodKey, type MethodArea } from "./registry/area";

// The shape a method declares itself in is the law file's, and published from here because this is
// the door a caller resolving a pair reads it at (B-17).
export type { FormulaMethod, MethodImplementation, MethodVariable, NormalisedBindings, ResolverMethod } from "./law";

// How a pair is spelled as a key is the area file's, for the same reason the areas declare their
// contributions against it — and published from here because this is the door callers read it at.
export { methodKey } from "./registry/area";

/** How a method manifest is spelled — the suffix the toolchain's own stage finds a shard by. */
export const METHOD_MANIFEST_SUFFIX = ".methods.json";

/** Every area of the tree. A method directory joins the roster by being named here (ARCH-02). */
const AREAS: readonly MethodArea[] = Object.freeze([
  COLUMNS_METHODS,
  CONVENTIONS_METHODS,
  MEMBER_METHODS,
  FOUNDATIONS_METHODS,
  FRAME_METHODS,
  SLABS_METHODS,
  MASONRY_METHODS,
  REBAR_METHODS,
  DOCS_METHODS,
  BOQ_METHODS,
]);

/**
 * Every pair the tree implements, read off the areas. A pair recorded by a shard and missing here is
 * a method an edition could cite that nothing can compute — which is why `implementationOf` answers
 * `undefined` rather than guessing, and the gate refuses `METHOD_IMPLEMENTATION_MISSING` when it does.
 */
const IMPLEMENTATIONS: Readonly<Record<string, MethodImplementation>> = Object.freeze(
  Object.assign({}, ...AREAS.map((area) => area.implementations)) as Record<string, MethodImplementation>,
);

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
  for (const area of AREAS) {
    for (const shard of area.shards) {
      for (const entry of Object.values(shard.methods)) {
        const pair: MethodPair = { ruleId: entry.ruleId, version: entry.version };
        held.set(methodKey(pair), pair);
      }
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

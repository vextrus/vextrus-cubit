/**
 * The rule-set edition digest — the key L-MEA-01 gives an edition (R-SPINE-012, B-07).
 *
 * L-MEA-01: parameters "are versioned data in an immutable rule-set edition keyed by a digest
 * over its parameter values × the (rule id, version) pairs of methods in force". A digest is a
 * pin only if two trees, two forks and two insertion orders arrive at the same string, so the
 * encoding is fixed rather than left to whatever `JSON.stringify` happened to be handed:
 *
 *     sha-256, lowercase hex, over the UTF-8 JSON of
 *     { methods: [[ruleId, version], …] sorted by ruleId then version,
 *       parameters: { key: value, … } keys sorted ascending }
 *
 * Parameter values are exact decimal strings here and everywhere below (B-07). A value that
 * became a number would round `0.08` on the way in and every edition digesting it would agree
 * with every other one about the wrong value — the one failure a digest cannot report.
 */
import { createHash } from 'node:crypto';

/** Where in the fork chain an edition sits: the platform seed, a tenant template, a project. */
export type EditionScope = 'platform' | 'tenant' | 'project';

/** Parameter id → its exact decimal string. Never a number, at rest or at the seam (B-07). */
export type RuleSetParameters = Readonly<Record<string, string>>;

/** A method in force, enumerated the way L-MEA-01 enumerates one: by rule id and version. */
export interface Method {
  readonly ruleId: string;
  readonly version: number;
}

/** The canonical form the digest is taken over — built here, and nowhere else. */
function canonical(parameters: RuleSetParameters, methods: readonly Method[]): string {
  const pairs = [...methods]
    .map((method): readonly [string, number] => [method.ruleId, method.version])
    .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] < b[0] ? -1 : 1));

  // Insertion order is what an object literal carries and what a database round trip loses, so
  // the keys are sorted into a fresh object rather than digested where they arrived.
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(parameters).sort()) {
    const value = parameters[key];
    if (value !== undefined) sorted[key] = value;
  }
  return JSON.stringify({ methods: pairs, parameters: sorted });
}

/**
 * The edition's digest: lowercase 64-hex sha-256 of the canonical form above.
 *
 * `node:crypto` rather than a package — the hash is a standard the runtime already carries,
 * and a dependency here would be one more thing that could change what a pinned project reads.
 */
export function editionDigest(
  parameters: RuleSetParameters,
  methods: readonly Method[],
): string {
  return createHash('sha256').update(canonical(parameters, methods), 'utf8').digest('hex');
}

/**
 * How an edition is named wherever a person reads one: `IS1200_IN @ 2026.08`.
 *
 * The separator lives here rather than in the pane's JSX, so the key a screen shows and the key
 * a log writes are one string built one way (R-SPINE-060 keeps literals out of JSX).
 */
export function editionKey(name: string, version: string): string {
  return `${name} @ ${version}`;
}

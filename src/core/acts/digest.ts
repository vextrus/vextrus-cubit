/**
 * The consequence digest (L-ACT-02).
 *
 * "A commit whose digest is not the one current state produces refuses
 * `CONSEQUENCES_NOT_CARRIED`" — so the digest has to be a function of the Consequence alone, and
 * two Consequences that differ in any member have to differ in it. That is the whole of what
 * this module is for.
 *
 * `JSON.stringify` alone would not do: its key order is insertion order, so the same Consequence
 * assembled by two code paths could digest differently and refuse a commit that carried the
 * truth. The serialisation below is canonical — keys sorted, `undefined` members dropped — and
 * the hash over it is SHA-256, which nothing here needs to be reversible.
 *
 * It is the seam's own, not the tRPC layer's: `src/core/acts` sits below `src/server` and must
 * not import from it, and the digest is a property of the act rather than of the transport that
 * carries it. src/server/trpc.ts holds the same primitive for the inc-011 act pair it founded;
 * folding the two together is a change to that file, which this increment does not own.
 */
import { createHash } from 'node:crypto';

/** A deterministic fingerprint of a Consequence: 64 lowercase hex characters. */
export function consequenceDigest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

/**
 * The canonical serialisation the digest is taken over.
 *
 * Every value a Consequence can carry has to serialise to something that distinguishes it from
 * every other value, or the digest silently agrees about two different states — the one failure
 * this primitive must not have. `Object.entries` alone does not: a Date, a Map and a Set all
 * have no own enumerable properties, so every one of them would canonicalise to `{}` and two
 * Consequences differing only in a timestamp or a quantity would carry the same digest. Each of
 * them is therefore written out by hand, and anything left that is not a plain object — a class
 * instance, a function, a symbol — is refused loudly rather than digested as nothing.
 */
function canonical(value: unknown): string {
  // `undefined` is dropped from objects but holds a position in an array, so it needs a form of
  // its own: through `JSON.stringify` it would be `null`, and `[undefined]` would digest as
  // `[null]`. The same goes for the numbers JSON cannot write — NaN and the infinities.
  if (value === undefined) return 'undefined';
  if (typeof value === 'bigint') return `"${value.toString()}n"`;
  if (typeof value === 'number' && !Number.isFinite(value)) return `Number(${String(value)})`;
  if (Object.is(value, -0)) return '-0';
  if (typeof value === 'function' || typeof value === 'symbol') throw undigestable(value);
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value instanceof Date) return `Date(${JSON.stringify(value.toISOString())})`;
  // A Map's and a Set's own order is insertion order, which is no more canonical than a plain
  // object's key order — so both are sorted by the serialisation of their members.
  if (value instanceof Map) return `Map(${sorted([...value].map(canonical))})`;
  if (value instanceof Set) return `Set(${sorted([...value].map(canonical))})`;

  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== null && proto !== Object.prototype) throw undigestable(value);

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, member]) => member !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : 1));
  return `{${entries.map(([key, member]) => `${JSON.stringify(key)}:${canonical(member)}`).join(',')}}`;
}

/** Serialised members in one order whatever order they arrived in. */
function sorted(members: readonly string[]): string {
  return [...members].sort((left, right) => (left < right ? -1 : 1)).join(',');
}

/** What a value the canonical form cannot tell apart from another one answers with. */
function undigestable(value: unknown): TypeError {
  const described =
    typeof value === 'object' && value !== null
      ? (value.constructor?.name ?? 'prototype-bearing object')
      : typeof value;
  return new TypeError(`a Consequence carrying a ${described} cannot be digested faithfully`);
}

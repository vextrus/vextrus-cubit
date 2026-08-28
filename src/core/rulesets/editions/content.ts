// L-MEA-01's rule-set edition, as content and as identity — two things that never substitute for
// one another. The digest keys CONTENT: parameter values × the (rule id, version) pairs of the
// methods in force. Identity is (scope, name, version) and is carried beside it, so a verbatim fork
// — the same content under a new scope — shares its parent's digest by construction.
import { createHash } from "node:crypto";

/** Where an edition sits in the fork chain L-REG-07 draws: platform → tenant → project. */
export type EditionScope = "platform" | "tenant" | "project";

/** L-MEA-01: "edition identity is (scope, name, version)". The digest is not part of it. */
export interface EditionIdentity {
  readonly scope: EditionScope;
  readonly name: string;
  readonly version: string;
}

/**
 * One parameter of an edition: the quantity, exact as the edition spells it, and the unit it is
 * measured in. The value is a decimal string because B-07 keeps a figure exact from the store to
 * the page, and the unit is edition data rather than screen copy — a surface renders what is here
 * and re-derives nothing from the key.
 */
export interface EditionParameter {
  readonly value: string;
  readonly unit: string;
}

/** One method in force, enumerated by (rule id, version) — the pairs an edition cites. */
export interface MethodPair {
  readonly ruleId: string;
  readonly version: string;
}

/** What an edition holds, and the whole of what its digest is taken over. */
export interface EditionContent {
  readonly parameters: Readonly<Record<string, EditionParameter>>;
  readonly methods: readonly MethodPair[];
}

/** One step of the chain a pin was forked along: an identity, and the digest that step carries. */
export interface EditionLineageStep extends EditionIdentity {
  readonly digest: string;
}

/**
 * The separators the canonical form is built from: the ASCII unit and record separators, which no
 * parameter key, unit string or rule id can hold. Joining on a character a value could itself
 * contain would let two different editions write one line — `{ "a": 1, "b": 2 }` against
 * `{ "a 1b": 2 }` — and a digest two editions share by accident keys nothing.
 */
const FIELD = String.fromCharCode(0x1f);
const RECORD = String.fromCharCode(0x1e);

/** Code-point order, which is the only order this seam sorts by: no locale reaches a digest. */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** A record whose key order is a property of how it was built rather than of what it says. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A parameter value written as what it holds and nothing about how it was written. Object keys go
 * into code-point order on the way through the serialiser, so `{ value, unit }` and `{ unit, value }`
 * are one allowance; array order is left alone, because a list's order is part of what a list says.
 */
function canonicalValue(value: unknown): string {
  const written = JSON.stringify(value, (_key, held: unknown) =>
    isPlainRecord(held) ? Object.fromEntries(Object.entries(held).sort(([left], [right]) => byCodePoint(left, right))) : held,
  );
  return written ?? "";
}

/**
 * The content in canonical form: every parameter as key then value, sorted by key, and every method
 * pair as (rule id, version), sorted and taken as a set. Neither the order the parameters were
 * written in nor the order the methods were listed in is content, so both are removed before the
 * hash — otherwise one edition would key two ways and a verbatim fork could miss its parent.
 */
function canonicalContent(content: EditionContent): string {
  const parameters = Object.entries(content.parameters)
    .sort(([left], [right]) => byCodePoint(left, right))
    .map(([key, value]) => `${key}${FIELD}${canonicalValue(value)}`);
  const methods = [...new Set(content.methods.map((pair) => `${pair.ruleId}${FIELD}${pair.version}`))].sort(byCodePoint);
  return `parameters${RECORD}${parameters.join(RECORD)}${RECORD}methods${RECORD}${methods.join(RECORD)}`;
}

/**
 * The key an edition is stored under (L-MEA-01): sha-256 over its canonical content, lowercase hex.
 * Hex because the digest is read back by people — the settings screen shows it whole — as well as
 * compared by the seam.
 */
export function editionDigest(content: EditionContent): string {
  return createHash("sha256").update(canonicalContent(content), "utf8").digest("hex");
}

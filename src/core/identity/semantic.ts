// L-REG-04's semantic: "every derived row also carries an order-normalised semantic (canonical JSON
// of its content including cited evidence source keys): unchanged semantic → human dispositions
// carry across a rebuild; changed → the row re-presents for disposition. The semantic invalidates; it
// never keys."
//
// So this file answers one question and no other: is what we are looking at now the same content a
// person already dispositioned? Nothing here derives an identity — a semantic carries correctable
// attributes, which L-REG-02 forbids a key to carry, and a row whose grade was corrected is the same
// row re-presenting rather than a new one.
//
// Order-normalised at every depth: object keys go into code-unit order, and so do the members of a
// list. A rebuild that walked the same drawing and cited the same evidence in another order found
// the same content, and a person's disposition of it must carry (L-REG-04) — while evidence that
// really moved changes the semantic and re-presents the row (L-REG-05).
import { createHash } from "node:crypto";
import { compareCanonical, sortCanonical } from "./compare-canonical";

/** A record whose keys are content, as against an array, a null or a boxed value. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The same content with every order it carries normalised — keys and list members alike. */
function normalised(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((member) => normalised(member))
      .map((member) => ({ member, spelt: JSON.stringify(member) ?? "null" }))
      .sort((left, right) => compareCanonical(left.spelt, right.spelt))
      .map((held) => held.member);
  }
  if (isPlainRecord(value)) {
    const ordered: Record<string, unknown> = {};
    for (const key of sortCanonical(Object.keys(value))) ordered[key] = normalised(value[key]);
    return ordered;
  }
  return value;
}

/**
 * One row's content as the canonical JSON its semantic is taken over. Two contents that differ only
 * in the order they were written in spell the same string; two that differ in anything they SAY do
 * not.
 */
export function canonicalSemantic(content: unknown): string {
  return JSON.stringify(normalised(content)) ?? "null";
}

/**
 * The semantic of a content: sha-256 over its canonical form, lowercase hex. Content-derived like
 * every other address in the register — nothing is minted here, so the same content answers the same
 * semantic on every machine and in every run (L-REG-04).
 */
export function semanticDigest(content: unknown): string {
  return createHash("sha256").update(canonicalSemantic(content), "utf8").digest("hex");
}

/**
 * Whether a person's dispositions of the prior content carry onto the next one (L-REG-04): they do
 * exactly while the semantic is unchanged. A changed semantic re-presents the row for disposition —
 * it is never silently kept, and never silently dropped either.
 */
export function dispositionsCarry(prior: unknown, next: unknown): boolean {
  return semanticDigest(prior) === semanticDigest(next);
}

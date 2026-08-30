// L-ACT-02's Consequence and its digest, which has exactly one home (ARCH-02, B-17): every act
// type's preview computes one of these, and every commit carries the digest of the one it was shown.
// A digest that is not the one the current state produces is `CONSEQUENCES_NOT_CARRIED`.
import { createHash } from "node:crypto";
import type { ActType } from "./law";

/**
 * One fact the act judges, and what it would do to it. The subject is named because L-ACT-01 records
 * an act "at the granularity performed (a confirm-all is one act with N subjects)"; `before` is the
 * state the digest binds, so a commit computed against different state carries a different digest.
 */
export type ConsequenceSubject = {
  readonly subjectId: string;
  /**
   * What a reader recognises the subject by, when the layer that answered the Consequence could
   * resolve one — an address, a name. It is presentation, never a fact the act judges: only the
   * layer that may read the identity store can fill it (the fold's one home is above this seam), so
   * a Consequence computed inside the seam carries none and the id is what a surface then shows.
   * The digest is deliberately blind to it: what an act would do cannot change because the surface
   * showing it learned a better word for the same person.
   */
  readonly subjectLabel?: string;
  readonly before: readonly string[];
  readonly after: readonly string[];
};

/**
 * How a Consequence renders (L-ACT-02: "a type without a rendering is a compile error"). The arms
 * are a closed union and the act pattern switches over it exhaustively, so an act whose Consequence
 * says something a different shape — L-ACT-02's offered groups, say — adds its arm here and its
 * rendering there, or fails to compile. Absent means `SUBJECTS`: the arm every act shipped so far
 * answers, and the one the field named nothing about before there were two.
 */
export type ConsequenceRendering = "SUBJECTS";

/** What an act would do, computed by the committing code path from the state it read (L-ACT-02). */
export type Consequence = {
  readonly actType: ActType;
  readonly tenantId: string;
  readonly projectId: string;
  readonly rendering?: ConsequenceRendering;
  readonly subjects: readonly ConsequenceSubject[];
};

/**
 * The digest of a consequence: sha-256 over its canonical form, so two consequences agree here iff
 * they say the same thing. Hex, because the digest is written to the act log and read back by
 * people as well as by this seam.
 */
export function consequenceDigest(consequence: Consequence): string {
  return createHash("sha256").update(canonical(judged(consequence)), "utf8").digest("hex");
}

/**
 * What the digest binds: the facts the act would move, and nothing about how they are shown. A
 * subject's label and the rendering arm are presentation — a surface that resolved a nicer word for
 * the same person, or a second way of laying the same transition out — and a digest that changed
 * with them would refuse `CONSEQUENCES_NOT_CARRIED` for a state that never moved.
 */
function judged(consequence: Consequence): unknown {
  return {
    actType: consequence.actType,
    tenantId: consequence.tenantId,
    projectId: consequence.projectId,
    subjects: consequence.subjects.map((subject) => ({ subjectId: subject.subjectId, before: subject.before, after: subject.after })),
  };
}

/**
 * Whether the act would move anything at all. L-ACT-01's act is "a human write that changes what the
 * machine would derive", so a Consequence whose every subject ends as it began records nothing — the
 * seam refuses it by name instead of writing an act row the state write cannot follow.
 */
export function movesNothing(consequence: Consequence): boolean {
  return consequence.subjects.every((subject) => same(subject.before, subject.after));
}

/** Two readings of one subject's state, compared as the ordered lists the previews build them as. */
function same(before: readonly string[], after: readonly string[]): boolean {
  return before.length === after.length && before.every((held, index) => held === after[index]);
}

/**
 * The canonical form a digest is taken over: object keys in code-point order, arrays in their own
 * order, nothing else. Key order is a property of how a value was built, never of what it says, so
 * it is removed before hashing — otherwise the same consequence would digest two ways.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, held]) => held !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, held]) => `${JSON.stringify(key)}:${canonical(held)}`).join(",")}}`;
  }
  throw new Error(`a consequence holds ${typeof value}, which nothing can digest — a Consequence is data (L-ACT-02)`);
}

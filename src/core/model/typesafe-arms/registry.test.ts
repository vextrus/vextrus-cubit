// @vitest-environment node
/**
 * The arm registry, as AM-11 asks a split registry to be proved: it ENUMERATES, and what it
 * enumerates cannot collide.
 *
 * A request is recognised by one thing only — the sorted key set of its canonical content — so two
 * arms claiming the same key set would make which question Jev is asked depend on the order of this
 * file, and a key set spelled unsorted would never match at all. Both are defects here rather than a
 * silent misrouting at the wire. And every closed question the product NAMES (`MODEL_QUESTIONS`) has
 * an arm: a name with no arm is a request the adapter would throw on, found in this suite rather
 * than in a tenant's call.
 */
import { describe, expect, it } from "vitest";
import { MODEL_QUESTION_NAMES, MODEL_QUESTIONS } from "../questions";
import { TYPESAFE_ARMS } from "./registry";

const QUESTIONS: readonly string[] = Object.values(MODEL_QUESTIONS);

describe("the TypeSafe arm registry", () => {
  it("spells every arm's key set sorted, as a request's own keys are sorted before they are matched", () => {
    for (const arm of TYPESAFE_ARMS) {
      expect(arm.keys.length, `${arm.question} recognises a request by at least one key`).toBeGreaterThan(0);
      expect([...arm.keys], `${arm.question}'s key set is sorted by code unit`).toEqual([...arm.keys].sort());
    }
  });

  it("gives no two arms the same key set — the one thing a request is recognised by", () => {
    const spelled = TYPESAFE_ARMS.map((arm) => arm.keys.join("\u0000"));
    expect(new Set(spelled).size, `two arms recognise the same request: ${spelled.join(" | ")}`).toBe(spelled.length);
  });

  it("names one question per arm, and each is a question the product asks", () => {
    const named = TYPESAFE_ARMS.map((arm) => arm.question);
    for (const question of named) expect(QUESTIONS, `${question} is a member of MODEL_QUESTIONS`).toContain(question);
    expect(new Set(named).size, `two arms answer the same question: ${named.join(", ")}`).toBe(named.length);
  });

  it("has an arm for every question the product names — a name with no arm is a request nobody can ask", () => {
    const answered = new Set<string>(TYPESAFE_ARMS.map((arm) => arm.question));
    for (const name of MODEL_QUESTION_NAMES) {
      expect(answered.has(name), `${name} is named by MODEL_QUESTIONS and no arm answers it`).toBe(true);
    }
  });
});

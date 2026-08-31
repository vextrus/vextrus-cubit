/**
 * The registered answer this module refuses with, named by an executed test the day it registers,
 * so the refusal register records no orphan (Q-07, R-SPINE-062).
 *
 * It sits beside the module rather than in the database lane on purpose: Q-07's register reads its
 * corpus of "executed tests that name a code" from `src/` and `tests/`, so a code named nowhere but
 * `db/__tests__` is a code the register reports as unexercised. The live behaviour the code answers
 * for is proved against a real database in db/__tests__/member-removal.live.test.ts.
 *
 * B-19: nothing here freezes the roster. The entry's shape is asked of whatever the register holds,
 * so a severity or a surface a later increment adds is not fought by this file.
 */
import { describe, expect, it } from "vitest";
import { refusalCodeOf } from "../../../../../core/faults/refusal-marker";
import { REFUSALS } from "../../../../../core/errors";
import { memberHasActs } from "../refusals";

/** The code this module refuses with — the one literal, read back off the register below. */
const CODE = "MEMBER_HAS_ACTS";

/** The registry as a plain bag, so a code the register lacks is a missing entry, not a type error. */
const registry = REFUSALS as unknown as Readonly<Record<string, { code: string; message: string; remedy: string; severity: string; surface: string } | undefined>>;

describe("MEMBER_HAS_ACTS: the removal coupling's registered refusal", () => {
  it("is registered, carrying its own key and copy a person can act on", () => {
    const entry = registry[CODE];
    expect(entry, `${CODE} must be registered in src/core/errors.ts — the taxonomy is closed, so a code that is not there does not exist (R-SPINE-062, B-06)`).toBeDefined();
    expect(entry?.code, `${CODE}'s entry carries its own key as its code, so this module reads the value off the register instead of re-spelling it (Q-07)`).toBe(CODE);
    expect((entry?.message ?? "").trim(), `${CODE} must carry a non-empty message — what was refused, in one sentence a person reads`).not.toBe("");
    expect((entry?.remedy ?? "").trim(), `${CODE} must carry a non-empty remedy — the sentence that says what resolves it`).not.toBe("");
  });

  it("obeys the shape the register's other entries already use", () => {
    // Derived rather than transcribed: whatever severities and surfaces the taxonomy uses today are
    // what this entry may use (B-19).
    const others = Object.entries(registry).filter(([code]) => code !== CODE);
    const severities = new Set(others.map(([, held]) => held?.severity ?? ""));
    const surfaces = new Set(others.map(([, held]) => held?.surface ?? ""));

    const entry = registry[CODE];
    expect([...severities], `${CODE}'s severity must be one the register already uses`).toContain(entry?.severity ?? "");
    expect([...surfaces], `${CODE}'s surface must be one the register already uses`).toContain(entry?.surface ?? "");
    expect(Object.isFrozen(entry), `${CODE}'s entry is frozen — a refusal read at a transport or a screen is the registered answer, never a mutated one`).toBe(true);
  });

  it("is what the coupling's refusal carries, read by the one reader of the marker", () => {
    const refusal = memberHasActs({ subjectUserId: "9d5a1f7c-0b1e-4a3e-9a8b-6d2f1c4e5a70", actIds: ["c0ffee00-0000-4000-8000-000000000001"] });

    expect(refusalCodeOf(refusal), `the coupling's refusal must carry the registered ${CODE} marker, so the fault seam tells this answer from a fault (ARCH-03, B-21)`).toBe(
      registry[CODE]?.code,
    );
    expect(refusal.actIds, "the refusal names the acts it was refused over, as operator detail beside the code").toEqual(["c0ffee00-0000-4000-8000-000000000001"]);
    expect(refusal.subjectUserId, "the refusal names the membership it was refused over").toBe("9d5a1f7c-0b1e-4a3e-9a8b-6d2f1c4e5a70");
  });
});

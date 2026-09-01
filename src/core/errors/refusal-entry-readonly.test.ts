/**
 * R-SPINE-062: an entry read out of the closed registry is the registered answer, never a mutated
 * one. The registry is frozen at runtime and `RefusalEntry` is readonly at compile time — this file
 * is the compile-time half, so `pnpm verify`'s typecheck is its runner, with the runtime half beside
 * it so the unit lane reports the same fact.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS, refusalOf, type RefusalEntry } from "../errors";

/** Type identity — the only comparison that can see a `readonly` modifier at all. */
type IfEquals<X, Y, A, B> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;

/** True iff every field of `T` is already readonly: adding the modifier to all of them changes nothing. */
type EveryFieldReadonly<T> = IfEquals<{ readonly [K in keyof T]: T[K] }, { [K in keyof T]: T[K] }, true, false>;

/** A mutable field makes the two mapped types different, and this line the compile error (R-SPINE-062). */
export const refusalEntryIsReadonly: EveryFieldReadonly<RefusalEntry> = true;

describe("the registered refusal cannot be rewritten", () => {
  test("every entry is frozen and is the one refusalOf answers with", () => {
    const registered = Object.entries(REFUSALS);
    expect(registered.length, "the registry holds entries, or this file grades nothing").toBeGreaterThan(0);
    for (const [name, entry] of registered) {
      expect(Object.isFrozen(entry), `REFUSALS.${name} stays frozen — the readonly modifier is the type's half of the same fact`).toBe(true);
      expect(refusalOf(entry.code), `refusalOf answers with the registered entry for ${name}`).toBe(entry);
    }
  });

  test("the compile-time half is asserted, not merely declared", () => {
    expect(refusalEntryIsReadonly, "a mutable field would have made this file fail to compile").toBe(true);
  });
});

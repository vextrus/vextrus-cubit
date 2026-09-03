/**
 * The decoy the timing-equalising door spends (R-SPINE-001), judged where it lives.
 *
 * `absorbPassword` exists so that an address with no account costs what a wrong password costs. Held
 * as a promise, a derivation that *failed* was remembered as a rejection for the life of the process:
 * every later call threw at once, and the one door that exists to spend time became the fastest
 * answer in the tree. Only a settled decoy may be remembered — a failure must leave nothing behind.
 *
 * The derivation is driven through a `node:crypto` whose every other export is the real one, so the
 * hashing under test is the shipped hashing and only `scrypt`'s outcome is ours to choose.
 */
import { describe, expect, test, vi } from "vitest";

import { absorbPassword } from "./secrets";

/** What the swapped `scrypt` is told to do, and what it did — hoisted with the mock that reads it. */
const derivation = vi.hoisted(() => ({ calls: 0, failuresPending: 0 }));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  const scrypt = (...args: unknown[]): void => {
    derivation.calls += 1;
    if (derivation.failuresPending > 0) {
      derivation.failuresPending -= 1;
      const settle = args[args.length - 1] as (failure: Error) => void;
      settle(new Error("derivation refused"));
      return;
    }
    (actual.scrypt as unknown as (...rest: unknown[]) => void)(...args);
  };
  return { ...actual, scrypt };
});

describe("the decoy is memoised only once it has settled", () => {
  test("a refused derivation is retried on the next call; a settled one is derived no second time", async () => {
    derivation.failuresPending = 1;
    derivation.calls = 0;

    const refused = await absorbPassword("whatever-was-typed").then(
      () => null,
      (failure: unknown) => failure,
    );

    expect(refused, "a crypto seam that refuses is a failure the door reports, not one it hides").not.toBeNull();
    expect(derivation.calls, "the failure came from the decoy's own derivation").toBe(1);

    // Nothing was left behind: the next callers derive again, and this time it settles. They arrive
    // together, as a burst of unknown addresses does, and share the one derivation in flight — each
    // starting a scrypt of its own would multiply the cost of the door that exists to be expensive.
    const spent = derivation.calls;
    const burst = await Promise.all([
      absorbPassword("whatever-was-typed"),
      absorbPassword("whatever-was-typed"),
      absorbPassword("whatever-was-typed"),
    ]);
    expect(burst, "the door works again once the seam does").toEqual([undefined, undefined, undefined]);
    expect(derivation.calls - spent, "one decoy between the three of them, and one comparison each").toBe(4);

    // And a decoy that settled is kept: a later call pays for the comparison alone.
    const settled = derivation.calls;
    await absorbPassword("something-else-entirely");
    expect(derivation.calls - settled, "the remembered decoy is not derived a second time").toBe(1);
  });
});

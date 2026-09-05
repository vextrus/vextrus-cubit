/**
 * AC-3(a) and AC-3(c) of the src/core debt sweep: two of the seam's own invariants, each with one
 * home (B-17, ARCH-02, L-AI-01, L-AI-02).
 *
 * Beside the modules they judge because L-AI-01 makes src/core/model/ the one place the seam's
 * interior may be named: a suite anywhere else would have to reach past the barrel to load
 * `proposal.ts` and `canonical.ts` at all. The rest of AC-3 lives in src/core/invariant-homes.test.ts.
 */
import { describe, expect, test, vi } from "vitest";

/** The value a call threw, or undefined — no bare catch clause of the test's own (ARCH-03). */
const thrownBy = (work: () => unknown): unknown => {
  try {
    work();
    return undefined;
  } catch (thrown) {
    return thrown;
  }
};

describe("AC-3: the model seam's own invariants, each in one home", () => {
  test("AC-3(a): PROPOSAL_KIND is the process-wide symbol, so a Proposal crossing two loaded copies passes the other's kind check", async () => {
    vi.resetModules();
    const first = (await import("./proposal")) as { PROPOSAL_KIND: symbol };
    vi.resetModules();
    const second = (await import("./proposal")) as { PROPOSAL_KIND: symbol };

    expect(second, "two loads of the proposal module are two module instances — the very thing a bundled graph or a racing first import produces").not.toBe(first);
    expect(first.PROPOSAL_KIND, "the mark is registered on the process, not minted per instance (B-17)").toBe(Symbol.for("cubit.proposal"));
    expect(second.PROPOSAL_KIND, "…so the second copy exports the identical symbol").toBe(first.PROPOSAL_KIND);

    // The kind check as any holder makes it: a Proposal built under one copy must be recognised
    // under the other, which is the whole of what a per-instance symbol broke.
    const carried = { kind: first.PROPOSAL_KIND, payload: null, sources: ["DXF_HANDLE:1"], model: "m", callId: "c" };
    expect(carried.kind === second.PROPOSAL_KIND, "a Proposal from one copy passes the other copy's kind check").toBe(true);
    vi.resetModules();
  });

  test("AC-3(c): canonical refuses NaN and both infinities at any depth by path, and canonicalJson delegates", async () => {
    const consequence = (await import("../acts/consequence")) as { canonical: (value: unknown) => string };
    const spelling = (await import("./canonical")) as { canonicalJson: (value: unknown) => string };

    for (const unspellable of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const nested = { a: [{ z: 1 }, { b: [{ c: unspellable }] }] };

      const refused = thrownBy(() => consequence.canonical(nested));
      expect(refused, `canonical refuses ${String(unspellable)} rather than spelling it null — a digest over null identifies data nobody wrote (B-17)`).toBeInstanceOf(Error);
      const message = (refused as Error).message;
      expect(message, "…saying what is wrong with the value").toContain("is not a finite number");
      expect(message, "…and naming the path it sits at, from the value's own root").toContain("value.a[1].b[0].c");
      // The merged canonical.test.ts requires this message to name no seam of its own: the spelling
      // is shared, so it may not describe itself as any one caller's.
      expect(message.toLowerCase(), "…without naming the consequence seam, which is not its only caller").not.toContain("consequence");

      const alsoRefused = thrownBy(() => spelling.canonicalJson(nested));
      expect(alsoRefused, "canonicalJson delegates, so the two can never disagree about a non-finite number (ARCH-02)").toBeInstanceOf(Error);
      expect((alsoRefused as Error).message, "…saying the same thing about the same value").toContain("is not a finite number");
      expect((alsoRefused as Error).message, "…and keeping `value.` as its root path name, so the two name one path").toContain("value.a[1].b[0].c");
    }

    // The lawful spelling is unmoved: delegation is not a licence to respell.
    expect(consequence.canonical({ b: 2, a: [1, "x", null, true] }), "an ordinary value still canonicalises exactly as before").toBe('{"a":[1,"x",null,true],"b":2}');
  });
});

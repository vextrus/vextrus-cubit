// The marker's one writer beside its one reader (ARCH-02, ARCH-03, B-17, B-21).
import { describe, expect, it } from "vitest";
import { refusalOf, type RefusalCode } from "../errors";
import { isRefusalMarked, refusal, refusalCodeOf } from "./refusal-marker";

/** The value a synchronous call threw, or undefined when it returned — no catch clause of the test's own. */
const thrownBy = (call: () => unknown): Promise<unknown> =>
  Promise.resolve()
    .then(call)
    .then(
      () => undefined,
      (reason: unknown) => reason,
    );

describe("refusal() builds the marker the reader reads", () => {
  it("answers an Error carrying the registered code, the operator's message, and the detail's own properties", () => {
    const plain = refusal("FIXTURE_MISSING", "m");
    expect(plain).toBeInstanceOf(Error);
    expect(plain.message).toBe("m");
    expect(refusalCodeOf(plain)).toBe("FIXTURE_MISSING");
    expect(isRefusalMarked(plain)).toBe(true);

    const detailed = refusal("FIXTURE_MISSING", "with detail", { requestHash: "abc", attempt: 2 });
    expect(detailed.requestHash).toBe("abc");
    expect(detailed.attempt).toBe(2);
    expect(refusalCodeOf(detailed)).toBe("FIXTURE_MISSING");
  });

  it("fails for an unregistered code exactly as the registry does, and that failure is not a refusal", async () => {
    const unregistered = "NOT_A_REGISTERED_CODE" as RefusalCode;
    const fromHome = (await thrownBy(() => refusal(unregistered, "m"))) as Error;
    const fromRegistry = (await thrownBy(() => refusalOf(unregistered))) as Error;
    expect(fromHome).toBeInstanceOf(Error);
    expect(fromHome.message).toBe(fromRegistry.message);
    expect(refusalCodeOf(fromHome)).toBeNull();
  });
});

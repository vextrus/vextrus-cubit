// A request's identity refuses a figure JSON cannot spell (L-AI-01, B-17): NaN and the infinities
// are named by their path before the canonical spelling is asked for, so a hash never identifies a
// request nobody made.
import { describe, expect, it } from "vitest";
import { canonicalJson, requestHash } from "./canonical";
import type { ModelRequest } from "./types";

const NOT_FINITE = "is not a finite number";

/** The value a synchronous call threw, or undefined when it returned — no catch clause of the test's own. */
const thrownBy = (call: () => unknown): Promise<unknown> =>
  Promise.resolve()
    .then(call)
    .then(
      () => undefined,
      (reason: unknown) => reason,
    );

const request = (params: ModelRequest["params"]): ModelRequest => ({
  modelId: "claude-sonnet-5",
  system: "You read a bill of quantities.",
  messages: [{ role: "user", content: "Classify the line." }],
  params,
});

describe("canonicalJson and requestHash refuse a non-finite number by name", () => {
  it("names the path of the offending figure at any depth, and never the consequence digest", async () => {
    for (const figure of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const shallow = (await thrownBy(() => canonicalJson({ a: figure }))) as Error;
      expect(shallow, String(figure)).toBeInstanceOf(Error);
      expect(shallow.message).toContain(NOT_FINITE);
      expect(shallow.message).toContain("value.a");
      expect(shallow.message).not.toContain("consequence");

      const deep = (await thrownBy(() => canonicalJson({ a: [1, { b: [{ c: figure }] }] }))) as Error;
      expect(deep.message).toContain("value.a[1].b[0].c");

      const hashed = (await thrownBy(() => requestHash(request({ temperature: 0, nested: { deep: [figure] } })))) as Error;
      expect(hashed.message).toContain(NOT_FINITE);
      expect(hashed.message).toContain("params.nested.deep[0]");
    }
  });

  it("still hashes a finite request the same way whatever the key order", () => {
    const one = requestHash(request({ temperature: 0, max_tokens: 256 }));
    const other = requestHash(request({ max_tokens: 256, temperature: 0 }));
    expect(one).toBe(other);
    expect(one).toMatch(/^[0-9a-f]{64}$/);
  });
});

/**
 * AC-2(b) [debt-src-core-1qnx108] — a key the canon cannot spell is refused, never dropped.
 *
 * L-REG-04: "unchanged semantic → human dispositions carry across a rebuild; changed → the row
 * re-presents for disposition." A key whose value is `undefined` is a content JSON has no spelling
 * for, and dropping it silently is the one thing that clause forecloses: `{ a: undefined }` and `{}`
 * say different things and would carry one person's disposition of the second onto the first.
 *
 * The file already refuses a Date, a Map and a Set for exactly this reason. `undefined` is the same
 * fact, so it earns the same answer — and `null`, which JSON DOES spell, is content and survives.
 */
import { describe, expect, test } from "vitest";
import { canonicalSemantic, dispositionsCarry } from "./semantic";

/** The clause the refusal must cite, so an operator reading the throw is told which law it serves. */
const CLAUSE = "L-REG-04";

describe("a value the canon cannot spell is refused", () => {
  test("AC-2(b): a record key whose value is undefined throws, citing L-REG-04", () => {
    let thrown: unknown;
    try {
      canonicalSemantic({ a: undefined });
    } catch (failure) {
      thrown = failure;
    }
    expect(thrown, "a key JSON has no spelling for is refused rather than dropped — a dropped key carries a disposition of another content (L-REG-04)").toBeInstanceOf(Error);
    expect((thrown as Error).message, `the refusal cites the clause it serves (${CLAUSE})`).toContain(CLAUSE);
  });

  test("AC-2(b): an undefined value nested under a list or a deeper record is refused the same way", () => {
    expect(() => canonicalSemantic({ outer: { a: undefined } }), "the canon reads to every depth, so a key it cannot spell is refused wherever it stands").toThrow();
    expect(() => canonicalSemantic([{ a: undefined }]), "a list member's key is a key too").toThrow();
  });

  test("AC-2(b): null is content the canon spells, and it survives verbatim", () => {
    expect(canonicalSemantic({ a: null }), "null is a value JSON states; refusing it would refuse content the register legitimately carries").toBe('{"a":null}');
  });

  test("AC-2(b): the refusal is what keeps two different contents from sharing one semantic", () => {
    // The consequence the clause is about, stated as behaviour: were the key dropped, these two
    // contents would digest alike and a disposition of the second would carry onto the first.
    expect(() => dispositionsCarry({ a: undefined }, {}), "a content the canon cannot read answers no carry at all — it refuses (L-REG-04)").toThrow();
  });
});

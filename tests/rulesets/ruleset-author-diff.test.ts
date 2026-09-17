/**
 * What "what changed" MEANS when a rule-set edition is authored — the one reading the Author edition
 * screen draws its diff from and the AUTHOR_RULESET_EDITION act mints from (L-MEA-01, B-17).
 *
 * Three claims, and the first is the one the whole screen rests on: a row is CHANGED when its
 * authored decimal denotes a different quantity from its pinned one, never when its field was typed
 * in. `0.10` authored against a pin of `0.1` is no change at all, because L-MEA-01 keys an edition
 * over CONTENT and `0.10` is the same content. A diff that marked what was TOUCHED would preview an
 * author a change that did not happen.
 */
import { describe, expect, test } from "vitest";
import { authoredContent, diffParameters, editionDigest, type EditionParameter, type MethodPair } from "../../src/core/rulesets/editions";

/** A pin to author against: two parameters, in an order the diff must keep. */
const PIN: Readonly<Record<string, EditionParameter>> = Object.freeze({
  openingDeductionMinM2: { value: "0.1", unit: "m2" },
  memberEndNoDeductMaxCm2: { value: "500", unit: "cm2" },
});

const METHODS: readonly MethodPair[] = Object.freeze([{ ruleId: "probe.method.alpha", version: "1.0.0" }]);

describe("diffParameters: the whole pin, in the pin's order, marked on the decimal", () => {
  test("nothing stated is the pin itself, and no row is marked", () => {
    const rows = diffParameters(PIN, {});
    expect(rows.map((row) => row.key), "every parameter of the pin, in the pin's own order (I-264)").toEqual(Object.keys(PIN));
    expect(rows.map((row) => row.after), "an unstated field reads the pinned decimal").toEqual(["0.1", "500"]);
    expect(rows.map((row) => row.changed), "nothing was authored, so nothing moved").toEqual([false, false]);
    expect(rows.map((row) => row.unit), "the unit is copied from the pin and is never authored (I-265)").toEqual(["m2", "cm2"]);
  });

  test("a different decimal marks that row alone", () => {
    const rows = diffParameters(PIN, { openingDeductionMinM2: "0.25" });
    expect(rows.filter((row) => row.changed).map((row) => row.key)).toEqual(["openingDeductionMinM2"]);
    expect(rows[0]?.after, "the decimal is carried verbatim as it was stated").toBe("0.25");
    expect(rows[0]?.before, "…beside the pinned one it is judged against").toBe("0.1");
  });

  test("the SAME quantity spelled differently is not a change — the mark reads the decimal", () => {
    const rows = diffParameters(PIN, { openingDeductionMinM2: "0.10", memberEndNoDeductMaxCm2: "500.000" });
    expect(
      rows.map((row) => row.changed),
      "0.10 against a pin of 0.1 denotes the same quantity, so nothing was authored (L-MEA-01 keys content)",
    ).toEqual([false, false]);
  });

  test("a key the pin lacks, and a value that is no decimal, are faults rather than rows", () => {
    expect(() => diffParameters(PIN, { notAParameter: "1" })).toThrow(/no parameter of the pinned rule-set edition/);
    expect(() => diffParameters(PIN, { openingDeductionMinM2: "about a quarter" })).toThrow(/is not a decimal/);
  });
});

describe("authoredContent: a verbatim fork shares its parent's digest by construction (L-MEA-01)", () => {
  test("every field left as pinned digests to exactly what the pin digests to", () => {
    const forked = authoredContent(PIN, {}, METHODS);
    expect(editionDigest(forked)).toBe(editionDigest({ parameters: PIN, methods: METHODS }));
  });

  test("one decimal moved moves the digest, and the units and methods are the pin's", () => {
    const authored = authoredContent(PIN, { openingDeductionMinM2: "0.25" }, METHODS);
    expect(editionDigest(authored)).not.toBe(editionDigest({ parameters: PIN, methods: METHODS }));
    expect(authored.parameters["openingDeductionMinM2"]).toEqual({ value: "0.25", unit: "m2" });
    expect(authored.methods, "the methods in force are copied verbatim and are never authored (I-265)").toEqual(METHODS);
  });
});

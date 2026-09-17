// @vitest-environment node
/**
 * The law the Author edition screen's grid is drawn from, and the refusal authoring is stopped by.
 *
 * The mark on a row is the DECIMAL differing, never the field having been touched (§ 1.1): L-MEA-01
 * keys an edition by its CONTENT, so a figure authored back at its pin is no change — and a grid
 * that marked a touched field would preview a diff that did not happen.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { authoredContent, editionDigest } from "@/core/rulesets/editions";
import { authoredValues, diffParameters, sameFigure } from "@/modules/spine/ruleset-authoring";

const PINNED = {
  openingDeductionMinM2: { value: "0.1", unit: "m2" },
  memberEndNoDeductMaxCm2: { value: "500", unit: "cm2" },
};

describe("the diff a reader confirms (R-SPINE-012, L-MEA-01)", () => {
  test("every parameter of the pin stands, in the pin's own order, whatever was typed (I-264)", () => {
    const rows = diffParameters(PINNED, { openingDeductionMinM2: "0.25" });
    expect(rows.map((row) => row.key)).toEqual(["openingDeductionMinM2", "memberEndNoDeductMaxCm2"]);
    expect(rows.map((row) => row.changed)).toEqual([true, false]);
    expect(rows[0]?.before).toBe("0.1");
    expect(rows[0]?.after).toBe("0.25");
    // The unit is the pin's and is never authored (I-265).
    expect(rows.map((row) => row.unit)).toEqual(["m2", "cm2"]);
  });

  test("an unstated value reads as the pinned one, so nothing is marked before anything is typed", () => {
    expect(diffParameters(PINNED, {}).every((row) => !row.changed && row.after === row.before)).toBe(true);
  });

  test("a figure authored AT its pin is not a change, however it is spelled", () => {
    expect(diffParameters(PINNED, { openingDeductionMinM2: "0.10" })[0]?.changed).toBe(false);
    expect(sameFigure("0.1", "0.10")).toBe(true);
    expect(sameFigure("500", "500.0")).toBe(true);
    expect(sameFigure("0", "-0")).toBe(true);
    expect(sameFigure("0.1", "0.2")).toBe(false);
    // Something that is no figure at all is compared as written, never taken for equal.
    expect(sameFigure("", "0")).toBe(false);
  });

  test("a verbatim fork shares its parent's digest by construction (L-MEA-01)", () => {
    const parent = { parameters: PINNED, methods: [{ ruleId: "R-MEA-01", version: "1" }] };
    const rows = diffParameters(PINNED, {});
    expect(editionDigest(authoredContent(parent, authoredValues(rows)))).toBe(editionDigest(parent));
    const moved = diffParameters(PINNED, { openingDeductionMinM2: "0.25" });
    expect(editionDigest(authoredContent(parent, authoredValues(moved)))).not.toBe(editionDigest(parent));
  });

  test("authoring states values only: keys, units and methods are the parent's (I-265)", () => {
    const parent = { parameters: PINNED, methods: [{ ruleId: "R-MEA-01", version: "1" }] };
    const content = authoredContent(parent, { openingDeductionMinM2: "0.25", notAParameterOfThisEdition: "9" });
    expect(Object.keys(content.parameters)).toEqual(Object.keys(PINNED));
    expect(content.parameters["openingDeductionMinM2"]).toEqual({ value: "0.25", unit: "m2" });
    expect(content.methods).toEqual(parent.methods);
  });
});

describe("EDITION_VERSION_TAKEN (AM-04, L-MEA-01)", () => {
  test("the registry carries the Decision's copy verbatim, and it renders inline", () => {
    expect(REFUSALS.EDITION_VERSION_TAKEN).toEqual({
      code: "EDITION_VERSION_TAKEN",
      message: "This project already holds an edition with that version, so nothing was minted.",
      remedy: "Give this edition a version the project has not used, then author it again.",
      severity: "error",
      surface: "inline",
    });
  });
});

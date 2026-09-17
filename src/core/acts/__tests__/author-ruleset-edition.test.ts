// @vitest-environment node
/**
 * AUTHOR_RULESET_EDITION's law, proved where it needs no database (AM-04, L-MEA-01): the act is in
 * both total maps under the permission the amendment cuts for it, only LEAD and PRINCIPAL bundle
 * that permission, `EDITION_VERSION_TAKEN` travels as the registered refusal it is registered as,
 * and the two pure functions the act and the screen share agree about what changed.
 */
import { describe, expect, test } from "vitest";
import { ACT_MAP, ACT_PERMISSION, ACT_TYPES, PERMISSIONS, ROLE_PERMISSIONS, ROLES, editionVersionTaken } from "../index";
import { REFUSALS } from "../../errors";
import { refusalCodeOf } from "../../faults/refusal-marker";
import { authoredContent, diffParameters } from "../../rulesets/editions";

const ACT_TYPE = "AUTHOR_RULESET_EDITION";
const PERMISSION = "AUTHOR_RULE_SET";

/** A pin whose key order is not its alphabetical order, so "the pin's own order" is checkable. */
const PIN = {
  openingDeductionMinM2: { value: "0.1", unit: "m2" },
  blindingThickness: { value: "0.075", unit: "m" },
} as const;

describe("AM-04: the act, the permission and the bundles", () => {
  test("the act type is declared, rendered, and moves AUTHOR_RULE_SET", () => {
    expect(ACT_TYPES, "AM-04 gives the enum the act that mints an edition").toContain(ACT_TYPE);
    expect(PERMISSIONS, "…and the closed permission enum the permission it moves").toContain(PERMISSION);
    expect(ACT_PERMISSION[ACT_TYPE], "AM-04 replaces the staged reading that used ADMINISTER_PROJECT").toBe(PERMISSION);
    expect(typeof ACT_MAP[ACT_TYPE].preview, "L-ACT-02: every act type is a pair").toBe("function");
    expect(typeof ACT_MAP[ACT_TYPE].commit, "L-ACT-02: every act type is a pair").toBe("function");
  });

  test("only LEAD and PRINCIPAL bundle it, and no other shipped role moved", () => {
    const holders = ROLES.filter((role) => ROLE_PERMISSIONS[role].includes(PERMISSION));
    expect([...holders].sort(), "AM-04 bundles it into LEAD and PRINCIPAL and into no other shipped role").toEqual(["LEAD", "PRINCIPAL"]);
  });
});

describe("L-MEA-01: a version this project already holds is an answer, not a fault", () => {
  test("EDITION_VERSION_TAKEN is registered and travels as the settled refusal marker", () => {
    const entry = REFUSALS.EDITION_VERSION_TAKEN;
    expect(entry.code, "the register is keyed by the code itself").toBe("EDITION_VERSION_TAKEN");
    expect(entry.message, "the taxonomy code is never user-facing copy (refusal-state § 3)").not.toContain("EDITION_VERSION_TAKEN");
    expect(entry.remedy, "nor is it the remedy").not.toContain("EDITION_VERSION_TAKEN");
    expect(refusalCodeOf(editionVersionTaken("2026.09", "IS1200_IN")), "it is an answer the transport carries back, never an outage").toBe(
      "EDITION_VERSION_TAKEN",
    );
  });
});

describe("what authoring moves: one home for the diff and for the content", () => {
  test("the whole pin is diffed, in the pin's own order, and only a moved decimal is marked", () => {
    const rows = diffParameters(PIN, { openingDeductionMinM2: "0.25" });
    expect(
      rows.map((row) => row.key),
      "a diff that hides what did not move cannot be read (I-264)",
    ).toEqual(["openingDeductionMinM2", "blindingThickness"]);
    expect(rows.map((row) => row.changed)).toEqual([true, false]);
    expect(rows[0]?.after, "the stated decimal, verbatim").toBe("0.25");
    expect(rows[1]?.after, "an unstated value is the value in force, never a blank").toBe("0.075");
  });

  test("a decimal retyped in another form has moved nothing", () => {
    expect(diffParameters(PIN, { openingDeductionMinM2: "0.10" }).every((row) => !row.changed), "0.10 and 0.1 are one allowance").toBe(true);
  });

  test("units and methods are the pin's and are never authored (I-265)", () => {
    const methods = [{ ruleId: "L-MEA-09", version: "1" }];
    const content = authoredContent(PIN, { openingDeductionMinM2: "0.25" }, methods);
    expect(content.parameters.openingDeductionMinM2, "the stated value under the PIN's unit").toEqual({ value: "0.25", unit: "m2" });
    expect(content.methods, "the pairs in force are copied verbatim").toEqual(methods);
  });

  test("a key the pin does not hold is a fault, not an answer", () => {
    expect(() => diffParameters(PIN, { notAParameter: "1" })).toThrow(/holds no parameter/);
  });

  test("a value that is not a decimal is a fault, not an answer", () => {
    expect(() => diffParameters(PIN, { openingDeductionMinM2: "a quarter" })).toThrow(/is not a decimal/);
  });
});

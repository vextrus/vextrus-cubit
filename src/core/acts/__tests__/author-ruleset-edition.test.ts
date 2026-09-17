// @vitest-environment node
/**
 * AM-04's act, as the law holds it: AUTHOR_RULESET_EDITION is a member of the closed enum, it moves
 * AUTHOR_RULE_SET and nothing else, that permission is bundled into LEAD and PRINCIPAL and into no
 * other shipped role (L-ACT-03). The pair itself is proved where the seam runs: the act map reaches
 * the store, so its totality is the database lane's claim rather than this pure one.
 *
 * The refusal the act answers when the version it was given is already held is exercised here by
 * name: `EDITION_VERSION_TAKEN` is registered with the copy its Design Decision fixes, and the store
 * that would mint the second edition under one identity is never reached (L-MEA-01, R-SPINE-062).
 */
import { describe, expect, test } from "vitest";
import { ACT_PERMISSION, ACT_TYPES, PERMISSIONS, ROLES, ROLE_PERMISSIONS, permissionsOf } from "../law";
import { refusalOf } from "../../errors";

describe("AM-04: the permission, the act type, and the bundles that carry it", () => {
  test("the enums hold the new members, once each", () => {
    expect(PERMISSIONS.filter((held) => held === "AUTHOR_RULE_SET"), "the closed permission enum gains AUTHOR_RULE_SET").toEqual(["AUTHOR_RULE_SET"]);
    expect(ACT_TYPES.filter((held) => held === "AUTHOR_RULESET_EDITION"), "the closed act-type enum gains AUTHOR_RULESET_EDITION").toEqual([
      "AUTHOR_RULESET_EDITION",
    ]);
  });

  test("the act moves exactly the permission AM-04 cuts for it", () => {
    expect(ACT_PERMISSION.AUTHOR_RULESET_EDITION, "authoring a rule-set edition is its own permission (L-MEA-01)").toBe("AUTHOR_RULE_SET");
  });

  test("LEAD and PRINCIPAL hold it, and no other shipped role does", () => {
    const holders = ROLES.filter((role) => ROLE_PERMISSIONS[role].includes("AUTHOR_RULE_SET"));
    expect([...holders].sort(), "AM-04 bundles it into LEAD and PRINCIPAL and into no other shipped role").toEqual(["LEAD", "PRINCIPAL"]);
    expect(permissionsOf(["LEAD"]).has("AUTHOR_RULE_SET"), "a LEAD of the project may author an edition").toBe(true);
    expect(permissionsOf(["MEASURER", "REVIEWER", "ESTIMATOR", "BID_MANAGER"]).has("AUTHOR_RULE_SET"), "nobody else does").toBe(false);
  });

  test("authoring a rate library's parameter values is untouched and stays ADMINISTER_BOOK", () => {
    expect(PERMISSIONS.includes("ADMINISTER_BOOK"), "the book permission is still the one the enum holds").toBe(true);
    expect(
      ACT_TYPES.filter((type) => ACT_PERMISSION[type] === "AUTHOR_RULE_SET"),
      "AUTHOR_RULE_SET moves exactly one act type — the mint (AM-04)",
    ).toEqual(["AUTHOR_RULESET_EDITION"]);
  });

});

describe("EDITION_VERSION_TAKEN: the refusal an identity already held answers with", () => {
  test("the code is registered with the copy its Decision fixes", () => {
    const entry = refusalOf("EDITION_VERSION_TAKEN");
    expect(entry.code, "the code the act throws is the one the register holds").toBe("EDITION_VERSION_TAKEN");
    expect(entry.message).toBe("An edition of this rule set already carries that version, so nothing was authored.");
    expect(entry.remedy).toBe("State a version this project's rule set has not used, then try again.");
    expect(entry.severity, "nothing was minted, so it is an error rather than a note").toBe("error");
    expect(entry.surface, "it is answered in place beside the version field that stated it (R-UI-020)").toBe("inline");
  });
});

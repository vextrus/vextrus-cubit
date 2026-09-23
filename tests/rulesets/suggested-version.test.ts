/**
 * The Author edition screen's version example (s-settings-ruleset-author I-326, R-UI-021): the field
 * states what the act needs before it is pressed, by offering the next version after the pin as its
 * placeholder. The example is never a value — these cases judge only that it is a plausible next
 * spelling, and that a version with no obvious successor offers none rather than inventing one.
 */
import { describe, expect, test } from "vitest";
import { SEED_EDITION_IDENTITY } from "@/core/rulesets/seed";
import { suggestedVersion } from "@/modules/spine/ruleset-authoring";

describe("suggestedVersion — the version field's example (I-326)", () => {
  test("a YYYY.MM version advances one month, and December rolls into the next year", () => {
    expect(suggestedVersion("2027.03")).toBe("2027.04");
    expect(suggestedVersion("2026.09")).toBe("2026.10");
    expect(suggestedVersion("2026.12")).toBe("2027.01");
  });

  test("the seed's own version has a successor, so the screen a fresh project opens on offers one", () => {
    const next = suggestedVersion(SEED_EDITION_IDENTITY.version);
    expect(next, `the seed stands at ${SEED_EDITION_IDENTITY.version}`).not.toBeNull();
    expect(next).not.toBe(SEED_EDITION_IDENTITY.version);
  });

  test("any other version advances its last run of digits, keeping its width", () => {
    expect(suggestedVersion("v1")).toBe("v2");
    expect(suggestedVersion("site-rev-009")).toBe("site-rev-010");
    expect(suggestedVersion("2027.13")).toBe("2027.14");
  });

  test("a version with no trailing digits offers no example rather than inventing one", () => {
    expect(suggestedVersion("draft")).toBeNull();
    expect(suggestedVersion("")).toBeNull();
  });
});

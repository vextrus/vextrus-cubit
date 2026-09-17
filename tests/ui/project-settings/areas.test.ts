/**
 * The project settings sub-navigation's roster (`PROJECT_SETTINGS_AREAS`): four areas, in the order
 * a reader meets them, each either a place or a promise — and availability READ off the address
 * rather than written beside it (B-17, R-UI-031, the `home/areas.ts` law).
 *
 * This is the roster the frozen nav is graded against: an area added, removed or reordered moves
 * this file, which is what makes the change visible to the Design Decision that pictures it.
 */
import { describe, expect, test } from "vitest";
import { PROJECT_SETTINGS_AREAS } from "../../../src/app/(app)/t/[tenant]/p/[project]/settings/areas";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";

describe("PROJECT_SETTINGS_AREAS", () => {
  test("the four areas stand in the order the frame draws them", () => {
    expect(PROJECT_SETTINGS_AREAS.map((area) => area.key)).toEqual(["ruleset", "participants", "site-facts", "ruleset-author"]);
  });

  test("each area is named by the words its own screen is named by", () => {
    expect(PROJECT_SETTINGS_AREAS.map((area) => area.label)).toEqual(["Rule set", "Participants", "Site facts", "Author edition"]);
  });

  test("an area with a screen leads to that screen's own address", () => {
    const addressed = PROJECT_SETTINGS_AREAS.filter((area) => area.route !== null).map((area) => area.route?.(TENANT, PROJECT));
    expect(addressed).toEqual([
      `/t/${TENANT}/p/${PROJECT}/settings/ruleset`,
      `/t/${TENANT}/p/${PROJECT}/settings/participants`,
      `/t/${TENANT}/p/${PROJECT}/settings/ruleset-author`,
    ]);
  });

  test("exactly one area is a promise, and it is the one inc-304b gives an address", () => {
    expect(PROJECT_SETTINGS_AREAS.filter((area) => area.route === null).map((area) => area.key)).toEqual(["site-facts"]);
  });
});

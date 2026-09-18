// @vitest-environment jsdom
/**
 * PUBLIC ACCEPTANCE for inc-304a-ruleset-authoring-ui-hotfix-a1 — AC-3.
 *
 * The hotfix undoes nothing inc-304a shipped. J-304 walks two surfaces, and this file mounts both
 * and asks them what that journey asks, in the lane that costs seconds rather than a browser:
 *
 *   the project settings nav — four rows in one order, `site-facts` a promise and not a place;
 *   the Author edition screen — a preview that opens the act's own dialog and mints through it,
 *   and `EDITION_VERSION_TAKEN` answered IN PLACE with nothing the reader typed thrown away.
 *
 * WHAT IS PINNED AND WHAT IS DERIVED. The four areas and their order are PINNED, and deliberately:
 * AC-3 spells them out because the thing being guarded is that this leaf did not reorder, rename or
 * drop one of them. Deriving the order from `PROJECT_SETTINGS_AREAS` would let exactly the defect
 * being guarded through, so the roster is read from the product as well and the two are made to
 * agree — a fifth area appended by a later increment fails here, which is when this file's owner
 * changes with the law it froze (B-20). Everything else is derived: the addresses come from the
 * roster's own route builders, and the refusal's words from the product's own registry.
 *
 * WHAT THIS FILE DOES NOT ASSERT. `pnpm e2e --journey J-304` exiting 0 is the gate's journey stage —
 * a build, a seeded tenant and a browser, which no jsdom mount may stand in for. What is judged here
 * is the CONTRACT that journey reads, so a red arrives in seconds rather than in twelve minutes.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PROJECT_SETTINGS_AREAS } from "@/app/(app)/t/[tenant]/p/[project]/settings/areas";
import { projectSettingsNavItems } from "@/app/(app)/t/[tenant]/p/[project]/settings/layout";
import {
  RulesetAuthorSection,
  type AuthorParentEdition,
  type RulesetAuthorSectionProps,
} from "@/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author/ruleset-author-section";
import { SettingsPane } from "@/app/(app)/t/[tenant]/settings/settings-pane";
import { refusalOf } from "@/core/errors";
import { TESTIDS } from "@/ui/testids";

const TENANT = "5eed0000-0000-4000-8000-000000000001";
const PROJECT = "5eed0000-0000-4000-8000-0000000000a1";

/** The act this screen carries, as the contract and the Decision spell it (`data-act-type`). */
const ACT_TYPE = "AUTHOR_RULESET_EDITION";

/** The four areas, in the order AC-3 fixes — the nav J-304 walks, row for row. */
const AREA_ORDER = ["ruleset", "participants", "site-facts", "ruleset-author"] as const;

/** The one area inc-304b gives an address; here it is a promise the nav keeps visible. */
const UNBUILT = "site-facts";

afterEach(cleanup);

/** Every nav row the document holds, in the order it holds them. */
function navRows(): HTMLElement[] {
  return screen.getAllByTestId(TESTIDS.settings.area);
}

function renderNav(active: string): void {
  render(
    <SettingsPane active={active} items={projectSettingsNavItems(TENANT, PROJECT)}>
      {null}
    </SettingsPane>,
  );
}

/** The pin the Author screen forks: an edition identity, its content digest, and its parameters. */
const PIN: AuthorParentEdition = Object.freeze({
  identity: Object.freeze({ scope: "project" as const, name: "IS1200_IN", version: "2026.08" }),
  digest: "a3f9c2d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
  parameters: Object.freeze({
    openingDeductionMinM2: Object.freeze({ value: "0.1", unit: "m2" }),
    memberEndNoDeductMaxCm2: Object.freeze({ value: "500", unit: "cm2" }),
  }),
});
const MINTED_DIGEST = "b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3";
const CONSEQUENCE_DIGEST = "d1e2f3a4b5c6d7e8f9012a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f";

interface Doors {
  readonly previewed: { version: string; values: Readonly<Record<string, string>> }[];
  readonly committed: { version: string; values: Readonly<Record<string, string>>; consequenceDigest: string }[];
  readonly preview: RulesetAuthorSectionProps["preview"];
  readonly commit: RulesetAuthorSectionProps["commit"];
}

/**
 * The two doors, answering in the actions' own types — so a shape that drifts fails to compile here
 * rather than passing silently — and recording what they were asked. Staged in this file rather than
 * borrowed from the module's own support, because what a Builder may edit cannot also be what judges
 * the Builder.
 */
function doors(options: { refuseWith?: "EDITION_VERSION_TAKEN" } = {}): Doors {
  const previewed: Doors["previewed"] = [];
  const committed: Doors["committed"] = [];
  return {
    previewed,
    committed,
    preview: async (request) => {
      previewed.push({ version: request.version, values: request.values });
      if (options.refuseWith !== undefined) return { previewed: false, refusal: options.refuseWith };
      return {
        previewed: true,
        consequence: {
          actType: ACT_TYPE,
          tenantId: TENANT,
          projectId: request.projectId,
          rendering: "SUBJECTS",
          subjects: [
            {
              subjectId: request.projectId,
              subjectLabel: `${PIN.identity.name} @ ${request.version}`,
              before: [`${PIN.identity.name} @ ${PIN.identity.version}`, PIN.digest],
              after: [`${PIN.identity.name} @ ${request.version}`, MINTED_DIGEST],
            },
          ],
        },
        consequenceDigest: CONSEQUENCE_DIGEST,
      };
    },
    commit: async (request) => {
      committed.push({ version: request.version, values: request.values, consequenceDigest: request.consequenceDigest });
      return { committed: true, actId: "9c1e0000-0000-4000-8000-00000000ac01" };
    },
  };
}

/** The Author edition screen as its page mounts it, with the two doors staged. */
function mountAuthor(staged: Doors): void {
  render(
    <RulesetAuthorSection
      commit={staged.commit}
      mayAuthor
      parent={PIN}
      participantsHref={`/t/${TENANT}/p/${PROJECT}/settings/participants`}
      preview={staged.preview}
      projectId={PROJECT}
      rulesetHref={`/t/${TENANT}/p/${PROJECT}/settings/ruleset`}
    />,
  );
}

describe("AC-3: the screen J-304 walks is unchanged in contract", () => {
  test("AC-3: the project settings nav is four `settings-area` rows, in the order the contract fixes", () => {
    renderNav("ruleset");
    expect(
      navRows().map((row) => row.getAttribute("data-area")),
      "the rows J-304 reads are these four areas in this order — reordering, renaming or dropping one is the regression this guards",
    ).toEqual([...AREA_ORDER]);
    // The roster and the rendered nav are one thing: a row drawn from somewhere else would let the
    // two disagree, which is what having one roster (I-259) is for.
    expect(PROJECT_SETTINGS_AREAS.map((entry) => entry.area), "the product's own roster no longer spells the contract's four areas").toEqual([...AREA_ORDER]);
  });

  test("AC-3: `site-facts` is a promise, not a place; the other three are links to their own addresses", () => {
    renderNav("ruleset");
    for (const [at, area] of AREA_ORDER.entries()) {
      const row = navRows()[at] as HTMLElement;
      if (area === UNBUILT) {
        expect(row.getAttribute("data-unbuilt"), `${area} has no address in this increment — inc-304b gives it one`).toBe("true");
        expect(row.getAttribute("aria-disabled"), `${area} is shown disabled, never hidden (R-SPINE-006)`).toBe("true");
        expect(row.getAttribute("href"), `${area} must carry no address while no screen answers for it`).toBeNull();
        expect(row.tagName.toLowerCase(), `${area} is no link`).not.toBe("a");
        continue;
      }
      expect(row.tagName.toLowerCase(), `${area} has an address, so it is a link`).toBe("a");
      expect(row.getAttribute("href"), `${area} must answer at its own address under the project's settings`).toBe(`/t/${TENANT}/p/${PROJECT}/settings/${area}`);
      expect(row.getAttribute("data-unbuilt"), `${area} is built`).toBeNull();
    }
  });

  test("AC-3: `ruleset-author-section` previews and mints an edition through AUTHOR_RULESET_EDITION", async () => {
    const staged = doors();
    mountAuthor(staged);

    fireEvent.change(screen.getByTestId(TESTIDS.rulesetAuthor.version), { target: { value: "2026.09" } });
    fireEvent.click(screen.getByTestId(TESTIDS.rulesetAuthor.submit));

    // L-ACT-02: the act is carried in the one consequence dialog, and the dialog says which act.
    const dialog = await screen.findByTestId(TESTIDS.consequence.dialog);
    expect(dialog.getAttribute("data-act-type"), "the dialog names the act it is confirming").toBe(ACT_TYPE);

    const confirm = await screen.findByTestId(TESTIDS.consequence.confirm);
    expect(confirm.getAttribute("data-digest"), "the confirmation is bound to the consequence it was shown").toBe(CONSEQUENCE_DIGEST);
    fireEvent.click(confirm);

    await waitFor(() => expect(staged.committed, "pressing confirm carries the act").toHaveLength(1));
    // What is minted is exactly what the reader read: the version stated, every parameter of the pin
    // under its own key, and the digest of the consequence that was shown (I-265).
    expect(staged.committed[0]).toEqual({
      version: "2026.09",
      values: Object.fromEntries(Object.entries(PIN.parameters).map(([key, parameter]) => [key, parameter.value])),
      consequenceDigest: CONSEQUENCE_DIGEST,
    });
  });

  test("AC-3: EDITION_VERSION_TAKEN is refused in place, and nothing the reader stated is cleared", async () => {
    const staged = doors({ refuseWith: "EDITION_VERSION_TAKEN" });
    mountAuthor(staged);

    fireEvent.change(screen.getByTestId(TESTIDS.rulesetAuthor.version), { target: { value: "2026.08" } });
    fireEvent.click(screen.getByTestId(TESTIDS.rulesetAuthor.submit));

    const taken = refusalOf("EDITION_VERSION_TAKEN");
    await waitFor(() => expect(screen.getByTestId(TESTIDS.rulesetAuthor.refusal).textContent).toContain(taken.message));
    expect(screen.getByTestId(TESTIDS.rulesetAuthor.refusal).textContent, "a refusal says what to do about it (R-UI-020)").toContain(taken.remedy);
    expect(screen.queryAllByTestId(TESTIDS.consequence.dialog), "a refused preview opens no dialog (I-267)").toHaveLength(0);
    expect(staged.committed, "nothing is carried to the act by a refused preview").toHaveLength(0);
    expect((screen.getByTestId(TESTIDS.rulesetAuthor.version) as HTMLInputElement).value, "a refusal that emptied the form is the work done twice").toBe("2026.08");
    expect(
      screen.getByTestId(TESTIDS.rulesetAuthor.section).parentElement?.getAttribute("data-state"),
      "the screen stands in its refused state, in place",
    ).toBe("refused");
  });
});

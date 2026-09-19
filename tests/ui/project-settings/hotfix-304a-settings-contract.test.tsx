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
 * TEST_AMENDED (arbitration, this increment — AC-3). This file was written against an AC-3 that read
 * "`pnpm e2e --journey J-304` STILL exits 0 … the screen it walks is unchanged in contract", and the
 * word "still" carried an implied freeze of the screen's PICTURES. The evidence falsified its
 * premise: at the fork point, before any edit, J-304 was already red — `toHaveScreenshot(expected)
 * failed — 27402 pixels … s-settings-ruleset-author/authoring-open.png`. The three divergences are
 * the BASELINE's staleness, not a regression of this leaf: the picture shows 36 px diff rows where
 * the Decision's §1 rules `--row-h` 28 and the screen renders 28; an ungrouped `20000` where the
 * `format` prop inc-304a added to NumberInput renders `20,000`; and a parent at `IS1200_IN @
 * 2027.01` where the platform seed has stood at 2027.02 since inc-307, which merged BEFORE inc-304a.
 * B-20 vests the re-take in the increment that changed the design, and B-19 makes a snapshot of
 * "what existed today" asserted as a timeless invariant a TEST_INTEGRITY defect. The freeze is
 * struck. AC-3 now reads: J-304 exits 0, and exits 0 on a SECOND CONSECUTIVE run, with the four
 * pictures re-taken under B-20 in one `baseline:`-subject commit naming the proof, paired with the
 * changelog line in docs/design/s-settings-ruleset-author.md; and every contract assertion J-304
 * makes passes UNMODIFIED, the re-take altering no assertion but the picture.
 *
 * So the contract limbs below stand exactly as they were written — that is the amendment's own
 * requirement — and two limbs are added: the pin and its rows, which the ruling enumerates among the
 * contract J-304 reads, and the re-take itself, which is now owed rather than merely permitted.
 *
 * WHAT THIS FILE DOES NOT ASSERT. `pnpm e2e --journey J-304` exiting 0 — twice, consecutively — is
 * the gate's journey stage: a build, a seeded tenant and a browser, which no jsdom mount may stand
 * in for. What is judged here is the CONTRACT that journey reads, so a red arrives in seconds rather
 * than in twelve minutes. The second run is not decorative and is not a retry: the reported spread
 * (27402 / 27332 / 21878 px) is content that VARIES between runs, and AM-09 (4) rules the lane
 * deterministic, so the cure is to mask the varying region in the page object BEFORE the re-take —
 * re-freezing a drifting region would be a fresh TEST_INTEGRITY defect, and a second green run is
 * what shows it was cured rather than re-frozen. Neither masking nor the commit subject is a
 * question a unit test may put; both are the journey lane's and the structural gate's.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
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
import { FORK_POINT, FORK_POINT_DIGESTS } from "./support/hotfix-304a-fork-point";

/** The checkout this suite judges. `tests/ui/project-settings/` is three levels below it. */
const ROOT = resolve(import.meta.dirname, "..", "..", "..");

const TENANT = "5eed0000-0000-4000-8000-000000000001";
const PROJECT = "5eed0000-0000-4000-8000-0000000000a1";

/** This increment's id, as the amended AC-3 requires the Decision's changelog line to name it. */
const INCREMENT = "inc-304a-ruleset-authoring-ui-hotfix-a1";

/** The Decision the re-take is paired with, and the four pictures the arbitration names by name. */
const DECISION = "docs/design/s-settings-ruleset-author.md";
const PICTURES = ["authoring-open", "authoring-open-light", "value-changed", "edition-minted"].map(
  (shot) => `tests/e2e/baselines/design-dark/s-settings-ruleset-author/${shot}.png`,
);

/** The act this screen carries, as the contract and the Decision spell it (`data-act-type`). */
const ACT_TYPE = "AUTHOR_RULESET_EDITION";

/** The four areas, in the order AC-3 fixes — the nav J-304 walks, row for row. */
const AREA_ORDER = ["ruleset", "participants", "site-facts", "ruleset-author"] as const;

/** The one area inc-304b gives an address; here it is a promise the nav keeps visible. */
const UNBUILT = "site-facts";

afterEach(cleanup);

/** The SHA-256 of a file's bytes, to be set beside the one the fork-point manifest recorded. */
function digestOf(file: string): string {
  // white-box: AC-3 — "re-taken" is a property of BYTES and of nothing else: a PNG baseline has no
  // behaviour to drive, and whether the picture the arbitration ordered has actually been re-taken
  // can only be asked of its bytes. Nothing of the content is asserted on, or even decoded. The
  // paths passed here are two: tests/e2e/baselines/** and docs/design/** — never src/ or db/.
  return createHash("sha256").update(readFileSync(join(ROOT, file))).digest("hex");
}

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

describe("AC-3: the screen J-304 walks keeps its contract, and its stale pictures are re-taken under it", () => {
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

  test("AC-3: the pin stands whole — its digest on `ruleset-author-parent`, and a diff row per pinned parameter", () => {
    mountAuthor(doors());

    // Two of the assertions the arbitration enumerates as the contract J-304 reads, and which the
    // re-take must leave untouched: the parent's content digest whole in the document (I-262 — a
    // truncated digest compares nothing), and the diff as the WHOLE pin rather than the moved rows
    // (I-264). The roster is the pin's own keys, so a parameter added to a pin is judged with it.
    const parent = screen.getByTestId(TESTIDS.rulesetAuthor.parent);
    expect(parent.getAttribute("data-digest"), "the pin being forked names the content it is a fingerprint of").toBe(PIN.digest);
    expect(parent.textContent, "the digest stands unabbreviated in the document beside its identity").toContain(PIN.digest);
    expect(parent.textContent, "and the identity it belongs to").toContain(`${PIN.identity.name} @ ${PIN.identity.version}`);

    expect(
      screen.getAllByTestId(TESTIDS.rulesetAuthor.diffRow).map((row) => row.getAttribute("data-param")),
      "the diff is every parameter of the pin, in the pin's own order — changed rows are marked, never filtered",
    ).toEqual(Object.keys(PIN.parameters));
  });

  test("AC-3: the four Author-edition pictures are re-taken under B-20, and the Decision records why", () => {
    // TEST_AMENDED: this limb replaces the freeze the struck "still" implied. At the fork point
    // J-304 was ALREADY red on these pictures, and the arbitration put the re-take on this
    // increment rather than on a follow-up: J-000 gates every merge on J-304, so deferring it would
    // merge a red gate. What is owed is therefore the opposite of what a freeze would ask — these
    // four files must DIFFER from the bytes main left, and the Decision must say so.
    const stale: string[] = [];
    for (const picture of PICTURES) {
      expect(existsSync(join(ROOT, picture)), `${picture} is missing — a picture is re-taken, never dropped`).toBe(true);
      const was = FORK_POINT_DIGESTS[picture];
      expect(was, `${picture} was not recorded in the fork-point manifest taken at ${FORK_POINT}`).toBeTypeOf("string");
      if (digestOf(picture) === was) stale.push(picture);
    }
    expect(
      stale,
      `these pictures still carry main's bytes. They pre-date the screen inc-304a shipped and J-304 is red against them: the diff rows are 36 px where the Decision's §1 rules \`--row-h\` 28, the figure is an ungrouped \`20000\` where the \`format\` prop renders \`20,000\`, and the parent is \`IS1200_IN @ 2027.01\` where the seed has stood at 2027.02 since inc-307. Mask the varying region in tests/e2e/pages/s-settings-ruleset-author.page.ts FIRST — the reported spread (27402 / 27332 / 21878 px) is a drift, and re-freezing it would be a fresh TEST_INTEGRITY defect — then re-take all four in one \`baseline:\`-subject commit naming the proof (B-20)`,
    ).toEqual([]);

    // white-box: AC-3 — the criterion names a CHANGELOG LINE in a document as half of the re-take's
    // proof ("paired with the changelog line in docs/design/s-settings-ruleset-author.md"). A
    // document's text is the only place that line can be; it is this increment's own Decision, not
    // product source, and no behaviour of the product can show whether it was written.
    const decision = readFileSync(join(ROOT, DECISION), "utf8");
    const line = decision.split("\n").find((held) => held.includes(INCREMENT)) ?? "";
    expect(
      line,
      `${DECISION} carries no changelog line naming ${INCREMENT}. B-20 pairs the re-take with the amendment in place: the line records that the first edition's pictures pre-dated the screen it shipped, so the next reader knows the images moved lawfully and why`,
    ).not.toBe("");
    expect(line.trim().length, `the changelog line in ${DECISION} says too little to be the proof: ${JSON.stringify(line.trim())}`).toBeGreaterThan(40);
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

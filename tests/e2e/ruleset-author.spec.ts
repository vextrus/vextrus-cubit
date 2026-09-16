// J-304 — authoring a project's rule-set edition (R-SPINE-012, L-MEA-01, AM-04), walked as a person
// walks it: sign in, create a project, open the rule set it pinned from the row menu, take the
// settings nav to Author edition, move one parameter, carry the act through the one
// ConsequenceDialog, and read the minted edition back on the screen the act moved.
//
// The gate runs `pnpm e2e --journey J-304`, and Playwright exits 1 on an unmatched grep — so the
// J-304 tag in the titles below is what makes that stage runnable at all.
//
// AC-1 and AC-2 are ONE test because AC-2 says so ("J-304 continues on the same page"): the act is
// performed on the screen AC-1 arrived at, and a second sign-in would be a second walk rather than
// the continuation the criterion names.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { TESTIDS } from "../../src/ui/testids";
import { SHomePage, S_HOME } from "./pages/s-home.page";
import { ShellPage, SHELL } from "./pages/shell.page";
import { PROJECT_SETTINGS_AREA_ORDER, SRulesetAuthorPage, S_RULESET_AUTHOR, areaAddress } from "./pages/s-settings-ruleset-author.page";
import { baselinePath, laneProject } from "./support/capture-geometry";
import { checkpoint } from "./support/checkpoint";
import { emulateTheme, restoreLaneTheme } from "./support/lane-theme";
import { everyAttribute, heldAttribute, steadyCount, steadyText } from "./support/retrying-read";
import { signInAsSeededTenant } from "./support/seeded-session";
import { settled } from "./support/settled";

/** The width R-UI-030 paints the frame at, and the geometry §1 of both Decisions is ruled in. */
test.use({ viewport: { width: 1440, height: 900 } });

/** The page crumb this screen is named by (`project_settings_area_ruleset_author`, verbatim). */
const AUTHOR_EDITION = "Author edition";

/** The parameter this walk moves, and what it is moved to — the pin carries it at 0.1 m². */
const MOVED_PARAMETER = "openingDeductionMinM2";
const MOVED_VALUE = "0.25";

/** The version the authored edition is minted under, stated by the author (AC-2). */
const AUTHORED_VERSION = "2026.09";

/** The act the one dialog opens for (L-ACT-02's pair), as the dialog publishes it. */
const ACT_TYPE = "AUTHOR_RULESET_EDITION";

/** The status line's copy once the act has been carried out (Decision § 3, `ruleset_author_status_done`). */
const DONE = `Done. The project now reads version ${AUTHORED_VERSION}.`;

/** The area the disabled row is for — the one inc-304b gives an address (`route: null` here). */
const UNBUILT = "site-facts";

test.describe("J-304 — the project settings nav, and authoring the edition a project reads", () => {
  test("J-304: AC-1: the nav and the Author edition screen · AC-2: one value authored and the edition minted", async ({ page, baseURL }, testInfo) => {
    // V-E2E's per-journey ceiling, stated where it is spent: AC-2 asks this walk to stay under 90 s.
    test.setTimeout(90_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const shell = new ShellPage(page);
    const home = new SHomePage(page);
    const author = new SRulesetAuthorPage(page);

    /* --- this worker's seeded identity, and a project of its own to author on --- */
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    await shell.open(SHELL.home);
    await shell.workspaceDoor.click();
    await page.waitForURL(/\/t\/[0-9a-f-]{36}$/);
    const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
    expect(tenantId, "the workspace door leads to the workspace this person holds").not.toBe("");

    const projectName = `Rule set ${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    await home.createWith({ name: projectName, code: "RA-001", client: "Sattva Holdings", district: "Dhaka", buildingType: 1, storeys: "9" });
    const card = home.cardNamed(projectName);
    await expect(card, "the created project stands on S-Home").toBeVisible();
    const projectId = (await heldAttribute(card, "data-project")) ?? "";
    expect(projectId, "the card names the project it is for").not.toBe("");

    /* --- the pin, through the row menu's own door (R-UI-031: never a typed URL) --- */
    await (await home.openRowMenu(projectId)).getByTestId(TESTIDS.sHome.projectRuleset).click();
    await expect(page).toHaveURL(`${origin}${S_HOME.ruleset(tenantId, projectId)}`);
    await settled(page);

    // What the project is pinned to, read off the screen that publishes it — the walk carries this
    // forward instead of spelling a digest or a parameter roster of its own (B-19): a seeded edition
    // that gains a parameter grows this expectation with it.
    const pinnedDigest = await steadyText(author.editionDigest, "the pinned edition's content digest");
    expect(pinnedDigest, "the pin publishes the digest its content keys (L-MEA-01)").not.toBe("");
    const pinnedParameters = await everyAttribute(author.parameterRows, "data-param", "the pinned edition's parameter rows", { min: 1 });
    const lineageBefore = await steadyCount(author.lineageSteps, "the lineage of the pinned edition", { min: 1 });

    /* --- the project settings nav: four areas, in the roster's order (sub-navigation § 1) --- */
    const areas = await everyAttribute(author.areas, "data-area", "the project settings nav rows", { min: 1 });
    expect(areas, "the nav renders exactly the areas PROJECT_SETTINGS_AREAS declares, in its order").toEqual([...PROJECT_SETTINGS_AREA_ORDER]);

    for (const area of PROJECT_SETTINGS_AREA_ORDER) {
      const row = author.area(area);
      const address = areaAddress(area, tenantId, projectId);
      if (address === null) {
        // The promise not yet kept: shown, never hidden, and disabled with its reason (I-259).
        expect(area, "the one area with no address is the one inc-304b gives one").toBe(UNBUILT);
        expect(await heldAttribute(row, "data-unbuilt"), `${area} states that it is not built`).toBe("true");
        expect(await heldAttribute(row, "aria-disabled"), `${area} says so to a screen reader as well`).toBe("true");
        expect(await heldAttribute(row, "href"), `${area} is no link: an area with no address carries none`).toBeNull();
        await expect(author.areaLink(area), `${area} is not an anchor — availability is read off the address (I-259)`).toHaveCount(0);
      } else {
        await expect(author.areaLink(area), `${area} is a link, because it has somewhere to go`).toHaveCount(1);
        expect(await heldAttribute(row, "href"), `${area} leads to that screen's own address`).toBe(address);
      }
    }
    expect(await heldAttribute(author.area("ruleset"), "aria-current"), "the nav names where the reader is, and this is the rule-set screen").toBe("page");

    /* --- AC-1: the door is the nav row, and the screen it opens on --- */
    await author.area("ruleset-author").click();
    await expect(page).toHaveURL(`${origin}${S_RULESET_AUTHOR.route(tenantId, projectId)}`);
    await settled(page);
    await expect(author.crumbPage, "the trail names the page a reader landed on (R-UI-084)").toHaveText(AUTHOR_EDITION);
    await expect(author.area("ruleset-author"), "…and the nav says the same thing").toHaveAttribute("aria-current", "page");
    await expect(author.section, "the authoring section stands").toBeVisible();

    expect(await heldAttribute(author.parent, "data-digest"), "the screen opens on what is being forked: the pin's own content digest (I-262)").toBe(pinnedDigest);

    await expect(author.diff, "the diff grid stands").toBeVisible();
    expect(
      await everyAttribute(author.diffRows, "data-param", "the diff rows", { min: 1 }),
      "one row per parameter of the pin, in the pin's own order — a diff that hides what did not move cannot be read (I-264)",
    ).toEqual(pinnedParameters);
    expect(
      await everyAttribute(author.diffRows, "data-changed", "the diff rows' marks"),
      "nothing has been typed, so no row is marked as moved",
    ).toEqual(pinnedParameters.map(() => "false"));
    await expect(author.version, "the version field opens empty — a version is stated, never guessed").toHaveValue("");

    await checkpoint(page, testInfo, "s-settings-ruleset-author/authoring-open");
    await expect(page).toHaveScreenshot(["s-settings-ruleset-author", "authoring-open.png"], { mask: author.masks(), animations: "disabled" });

    /* --- the light twin, taken in this lane by emulation (I-RSA-4, the gallery's precedent) --- */
    await emulateTheme(page, "light");
    await settled(page);
    await expect(page.locator("html"), "the document states the theme it is painting in").toHaveAttribute("data-theme", "light");
    await checkpoint(page, testInfo, "s-settings-ruleset-author/authoring-open-light");
    await expect(page).toHaveScreenshot(["s-settings-ruleset-author", "authoring-open-light.png"], { mask: author.masks(), animations: "disabled" });
    await restoreLaneTheme(page, testInfo);
    await settled(page);

    /* --- AC-2: a version, and one value moved --- */
    await author.version.fill(AUTHORED_VERSION);
    await author.value(MOVED_PARAMETER).fill(MOVED_VALUE);
    // Blur, because the authored field states its figure the way the column beside it reads one
    // (R-UI-010's lakh/crore-on-blur rule) — the mark is judged on the value the field has settled at.
    await author.version.focus();
    await settled(page);

    const moved = author.row(MOVED_PARAMETER);
    expect(await heldAttribute(moved, "data-changed"), `${MOVED_PARAMETER} is marked as moved`).toBe("true");
    expect(await heldAttribute(moved, "data-after"), "…carrying the decimal that was stated, verbatim").toBe(MOVED_VALUE);
    expect(await heldAttribute(moved, "data-before"), "…and it IS a different decimal from the pinned one, or nothing was authored at all").not.toBe(MOVED_VALUE);
    const marks = await everyAttribute(author.diffRows, "data-changed", "the diff rows' marks");
    const params = await everyAttribute(author.diffRows, "data-param", "the diff rows");
    expect(
      params.filter((_, at) => marks[at] === "true"),
      "that row alone is marked: typing in one field moves no other row (I-263)",
    ).toEqual([MOVED_PARAMETER]);
    await expect(author.version, "the version the author stated stands in the field").toHaveValue(AUTHORED_VERSION);

    await checkpoint(page, testInfo, "s-settings-ruleset-author/value-changed");
    await expect(page).toHaveScreenshot(["s-settings-ruleset-author", "value-changed.png"], { mask: author.masks(), animations: "disabled" });

    /* --- the act: previewed as a Consequence, committed with the digest it rendered (L-ACT-02) --- */
    await author.submit.click();
    await expect(author.dialog, "the one primary previews rather than committing (R-UI-021)").toBeVisible();
    await expect(author.dialog, "…and the dialog says which act it is for").toHaveAttribute("data-act-type", ACT_TYPE);
    await expect(author.subjectRows, "…over the subject the Consequence names").not.toHaveCount(0);
    await author.confirm.click();

    await expect(author.status, "the act's answer is spoken in place, never as a toast (R-UI-020)").toContainText(DONE);

    /* --- and the screen the act moved says the same thing (R-SPINE-012) --- */
    await author.seeRuleset.click();
    await expect(page).toHaveURL(`${origin}${S_HOME.ruleset(tenantId, projectId)}`);
    await settled(page);
    await expect(author.editionIdentity, "the project now reads the edition that was just minted").toContainText(AUTHORED_VERSION);
    const lineageAfter = await steadyCount(author.lineageSteps, "the lineage after the mint", { min: 1 });
    expect(lineageAfter, "the minted edition is a step ON the chain it was forked from, never a replacement of it").toBe(lineageBefore + 1);
    expect(lineageAfter, "platform → tenant → project → project (AC-2)").toBe(4);

    await checkpoint(page, testInfo, "s-settings-ruleset-author/edition-minted");
    await expect(page).toHaveScreenshot(["s-settings-ruleset-author", "edition-minted.png"], { mask: author.masks(), animations: "disabled" });
  });

  /**
   * AC-2's B-20 half. The project settings nav gains two rows on every screen it frames, and
   * `j-003/ruleset-pin-visible.png` is a picture of one of them — so the committed baseline is not
   * the bytes it was before this increment, and B-20 puts that re-take on the branch that owns the
   * image, in its own `baseline:` commit.
   *
   * This states ONE thing: the bytes moved. It is a negative, so a later increment that lawfully
   * re-bases again still passes, and only a branch that shipped the grown nav while leaving the
   * picture untouched fails. Whether the new bytes picture the standing screen is V-E2E's own
   * instrument — the comparison J-003 itself runs against this file.
   */
  test("J-304: AC-2: the j-003 rule-set baseline was re-taken for the nav's two new rows (B-20)", () => {
    // white-box: AC-2 — the criterion is about the BYTES of a committed picture, and a picture has no
    // behaviour to drive; the file itself is what the claim is about.
    const wasSha256 = "d93520cd31438aeadd604708e3effe3470abfc83096570e76af68a73ec8dc8f2";
    // WHERE the picture lives is `snapshotPathTemplate`'s fact and this spec does not restate it:
    // `baselinePath()` answers for the lane this run walks, so the proof follows the directory.
    const baseline = baselinePath(laneProject(test.info().project.name), "j-003", "ruleset-pin-visible.png");
    const now = createHash("sha256").update(readFileSync(join(process.cwd(), baseline))).digest("hex");
    expect(
      now,
      `${baseline} is byte-for-byte what it was before this increment. The project settings nav this increment builds renders four rows where that picture holds two, so the baseline must be re-taken (B-20) in its own \`baseline:\` commit.`,
    ).not.toBe(wasSha256);
  });
});

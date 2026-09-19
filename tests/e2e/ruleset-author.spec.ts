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
import { formatUserFigure } from "../../src/core/format";
import { TESTIDS } from "../../src/ui/testids";
import { SHomePage, S_HOME } from "./pages/s-home.page";
import { ShellPage, SHELL } from "./pages/shell.page";
import { PROJECT_SETTINGS_AREA_ORDER, type ProjectSettingsArea, SRulesetAuthorPage, S_RULESET_AUTHOR, areaAddress } from "./pages/s-settings-ruleset-author.page";
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

// TEST_AMENDED (inc-304b-site-facts-panel, AC-5): the `site-facts` row was the one area with no
// address, and this walk asserted the disabled idiom on it. inc-304b gives that area its route, so
// the branch is gone and the roster is walked as four addressed rows — the assertion the nav's own
// rule always made, with nothing left to except from it (B-20).

/**
 * Where the nav says the reader is, read as a WHOLE LIST on whichever screen the nav is framing.
 *
 * "This row is current" is only half of `aria-current`'s rule and the weaker half: a nav that marks
 * EVERY built row satisfies it on every row, and then tells a screen reader nothing at all — the
 * attribute exists to single one out. So the reading compared here is the list across all four rows,
 * and the expectation is derived from `PROJECT_SETTINGS_AREAS`' own order against the area whose
 * address the page is at — never a spelled position, so a roster that grows or is reordered carries
 * this with it. An absent attribute reads as the empty string (`everyAttribute`'s contract), which
 * is exactly what a row that is not where the reader is must publish.
 */
async function expectNavCurrent(author: SRulesetAuthorPage, at: ProjectSettingsArea): Promise<void> {
  expect(
    await everyAttribute(author.areas, "data-area", `the project settings nav rows, framing the ${at} screen`, { min: 1 }),
    "the nav renders the roster's areas in the roster's order on every screen it frames",
  ).toEqual([...PROJECT_SETTINGS_AREA_ORDER]);
  expect(
    await everyAttribute(author.areas, "aria-current", `the project settings nav's current row, framing the ${at} screen`, { min: 1 }),
    `exactly one row says where the reader is, and it is the row whose address this page is at (${at})`,
  ).toEqual(PROJECT_SETTINGS_AREA_ORDER.map((area) => (area === at ? "page" : "")));
}

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
    // What the project READS today, parameter by parameter — the figures the act is about. AC-2 comes
    // back to this map after the commit: the edition the act minted is the one the author stated, or
    // the screen previewed a diff it never carried.
    const pinnedFigures = await author.parameterFigures();
    const lineageBefore = await steadyCount(author.lineageSteps, "the lineage of the pinned edition", { min: 1 });

    /* --- the project settings nav: four areas, in the roster's order (sub-navigation § 1) --- */
    const areas = await everyAttribute(author.areas, "data-area", "the project settings nav rows", { min: 1 });
    expect(areas, "the nav renders exactly the areas PROJECT_SETTINGS_AREAS declares, in its order").toEqual([...PROJECT_SETTINGS_AREA_ORDER]);

    for (const area of PROJECT_SETTINGS_AREA_ORDER) {
      const row = author.area(area);
      const address = areaAddress(area, tenantId, projectId);
      // Every area of the roster is addressed since inc-304b gave the site facts panel its route, so
      // every row is an anchor to the screen it names and none of them states that it is unbuilt.
      expect(address, `${area} is an area of this product, so it has somewhere to go (I-259)`).not.toBeNull();
      await expect(author.areaLink(area), `${area} is a link, because it has somewhere to go`).toHaveCount(1);
      expect(await heldAttribute(row, "href"), `${area} leads to that screen's own address`).toBe(address);
      expect(await heldAttribute(row, "data-unbuilt"), `${area} is built, and says nothing about not being so`).toBeNull();
      expect(await heldAttribute(row, "aria-disabled"), `${area} is not disabled to a screen reader either`).toBeNull();
    }
    await expectNavCurrent(author, "ruleset");

    /* --- AC-1: the door is the nav row, and the screen it opens on --- */
    await author.area("ruleset-author").click();
    await expect(page).toHaveURL(`${origin}${S_RULESET_AUTHOR.route(tenantId, projectId)}`);
    await settled(page);
    await expect(author.crumbPage, "the trail names the page a reader landed on (R-UI-084)").toHaveText(AUTHOR_EDITION);
    // …and the nav has moved its one mark with the reader: `ruleset-author` current, `ruleset` no
    // longer so. A nav that marked every row passed the line this replaced.
    await expectNavCurrent(author, "ruleset-author");
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

    /* --- the mark is the DECIMAL DIFFERING, never the field having been touched --- */
    // The rule, stated so that the wrong body cannot pass: a row is changed WHEN its authored decimal
    // differs from its pinned decimal, and UNCHANGED when the two are equal — whatever was typed into
    // it. A grid that marks a row because its field is non-empty satisfies every assertion above, and
    // then previews to the author a diff that did not happen: L-MEA-01's edition keys CONTENT, so a
    // figure authored back AT the pin is no change, and R-SPINE-012's diff view is the reading the
    // author confirms in the dialog. The figures typed here are the rows' own `data-before`, read off
    // the screen — never a decimal this spec spells (B-19).
    const pinnedBefore = await everyAttribute(author.diffRows, "data-before", "the diff rows' pinned figures", { min: 1 });
    const movedBefore = pinnedBefore[params.indexOf(MOVED_PARAMETER)] ?? "";
    expect(movedBefore, `${MOVED_PARAMETER} publishes the pinned decimal its mark is judged against`).not.toBe("");
    // A SECOND row, so the rule is proven on a row this walk never moved as well as on the one it did.
    // Which row that is comes from the pin: the first one that is not the moved row and publishes a
    // pinned figure — a roster that grows or is reordered still finds one.
    const controlAt = params.findIndex((param, at) => param !== MOVED_PARAMETER && (pinnedBefore[at] ?? "") !== "");
    const control = controlAt < 0 ? null : (params[controlAt] as string);
    const controlBefore = controlAt < 0 ? "" : (pinnedBefore[controlAt] as string);

    await author.value(MOVED_PARAMETER).fill(movedBefore);
    if (control !== null) await author.value(control).fill(controlBefore);
    await author.version.focus();
    await settled(page);

    expect(
      await heldAttribute(moved, "data-changed"),
      `${MOVED_PARAMETER} authored at its own pinned figure (${movedBefore}) is NOT a change — the mark reads the decimal, not whether the field was typed in`,
    ).toBe("false");
    expect(await heldAttribute(moved, "data-after"), "…and the figure it publishes as authored is that same decimal").toBe(movedBefore);
    if (control !== null) {
      const controlRow = author.row(control);
      expect(
        await heldAttribute(controlRow, "data-changed"),
        `${control} authored at its own pinned figure (${controlBefore}) is NOT a change either — a row this walk never moved is marked on the same rule`,
      ).toBe("false");
      expect(await heldAttribute(controlRow, "data-after"), `${control}'s authored figure is the pinned one it was given`).toBe(controlBefore);
      expect(await heldAttribute(controlRow, "data-before"), `…and the pin it is judged against has not moved under it`).toBe(controlBefore);
    }
    expect(
      (await everyAttribute(author.diffRows, "data-changed", "the diff rows' marks, every field authored at its pin")).filter((mark) => mark === "true"),
      "every authored decimal now equals its pinned one, so the diff holds nothing: a marked row here is a diff of what was TOUCHED rather than of what MOVED",
    ).toEqual([]);

    /* --- and back: the mark follows the decimal in both directions --- */
    await author.value(MOVED_PARAMETER).fill(MOVED_VALUE);
    if (control !== null) await author.value(control).fill("");
    await author.version.focus();
    await settled(page);
    const marksAgain = await everyAttribute(author.diffRows, "data-changed", "the diff rows' marks, one figure moved off its pin again");
    expect(
      params.filter((_, at) => marksAgain[at] === "true"),
      `${MOVED_PARAMETER} differs from its pin again and is marked again, and it alone — the state the act is carried in`,
    ).toEqual([MOVED_PARAMETER]);
    expect(await heldAttribute(moved, "data-after"), "…carrying the decimal that was stated, verbatim").toBe(MOVED_VALUE);
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

    /* --- the minted edition's CONTENT is what was authored, not what was pinned --- */
    // Identity and content are two facts and neither stands for the other (L-MEA-01), so a new
    // version number on the pin line is not proof that the figure the author stated is the figure the
    // act minted. A screen that previews the diff off one state and submits the pin's own values
    // mints a VERBATIM fork under 2026.09 — a real edition, a real lineage step, a real version — and
    // every other assertion of this walk stands. These two are what it cannot pass: the digest keys
    // content, so a value that moved MOVES it; and the grid the project reads shows the authored
    // figure where it moved and the pinned one everywhere else.
    expect(
      await steadyText(author.editionDigest, "the digest of the edition the project now reads"),
      "a value moved, so the content digest moved with it — an edition minted from the pin's own values carries the pin's digest by construction (L-MEA-01), and that is not what was authored",
    ).not.toBe(pinnedDigest);
    const authoredFigures = await author.parameterFigures();
    expect(Object.keys(authoredFigures), "the authored edition carries the pin's parameters, no more and no fewer").toEqual(Object.keys(pinnedFigures));
    expect(
      authoredFigures[MOVED_PARAMETER],
      `${MOVED_PARAMETER} reads the figure that was stated on the authoring screen (${MOVED_VALUE} through the one formatter), never the pinned one`,
    ).toContain(formatUserFigure(MOVED_VALUE));
    expect(
      authoredFigures[MOVED_PARAMETER],
      "…and it is no longer the line the pin read: this is the whole of what the act was for",
    ).not.toBe(pinnedFigures[MOVED_PARAMETER]);
    expect(
      Object.fromEntries(Object.entries(authoredFigures).filter(([key]) => key !== MOVED_PARAMETER)),
      "every other parameter reads exactly what it read before the act — authoring states values and copies keys, units and methods from the pin (I-265)",
    ).toEqual(Object.fromEntries(Object.entries(pinnedFigures).filter(([key]) => key !== MOVED_PARAMETER)));

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

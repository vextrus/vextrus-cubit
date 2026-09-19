// J-305 — the project's Site facts panel (AM-06 §1, L-MEA-06, L-ACT-01/02/03), walked as a person
// walks it: sign in, create a project, take S-Project's Settings tab into the settings area, click
// the nav row this increment gives an address, read six facts that nobody has entered — each one a
// NAMED deferral rather than a default — and then enter the ground level as an act, through the one
// ConsequenceDialog, on the screen that shows the deferral.
//
// The gate runs `pnpm e2e --journey J-305`, and Playwright exits 1 on an unmatched grep — so the
// J-305 tag in the titles below is what makes that stage runnable at all.
//
// AC-4 and AC-5 are ONE test because AC-5 says so ("same spec, continuing"): the act is performed on
// the screen AC-4 arrived at, and a second sign-in would be a second walk rather than the
// continuation the criterion names.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { REFUSALS } from "../../src/core/errors";
import { SITE_FACTS } from "../../src/core/site-facts/law";
import { dimensionOf, UNITS } from "../../src/core/units/canon";
import { PROJECT_SETTINGS_AREA_NAMES, PROJECT_SETTINGS_PAGES } from "../../src/ui/shell/routes";
import { SHomePage } from "./pages/s-home.page";
import { ShellPage, SHELL } from "./pages/shell.page";
import { SProjectPage, S_PROJECT } from "./pages/s-project.page";
import { SSiteFactsPage, S_SITE_FACTS, SITE_FACTS_AREA } from "./pages/s-settings-site-facts.page";
import { baselinePath, laneProject } from "./support/capture-geometry";
import { checkpoint } from "./support/checkpoint";
import { everyAttribute, heldAttribute, steadyText } from "./support/retrying-read";
import { signInAsSeededTenant } from "./support/seeded-session";
import { settled } from "./support/settled";

/** The width R-UI-030 paints the frame at, and the geometry §1 of the Decision is ruled in. */
test.use({ viewport: { width: 1440, height: 900 } });

/** The act this panel performs, as the one dialog publishes it (`data-act-type`). */
const ACT_TYPE = "AUTHOR_SITE_FACT";

/** The screen's one helper line, verbatim (`site_facts_face`, the Decision § 3). */
const FACE = "Earthwork is unpriceable from drawings alone until these site facts are entered.";

/** What a row says about where its figure came from (§ 1.1): entered by a person, or not yet stated. */
const ABSENT = "ABSENT";
const ENTERED = "ENTERED";

/** The fact this walk enters, and the reading and note it is entered with. */
const WALKED = { fact: "GROUND_LEVEL", value: "-1.2", unit: "m", note: "Survey sheet S-01" } as const;

/**
 * The register entry an ABSENT fact defers under, as I-B rules it: the ground level and the water
 * table are each named by the rail's own code for them, and every other site fact is an earthwork
 * parameter the edition may also state — so it defers under that one. A rule rather than a roster:
 * a seventh fact is judged by it the day it ships (B-19).
 */
const deferralFor = (fact: string): string =>
  fact === "GROUND_LEVEL" ? "GROUND_LEVEL_UNSTATED" : fact === "WATER_TABLE" ? "WATER_TABLE_UNSTATED" : "EARTHWORK_PARAMETER_UNSTATED";

/** The deferral map the panel renders an absent fact through, loaded from the module that owns it (I-279). */
async function deferrals(): Promise<Readonly<Record<string, string>>> {
  const module = (await import("../../src/modules/takeoff/site-facts-ui/deferrals")) as { SITE_FACT_DEFERRALS?: Readonly<Record<string, string>> };
  const map = module.SITE_FACT_DEFERRALS;
  expect(map, "the panel renders an absent fact as the deferral its own map names (I-279)").toBeDefined();
  return map ?? {};
}

/**
 * Where the nav says the reader is, read as a WHOLE LIST — the J-304 idiom, and for its reason: "this
 * row is current" is the weaker half of `aria-current`, satisfied by a nav that marks every row. The
 * expectation is derived from the roster's own order against the area the page is at, so a roster
 * that grows or is reordered carries this with it.
 */
async function expectNavCurrent(facts: SSiteFactsPage, at: string): Promise<void> {
  expect(
    await everyAttribute(facts.areas, "data-area", "the project settings nav rows", { min: 1 }),
    "the nav renders the roster's areas in the roster's order on every screen it frames",
  ).toEqual([...PROJECT_SETTINGS_AREA_NAMES]);
  expect(
    await everyAttribute(facts.areas, "aria-current", "the project settings nav's current row", { min: 1 }),
    `exactly one row says where the reader is, and it is the row whose address this page is at (${at})`,
  ).toEqual(PROJECT_SETTINGS_AREA_NAMES.map((area) => (area === at ? "page" : "")));
}

test.describe("J-305 — the project's site facts: six deferrals, and the act that answers one", () => {
  test("J-305: AC-4: the panel reached from the nav, every fact deferred by name · AC-5: entering one is an act", async ({ page, baseURL }, testInfo) => {
    // V-E2E's per-journey ceiling, stated where it is spent.
    test.setTimeout(90_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const shell = new ShellPage(page);
    const home = new SHomePage(page);
    const project = new SProjectPage(page);
    const facts = new SSiteFactsPage(page);
    const SITE_FACT_DEFERRALS = await deferrals();

    /* --- this worker's seeded identity, and a project of its own to enter a fact on --- */
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    await shell.open(SHELL.home);
    await shell.workspaceDoor.click();
    await page.waitForURL(/\/t\/[0-9a-f-]{36}$/);
    const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
    expect(tenantId, "the workspace door leads to the workspace this person holds").not.toBe("");

    const projectName = `Site facts ${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    await home.createWith({ name: projectName, code: "SF-001", client: "Sattva Holdings", district: "Dhaka", buildingType: 1, storeys: "9" });
    const card = home.cardNamed(projectName);
    await expect(card, "the created project stands on S-Home").toBeVisible();
    const projectId = (await heldAttribute(card, "data-project")) ?? "";
    expect(projectId, "the card names the project it is for").not.toBe("");

    /* --- AC-4: S-Project's Settings tab lands on the settings area, and the nav row is now a door --- */
    await project.open(tenantId, projectId);
    await settled(page);
    await project.tab("settings").click();
    await expect(page).toHaveURL(`${origin}${S_PROJECT.ruleset(tenantId, projectId)}`);
    await settled(page);

    const siteFactsRow = facts.area(SITE_FACTS_AREA);
    await expect(facts.areaLink(SITE_FACTS_AREA), "the area has an address now, so its row is an anchor (I-259)").toHaveCount(1);
    expect(await heldAttribute(siteFactsRow, "href"), "…and the anchor leads to this screen's own address").toBe(S_SITE_FACTS.route(tenantId, projectId));
    expect(await heldAttribute(siteFactsRow, "data-unbuilt"), "a promise kept states nothing about being unbuilt").toBeNull();
    expect(await heldAttribute(siteFactsRow, "aria-disabled"), "…and is not disabled to a screen reader either").toBeNull();

    /* --- the door is the nav row, clicked: never a typed URL (R-UI-031) --- */
    await siteFactsRow.click();
    await expect(page).toHaveURL(`${origin}${S_SITE_FACTS.route(tenantId, projectId)}`);
    await settled(page);

    expect(await heldAttribute(facts.screen, "data-state"), "a fresh project's panel is answered, not empty: six facts, each with its deferral (§ 2)").toBe("ready");
    await expect(facts.crumbPage, "the trail names the page a reader landed on (R-UI-084)").toHaveText(PROJECT_SETTINGS_PAGES[SITE_FACTS_AREA]);
    await expectNavCurrent(facts, SITE_FACTS_AREA);
    expect(await steadyText(facts.face, "the screen's one helper line"), "the face states L-MEA-06's consequence in one line").toBe(FACE);

    /* --- the roster, by enumeration: the panel lists what the ledger's law holds (I-278, B-19) --- */
    expect(
      await everyAttribute(facts.rows, "data-fact", "the site fact rows", { min: 1 }),
      "one row per fact of SITE_FACTS, in the roster's own order — a seventh fact appears here with no edit",
    ).toEqual([...SITE_FACTS]);

    /* --- every fact absent, and every absence a NAMED deferral through the one renderer (R-UI-020) --- */
    // The RULE, not the map (I-B): an absent fact defers under the register entry the earthwork rail
    // defers under when that fact is absent — the ground level and the water table each under their
    // own, and every other member of the roster under the earthwork parameter's. The expectation is
    // derived per fact, so a seventh member of SITE_FACTS is JUDGED here rather than accepted, and
    // the Builder's own map is compared against the rule rather than standing in for it (B-19).
    expect(SITE_FACTS.map((fact) => SITE_FACT_DEFERRALS[fact]), "the deferral map is the rule I-B states, fact for fact, and total over the roster").toEqual(
      SITE_FACTS.map(deferralFor),
    );

    expect(await everyAttribute(facts.rows, "data-basis", "the rows' bases", { min: 1 }), "nothing has been entered, so nothing is ENTERED").toEqual(
      SITE_FACTS.map(() => ABSENT),
    );
    for (const fact of SITE_FACTS) {
      const code = deferralFor(fact);
      expect(REFUSALS[code as keyof typeof REFUSALS], `${fact} defers under a code the closed register holds (${code})`).toBeDefined();
      await expect(facts.rowDeferral(fact), `${fact} is deferred in place, in its own row`).toBeVisible();
      expect(await heldAttribute(facts.deferralRefusal(fact), "data-code"), `${fact} names the deferral it stands under`).toBe(code);
      await expect(facts.deferralEvidence(fact), "a refusal always carries the way to resolve it (R-UI-020)").toHaveCount(1);
      await expect(facts.rowValue(fact), `${fact} renders no figure: an absent fact is a deferral, never a default (AM-06 §1)`).toHaveCount(0);
    }

    await checkpoint(page, testInfo, "s-settings-site-facts/panel-absent");
    await expect(page).toHaveScreenshot(["s-settings-site-facts", "panel-absent.png"], { mask: facts.masks(), animations: "disabled" });

    /* --- the light twin, taken in this lane through the instrument's own flag (AM-08, I-D) --- */
    await page.goto(`${S_SITE_FACTS.route(tenantId, projectId)}?__theme=light`);
    await settled(page);
    await expect(page.locator("html"), "the document states the theme it is painting in").toHaveAttribute("data-theme", "light");
    await checkpoint(page, testInfo, "s-settings-site-facts/panel-absent-light");
    await expect(page).toHaveScreenshot(["s-settings-site-facts", "panel-absent-light.png"], { mask: facts.masks(), animations: "disabled" });

    await page.goto(S_SITE_FACTS.route(tenantId, projectId));
    await settled(page);

    /* --- AC-5: the ground level, entered as an act (AM-06 §1: one act per fact, with its note) --- */
    await facts.enter(WALKED.fact).click();
    await expect(facts.value, "the row's own form opens under it (I-281)").toBeVisible();
    await facts.value.fill(WALKED.value);

    await facts.unit.click();
    expect(
      await everyAttribute(facts.unitOptions, "data-value", "the unit options", { min: 1 }),
      "the units offered are the canon's LENGTH units, in the canon's own order — a site fact is a length (L-MEA-06)",
    ).toEqual(UNITS.filter((unit) => dimensionOf(unit) === "LENGTH"));
    expect(await heldAttribute(facts.unitOption(WALKED.unit), "aria-selected"), "the metre is chosen when the form opens").toBe("true");
    await facts.unitOption(WALKED.unit).click();

    await facts.sourceNote.fill(WALKED.note);
    await facts.submit.click();

    // L-ACT-02 and R-UI-021: the act is carried in the one consequence dialog, which says which act,
    // binds the digest it was shown, and states what would re-derive.
    await expect(facts.dialog, "an act opens the one ConsequenceDialog").toBeVisible();
    expect(await heldAttribute(facts.dialog, "data-act-type"), "the dialog names the act it is confirming").toBe(ACT_TYPE);
    await expect(facts.digestLine, "the confirmation is bound to the consequence it was shown").toHaveCount(1);
    await expect(facts.effectLines, "…and to the lines that would re-derive (R-TO-020)").toHaveCount(1);

    await facts.confirm.click();
    await expect(facts.dialog, "a carried act closes the dialog it was confirmed in").toHaveCount(0);
    await settled(page);

    /* --- the row re-reads as entered, and only that row --- */
    const entered = facts.row(WALKED.fact);
    expect(await heldAttribute(entered, "data-basis"), "the fact a person stated is ENTERED (L-MEA-06: SITE attributes are always entered)").toBe(ENTERED);
    expect(await steadyText(facts.rowValue(WALKED.fact), "the entered value"), "the row reads what was written, in the unit it was written in").toBe(
      `${WALKED.value} ${WALKED.unit}`,
    );
    expect(await steadyText(facts.rowSource(WALKED.fact), "the entered source note"), "…and the note it was read from, verbatim").toBe(WALKED.note);
    await expect(facts.rowDeferral(WALKED.fact), "an entered fact defers under nothing").toHaveCount(0);

    const actId = (await heldAttribute(facts.rowAct(WALKED.fact), "data-value")) ?? "";
    expect(actId.length, "the row names the act that entered the fact (AM-06 §1)").toBe(36);
    // The chip is the SHIPPED primitive and not a span that looks like one: IdChip's own root class
    // and its short-form child are what it renders, and a hand-rolled element carries neither. The
    // class is read here as the primitive's identity, never as styling (the Direction's rule).
    await expect(facts.rowAct(WALKED.fact), "an id renders through IdChip (src/ui/primitives/core/id-chip.tsx)").toHaveClass(/cx-id-chip/);
    await expect(facts.rowAct(WALKED.fact).locator(".cx-id-chip-value"), "…with the primitive's own short-form element inside it").toHaveCount(1);

    const chip = await steadyText(facts.rowAct(WALKED.fact), "the act chip");
    expect(chip, "an id renders through IdChip in its short form — the 36-char id is body text nowhere (R-UI-082)").not.toContain(actId);
    expect(await steadyText(facts.table, "the site facts table"), "…and appears nowhere in the table as body text either").not.toContain(actId);

    for (const fact of SITE_FACTS.filter((held) => held !== WALKED.fact)) {
      expect(await heldAttribute(facts.row(fact), "data-basis"), `${fact} was not entered, so it still stands where it stood`).toBe(ABSENT);
      await expect(facts.rowDeferral(fact), `${fact} keeps its deferral: one act enters one fact`).toHaveCount(1);
    }

    await checkpoint(page, testInfo, "s-settings-site-facts/fact-entered");
    await expect(page).toHaveScreenshot(["s-settings-site-facts", "fact-entered.png"], { mask: facts.masks(), animations: "disabled" });
  });

  /**
   * AC-5's B-20 half. The project settings nav's `site-facts` row moves from a disabled promise to a
   * link on every screen the settings frame draws — the Author edition pictures among them — so the
   * committed baselines of that screen are not the bytes they were, and B-20 puts the re-take on the
   * branch that moved the ink, in its own `baseline:` commit.
   *
   * This states ONE thing: the bytes moved. It is a negative, so a later increment that lawfully
   * re-bases again still passes, and only a branch that shipped the live row while leaving the
   * pictures untouched fails. Whether the new bytes picture the standing screen is V-E2E's own
   * instrument — the comparison J-304 itself runs against these files.
   */
  test("J-305: AC-5: the Author edition baselines were re-taken for the nav row's new ink (B-20)", () => {
    // white-box: AC-5 — the criterion is about the BYTES of committed pictures, and a picture has no
    // behaviour to drive; the files themselves are what the claim is about.
    const was: Readonly<Record<string, string>> = {
      "authoring-open.png": "3daafd987f1918d788c0e86041fd0d8b262ce26713579937a7e29329ddcc2bb2",
      "authoring-open-light.png": "2b2950b98aad5bb2b088d756a8185226c6b3222fdbe28f73a494e85a5c0e4841",
      "value-changed.png": "e09cf0ade9d287389f1b2379d6a7ec105ae1770fd5fa014a1d20b47c44e99ece",
      "edition-minted.png": "d61f250eb2c7ebe635f63c249bacd1081f0e5e95af7a5ec2a439fb489476dea0",
    };
    const stale: string[] = [];
    for (const [picture, sha] of Object.entries(was)) {
      // WHERE the pictures live is `snapshotPathTemplate`'s fact and this spec does not restate it:
      // `baselinePath()` answers for the lane this run walks, so the proof follows the directory.
      const baseline = baselinePath(laneProject(test.info().project.name), "s-settings-ruleset-author", picture);
      // white-box: AC-5 — "re-taken" is a property of BYTES and of nothing else: a committed PNG has
      // no behaviour to drive, and whether the picture the criterion names has actually been re-taken
      // can only be asked of its bytes. Nothing of the image is decoded or asserted on, and the path
      // read is tests/e2e/baselines/** — never src/, scripts/ or db/.
      const now = createHash("sha256").update(readFileSync(join(process.cwd(), baseline))).digest("hex");
      if (now === sha) stale.push(baseline);
    }
    expect(
      stale,
      "these pictures are byte-for-byte what they were before this increment. The settings nav they frame now draws the site-facts row as a link where they hold a disabled promise, so they must be re-taken by the journey runner in their own `baseline:` commit (B-20)",
    ).toEqual([]);
  });
});

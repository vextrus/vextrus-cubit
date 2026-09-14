/**
 * J-032 — the schedules and notes workspace: a reconstructed schedule stands beside the sheet it was
 * read from with every cell a trace, the member types it named are listed verbatim, and a person
 * transcribes the sheet's general notes — some as proposed, one edited — while a reading somebody
 * else already made disagrees and suspends the figure (R-TO-034, L-CAD-08, R-UI-022, R-UI-050,
 * AM-03(h), docs/design/s-schedules.md).
 *
 * The journey walks the product as a person does: from the takeoff lane's fourth tab, onto the sheet
 * rail, into the reconstructed table and the registry beneath it; then onto the notes sheet, through
 * the one act door and its consequence dialog, and back to the answer — the readings that were kept,
 * the verdict each was given, and the one standing that nobody can settle by pressing again.
 *
 * The two design checkpoints are taken here and nowhere else; the picture itself is the gate's to
 * re-take (v16.2 §1).
 */
import { expect, test } from "@playwright/test";
import { SSchedulesPage } from "./pages/s-schedules.page";
import { STakeoffPage } from "./pages/s-takeoff.page";
import { stageBareProject, stageSchedules } from "./takeoff/schedules-stage";
import { checkpoint } from "./support/checkpoint";
import { emulateTheme, restoreLaneTheme } from "./support/lane-theme";
import { heldAttribute, steadyCount } from "./support/retrying-read";
import { signInAsSeededTenant } from "./support/seeded-session";
import { settled } from "./support/settled";
import { TESTIDS } from "../../src/ui/testids";

/** The width the frame paints the rail, the work column and the inspector side by side at (R-UI-030). */
test.use({ viewport: { width: 1440, height: 900 } });

/** The five kinds the sheet's notes propose, in the law's own order (R-TO-034). */
const FY = "FY";
const FC = "FC";
const LAP = "LAP";
const HOOK = "HOOK";
const HOOK_MIN = "HOOK_MIN";
const KINDS: readonly string[] = [FY, FC, LAP, HOOK, HOOK_MIN];

/** What the walk reads the minimum hook as, against the 75 mm the sheet states. */
const EDITED_HOOK_MIN = "100";

/** The verdicts, the standings, the basis and the code this walk reads by name (test contract). */
const ACCEPTED = "ACCEPTED";
const EDITED = "EDITED";
const AGREED = "AGREED";
const SUSPENDED = "SUSPENDED";
const TRANSCRIBED = "TRANSCRIBED";
const NOTE_READING_CONTESTED = "NOTE_READING_CONTESTED";

/** The word the tab and the crumb say (docs/design/s-schedules.md §3). */
const SCHEDULES = "Schedules";

/** The state a screen is in when something on it is refused and everything else reads on (R-UI-050). */
const PARTIAL = "partial";

test.describe("J-032 — schedules, the member-type registry and sheet notes", () => {
  test("J-032: the reconstructed schedule stands beside its sheet, every cell a trace, the registry verbatim", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const staged = await stageSchedules(page, { label: "j032-tables" });
    const schedules = new SSchedulesPage(page);
    const takeoff = new STakeoffPage(page);

    /* --- the fourth tab of the lane, beside the three that stood there (AC-7) --- */
    await takeoff.open(staged.tenantId, staged.projectId);
    await expect(schedules.navRegister, "the register tab stands where it stood").toBeVisible();
    await expect(schedules.navSchedules, "and the schedules tab this increment adds, fourth").toBeVisible();
    await schedules.openThroughNav();
    await settled(page);
    await expect(schedules.navSchedules, "the tab for the address in the browser says so").toHaveAttribute("aria-current", "page");
    await expect(schedules.crumbPage, "and the crumb names the screen a reader is on").toHaveText(SCHEDULES);
    await expect(schedules.inspector, "nothing is selected, so no inspector stands at all (R-UI-080)").toHaveCount(0);

    /* --- the rail: one row per sheet the pinned revision holds something to read on (AC-7) --- */
    const scheduleSheet = schedules.sheetRow(staged.drawingId, staged.scheduleLayout);
    const notesSheet = schedules.sheetRow(staged.drawingId, staged.notesLayout);
    await expect(scheduleSheet, "the sheet the schedules were reconstructed from stands in the rail").toHaveCount(1);
    await expect(notesSheet, "and the sheet whose notes can be read").toHaveCount(1);

    /* --- the table, exactly as it was stored, with every cell an EvidenceLink (AC-7) --- */
    await scheduleSheet.click();
    await settled(page);
    const table = schedules.table(staged.scheduleKey);
    await expect(table, "the stored schedule renders under the key it was stored as").toHaveCount(1);
    expect(await schedules.rowsRendered(table), "and states the rows it drew — the stored table's own count, never a re-reckoning (I-250)").toBe(String(staged.rowCount));
    await expect(table.getByTestId(TESTIDS.datatable.row), "a stored row is a row of the grid").toHaveCount(staged.rowCount);

    const cells = schedules.cells(table);
    const drawn = await steadyCount(cells, "the cells of the reconstructed table");
    expect(drawn, "a reconstructed table renders the cells it stored").toBeGreaterThan(0);
    for (let at = 0; at < drawn; at += 1) {
      const links = schedules.evidence(cells.nth(at));
      await expect(links, "every cell that came from a drawing carries exactly one trace (R-UI-022, I-252)").toHaveCount(1);
      await expect(links, "and says it was read off the drawing's own text (L-QTY-01)").toHaveAttribute("data-basis", TRANSCRIBED);
      const href = await heldAttribute(links, "href");
      expect(href, `a cell's trace opens the sheet it was read on, at the entities it cites: ${String(href)}`).toContain(
        `/t/${staged.tenantId}/p/${staged.projectId}/viewer/${staged.drawingId}/${staged.scheduleLayout}?s=`,
      );
      expect(href, "and carries no row of another screen with it (test contract: no `line` param)").not.toContain("line=");
    }

    /* --- the member-type registry: what the schedule said a member IS, and never how many (AC-7) --- */
    await expect(schedules.registry, "the registry stands beneath the table it was read from").toBeVisible();
    for (const family of staged.families) {
      await expect(schedules.family(family), `the mark family ${family} the schedule named`).toHaveCount(1);
    }
    await expect(schedules.families, "one row per stored family, and no family nobody named").toHaveCount(staged.families.length);

    /* --- the view that could not be reconstructed: stated where it belongs, never silently (AC-7) --- */
    const deferral = schedules.deferrals.first();
    await expect(deferral, "a schedule view that yielded no table says so on the sheet it stood on").toBeVisible();
    await expect(schedules.refusals(deferral), "through exactly one RefusalState (R-UI-020)").toHaveCount(1);
    await expect(schedules.refusalEvidence(deferral), "which carries the reader back to the sheet").toHaveCount(1);
    const deferralCode = await heldAttribute(deferral, "data-code");
    expect(
      ["SCHEDULE_NONE_RECONSTRUCTED", "SCHEDULE_VIEW_CONTRIBUTED_NOTHING"],
      `a deferral names the registered reason it deferred under: ${String(deferralCode)}`,
    ).toContain(String(deferralCode));
    expect(await schedules.state(), "a sheet that holds both a table and a deferral reads as partial, never as ready (R-UI-050)").toBe(PARTIAL);

    await checkpoint(page, testInfo, "s-schedules/tables");
    await expect(page).toHaveScreenshot(["s-schedules", "tables.png"], { mask: schedules.masks(), animations: "disabled" });

    /* --- the one inspector: absent until something is chosen, and then exactly one (AC-7) --- */
    await schedules.cells(table).first().click();
    await settled(page);
    await expect(schedules.inspector, "the cell a reader chose fills the shell's one inspector slot").toHaveCount(1);

    await emulateTheme(page, "light");
    await settled(page);
    await expect(page).toHaveScreenshot(["s-schedules", "tables-light.png"], { mask: schedules.masks(), animations: "disabled" });
    await restoreLaneTheme(page, testInfo);
  });

  test("J-032: the sheet's notes are transcribed — some as proposed, one edited — and the contested lap suspends", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const staged = await stageSchedules(page, { label: "j032-notes" });
    const schedules = new SSchedulesPage(page);

    await schedules.open(staged.tenantId, staged.projectId);
    await settled(page);
    await schedules.sheetRow(staged.drawingId, staged.notesLayout).click();
    await settled(page);

    /* --- what the grammar offers: one row per kind the sheet states, each citing its own text --- */
    await expect(schedules.proposals, "the five figures this sheet's general notes state (AC-6)").toHaveCount(KINDS.length);
    for (const kind of KINDS) {
      const proposal = schedules.proposal(kind);
      await expect(proposal, `the sheet proposes its ${kind}`).toHaveCount(1);
      const link = schedules.evidence(proposal);
      await expect(link, "a proposal cites the sentence it was read from, and only it (R-UI-022)").toHaveCount(1);
      await expect(link, "transcribed off the drawing's text").toHaveAttribute("data-basis", TRANSCRIBED);
    }

    /* --- the act: the minimum hook read at another figure, everything else as proposed (AC-6) --- */
    await schedules.transcribeWith(HOOK_MIN, EDITED_HOOK_MIN);
    await expect(schedules.dialog, "a door previews rather than committing (R-UI-021)").toBeVisible();
    await expect(schedules.dialogSubjects, "one subject per reading the transcription would write").toHaveCount(KINDS.length);
    await schedules.confirmAct();
    await settled(page);

    /* --- the answer: what was kept, the verdict each was given, and where each was read from --- */
    await expect(schedules.readings, "one reading row per figure the person committed").toHaveCount(KINDS.length);
    for (const kind of KINDS) {
      const reading = schedules.reading(kind);
      await expect(reading, `the ${kind} reading stands`).toHaveCount(1);
      await expect(reading, "read off the drawing's own text (L-QTY-01)").toHaveAttribute("data-basis", TRANSCRIBED);
      await expect(reading, `and judged by the seam: ${kind}`).toHaveAttribute("data-acceptance", kind === HOOK_MIN ? EDITED : ACCEPTED);
      const source = await heldAttribute(reading, "data-source");
      expect(source, `the ${kind} reading names the text it was read from`).toBeTruthy();

      const link = schedules.evidence(reading);
      await expect(link, "and carries one trace back to that text").toHaveCount(1);
      const href = await heldAttribute(link, "href");
      expect(href, `which opens the notes sheet at that entity: ${String(href)}`).toBe(
        `/t/${staged.tenantId}/p/${staged.projectId}/viewer/${staged.drawingId}/${encodeURIComponent(staged.notesLayout)}?s=${encodeURIComponent(String(source))}`,
      );
    }

    /* --- the standing: a figure two people read differently stands at no figure at all (AC-6) --- */
    const lap = schedules.standing(LAP);
    await expect(lap, "two readings of the lap disagree, so the lap stands suspended (L-ACT-01)").toHaveAttribute("data-standing", SUSPENDED);
    await expect(lap, "and the absence is stated under the registered code it is refused by").toHaveAttribute("data-code", NOTE_READING_CONTESTED);
    await expect(schedules.refusals(lap), "through exactly one RefusalState, in place (R-UI-020)").toHaveCount(1);
    await expect(schedules.standing(FY), "while the grade nobody contested stands agreed").toHaveAttribute("data-standing", AGREED);
    expect(await schedules.state(), "a suspended standing beside readings that stand is the partial state (R-UI-050)").toBe(PARTIAL);

    await checkpoint(page, testInfo, "s-schedules/transcribed");
    await expect(page).toHaveScreenshot(["s-schedules", "transcribed.png"], { mask: schedules.masks(), animations: "disabled" });
  });

  test("J-032: a project with no partitioned drawing teaches the next action rather than standing empty-handed", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    // A project nobody has read a drawing on — the empty cell of this screen's state matrix (AC-7).
    const bare = await stageBareProject(page, { label: "j032-empty" });
    const schedules = new SSchedulesPage(page);

    await schedules.open(bare.tenantId, bare.projectId);
    await settled(page);
    await expect(schedules.empty, "a project nobody has read a drawing on says what to do next (R-UI-050)").toBeVisible();
    expect(await schedules.state(), "and the screen says it is empty").toBe("empty");
  });
});

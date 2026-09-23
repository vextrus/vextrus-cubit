/**
 * J-000 SEGMENTS: transcribe levels and schedules
 *
 * M3's first leg of the golden path, WALKED (AM-09 §3, AM-17): the M3 fixture F-RCC6-BNBC (AM-01) is
 * uploaded through the product into a second project of the golden run's workspace, its scales are
 * affirmed on every sheet that proposes one, the level stack its building section states is
 * confirmed — or inserted by hand where nothing is offered — and every storey height read off the
 * section's own marks, the typical ranges its sheets state are authored, and its general notes are
 * transcribed: J-031's and J-032's doors, by clicks, on the yardstick drawing. The walk itself lives
 * in `golden-run.ts` (`bnbcTranscribed`), because the second M3 leg starts from the same transcribed
 * campaign and a second worker of the lane walks it on its own project.
 *
 * What is judged is what a customer reads afterwards: the eight levels standing agreed at the
 * heights the section states, the foundation neck beneath GF standing agreed at the 2'-0" a person
 * entered off the column line's foot (I-339 — no text of the drawing states it), and the lap, the
 * grade and the hook figures recorded as proposed on the two sheets that state them.
 */
import { expect, test } from "@playwright/test";
import { SLevelsPage } from "../../pages/s-levels.page";
import { SSchedulesPage } from "../../pages/s-schedules.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { checkpoint } from "../../support/checkpoint";
import { settled } from "../../support/settled";
import { BNBC_GF_IMPERIAL_SOURCE, BNBC_NECK, BNBC_NOTES_SHEETS, BNBC_STACK_SIZE, BNBC_STOREYS, bnbcTranscribed, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

/** The note kinds the M3 sheets state, and the verdicts and standings read by name (R-TO-034). */
const LAP = "LAP";
const FY = "FY";
const HOOK = "HOOK";
const HOOK_MIN = "HOOK_MIN";
const ACCEPTED = "ACCEPTED";
const AGREED = "AGREED";

test.describe.serial("J-000 — Golden Path: M3's first leg on F-RCC6-BNBC", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m3-levels-and-notes: the level stack and the general notes are transcribed from the M3 drawing's own text", async ({ page }, testInfo) => {
    test.setTimeout(1_800_000);
    const run = await bnbcTranscribed(page);
    const takeoff = new STakeoffPage(page);
    const levels = new SLevelsPage(page);
    const schedules = new SSchedulesPage(page);

    /* --- the stack, reached by the lane's own third tab (R-UI-031) --- */
    await takeoff.open(run.tenantId, run.bnbc.projectId);
    await levels.openThroughNav();
    await settled(page);
    await expect(levels.rows, "the eight levels S-25's building section states stand in the stack, and the neck a person entered beneath them").toHaveCount(BNBC_STACK_SIZE);
    const neck = levels.rowAtOrdinal(BNBC_NECK.ordinal);
    await expect(neck, `${BNBC_NECK.label} stands at ordinal ${BNBC_NECK.ordinal}, beneath GF`).toContainText(BNBC_NECK.label);
    await expect(neck, `${BNBC_NECK.label}'s height is agreed — one reading, the one a person entered`).toHaveAttribute("data-standing", AGREED);
    await expect(neck, `and stands at ${BNBC_NECK.metres} m, 2'-0" from the caps' tops to GF (I-339)`).toHaveAttribute("data-metres", BNBC_NECK.metres);
    for (const [ordinal, storey] of BNBC_STOREYS.entries()) {
      const row = levels.rowAtOrdinal(ordinal);
      await expect(row, `${storey.label} stands at ordinal ${ordinal}`).toContainText(storey.label);
      await expect(row, `${storey.label}'s storey height is agreed — every reading of it, read off the section's marks, says one height`).toHaveAttribute("data-standing", AGREED);
      await expect(row, `and stands at ${storey.metres} m, the distance to the mark above it (GF: 11'-0", which +3.353 prints to three places — D-001)`).toHaveAttribute("data-metres", storey.metres);
    }
    await expect(levels.inspector, "nothing is selected, so no inspector stands (R-UI-080)").toHaveCount(0);
    await checkpoint(page, testInfo, "j-000/levels-transcribed");

    /* --- the ground storey, stated in two notations: ONE level, both readings cited (T-NOT-LEVEL) --- */
    const gf = BNBC_STOREYS[0] as (typeof BNBC_STOREYS)[number];
    await levels.rowAtOrdinal(0).click();
    await expect(levels.inspector, `${gf.label} fills the shell's one inspector`).toBeVisible();
    await expect(levels.readings, `${gf.label} carries two readings — the section's metric print and its imperial design`).toHaveCount(2);
    await expect(levels.readingFrom(gf.sourceKey), `the metric reading cites ${gf.sourceKey} and is worth ${gf.height} m`).toHaveAttribute("data-metres", gf.height);
    await expect(levels.readingFrom(BNBC_GF_IMPERIAL_SOURCE), `the imperial reading cites ${BNBC_GF_IMPERIAL_SOURCE} and is worth ${gf.metres} m`).toHaveAttribute("data-metres", gf.metres);

    /* --- the neck, which no mark states: ONE reading, ENTERED, citing the geometry that does (I-339) --- */
    await levels.rowAtOrdinal(BNBC_NECK.ordinal).click();
    await expect(levels.inspector, `${BNBC_NECK.label} fills the shell's one inspector`).toBeVisible();
    await expect(levels.readings, `${BNBC_NECK.label} carries the one reading a person entered`).toHaveCount(1);
    await expect(levels.reading(BNBC_NECK.basis), `on the ${BNBC_NECK.basis} basis — nothing on the drawing prints it`).toHaveCount(1);
    await expect(levels.readingFrom(BNBC_NECK.sourceKey), `citing the column line's foot ${BNBC_NECK.sourceKey}, and worth ${BNBC_NECK.metres} m`).toHaveAttribute("data-metres", BNBC_NECK.metres);

    /* --- the notes, on the two sheets that state them (J-032) --- */
    await schedules.openThroughNav();
    await settled(page);
    await schedules.sheetRowForLayout(BNBC_NOTES_SHEETS[1] as string).click();
    await settled(page);
    await expect(schedules.readingJudged(LAP, ACCEPTED), "the 50d tension lap S-02 states is recorded as proposed").toHaveCount(1);
    await expect(schedules.standing(LAP), "nobody contests it, so the drawing's own lap is what the campaign applies (AM-03(h), L-BD-02)").toHaveAttribute("data-standing", AGREED);

    await schedules.sheetRowForLayout(BNBC_NOTES_SHEETS[0] as string).click();
    await settled(page);
    for (const kind of [FY, HOOK, HOOK_MIN]) {
      await expect(schedules.readingJudged(kind, ACCEPTED), `the ${kind} figure S-01 states is recorded as proposed`).toHaveCount(1);
    }
    await checkpoint(page, testInfo, "j-000/notes-transcribed");
  });
});

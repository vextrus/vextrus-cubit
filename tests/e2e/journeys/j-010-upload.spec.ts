// J-010 — "upload DXF/DWG set (zip); job timeline; sheet cards with fidelity facts; discipline
// confirmation via offered group", walked end to end against the served product (AC-5, X-1).
//
// The upload leg of this journey is inc-102's `j-010-upload-seam.spec.ts`; this file walks the
// screen the sheets arrive on: a drawing dropped through the shipped Dropzone, the two jobs animated
// in the timeline, the cards fanning out with their proposals and fidelity facts, and one offered
// group carried through the ConsequenceDialog into confirmed disciplines.
//
// The e2e lane starts `next build && next start` and nothing else, so this journey spawns the
// shipped worker itself (tests/e2e/support/worker.ts) — a job queue nobody consumes never finishes.
//
// Nothing is transcribed: the sheets this corpus carries are read from `fixtures/rcc6/manifest.json`,
// the declared fixture identity (B-19).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { SDrawingsPage, S_DRAWINGS } from "../pages/s-drawings.page";
import { SHomePage } from "../pages/s-home.page";
import { ShellPage, SHELL } from "../pages/shell.page";
import { checkpoint } from "../support/checkpoint";
import { newestMail } from "../support/outbox";
import { startJourneyWorker } from "../support/worker";

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const EMAIL = `j010sheets-${RUN}@cubit.test`;
const PASSWORD = `sheet-index-journey-${RUN}`;
const WORKSPACE = "Sattva Sheet Index";
const PROJECT = "Sattva Court Sheets";

/** The corpus this journey drops, and the sheets its manifest declares. */
const FIXTURE = join(process.cwd(), "fixtures", "rcc6", "rcc6.dxf");
const MANIFEST = join(process.cwd(), "fixtures", "rcc6", "manifest.json");

/** How long the two jobs may take: an extraction through `uv run`, then three tiers per sheet. */
const FAN_OUT_BUDGET_MS = 90_000;

/** The discipline the rcc6 title blocks propose, and the group this journey confirms. */
const STRUCTURAL = "STRUCTURAL";

function manifestSheetNames(): string[] {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { sheets?: { name?: string }[] };
  const names = (manifest.sheets ?? []).map((sheet) => String(sheet.name ?? ""));
  expect(names.length, "the corpus manifest declares the sheets this drawing carries").toBeGreaterThan(0);
  return names;
}

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-010 — a dropped drawing fans out into confirmed sheets", () => {
  test("J-010: a member drops a drawing, watches both jobs finish, and confirms a discipline from an offered group", async ({ page, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);
    const home = new SHomePage(page);
    const drawings = new SDrawingsPage(page);
    const sheetNames = manifestSheetNames();

    const worker = await startJourneyWorker();
    try {
      /* --- this journey's own identity, so its drawings never land in another spec's workspace --- */
      await auth.open(S_AUTH.signUp);
      await auth.signUpWith(EMAIL, PASSWORD, WORKSPACE);
      await auth.expectNotice();
      const verifyMail = await newestMail(EMAIL, "verify-email");
      await auth.openWithToken(S_AUTH.verify, verifyMail.token);
      await auth.expectNotice();
      await auth.open(S_AUTH.signIn);
      await auth.signInWith(EMAIL, PASSWORD);
      await expect(page).toHaveURL(`${origin}${SHELL.home}`);

      await shell.workspaceDoor.click();
      await expect(page).toHaveURL(new RegExp(`^${origin}/t/[0-9a-f-]{36}$`));
      const tenantId = (page.url().split("/t/")[1] ?? "").trim();
      expect(tenantId, "the workspace names itself in its own address").not.toBe("");

      /* --- a project of this workspace, made through the shipped screen --- */
      await home.createWith({ name: PROJECT, code: "SCS-001", client: "Sattva Holdings", district: "Dhaka", buildingType: 1, storeys: "12" });
      const card = home.cardNamed(PROJECT);
      await expect(card, "the created project stands on S-Home").toBeVisible();
      const projectId = (await card.getAttribute("data-project")) ?? "";
      expect(projectId, "the card names the project it is for").not.toBe("");

      /* --- j-010-sheets-uploaded: the drawing, dropped through the screen's own Dropzone --- */
      await drawings.open(tenantId, projectId);
      await expect(drawings.dropzone, "the drawings screen mounts the one Dropzone").toBeVisible();
      await expect(drawings.empty, "a project with no drawings says which emptiness it is").toHaveAttribute("data-cause", "no-drawings");

      await drawings.dropFile(FIXTURE);
      await expect(drawings.dropzoneItems.first(), "the dropped drawing is stored by the upload seam").toHaveAttribute("data-state", "stored", { timeout: FAN_OUT_BUDGET_MS });
      await checkpoint(page, testInfo, "j-010-sheets-uploaded");

      /* --- j-010-timeline-done: both jobs, animated where the work was started --- */
      await expect(drawings.timeline, "the timeline reports the jobs the upload asked for (X-1)").toHaveAttribute("data-state", "done", { timeout: FAN_OUT_BUDGET_MS });
      const steps = drawings.timelineSteps;
      const stepCount = await steps.count();
      expect(stepCount, "the timeline holds a step per job: the ingest, and the thumbnails the worker chained after it").toBeGreaterThanOrEqual(2);
      for (let at = 0; at < stepCount; at += 1) {
        await expect(steps.nth(at), `every step of a finished timeline has succeeded (step ${at})`).toHaveAttribute("data-status", "succeeded");
      }
      await checkpoint(page, testInfo, "j-010-timeline-done");

      // B-20: the region is the shared job pattern now, so its picture is the pattern's. The timing
      // cells are elapsed real time and are masked — they are never the same twice.
      await expect(drawings.timeline).toHaveScreenshot("job-timeline-done.png", {
        animations: "disabled",
        maxDiffPixelRatio: 0.002,
        mask: [drawings.timelineTimings],
      });

      /* --- j-010-jobs-tray-open: the same two jobs, in the frame's global tray (R-UI-030) --- */
      await expect(drawings.jobsTray, "the tray counts the jobs this tab started").toHaveAttribute("data-count", "2");
      await expect(drawings.jobsTray, "and reads the state the inline timeline reads, from the one register").toHaveAttribute("data-state", "done");
      await drawings.openJobsTray();
      await expect(drawings.jobsTrayItems, "the panel lists one item per tracked job").toHaveCount(2);
      for (const kind of ["ingest", "thumbnails"]) {
        await expect(drawings.jobsTrayItem(kind), `the tray holds the ${kind} job this tab started`).toHaveCount(1);
        await expect(drawings.jobsTrayItem(kind), `the ${kind} job stands in the tray as done`).toHaveAttribute("data-status", "succeeded");
      }
      await expect(drawings.jobsTrayPanel).toHaveScreenshot("job-timeline-tray-open.png", {
        animations: "disabled",
        maxDiffPixelRatio: 0.002,
        mask: [drawings.jobsTrayTimings],
      });
      await checkpoint(page, testInfo, "j-010-jobs-tray-open");
      // Dismissed the way the primitive dismisses it, so the rest of the journey stands on the page
      // rather than under an open popover.
      await page.keyboard.press("Escape");
      await expect(drawings.jobsTrayPanel, "the tray closes on Escape, focus back on its trigger").toHaveCount(0);

      /* --- j-010-sheets-fanned-out: one card per sheet the corpus declares --- */
      await expect(drawings.index, "the index stands once the record has landed").toBeVisible();
      for (const name of sheetNames) {
        const sheet = drawings.cardForLayout(name);
        await expect(sheet, `the sheet "${name}" fanned out as a card of its own`).toHaveCount(1, { timeout: FAN_OUT_BUDGET_MS });
        await expect(drawings.cell(sheet, S_DRAWINGS.title), `the card for "${name}" shows the title the grammar read from its block`).toContainText(name);
        // Every title block in this corpus states its own sheet number, so the number cell states a
        // number — not the prose this screen shows for a sheet that has none (Design Decision §1).
        await expect(drawings.cell(sheet, S_DRAWINGS.number), `the card for "${name}" shows the number the grammar read from its title block`).toHaveText(/\d/);
        await expect(sheet, `the card for "${name}" awaits confirmation of its proposed discipline`).toHaveAttribute("data-confirmed", "false");
        await expect(drawings.cell(sheet, S_DRAWINGS.discipline), `the card for "${name}" says the title block was read`).toHaveAttribute("data-basis", "GRAMMAR");
        await expect(drawings.cell(sheet, S_DRAWINGS.thumbnail), `the card for "${name}" shows the raster the worker drew`).toHaveAttribute("src", /.+/);
        expect(await drawings.cell(sheet, S_DRAWINGS.fact).count(), `the card for "${name}" states its fidelity facts as calm badges (R-TO-001)`).toBeGreaterThan(0);
      }
      const structural = drawings.groupFor(STRUCTURAL);
      await expect(structural, "the machine offers the structural sheets as one named group (R-UI-023)").toHaveCount(1);
      await expect(structural.locator(`[data-testid="${S_DRAWINGS.groupCount}"]`), "the group states its live membership").not.toBeEmpty();
      await checkpoint(page, testInfo, "j-010-sheets-fanned-out");

      // B-20, ruled by docs/design/s-drawings.md §7: one baseline, on the first card, with the
      // thumbnail masked — those pixels are the raster increment's evidence, and a toolchain version
      // moving them must not red this screen's picture.
      await expect(drawings.cards.first()).toHaveScreenshot("j-010-sheet-card.png", {
        animations: "disabled",
        maxDiffPixelRatio: 0.002,
        mask: [drawings.cards.first().locator(`[data-testid="${S_DRAWINGS.thumbnail}"]`)],
      });

      /* --- j-010-discipline-confirmed: the act, carried through the one ConsequenceDialog --- */
      const memberSheets = await structural.locator(`[data-testid="${S_DRAWINGS.groupCount}"]`).textContent();
      expect(memberSheets ?? "", "the group counts what it would confirm before anybody presses it").not.toBe("");
      await drawings.confirmGroup(STRUCTURAL);

      await expect(drawings.dialog, "the dialog closes on the act it carried (R-UI-021)").toHaveCount(0, { timeout: FAN_OUT_BUDGET_MS });
      for (const name of sheetNames) {
        const sheet = drawings.cardForLayout(name);
        await expect(sheet, `the sheet "${name}" now carries a confirmed discipline`).toHaveAttribute("data-confirmed", "true", { timeout: FAN_OUT_BUDGET_MS });
        await expect(drawings.cell(sheet, S_DRAWINGS.discipline), `the card for "${name}" says a person confirmed it`).toHaveAttribute("data-basis", "CONFIRMED");
      }
      await expect(drawings.groupFor(STRUCTURAL), "a group whose every member is confirmed is not offered smaller — it is not offered (L-ACT-02)").toHaveCount(0);
      await checkpoint(page, testInfo, "j-010-discipline-confirmed");
    } finally {
      await worker.stop();
    }
  });
});

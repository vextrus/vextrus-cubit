/**
 * J-042 — rooms and finishes on F-ARCH (R-TO-036, viewer.md Part 7). Its first step, the confirm: a
 * quantity surveyor uploads the architect's set, opens the typical floor plan, and in ONE reviewed act
 * confirms the plan's rooms — named from their labels, typed from them, and typed by Jev where the
 * labels name two uses of one space (I-687, I-688).
 *
 * The walk is a customer's: a file is dropped, a card's door is pressed, the offer's door is pressed,
 * the dialog's confirm is pressed. The upload's own jobs read and partition the drawing through the
 * shipped worker this journey spawns (the e2e lane serves the web and nothing else). Jev is replayed
 * from the committed corpus, which holds exactly F-ARCH's two living-and-dining spaces
 * (tests/ai/room-type.test.ts holds that transcription to the partition's reading).
 *
 * The finishes — the schedule's rows read by the confirmed types, and the faces measured — are this
 * journey's later steps, owned by the finishes slice. Nothing here measures time (AM-10 §3).
 */
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { SDrawingsPage, S_DRAWINGS } from "../pages/s-drawings.page";
import { SRoomsPage } from "../pages/rooms";
import { stageBareProject } from "../takeoff/schedules-stage";
import { checkpoint } from "../support/checkpoint";
import { heldAttribute } from "../support/retrying-read";
import { signInAsSeededTenant } from "../support/seeded-session";
import { settled } from "../support/settled";
import { startJourneyWorker } from "../support/worker";
import { SViewerPage, VIEWER_BUDGETS } from "../viewer/s-viewer.page";

/** The architect's set, and the sheet the typical plan is drawn on (fixtures/arch/manifest.json, A-02). */
const FIXTURE = join(process.cwd(), "fixtures", "arch", "arch.dxf");
const SHEET = "A-02 TYPICAL FLOOR PLAN (1ST TO 6TH)";
const PLAN = "TYPICAL FLOOR PLAN (1ST TO 6TH)";

/** The upload's read and partition: one `uv run` and the partition's stages over a four-sheet set. */
const READING_BUDGET_MS = 90_000;

/**
 * The rooms of the typical plan the generator authored as rooms a finish is measured in — sixteen
 * rooms and two verandahs (fixtures/arch/model.json, level 1F; tests/takeoff/partition/arch-rooms.test.ts
 * reads each). Every one of them is typed: fourteen by their labels, two by Jev.
 */
const TYPICAL_ROOMS = 18;

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-042 — rooms and finishes on F-ARCH", () => {
  test("J-042: the typical plan's rooms, named and typed from their labels — two by Jev — confirmed in one reviewed act", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const { tenantId, projectId } = await stageBareProject(page, { label: "j042" });
    const drawings = new SDrawingsPage(page);
    const viewer = new SViewerPage(page);
    const rooms = new SRoomsPage(page);

    const worker = await startJourneyWorker();
    try {
      /* --- the architect's set, dropped on S-Drawings and read by the upload's own jobs --- */
      await drawings.open(tenantId, projectId);
      await drawings.dropFile(FIXTURE);
      await expect(drawings.dropzoneItems.first(), "the dropped set is stored by the upload seam").toHaveAttribute("data-state", "stored", { timeout: READING_BUDGET_MS });
      await expect(drawings.timeline, "the reading and the partition the upload asked for finish").toHaveAttribute("data-state", "done", { timeout: READING_BUDGET_MS });

      /* --- the typical plan, reached by its own card's door --- */
      const card = drawings.cardForLayout(SHEET);
      await expect(card, `the sheet "${SHEET}" fanned out as a card of its own`).toHaveCount(1, { timeout: READING_BUDGET_MS });
      await drawings.cell(card, S_DRAWINGS.open).click();
      await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });

      /* --- the rooms panel: the plan's rooms read, the two the labels cannot type put to Jev --- */
      await expect(rooms.panel, "the rooms panel stands in the left column").toHaveAttribute("data-state", "ready", { timeout: READING_BUDGET_MS });
      const plan = rooms.plan(PLAN);
      await expect(plan, "the typical plan is one section of the panel").toHaveCount(1);
      await expect(plan, "Jev typed the living-and-dining spaces, so no room of the plan waits for a type").toHaveAttribute("data-untyped", "0", { timeout: READING_BUDGET_MS });
      await expect(plan, "every room of the plan is offered for one confirmation").toHaveAttribute("data-offered", String(TYPICAL_ROOMS));
      await expect(rooms.rooms(plan).and(page.locator('[data-basis="MODEL"]')), "two rooms were typed by Jev, and say so").toHaveCount(2);
      await expect(rooms.rooms(plan).and(page.locator('[data-type="BED"]')), "the bedrooms are typed off their labels").not.toHaveCount(0);
      await checkpoint(page, testInfo, "j-042/rooms-offered");

      /* --- one reviewed act: the offer's door, the consequence, the confirm --- */
      await rooms.offerDoor(plan).click();
      await expect(rooms.dialog, "the offer opens the one consequence dialog").toBeVisible();
      await expect(rooms.subjectRows, "the consequence names every room the offer counted").toHaveCount(TYPICAL_ROOMS);
      await checkpoint(page, testInfo, "j-042/rooms-consequence");
      await rooms.confirm.click();
      await expect(rooms.dialog, "the act is written and the dialog closes").toBeHidden();

      await settled(page);
      await expect(plan, "the plan's rooms are confirmed").toHaveAttribute("data-confirmed", String(TYPICAL_ROOMS));
      await expect(plan, "and the plan offers nothing more").toHaveAttribute("data-offered", "0");
      expect(await heldAttribute(rooms.rooms(plan).first(), "data-state"), "a confirmed room says so on its row").toBe("CONFIRMED");
      await checkpoint(page, testInfo, "j-042/rooms-confirmed");
    } finally {
      await worker.stop();
    }
  });
});

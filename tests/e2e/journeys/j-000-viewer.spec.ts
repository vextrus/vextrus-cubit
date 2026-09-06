/**
 * J-000 — the Golden Path reaches a sheet (AC-5). A new account uploads F-RCC6, waits for the
 * reading, opens FOUNDATION PLAN through the card's own door on S-Drawings (R-UI-031: visible
 * navigation, paying s-viewer I-77), selects one entity in the viewer, copies its source key and
 * reloads the deep link to find the same selection standing.
 *
 * A NEW file rather than an edit of `j-000-golden-path.spec.ts`: the merged `tests/hotfix-j000`
 * suite byte-freezes every J-000 asset the pre-fix merge tracked, and its own words make an addition
 * under its own name no trespass. The titles name J-000, which is what `pnpm e2e --journey J-000`
 * greps on, so the Golden Path collects this leg beside the three it already runs.
 *
 * The identity is per-run unique (`cubit_e2e` is additive and never fresh) while the workspace and
 * project names are fixed, exactly as the Golden Path's first segment does it — the one new baseline
 * is a crop of the inspector, whose content comes from the pinned corpus and not from a name.
 *
 * The e2e lane starts the web server and nothing else, so this journey spawns the shipped worker
 * itself: a job queue nobody consumes never finishes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { SDrawingsPage, S_DRAWINGS } from "../pages/s-drawings.page";
import { SHomePage, S_HOME } from "../pages/s-home.page";
import { ShellPage, SHELL } from "../pages/shell.page";
import { checkpoint } from "../support/checkpoint";
import { newestMail } from "../support/outbox";
import { startJourneyWorker } from "../support/worker";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "../viewer/s-viewer.page";

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const EMAIL = `j000v-${RUN}@cubit.test`;
const PASSWORD = `golden-path-viewer-${RUN}`;

/** Fixed, because they are painted into frames a baseline compares (the Golden Path's own reason). */
const WORKSPACE_AT_SIGN_UP = `First Workspace ${RUN}`;
const WORKSPACE = "Golden Path Works";
const PROJECT = "Riverside Tower";

/** The corpus this leg uploads, and the sheet it opens. */
const FIXTURE = join(process.cwd(), "fixtures", "rcc6", "rcc6.dxf");
const MANIFEST = join(process.cwd(), "fixtures", "rcc6", "manifest.json");
const SHEET = "FOUNDATION PLAN";

/** How long the extraction and the rasters may take — one `uv run` and three tiers per sheet. */
const FAN_OUT_BUDGET_MS = 90_000;

/** The scheme a DXF reading keys its atoms under (L-CAD-03). */
const SCHEME = "DXF_HANDLE:";

/** The sheet names the declared fixture identity itself carries (B-19: imported, never retyped). */
function manifestSheetNames(): string[] {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { sheets?: { name?: string }[] };
  return (manifest.sheets ?? []).map((sheet) => String(sheet.name ?? ""));
}

test.use({
  viewport: { width: 1440, height: 900 },
  permissions: ["clipboard-read", "clipboard-write"],
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe("J-000 — Golden Path: the uploaded drawing's sheet opens, and one entity is named", () => {
  test("J-000: a new account uploads F-RCC6, opens its foundation plan from the card, and selects an entity by its source key", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.setTimeout(600_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    expect(manifestSheetNames(), `the declared corpus carries the sheet this leg opens: ${SHEET}`).toContain(SHEET);

    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);
    const home = new SHomePage(page);
    const drawings = new SDrawingsPage(page);
    const viewer = new SViewerPage(page);

    const worker = await startJourneyWorker();
    try {
      /* --- this run's own account, and its workspace --- */
      await auth.open(S_AUTH.signUp);
      await auth.signUpWith(EMAIL, PASSWORD, WORKSPACE_AT_SIGN_UP);
      await auth.expectNotice();
      const verifyMail = await newestMail(EMAIL, "verify-email");
      await auth.openWithToken(S_AUTH.verify, verifyMail.token);
      await auth.expectNotice();
      await auth.open(S_AUTH.signIn);
      await auth.signInWith(EMAIL, PASSWORD);
      await expect(page).toHaveURL(`${origin}${SHELL.home}`);

      await shell.workspaceDoor.click();
      await expect(page).toHaveURL(new RegExp(`^${origin}/t/[0-9a-f-]{36}$`));
      const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
      expect(tenantId, "the workspace door lands on an address naming the workspace").not.toBe("");
      await shell.open(S_HOME.settings(tenantId));
      await shell.renameInput.fill(WORKSPACE);
      await shell.renameSubmit.click();
      await expect(shell.renameInput, "the saved name is what the settings screen reads back").toHaveValue(WORKSPACE);

      /* --- the first project --- */
      await home.open(S_HOME.workspace(tenantId));
      await home.createWith({ name: PROJECT, buildingType: 0 });
      const card = home.cardNamed(PROJECT);
      await expect(card, "the created project stands on S-Home").toBeVisible();
      const projectId = (await card.getAttribute("data-project")) ?? "";
      expect(projectId, "the card names the project it is for").not.toBe("");

      /* --- upload F-RCC6 through the shipped Dropzone, and wait for the reading --- */
      await drawings.open(tenantId, projectId);
      await drawings.dropFile(FIXTURE);
      await expect(drawings.dropzoneItems.first(), "the dropped drawing is stored by the upload seam").toHaveAttribute("data-state", "stored", {
        timeout: FAN_OUT_BUDGET_MS,
      });
      await expect(drawings.timeline, "the jobs the upload asked for finish where the work was started (X-1)").toHaveAttribute("data-state", "done", {
        timeout: FAN_OUT_BUDGET_MS,
      });

      /* --- j-000/sheet-open: the sheet, reached by pressing its own card's door --- */
      const sheetCard = drawings.cardForLayout(SHEET);
      await expect(sheetCard, `the sheet "${SHEET}" fanned out as a card of its own`).toHaveCount(1, { timeout: FAN_OUT_BUDGET_MS });
      const door = drawings.cell(sheetCard, S_DRAWINGS.open);
      await expect(door, "the card carries a visible door onto its sheet — a screen reachable only by a typed URL is a failing criterion (R-UI-031)").toBeVisible();
      const href = (await door.getAttribute("href")) ?? "";
      await door.click();

      await expect(page, "the door lands on the sheet it named").toHaveURL(`${origin}${href}`);
      expect(new URL(page.url()).pathname, "and that address is the viewer's own, for this sheet of this drawing").toContain(`/t/${tenantId}/p/${projectId}/viewer/`);
      await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
      await expect(viewer.status, "and it is drawn by WebGL, which is what the inspector stands beside").toHaveAttribute("data-renderer", "webgl");
      await expect
        .poll(async () => {
          const total = await viewer.statusNumber("data-total-layers");
          return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
        }, { timeout: 120_000, message: "every layer of the sheet arrives" })
        .toBe(true);
      await expect(viewer.inspector, "the inspector stands, holding nothing yet").toHaveAttribute("data-count", "0");
      await checkpoint(page, testInfo, "j-000/sheet-open");

      /* --- j-000/entity-selected: one entity of the drawing, named, copied and deep-linked --- */
      const drawingId = new URL(page.url()).pathname.split("/viewer/")[1]?.split("/")[0] ?? "";
      expect(drawingId, "the address names the drawing this sheet is a reading of").not.toBe("");
      const record = await viewer.findRecordOfType(drawingId, SHEET, tenantId, "LINE");
      const deepLink = S_VIEWER.selecting(tenantId, projectId, drawingId, SHEET, [record.key]);

      await page.goto(deepLink, { waitUntil: "commit" });
      await expect(viewer.screen, "the address that names a key and no camera flies to it (I-85)").toHaveAttribute("data-flyto", "settled", { timeout: 120_000 });
      expect(await viewer.selectedKeys(), "the key the address named is what is held").toEqual([record.key]);

      // The pointer's own reading, at a point derived from the row's OWN world box rather than from
      // the middle of the stage: where the pick is a single two-point segment its box centre IS its
      // midpoint, and where the corpus offers only exploded paint the atom is a block instance whose
      // box is the union of every place it paints — hollow in the middle, and touched by its own
      // geometry on every side. Centre-occupancy is a property of a solid target, never of `?s=KEY`.
      const readOut = await viewer.hoverForRowKey(viewer.entities.first(), record.key);
      expect(
        readOut,
        record.atom
          ? `the flown-to entity is a single segment, so the canvas centre is its midpoint, and ${record.key} reads out there`
          : `the flown-to entity is a block instance, so its own box is where it paints, and ${record.key} reads out on it`,
      ).not.toBeNull();
      await expect(viewer.hover, "the pointer stands on it, and the panel is reading").toBeVisible();
      expect(await viewer.hover.getAttribute("data-key"), "type, layer and handle are read out for the entity the link named (R-TO-011)").toBe(record.key);
      await expect(page.getByTestId("viewer-inspector-hover-handle"), "the handle cell is that key's own handle, verbatim").toHaveText(record.key.slice(SCHEME.length));
      await expect(page.getByTestId("viewer-inspector-hover-layer"), "and its layer is named beside it").not.toBeEmpty();

      const copied = await viewer.copyKey(viewer.entities.first());
      expect(copied, "the row copied is the entity the link named").toBe(record.key);
      expect(await viewer.clipboardText(), "the clipboard holds the source key of the drawing, whole and unstripped (R-TO-011)").toBe(record.key);
      expect(record.key, "which is a source key of this reading's own scheme").toMatch(/^DXF_HANDLE:[0-9A-F]+$/);
      await expect(viewer.entities.first().getByTestId("viewer-inspector-key"), "and the row shows it whole").toHaveText(record.key);

      // The address now states the camera the fly-to left as well as the selection, so reloading it
      // restores both and flies nowhere: a shared link shows the viewport its author framed (I-85).
      const shared = page.url();
      const framed = await viewer.viewportParam();
      await page.reload({ waitUntil: "commit" });
      await expect(viewer.inspector, "the address is the whole state: reloading the link restores the selection").toHaveAttribute("data-count", "1", {
        timeout: 120_000,
      });
      expect(await viewer.selectedKeys(), "the same entity is selected again, from the address alone").toEqual([record.key]);
      expect(await viewer.viewportParam(), "and the camera the link carried is the camera it opens at").toBe(framed);
      expect(page.url(), "the address a reader would share is the address they get back").toBe(shared);

      // The frame the baseline compares holds the selection alone: the pointer is taken off the
      // sheet first, so a hover cell that depends on where a mouse happened to rest can never be
      // half of a picture (V-E2E: baselines are compared byte-wise inside a tolerance).
      await page.mouse.move(0, 0);
      await expect(viewer.hover, "nothing is under the pointer when the frame is taken").toHaveCount(0);
      await checkpoint(page, testInfo, "j-000/entity-selected");
      await expect(viewer.inspector, "the inspector's own frame, as the Golden Path leaves it").toHaveScreenshot(["j-000", "entity-selected.png"], {
        animations: "disabled",
      });
    } finally {
      await worker.stop();
    }
  });
});

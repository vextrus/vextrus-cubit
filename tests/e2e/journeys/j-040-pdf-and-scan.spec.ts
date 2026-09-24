/**
 * J-040 — "PDF vector set ingest; raster scan ingest; INTERPRETED sightings need corroboration;
 * corroborate in bulk by offered group; certificate raster disclosure" (docs/specs/cubit.bible.xml,
 * J-040), walked against the served product one step per M4 slice as each lands. Every step here
 * passes: J-040 holds no fixme (the fixme law is J-000's alone), so a step is written with the slice
 * that makes it true and never before.
 *
 * Step 1 (M4P-1; R-TO-002, L-CAD-02, R-TO-004; docs/design/s-drawings.md I-511…j): a QS drops
 * F-RCC6-BNBC's vector set — 27 pages, TrueType text — on S-Drawings. Each page becomes a sheet card,
 * read as a PDF vector sheet, carrying the number and title its own title block prints; the card of
 * the eleventh page proposes S-10 · COLUMN LAYOUT PLAN; its door opens the viewer on that page, which
 * paints, and an object of the page is selected by its PDF_OBJECT key and read out under the pointer.
 * One page is mixed (M4P-3, I-585): S-03 carries a pasted scan, so its card reads both schemes and
 * states the scan it traced.
 *
 * Step 2 (M4P-3; R-TO-003, L-CAD-02, docs/design/s-drawings.md I-584): a QS drops a scanned sheet
 * — F-RCC6-BNBC's S-10 as R1 renders it, an A1 at 300 DPI in a PNG that states no resolution — on
 * S-Drawings. The worker traces it: one card, read as a traced raster, stating that the file gave
 * no DPI and that the page stood square (deskewed 0°); its door opens the viewer on the page, a
 * traced line of it is selected by its RASTER_TRACE key and read out under the pointer.
 *
 * Nothing is transcribed: the pages and their numbers are the generator's roster
 * (fixtures/rcc6-bnbc/manifest.json), the words are the product's string tables (B-19).
 *
 * The e2e lane starts the web server and nothing else, so this journey spawns the shipped worker
 * itself — a job queue nobody consumes never finishes — and enrols an account of its own, as J-020's
 * fresh upload does, rather than signing in as the worker's seeded tenant: its subject is the upload
 * itself, and 27 more sheets (an S-10 among them) landing in the seeded workspace every run would
 * stand in every search, index and tally the other specs of that worker read there.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { drawings as drawingsCopy } from "../../../src/app/(app)/t/[tenant]/p/[project]/drawings/strings";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { SDrawingsPage, S_DRAWINGS } from "../pages/s-drawings.page";
import { SHomePage } from "../pages/s-home.page";
import { ShellPage } from "../pages/shell.page";
import { checkpoint } from "../support/checkpoint";
import { newestMail } from "../support/outbox";
import { heldAttribute } from "../support/retrying-read";
import { settled } from "../support/settled";
import { startJourneyWorker } from "../support/worker";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "../viewer/s-viewer.page";

/** F-RCC6-BNBC's vector set and the roster its generator wrote beside it. */
const BNBC_PDF = join(process.cwd(), "fixtures", "rcc6-bnbc", "rcc6-bnbc.pdf");

/** F-RCC6-BNBC's S-10 as R1 scans it: an A1 at 300 DPI, a PNG stating no resolution (manifest `raster.r1`). */
const R1_S10 = join(process.cwd(), "fixtures", "rcc6-bnbc", "raster", "r1", "s-10.png");

/** The scheme a traced line is keyed under: a whole content digest (L-CAD-02). */
const RASTER_TRACE = "RASTER_TRACE";
const RASTER_KEY = /^RASTER_TRACE:[0-9A-F]{64}$/;
const MANIFEST = join(process.cwd(), "fixtures", "rcc6-bnbc", "manifest.json");

/** The scheme a vector PDF's objects are keyed under: a whole content digest (L-CAD-02). */
const PDF_OBJECT = "PDF_OBJECT";
const PDF_KEY = /^PDF_OBJECT:[0-9A-F]{64}$/;

/**
 * The one page of the vector set a scan is pasted on: S-03, a drafted sheet carrying a grey scanned
 * detail (trap T-IMAGE-LOGO, F-SCAN's seed). A mixed page mints both schemes, and its card states the
 * scan at the DPI its placement gives it and the deskew it found (R-TO-003, I-585).
 */
const MIXED = { number: "S-03", dpi: "152.4", deskew: "0" } as const;

/** The sheet step 1 opens: S-10, the column layout plan, printed on the set's eleventh page. */
const S10 = { number: "S-10", title: "COLUMN LAYOUT PLAN", discipline: "STRUCTURAL" } as const;

/** How long one fresh reading may take: the extraction through `uv run`, then three tiers a page. */
const FRESH_READING_MS = 90_000;

/** The layout a page is read as: its place in the file (I-511). */
function pageLayout(index: number): string {
  return `Page ${String(index + 1)}`;
}

/** The set's sheets in page order, each with the number its title block prints. */
function roster(): readonly { number: string; title: string }[] {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { sheets?: { number?: string; title?: string }[] };
  const sheets = (manifest.sheets ?? []).map((sheet) => ({ number: String(sheet.number ?? ""), title: String(sheet.title ?? "") }));
  expect(sheets.length, "the corpus manifest declares the sheets its PDF prints, one a page").toBeGreaterThan(0);
  return sheets;
}

/** A fresh account holding one fresh project — J-020's enrolment, for a reading no other spec shares. */
async function enrolWithProject(page: Page): Promise<{ tenantId: string; projectId: string }> {
  const auth = new SAuthPage(page);
  const shell = new ShellPage(page);
  const home = new SHomePage(page);
  const mark = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const email = `j040-${mark}@cubit.test`;
  const password = `pdf-set-journey-${mark}`;
  const project = `Padma PDF Set ${mark}`;

  await auth.open(S_AUTH.signUp);
  await auth.signUpWith(email, password, `PDF Set ${mark}`);
  await auth.expectNotice();
  const verifyMail = await newestMail(email, "verify-email");
  await auth.openWithToken(S_AUTH.verify, verifyMail.token);
  await auth.expectNotice();
  await auth.open(S_AUTH.signIn);
  await auth.signInWith(email, password);

  await shell.workspaceDoor.click();
  await page.waitForURL(/\/t\/[0-9a-f-]{36}$/);
  const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
  expect(tenantId, "the workspace door leads to the workspace this person holds").not.toBe("");

  await home.createWith({ name: project, code: `PDF-${mark.slice(0, 4)}`, client: "Padma Homes", district: "Dhaka", buildingType: 1, storeys: "7" });
  const card = home.cardNamed(project);
  await expect(card, "the created project stands on S-Home").toBeVisible();
  const projectId = (await heldAttribute(card, "data-project")) ?? "";
  expect(projectId, "the card names the project it is for").not.toBe("");
  return { tenantId, projectId };
}

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe("J-040 — a PDF set and a scan, read and corroborated (M4)", () => {
  test("J-040 step 1: a vector PDF set dropped on S-Drawings is one sheet per page, S-10 is proposed from its title block, and it opens in the viewer", async ({ page, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const sheets = roster();
    const worker = await startJourneyWorker();
    try {
      const { tenantId, projectId } = await enrolWithProject(page);
      const drawings = new SDrawingsPage(page);
      const viewer = new SViewerPage(page);

      /* --- the set, dropped through the screen's own Dropzone and read by the shipped worker --- */
      await drawings.open(tenantId, projectId);
      await drawings.dropFile(BNBC_PDF);
      await expect(drawings.dropzoneItems.first(), "the PDF is stored by the upload seam").toHaveAttribute("data-state", "stored", { timeout: FRESH_READING_MS });
      await expect(drawings.timeline, "the ingest and the thumbnails it chained finish where the work was started (X-1) — a PDF is read, never refused").toHaveAttribute("data-state", "done", {
        timeout: FRESH_READING_MS,
      });

      /* --- one card per page, each read as a PDF vector sheet with the number its block prints --- */
      await expect(drawings.index, "the index stands once the record has landed").toBeVisible();
      await expect(drawings.cards, `the ${String(sheets.length)} pages fan out as ${String(sheets.length)} cards, and nothing else`).toHaveCount(sheets.length, { timeout: FRESH_READING_MS });
      for (const [index, sheet] of sheets.entries()) {
        const card = drawings.cardForLayout(pageLayout(index));
        await expect(card, `${pageLayout(index)} is a card of its own`).toHaveCount(1);
        await expect(drawings.cell(card, S_DRAWINGS.number), `${pageLayout(index)} proposes the number its title block prints`).toHaveText(sheet.number);
        const scheme = drawings.cell(card, S_DRAWINGS.scheme);
        const scan = drawings.cell(card, S_DRAWINGS.scan);
        if (sheet.number === MIXED.number) {
          // I-585: the drafted objects and the pasted scan are read each by its own lane, on one page.
          await expect(scheme, `${pageLayout(index)} is the mixed page: its keys are of two schemes`).toHaveCount(2);
          await expect
            .poll(async () => (await scheme.evaluateAll((badges) => badges.map((badge) => badge.getAttribute("data-scheme") ?? ""))).sort(), {
              message: `${pageLayout(index)} is read from PDF objects and from the lines traced off its scan (I-519, I-585)`,
            })
            .toEqual([PDF_OBJECT, RASTER_TRACE]);
          await expect(scheme.filter({ hasText: drawingsCopy.drawings_scheme_pdf_object }), "and says both in words (R-UI-082)").toHaveCount(1);
          await expect(scheme.filter({ hasText: drawingsCopy.drawings_scheme_raster_trace })).toHaveCount(1);
          await expect(scan, "the card states the one scan it traced").toHaveCount(1);
          await expect(scan, "at the DPI its placement on the page gives it").toHaveAttribute("data-dpi", MIXED.dpi);
          await expect(scan, "and the page stood square").toHaveAttribute("data-deskew", MIXED.deskew);
        } else {
          await expect(scheme, `${pageLayout(index)}'s keys are of one scheme`).toHaveCount(1);
          await expect(scheme, `${pageLayout(index)} is read from PDF objects (I-519)`).toHaveAttribute("data-scheme", PDF_OBJECT);
          await expect(scheme, "and says so in words (R-UI-082)").toContainText(drawingsCopy.drawings_scheme_pdf_object);
          await expect(scan, `${pageLayout(index)} traced no scan, and its card states none`).toHaveCount(0);
        }
        await expect(drawings.cell(card, S_DRAWINGS.discipline), `${pageLayout(index)} is read from its title block`).toHaveAttribute("data-basis", "GRAMMAR");
      }

      /* --- j-040/pdf-sheet-card: the eleventh page is S-10, the column layout plan --- */
      const s10 = drawings.cardForLayout(pageLayout(10));
      await expect(drawings.cell(s10, S_DRAWINGS.number), "the eleventh page proposes S-10").toHaveText(S10.number);
      await expect(drawings.cell(s10, S_DRAWINGS.title), "titled as its block prints it").toHaveText(S10.title);
      await expect(s10, "a structural sheet by its own number's designator (I-365)").toHaveAttribute("data-discipline", S10.discipline);
      await expect(drawings.cell(s10, S_DRAWINGS.scale), "a page states no world unit: its scale waits on a QS, it is not unplaceable (I-513)").toHaveAttribute("data-scale", "unaffirmed");
      await drawings.search.fill(S10.number);
      await expect(drawings.cards, `searching ${S10.number} leaves its one card`).toHaveCount(1);
      await settled(page);
      await checkpoint(page, testInfo, "j-040/pdf-sheet-card");

      /* --- j-040/pdf-sheet-open: the card's own door, onto the page in the viewer --- */
      const door = drawings.cell(s10, S_DRAWINGS.open);
      const href = (await heldAttribute(door, "href")) ?? "";
      await door.click();
      await expect(page, "the door lands on the page it named").toHaveURL(`${origin}${href}`);
      await expect(viewer.status, "the page paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
      await expect(viewer.status, "drawn by WebGL").toHaveAttribute("data-renderer", "webgl");
      await expect
        .poll(async () => {
          const total = await viewer.statusNumber("data-total-layers");
          return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
        }, { timeout: FRESH_READING_MS, message: "every layer of the page arrives" })
        .toBe(true);

      // One object of the page, named by its content digest, selected from the address and read out
      // under the pointer — the inspector reads a PDF's keys as it reads a DXF's (VD-1).
      const drawingId = new URL(page.url()).pathname.split("/viewer/")[1]?.split("/")[0] ?? "";
      expect(drawingId, "the address names the drawing this page is a reading of").not.toBe("");
      const record = await viewer.findRecordOfType(drawingId, pageLayout(10), tenantId, "LWPOLYLINE");
      expect(record.key, "a page object is keyed by its whole content digest (L-CAD-02)").toMatch(PDF_KEY);
      await page.goto(S_VIEWER.selecting(tenantId, projectId, drawingId, pageLayout(10), [record.key]), { waitUntil: "commit" });
      await expect(viewer.screen, "the address that names a key flies to it").toHaveAttribute("data-flyto", "settled", { timeout: FRESH_READING_MS });
      expect(await viewer.selectedKeys(), "the key the address named is what is held").toEqual([record.key]);
      const readOut = await viewer.hoverForRowKey(viewer.entities.first(), record.key);
      expect(readOut, `${record.key} reads out under the pointer where it is drawn`).not.toBeNull();
      expect(await heldAttribute(viewer.hover, "data-key"), "the pointer stands on the object the address named").toBe(record.key);
      await checkpoint(page, testInfo, "j-040/pdf-sheet-open");
    } finally {
      await worker.stop();
    }
  });

  test("J-040 step 2: a scanned sheet dropped on S-Drawings is traced — one card stating its DPI and deskew, and a traced line selects by its RASTER_TRACE key", async ({ page, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const worker = await startJourneyWorker();
    try {
      const { tenantId, projectId } = await enrolWithProject(page);
      const drawings = new SDrawingsPage(page);
      const viewer = new SViewerPage(page);

      /* --- the scan, dropped through the screen's own Dropzone and traced by the shipped worker --- */
      await drawings.open(tenantId, projectId);
      await drawings.dropFile(R1_S10);
      await expect(drawings.dropzoneItems.first(), "the scan is stored by the upload seam").toHaveAttribute("data-state", "stored", { timeout: FRESH_READING_MS });
      await expect(drawings.timeline, "the ingest and the thumbnails it chained finish — a scan is traced, never refused (R-TO-003)").toHaveAttribute("data-state", "done", {
        timeout: FRESH_READING_MS,
      });

      /* --- j-040/scan-card: one card, read from traced lines, saying what it was traced from --- */
      await expect(drawings.cards, "one scanned page is one card").toHaveCount(1, { timeout: FRESH_READING_MS });
      const card = drawings.cardForLayout(pageLayout(0));
      const scheme = drawings.cell(card, S_DRAWINGS.scheme);
      await expect(scheme, "its keys are the vectoriser's alone").toHaveCount(1);
      await expect(scheme, "read from traced lines (I-519)").toHaveAttribute("data-scheme", RASTER_TRACE);
      await expect(scheme, "and says so in words (R-UI-082)").toContainText(drawingsCopy.drawings_scheme_raster_trace);
      const scan = drawings.cell(card, S_DRAWINGS.scan);
      await expect(scan, "the card states the scan it was traced from").toHaveCount(1);
      await expect(scan, "the PNG states no resolution, and the card prints none it was not given (I-584)").toHaveAttribute("data-dpi", "");
      await expect(scan, "R1 is a square render: the deskew found no turn").toHaveAttribute("data-deskew", "0");
      await expect(scan).toContainText(drawingsCopy.drawings_scan_dpi_unstated);
      await expect(drawings.cell(card, S_DRAWINGS.scale), "a scan states no world unit: its scale waits on a QS").toHaveAttribute("data-scale", "unaffirmed");
      await settled(page);
      await checkpoint(page, testInfo, "j-040/scan-card");

      /* --- j-040/scan-open: the card's door, onto the traced page in the viewer --- */
      const door = drawings.cell(card, S_DRAWINGS.open);
      const href = (await heldAttribute(door, "href")) ?? "";
      await door.click();
      await expect(page, "the door lands on the page it named").toHaveURL(`${origin}${href}`);
      await expect(viewer.status, "the traced page paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
      await expect
        .poll(async () => {
          const total = await viewer.statusNumber("data-total-layers");
          return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
        }, { timeout: FRESH_READING_MS, message: "every layer of the page arrives" })
        .toBe(true);

      // One traced line, named by its content digest, selected from the address and read out under
      // the pointer — the inspector reads a traced key as it reads a PDF's or a DXF's.
      const drawingId = new URL(page.url()).pathname.split("/viewer/")[1]?.split("/")[0] ?? "";
      expect(drawingId, "the address names the drawing this page is a reading of").not.toBe("");
      const record = await viewer.findRecordOfType(drawingId, pageLayout(0), tenantId, "LINE");
      expect(record.key, "a traced line is keyed by its whole content digest (L-CAD-02)").toMatch(RASTER_KEY);
      await page.goto(S_VIEWER.selecting(tenantId, projectId, drawingId, pageLayout(0), [record.key]), { waitUntil: "commit" });
      await expect(viewer.screen, "the address that names a traced key flies to it").toHaveAttribute("data-flyto", "settled", { timeout: FRESH_READING_MS });
      expect(await viewer.selectedKeys(), "the traced key the address named is what is held").toEqual([record.key]);
      const readOut = await viewer.hoverForRowKey(viewer.entities.first(), record.key);
      expect(readOut, `${record.key} reads out under the pointer where it is traced`).not.toBeNull();
      expect(await heldAttribute(viewer.hover, "data-key"), "the pointer stands on the traced line the address named").toBe(record.key);
      await checkpoint(page, testInfo, "j-040/scan-open");
    } finally {
      await worker.stop();
    }
  });
});

/**
 * PERF-040 — PB-5 for M4's two new readings: a PDF vector set ingested inside 5 min, and a scanned
 * A1 sheet at 300 DPI vectorised inside 30 s (docs/specs/cubit.bible.xml PB-5; M4's exit "PB-5 (PDF,
 * raster) met"; docs/design/s-drawings.md I-695).
 *
 * This is the ONE place PB-5's PDF and raster durations are asserted. `pnpm test:perf` is `pnpm e2e
 * --journey PERF-`, so the PERF-040 tag below is what the perf lane collects; the journey lane's
 * sweep excludes every PERF- title, and J-040 (which walks the same two drops for what they read)
 * asserts no duration.
 *
 * WHAT IS TIMED (I-695). End to end, as a QS waits for it: from the file dropped on S-Drawings'
 * own Dropzone to the moment the job timeline stands `done` AND every page stands as its card. That
 * spans the upload seam, the queue, the shipped worker's `ingestDrawing` (the cad CLI through `uv
 * run`), the stored record, the partition and the thumbnails it chains. The raster clause names the
 * vectorise alone; timing the whole path is the stricter reading, so a green here meets it and a red
 * says which interval grew (the drop-to-stored interval is recorded beside the total).
 *
 * WHAT IS INGESTED. The vector set is F-RCC6-BNBC's stroked-text PDF, `rcc6-bnbc.shx.pdf` — 27
 * pages, no text object, every letter drawn as paths (71,112 of them): the heaviest vector set the
 * corpus holds, and the one a plotter's SHX output gives. The raster is R1's S-10, the corpus's A1 at
 * 300 DPI; its pixel size is checked against the sheet's own paper and R1's DPI from the manifest,
 * so a regenerated corpus that moved either is refused here rather than timed at another size.
 *
 * The worker is started before the clock (its boot is not an ingest) and each test enrols a fresh
 * account, so the 27 sheets land in no workspace another spec reads (J-040's reasoning). The two
 * tests run in series in one file, so neither times the other's ingest.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { SAuthPage, S_AUTH } from "./pages/s-auth.page";
import { SDrawingsPage, S_DRAWINGS } from "./pages/s-drawings.page";
import { SHomePage } from "./pages/s-home.page";
import { ShellPage } from "./pages/shell.page";
import { newestMail } from "./support/outbox";
import { heldAttribute } from "./support/retrying-read";
import { startJourneyWorker } from "./support/worker";

/** PB-5: a PDF vector set, end to end. */
const PB_5_PDF_MS = 300_000;

/** PB-5: one A1 sheet at 300 DPI, vectorised. */
const PB_5_RASTER_MS = 30_000;

const CORPUS = join(process.cwd(), "fixtures", "rcc6-bnbc");
const MANIFEST = join(CORPUS, "manifest.json");

/** The vector set timed: the stroked-text PDF (manifest `pdf["rcc6-bnbc.shx.pdf"]`). */
const SHX_PDF_NAME = "rcc6-bnbc.shx.pdf";
const SHX_PDF = join(CORPUS, SHX_PDF_NAME);

/** The scan timed: R1's rendering of S-10 (manifest `raster.r1`). */
const RASTER_SHEET = "S-10";
const R1_S10 = join(CORPUS, "raster", "r1", "s-10.png");

/** The schemes each reading's keys are minted under (L-CAD-02). */
const PDF_OBJECT = "PDF_OBJECT";
const RASTER_TRACE = "RASTER_TRACE";

const MM_PER_INCH = 25.4;

type Manifest = {
  sheets?: { number?: string; size?: string; page_mm?: [number, number] }[];
  pdf?: Record<string, { mode?: string; pages?: number; text_objects?: number }>;
  raster?: { r1?: { dpi?: number; files?: string[] } };
};

function manifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/** A PNG's pixel size, read from its IHDR chunk (bytes 16–23, big-endian). */
function pngSize(path: string): { width: number; height: number } {
  const head = readFileSync(path).subarray(0, 24);
  expect(head.subarray(12, 16).toString("latin1"), `${path} is a PNG whose first chunk is its header`).toBe("IHDR");
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

/** A fresh account holding one fresh project, so what is ingested lands where no other spec reads. */
async function enrolWithProject(page: Page, tag: string): Promise<{ tenantId: string; projectId: string }> {
  const auth = new SAuthPage(page);
  const shell = new ShellPage(page);
  const home = new SHomePage(page);
  const mark = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const email = `perf040-${tag}-${mark}@cubit.test`;
  const password = `ingest-perf-${mark}`;
  const project = `Padma Ingest ${mark}`;

  await auth.open(S_AUTH.signUp);
  await auth.signUpWith(email, password, `Ingest ${mark}`);
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

  await home.createWith({ name: project, code: `ING-${mark.slice(0, 4)}`, client: "Padma Homes", district: "Dhaka", buildingType: 1, storeys: "7" });
  const card = home.cardNamed(project);
  await expect(card, "the created project stands on S-Home").toBeVisible();
  const projectId = (await heldAttribute(card, "data-project")) ?? "";
  expect(projectId, "the card names the project it is for").not.toBe("");
  return { tenantId, projectId };
}

/** What one timed ingest took: the whole wait, and the part of it that was the upload. */
type Timed = { totalMs: number; storedMs: number };

/**
 * Drop one file on S-Drawings and time it to the last card. Each wait is allowed twice the budget,
 * so a slow run ends on the budget assertion that prints its number rather than on a bare timeout.
 */
async function timeIngest(drawings: SDrawingsPage, file: string, cards: number, budgetMs: number): Promise<Timed> {
  const wait = { timeout: 2 * budgetMs };
  const droppedAt = Date.now();
  await drawings.dropFile(file);
  await expect(drawings.dropzoneItems.first(), "the file is stored by the upload seam").toHaveAttribute("data-state", "stored", wait);
  const storedMs = Date.now() - droppedAt;
  await expect(drawings.timeline, "the ingest and the work it chained finish — read, never refused").toHaveAttribute("data-state", "done", wait);
  await expect(drawings.cards, `every page stands as its card: ${String(cards)}`).toHaveCount(cards, wait);
  return { totalMs: Date.now() - droppedAt, storedMs };
}

/** The measurement on the record: an annotation the reporter prints and a JSON the run keeps. */
async function record(testInfo: TestInfo, name: string, facts: Record<string, number | string>): Promise<void> {
  testInfo.annotations.push({ type: "PB-5", description: `${name} ${JSON.stringify(facts)}` });
  await testInfo.attach(`pb-5-${name}.json`, { body: Buffer.from(JSON.stringify(facts), "utf8"), contentType: "application/json" });
}

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("PERF-040 — PB-5: a PDF vector set and an A1 scan, ingested inside their budgets", () => {
  test.describe.configure({ mode: "serial" });

  test("PERF-040 PB-5 vector: the 27-page stroked-text PDF set is ingested end to end inside 5 min, and the time is recorded", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(3 * PB_5_PDF_MS);
    expect(baseURL, "the perf lane drives the served product").toBeTruthy();
    const set = manifest().pdf?.[SHX_PDF_NAME];
    expect(set?.mode, `${SHX_PDF_NAME} is the stroked-text set: its letters are paths`).toBe("shx");
    expect(set?.text_objects, "and it carries no text object for the reader to lean on").toBe(0);
    const pages = set?.pages ?? 0;
    expect(pages, "the manifest states the pages the set prints").toBeGreaterThan(0);

    const worker = await startJourneyWorker();
    try {
      const { tenantId, projectId } = await enrolWithProject(page, "pdf");
      const drawings = new SDrawingsPage(page);
      await drawings.open(tenantId, projectId);

      const timed = await timeIngest(drawings, SHX_PDF, pages, PB_5_PDF_MS);

      // What was timed is the reading itself: every page read from PDF objects, none refused.
      await expect(
        page.locator(`[data-testid="${S_DRAWINGS.scheme}"][data-scheme="${PDF_OBJECT}"]`),
        `each of the ${String(pages)} pages is read from its PDF objects (I-519)`,
      ).toHaveCount(pages);

      await record(testInfo, "pdf-vector", { file: SHX_PDF_NAME, pages, budgetMs: PB_5_PDF_MS, totalMs: timed.totalMs, storedMs: timed.storedMs });
      expect(timed.totalMs, `PB-5: the ${String(pages)}-page vector set is ingested inside ${String(PB_5_PDF_MS)} ms, and this run took ${String(timed.totalMs)} ms`).toBeLessThanOrEqual(PB_5_PDF_MS);
    } finally {
      await worker.stop();
    }
  });

  test("PERF-040 PB-5 raster: an A1 scan at 300 DPI is traced end to end inside 30 s, and the time is recorded", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(6 * PB_5_RASTER_MS + 120_000);
    expect(baseURL, "the perf lane drives the served product").toBeTruthy();
    const corpus = manifest();
    const dpi = corpus.raster?.r1?.dpi ?? 0;
    expect(dpi, "R1 is the corpus's 300 DPI scan").toBe(300);
    const sheet = corpus.sheets?.find((candidate) => candidate.number === RASTER_SHEET);
    expect(sheet?.size, `${RASTER_SHEET} is drawn on an A1`).toBe("A1");
    const [widthMm, heightMm] = sheet?.page_mm ?? [0, 0];
    const { width, height } = pngSize(R1_S10);
    // A pixel either way is the render's rounding (841 mm at 300 DPI is 9,933.07 px).
    expect(Math.abs(width - (widthMm / MM_PER_INCH) * dpi), `the scan is ${RASTER_SHEET}'s A1 width at ${String(dpi)} DPI`).toBeLessThanOrEqual(1);
    expect(Math.abs(height - (heightMm / MM_PER_INCH) * dpi), `and its A1 height at ${String(dpi)} DPI`).toBeLessThanOrEqual(1);

    const worker = await startJourneyWorker();
    try {
      const { tenantId, projectId } = await enrolWithProject(page, "raster");
      const drawings = new SDrawingsPage(page);
      await drawings.open(tenantId, projectId);

      const timed = await timeIngest(drawings, R1_S10, 1, PB_5_RASTER_MS);

      // What was timed is a trace: the one card's keys are the vectoriser's.
      await expect(drawings.cell(drawings.cards.first(), S_DRAWINGS.scheme), "the scan is read from traced lines (I-519, I-584)").toHaveAttribute("data-scheme", RASTER_TRACE);

      await record(testInfo, "raster-a1-300dpi", { file: "raster/r1/s-10.png", widthPx: width, heightPx: height, dpi, budgetMs: PB_5_RASTER_MS, totalMs: timed.totalMs, storedMs: timed.storedMs });
      expect(timed.totalMs, `PB-5: an A1 at ${String(dpi)} DPI is traced inside ${String(PB_5_RASTER_MS)} ms, and this run took ${String(timed.totalMs)} ms`).toBeLessThanOrEqual(PB_5_RASTER_MS);
    } finally {
      await worker.stop();
    }
  });
});

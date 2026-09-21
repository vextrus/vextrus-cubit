/**
 * J-000 SEGMENTS: generate BOQ PDF (draft); run the structural campaign on F-RCC6-BNBC; review the register; emit the unpriced BOQ and the BBS as DRAFT UNSIGNED; open the XLSX
 *
 * MISSING DOOR: the partition reads no caption for F-RCC6-BNBC's column layout plan — the plan is named only by its paper-space viewport title (sheet S-10) and its grid bubbles are read as no axis — so the campaign places nothing and no register, BOQ, BBS or golden can be walked (R-TO-030, L-CAD-06, L-CAD-07; traps T-FRAMES-MODELSPACE, T-TEXT-OVERLAP)
 * (AM-09 §2: a leg that cannot be reached through the UI is a missing screen, not a licence to stage).
 * The levels and the notes ARE walked, by clicks, in m3-levels-and-notes.spec.ts; what stands here as
 * test.fixme is the walk that follows Measure, written and waiting for the door.
 *
 * M3's leg of the golden path, WALKED (AM-09 §3, AM-17): the M3 fixture F-RCC6-BNBC (AM-01) is
 * uploaded through the product into a second project of the golden run's workspace, its scales are
 * affirmed, the level stack its building section states is confirmed and every storey height read
 * off the section's own marks, the typical ranges its sheets state are authored, its general notes
 * are transcribed (J-031's and J-032's doors, by clicks), Measure is pressed, the register is
 * reviewed, the unpriced BOQ and the bar schedule are emitted as DRAFT — UNSIGNED (AM-05 §2), the
 * XLSX is opened with exceljs and its formulas read, and both documents are read against the
 * fixture's own goldens through `goldenRows("rcc6-bnbc")` and `bbsGoldenDocument("rcc6-bnbc")`.
 * The walk itself lives in `golden-run.ts` (`bnbcMeasured`), because every leg here starts from the
 * same measured campaign and a second worker of the lane walks it on its own project.
 *
 * WHAT IS COMPARED, AND HOW (L-QTY-06, AM-01). A numeric assertion names its roster: the cells the
 * product PUBLISHED with COMPLETE coverage are compared cell by cell — (class, kind, level) — against
 * the golden's row for that cell, and held inside the band (3 % under, 0 % over: an over-measured
 * figure is never a disclosure, L-MEA-09). Golden cells the product did not publish are the
 * campaign's DECLARED residue — what the coverage grid and the certificate say the campaign did not
 * establish — and are listed by name in the leg's attachment rather than asserted as figures. A
 * product cell the golden holds no row for is an over-measurement candidate and fails by name. The
 * bar schedule is compared the same way, per (class, level, mark), over the classes the rebar rail
 * reads (columns and shear walls; the rest are observed REBAR_SCHEDULE_UNREAD and stand declared).
 *
 * Nothing here measures time (AM-10 §3, AM-17: "the M3 leg opens the XLSX; it does not time it").
 */
import ExcelJS from "exceljs";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { pdfText } from "../../../docs/support/pdf-text";
import { bbsGoldenDocument, goldenRows } from "../../../golden/support/golden-fixture";
import { SBbsPage } from "../../pages/s-bbs.page";
import { SBoqPage } from "../../pages/s-boq.page";
import { NOT_ESTABLISHED, QUANTITY_BEARING, SCoveragePage } from "../../pages/s-coverage.page";
import { SDocumentsPage } from "../../pages/s-documents.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { checkpoint } from "../../support/checkpoint";
import { everyAttribute, everyRow, heldAttribute, steadyCount, steadyText } from "../../support/retrying-read";
import { settled } from "../../support/settled";
import { TESTIDS } from "../../../../src/ui/testids";
import { bnbcMeasured, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

/** The fixture the goldens are read for (AM-01). */
const FIXTURE = "rcc6-bnbc";

/** The banner AM-05 §2 puts on every page of a working document before M7. */
const BANNER = "DRAFT — UNSIGNED";

/** The two document kinds the M3 segment emits, as S-Documents keys them. */
const BOQ_DRAFT = "boq-draft";
const BBS = "bbs";

/** L-QTY-06's band: 3 % under and nothing over, per cell. */
const UNDER_TOLERANCE = 0.03;

/** How the product spells a kind, and how the golden spells the same kind (schema 2, AM-01). */
const GOLDEN_KIND: Readonly<Record<string, string>> = Object.freeze({
  "rcc.concrete": "RCC_CONCRETE",
  "rcc.formwork": "FORMWORK",
  "rcc.rebar": "REBAR",
  "masonry.brickwork": "BRICKWORK",
  "earthwork.excavation": "EXCAVATION",
  "pcc.blinding": "BLINDING",
});

/** The golden's level for a class the product measures in the lawful-null foundation slot (L-CAD-07). */
const FOUNDATION_LEVEL: Readonly<Record<string, string>> = Object.freeze({ pile: "PILE" });
const FOUNDATION_DEFAULT = "FDN";

/** The classes the rebar rail reads today (R-TO-032's two readers), as the golden spells them. */
const BBS_CLASSES: readonly string[] = Object.freeze(["COLUMN", "SHEAR_WALL"]);

/** How long a render of the M3 campaign's documents may take to be filed. */
const RENDER_BUDGET_MS = 600_000;

/** The XLSX's fixed sheets (A-BOQ-XLSX, s-boq I-273). */
const SUMMARY = "Summary";
const QUANTITIES = "Quantities";

/** One cell of the band matrix, compared or declared. */
type Cell = { class: string; kind: string; level: string };

/** The Quantities sheet, read back by its own headers — never by a column index typed here. */
type QuantityRow = Record<string, string>;

const cellKey = (cell: Cell): string => `${cell.class}|${cell.kind}|${cell.level}`;

/** Is a product figure inside L-QTY-06's band of its golden? */
function insideBand(product: number, golden: number): boolean {
  return product <= golden + 1e-9 && product >= golden * (1 - UNDER_TOLERANCE) - 1e-9;
}

/** The pages of a rendered document's text, as the docs lane reads them. */
function pagesOf(pdf: Buffer): string[] {
  return pdfText(new Uint8Array(pdf))
    .split("\n")
    .filter((page) => page.trim() !== "");
}

/** The bytes a signed link serves to this session — the browser's own request, cookies and all. */
async function bytesOf(page: Page, href: string): Promise<Buffer> {
  const response = await page.request.get(href);
  expect(response.ok(), `the signed link ${href.split("?")[0]} serves its bytes to the member who asked for them`).toBe(true);
  return response.body();
}

/** A sheet's rows as objects keyed by the header row's own words. */
function rowsOf(sheet: ExcelJS.Worksheet): QuantityRow[] {
  const headers = (sheet.getRow(1).values as (string | undefined)[]).map((value) => (value === undefined ? "" : String(value)));
  const rows: QuantityRow[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const values = row.values as (ExcelJS.CellValue | undefined)[];
    const record: QuantityRow = {};
    headers.forEach((header, at) => {
      if (header === "") return;
      const value = values[at];
      record[header] = value === undefined || value === null ? "" : typeof value === "object" && "result" in value ? String(value.result ?? "") : String(value);
    });
    rows.push(record);
  });
  return rows;
}

/** The golden's level for a line of the product: the label it stands on, or the foundation slot. */
function goldenLevelOf(klass: string, level: string): string {
  return level === "" ? (FOUNDATION_LEVEL[klass] ?? FOUNDATION_DEFAULT) : level;
}

/**
 * The band matrix over the M3 golden: the product's COMPLETE cells summed per (class, kind, level),
 * the golden's rows summed the same way (NET and LAP together for rebar), and the roster of what was
 * compared, what the campaign declared it did not establish, and what stands nowhere in the golden.
 */
function bandMatrix(lines: readonly QuantityRow[]): { compared: string[]; failed: string[]; declared: string[]; unknown: string[]; unmapped: string[] } {
  const golden = new Map<string, number>();
  for (const row of goldenRows(FIXTURE)) {
    const key = cellKey({ class: row.class, kind: row.kind, level: row.level });
    golden.set(key, (golden.get(key) ?? 0) + Number(row.quantity));
  }

  const product = new Map<string, number>();
  const unmapped = new Set<string>();
  for (const line of lines) {
    const coverage = line["Coverage"] ?? "";
    const quantity = line["Quantity"] ?? "";
    if (coverage !== "COMPLETE" || quantity === "") continue;
    const kind = GOLDEN_KIND[line["Kind"] ?? ""];
    if (kind === undefined) {
      unmapped.add(`${line["Class"] ?? ""}|${line["Kind"] ?? ""}`);
      continue;
    }
    const key = cellKey({ class: (line["Class"] ?? "").toUpperCase(), kind, level: goldenLevelOf(line["Class"] ?? "", line["Level"] ?? "") });
    product.set(key, (product.get(key) ?? 0) + Number(quantity));
  }

  const compared: string[] = [];
  const failed: string[] = [];
  const unknown: string[] = [];
  for (const [key, figure] of [...product.entries()].sort(([left], [right]) => (left < right ? -1 : 1))) {
    const expected = golden.get(key);
    if (expected === undefined) {
      unknown.push(`${key} = ${figure.toFixed(3)} (the golden holds no row for this cell)`);
      continue;
    }
    const line = `${key}: product ${figure.toFixed(3)} · golden ${expected.toFixed(3)} · ${((figure / expected - 1) * 100).toFixed(2)} %`;
    compared.push(line);
    if (!insideBand(figure, expected)) failed.push(line);
  }
  const declared = [...golden.keys()].filter((key) => !product.has(key)).sort();
  return { compared, failed, declared, unknown, unmapped: [...unmapped].sort() };
}

/** A reading of the matrix, attached to the run so the handoff can quote it. */
async function attach(testInfo: TestInfo, name: string, body: string): Promise<void> {
  await testInfo.attach(name, { body, contentType: "text/plain" });
}

/** The right-hand columns standing beside the work surface — the shell hosts one, and these screens mount none. */
function secondRightColumn(main: Locator): Locator {
  return main.locator('[data-rendered-region="inspector"], [role="complementary"]');
}

test.describe.serial("J-000 — Golden Path: M3's leg on F-RCC6-BNBC", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test.fixme("MISSING DOOR: J-000 m3-bill-and-schedules: the structural campaign is measured on F-RCC6-BNBC and the register is reviewed", async ({ page }, testInfo) => {
    test.setTimeout(1_800_000);
    const run = await bnbcMeasured(page);
    const takeoff = new STakeoffPage(page);
    const coverage = new SCoveragePage(page);

    await takeoff.open(run.tenantId, run.bnbc.projectId);
    await expect(takeoff.root, "the register reads the measured campaign").toHaveAttribute("data-state", /ready|partial/);
    await expect(takeoff.levelStack.or(takeoff.tree), "the campaign's index stands beside the lines").toBeVisible();
    const count = await steadyText(takeoff.linesCount, "the register's count line");
    expect(count, "the rails published lines over the M3 fixture").not.toMatch(/^0 of/);

    const rows = takeoff.lines.getByTestId(TESTIDS.datatable.row);
    await expect(rows, "the campaign's published lines stand in the table").not.toHaveCount(0);
    await expect(takeoff.evidenceLinks, "every line offering a Trace to the entities it cites (R-UI-022)").not.toHaveCount(0);

    // The refusals and deferrals, reviewed where they stand: each says why, by its registered code.
    const refusals = await steadyText(takeoff.refusals, "the deferred-and-refused section").catch(() => "");
    await attach(testInfo, "m3-register-refusals", `count=${(await heldAttribute(takeoff.refusals, "data-count").catch(() => null)) ?? "absent"}\n${refusals}`);

    await takeoff.filter("class").click();
    await page.getByRole("option", { name: /^column$/i }).first().click();
    await expect(takeoff.linesCount, "the register counts the column lines the column layout's members measure to").not.toHaveText(/^0 of/);
    await settled(page);
    await checkpoint(page, testInfo, "j-000/bnbc-register");

    /* --- the coverage grid: what the campaign did and did not establish, said in cells (L-QTY-05) --- */
    await coverage.openThroughNav();
    await expect(coverage.screen, "the coverage screen reads the measured campaign").toHaveAttribute("data-state", /ready|partial/);
    await expect(coverage.cells, "with a cell per kind and class the campaign stands on").not.toHaveCount(0);
    await expect(coverage.measuring(QUANTITY_BEARING), "the measured cells bear published quantity").not.toHaveCount(0);
    const unestablished = await steadyCount(coverage.measuring(NOT_ESTABLISHED), "the cells the campaign did not establish", { min: 0 });
    await attach(testInfo, "m3-coverage", `not-established cells=${unestablished}`);
    await expect(coverage.statement("MEASUREMENT"), "the measurement boundary prints in full").toBeVisible();
    await settled(page);
    await checkpoint(page, testInfo, "j-000/bnbc-coverage");
  });

  test.fixme("MISSING DOOR: J-000 m3-bill-and-schedules: the unpriced BOQ is emitted as DRAFT — UNSIGNED, the XLSX is opened, and the takeoff is read against the golden", async ({ page }, testInfo) => {
    test.setTimeout(1_800_000);
    const run = await bnbcMeasured(page);
    const takeoff = new STakeoffPage(page);
    const boq = new SBoqPage(page);
    const documents = new SDocumentsPage(page);

    await takeoff.open(run.tenantId, run.bnbc.projectId);
    await boq.openThroughNav();
    await settled(page);
    expect(await boq.state(), "the draft is read and rendered").toMatch(/^(ready|partial)$/);
    await expect(boq.bills, "the campaign's lines stand in L-BD-08's sections").not.toHaveCount(0);
    await expect(boq.lines, "and every published line is listed").not.toHaveCount(0);
    await expect(boq.main.locator("select, input[type=date]"), "no native select and no native date input (R-UI-083)").toHaveCount(0);
    await expect(secondRightColumn(boq.main), "nothing on this screen is selectable, so no second right column (R-UI-080)").toHaveCount(0);

    /* --- the draft: one press, one keyed job, the issue filed where documents live (I-270) --- */
    await expect(boq.exportButton, "the one primary offers the draft").toBeVisible();
    await boq.exportButton.click();
    await expect(boq.jobs, "pressing the primary mounts the job strip while the render is watched").toBeVisible();
    await expect(boq.documentLink, "the render finishes and the draft is offered where it was filed").toHaveCount(1, { timeout: RENDER_BUDGET_MS });
    await settled(page);
    const draftId = (await heldAttribute(boq.documentLink, "data-document")) as string;
    expect(draftId, "the link names the document it leads to").toBeTruthy();
    await checkpoint(page, testInfo, "j-000/boq-draft");

    /* --- the XLSX: written now, answered as a signed link, opened with exceljs (A-BOQ-XLSX, R-TO-070) --- */
    await boq.exportXlsxButton.click();
    await expect(boq.exportLink, "the quantities are answered as a link to the bytes themselves (I-272)").toBeVisible({ timeout: RENDER_BUDGET_MS });
    expect(await heldAttribute(boq.exportLink, "data-kind"), "and the link says which kind it addresses").toBe("xlsx");
    const href = (await heldAttribute(boq.exportLink, "href")) as string;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await bytesOf(page, href));
    const names = workbook.worksheets.map((sheet) => sheet.name);
    expect(names, "the workbook carries its Summary").toContain(SUMMARY);
    expect(names, "and its Quantities sheet").toContain(QUANTITIES);
    const sections = names.filter((name) => /^[1-6] /u.test(name));
    expect(sections.length, `and one sheet per section that holds a line, named by its ordinal (I-273) — it carries ${names.join(", ")}`).toBeGreaterThan(0);
    for (const name of names) expect(name.toLowerCase(), `no sheet is named by the word AM-05 reserves (I-265): ${name}`).not.toContain("bill");

    const first = workbook.getWorksheet(sections[0] as string) as ExcelJS.Worksheet;
    const headers = (first.getRow(1).values as (string | undefined)[]).filter((value): value is string => typeof value === "string");
    expect(headers, "a section sheet's columns are A-BOQ-XLSX's seven, in its order").toEqual(["Item", "Code", "Description", "Unit", "Quantity", "Rate", "Amount"]);
    const amount = first.getRow(2).getCell(7);
    const formula = typeof amount.value === "object" && amount.value !== null && "formula" in amount.value ? String(amount.value.formula) : "";
    expect(formula, "every Amount is a LIVE formula over its own Rate — empty until somebody prices the line (I-274)").toMatch(/^IF\(F2="","",E2\*F2\)$/u);
    expect(first.getRow(2).getCell(6).value ?? null, "and the Rate is empty: the draft is unpriced (AM-05)").toBeNull();
    expect(first.views[0]?.state, "the header row stays put (A-BOQ-XLSX: frozen headers)").toBe("frozen");

    const quantities = rowsOf(workbook.getWorksheet(QUANTITIES) as ExcelJS.Worksheet);
    expect(quantities.length, "the Quantities sheet lists every published line with its bases, coverage, source sheet and formula").toBeGreaterThan(0);
    for (const line of quantities.slice(0, 5)) {
      expect(line["Formula"] ?? "", "each line carries the human-auditable formula it was computed by (L-QTY-03)").not.toBe("");
    }

    /* --- the takeoff against the golden: the published cells inside the band, the rest declared (L-QTY-06) --- */
    const matrix = bandMatrix(quantities);
    await attach(
      testInfo,
      "m3-takeoff-band",
      [
        `compared (${matrix.compared.length}):`,
        ...matrix.compared,
        `declared — golden cells the campaign published no COMPLETE line for (${matrix.declared.length}):`,
        ...matrix.declared,
        `unmapped product kinds (${matrix.unmapped.length}):`,
        ...matrix.unmapped,
        `product cells the golden holds no row for (${matrix.unknown.length}):`,
        ...matrix.unknown,
      ].join("\n"),
    );
    expect(matrix.compared.length, "the campaign published at least one cell the golden also holds — a band over nothing proves nothing").toBeGreaterThan(0);
    expect(matrix.unknown, "the product publishes no cell the golden has no row for — a figure over scope nobody drew would be an over-measurement (L-QTY-04)").toEqual([]);
    expect(matrix.failed, `every published cell stands inside L-QTY-06's band of the golden (3 % under, 0 % over); these do not:\n  ${matrix.failed.join("\n  ")}`).toEqual([]);

    /* --- the issued draft: filed in Documents, DRAFT — UNSIGNED on every page (AM-05 §2, R-SPINE-040) --- */
    await boq.documentLink.click();
    await page.waitForURL(/\/documents/);
    await settled(page);
    const row = documents.row(draftId);
    await expect(row, "Documents lists the issue the export filed").toBeVisible();
    expect(await heldAttribute(row, "data-kind"), "under the draft's own document kind").toBe(BOQ_DRAFT);
    const pdfHref = (await heldAttribute(documents.openLink(row), "href")) as string;
    const pages = pagesOf(await bytesOf(page, pdfHref));
    expect(pages.length, "the draft renders at least one page").toBeGreaterThan(0);
    for (const [at, text] of pages.entries()) {
      expect(text.replace(/\s+/gu, " "), `page ${at + 1} of the draft carries the banner (AM-05 §2)`).toContain(BANNER);
    }
    await checkpoint(page, testInfo, "j-000/documents-issued");
  });

  test.fixme("MISSING DOOR: J-000 m3-bill-and-schedules: the bar schedule is emitted as DRAFT — UNSIGNED and read against the golden", async ({ page }, testInfo) => {
    test.setTimeout(1_800_000);
    const run = await bnbcMeasured(page);
    const takeoff = new STakeoffPage(page);
    const bbs = new SBbsPage(page);
    const documents = new SDocumentsPage(page);

    await takeoff.open(run.tenantId, run.bnbc.projectId);
    await bbs.openThroughNav();
    await settled(page);
    expect(await bbs.state(), "the schedule is read and rendered, wholly or partly declared").toMatch(/^(ready|partial)$/);
    expect(Number(await bbs.rowsRendered()), "the grid publishes how many rows it painted").toBeGreaterThan(0);

    /* --- the schedule against the golden, per member (class, level, mark), NET and LAP together --- */
    const members = await everyRow(bbs.members, "the member group rows");
    const memberOf = new Map<string, { class: string; level: string; mark: string }>();
    for (const member of members) {
      const objectKey = (await heldAttribute(member, "data-member")) as string;
      memberOf.set(objectKey, {
        class: ((await heldAttribute(member, "data-class")) ?? "").toUpperCase(),
        level: (await heldAttribute(member, "data-level")) ?? "",
        mark: (await heldAttribute(member, "data-mark")) ?? "",
      });
    }
    const netKeys = await everyAttribute(bbs.rows, "data-bar-key", "the NET rows");
    const netKg = await everyAttribute(bbs.rows, "data-kg", "the NET rows' mass");
    const lapKeys = await everyAttribute(bbs.laps, "data-bar-key", "the LAP rows", { min: 0 });
    const lapKg = await everyAttribute(bbs.laps, "data-kg", "the LAP rows' mass", { min: 0 });
    const product = new Map<string, number>();
    const add = (barKey: string, kg: string): void => {
      const member = memberOf.get(barKey.split("|")[0] ?? "");
      if (member === undefined) return;
      const key = `${member.class}|${member.level}|${member.mark}`;
      product.set(key, (product.get(key) ?? 0) + Number(kg));
    };
    netKeys.forEach((key, at) => add(key, netKg[at] ?? "0"));
    lapKeys.forEach((key, at) => add(key, lapKg[at] ?? "0"));

    const golden = new Map<string, number>();
    for (const row of bbsGoldenDocument(FIXTURE).rows) {
      if (!BBS_CLASSES.includes(row.class)) continue;
      const key = `${row.class}|${row.level}|${row.mark}`;
      golden.set(key, (golden.get(key) ?? 0) + Number(row.kg));
    }
    const compared: string[] = [];
    const failed: string[] = [];
    const unknown: string[] = [];
    for (const [key, kg] of [...product.entries()].sort(([left], [right]) => (left < right ? -1 : 1))) {
      const expected = golden.get(key);
      if (expected === undefined) {
        unknown.push(`${key} = ${kg.toFixed(3)} kg (the golden holds no such member)`);
        continue;
      }
      const line = `${key}: product ${kg.toFixed(3)} kg · golden ${expected.toFixed(3)} kg · ${((kg / expected - 1) * 100).toFixed(2)} %`;
      compared.push(line);
      if (!insideBand(kg, expected)) failed.push(line);
    }
    const declared = [...golden.keys()].filter((key) => !product.has(key)).sort();
    await attach(testInfo, "m3-bbs-band", [`compared (${compared.length}):`, ...compared, `declared (${declared.length}):`, ...declared, `unknown (${unknown.length}):`, ...unknown].join("\n"));
    expect(compared.length, "the campaign scheduled at least one member the golden also schedules").toBeGreaterThan(0);
    expect(unknown, "the schedule holds no member the golden does not").toEqual([]);
    expect(failed, `every scheduled member's mass stands inside L-QTY-06's band of the golden; these do not:\n  ${failed.join("\n  ")}`).toEqual([]);

    /* --- the schedule emitted: one press, one keyed job, the issue filed (I-bbs-8) --- */
    await expect(bbs.exportButton, "the one primary offers the schedule").toBeVisible();
    await bbs.exportButton.click();
    await expect(bbs.jobs, "pressing the primary mounts the job strip while the render is watched").toBeVisible();
    await expect(bbs.documentLink, "the render finishes and the schedule is offered where it was filed").toHaveCount(1, { timeout: RENDER_BUDGET_MS });
    await settled(page);
    const scheduleId = (await heldAttribute(bbs.documentLink, "data-document")) as string;
    await checkpoint(page, testInfo, "j-000/bbs-schedule");

    await bbs.documentLink.click();
    await page.waitForURL(/\/documents/);
    await settled(page);
    const row = documents.row(scheduleId);
    await expect(row, "Documents lists the schedule the export filed").toBeVisible();
    expect(await heldAttribute(row, "data-kind"), "under the schedule's own document kind (A-BBS-PDF)").toBe(BBS);
    const pages = pagesOf(await bytesOf(page, (await heldAttribute(documents.openLink(row), "href")) as string));
    expect(pages.length, "the schedule renders at least one page").toBeGreaterThan(0);
    for (const [at, text] of pages.entries()) {
      expect(text.replace(/\s+/gu, " "), `page ${at + 1} of the schedule carries the banner (AM-05 §2)`).toContain(BANNER);
    }
    const whole = pages.join(" ").replace(/\s+/gu, " ");
    expect(whole, "the document calls itself what A-BBS-PDF calls it").toContain("Bar bending schedule");
    for (const mark of new Set([...memberOf.values()].map((member) => member.mark))) {
      expect(whole, `the schedule prints every member mark the screen schedules (${mark})`).toContain(mark);
    }
  });
});

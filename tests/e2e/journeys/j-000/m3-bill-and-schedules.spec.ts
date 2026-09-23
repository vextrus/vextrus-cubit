/**
 * J-000 SEGMENTS: generate BOQ PDF (draft); open the XLSX
 *
 * M3's document leg of the golden path, WALKED (AM-09 §3, AM-17): the M3 fixture F-RCC6-BNBC (AM-01)
 * stands measured by `golden-run.ts` (`bnbcMeasured` — uploaded into a second project of the golden
 * run's workspace, its scales affirmed, its stack confirmed and every storey height read off the
 * section's own marks, its typical ranges authored, its general notes transcribed, Measure pressed;
 * m3-levels-and-notes.spec.ts and m3-measure-and-register.spec.ts walk those by clicks). This leg
 * emits the unpriced BOQ as a DRAFT — UNSIGNED document (AM-05 §2) with the one primary S-BOQ offers,
 * finds it filed in Documents under its own kind with the banner on every page, writes the XLSX and
 * opens it with exceljs: its Summary, its section sheets named by ordinal, A-BOQ-XLSX's seven columns,
 * the live Amount formula over an empty Rate, the frozen header, and the Quantities sheet with every
 * published line's bases, coverage, source sheet and formula. The bar schedule — the other half of
 * AM-17's emission segment, which m3-bar-schedule.spec.ts claims — waits there on the column ties.
 *
 * WHAT IS COMPARED, AND AGAINST WHAT (L-QTY-06, L-QTY-07, AM-01). A numeric assertion names its
 * roster, and this one is DERIVED, never typed: the COMPARED cells are the (class, kind, level) cells
 * in which the Quantities sheet states COMPLETE lines, each of which must be a cell the golden
 * (`goldenRows("rcc6-bnbc")`) holds — a COMPLETE figure over a cell nobody measured would be an
 * over-measurement, so that list (`unknown`) is empty. The DECLARED cells are the golden's cells the
 * product published no COMPLETE line for; they are named in the leg's attachment, never figured. Two of
 * them are asserted BY NAME with no product line of any coverage in them: COLUMN × RCC_CONCRETE at FDN
 * and at ROOF — the golden measures the column stubs from the pile caps up to GF and the two columns
 * standing on the roof slab, members the column layout's placement does not register. A class the
 * product does not PLACE is disclosed on NO product surface — the residue sights only the classes the
 * campaign registered objects for — and a member no placement made registers nothing for the residue
 * to sight either, so the declared cells are said in this leg's attachment and nowhere a reader of the
 * product looks. That is a gap in the product's disclosure, recorded here, not a licence.
 *
 * THE GOLDEN BAND IS NOT TAKEN ON THE DOCUMENT. It is m3-measure-and-register.spec.ts's, read storey by
 * storey at the REGISTER's precision. The XLSX states each line rounded ONCE, half to even, to its
 * kind's document places (the emission's `atDocumentPrecision`, L-MEA-05, L-QTY-07), and the golden
 * rounds each CELL once — so a band on the document's sums would need `(n + 1)` half-units of slack,
 * which is a widened band, and the arbitrated band admits the golden's own typography and nothing else.
 * What a document owes is FIDELITY, and that is what is proved here, cell by compared cell, against the
 * register's own footer read with the same class, kind, coverage and level filters: the sheet states
 * exactly as many COMPLETE lines as the register keeps; no line is stated finer than the places the
 * Quantity column's own format states (the figures are the document's, not the store's); and the
 * stated lines sum to within `n × ½ × 10⁻ᵖ` of the register's exact total, p the places the cell's own
 * lines are stated to. A figure written as a NUMBER keeps no trailing zero, so p is the most places any
 * line of the cell states — the rounding bound itself when any line's last place is not zero, and only
 * ever looser than it, never tighter, so no lawful document is refused. A cell standing in the
 * lawful-null foundation slot is addressed as its group's remainder (the group's total over every
 * level less its storeys'), because the sheet states that slot as an empty level and the register as
 * the slot's name.
 *
 * THE ITEMS TIE TO THE REGISTER (the owner's bill-shape ruling, session 8; s-boq I-528). A
 * section sheet states one ITEM per description at one level band, and the Quantities sheet says
 * which item each member line is summed into. An item's figure is the register's exact sum of its
 * members rounded ONCE — so wherever an item is the only item over its register cells, its figure
 * must equal the register's own total for those cells, rounded once, to the last printed place: no
 * slack at all, where a sum of already-rounded lines needed n half-units (93.893 m³ of column
 * concrete, not the 93.904 the old page printed). An item's members are read off the Quantities
 * sheet by the item number they carry; the register's totals are the footer reads the fidelity walk
 * already makes, cell by cell.
 *
 * Nothing here measures time (AM-10 §3, AM-17: "the M3 leg opens the XLSX; it does not time it").
 */
import Decimal from "decimal.js";
import ExcelJS from "exceljs";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { pdfText } from "../../../docs/support/pdf-text";
import { PRODUCT_TO_GOLDEN_KIND, goldenKindOf, goldenRows } from "../../../golden/support/golden-fixture";
import { SBoqPage } from "../../pages/s-boq.page";
import { SDocumentsPage } from "../../pages/s-documents.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { checkpoint } from "../../support/checkpoint";
import { everyAttribute, heldAttribute } from "../../support/retrying-read";
import { settled } from "../../support/settled";
import { bnbcMeasured, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

/** The fixture the golden is read for (AM-01). */
const FIXTURE = "rcc6-bnbc";

/** The banner AM-05 §2 puts on every page of a working document before M7. */
const BANNER = "DRAFT — UNSIGNED";

/** The document kind the draft is filed under, as S-Documents keys it. */
const BOQ_DRAFT = "boq-draft";

/** The coverage a line must state to be compared at all (L-QTY-06 judges only under COMPLETE). */
const COMPLETE = "COMPLETE";

/** The golden's level for a class the product measures in the lawful-null foundation slot (L-CAD-07). */
const FOUNDATION_LEVEL: Readonly<Record<string, string>> = Object.freeze({ pile: "PILE" });
const FOUNDATION_DEFAULT = "FDN";

/**
 * The column concrete the golden holds on members the product does not place: the two columns on the
 * roof. TEST_AMENDED (session 7, LEV-1, I-338): the necks below GF are measured now — FDN is a level
 * the walk inserts and the resolver stands every GF vertical on — so the FDN cell is COMPARED, in band,
 * where it used to be declared by name.
 */
const COLUMN = "column";
const RCC_CONCRETE = "rcc.concrete";
const UNPLACED_COLUMN_LEVELS: readonly string[] = Object.freeze(["ROOF"]);
/** The column levels the product now measures that the golden also figures: the foundation neck (I-338). */
const NECK_COLUMN_LEVELS: readonly string[] = Object.freeze([FOUNDATION_DEFAULT]);

/** How long a render of the M3 campaign's documents may take to be filed. */
const RENDER_BUDGET_MS = 600_000;

/** The shape of an item number: three 1-based ordinals (AM-14 §2). */
const SGI = /^[1-9]\d*\.[1-9]\d*\.[1-9]\d*$/u;

/** The XLSX's fixed sheets (A-BOQ-XLSX, s-boq I-273), and the column a figure is stated in. */
const SUMMARY = "Summary";
const QUANTITIES = "Quantities";
const QUANTITY = "Quantity";

/** Exact decimals, at a precision no sum here reaches — a figure never touches a float (B-07). */
const Exact = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/** One cell of the golden, in the golden's own words. */
type Cell = { class: string; kind: string; level: string };

/** The Quantities sheet, read back by its own headers — never by a column index typed here. */
type QuantityRow = Record<string, string>;

/** One compared cell as the sheet states it: its product words, and its COMPLETE lines summed. */
type StatedCell = {
  readonly key: string;
  readonly product: { readonly class: string; readonly kind: string; readonly level: string };
  readonly lines: number;
  readonly sum: Decimal;
  readonly places: number;
};

const cellKey = (cell: Cell): string => `${cell.class}|${cell.kind}|${cell.level}`;

/** How many places a stated figure carries — `0.647` carries three, `12` none. */
function placesOf(figure: string): number {
  const dot = figure.indexOf(".");
  return dot < 0 ? 0 : figure.length - dot - 1;
}

/** The places a number format states: the zeros after the point in its base section — `##,##0.000` → 3. */
function placesStatedBy(numFmt: string): number {
  return /\.(0+)$/u.exec(numFmt.split(";").pop() ?? "")?.[1]?.length ?? 0;
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

/** A sheet's header row, in its own words. */
function headersOf(sheet: ExcelJS.Worksheet): string[] {
  return (sheet.getRow(1).values as (string | undefined)[]).map((value) => (value === undefined ? "" : String(value)));
}

/** A sheet's rows as objects keyed by the header row's own words. */
function rowsOf(sheet: ExcelJS.Worksheet): QuantityRow[] {
  const headers = headersOf(sheet);
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
 * The roster, derived from the sheet and the golden alone: the cells compared (the product's COMPLETE
 * cells the golden holds), the cells declared (the golden's cells with no COMPLETE product line), the
 * cells nobody should have measured (`unknown`), and every cell the product put ANY line in.
 */
function rosterOf(lines: readonly QuantityRow[]): { compared: StatedCell[]; declared: string[]; unknown: string[]; placed: Set<string> } {
  const golden = new Set(goldenRows(FIXTURE).map((row) => cellKey(row)));
  const complete = new Map<string, StatedCell>();
  const placed = new Set<string>();
  const unspelled = new Set<string>();
  for (const line of lines) {
    const klass = line["Class"] ?? "";
    const kind = line["Kind"] ?? "";
    const level = line["Level"] ?? "";
    const quantity = line[QUANTITY] ?? "";
    const stated = line["Coverage"] === COMPLETE && quantity !== "";
    const spelling = PRODUCT_TO_GOLDEN_KIND[kind];
    if (spelling === undefined) {
      if (stated) unspelled.add(`${klass}|${kind}|${level} (the golden spells no such kind)`);
      continue;
    }
    const key = cellKey({ class: klass.toUpperCase(), kind: spelling, level: goldenLevelOf(klass, level) });
    placed.add(key);
    if (!stated) continue;
    const held = complete.get(key) ?? { key, product: { class: klass, kind, level }, lines: 0, sum: new Exact(0), places: 0 };
    complete.set(key, { ...held, lines: held.lines + 1, sum: held.sum.plus(quantity), places: Math.max(held.places, placesOf(quantity)) });
  }
  const compared = [...complete.values()].filter((cell) => golden.has(cell.key)).sort((left, right) => (left.key < right.key ? -1 : 1));
  const unknown = [...unspelled, ...[...complete.keys()].filter((key) => !golden.has(key)).map((key) => `${key} (the golden holds no row for this cell)`)].sort();
  const declared = [...golden].filter((key) => !complete.has(key)).sort();
  return { compared, declared, unknown, placed };
}

/** A reading of the documents, attached to the run so the handoff can quote it. */
async function attach(testInfo: TestInfo, name: string, body: string): Promise<void> {
  await testInfo.attach(name, { body, contentType: "text/plain" });
}

/** The right-hand columns standing beside the work surface — the shell hosts one, and these screens mount none. */
function secondRightColumn(main: Locator): Locator {
  return main.locator('[data-rendered-region="inspector"], [role="complementary"]');
}

test.describe.serial("J-000 — Golden Path: M3's documents on F-RCC6-BNBC", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m3-bill-and-schedules: the unpriced BOQ is emitted as DRAFT — UNSIGNED, the XLSX is opened, and its figures are faithful to the register", async ({ page }, testInfo) => {
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
    // Each item's figure as the SCREEN states it — a decimal string at its kind's own places, the very
    // figure the PDF and the workbook print (I-271) — read once, for the tie below.
    const itemNumbers = await everyAttribute(boq.lines, "data-item", "the draft's item numbers");
    const itemFigures = await everyAttribute(boq.lines, "data-quantity", "the draft's item figures");
    const screenFigure = new Map(itemNumbers.map((item, at) => [item, itemFigures[at] ?? ""] as const).filter(([item, figure]) => item !== "" && figure !== ""));

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
    expect(headers, "a section sheet's columns are A-BOQ-XLSX's seven, in its order").toEqual(["Item", "Code", "Description", "Unit", QUANTITY, "Rate", "Amount"]);
    // The sheet opens on a trade row (I-529): no number, no figure, no Amount. The first priced row
    // is the first ITEM — the first body row whose Item cell is an S.G.I number.
    const formulaOf = (cell: ExcelJS.Cell): string => (typeof cell.value === "object" && cell.value !== null && "formula" in cell.value ? String(cell.value.formula) : "");
    let firstItemRow = 0;
    for (let at = 2; at <= first.rowCount && firstItemRow === 0; at += 1) {
      if (SGI.test(String(first.getRow(at).getCell(1).value ?? ""))) firstItemRow = at;
    }
    expect(firstItemRow, "the first section sheet prices at least one item, numbered S.G.I (I-528)").toBeGreaterThan(2);
    const heading = first.getRow(firstItemRow - 1);
    expect(heading.getCell(1).value ?? null, "the row above the first item names its trade and carries no number (I-529)").toBeNull();
    expect(heading.getCell(5).value ?? null, "and states no quantity across the descriptions under it (I-529)").toBeNull();
    expect(formulaOf(heading.getCell(7)), "and no Amount of its own (I-529)").toBe("");
    const itemRow = first.getRow(firstItemRow);
    expect(formulaOf(itemRow.getCell(7)), "every item's Amount is a LIVE formula over its own Rate — empty until somebody prices the item (I-274)").toBe(
      `IF(F${firstItemRow}="","",E${firstItemRow}*F${firstItemRow})`,
    );
    expect(itemRow.getCell(6).value ?? null, "and the Rate is empty: the draft is unpriced (AM-05)").toBeNull();
    expect(first.views[0]?.state, "the header row stays put (A-BOQ-XLSX: frozen headers)").toBe("frozen");

    const sheet = workbook.getWorksheet(QUANTITIES) as ExcelJS.Worksheet;
    const quantities = rowsOf(sheet);
    expect(quantities.length, "the Quantities sheet lists every published line with its bases, coverage, source sheet and formula").toBeGreaterThan(0);
    for (const line of quantities.slice(0, 5)) {
      expect(line["Formula"] ?? "", "each line carries the human-auditable formula it was computed by (L-QTY-03)").not.toBe("");
    }
    // The places the sheet says it writes a figure to, read off the format its Quantity column carries.
    const quantityColumn = headersOf(sheet).indexOf(QUANTITY);
    let numFmt = "";
    sheet.eachRow((row, number) => {
      const cell = row.getCell(quantityColumn);
      if (number > 1 && numFmt === "" && typeof cell.value === "number") numFmt = cell.numFmt ?? "";
    });
    expect(numFmt, "the Quantity column states the format — and so the places — its figures are written at (L-FMT-01)").not.toBe("");
    const documentPlaces = placesStatedBy(numFmt);

    /* --- the roster, derived: what is compared, what is declared, what nobody should have measured --- */
    const roster = rosterOf(quantities);
    await attach(
      testInfo,
      "m3-document-roster",
      [
        `compared — the product's COMPLETE cells the golden holds (${roster.compared.length}):`,
        ...roster.compared.map((cell) => `${cell.key}: ${cell.lines} line(s) · stated Σ ${cell.sum.toString()} at ≤ ${cell.places} place(s)`),
        `declared — golden cells the campaign published no COMPLETE line for (${roster.declared.length}), ${roster.declared.filter((key) => !roster.placed.has(key)).length} of them with no product line at all:`,
        ...roster.declared.map((key) => `${key}${roster.placed.has(key) ? " (a line stands, not COMPLETE)" : ""}`),
        `COMPLETE cells nobody measured (${roster.unknown.length}):`,
        ...roster.unknown,
      ].join("\n"),
    );
    expect(roster.compared.length, "the campaign published at least one COMPLETE cell the golden also holds — a comparison over nothing proves nothing").toBeGreaterThan(0);
    expect(roster.unknown, "the product states no COMPLETE figure over a cell the golden holds no row for — that would be an over-measurement, never a disclosure (L-QTY-04)").toEqual([]);
    for (const level of NECK_COLUMN_LEVELS) {
      const key = cellKey({ class: COLUMN.toUpperCase(), kind: goldenKindOf(RCC_CONCRETE), level });
      expect(
        roster.compared.map((cell) => cell.key),
        `${key} is compared: the neck is measured COMPLETE and the golden figures it (I-338)`,
      ).toContain(key);
    }
    for (const level of UNPLACED_COLUMN_LEVELS) {
      const key = cellKey({ class: COLUMN.toUpperCase(), kind: goldenKindOf(RCC_CONCRETE), level });
      expect(roster.declared, `${key} is a golden cell the campaign declares rather than figures`).toContain(key);
      expect(roster.placed.has(key), `${key}: the product states no line of any coverage here — the golden measures members the column layout does not place`).toBe(false);
    }

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

    /* --- the document faithful to the register: each line rounded ONCE, at the edge (L-MEA-05, L-QTY-07) --- */
    await takeoff.open(run.tenantId, run.bnbc.projectId);
    const groups = new Map<string, StatedCell[]>();
    for (const cell of roster.compared) {
      const group = `${cell.product.class}|${cell.product.kind}`;
      groups.set(group, [...(groups.get(group) ?? []), cell]);
    }
    const fidelity: string[] = [];
    const unfaithful: string[] = [];
    /** Each compared cell's register total, as the register's own footer states it. */
    const registerTotals = new Map<string, Decimal>();
    const judge = (cell: StatedCell, register: { shown: number; total: Decimal }): void => {
      registerTotals.set(cell.key, register.total);
      const slack = new Exact(cell.lines).times("0.5").times(new Exact(10).pow(-cell.places));
      const drift = cell.sum.minus(register.total).abs();
      const said = `${cell.key}: sheet ${cell.lines} line(s) Σ ${cell.sum.toString()} · register ${register.shown} line(s) Σ ${register.total.toString()} · |Δ| ${drift.toString()} ≤ ${slack.toString()}`;
      fidelity.push(said);
      if (register.shown !== cell.lines) unfaithful.push(`${said} — the sheet and the register keep a different number of COMPLETE lines`);
      if (cell.places > documentPlaces) unfaithful.push(`${said} — a line is stated to ${cell.places} places, finer than the ${documentPlaces} the column's format states (the store's figure, not the document's)`);
      if (drift.gt(slack)) unfaithful.push(`${said} — the stated lines are not the register's figures rounded once to their places`);
    };
    for (const [group, cells] of groups) {
      const [klass, kind] = group.split("|") as [string, string];
      await takeoff.narrow("class", klass);
      await takeoff.narrow("kind", kind);
      await takeoff.narrow("coverage", COMPLETE);
      await takeoff.narrow("level", "");
      const whole = await takeoff.kept(`${group} over every level`);
      let restLines = whole.shown;
      let restTotal = new Exact(whole.total ?? "0");
      for (const cell of cells.filter((stated) => stated.product.level !== "")) {
        await takeoff.narrow("level", cell.product.level);
        const kept = await takeoff.kept(`${cell.key}`);
        const total = new Exact(kept.total ?? "0");
        restLines -= kept.shown;
        restTotal = restTotal.minus(total);
        judge(cell, { shown: kept.shown, total });
      }
      // The foundation slot is the group's remainder; where the sheet states no slot cell, the
      // remainder is what the register keeps that the sheet does not state, and it must be nothing.
      const slot = cells.find((stated) => stated.product.level === "");
      if (slot !== undefined) judge(slot, { shown: restLines, total: restTotal });
      else if (restLines !== 0 || !restTotal.isZero()) unfaithful.push(`${group}: the register keeps ${restLines} COMPLETE line(s) (Σ ${restTotal.toString()}) the sheet states in no compared cell`);
    }
    await attach(testInfo, "m3-document-fidelity", [`the Quantity column states ${documentPlaces} place(s)`, ...fidelity].join("\n"));
    expect(fidelity.length, "every compared cell was read back on the register").toBe(roster.compared.length);
    expect(unfaithful, `the XLSX states each COMPLETE line as the register's figure rounded once, half to even, to its kind's places (L-MEA-05, L-QTY-07); these cells do not:\n  ${unfaithful.join("\n  ")}`).toEqual([]);

    /* --- the items: each the register's sum of its members, rounded ONCE (I-528) --- */
    // Which register cells each item's COMPLETE members stand in, read off the Quantities sheet by the
    // item number each member carries; and which items stand over each cell.
    const cellsOfItem = new Map<string, Set<string>>();
    const itemsOfCell = new Map<string, Set<string>>();
    for (const line of quantities) {
      const item = line["Item"] ?? "";
      const spelling = PRODUCT_TO_GOLDEN_KIND[line["Kind"] ?? ""];
      if (!SGI.test(item) || spelling === undefined || line["Coverage"] !== COMPLETE) continue;
      const key = cellKey({ class: (line["Class"] ?? "").toUpperCase(), kind: spelling, level: goldenLevelOf(line["Class"] ?? "", line["Level"] ?? "") });
      cellsOfItem.set(item, new Set([...(cellsOfItem.get(item) ?? []), key]));
      itemsOfCell.set(key, new Set([...(itemsOfCell.get(key) ?? []), item]));
    }
    const tied: string[] = [];
    const untied: string[] = [];
    for (const name of sections) {
      const sheet = workbook.getWorksheet(name) as ExcelJS.Worksheet;
      sheet.eachRow((row, number) => {
        if (number === 1) return;
        const item = String(row.getCell(1).value ?? "");
        const stated = row.getCell(5).value;
        if (!SGI.test(item) || typeof stated !== "number") return;
        const cells = [...(cellsOfItem.get(item) ?? [])];
        // An item is judged where it is the ONLY item over its cells and every one of them was read
        // back on the register; an item sharing a cell with another description is judged by its
        // members' fidelity above, never by a total it shares.
        if (cells.length === 0 || cells.some((key) => !registerTotals.has(key) || (itemsOfCell.get(key)?.size ?? 0) !== 1)) return;
        // The places are the kind's own, read off the figure the SCREEN states for the same item —
        // a leg reads what a customer sees, never the product's catalogue (AM-09 §2).
        const shown = screenFigure.get(item);
        if (shown === undefined) {
          untied.push(`${name} ${item}: the workbook states an item the screen does not`);
          return;
        }
        const places = placesOf(shown);
        const register = cells.reduce((sum, key) => sum.plus(registerTotals.get(key) as Decimal), new Exact(0));
        const once = register.toDecimalPlaces(places, Decimal.ROUND_HALF_EVEN).toFixed(places);
        const said = `${name} ${item}: states ${new Exact(stated).toFixed(places)} (screen ${shown}) · register Σ ${register.toString()} over ${cells.join(", ")} → rounded once ${once}`;
        if (shown === once && new Exact(stated).eq(new Exact(shown))) tied.push(said);
        else untied.push(said);
      });
    }
    await attach(testInfo, "m3-item-ties", [`items tied to the register (${tied.length}):`, ...tied, `items that do not tie (${untied.length}):`, ...untied].join("\n"));
    expect(tied.length, "at least one item stands alone over register cells the walk read back — a tie over nothing proves nothing").toBeGreaterThan(0);
    expect(untied, "each item states the register's own sum of its members rounded ONCE — never a sum of rounded lines (I-528)").toEqual([]);
  });
});

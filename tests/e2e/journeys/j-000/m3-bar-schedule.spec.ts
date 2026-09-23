/**
 * J-000 SEGMENTS: emit the unpriced BOQ and the BBS as DRAFT UNSIGNED
 *
 * MISSING DOOR: the column TIES are not derived yet — the ties slice (R6, D-003) derives them from BNBC 2020 / ACI 318-19 per the owner's session-7 ruling (the clauses vendored at docs/reference/bnbc-2020/), and until it lands every column's rebar line stands PARTIAL_DECLARED with its ties omitted, so no member's schedule is whole; the lap the drawing states (LAP 50d, I-308) rides with the same synthesis bump behind the FC contest (the pile-scoped f'c note, N1); and the leg compares WHOLE members — NET and LAP of every bar mark — against fixtures/rcc6-bnbc/bbs.golden.json.
 *
 * The bar schedule's half of AM-17's emission segment, split out of m3-bill-and-schedules.spec.ts in
 * session 7 so the BOQ's half could run: the draft BOQ is emitted, filed and read as DRAFT — UNSIGNED
 * there, under "generate BOQ PDF (draft)" and "open the XLSX", and this file claims the segment whose
 * other half — the BBS — is the one still owed. The walk starts from the same measured campaign
 * (`bnbcMeasured`, golden-run.ts) and clicks what a customer clicks: S-BBS opened through the lane's
 * navigation, the schedule read member by member, emitted with its one primary, filed in Documents,
 * and read back as a PDF carrying the banner on every page (AM-05 §2).
 *
 * WHAT IS COMPARED, AND HOW (L-QTY-06, AM-01). A numeric assertion names its roster: every member the
 * screen schedules — (class, level, mark), its NET and LAP rows summed — against the golden's bars for
 * the same member, over the classes the rebar rail reads (columns and shear walls). A bar row's key is
 * `barRowKeyOf`'s `<object key>|<role>|<diameter>|<sequence>` (src/modules/takeoff/rebar/bars.ts), and
 * an object key carries `|` of its own, so the member a bar belongs to is everything before the last
 * three fields — never the first field. The band is the tree's arbitrated one: `0.97 × G − a ≤ S ≤ G + a`,
 * a the golden's own printing allowance over the member's rows, and nothing else.
 *
 * Nothing here measures time (AM-10 §3).
 */
import Decimal from "decimal.js";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { pdfText } from "../../../docs/support/pdf-text";
import { bbsGoldenDocument, printingAllowanceOf } from "../../../golden/support/golden-fixture";
import { SBbsPage } from "../../pages/s-bbs.page";
import { SDocumentsPage } from "../../pages/s-documents.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { checkpoint } from "../../support/checkpoint";
import { everyAttribute, everyRow, heldAttribute } from "../../support/retrying-read";
import { settled } from "../../support/settled";
import { bnbcMeasured, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

/** The fixture the golden is read for (AM-01). */
const FIXTURE = "rcc6-bnbc";

/** The banner AM-05 §2 puts on every page of a working document before M7. */
const BANNER = "DRAFT — UNSIGNED";

/** The document kind the schedule is filed under, as S-Documents keys it (A-BBS-PDF). */
const BBS = "bbs";

/** L-QTY-06's floor: three per cent under the golden, and nothing over it. */
const UNDER_TOLERANCE = "0.97";

/** The classes the rebar rail reads today (R-TO-032's two readers), as the golden spells them. */
const BBS_CLASSES: readonly string[] = Object.freeze(["COLUMN", "SHEAR_WALL"]);

/** How many fields `barRowKeyOf` appends to the member's object key: role, diameter, sequence. */
const BAR_KEY_TAIL = 3;

/** How long a render of the M3 campaign's documents may take to be filed. */
const RENDER_BUDGET_MS = 600_000;

/** Exact decimals, at a precision no sum here reaches — a mass never touches a float (B-07). */
const Exact = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/** The member a bar row belongs to: its key without the three fields `barRowKeyOf` appends. */
function memberKeyOf(barKey: string): string {
  return barKey.split("|").slice(0, -BAR_KEY_TAIL).join("|");
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

/** A reading of the schedule, attached to the run so the handoff can quote it. */
async function attach(testInfo: TestInfo, name: string, body: string): Promise<void> {
  await testInfo.attach(name, { body, contentType: "text/plain" });
}

test.describe.serial("J-000 — Golden Path: M3's bar schedule on F-RCC6-BNBC", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test.fixme("MISSING DOOR: J-000 m3-bar-schedule: the bar schedule is emitted as DRAFT — UNSIGNED and read against the golden, member by member", async ({ page }, testInfo) => {
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
    const product = new Map<string, Decimal>();
    const orphans: string[] = [];
    const add = (barKey: string, kg: string): void => {
      const member = memberOf.get(memberKeyOf(barKey));
      if (member === undefined) {
        orphans.push(barKey);
        return;
      }
      const key = `${member.class}|${member.level}|${member.mark}`;
      product.set(key, (product.get(key) ?? new Exact(0)).plus(kg));
    };
    netKeys.forEach((key, at) => add(key, netKg[at] ?? "0"));
    lapKeys.forEach((key, at) => add(key, lapKg[at] ?? "0"));
    expect(orphans, "every bar row the grid paints belongs to a member group the grid paints").toEqual([]);

    const golden = new Map<string, { kg: Decimal; printed: { quantity: string }[] }>();
    for (const row of bbsGoldenDocument(FIXTURE).rows) {
      if (!BBS_CLASSES.includes(row.class)) continue;
      const key = `${row.class}|${row.level}|${row.mark}`;
      const held = golden.get(key) ?? { kg: new Exact(0), printed: [] };
      golden.set(key, { kg: held.kg.plus(row.kg), printed: [...held.printed, { quantity: row.kg }] });
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
      const allowance = new Exact(printingAllowanceOf(expected.printed));
      const line = `${key}: product ${kg.toString()} kg · golden ${expected.kg.toString()} ± ${allowance.toString()} kg · ${kg.div(expected.kg).minus(1).times(100).toFixed(2)} %`;
      compared.push(line);
      if (kg.gt(expected.kg.plus(allowance)) || kg.lt(expected.kg.times(UNDER_TOLERANCE).minus(allowance))) failed.push(line);
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

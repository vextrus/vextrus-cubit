/**
 * J-000 SEGMENTS: emit the unpriced BOQ and the BBS as DRAFT UNSIGNED
 *
 * The bar schedule's half of AM-17's emission segment, split out of m3-bill-and-schedules.spec.ts in
 * session 7 so the BOQ's half could run: the draft BOQ is emitted, filed and read as DRAFT — UNSIGNED
 * there, under "generate BOQ PDF (draft)" and "open the XLSX", and this file walks the other half. It
 * waited on the column ties until R6b derived them under D-003 (the owner's A′: ties at the joint's
 * never-over bound where placed framing bounds the joint, left out by name where nothing does) and
 * OPEN-4 put `rcc.rebar.synthesis@2` in force; released by R6-LEG (session 9). The walk starts from the
 * same measured campaign (`bnbcMeasured`, golden-run.ts) and clicks what a customer clicks: S-BBS
 * opened through the lane's navigation, the WHOLE schedule read past the grid's virtualised window,
 * emitted with its one primary, filed in Documents, and read back as a PDF carrying the banner on
 * every page (AM-05 §2).
 *
 * WHAT IS COMPARED, AND HOW (L-QTY-06, AM-01; the owner's ruling Q2: "the leg compares whole members
 * with the over arm per component"). A numeric assertion names its roster. A CELL is (class, level,
 * mark) over the classes the rebar rail reads (columns and shear walls): every entry the screen states
 * for it summed, against the golden's members of the same cell. Each cell is split into COMPONENTS —
 * a NET row counts under its role (MAIN, TIE, …) and a LAP row under LAP — and the golden likewise
 * (`kg_net` by role, `kg_lap` where the bar laps), each with its own printing allowance a.
 *   - THE OVER ARM, per component, everywhere: S_c ≤ G_c + a_c. Over-measurement is a hard block and
 *     never a disclosure, so no component may stand over, whole cell or not; nothing is netted — a
 *     tie row over the golden is not excused by a main bar under it.
 *   - THE FLOOR, whole members only: 0.97 × G − a ≤ S for a cell whose every entry publishes
 *     `data-coverage="COMPLETE"` (s-bbs I-655) — a partly declared cell is short by what it says
 *     it left out, and grading it against the whole would grade the declaration.
 *   - An under per component is attached as a failing observation, never trimmed and never netted.
 *   - THE DECLARED ROSTER is asserted by name with its codes: every cell that is not whole, and the
 *     codes its entries' lines left something out under, equal `DECLARED` below (I-659's roster).
 * A bar row's key is `barRowKeyOf`'s `<object key>|<role>|<diameter>|<sequence>`
 * (src/modules/takeoff/rebar/bars.ts), and an object key carries `|` of its own, so the entry a bar
 * belongs to is everything before the last three fields — never the first field — and it must be the
 * group row the grid paints above it.
 *
 * Nothing here measures time (AM-10 §3).
 */
import Decimal from "decimal.js";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { pdfText } from "../../../docs/support/pdf-text";
import { bbsGoldenDocument, printingAllowanceOf } from "../../../golden/support/golden-fixture";
import { SBbsPage, type BbsPaintedRow } from "../../pages/s-bbs.page";
import { SDocumentsPage } from "../../pages/s-documents.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { checkpoint } from "../../support/checkpoint";
import { heldAttribute } from "../../support/retrying-read";
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

/** The component a lap row counts under, beside the NET rows' roles (AM-03(a)). */
const LAP = "LAP";

/** The coverage of an entry whose every member's line is whole (L-QTY-02, s-bbs I-655). */
const COMPLETE = "COMPLETE";

/** How long a render of the M3 campaign's documents may take to be filed. */
const RENDER_BUDGET_MS = 600_000;

/**
 * THE DECLARED ROSTER (I-659, the owner's A′): every cell that does not stand whole on F-RCC6-BNBC
 * under `rcc.rebar.synthesis@2`, and the codes its lines leave something out under. The rest — C1–C4 at
 * GF and C1–C5 at 1F–6F, the 34 cells whose top joint the placed framing bounds — stand COMPLETE.
 *   - REBAR_TIE_JOINT_UNREAD: nothing read bounds the joint at the column's top — the foundation necks,
 *     C6 at every storey and the roof stub;
 *   - BAR_SHAPE_NOT_HELD: C7's hoops (a round column, I-596) until CH joins the roster;
 *   - REBAR_TIE_ZONE_UNSTATED: a shear wall's confinement is a wall's, and @2 derives a column's only.
 */
const DECLARED: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ...Object.fromEntries(["C1", "C2", "C3", "C4", "C6"].map((mark) => [`COLUMN|FDN|${mark}`, ["REBAR_TIE_JOINT_UNREAD"]])),
  "COLUMN|FDN|C7": ["BAR_SHAPE_NOT_HELD"],
  "COLUMN|GF|C7": ["BAR_SHAPE_NOT_HELD"],
  ...Object.fromEntries(["GF", "1F", "2F", "3F", "4F", "5F", "6F"].map((level) => [`COLUMN|${level}|C6`, ["REBAR_TIE_JOINT_UNREAD"]])),
  "COLUMN|ROOF|C4": ["REBAR_TIE_JOINT_UNREAD"],
  ...Object.fromEntries(["FDN", "GF", "1F", "2F", "3F", "4F", "5F", "6F", "ROOF"].map((level) => [`SHEAR_WALL|${level}|SW1`, ["REBAR_TIE_ZONE_UNSTATED"]])),
});

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

/** One side of a cell: its mass per component, and the figures each component was printed as. */
type Side = { readonly kg: Map<string, Decimal>; readonly printed: Map<string, { quantity: string }[]> };

/** An empty side. */
function side(): Side {
  return { kg: new Map(), printed: new Map() };
}

/** A mass added to one component of a side, its printed figure kept for the allowance. */
function add(held: Side, component: string, kg: string): void {
  held.kg.set(component, (held.kg.get(component) ?? new Exact(0)).plus(kg));
  held.printed.set(component, [...(held.printed.get(component) ?? []), { quantity: kg }]);
}

/** A side's whole mass: its components summed — the whole member, which only the floor reads. */
function wholeOf(held: Side): Decimal {
  return [...held.kg.values()].reduce((sum, kg) => sum.plus(kg), new Exact(0));
}

/** A painted row's attribute, or the empty string. */
function attr(row: BbsPaintedRow, name: string): string {
  return row.data[name] ?? "";
}

test.describe.serial("J-000 — Golden Path: M3's bar schedule on F-RCC6-BNBC", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m3-bar-schedule: the bar schedule is emitted as DRAFT — UNSIGNED and read against the golden, member by member", async ({ page }, testInfo) => {
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

    /* --- the WHOLE schedule, read past the grid's window: each bar under the entry painted above it --- */
    const grid = await bbs.wholeGrid();
    const entryOf = new Map<string, { cell: string; coverage: string; omitted: string[] }>();
    for (const member of grid.members) {
      const cell = `${attr(member, "data-class").toUpperCase()}|${attr(member, "data-level")}|${attr(member, "data-mark")}`;
      const omitted = attr(member, "data-omitted");
      entryOf.set(attr(member, "data-member"), { cell, coverage: attr(member, "data-coverage"), omitted: omitted === "" ? [] : omitted.split(" ") });
    }
    const heads = [...grid.members].sort((left, right) => left.index - right.index);
    /** The entry a bar or lap stands under: the nearest group row painted above it. */
    const entryAbove = (row: BbsPaintedRow): string => [...heads].reverse().find((head) => head.index < row.index)?.data["data-member"] ?? "";

    const product = new Map<string, Side>();
    const orphans: string[] = [];
    const count = (row: BbsPaintedRow, component: string): void => {
      const barKey = attr(row, "data-bar-key");
      const entry = entryOf.get(memberKeyOf(barKey));
      if (entry === undefined || entryAbove(row) !== memberKeyOf(barKey)) {
        orphans.push(barKey);
        return;
      }
      const held = product.get(entry.cell) ?? side();
      product.set(entry.cell, held);
      add(held, component, attr(row, "data-kg"));
    };
    for (const row of grid.rows) count(row, attr(row, "data-role"));
    for (const row of grid.laps) count(row, LAP);
    expect(orphans, "every bar row the grid paints stands under the entry its key names").toEqual([]);

    /* --- each cell's standing: whole only where every entry of it publishes COMPLETE --- */
    const standing = new Map<string, { whole: boolean; codes: Set<string> }>();
    for (const entry of entryOf.values()) {
      const held = standing.get(entry.cell) ?? { whole: true, codes: new Set<string>() };
      standing.set(entry.cell, { whole: held.whole && entry.coverage === COMPLETE, codes: new Set([...held.codes, ...entry.omitted]) });
    }

    const golden = new Map<string, Side>();
    for (const row of bbsGoldenDocument(FIXTURE).rows) {
      if (!BBS_CLASSES.includes(row.class)) continue;
      const key = `${row.class}|${row.level}|${row.mark}`;
      const held = golden.get(key) ?? side();
      golden.set(key, held);
      add(held, row.role, row.kg_net);
      if (row.laps_per_bar > 0) add(held, LAP, row.kg_lap);
    }

    const compared: string[] = [];
    const over: string[] = [];
    const short: string[] = [];
    const under: string[] = [];
    const unknown: string[] = [];
    const declared: Record<string, string[]> = {};
    for (const [key, measured] of [...product.entries()].sort(([left], [right]) => (left < right ? -1 : 1))) {
      const expected = golden.get(key);
      if (expected === undefined) {
        unknown.push(`${key} = ${wholeOf(measured).toFixed(3)} kg (the golden holds no such member)`);
        continue;
      }
      const cellStanding = standing.get(key) ?? { whole: false, codes: new Set<string>() };
      if (!cellStanding.whole) declared[key] = [...cellStanding.codes].sort();
      const components = [...new Set([...measured.kg.keys(), ...expected.kg.keys()])].sort();
      const said: string[] = [];
      for (const component of components) {
        const s = measured.kg.get(component) ?? new Exact(0);
        const g = expected.kg.get(component) ?? new Exact(0);
        const a = new Exact(printingAllowanceOf(expected.printed.get(component) ?? []));
        said.push(`${component} ${s.toString()} / ${g.toString()} ± ${a.toString()}`);
        const line = `${key} ${component}: product ${s.toString()} kg · golden ${g.toString()} ± ${a.toString()} kg`;
        if (s.gt(g.plus(a))) over.push(line);
        else if (s.lt(g.times(UNDER_TOLERANCE).minus(a))) under.push(line);
      }
      const S = wholeOf(measured);
      const G = wholeOf(expected);
      const A = new Exact(printingAllowanceOf([...expected.printed.values()].flat()));
      const percent = G.isZero() ? "—" : `${S.div(G).minus(1).times(100).toFixed(2)} %`;
      const whole = `${key} [${cellStanding.whole ? COMPLETE : `declared ${[...cellStanding.codes].sort().join(" ")}`}]: product ${S.toString()} kg · golden ${G.toString()} ± ${A.toString()} kg · ${percent} · ${said.join(" · ")}`;
      compared.push(whole);
      if (cellStanding.whole && S.lt(G.times(UNDER_TOLERANCE).minus(A))) short.push(whole);
    }
    const absent = [...golden.keys()].filter((key) => !product.has(key)).sort();
    await attach(
      testInfo,
      "m3-bbs-band",
      [
        `read: ${grid.members.length} entries, ${grid.rows.length} bar rows, ${grid.laps.length} lap rows`,
        `compared (${compared.length}):`,
        ...compared,
        `over, per component (${over.length}):`,
        ...over,
        `short, whole members (${short.length}):`,
        ...short,
        `under, per component — failing observations, never netted (${under.length}):`,
        ...under,
        `declared (${Object.keys(declared).length}):`,
        ...Object.entries(declared).map(([key, codes]) => `${key}: ${codes.join(" ")}`),
        `absent from the schedule (${absent.length}):`,
        ...absent,
        `unknown (${unknown.length}):`,
        ...unknown,
      ].join("\n"),
    );
    expect(compared.length, "the campaign scheduled at least one member the golden also schedules").toBeGreaterThan(0);
    expect(unknown, "the schedule holds no member the golden does not").toEqual([]);
    expect(absent, "every member the golden schedules for these classes stands on the schedule, whole or declared").toEqual([]);
    expect(over, `no component of any cell stands over the golden — over-measurement is a hard block, never a disclosure (L-QTY-06):\n  ${over.join("\n  ")}`).toEqual([]);
    expect(short, `every whole cell stands inside L-QTY-06's floor of the golden; these do not:\n  ${short.join("\n  ")}`).toEqual([]);
    expect(declared, "the cells that are not whole, and the codes they are declared under, are exactly A′'s roster (I-659)").toEqual(
      Object.fromEntries(Object.entries(DECLARED).map(([key, codes]) => [key, [...codes].sort()])),
    );

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
    for (const mark of new Set(grid.members.map((member) => attr(member, "data-mark")))) {
      expect(whole, `the schedule prints every member mark the screen schedules (${mark})`).toContain(mark);
    }
  });
});

/**
 * AC-1 — the `bbs` document kind, rendered in the V-DOCS lane (`pnpm test:docs`): one file and one
 * barrel line, a payload the schema cannot take refused before the subprocess, and the document
 * itself byte-frozen against its committed golden with DRAFT — UNSIGNED on every page
 * (A-BBS-PDF, R-TO-054, SEAM-DOC, V-DOCS, AM-18, AM-03(c)(e), AM-05, L-FRM-05).
 *
 * I-534, I-535, I-536 (session 8; the owner's ruling Q3, walk-0's BLOCKS_DEMO B17) — the schedule
 * states each mark ONCE per floor with its number of members, as BS 8666 writes it; it is a document a
 * site signs: its entries are headed in words (`C2 · Column · 1F`, `8 members`), never a register key
 * or an enum word; its particulars say whose it is, what drawings it was read from and when; its
 * columns are as wide as what they hold, so no figure is printed over its neighbour; and what the
 * measurement left out is said.
 *
 * What is judged is the ARTEFACT. The lane commits a payload, puts it through the pinned renderer,
 * and reads the bytes and the extracted text back — so what this file grades is the document the
 * product produced, never the template that produced it. Two clauses are white-box and say so: that
 * every shape of the roster has a DRAWN branch (a payload cannot exercise a shape its rows do not
 * carry), and that the schedule's columns are sized by what they hold (the extracted text carries no
 * glyph positions to measure an overprint by).
 *
 * THE PAYLOAD IS THE PRODUCT'S OWN EMISSION OF THE GOLDEN ROSTER, NEVER A LIST TYPED HERE. The
 * committed payload must equal what the product's own door and export (`bbsDocumentOf`,
 * `bbsPayloadOf`) make of the golden's columns and shear walls at FDN, GF and 1F — so a payload
 * somebody re-typed, re-rounded, re-ordered or re-counted fails here rather than being frozen into a
 * golden PDF (AM-01, B-19). Nothing here measures time (AM-10 §3) — the lane's own restraint is
 * asserted over every file of tests/docs by `tests/docs/boq-draft-render.test.ts`, and this file is
 * one of them.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { paintCountOf } from "./support/pdf-paint";
import { pdfText } from "./support/pdf-text";
import { inTree, squashed } from "./support/product";
import { bbsDocumentRows, bbsGoldenPayload, BBS_FIXTURE } from "./support/bbs-golden";
import { bbsModule, bs8666Module, documentsIndex, figuresModule, kindsLawModule, kindsModule, type DocumentKind } from "./support/seam";
import { filesUnder, withoutComments } from "./support/tree-source";

const PAYLOAD = "tests/docs/bbs/payload.json";
const GOLDEN = "tests/docs/bbs/golden.pdf";
const TEMPLATE = "src/core/documents/kinds/bbs.typ";
const PROOF_GOLDEN = "tests/docs/proof/golden.pdf";
const PROOF_PAYLOAD = "tests/docs/proof/payload.json";
const DRAFT_GOLDEN = "tests/docs/boq-draft/golden.pdf";
const DRAFT_PAYLOAD = "tests/docs/boq-draft/payload.json";

/**
 * The Typst primitives a sketch is drawn with. A branch of the shape dispatch that reaches none of
 * them draws nothing, whatever it prints (A-BBS-PDF: the codes are DRAWN, never imaged and never
 * merely lettered).
 */
const DRAWING_PRIMITIVES = ["line(", "curve(", "path(", "polygon(", "circle(", "arc(", "rect(", "bezier("];

/** The banner AM-05 puts on every page of a working document before M7. */
const BANNER = "DRAFT — UNSIGNED";

const ctx = { requestId: "ac-1-request", actor: "acceptance" };

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** One bar of an entry of the committed payload, by the field names the kind's schema gives it. */
type PayloadBar = {
  barMark: string;
  role: string;
  shape: string;
  cuttingRawMm: string;
  cuttingRoundedMm: string;
  cuttingIsAdditiveMm: string;
  barsPerUnit: number;
  bars: string;
  kgNet: string;
  kgLap: string;
  kg: string;
  lapMm: string;
  lapsPerBar: number;
};

/** One entry: a mark on a floor, how many members of it, and the bars each takes (I-534). */
type PayloadEntry = { level: string | null; class: string; mark: string; members: number; notForCutting: boolean; bars: PayloadBar[] };

/** The committed payload, as much of its shape as the criteria name. */
type Payload = {
  title: string;
  project: string;
  particulars: { client: string | null; site: string | null; drawingSet: string; revision: number };
  schedule: PayloadEntry[];
  cuttingStock: Record<string, { stockBars: number; pieces: number; offcutM: string }>;
  stockWithheld: number[];
  perDiameterKg: Record<string, string>;
  grandTotalKg: string;
  totalCovers: string;
  declared: { reason: string; kg: string; bars: (Pick<PayloadBar, "barMark" | "shape" | "bars"> & { cuttingRawMm: string; kg: string })[] } | null;
  partial: boolean;
  leftOut: { components: string[]; reason: string }[];
  notInSchedule: { about: string; levels: string; why: string }[];
};

/** A committed fixture of this lane, read as JSON. */
function fixtureJson<T>(relative: string): T {
  const absolute = inTree(relative);
  expect(existsSync(absolute), `${relative} is not in the tree yet — the bar schedule's document kind does not provide its committed payload`).toBe(true);
  expect(relative.startsWith("tests/"), "a fixture of this lane is read here, and nothing else ever is").toBe(true);
  // white-box: AC-1 — this reads a COMMITTED FIXTURE of the document lane (tests/docs/**), never a
  // file under src/, scripts/ or db/: it is the INPUT the renderer is driven with, so what the lane
  // grades is the document the product produced from it.
  return JSON.parse(readFileSync(absolute, "utf8")) as T;
}

/** The bytes of a committed golden. */
function goldenBytes(relative: string): Uint8Array {
  const absolute = inTree(relative);
  expect(existsSync(absolute), `${relative} is not in the tree yet — the lane has no yardstick to hold the render to`).toBe(true);
  expect(relative.startsWith("tests/"), "a golden of this lane is read here, and nothing else ever is").toBe(true);
  // white-box: AC-1 — the bytes of a COMMITTED GOLDEN under tests/docs/**, never product source.
  // "the render is byte-identical to its golden" is a claim about BYTES, and the golden is the only
  // thing a render can be held to.
  return new Uint8Array(readFileSync(absolute));
}

/** The pages of a rendered document, in the order they were set (a draft prints on every one). */
function pages(pdf: Uint8Array): string[] {
  return pdfText(pdf)
    .split("\n")
    .filter((page) => page.trim() !== "");
}

/** Text with every space taken out: what a page says, whatever gaps the extraction read between runs. */
const compact = (text: string): string => text.replace(/\s+/gu, "");

/** A key as a page says it — the one sentence-case rule, stated here as the criterion reads it. */
const said = (key: string): string => {
  const words = key.replace(/_/gu, " ").toLowerCase();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

/** The heading an entry is owed: its mark, its class and its floor, in words (I-535). */
const headingOf = (entry: PayloadEntry): string => [entry.mark, said(entry.class), ...(entry.level === null ? [] : [entry.level])].join(" · ");

/**
 * A length as the page writes it (s-bbs I-568): never rounded, its fraction carried only as
 * far as it holds a digit — `3352.800` as `3,352.8`, `1990.000` as `1,990` — through the one seam.
 */
function unroundedForm(figure: (value: string, precision: number) => string, value: string): string {
  const [whole = "", fraction = ""] = value.split(".");
  const carried = fraction.replace(/0+$/u, "");
  return carried === "" ? figure(whole, 0) : figure(`${whole}.${carried}`, carried.length);
}

/** The committed payload, read once and shared by the cases that drive the renderer with it. */
const payload = (): Payload => fixtureJson<Payload>(PAYLOAD);

/** Every bar of the committed schedule, entry by entry, in the order the page prints them. */
const barsOf = (input: Payload): PayloadBar[] => input.schedule.flatMap((entry) => entry.bars);

/** The renders, made at most once per process: a Typst compile is the lane's most expensive answer. */
let rendering: Promise<{ first: { pdf: Uint8Array; sha256: string }; second: { pdf: Uint8Array; sha256: string } }> | undefined;
const rendered = (): Promise<{ first: { pdf: Uint8Array; sha256: string }; second: { pdf: Uint8Array; sha256: string } }> =>
  (rendering ??= (async () => {
    const { renderDocument } = await documentsIndex();
    const input = payload();
    const first = await renderDocument("bbs", input, ctx);
    const second = await renderDocument("bbs", input, ctx);
    return { first, second };
  })());

/**
 * The forms `figure()` will print this stored value in, at every precision it takes. A criterion that
 * names the precision (the three cutting lengths) asks for one of them by number; a criterion that
 * does not (the offcut) asks that the document printed the value AS A FIGURE, whichever precision
 * the kind states — never a raw string and never a re-rounding.
 */
function printedForms(figure: (value: string, precision: number) => string, value: string): string[] {
  const forms: string[] = [];
  for (const precision of [0, 1, 2, 3, 4]) {
    try {
      forms.push(squashed(figure(value, precision)));
    } catch {
      // A precision this value is not stated at is not a form the seam would print it in.
    }
  }
  return forms;
}

describe("AC-1: the bar bending schedule renders as its own kind, byte for byte", () => {
  it("AC-1: the kinds barrel enumerates bbs beside proof and boq-draft, each behind its own file", async () => {
    const { DOCUMENT_KINDS } = await kindsModule();
    const { BBS_KIND, BBS_TITLE } = await bbsModule();
    const { kindTemplate } = await kindsLawModule();

    const keys = Object.keys(DOCUMENT_KINDS);
    for (const shipped of ["proof", "boq-draft", "bbs"]) {
      expect(keys, `the barrel carries the \`${shipped}\` kind — one file, one barrel line, enumerated and never re-declared (AM-11)`).toContain(shipped);
    }

    // The roster is DERIVED, never frozen: every kind module under kinds/ is in the barrel exactly
    // once and the barrel names no kind that no module declares, so a later increment's own kind
    // grows this expectation with it rather than reddening it (B-19).
    // white-box: AC-1 — the barrel's rule is "enumerates the FILES beside it"; the directory is
    // listed and each module is then IMPORTED and asked what kind it declares. No source is read.
    const declared = filesUnder("src/core/documents/kinds", [".ts"]).filter((file) => !/\/(index|law)\.ts$/u.test(file) && !file.includes("__tests__") && !file.endsWith(".test.ts"));
    const modules = await Promise.all(declared.map(async (file) => (await import(inTree(file))) as Record<string, unknown>));
    const kindsOfFiles = modules
      .flatMap((module_) => Object.values(module_))
      .filter((value): value is DocumentKind => typeof value === "object" && value !== null && typeof (value as DocumentKind).kind === "string" && "payloadSchema" in value)
      .map((kind) => kind.kind);
    expect([...kindsOfFiles].sort(), "the barrel's keys are exactly the kinds its own files declare").toEqual([...keys].sort());

    expect(BBS_KIND.kind, "the bar schedule's kind states its own key, and the barrel files it under that key").toBe("bbs");
    expect(DOCUMENT_KINDS["bbs"], "the barrel holds the kind its file declares, never a copy of it").toBe(BBS_KIND as unknown as DocumentKind);
    expect(typeof BBS_KIND.payloadSchema?.safeParse, "the bar schedule's payload is parsed by one Zod schema (L-FMT-03)").toBe("function");
    expect(BBS_KIND.template, "the template stands BESIDE the kind (kindTemplate), never under documents/templates (this increment's reading 2)").toBe(kindTemplate("bbs.typ"));
    expect(BBS_TITLE, "the kind names itself as a reader asks for it").toBe("Bar bending schedule");
  });

  it("AC-1: a payload the schema does not take is refused before the subprocess, and the compile is never called", async () => {
    const { renderDocument } = await documentsIndex();
    let calls = 0;
    const compile = async (): Promise<Uint8Array> => {
      calls += 1;
      return new Uint8Array();
    };

    const failure = await renderDocument("bbs", { title: 1 }, ctx, { compile }).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(failure, "a payload the `bbs` schema cannot read is REFUSED, never rendered").not.toBeNull();
    expect(refusalCodeOf(failure), "and refused under the seam's own registered code — this increment registers none of its own (SEAM-DOC)").toBe(
      REFUSALS.DOCUMENT_PAYLOAD_MALFORMED.code,
    );
    expect(calls, "the subprocess is never reached: the payload is read before a directory is staged").toBe(0);

    // A payload that still carries the ids the page used to print is refused too: the schema is
    // strict, so a campaign id or a register key cannot ride in beside the words (R-UI-082, I-535).
    const withIds = { ...payload(), campaignId: "rcc6-bnbc-campaign" };
    const stale = await renderDocument("bbs", withIds, ctx, { compile }).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(refusalCodeOf(stale), "a payload carrying a campaign id is a malformed payload, not a document").toBe(REFUSALS.DOCUMENT_PAYLOAD_MALFORMED.code);
    expect(calls, "and it too never reaches the renderer").toBe(0);
  });

  it("AC-1: the committed payload renders to the same bytes twice and to the committed golden", async () => {
    const { first, second } = await rendered();
    expect(second.sha256, "one payload through the pinned renderer is one document, however many times it is asked for (L-FMT-03)").toBe(first.sha256);
    expect(first.sha256, "the render states the digest of the bytes it made").toBe(sha256(first.pdf));
    expect(first.sha256, `the render matches ${GOLDEN} — a difference is either a renderer that moved or a document that changed, and both are facts this lane exists to state`).toBe(
      sha256(goldenBytes(GOLDEN)),
    );
  });

  it("AC-1: DRAFT — UNSIGNED stands on every page, beside the title the kind states", async () => {
    const { BBS_TITLE } = await bbsModule();
    const { first } = await rendered();

    const sheets = pages(first.pdf);
    expect(sheets.length, "the rendered schedule has pages").toBeGreaterThan(0);
    const banners = sheets.filter((page) => squashed(page).includes(BANNER)).length;
    expect(banners, `the banner stands at least once per page — ${sheets.length} page(s), and it was found on ${banners} (AM-05)`).toBeGreaterThanOrEqual(sheets.length);
    expect(squashed(sheets.join(" ")), "and the document says what it is").toContain(BBS_TITLE);
    const footers = sheets.filter((page) => compact(page).includes(compact(`${payload().project} · ${BBS_TITLE}`))).length;
    expect(footers, "every page says whose schedule it is part of, so a page separated from the rest still says so (I-535)").toBe(sheets.length);
  });

  it("I-534 · I-535: every entry is headed in words with its number of members, and every bar prints its mark, shape, three lengths, the number in each and the total", async () => {
    const { figure } = await figuresModule();
    const { first } = await rendered();
    const whole = compact(pages(first.pdf).join(" "));
    const input = payload();

    expect(input.schedule.length, `${PAYLOAD} carries entries to print`).toBeGreaterThan(0);
    const wrong: string[] = [];
    let cursor = 0;
    for (const entry of input.schedule) {
      const heading = compact(headingOf(entry));
      const at = whole.indexOf(heading, cursor);
      if (at === -1) {
        wrong.push(`${headingOf(entry)} is not headed in words where the payload puts it`);
        continue;
      }
      const count = compact(entry.members === 1 ? "1 member" : `${figure(String(entry.members), 0)} members`);
      if (!whole.slice(at, at + heading.length + 40).includes(count)) wrong.push(`${headingOf(entry)} does not say its ${entry.members} member(s) beside its heading`);
      cursor = at + heading.length;
      for (const bar of entry.bars) {
        const mark = whole.indexOf(compact(bar.barMark), cursor);
        if (mark === -1) {
          wrong.push(`${headingOf(entry)}: ${bar.barMark} does not stand beneath its heading`);
          continue;
        }
        cursor = mark;
        const line = whole.slice(mark, mark + 400);
        for (const [what, value] of [
          ["shape", bar.shape],
          // TEST_AMENDED (session 9, BBS-HONEST, I-568): the raw and IS 2502 lengths are
          // written unrounded without padded zeros (`3,352.8`), as the screen writes them.
          ["raw cutting length", unroundedForm(figure, bar.cuttingRawMm)],
          ["rounded length", figure(bar.cuttingRoundedMm, 0)],
          ["IS 2502 length", unroundedForm(figure, bar.cuttingIsAdditiveMm)],
          ["number in each", figure(String(bar.barsPerUnit), 0)],
          ["total", figure(bar.bars, 0)],
          ["net mass", figure(bar.kgNet, 3)],
        ] as const) {
          if (!line.includes(compact(value))) wrong.push(`${headingOf(entry)} ${bar.barMark}: its ${what} (${value}) is not on its line`);
        }
      }
    }
    expect(wrong.slice(0, 5), `every entry and every bar stands as the payload states it — ${wrong.length} do not`).toEqual([]);
  });

  it("AC-1: every lapping bar carries its own Lap line with the lap's own mass, and no other bar does", async () => {
    const { figure } = await figuresModule();
    const { first } = await rendered();
    const whole = compact(pages(first.pdf).join(" "));
    const bars = barsOf(payload());

    // A LAP LINE BELONGS TO ITS BAR, AND A COLUMN IS NOT A LINE (AM-03(a), L-BD-02, I-bbs-3).
    //
    // The document is cut into one SEGMENT per bar — from that bar's mark to the next bar's — and the
    // rule is read inside the segment: a bar that laps carries the word `Lap` with the lap's OWN mass
    // beside it, and a bar that does not lap carries no `Lap` at all. A template that printed a lap as
    // a per-row COLUMN says Lap on every page, which the count below refuses; one that printed the
    // lap's mass in a column beside the bar's says Lap in a segment that has no lap.
    const lapping = bars.filter((bar) => bar.lapsPerBar > 0);
    expect(lapping.length, `${PAYLOAD} reaches a bar that laps — see the roster case below`).toBeGreaterThan(0);
    const lapWord = /Lap(?!s)/gu;
    const saidLap = [...whole.matchAll(lapWord)].length;
    expect(saidLap, `the document names a Lap line exactly once per lapping bar — ${lapping.length} bar(s) lap, and it says Lap ${saidLap} time(s) (AM-03(a))`).toBe(lapping.length);

    const wrong: string[] = [];
    let cursor = 0;
    for (const [at, bar] of bars.entries()) {
      const mark = compact(bar.barMark);
      const from = whole.indexOf(mark, cursor);
      if (from === -1) {
        wrong.push(`bar ${at} (${bar.barMark}) does not stand in the document in the order the payload puts it`);
        continue;
      }
      const next = bars[at + 1];
      const found = next === undefined ? -1 : whole.indexOf(compact(next.barMark), from + mark.length);
      const segment = whole.slice(from, found === -1 ? whole.length : found);
      cursor = from + mark.length;

      const saysLap = /Lap(?!s)/u.test(segment);
      if (bar.lapsPerBar > 0) {
        if (!saysLap) wrong.push(`${bar.barMark} laps ${bar.lapsPerBar} time(s) and its own line says no Lap`);
        else if (!segment.includes(compact(figure(bar.kgLap, 3)))) wrong.push(`${bar.barMark}'s Lap line does not carry the lap's own mass (${bar.kgLap} kg)`);
      } else if (saysLap) {
        wrong.push(`${bar.barMark} laps nothing and a Lap stands on its line anyway`);
      }
    }
    expect(wrong.slice(0, 5), `each lap stands on its own bar's line, and only there — ${wrong.length} do not`).toEqual([]);
  });

  it("I-535: the page names its project, client, site and drawings in words, and prints no id, key or enum word", async () => {
    const { SHAPE_CODES } = await bs8666Module();
    const { first } = await rendered();
    const text = squashed(pages(first.pdf).join(" "));
    const whole = compact(text);
    const input = payload();

    for (const particular of [input.project, input.particulars.client ?? "", input.particulars.site ?? "", `${input.particulars.drawingSet}, revision ${String(input.particulars.revision)}`]) {
      expect(whole, `the particulars say "${particular}" (I-535)`).toContain(compact(particular));
    }
    expect(text, "a date is written as a date, through the format seam (L-FMT-01: DD MMM YYYY)").toMatch(/\b\d{2} [A-Z][a-z]{2} \d{4}\b/u);

    expect(text, "no uuid stands on the page").not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu);
    for (const key of ["DXF_HANDLE", "v:LAYOUT_PLAN", "campaign", "Pinned revision"]) expect(text, `no register key or id label (${key}) stands on the page`).not.toContain(key);
    const members = new Set(bbsDocumentRows().map((row) => row.member));
    expect([...members].filter((member) => whole.includes(compact(member))), "and no member's register key").toEqual([]);

    // An enum word is a key said as the store holds it: SCREAMING or snake_case. The page's own
    // capitals are the banner, the BS 8666 shape codes (the domain's own names, I-bbs-6) and the
    // floors' labels (model data), and nothing else.
    const allowed = new Set<string>(["DRAFT", "UNSIGNED", ...SHAPE_CODES, ...input.schedule.flatMap((entry) => (entry.level === null ? [] : [entry.level]))]);
    const shouted = [...new Set([...text.matchAll(/\b[A-Z][A-Z_]{2,}\b/gu)].map((match) => match[0]).filter((word) => !allowed.has(word)))];
    expect(shouted, "no key is said in capitals — a class, a role or a component is said in words (R-UI-082)").toEqual([]);
    expect([...text.matchAll(/\b[a-z]+_[a-z_]+\b/gu)].map((match) => match[0]), "and none in snake_case").toEqual([]);
  });

  it("I-535: every column is as wide as what it holds, and its heading says its unit as written", async () => {
    const { first } = await rendered();
    const text = squashed(pages(first.pdf).join(" "));
    // TEST_AMENDED (session 9, BBS-HONEST, I-568): the IS column is named for the length it
    // prints, and the offcut is read in metres.
    for (const heading of ["Bar mark", "Dia (mm)", "Dimensions (mm)", "Cutting length (mm)", "Rounded (mm)", "IS 2502 (mm)", "In each", "Total", "Mass (kg)", "Offcut (m)"]) {
      expect(text, `the column heading "${heading}" stands in its own words, its unit in lower case`).toContain(heading);
    }
    expect(text, "no heading is shouted, which is how two of them ran together as one word").not.toMatch(/CUTTING|ROUNDED|\(MM\)/u);

    // white-box: I-535 — "no figure is printed over its neighbour" is a claim about GEOMETRY, and
    // the text this lane extracts carries no glyph positions. The cause of the overprint walk-0 read
    // ('3,050' and '3,048.000' as '3,050,048.000') was a figure column FIXED narrower than the figure
    // it held; so what is read here is the schedule table's own column list — every column is `auto`
    // (as wide as its widest cell, header or figure) but the one that takes the slack (`1fr`, the
    // legs), and no column is a fixed length a figure could outgrow.
    const template = withoutComments(TEMPLATE);
    const tables = [...template.matchAll(/#table\(\s*columns:\s*\(([^)]*)\)/gu)].map((match) => (match[1] as string).split(",").map((one) => one.trim()).filter((one) => one !== ""));
    expect(tables.length, `${TEMPLATE} sets its schedule and its cutting stock as tables`).toBeGreaterThanOrEqual(2);
    for (const columns of tables) {
      expect(columns.filter((one) => one !== "auto" && one !== "1fr"), `a table's columns are sized by what they hold: ${columns.join(", ")}`).toEqual([]);
      expect(columns.filter((one) => one === "1fr").length, "and exactly one of them takes the slack").toBe(1);
    }
  });

  it("I-536: a schedule over partly declared lines says what it leaves out and that its total is the measured scope only", async () => {
    const { renderDocument } = await documentsIndex();
    const { first } = await rendered();
    const whole = squashed(pages(first.pdf).join(" "));
    expect(payload().partial, "the golden details every bar, so the committed schedule is whole").toBe(false);
    expect(whole, "and a whole schedule claims no omission").not.toContain("Left out of this schedule");
    expect(payload().totalCovers, "and a whole schedule's total needs no cover").toBe("");
    expect(whole, "and no caveat on its total").not.toContain(" only —");

    // TEST_AMENDED (session 9, BBS-HONEST, I-567): the total's caveat says what it covers, in
    // words, composed by the product's own emission rather than typed here.
    const reason = REFUSALS.NOTE_READING_CONTESTED.message;
    const partial = (await bbsGoldenPayload(BBS_FIXTURE, { partial: true, omitted: [{ code: "NOTE_READING_CONTESTED", components: ["lap"] }] })) as Payload;
    expect(partial.totalCovers, "the emission says what the total covers").toBe("Column and shear wall bars only — laps not counted");
    const said_ = squashed(pages((await renderDocument("bbs", partial, ctx)).pdf).join(" "));
    expect(said_, "a partly declared schedule closes with what it leaves out").toContain("Left out of this schedule");
    expect(compact(said_), "naming the component in words and why, in the register's own sentence (R-SPINE-062)").toContain(compact(`Laps ${reason}`));
    expect(compact(said_), "and its total says what it covers (L-QTY-02)").toContain(compact(partial.totalCovers));
  });

  it("I-567 · I-569: runs whose laps are not stated are labelled, their diameters' cutting stock is withheld by name, and the steel no line holds is listed", async () => {
    const { figure } = await figuresModule();
    const { renderDocument } = await documentsIndex();
    // The golden's ground-floor members, as if their lines had left their laps out: the reading J-000's
    // campaign stands on, where every column main bar is its storey height.
    const rows = bbsDocumentRows();
    const deferred = [...new Set(rows.filter((row) => row.level === "GF").map((row) => row.member))];
    const runsOf = new Set(rows.filter((row) => row.level === "GF" && !["TIE", "STIRRUP", "SPIRAL"].includes(row.role)).map((row) => row.dia_mm));
    const beams = { about: "Beam · Rebar", levels: "GF–6F", why: REFUSALS.NOT_ESTABLISHED.message };
    const honest = (await bbsGoldenPayload(BBS_FIXTURE, {
      partial: true,
      omitted: [{ code: "NOTE_READING_CONTESTED", components: ["lap"] }],
      deferred,
      notInSchedule: [beams],
    })) as Payload;

    expect(deferred.length, "the golden stands members on GF").toBeGreaterThan(0);
    expect([...honest.stockWithheld].sort((a, b) => a - b), "every diameter a GF run is of is withheld, and no other").toEqual([...runsOf].sort((a, b) => a - b));
    for (const diameter of honest.stockWithheld) {
      expect(Object.keys(honest.cuttingStock), `the payload carries no packing for ${diameter} mm — the page cannot print what it was never given`).not.toContain(String(diameter));
    }
    expect(honest.schedule.filter((entry) => entry.notForCutting).map((entry) => entry.level), "the GF entries, and only they, are marked as runs").toEqual(
      honest.schedule.filter((entry) => entry.level === "GF").map((entry) => entry.level),
    );

    const page = squashed(pages((await renderDocument("bbs", honest, ctx)).pdf).join(" "));
    const runs = honest.schedule.filter((entry) => entry.notForCutting).length;
    const labels = [...compact(page).matchAll(/Storey-heightruns,notforcutting/gu)].length;
    expect(labels, `each of the ${runs} entries of runs is headed as not for cutting (it said so ${labels} time(s))`).toBeGreaterThanOrEqual(runs);
    expect(page, "a withheld diameter's stock says why, in words").toContain("Not computed — laps not stated");
    const named = honest.stockWithheld.map((diameter) => figure(String(diameter), 0));
    const listedAs = named.length === 1 ? named.join("") : `${named.slice(0, -1).join(", ")} and ${named.at(-1) ?? ""}`;
    expect(compact(page), "and the sentence beneath the table names the withheld diameters").toContain(
      compact(`Cutting stock is not computed for ${listedAs} mm: those bars are storey-height runs whose laps are not stated, and nobody can cut from them.`),
    );
    expect(page, "the steel no line was published for is listed").toContain("Not in this schedule");
    expect(compact(page), "in the draft BOQ's words: what, over which levels, and why").toContain(compact(`${beams.about} ${beams.levels} ${beams.why}`));
    expect(compact(page), "and the total says what it covers").toContain(compact(honest.totalCovers));
  });

  it("I-596: a bar in a shape the roster does not hold is declared by name, and the total says it excludes it", async () => {
    const { figure } = await figuresModule();
    const { SHAPE_CODES } = await bs8666Module();
    const { first } = await rendered();
    const whole = compact(pages(first.pdf).join(" "));
    const input = payload();

    // The regenerated golden bends C7's hoops to CH (W-28), which the roster does not hold: the
    // committed schedule reaches a declared bar, so the section is graded rather than skipped.
    const declared = input.declared;
    expect(declared, `${PAYLOAD} reaches a bar in a shape the roster does not hold`).not.toBeNull();
    if (declared === null) return;
    expect(declared.bars.filter((one) => SHAPE_CODES.includes(one.shape)), "every declared bar is in a shape the roster does not hold").toEqual([]);
    expect(barsOf(input).filter((one) => !SHAPE_CODES.includes(one.shape)), "and no scheduled bar is").toEqual([]);
    expect(declared.reason, "the reason is the register's own sentence (R-SPINE-062)").toBe(REFUSALS.BAR_SHAPE_NOT_HELD.message);

    // Nothing dropped, nothing double-counted: the golden rows the schedule is drawn from weigh the
    // grand total plus the declared mass, exactly (B-07: integers of grammes, no float).
    const grammes = (kg: string): bigint => BigInt(kg.replace(".", ""));
    const drawn = bbsDocumentRows().reduce((sum, row) => sum + grammes(row.kg), 0n);
    expect(grammes(input.grandTotalKg) + grammes(declared.kg), "the grand total and the declared mass together are every bar the golden details").toBe(drawn);
    expect(declared.bars.reduce((sum, one) => sum + grammes(one.kg), 0n), "and the declared mass is the declared bars' own").toBe(grammes(declared.kg));

    const at = whole.indexOf(compact("Declared, not scheduled"));
    expect(at, "the page names the declared bars under their own heading").toBeGreaterThan(-1);
    expect(whole.slice(at), "with the register's sentence for why").toContain(compact(declared.reason));
    for (const one of declared.bars) {
      const line = whole.slice(whole.indexOf(compact(one.barMark), at));
      for (const value of [one.shape, figure(one.cuttingRawMm, 3), figure(one.bars, 0), figure(one.kg, 3)]) {
        expect(line.slice(0, 200), `${one.barMark} states ${value} on its declared line`).toContain(compact(value));
      }
    }
    expect(whole, "the excluded mass is said as excluded").toContain(compact(`Excluded from the total mass ${figure(declared.kg, 3)}`));
    expect(whole, "and the total mass says it excludes it").toContain(compact(`Excludes the ${figure(declared.kg, 3)} kg declared, not scheduled`));
  });

  it("I-535: the sign-off box is ruled paper the site completes by hand — the document fills in nobody", async () => {
    const { first } = await rendered();
    const sheets = pages(first.pdf);
    const last = squashed(sheets[sheets.length - 1] ?? "");
    for (const role of ["Prepared by", "Checked by"]) expect(last, `the last page carries a "${role}" box`).toContain(role);
    for (const field of ["Name", "Signature", "Date"]) expect(last, `each with a ${field} line`).toContain(field);
    expect(last, "and says it names no surveyor and certifies nothing (AM-05)").toContain("it names no surveyor and certifies no quantity");
  });

  it("AC-1: the cutting stock prints one line per diameter, with its stock bars, pieces and offcut", async () => {
    const { figure } = await figuresModule();
    const { first } = await rendered();
    const whole = squashed(pages(first.pdf).join(" "));
    const stock = payload().cuttingStock;

    const diameters = Object.keys(stock);
    expect(diameters.length, `${PAYLOAD} carries the cutting-stock result the schedule closes with (R-TO-054)`).toBeGreaterThan(0);
    for (const diameter of diameters) {
      const answer = stock[diameter] as { stockBars: number; pieces: number; offcutM: string };
      expect(whole, `the ${diameter} mm line names the diameter it packed`).toContain(squashed(diameter));
      expect(whole, `the ${diameter} mm line states the stock bars it took (${answer.stockBars})`).toContain(squashed(figure(String(answer.stockBars), 0)));
      expect(whole, `and the pieces it cut from them (${answer.pieces})`).toContain(squashed(figure(String(answer.pieces), 0)));
      const offcut = printedForms(figure, answer.offcutM);
      expect(offcut.length, `the ${diameter} mm offcut (${answer.offcutM} m) is a figure a document can print (L-FMT-02)`).toBeGreaterThan(0);
      expect(offcut.some((form) => whole.includes(form)), `and the ${diameter} mm line states its offcut — one of ${offcut.join(" / ")}`).toBe(true);
    }
    expect(whole, "closed by the door's own grand total").toContain(figure(payload().grandTotalKg, 3));
  });

  it("AC-1: the shape codes are Typst-drawn vectors, and the template dispatches on every BS 8666 code", async () => {
    const { SHAPE_CODES } = await bs8666Module();
    const { first } = await rendered();

    const bytes = Buffer.from(first.pdf).toString("latin1");
    expect(/\/Subtype\s*\/Image/u.test(bytes), "no page of the schedule embeds an image: the shape sketches are drawn by the template (A-BBS-PDF)").toBe(false);

    // SOMETHING WAS DRAWN, AND IT SCALES WITH THE BARS. A document that prints the code as text and
    // draws nothing embeds no image either — so the absence of an image proves nothing on its own.
    // What a sketch per bar leaves behind is geometry: a path constructed and then painted, once per
    // bar at least (A-BBS-PDF: the shape codes are Typst-drawn vector sketches).
    const drawn = paintCountOf(first.pdf);
    const lines = barsOf(payload()).length;
    expect(drawn.painted, `the schedule PAINTS at least one path per bar it schedules — ${lines} bar(s), and the pages paint ${drawn.painted} (A-BBS-PDF)`).toBeGreaterThanOrEqual(lines);
    expect(drawn.constructed, `and constructs the paths it paints — ${drawn.constructed} construction operator(s) across the document`).toBeGreaterThanOrEqual(drawn.painted);

    expect(existsSync(inTree(TEMPLATE)), `${TEMPLATE} stands beside its kind — the template is a file of this increment, not a tree under documents/templates`).toBe(true);
    // white-box: AC-1 — "the sketches are drawn for every shape the roster holds" is a property of
    // the TEMPLATE'S OWN TEXT: no payload of this lane can exercise a shape its rows do not carry,
    // so the roster's unexercised codes are reachable only by reading the dispatch. What is read is
    // that each code's BRANCH REACHES A DRAWING PRIMITIVE — a code named in a dead tuple and printed
    // as a letter draws nothing, and that is the implementation this line exists to refuse. The
    // roster is the product's (SHAPE_CODES), so a shape a later increment adds grows this with it.
    const template = withoutComments(TEMPLATE);
    expect(SHAPE_CODES.length, "the product publishes the BS 8666 shapes it holds").toBeGreaterThan(0);
    const undrawn: string[] = [];
    for (const code of SHAPE_CODES) {
      const at = template.indexOf(`"${code}"`);
      if (at === -1) {
        undrawn.push(`${code} is named nowhere in ${TEMPLATE}`);
        continue;
      }
      // The branch: from this code to the next code literal of the roster, or to the end of the file
      // — whichever comes first. A dispatch that answers a code with a drawing reaches a primitive
      // inside it; one that answers with a string does not.
      const following = SHAPE_CODES.map((other) => template.indexOf(`"${other}"`, at + code.length + 2)).filter((found) => found !== -1);
      const until = following.length === 0 ? template.length : Math.min(...following);
      const branch = template.slice(at, until);
      if (!DRAWING_PRIMITIVES.some((primitive) => branch.includes(primitive))) {
        undrawn.push(`${code}'s branch draws nothing — it reaches none of ${DRAWING_PRIMITIVES.join(", ")}`);
      }
    }
    expect(undrawn, `every code of SHAPE_CODES is answered by a sketch, never by its own letters — ${undrawn.length} draw nothing`).toEqual([]);
  });

  it("I-534: the committed payload is the product's own schedule of the golden roster, each mark once per floor", async () => {
    const input = payload();
    expect(bbsDocumentRows().length, `fixtures/${BBS_FIXTURE}/bbs.golden.json carries the columns and shear walls the schedule is drawn from (AM-01)`).toBeGreaterThan(0);
    expect(input, `${PAYLOAD} is exactly what the product's door and export make of the golden roster — never a list typed, re-rounded, re-ordered or re-counted here`).toEqual(
      await bbsGoldenPayload(),
    );

    // WHAT THE PAYLOAD MUST REACH. A golden only proves what its payload exercises: a mark standing
    // many times on one floor (the count is the point), a lapping bar (the Lap line), a bar whose
    // IS-additive figure DIFFERS from its raw one (the three lengths are three), and a schedule long
    // enough to run over several pages (the headings repeat, the band stands).
    const bars = barsOf(input);
    expect(Math.max(...input.schedule.map((entry) => entry.members)), `${PAYLOAD} states a mark that stands more than once on its floor`).toBeGreaterThan(1);
    expect(input.schedule.length, `${PAYLOAD} carries a schedule's worth of entries`).toBeGreaterThanOrEqual(20);
    expect(bars.filter((bar) => bar.lapsPerBar > 0).length, `${PAYLOAD} reaches a bar that LAPS, so the Lap line is graded rather than skipped`).toBeGreaterThanOrEqual(1);
    expect(
      bars.filter((bar) => bar.cuttingIsAdditiveMm !== bar.cuttingRawMm).length,
      `${PAYLOAD} reaches a bar whose IS-additive length differs from its raw one, so the IS↔BS divergence is printed rather than assumed equal (L-FRM-05)`,
    ).toBeGreaterThanOrEqual(1);
    const { first } = await rendered();
    expect(pages(first.pdf).length, "and it runs over more than one page, so the column band and the headings are read where they repeat").toBeGreaterThan(1);
  });

  it("AC-1: the schedule joins the lane and moves no document that nobody asked to change", async () => {
    const { renderDocument } = await documentsIndex();
    // The schedule renders FIRST, in this same process: "the other two are unmoved" is a claim about
    // a tree that has gained a third kind, and it says nothing at all about a tree without one.
    const { first } = await rendered();
    expect(first.sha256, `the bar schedule renders to ${GOLDEN}`).toBe(sha256(goldenBytes(GOLDEN)));
    for (const [kind, payloadPath, goldenPath] of [
      ["proof", PROOF_PAYLOAD, PROOF_GOLDEN],
      ["boq-draft", DRAFT_PAYLOAD, DRAFT_GOLDEN],
    ] as const) {
      const again = await renderDocument(kind, fixtureJson<unknown>(payloadPath), ctx);
      expect(again.sha256, `${goldenPath} still renders to its own bytes: a kind added beside the others moves none of them (AM-11)`).toBe(sha256(goldenBytes(goldenPath)));
    }
  });
});

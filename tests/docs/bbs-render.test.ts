/**
 * AC-1 — the `bbs` document kind, rendered in the V-DOCS lane (`pnpm test:docs`): one file and one
 * barrel line, a payload the schema cannot take refused before the subprocess, and the document
 * itself byte-frozen against its committed golden with DRAFT — UNSIGNED on every page
 * (A-BBS-PDF, R-TO-054, SEAM-DOC, V-DOCS, AM-18, AM-03(c)(e), AM-05, L-FRM-05).
 *
 * What is judged is the ARTEFACT. The lane commits a payload, puts it through the pinned renderer,
 * and reads the bytes and the extracted text back — so what this file grades is the document the
 * product produced, never the template that produced it. The single exception is the sketch
 * dispatch: "the shape codes are DRAWN rather than imaged" is a property of the bytes (no
 * `/Subtype /Image`) and of the template's own text (every `SHAPE_CODES` entry named), and the
 * second half is marked white-box where it stands.
 *
 * THE PAYLOAD IS THE GOLDEN ROSTER'S, NEVER A LIST TYPED HERE. Every figure the committed payload
 * carries is proved to be a row of `fixtures/rcc6-bnbc/bbs.golden.json`, read in file order through
 * the fixture support the golden lane publishes — so a payload somebody re-typed, re-rounded or
 * re-ordered fails here rather than being frozen into a golden PDF (AM-01, B-19).
 *
 * It lives FLAT beside the lane's other suites because that is what every reading of
 * `tests/docs/vitest.config.ts`'s globs collects (`*.test.ts` under its own root, as
 * `boq-draft-render.test.ts` records); its FIXTURES stay under `tests/docs/bbs/`, which is this
 * kind's own fixture root (docs/design/s-bbs.md §6). Nothing here measures time
 * (AM-10 §3) — the lane's own restraint is asserted over every file of tests/docs by
 * `tests/docs/boq-draft-render.test.ts`, and this file is one of them.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { pdfText } from "./support/pdf-text";
import { inTree, squashed } from "./support/product";
import { bbsGoldenRows, BBS_FIXTURE, type BbsGoldenRow } from "./support/bbs-golden";
import { bbsModule, bs8666Module, documentsIndex, figuresModule, kindsLawModule, kindsModule, type DocumentKind } from "./support/seam";
import { filesUnder, withoutComments } from "./support/tree-source";

const PAYLOAD = "tests/docs/bbs/payload.json";
const GOLDEN = "tests/docs/bbs/golden.pdf";
const TEMPLATE = "src/core/documents/kinds/bbs.typ";
const PROOF_GOLDEN = "tests/docs/proof/golden.pdf";
const PROOF_PAYLOAD = "tests/docs/proof/payload.json";
const DRAFT_GOLDEN = "tests/docs/boq-draft/golden.pdf";
const DRAFT_PAYLOAD = "tests/docs/boq-draft/payload.json";

/** The banner AM-05 puts on every page of a working document before M7. */
const BANNER = "DRAFT — UNSIGNED";

const ctx = { requestId: "ac-1-request", actor: "acceptance" };

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** One row of the committed payload, by the field names the increment's interfaces give it. */
type PayloadRow = {
  barMark: string;
  shape: string;
  cuttingRawMm: string;
  cuttingRoundedMm: string;
  cuttingIsAdditiveMm: string;
  bars: string;
  kgNet: string;
  kgLap: string;
  kg: string;
  lapsPerBar: number;
};

/** The committed payload, as much of its shape as the criteria name. */
type Payload = {
  title?: string;
  rows: PayloadRow[];
  cuttingStock: Record<string, { stockBars: number; pieces: number; offcutMm: string }>;
  perDiameterKg: Record<string, string>;
  grandTotalKg: string;
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

/** The committed payload, read once and shared by the cases that drive the renderer with it. */
const payload = (): Payload => fixtureJson<Payload>(PAYLOAD);

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

/** The nine fields a payload row and a golden row must agree on, as one comparable tuple. */
function payloadFacts(row: PayloadRow): string {
  return JSON.stringify([row.barMark, row.shape, row.cuttingRawMm, row.cuttingRoundedMm, row.cuttingIsAdditiveMm, row.bars, row.kgNet, row.kgLap, row.kg]);
}

/** The same nine facts, as the golden records them. */
function goldenFacts(row: BbsGoldenRow): string {
  return JSON.stringify([row.bar_mark, row.shape, row.cutting_raw_mm, row.cutting_rounded_mm, row.cutting_is_additive_mm, row.bars, row.kg_net, row.kg_lap, row.kg]);
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
  });

  it("AC-1: every row prints its mark, its shape and its three lengths, and every lapping row a LAP component line", async () => {
    const { figure } = await figuresModule();
    const { first } = await rendered();
    const whole = squashed(pages(first.pdf).join(" "));
    const input = payload();

    expect(input.rows.length, `${PAYLOAD} carries rows to print`).toBeGreaterThan(0);
    for (const row of input.rows) {
      expect(whole, `bar mark ${row.barMark} stands in the schedule`).toContain(squashed(row.barMark));
      expect(whole, `and the shape it is bent to (${row.shape}) stands beside it — a BS 8666 code is the domain's own name (I-bbs-6)`).toContain(squashed(row.shape));
      expect(whole, `${row.barMark}'s raw cutting length prints as stored, never rounded (L-FRM-05)`).toContain(squashed(figure(row.cuttingRawMm, 3)));
      expect(whole, `${row.barMark}'s one rounded surface prints beside it (AM-01)`).toContain(squashed(figure(row.cuttingRoundedMm, 0)));
      expect(whole, `${row.barMark}'s IS-additive figure prints beside them both, and is billed by nothing (AM-03(c))`).toContain(squashed(figure(row.cuttingIsAdditiveMm, 3)));
    }

    // A lap is its own component, never a percentage of the bar (AM-03(a), L-BD-02): every lapping
    // row owes a LAP line carrying the lap's OWN mass.
    const lapping = input.rows.filter((row) => row.lapsPerBar > 0);
    for (const row of lapping) {
      expect(whole, `${row.barMark} laps ${row.lapsPerBar} time(s), so its lap stands as its own component carrying ${row.kgLap} kg (AM-03(a))`).toContain(squashed(figure(row.kgLap, 3)));
    }
    const said = whole.split("LAP").length - 1;
    expect(said, `the document names a LAP component once for each of the ${lapping.length} lapping row(s) it carries`).toBeGreaterThanOrEqual(lapping.length);
  });

  it("AC-1: the cutting stock prints one line per diameter, with its stock bars, pieces and offcut", async () => {
    const { figure } = await figuresModule();
    const { first } = await rendered();
    const whole = squashed(pages(first.pdf).join(" "));
    const stock = payload().cuttingStock;

    const diameters = Object.keys(stock);
    expect(diameters.length, `${PAYLOAD} carries the cutting-stock result the schedule closes with (R-TO-054)`).toBeGreaterThan(0);
    for (const diameter of diameters) {
      const answer = stock[diameter] as { stockBars: number; pieces: number; offcutMm: string };
      expect(whole, `the ${diameter} mm line names the diameter it packed`).toContain(squashed(diameter));
      expect(whole, `the ${diameter} mm line states the stock bars it took (${answer.stockBars})`).toContain(squashed(figure(String(answer.stockBars), 0)));
      expect(whole, `and the pieces it cut from them (${answer.pieces})`).toContain(squashed(figure(String(answer.pieces), 0)));
      const offcut = printedForms(figure, answer.offcutMm);
      expect(offcut.length, `the ${diameter} mm offcut (${answer.offcutMm}) is a figure a document can print (L-FMT-02)`).toBeGreaterThan(0);
      expect(offcut.some((form) => whole.includes(form)), `and the ${diameter} mm line states its offcut — one of ${offcut.join(" / ")}`).toBe(true);
    }
  });

  it("AC-1: the shape codes are Typst-drawn vectors, and the template dispatches on every BS 8666 code", async () => {
    const { SHAPE_CODES } = await bs8666Module();
    const { first } = await rendered();

    const bytes = Buffer.from(first.pdf).toString("latin1");
    expect(/\/Subtype\s*\/Image/u.test(bytes), "no page of the schedule embeds an image: the shape sketches are drawn by the template (A-BBS-PDF)").toBe(false);

    expect(existsSync(inTree(TEMPLATE)), `${TEMPLATE} stands beside its kind — the template is a file of this increment, not a tree under documents/templates`).toBe(true);
    // white-box: AC-1 — "the sketches are drawn for every shape the roster holds" is a property of
    // the TEMPLATE'S OWN TEXT: a code the dispatch does not name draws nothing, and no payload of
    // this lane can exercise a shape its rows do not carry. The roster is read from the product
    // (SHAPE_CODES), so a shape a later increment adds grows this assertion rather than freezing it.
    const template = withoutComments(TEMPLATE);
    expect(SHAPE_CODES.length, "the product publishes the BS 8666 shapes it holds").toBeGreaterThan(0);
    for (const code of SHAPE_CODES) {
      expect(template.includes(`"${code}"`), `${TEMPLATE} draws the ${code} shape — every code of SHAPE_CODES is named in its sketch dispatch`).toBe(true);
    }
  });

  it("AC-1: the committed payload is the golden roster's own rows, in file order", async () => {
    const input = payload();
    const roster = bbsGoldenRows();
    expect(roster.length, `fixtures/${BBS_FIXTURE}/bbs.golden.json carries the fixture's own bar rows (AM-01)`).toBeGreaterThan(0);

    // Each payload row is a golden row, field for field, and the rows stand in the file's own order:
    // the assignment below walks the roster forwards and never goes back, so a payload that
    // re-ordered, re-rounded or re-typed a figure has no ascending assignment at all.
    let at = 0;
    for (const [index, row] of input.rows.entries()) {
      const facts = payloadFacts(row);
      let found = -1;
      for (let scan = at; scan < roster.length; scan += 1) {
        if (goldenFacts(roster[scan] as BbsGoldenRow) === facts) {
          found = scan;
          break;
        }
      }
      expect(
        found,
        `payload row ${index} (${row.barMark}) is a row of the golden roster, verbatim and in file order — its mark, shape, three cutting lengths, bars and three masses are ${facts}`,
      ).toBeGreaterThan(-1);
      at = found + 1;
    }

    // WHAT THE PAYLOAD MUST REACH. A golden only proves what its payload exercises, and the three
    // things this kind exists to carry are a lapping row (the LAP component line), a row whose
    // IS-additive figure DIFFERS from its raw one (the three lengths are three), and a schedule
    // long enough to be a schedule. The roster's first 120 rows carry no lap at all, so a payload
    // cut there would grade the LAP line vacuously (B-19); a few rows further on it does.
    expect(input.rows.length, `${PAYLOAD} carries a schedule's worth of rows`).toBeGreaterThanOrEqual(120);
    expect(
      input.rows.filter((row) => row.lapsPerBar > 0).length,
      `${PAYLOAD} reaches a row that LAPS, so the LAP component line is graded rather than skipped — take enough of the roster's rows in file order to include one`,
    ).toBeGreaterThanOrEqual(1);
    expect(
      input.rows.filter((row) => row.cuttingIsAdditiveMm !== row.cuttingRawMm).length,
      `${PAYLOAD} reaches a row whose IS-additive length differs from its raw one, so the IS↔BS divergence is printed rather than assumed equal (L-FRM-05)`,
    ).toBeGreaterThanOrEqual(1);
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

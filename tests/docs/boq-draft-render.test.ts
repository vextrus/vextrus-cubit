/**
 * AC-4 — the `boq-draft` document kind, rendered in the V-DOCS lane (`pnpm test:docs`): byte-frozen
 * against its committed golden, DRAFT — UNSIGNED on every page, and never, anywhere, a bill
 * (R-TO-053, A-BOQ-PDF, AM-05, AM-18, V-DOCS).
 *
 * What is judged is the ARTEFACT: the payload the lane commits is put through the pinned renderer
 * and the bytes and the extracted text are read back. A draft before M7 carries no signature, so it
 * carries no surveyor, no credential and no certificate either — and it is never called a bill,
 * because the word states a status this document does not have.
 *
 * TEST_AMENDED (session 8, BOQ-SHAPE; s-boq I-528..e): the owner ruled the bill's shape — one
 * ITEM per description at one level band, rounded once from the register's sum; the member lines
 * behind each item in a Details of measurement appendix; no quantity added across descriptions; the
 * front page and footer in words, with no surrogate id and no raw enum. Every rule this suite held the
 * old draft to is held here over items, and the new ones are added: the taxonomy is stated by its
 * edition in words rather than its id, and the `Measured-scope subtotal` foot is ASSERTED ABSENT.
 *
 * It lives flat beside the lane's other suites because that is what `tests/docs/vitest.config.ts`
 * collects (`*.test.ts` under its own root); its FIXTURES stay under `tests/docs/boq-draft/`, which
 * is the kind's own fixture root (docs/design/s-boq.md §7).
 *
 * `tests/docs/proof/golden.pdf` is asserted UNMOVED here: `documents/base/frame.typ` carries optional
 * parameters only this kind passes (`footer-note`, `watermarked`), and a default that changed the
 * frame would rewrite a document nobody asked to change. Nothing here measures time (AM-10 §3).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pdfText } from "./support/pdf-text";
import { inTree, squashed } from "./support/product";
import { boqNumberingModule, boqTaxonomyModule, documentsIndex, kindsModule, type DocumentKind } from "./support/seam";
import { filesUnder, withoutComments } from "./support/tree-source";

const PAYLOAD = "tests/docs/boq-draft/payload.json";
const GOLDEN = "tests/docs/boq-draft/golden.pdf";
const PROOF_PAYLOAD = "tests/docs/proof/payload.json";
const PROOF_GOLDEN = "tests/docs/proof/golden.pdf";

const ctx = { requestId: "ac-4-request", actor: "acceptance" };

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** One member line of a payload item, as the kind's schema holds it. */
type Line = { lineId: string; quantity: string | null; reason?: string; omitted?: string[]; mark?: string; grid?: string; dimensions?: string; sheet?: string };
type Item = { key: string; description: string; level: string; quantity: string | null; lines: Line[] };
type Group = { class: string; kind: string; description: string; unit: string; items: Item[] };
type Section = { bill: string; label: string; groups: Group[] };
type NotMeasuredRow = { class: string | null; kind: string; levels: string; cause: string };
type Front = {
  client: string | null;
  site: string | null;
  drawingSet: string | null;
  drawings: string[];
  register?: { sheet: string; title: string; revision: string | null }[];
  edition?: { name: string; version: string } | null;
  issued: string | null;
};
type Payload = {
  project: string;
  campaignId: string;
  setRevisionId: string;
  taxonomyVersion: string;
  coverage: string;
  front?: Front;
  sections: Section[];
  unclassified: { label: string; lines: (Line & { reason: string })[] };
  notMeasured?: NotMeasuredRow[];
};

/** Every item a payload states, with its group beside it. */
function itemsOf(payload: Payload): { group: Group; item: Item }[] {
  return payload.sections.flatMap((section) => section.groups.flatMap((group) => group.items.map((item) => ({ group, item }))));
}

/** The registry's own entries, as the product publishes them (`src/core/errors.ts`). */
async function registeredMessages(): Promise<Record<string, { message: string }>> {
  const module_ = (await import(inTree("src/core/errors.ts"))) as { REFUSALS?: Record<string, { message: string }> };
  return module_.REFUSALS ?? {};
}

/** A registered code as a page says it — `SLAB_THICKNESS_UNSTATED` → `slab thickness unstated`. */
const codeInWords = (code: string): string => code.replace(/_/gu, " ").toLowerCase();

/** The months a document says a date with (L-FMT-01), for reading a taxonomy edition in words. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A taxonomy version's edition as a document says it: `bill-taxonomy/2026-09-16` → `16 Sep 2026`. */
function editionInWords(version: string): string {
  const edition = /(\d{4})-(\d{2})-(\d{2})$/u.exec(version);
  expect(edition, `${version} carries an ISO edition date`).not.toBeNull();
  return `${edition?.[3]} ${MONTHS[Number(edition?.[2]) - 1]} ${edition?.[1]}`;
}

/** A committed fixture of this lane, read as JSON. */
function fixture(relative: string): Payload {
  const absolute = inTree(relative);
  expect(existsSync(absolute), `${relative} is not in the tree yet — the draft BOQ's document seam does not provide its committed payload`).toBe(true);
  expect(relative.startsWith("tests/"), "a fixture of this lane is read here, and nothing else ever is").toBe(true);
  // white-box: AC-4 — this reads a COMMITTED FIXTURE of the document lane (tests/docs/**), never a
  // file under src/, scripts/ or db/, and nothing is asserted about its text: it is the INPUT the
  // renderer is driven with, so that what the lane grades is the document the product produced.
  return JSON.parse(readFileSync(absolute, "utf8")) as Payload;
}

/** The copy the product publishes, as its one registry holds it (`src/ui/strings`). */
async function productStrings(): Promise<Record<string, string>> {
  const module_ = (await import(inTree("src/ui/strings/index.ts"))) as { strings?: Record<string, string> };
  return module_.strings ?? {};
}

/** The bytes of a committed golden. */
function goldenBytes(relative: string): Uint8Array {
  const absolute = inTree(relative);
  expect(existsSync(absolute), `${relative} is not in the tree yet — the lane has no yardstick to hold the render to`).toBe(true);
  expect(relative.startsWith("tests/"), "a golden of this lane is read here, and nothing else ever is").toBe(true);
  // white-box: AC-4 — the bytes of a COMMITTED GOLDEN under tests/docs/**, never a file under src/,
  // scripts/ or db/. "the proof's golden is byte-identical after the frame gains its optional
  // parameters" is a claim about BYTES, and the golden is the only thing the render can be held to.
  return new Uint8Array(readFileSync(absolute));
}

/**
 * The document's pages, in the order they were set. `pdfText` separates pages with a newline, so a
 * page is a line of it; a draft prints its banner on each, so no page of this document is textless
 * and the count is the document's own.
 */
function pages(pdf: Uint8Array): string[] {
  return pdfText(pdf)
    .split("\n")
    .filter((page) => page.trim() !== "");
}

describe("AC-4: the unpriced draft renders as a draft, byte for byte", () => {
  it("AC-4: the kinds barrel enumerates boq-draft beside proof, each behind its own file", async () => {
    const { DOCUMENT_KINDS } = await kindsModule();
    const keys = Object.keys(DOCUMENT_KINDS);
    for (const shipped of ["proof", "boq-draft"]) {
      expect(keys, `the barrel carries the \`${shipped}\` kind — one file, one barrel line, enumerated and never re-declared`).toContain(shipped);
    }

    // The roster is DERIVED, never frozen: every kind module under kinds/ is in the barrel exactly
    // once and the barrel names no kind that no module declares, so a later increment's own kind
    // (A-BBS-PDF's, AM-18) grows this expectation with it rather than reddening it (B-19).
    // white-box: AC-4 — the barrel's rule is "enumerates the FILES beside it"; the directory is
    // listed and each module is then IMPORTED and asked what kind it declares. No source is read.
    const declared = filesUnder("src/core/documents/kinds", [".ts"]).filter((file) => !/\/(index|law)\.ts$/u.test(file) && !file.includes("__tests__") && !file.endsWith(".test.ts"));
    const modules = await Promise.all(declared.map(async (file) => (await import(inTree(file))) as Record<string, unknown>));
    const kindsOfFiles = modules
      .flatMap((module_) => Object.values(module_))
      .filter((value): value is DocumentKind => typeof value === "object" && value !== null && typeof (value as DocumentKind).kind === "string" && "payloadSchema" in value)
      .map((kind) => kind.kind);
    expect([...kindsOfFiles].sort(), "the barrel's keys are exactly the kinds its own files declare").toEqual([...keys].sort());

    const draft = DOCUMENT_KINDS["boq-draft"] as DocumentKind;
    expect(draft?.kind, "the barrel files the draft under the key its own module states").toBe("boq-draft");
    expect(typeof draft?.payloadSchema?.safeParse, "the draft's payload is parsed by one Zod schema").toBe("function");
    expect(draft?.template.endsWith(".typ"), "the draft's template is a .typ file beside its kind (documentKindsPath)").toBe(true);
    expect(draft?.template.includes("/templates/boq/"), "the template stands beside the kind, not under documents/templates/boq (this increment's reading 6)").toBe(false);
  });

  it("AC-4: the committed payload renders to the same bytes twice and to the committed golden", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = fixture(PAYLOAD);

    const once = await renderDocument("boq-draft", payload, ctx);
    const twice = await renderDocument("boq-draft", payload, ctx);
    expect(sha256(twice.pdf), "one payload through the pinned renderer is one document, however many times it is asked for").toBe(sha256(once.pdf));
    expect(once.sha256, "the render states the digest of the bytes it made").toBe(sha256(once.pdf));
    expect(once.sha256, `the render matches ${GOLDEN} — a difference is either a renderer that moved or a document that changed, and both are facts this lane exists to state`).toBe(
      sha256(goldenBytes(GOLDEN)),
    );
  });

  it("AC-4: the draft renders, and the proof beside it is byte-unchanged — the frame's parameters are optional and change no default", async () => {
    const { renderDocument } = await documentsIndex();

    const draft = await renderDocument("boq-draft", fixture(PAYLOAD), ctx);
    expect(draft.sha256, `the draft renders to ${GOLDEN}`).toBe(sha256(goldenBytes(GOLDEN)));

    // white-box: AC-4 — the proof kind's own COMMITTED FIXTURE under tests/docs/proof/, never a file
    // under src/, scripts/ or db/: it is the input the shipped proof is re-rendered from, and the
    // assertion below is on the BYTES that render produced, not on anything this file read.
    const proof = await renderDocument("proof", JSON.parse(readFileSync(inTree(PROOF_PAYLOAD), "utf8")) as unknown, ctx);
    expect(proof.sha256, `${PROOF_GOLDEN} still renders to its own bytes: a frame whose new parameters are optional moves no document that does not pass them`).toBe(
      sha256(goldenBytes(PROOF_GOLDEN)),
    );
  });

  it("AC-4: DRAFT — UNSIGNED stands on every page, beside the taxonomy the draft was made under, in words", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = fixture(PAYLOAD);
    const rendered = await renderDocument("boq-draft", payload, ctx);

    const sheets = pages(rendered.pdf);
    expect(sheets.length, "the rendered draft has pages").toBeGreaterThan(0);

    const banner = "DRAFT — UNSIGNED";
    const occurrences = sheets.filter((page) => squashed(page).includes(banner)).length;
    expect(occurrences, `the banner stands at least once per page — ${sheets.length} page(s), and it was found on ${occurrences} (A-BOQ-PDF, AM-05)`).toBeGreaterThanOrEqual(sheets.length);

    const whole = squashed(sheets.join(" "));
    expect(whole, "the document states the taxonomy it was drafted under — by its edition, in words (L-BD-08, I-530)").toContain(
      `By the taxonomy of ${editionInWords(payload.taxonomyVersion)}`,
    );
    expect(whole, "and never its id: the version string is machine vocabulary (R-UI-082)").not.toContain(payload.taxonomyVersion);
    expect(whole, "no section closes on a quantity foot across descriptions (I-529)").not.toContain("Measured-scope subtotal");
    for (const section of payload.sections) {
      expect(whole, `the label of the ${section.bill} section stands in the document`).toContain(section.label);
    }

    // A golden only proves what its payload exercises. This lane's fixture therefore has to reach
    // the parts of the template a draft exists to carry — more than one section, so a section label
    // is a label and not the title; and at least one line the taxonomy could not place, so the
    // block that keeps it is rendered and graded rather than skipped (L-BD-08: kept, labelled,
    // reason stated, never dropped).
    expect(payload.sections.length, `${PAYLOAD} holds more than one section, so the section labels are graded as labels`).toBeGreaterThanOrEqual(2);
    expect(payload.unclassified.lines.length, `${PAYLOAD} holds at least one unplaced line, so the Unclassified block is rendered and graded — a golden that skips it proves the template never drops a line it never printed`).toBeGreaterThanOrEqual(1);

    expect(whole, "a line the taxonomy could not place is kept and labelled, never dropped (L-BD-08)").toContain(payload.unclassified.label);

    // The reason is STATED. Whether the document spells the law's own code or the words the product
    // publishes for it is the kind's business (R-UI-082 reads codes as words); what a draft may not
    // do is print the block and say nothing about why the line is in it.
    const strings = await productStrings();
    for (const held of payload.unclassified.lines) {
      const inWords = strings[`boq_reason_${(held.reason as string).toLowerCase()}`];
      const said = whole.match(new RegExp((held.reason as string).replace(/_/gu, "[ _]"), "iu")) !== null || (typeof inWords === "string" && inWords.length > 0 && whole.includes(squashed(inWords)));
      expect(said, `the reason ${held.reason} is stated beside the unplaced line — as the law's own code or as the words the product publishes for it`).toBe(true);
    }
  });

  it("I-530: the front page states the project in words, and no page carries an id or a raw enum", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = fixture(PAYLOAD);
    const front = payload.front as Front;
    expect(front, `${PAYLOAD} carries the front page's facts, so the project block is rendered and graded`).toBeTruthy();
    const sheets = pages((await renderDocument("boq-draft", payload, ctx)).pdf);
    const first = squashed(sheets[0] as string);
    for (const [what, value] of [
      ["the client", front.client],
      ["the site", front.site],
      ["the drawing set and its revision", front.drawingSet],
      ["the day it was issued", front.issued],
    ] as const) {
      expect(value, `${PAYLOAD} states ${what}`).toBeTruthy();
      expect(first, `the front page states ${what}`).toContain(value as string);
    }
    // TEST_AMENDED (session 9, DOC-FRONT; s-boq I-689): the drawings are stated as a register
    // of sheets — number, title, revision — and a file name is not a drawing, so the names the set was
    // uploaded under no longer print where the payload carries the register.
    expect(front.register?.length ?? 0, `${PAYLOAD} carries the drawing register, so the register is rendered and graded`).toBeGreaterThan(0);
    for (const sheet of front.register ?? []) {
      for (const fact of [sheet.sheet, sheet.title, ...(sheet.revision === null ? [] : [sheet.revision])]) expect(first, `the register states ${sheet.sheet}'s ${fact}`).toContain(fact);
    }
    for (const drawing of front.drawings) expect(first, `and no longer names the file ${drawing} as though it were a drawing`).not.toContain(drawing);
    for (const label of ["Prepared by", "Checked by"]) expect(first.toLowerCase(), `the front page carries the checking record's ${label} box, blank`).toContain(label.toLowerCase());

    const whole = squashed(sheets.join(" "));
    for (const id of [payload.campaignId, payload.setRevisionId]) expect(whole, `no surrogate id reaches a reader (R-UI-082): ${id}`).not.toContain(id);
    expect(whole, "no id of any kind").not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u);
    for (const enumWord of ["INCOMPLETE", "PARTIAL_DECLARED", "FOUNDATION", "MEASURED", "TRANSCRIBED"]) {
      expect(whole, `no raw enum reaches a reader — ${enumWord} is said in words`).not.toMatch(new RegExp(`\\b${enumWord}\\b`, "u"));
    }
    const footed = sheets.filter((page) => squashed(page).includes(`${payload.project} · `) && squashed(page).includes(`issued ${front.issued}`)).length;
    expect(footed, "every page's foot says what the paper is: the project, the draft, the day it was issued").toBe(sheets.length);
  });

  it("AC-4: every item number the numbering derives is printed, and none is stored in the payload", async () => {
    const { renderDocument } = await documentsIndex();
    const { numberItems } = await boqNumberingModule();
    const { BILL_TAXONOMY } = await boqTaxonomyModule();
    const payload = fixture(PAYLOAD);
    expect(payload.taxonomyVersion, "the committed payload is stamped with the taxonomy the product publishes").toBe(BILL_TAXONOMY.version);

    const derived = numberItems(payload.sections);
    expect(derived.size, "the committed payload holds items to number").toBe(itemsOf(payload).length);

    const whole = squashed(pages((await renderDocument("boq-draft", payload, ctx)).pdf).join(" "));
    for (const [key, item] of derived) {
      expect(whole, `the item number ${item} (${key}) that numberItems derives is the one the document prints — one derivation, two readers (B-17)`).toContain(item);
    }

    const spelled = JSON.stringify(payload);
    expect(/"item(Number)?"\s*:/u.test(spelled), "and no item or line of the committed payload carries a number of its own: item numbers are stored nowhere (AM-14 §2)").toBe(false);
  });

  it("I-528: the details of measurement print every member line behind its item — mark, grid, dimensions, sheet", async () => {
    const { renderDocument } = await documentsIndex();
    const { numberItems } = await boqNumberingModule();
    const payload = fixture(PAYLOAD);
    const numbers = numberItems(payload.sections);
    const whole = squashed(pages((await renderDocument("boq-draft", payload, ctx)).pdf).join(" "));
    const appendix = whole.slice(whole.indexOf("Details of measurement"));
    expect(whole.indexOf("Details of measurement"), "the draft carries its details of measurement").toBeGreaterThan(0);
    const many = itemsOf(payload).filter(({ item }) => item.lines.length > 1);
    expect(many.length, `${PAYLOAD} holds an item summed from more than one member line, so the rounding-once rule is graded`).toBeGreaterThanOrEqual(1);
    for (const { item } of itemsOf(payload)) {
      const number = numbers.get(item.key) as string;
      expect(appendix, `item ${number} heads its own members in the appendix`).toContain(number);
      for (const member of item.lines) {
        for (const fact of [member.mark, member.grid, member.dimensions, member.sheet]) {
          if (fact !== undefined && fact !== "") expect(appendix, `${member.lineId}'s detail ${fact} is printed under item ${number}`).toContain(squashed(fact));
        }
      }
    }
  });

  it("I-528: a group's heading is never the last thing on a page — its first item stands on the page with it", async () => {
    const { renderDocument } = await documentsIndex();
    const { DOCUMENT_KINDS } = await kindsModule();
    const payload = fixture(PAYLOAD);
    // The headings and the foot as the kind itself presents them to the template, never re-spelt here.
    const presented = (DOCUMENT_KINDS["boq-draft"] as DocumentKind).present(payload) as {
      footer: string;
      sections: { groups: { heading: string; items: { item: string }[] }[] }[];
    };
    const groups = presented.sections.flatMap((section) => section.groups).map((group) => ({ heading: group.heading.toUpperCase(), first: group.items[0]?.item ?? "" }));
    const foot = squashed(presented.footer);
    const bodies = pages((await renderDocument("boq-draft", payload, ctx)).pdf).map((page) => {
      const text = squashed(page);
      const at = text.lastIndexOf(foot);
      return (at < 0 ? text : text.slice(0, at)).trim();
    });

    for (const [at, body] of bodies.entries()) {
      const stranded = groups.find((group) => body.endsWith(group.heading));
      expect(stranded?.heading, `page ${at + 1} ends on a group's heading with its first item on the next page: …${body.slice(-120)}`).toBeUndefined();
    }
    // A golden only proves what its payload exercises: the fixture must break a page at a group's
    // start, so the rule above is graded where it bites — the heading carried over to open the page.
    const carried = bodies.slice(1).some((body) => groups.some((group) => group.first !== "" && body.includes(`UNIT ${group.heading} ${group.first} `)));
    expect(carried, `${PAYLOAD} breaks a page at a group's start, and that page opens on the group's heading and its first item`).toBe(true);
  });

  it("I-528: an item whose members run onto the next page opens that page under its own number and description again", async () => {
    const { renderDocument } = await documentsIndex();
    const { numberItems } = await boqNumberingModule();
    // The committed payload with ONE item's members made long enough to cross pages — the BNBC
    // campaign's pile items hold 89 members — each member marked so a page can be asked for it alone.
    const payload = fixture(PAYLOAD);
    const long = itemsOf(payload).find(({ item }) => item.lines.length > 0 && item.lines.every((line) => line.mark !== undefined))?.item;
    expect(long, `${PAYLOAD} holds an item whose members carry marks`).toBeDefined();
    const template = (long as Item).lines[0] as Line;
    (long as Item).lines = Array.from({ length: 120 }, (_, at) => ({ ...template, lineId: `${template.lineId}-${at}`, mark: `QX${String(at).padStart(3, "0")}` }));
    const number = numberItems(payload.sections).get((long as Item).key) as string;
    const heading = `${number} ${squashed((long as Item).description).split(" ").slice(0, 4).join(" ")}`;

    const bodies = pages((await renderDocument("boq-draft", payload, ctx)).pdf).map(squashed);
    const holding = bodies.map((body, at) => ({ at, body })).filter(({ body }) => /\bQX\d{3}\b/u.test(body));
    expect(holding.length, `the lengthened item's 120 members run across more than one page (they stand on ${holding.length})`).toBeGreaterThan(1);
    for (const { at, body } of holding) {
      expect(body, `page ${at + 1} lists members of item ${number}, so it states which item they are of`).toContain(heading);
    }
  });

  it("I-450: where nothing was measured the draft says so and why — never a zero", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = fixture(PAYLOAD);
    const items = itemsOf(payload).map(({ item }) => item);
    const unmeasured = (item: Item): Line[] => item.lines.filter((line) => line.quantity === null);

    // A golden only proves what its payload exercises: an item none of whose lines states a figure,
    // and an item only some of whose lines do.
    const none = items.filter((item) => unmeasured(item).length === item.lines.length);
    const some = items.filter((item) => unmeasured(item).length > 0 && unmeasured(item).length < item.lines.length);
    expect(none.length, `${PAYLOAD} holds an item none of whose lines states a figure, so its row is graded`).toBeGreaterThanOrEqual(1);
    expect(some.length, `${PAYLOAD} holds a partly measured item, so its qualified figure is graded`).toBeGreaterThanOrEqual(1);

    const whole = squashed(pages((await renderDocument("boq-draft", payload, ctx)).pdf).join(" "));

    // A zero is a figure: `Column · Rebar 0.000 kg` reads as "no steel in the columns" (L-QTY-04).
    expect(whole, "no figure on the page is a zero — a sum of nothing is not a quantity anybody measured").not.toMatch(/(^|\s)0\.0+(\s|$)/u);

    const notMeasured = (whole.match(/Not measured(?! in this draft)/gu) ?? []).length;
    const lines = items.flatMap(unmeasured).length + payload.unclassified.lines.filter((line) => line.quantity === null).length;
    expect(notMeasured, `every item and member line with no figure says "Not measured" — ${lines} line(s) and ${none.length} item(s) at least`).toBeGreaterThanOrEqual(lines + none.length);

    for (const item of items) {
      for (const line of unmeasured(item)) {
        expect(line.omitted?.length ?? 0, `${line.lineId} states no figure and names what it could not measure (L-QTY-02)`).toBeGreaterThan(0);
        for (const code of line.omitted ?? []) {
          expect(whole, `${line.lineId}'s reason ${code} is said in words on the page, never as a code`).toContain(codeInWords(code));
          expect(whole, `and the code itself is not printed (R-UI-082)`).not.toContain(code);
        }
      }
    }
    for (const item of some) {
      const measured = item.lines.length - unmeasured(item).length;
      expect(whole, `${item.description}'s figure is qualified by how many of its lines it covers`).toContain(`${measured} of ${item.lines.length} measured; ${unmeasured(item).length} not measured`);
    }
    for (const item of none) {
      expect(whole, `${item.description} says none of its lines was measured`).toContain(`None of ${item.lines.length} measured`);
    }
  });

  it("I-451: the draft closes on what it did not measure, in the registry's own words", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = fixture(PAYLOAD);
    const rows = payload.notMeasured ?? [];
    expect(rows.length, `${PAYLOAD} carries the measurement statement, so the closing block is rendered and graded`).toBeGreaterThanOrEqual(1);
    expect(
      rows.some((row) => row.class === null),
      `${PAYLOAD} carries a kind no class bears, so a row that names no class is graded`,
    ).toBe(true);

    const whole = squashed(pages((await renderDocument("boq-draft", payload, ctx)).pdf).join(" "));
    const registry = await registeredMessages();
    const closing = whole.slice(whole.indexOf("Not measured in this draft"));
    expect(whole.indexOf("Not measured in this draft"), "the draft closes on a block that says what it leaves out").toBeGreaterThan(0);

    for (const row of rows) {
      const message = registry[row.cause]?.message;
      expect(message, `${row.cause} is a registered cause, with a sentence of its own`).toBeTruthy();
      expect(closing, `the ${row.class ?? "(no class)"} × ${row.kind} row states why, in the registry's own sentence`).toContain(squashed(message as string));
      if (row.levels !== "") expect(closing, `and over which levels: ${row.levels}`).toContain(row.levels);
    }
    const codes = new Set(itemsOf(payload).flatMap(({ item }) => item.lines.flatMap((line) => (line.quantity === null ? (line.omitted ?? []) : []))));
    for (const code of codes) {
      const message = registry[code]?.message;
      expect(message, `${code} is a registered omission, with a sentence of its own`).toBeTruthy();
      expect(closing, `each reason a line gives is explained once, in the registry's own sentence: ${code}`).toContain(squashed(message as string));
    }
  });

  it("AC-4: a draft is never called a bill, and carries no surveyor, credential, certificate or total", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = fixture(PAYLOAD);
    const rendered = await renderDocument("boq-draft", payload, ctx);
    const whole = squashed(pages(rendered.pdf).join(" "));

    // THE STAMP IS NOT COPY. L-BD-08 requires the taxonomy version on the document, and it is stated
    // by its EDITION in words (I-530) — so the version's own literal, which spells the word
    // this criterion bans, never reaches the page, and nothing needs excising. AM-05 (2) bans the
    // document CALLING itself a bill — a heading, a label, a foot, a file name.
    const prose = whole.split(payload.taxonomyVersion).join(" ");

    const forbidden: readonly [RegExp, string][] = [
      [/\bbills?\b/iu, "a draft is not a bill — the word states a status this document does not have (AM-05, reading 9)"],
      [/surveyor/iu, "no surveyor: nobody has signed this (M7 owns the signature)"],
      [/credential/iu, "no credential beside a name nobody put here"],
      [/certificate/iu, "no certificate: the coverage certificate belongs to A-BILL-PDF"],
      [/grand total/iu, "no grand total under incomplete coverage (L-QTY-04)"],
      [/\btotal\b/iu, "and no bare total either — a figure that hides what it does not cover is the failure this product is built against"],
    ];
    for (const [pattern, why] of forbidden) {
      expect(prose, why).not.toMatch(pattern);
    }

    // white-box: AC-4 — the second half of this criterion is a property of this LANE'S OWN TEST TEXT
    // ("no file under tests/docs/** names the two spellings of a duration assertion"), not of the
    // product; no src/ file is read. It stands in this case rather than its own so that the lane
    // grades the document and its own restraint in one breath.
    const suites = filesUnder("tests/docs", [".ts"]);
    expect(suites.length, "the document lane has suites").toBeGreaterThan(0);
    // Spelled in halves so that this suite — which is itself under tests/docs/** — is not the file
    // that fails its own rule.
    const banned = [`performance${"."}now`, `toBe${"LessThan"}`];
    for (const file of suites) {
      // Comments are blanked: a suite that QUOTES the rule is not a suite that breaks it (Q-17).
      const text = withoutComments(file);
      for (const spelling of banned) {
        expect(text.includes(spelling), `${file} does not name ${spelling}: performance assertions live only in PERF- specs (AM-10 §3)`).toBe(false);
      }
    }
  });
});

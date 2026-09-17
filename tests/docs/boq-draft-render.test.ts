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
 * It lives flat beside the lane's other suites because that is what `tests/docs/vitest.config.ts`
 * collects (`*.test.ts` under its own root); its FIXTURES stay under `tests/docs/boq-draft/`, which
 * is the kind's own fixture root (docs/design/s-boq.md §7).
 *
 * `tests/docs/proof/golden.pdf` is asserted UNMOVED here: this increment adds two optional
 * parameters to `documents/base/frame.typ`, and a default that changed the frame would rewrite a
 * document nobody asked to change. Nothing here measures time (AM-10 §3).
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

/** One line of a payload section, as the kind's schema holds it. */
type Line = { lineId: string; quantity: string | null; reason?: string };
type Group = { class: string; kind: string; lines: Line[] };
type Section = { bill: string; label: string; groups: Group[] };
type Payload = { taxonomyVersion: string; coverage: string; sections: Section[]; unclassified: { label: string; lines: (Line & { reason: string })[] } };

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
  // scripts/ or db/. "the proof's golden is byte-identical after the frame gains its two optional
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

  it("AC-4: the draft renders, and the proof beside it is byte-unchanged — the frame gained two parameters and no default", async () => {
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

  it("AC-4: DRAFT — UNSIGNED stands on every page, beside the taxonomy the draft was made under", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = fixture(PAYLOAD);
    const rendered = await renderDocument("boq-draft", payload, ctx);

    const sheets = pages(rendered.pdf);
    expect(sheets.length, "the rendered draft has pages").toBeGreaterThan(0);

    const banner = "DRAFT — UNSIGNED";
    const occurrences = sheets.filter((page) => squashed(page).includes(banner)).length;
    expect(occurrences, `the banner stands at least once per page — ${sheets.length} page(s), and it was found on ${occurrences} (A-BOQ-PDF, AM-05)`).toBeGreaterThanOrEqual(sheets.length);

    const whole = squashed(sheets.join(" "));
    expect(whole, "the document states the taxonomy version it was drafted under (L-BD-08)").toContain(payload.taxonomyVersion);
    expect(whole, "and every section it holds is labelled").toContain("Measured-scope subtotal");
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
      const inWords = strings[`boq_reason_${held.reason.toLowerCase()}`];
      const said = whole.match(new RegExp(held.reason.replace(/_/gu, "[ _]"), "iu")) !== null || (typeof inWords === "string" && inWords.length > 0 && whole.includes(squashed(inWords)));
      expect(said, `the reason ${held.reason} is stated beside the unplaced line — as the law's own code or as the words the product publishes for it`).toBe(true);
    }
  });

  it("AC-4: every item number the numbering derives is printed, and none is stored in the payload", async () => {
    const { renderDocument } = await documentsIndex();
    const { numberItems } = await boqNumberingModule();
    const { BILL_TAXONOMY } = await boqTaxonomyModule();
    const payload = fixture(PAYLOAD);
    expect(payload.taxonomyVersion, "the committed payload is stamped with the taxonomy the product publishes").toBe(BILL_TAXONOMY.version);

    const derived = numberItems(payload.sections);
    expect(derived.size, "the committed payload holds lines to number").toBeGreaterThan(0);

    const whole = squashed(pages((await renderDocument("boq-draft", payload, ctx)).pdf).join(" "));
    for (const [lineId, item] of derived) {
      expect(whole, `the item number ${item} (line ${lineId}) that numberItems derives is the one the document prints — one derivation, two readers (B-17)`).toContain(item);
    }

    const spelled = JSON.stringify(payload);
    expect(/"item(Number)?"\s*:/u.test(spelled), "and no line of the committed payload carries a number of its own: item numbers are stored nowhere (AM-14 §2)").toBe(false);
  });

  it("AC-4: a draft is never called a bill, and carries no surveyor, credential, certificate or total", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = fixture(PAYLOAD);
    const rendered = await renderDocument("boq-draft", payload, ctx);
    const whole = squashed(pages(rendered.pdf).join(" "));

    // THE STAMP IS NOT COPY. L-BD-08 requires the taxonomy version on the document, and the version
    // AC-1 freezes spells the word this criterion bans (`bill-taxonomy/…`). AM-05 (2) bans the
    // document CALLING itself a bill — a heading, a label, a foot, a file name — not a machine
    // identifier a reader never reads as prose (the carve-out AC-8 states for `[data-technical]`).
    // So the stamp is required to be PRESENT and then excised, by its exact literal value and by
    // nothing wider: any other "bill" — in a heading, a label, a subtotal caption or a foot — still
    // fails every pattern below.
    expect(whole, "the document carries the taxonomy version it was drafted under (L-BD-08)").toContain(payload.taxonomyVersion);
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

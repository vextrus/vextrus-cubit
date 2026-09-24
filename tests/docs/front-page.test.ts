/**
 * The draft BOQ's and the bar schedule's front pages read as a QS's documents (session 9, DOC-FRONT;
 * walk-1's qs-critic, B18; s-boq I-689..e, s-bbs I-694).
 *
 * What is judged is the ARTEFACT, rendered through the pinned renderer from the lane's committed
 * payloads: the BOQ's front page lists the drawings it measured as a register of sheets (number,
 * title, revision), opens on measurement notes that name the method and the edition in force and
 * say what each basis and `Not measured` mean, and gives each checking box a signature line; both
 * papers say one phrase where the project states no client or site; the bar schedule's paper is
 * clean of the watermark's veil; and each PDF's own creation date is the day it was issued, never
 * the renderer's pinned epoch.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pdfText } from "./support/pdf-text";
import { inTree, squashed } from "./support/product";
import { documentsIndex, kindsModule } from "./support/seam";

const BOQ_PAYLOAD = "tests/docs/boq-draft/payload.json";
const BBS_PAYLOAD = "tests/docs/bbs/payload.json";
const PROOF_PAYLOAD = "tests/docs/proof/payload.json";

const ctx = { requestId: "doc-front", actor: "acceptance" };

type Front = {
  client: string | null;
  site: string | null;
  register?: { sheet: string; title: string; revision: string | null }[];
  edition?: { name: string; version: string } | null;
  issued: string | null;
};
type BoqPayload = { front: Front } & Record<string, unknown>;
type BbsPayload = { particulars: { client: string | null; site: string | null } } & Record<string, unknown>;

/** A committed payload of this lane, read fresh each time so a test may change its copy. */
function payloadAt<T>(relative: string): T {
  return JSON.parse(readFileSync(inTree(relative), "utf8")) as T;
}

/** The first page's words, squashed as the lane reads them. */
function firstPage(pdf: Uint8Array): string {
  return squashed(pdfText(pdf).split("\n").find((page) => page.trim() !== "") ?? "");
}

/** The creation date a PDF states in its document information, or null where it states none. */
function creationDateOf(pdf: Uint8Array): string | null {
  return /\/CreationDate\s*\(D:(\d{8})/u.exec(Buffer.from(pdf).toString("latin1"))?.[1] ?? null;
}

/** Whether any page is painted through a partial fill alpha — the watermark's veil is the frame's one. */
function veiled(pdf: Uint8Array): boolean {
  return /\/ca\s+0\.\d+/u.test(Buffer.from(pdf).toString("latin1"));
}

describe("DOC-FRONT: the draft BOQ's front page", () => {
  it("I-689: the drawings measured are a register of sheets, each by number, title and revision", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = payloadAt<BoqPayload>(BOQ_PAYLOAD);
    const first = firstPage((await renderDocument("boq-draft", payload, ctx)).pdf);
    expect(first).toContain("Drawings measured");
    const register = payload.front.register ?? [];
    expect(register.some((sheet) => sheet.revision === null), `${BOQ_PAYLOAD} holds a sheet whose title block marks no revision, so the words for it are graded`).toBe(true);
    for (const sheet of register) {
      expect(first, `${sheet.sheet} stands in the register with its title and revision`).toContain(squashed(`${sheet.sheet} ${sheet.title} ${sheet.revision ?? "Not marked"}`));
    }
  });

  it("I-689: without a register the page still names the drawings, by the names they were uploaded under", async () => {
    const { DOCUMENT_KINDS } = await kindsModule();
    const payload = payloadAt<BoqPayload>(BOQ_PAYLOAD);
    delete payload.front.register;
    const presented = DOCUMENT_KINDS["boq-draft"]?.present(payload) as { front: { rows: { label: string; value: string }[]; register: { rows: unknown[] } } };
    expect(presented.front.register.rows).toEqual([]);
    expect(presented.front.rows.map((row) => row.label)).toContain("Drawings");
  });

  it("I-691: the measurement notes name the method and the edition in force, the bases and what Not measured means", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = payloadAt<BoqPayload>(BOQ_PAYLOAD);
    const edition = payload.front.edition;
    expect(edition, `${BOQ_PAYLOAD} names the edition its campaign was measured under`).toBeTruthy();
    const first = firstPage((await renderDocument("boq-draft", payload, ctx)).pdf);
    expect(first).toContain("Measurement notes");
    expect(first, "the edition in force by name and version").toContain(`the rule-set edition ${edition?.name}, version ${edition?.version}`);
    for (const basis of ["Measured read off the drawing's geometry", "Derived computed by a named rule", "Interpreted traced from a scanned image"]) {
      expect(first, `the basis ${basis.split(" ")[0]} is said in words`).toContain(basis);
    }
    expect(first, "a basis no line rests on is not listed").not.toContain("Defaulted supplied by");
    expect(first, "what Not measured means").toContain("Not measured means the draft states no figure");
    expect(first, "and the rounding rule, which the Details of measurement no longer repeats").toContain("rounded once to the places its kind is written to");
  });

  it("I-691: a draft whose payload names no edition says so, rather than naming one", async () => {
    const { DOCUMENT_KINDS } = await kindsModule();
    const payload = payloadAt<BoqPayload>(BOQ_PAYLOAD);
    payload.front.edition = null;
    const presented = DOCUMENT_KINDS["boq-draft"]?.present(payload) as { front: { notes: { items: { text: string }[] } } };
    expect(presented.front.notes.items[0]?.text).toContain("which this draft does not name");
  });

  it("I-692: each checking box carries a name, a signature and a date line", async () => {
    const { renderDocument } = await documentsIndex();
    const first = firstPage((await renderDocument("boq-draft", payloadAt<BoqPayload>(BOQ_PAYLOAD), ctx)).pdf);
    expect(first).toContain("PREPARED BY Name Signature Date CHECKED BY Name Signature Date");
  });

  it("I-693: the PDF is dated the day it was issued, and a reading nobody issued carries no date", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = payloadAt<BoqPayload>(BOQ_PAYLOAD);
    expect(payload.front.issued).toBe("24 Sep 2026");
    expect(creationDateOf((await renderDocument("boq-draft", payload, ctx)).pdf), "the issue day, not 1 Jan 1970").toBe("20260924");
    payload.front.issued = null;
    expect(creationDateOf((await renderDocument("boq-draft", payload, ctx)).pdf), "no issue, no date").toBeNull();
  });
});

describe("DOC-FRONT: the bar schedule's front page", () => {
  it("I-690: a client or site the project does not state reads as the draft BOQ reads it", async () => {
    const { renderDocument } = await documentsIndex();
    const payload = payloadAt<BbsPayload>(BBS_PAYLOAD);
    payload.particulars.client = null;
    payload.particulars.site = null;
    const first = firstPage((await renderDocument("bbs", payload, ctx)).pdf);
    expect(first).toContain("Client Not stated");
    expect(first).toContain("Site Not stated");
    expect(first).not.toContain("Not recorded");
  });

  it("I-694: the schedule's paper carries no watermark, and the proof's still does", async () => {
    const { renderDocument } = await documentsIndex();
    expect(veiled((await renderDocument("bbs", payloadAt<unknown>(BBS_PAYLOAD), ctx)).pdf), "the schedule is set on clean paper").toBe(false);
    expect(veiled((await renderDocument("proof", payloadAt<unknown>(PROOF_PAYLOAD), ctx)).pdf), "the veil this reads is the watermark's: the proof keeps it").toBe(true);
  });

  it("I-693: the schedule's PDF is dated the day it was issued", async () => {
    const { renderDocument } = await documentsIndex();
    expect(creationDateOf((await renderDocument("bbs", payloadAt<unknown>(BBS_PAYLOAD), ctx)).pdf)).toBe("20260924");
  });
});

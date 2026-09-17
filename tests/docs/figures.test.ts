/**
 * L-FMT-02 on the page: a figure past the first thousand is grouped the way this product groups, and
 * the document says it that way.
 *
 * `figures.ts` refusing the wrong precision is the seam's own suite to prove
 * (src/core/documents/__tests__/figures.test.ts); what only the document lane can show is the other
 * half — that the figure a template prints is the grouped one, lakh/crore, set once, with its unit
 * standing beside it rather than inside it. A unit test of the formatter would agree with the
 * formatter; this reads the answer back off the rendered artefact.
 *
 * Nothing here measures time (AM-10 §3, this increment's out-of-scope list).
 */
import { describe, expect, it } from "vitest";
import { pdfText } from "./support/pdf-text";
import { squashed } from "./support/product";
import { documentsIndex, type RenderedDocument } from "./support/seam";

const ctx = { requestId: "figures-on-the-page", actor: "acceptance" };

/** One crore, twenty-three lakh and some — the first figure that needs more than one separator. */
const LAKH_QUANTITY = "1234567.500";

/** What this product writes that number as: lakh/crore groups, the fraction exactly as it arrived. */
const AS_WRITTEN = "12,34,567.500";

let rendering: Promise<RenderedDocument> | undefined;
const rendered = (): Promise<RenderedDocument> =>
  (rendering ??= (async () => {
    const { renderDocument } = await documentsIndex();
    return renderDocument(
      "proof",
      {
        title: "A figure past the first thousand",
        project: "F-RCC6 six-storey residential",
        lines: [{ ref: "1.01", description: "Damp-proof course along the external wall, ground floor", quantity: LAKH_QUANTITY, unit: "m" }],
      },
      ctx,
    );
  })());

describe("a figure on a document is grouped lakh/crore, and its unit stands apart from it", () => {
  it("prints the grouped figure, and never the ungrouped digits it was given", async () => {
    const text = squashed(pdfText((await rendered()).pdf));
    expect(text, "beyond one group this product writes lakh/crore, not thousands (L-FMT-02)").toContain(AS_WRITTEN);
    expect(text, "the digits as the payload wrote them are not what a document shows").not.toContain(LAKH_QUANTITY);
  });

  it("renders the number once, and its unit as its own word", async () => {
    const text = squashed(pdfText((await rendered()).pdf));
    expect(text.split(AS_WRITTEN).length - 1, "a number renders once per document (L-FMT-02)").toBe(1);
    // The unit renders from the enum, separately from its quantity — so the figure is never carrying
    // its unit inside it, and a reader finds the two apart.
    expect(text, "the unit is a field of its own, not a suffix on the figure").not.toContain(`${AS_WRITTEN} m,`);
    expect(text, "and it is on the page beside the figure").toContain(`${AS_WRITTEN} m`);
  });

  it("never writes the compact spellings, which are unlawful on a document", async () => {
    const text = squashed(pdfText((await rendered()).pdf));
    for (const compact of ["12.35 Cr", "123.46 L", "1.23 Cr"]) {
      expect(text, `compact ${compact} never appears on a document (L-FMT-02)`).not.toContain(compact);
    }
  });
});

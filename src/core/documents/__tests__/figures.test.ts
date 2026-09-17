// L-FMT-02 at the seam, not at the formatter: what a document does with a figure that is not exactly
// at its kind's stated precision.
//
// `src/core/documents/figures.ts` states the discipline, but a caller never reaches it directly — a
// figure crosses it inside the KIND's `present()`, which is where PRECISION_NOT_APPLIED has to
// surface if it is to mean anything to a person asking for a document. So every case here goes
// through `renderDocument("proof", …)`, the way a real caller arrives, and reads the answer by its
// registered code.
//
// The subprocess and the faces are injected and the compile is asserted NEVER to run: a figure at the
// wrong precision is refused before a directory is made, which is the difference between a document
// that was not produced and one that was produced wrong (L-FMT-02 — the seam never rounds, never pads).
import { describe, expect, it } from "vitest";
import { refusalCodeOf } from "../../faults/refusal-marker";
import type { EmbeddedFont } from "../fonts";
import { renderDocument } from "../index";
import { PROOF_QUANTITY_PRECISION } from "../kinds/proof";

const ctx = { requestId: "figures-request", actor: "figures-suite" };

/** A face that maps everything: coverage is `tests/docs/fonts.test.ts`'s question, not this one's. */
const everyGlyph: readonly EmbeddedFont[] = Object.freeze([
  Object.freeze({ file: "spline-sans-regular.ttf", sha256: "0".repeat(64), licence: "OFL-spline-sans.txt", covers: () => true }),
]);

/** The committed proof payload's shape, with one quantity written as this case writes it. */
const payloadWith = (quantity: string): unknown => ({
  title: "A figure at the wrong precision",
  project: "F-RCC6 six-storey residential",
  lines: [{ ref: "1.01", description: "A line whose quantity decides whether there is a document at all", quantity, unit: "m" }],
});

/** Renders one quantity, answering what came back and whether the subprocess was ever asked to run. */
async function render(quantity: string): Promise<{ failure: unknown; compiled: boolean }> {
  let compiled = false;
  const failure = await renderDocument("proof", payloadWith(quantity), ctx, {
    compile: async () => {
      compiled = true;
      return new Uint8Array([1, 2, 3]);
    },
    fonts: async () => everyGlyph,
  }).then(
    () => null,
    (thrown: unknown) => thrown,
  );
  return { failure, compiled };
}

describe("a figure crosses the seam at its kind's precision or not at all", () => {
  it("renders the figure that IS at the kind's stated precision", async () => {
    const { failure, compiled } = await render("12.500");
    expect(failure, `${String(PROOF_QUANTITY_PRECISION)} fraction digits is what this kind states, so this is a document`).toBeNull();
    expect(compiled, "a payload the seam can read reaches the renderer").toBe(true);
  });

  // The roster is the whole of what L-FMT-02 refuses, each written the way a caller would write it:
  // one digit short, one digit long, and a figure somebody had already grouped before handing it over.
  for (const [quantity, why] of [
    ["12.50", "a digit short is not 'nearly right' — the seam does not pad"],
    ["12.5000", "a digit long is not 'nearly right' either — the seam does not round"],
    ["12,500", "a figure that arrives already grouped is one somebody else formatted"],
  ] as const) {
    it(`refuses ${quantity} by name, and never reaches the renderer — ${why}`, async () => {
      const { failure, compiled } = await render(quantity);
      expect(refusalCodeOf(failure), "malformed and off-precision take the SAME registered code (L-FMT-02)").toBe("PRECISION_NOT_APPLIED");
      expect(compiled, "a refusal costs no subprocess, no directory and no wait").toBe(false);
    });
  }
});

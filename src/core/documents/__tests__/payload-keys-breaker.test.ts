/**
 * BREAKER (inc-300a, SEAM-DOC, L-FMT-03): a key a kind's schema does not register must be a
 * REFUSAL, at every level of the payload — not a field quietly dropped on the way to the template.
 *
 * `proofPayloadSchema` is `.strict()` and its own comment states the law it is keeping: "Unknown
 * keys are refused: a payload is a statement, not a bag." The settled reading on SEAM-DOC says the
 * same thing about the far side generally — "an unregistered key is a refusal this seam owes".
 * `proofLine`, one level down, is not strict, so the promise stops at the top object: a line
 * carrying a field the schema never heard of renders a document as if the caller had never written
 * it, and answers a payloadDigest identical to the one the stripped payload would have produced.
 *
 * That is the shape of a published figure that is quietly under. A caller that writes `qty_gross`
 * where a later kind expects `quantity` is told nothing at all, and the document it receives states
 * less than the payload it asked for — whereas the same mis-spelling at the top of the payload is
 * refused by name. One seam, two answers to one question.
 *
 * Nothing here opens a database and nothing here reaches the subprocess: the faces and the compile
 * are both injected, so this suite belongs to the unit lane it stands in.
 */
import { describe, expect, it, vi } from "vitest";
import { renderDocument, type EmbeddedFont } from "..";
import { refusalCodeOf } from "../../faults/refusal-marker";

const ctx = { requestId: "breaker-payload-keys", actor: "breaker" } as const;

/** A face that maps everything: the repertoire is AC-3's question, not this one. */
const EVERY_CHARACTER: readonly EmbeddedFont[] = Object.freeze([
  Object.freeze({ file: "breaker.ttf", sha256: "0".repeat(64), licence: "OFL-breaker.txt", covers: (): boolean => true }),
]);

/** The committed proof payload's shape, with one line this test then adds a key to. */
const payload = (line: Record<string, unknown>): Record<string, unknown> => ({
  title: "Document seam proof",
  project: "F-RCC6 six-storey residential",
  lines: [line],
});

const LINE = { ref: "1.01", description: "Damp-proof course along the external wall, ground floor", quantity: "12.500", unit: "m" };

describe("BREAKER: an unregistered key is a refusal this seam owes, at every level of the payload", () => {
  it("refuses a proof LINE carrying a key the kind's schema does not register, and stages nothing", async () => {
    const compile = vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    const fonts = (): Promise<readonly EmbeddedFont[]> => Promise.resolve(EVERY_CHARACTER);

    const answered = await renderDocument("proof", payload({ ...LINE, qtyGross: "99.999" }), ctx, { compile, fonts }).then(
      () => null,
      (raised: unknown) => raised,
    );

    expect(
      refusalCodeOf(answered),
      "the top of the payload refuses an unregistered key by name (DOCUMENT_PAYLOAD_MALFORMED); a line must answer the same question the same way, rather than rendering a document the caller did not describe",
    ).toBe("DOCUMENT_PAYLOAD_MALFORMED");
    expect(compile, "a refusal costs no subprocess — the reading happens before anything is staged").not.toHaveBeenCalled();
  });

  it("does not answer the same payloadDigest for a payload that carried a field and one that did not", async () => {
    const compile = vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    const fonts = (): Promise<readonly EmbeddedFont[]> => Promise.resolve(EVERY_CHARACTER);

    const clean = await renderDocument("proof", payload(LINE), ctx, { compile, fonts });
    const digestOfExtra = await renderDocument("proof", payload({ ...LINE, qtyGross: "99.999" }), ctx, { compile, fonts })
      .then((rendered) => rendered.payloadDigest)
      .catch(() => null);

    expect(
      digestOfExtra,
      "a payload the seam could not read whole must be refused, never digested as though it were the payload that was asked for (L-FMT-03: the digest is of the thing that was rendered)",
    ).not.toBe(clean.payloadDigest);
  });
});
